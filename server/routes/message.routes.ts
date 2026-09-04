/**
 * server/routes/message.routes.ts
 *
 * Route handlers: message domain.
 * Extracted from routes.ts monolith.
 */
import type { Express, Request, Response, NextFunction } from "express";
import { storage } from "../storage.js";
import {
  requireAuth, requireRole,
  sessionSchoolId, isInSupportMode, isPlatformOwnerRequest, isPlatformOwnerRole,
  getActiveRequestContext, resolveRole,
  auditLog, rateLimit,
  routeParam, normalizeEmail, normalizeSchoolCode, extractSupportReason,
  PLATFORM_OWNER_ROLES, ADMIN_UI_ROLES, FINANCE_ROLES,
  BRANDING_VIEW_PERMISSION, BRANDING_MANAGE_PERMISSION,
  BRANDING_UPLOAD_LOGO_PERMISSION, BRANDING_UPDATE_THEME_PERMISSION, BRANDING_RESET_DEFAULT_PERMISSION,
  COMPLETE_SETUP_STATUSES, CONTEXT_DEFAULT_PATHS,
  safeUser, buildAuthUserResponse, syncSessionActiveContext, getUserAccessProfile,
  getPublicBaseUrl, toEmailSafeLogoUrl, parseDataUriImage, getEmailBrandingForSchool,
  splitInviteToken, resolveInviteByToken, acceptInviteToken,
  generateLinkingCode, generatePaymentReference,
  roleBadge, formatUserForAdmin,
  getScopedAdminUsers, canManageUser, enforceRoleUpdateGuards,
  getSchoolSetupState, setupMilestonesFromState, deriveInviteStatus, nextOwnerAction,
  normalizeSchoolSetupStatus, SCHOOL_SETUP_STEP_LABELS,
  brandingUpload, runSingleBrandingUpload,
  canViewBranding, canManageBranding, canManageBrandingOperation, resolveTenantBranding,
  getBrandingPermissionSet,
} from "../middleware/auth.js";

import {
  sendPaymentSubmittedEmail, sendPaymentVerifiedEmail, sendPaymentRejectedEmail,
  isResendConfigured,
} from "../email.js";
import { createExternalPayment, verifyWebhookRequest, isExternalIntegrationEnabled } from "../paymentIntegration.js";

