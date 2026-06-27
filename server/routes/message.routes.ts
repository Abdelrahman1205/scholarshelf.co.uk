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
import { createExternalPayment, verifyWebhookSignature, isExternalIntegrationEnabled } from "../paymentIntegration.js";

export function registerMessageRoutes(app: Express): void {
  app.post("/api/webhooks/payment-update", async (req, res) => {
    try {
      const rawBody = JSON.stringify(req.body);
      const signature = req.headers["x-signature"] as string || "";
      if (!verifyWebhookSignature(rawBody, signature)) {
        return res.status(401).json({ message: "Invalid webhook signature" });
      }

      const { externalPaymentId, eduBookReference, status, confirmedAt, notes } = req.body;
      if (!eduBookReference || !status) {
        return res.status(400).json({ message: "eduBookReference and status are required" });
      }

      const updates: { externalPaymentId?: string; externalPaymentStatus?: string; notes?: string } = {};
      if (externalPaymentId) updates.externalPaymentId = externalPaymentId;
      if (status) updates.externalPaymentStatus = status;
      if (notes) updates.notes = notes;

      const payment = await storage.updatePaymentByReference(eduBookReference, updates);
      if (!payment) {
        return res.status(404).json({ message: "Payment not found for reference: " + eduBookReference });
      }

      // Webhook is trusted (signature verified) — no schoolId filter needed
      if (status === "confirmed" || status === "paid" || status === "completed") {
        await storage.confirmPayment(payment.id, "webhook");
      } else if (status === "rejected" || status === "failed" || status === "cancelled") {
        await storage.rejectPayment(payment.id, "webhook");
      }

      res.json({ message: "Payment updated", paymentId: payment.id });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
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