export function registerMessageRoutes(app: Express): void {
  /**
   * Payment provider webhook.
   *
   * Four things a signed webhook needs and this one did not have:
   *
   *   1. The signature is now checked against the RAW request bytes
   *      (`req.rawBody`, captured by the express.json verify hook), not against
   *      `JSON.stringify(req.body)` — a re-serialisation of the body that need
   *      not match what the sender signed.
   *   2. A timestamp inside the signed value, with a five-minute tolerance.
   *   3. An event id, claimed exactly once before any work happens. Without it a
   *      captured delivery could be replayed forever to re-settle an order.
   *   4. An unambiguous school. Payment references are unique only WITHIN a
   *      school, so a reference held by two tenants used to settle whichever row
   *      the database returned first.
   */
  app.post("/api/webhooks/payment-update", async (req, res) => {
    const SOURCE = "payment-update";
    const eventId = String(req.headers["x-event-id"] || "");

    try {
      const rawBody = Buffer.isBuffer(req.rawBody)
        ? req.rawBody.toString("utf8")
        : typeof req.rawBody === "string" ? req.rawBody : "";

      const verification = verifyWebhookRequest({
        rawBody,
        signature: String(req.headers["x-signature"] || ""),
        timestamp: String(req.headers["x-timestamp"] || ""),
        eventId,
      });
      if (!verification.ok) {
        return res.status(verification.status).json({ message: verification.reason });
      }

      // ── Replay protection ──────────────────────────────────────────────
      // The insert is the lock. A redelivery of the same event — which providers
      // do routinely on timeout — is acknowledged with 200 and does nothing,
      // because acting twice would settle the order twice.
      const claimed = await storage.claimWebhookEvent(SOURCE, eventId);
      if (!claimed) {
        return res.json({ message: "Already processed", eventId });
      }

      const { externalPaymentId, eduBookReference, status, notes } = req.body;
      if (!eduBookReference || !status) {
        await storage.completeWebhookEvent(SOURCE, eventId, "failed", "missing reference or status");
        return res.status(400).json({ message: "eduBookReference and status are required" });
      }

      // ── Tenant resolution ──────────────────────────────────────────────
      const matches = await storage.getPaymentsByReference(String(eduBookReference));
      if (matches.length === 0) {
        await storage.completeWebhookEvent(SOURCE, eventId, "failed", "reference not found");
        return res.status(404).json({ message: "Payment not found for that reference." });
      }
      if (matches.length > 1) {
        // Do not guess. Settling the wrong school's order moves money and books.
        await storage.completeWebhookEvent(SOURCE, eventId, "failed", "ambiguous reference across schools");
        console.error(`[webhook] reference matches ${matches.length} payments across schools — refusing to act.`);
        return res.status(409).json({ message: "That reference is ambiguous. Contact support." });
      }
      const target = matches[0];

      // ── Provider-payment ownership ─────────────────────────────────────
      //
      // This webhook used to write `external_payment_id` straight through
      // `updatePaymentByReference`. The unique index from migration 006 still
      // stopped a second order taking a transaction, so it was never a
      // double-settlement bypass — but the 23505 surfaced through the catch
      // below as a 500 "Webhook processing failed", telling the sender nothing
      // and recording the delivery as an unexplained failure.
      //
      // Ownership now goes through the same call automatic verification and the
      // Finance override use. One invariant, one code path, one error.
      const citedProviderId = String(externalPaymentId ?? "").trim();
      if (citedProviderId) {
        const claim = await storage.claimProviderPayment(
          target.id,
          citedProviderId,
          status ? String(status) : null,
          target.schoolId,
        );

        if (!claim.claimed) {
          // Fail closed either way: this webhook does not settle, reject or
          // advance the order, and it does not disturb whoever holds the
          // transaction. The message says what happened without naming tables,
          // constraints or SQLSTATEs.
          const detail = claim.heldByAnotherOrder
            ? "provider transaction already settles a different order"
            : "order already carries a different provider transaction";

          await storage.completeWebhookEvent(SOURCE, eventId, "failed", detail);
          console.error(`[webhook] refusing ${eventId}: ${detail}.`);

          return res.status(409).json({
            message: claim.heldByAnotherOrder
              ? "This provider transaction has already been used to settle a different order."
              : "This order is already linked to a different provider transaction.",
          });
        }
      }

      // Non-ownership metadata only. `externalPaymentId` is deliberately absent:
      // it is assigned by the claim above and nowhere else on this path.
      const updates: { externalPaymentStatus?: string; notes?: string } = {};
      if (status) updates.externalPaymentStatus = String(status);
      if (notes) updates.notes = String(notes);

      const payment = await storage.updatePaymentByReference(String(eduBookReference), updates);
      if (!payment) {
        await storage.completeWebhookEvent(SOURCE, eventId, "failed", "reference disappeared mid-update");
        return res.status(404).json({ message: "Payment not found for that reference." });
      }

      if (status === "confirmed" || status === "paid" || status === "completed") {
        await storage.confirmPayment(payment.id, "webhook", undefined, target.schoolId);
      } else if (status === "rejected" || status === "failed" || status === "cancelled") {
        await storage.rejectPayment(payment.id, "webhook", undefined, target.schoolId);
      }

      await storage.completeWebhookEvent(SOURCE, eventId, "completed");
      res.json({ message: "Payment updated", paymentId: payment.id });
    } catch (e: any) {
      if (eventId) {
        await storage.completeWebhookEvent(SOURCE, eventId, "failed", e?.message).catch(() => {});
      }
      console.error("[webhook] payment-update failed:", e?.message);
      res.status(500).json({ message: "Webhook processing failed." });
    }
  });

  // ═══ PARENT–TEACHER MESSAGING ════════════════════════════════

  // Helper: get the parent's linked children with class + teacher info
  async function getParentLinkedTeachers(parentEmail: string, schoolId: string) {
    const children = await storage.getParentChildren(parentEmail);
    const classes = await storage.getClasses(schoolId);
    const users = await storage.getUsers();

    const classesById = new Map(classes.map((cls) => [cls.id, cls]));
    const schoolTeachersById = new Map(
      users
        .filter((u) => u.schoolId === schoolId && resolveRole(u.role) === "teacher")
        .map((u) => [u.id, u]),
    );

    const eligibleChildren = children.filter((link) => link.student?.schoolId === schoolId);

    // Fallback for legacy data: resolve class IDs not returned by school-scoped class query.
    const missingClassIds = new Set<string>();
    for (const link of eligibleChildren) {
      const classId = link.student?.classId;
      if (classId && !classesById.has(classId)) {
        missingClassIds.add(classId);
      }
    }

    if (missingClassIds.size > 0) {
      const allClasses = await storage.getClasses();
      for (const cls of allClasses) {
        if (missingClassIds.has(cls.id)) {
          classesById.set(cls.id, cls);
        }
      }
    }

    const contacts: Array<{ teacherUserId: string; teacherName: string; studentId: string; studentName: string; className: string }> = [];
    const seen = new Set<string>();
    for (const link of eligibleChildren) {
      if (!link.student?.classId) continue;
      const cls = classesById.get(link.student.classId);
      if (!cls?.teacherId) continue;
      const teacher = schoolTeachersById.get(cls.teacherId);
      if (!teacher) continue;

      const dedupeKey = `${teacher.id}:${link.student.id}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);

      contacts.push({
        teacherUserId: teacher.id,
        teacherName: teacher.name,
        studentId: link.student.id,
        studentName: link.student.name,
        className: cls.name || link.student.class?.name || "Class",
      });
    }
    return contacts;
  }

  // Helper: verify teacher teaches the given student's class
  async function teacherTeachesStudent(teacherUserId: string, studentId: string, schoolId: string): Promise<boolean> {
    const students = await storage.getStudents(schoolId);
    const student = students.find((s) => s.id === studentId);
    if (!student?.classId) return false;
    const classes = await storage.getClasses(schoolId);
    const cls = classes.find((c) => c.id === student.classId && c.teacherId === teacherUserId && c.schoolId === schoolId);
    return !!cls;
  }

  // ── Parent messaging routes ────────────────────────────────
  // GET /api/parent/message-contacts — teachers the parent can message
  app.get("/api/parent/message-contacts", requireRole("parent"), async (req, res) => {
    try {
      const user = await storage.getUserById(req.session.userId!);
      if (!user?.email) return res.status(400).json({ message: "No email linked to your account" });
      const sid = user.schoolId;
      if (!sid) return res.json([]);
      const contacts = await getParentLinkedTeachers(user.email, sid);
      res.json(contacts);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // GET /api/parent/message-threads
  app.get("/api/parent/message-threads", requireRole("parent"), async (req, res) => {
    try {
      const sid = req.session.schoolId;
      if (!sid) return res.json([]);
      const threads = await storage.getMessageThreads({ schoolId: sid, parentUserId: req.session.userId! });
      res.json(threads);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // POST /api/parent/message-threads — start a new conversation
  app.post("/api/parent/message-threads", requireRole("parent"), async (req, res) => {
    try {
      const user = await storage.getUserById(req.session.userId!);
      if (!user?.email) return res.status(400).json({ message: "No email linked to your account" });
      const sid = user.schoolId;
      if (!sid) return res.status(400).json({ message: "No school context" });

      const { teacherUserId, studentId, subject, body } = req.body;
      if (!teacherUserId || !studentId || !subject || !body) {
        return res.status(400).json({ message: "teacherUserId, studentId, subject, and body are required" });
      }
      if (typeof subject !== "string" || subject.trim().length < 2) {
        return res.status(400).json({ message: "Subject must be at least 2 characters" });
      }
      if (typeof body !== "string" || body.trim().length < 1) {
        return res.status(400).json({ message: "Message body cannot be empty" });
      }

      // RBAC: verify parent is linked to this student and teacher teaches the student
      const contacts = await getParentLinkedTeachers(user.email, sid);
      const allowed = contacts.find((c) => c.teacherUserId === teacherUserId && c.studentId === studentId);
      if (!allowed) {
        return res.status(403).json({ message: "You can only message teachers assigned to your linked children" });
      }

      const thread = await storage.createMessageThread({
        schoolId: sid,
        studentId,
        parentUserId: user.id,
        teacherUserId,
        subject: subject.trim(),
        status: "open",
      });

      await storage.createMessage({
        threadId: thread.id,
        schoolId: sid,
        senderUserId: user.id,
        senderRole: "parent",
        body: body.trim(),
      });

      await auditLog(req, "message_thread_created", `thread:${thread.id}`, { studentId, teacherUserId });

      res.status(201).json(thread);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // GET /api/parent/message-threads/:id — conversation detail
  app.get("/api/parent/message-threads/:id", requireRole("parent"), async (req, res) => {
    try {
      const sid = req.session.schoolId;
      if (!sid) return res.status(400).json({ message: "No school context" });
      const thread = await storage.getMessageThread(routeParam(req.params.id), sid);
      if (!thread || thread.parentUserId !== req.session.userId) {
        return res.status(404).json({ message: "Thread not found" });
      }
      const messages = await storage.getMessages(thread.id, sid);
      // Mark messages from teacher as read
      await storage.markMessagesRead(thread.id, req.session.userId!, sid);
      res.json({ thread, messages });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // POST /api/parent/message-threads/:id/messages — reply
  app.post("/api/parent/message-threads/:id/messages", requireRole("parent"), async (req, res) => {
    try {
      const sid = req.session.schoolId;
      if (!sid) return res.status(400).json({ message: "No school context" });
      const thread = await storage.getMessageThread(routeParam(req.params.id), sid);
      if (!thread || thread.parentUserId !== req.session.userId) {
        return res.status(404).json({ message: "Thread not found" });
      }
      if (thread.status !== "open") {
        return res.status(400).json({ message: "This conversation is closed. Please ask the school admin to reopen it." });
      }
      const { body } = req.body;
      if (!body || typeof body !== "string" || body.trim().length < 1) {
        return res.status(400).json({ message: "Message body cannot be empty" });
      }
      const msg = await storage.createMessage({
        threadId: thread.id,
        schoolId: sid,
        senderUserId: req.session.userId!,
        senderRole: "parent",
        body: body.trim(),
      });
      res.status(201).json(msg);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // GET /api/parent/message-unread — unread count for badge
  app.get("/api/parent/message-unread", requireRole("parent"), async (req, res) => {
    const sid = req.session.schoolId;
    if (!sid) return res.json({ count: 0 });
    const count = await storage.getUnreadCount(req.session.userId!, sid);
    res.json({ count });
  });

  // ── Teacher messaging routes ───────────────────────────────
  // GET /api/teacher/message-threads
  app.get("/api/teacher/message-threads", requireRole("teacher"), async (req, res) => {
    try {
      const sid = req.session.schoolId;
      if (!sid) return res.json([]);
      const threads = await storage.getMessageThreads({ schoolId: sid, teacherUserId: req.session.userId! });
      res.json(threads);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // GET /api/teacher/message-threads/:id
  app.get("/api/teacher/message-threads/:id", requireRole("teacher"), async (req, res) => {
    try {
      const sid = req.session.schoolId;
      if (!sid) return res.status(400).json({ message: "No school context" });
      const thread = await storage.getMessageThread(routeParam(req.params.id), sid);
      if (!thread || thread.teacherUserId !== req.session.userId) {
        return res.status(404).json({ message: "Thread not found" });
      }
      const messages = await storage.getMessages(thread.id, sid);
      await storage.markMessagesRead(thread.id, req.session.userId!, sid);
      res.json({ thread, messages });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // POST /api/teacher/message-threads/:id/messages — reply
  app.post("/api/teacher/message-threads/:id/messages", requireRole("teacher"), async (req, res) => {
    try {
      const sid = req.session.schoolId;
      if (!sid) return res.status(400).json({ message: "No school context" });
      const thread = await storage.getMessageThread(routeParam(req.params.id), sid);
      if (!thread || thread.teacherUserId !== req.session.userId) {
        return res.status(404).json({ message: "Thread not found" });
      }
      if (thread.status !== "open") {
        return res.status(400).json({ message: "This conversation is closed." });
      }
      const { body } = req.body;
      if (!body || typeof body !== "string" || body.trim().length < 1) {
        return res.status(400).json({ message: "Message body cannot be empty" });
      }
      const msg = await storage.createMessage({
        threadId: thread.id,
        schoolId: sid,
        senderUserId: req.session.userId!,
        senderRole: "teacher",
        body: body.trim(),
      });
      res.status(201).json(msg);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // GET /api/teacher/message-unread
  app.get("/api/teacher/message-unread", requireRole("teacher"), async (req, res) => {
    const sid = req.session.schoolId;
    if (!sid) return res.json({ count: 0 });
    const count = await storage.getUnreadCount(req.session.userId!, sid);
    res.json({ count });
  });

  // GET /api/notifications/summary — unified cross-platform notifications
}
