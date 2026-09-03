/**
 * server/routes/owner.routes.ts
 *
 * Route handlers: owner domain.
 * Extracted from routes.ts monolith.
 */
import type { Express, Request, Response, NextFunction } from "express";
import { storage, getStorageMode } from "../storage.js";
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

import bcrypt from "bcryptjs";
import nodeCrypto from "crypto";
import {
  sendInviteEmail, sendSchoolSetupInviteEmail, isResendConfigured,
} from "../email.js";
import { buildBrandingResponse } from "../branding.js";

export function registerOwnerRoutes(app: Express): void {
  // ═══ SUPPORT MODE ═════════════════════════════════════════════
  // Enter support mode — owner selects a school to support
  app.post("/api/owner/enter-support/:schoolId", requireRole(...PLATFORM_OWNER_ROLES), async (req, res) => {
    try {
      const schoolId = routeParam(req.params.schoolId);
      const school = await storage.getSchoolById(schoolId);
      if (!school) {
        return res.status(404).json({ message: "School not found" });
      }

      req.session.supportSchoolId = school.id;
      req.session.supportSchoolName = school.name;

      await auditLog(req, "support_mode_enter", `school:${school.id}`, {
        actorRole: req.session.role,
        supportSchoolId: school.id,
        supportSchoolName: school.name,
      });

      res.json({
        message: `Entered support mode for ${school.name}`,
        supportSchoolId: school.id,
        supportSchoolName: school.name,
      });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/owner/support-mode/enter", requireRole(...PLATFORM_OWNER_ROLES), async (req, res) => {
    try {
      const schoolId = String(req.body?.schoolId || "").trim();
      if (!schoolId) {
        return res.status(400).json({ message: "schoolId is required." });
      }

      const school = await storage.getSchoolById(schoolId);
      if (!school) {
        return res.status(404).json({ message: "School not found" });
      }

      req.session.supportSchoolId = school.id;
      req.session.supportSchoolName = school.name;

      await auditLog(req, "support_mode_enter", `school:${school.id}`, {
        actorRole: req.session.role,
        supportSchoolId: school.id,
        supportSchoolName: school.name,
      });

      res.json({
        message: `Entered support mode for ${school.name}`,
        supportSchoolId: school.id,
        supportSchoolName: school.name,
      });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // Exit support mode — return to owner dashboard
  app.post("/api/owner/exit-support", requireRole(...PLATFORM_OWNER_ROLES), async (req, res) => {
    try {
      const previousSchool = req.session.supportSchoolName || "unknown";
      const previousSchoolId = req.session.supportSchoolId || null;

      req.session.supportSchoolId = null;
      req.session.supportSchoolName = null;

      await auditLog(req, "support_mode_exit", previousSchoolId ? `school:${previousSchoolId}` : undefined, {
        actorRole: req.session.role,
        previousSupportSchoolId: previousSchoolId,
        previousSupportSchoolName: previousSchool,
      });

      res.json({ message: "Exited support mode" });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/owner/support-mode/exit", requireRole(...PLATFORM_OWNER_ROLES), async (req, res) => {
    try {
      const previousSchool = req.session.supportSchoolName || "unknown";
      const previousSchoolId = req.session.supportSchoolId || null;

      req.session.supportSchoolId = null;
      req.session.supportSchoolName = null;

      await auditLog(req, "support_mode_exit", previousSchoolId ? `school:${previousSchoolId}` : undefined, {
        actorRole: req.session.role,
        previousSupportSchoolId: previousSchoolId,
        previousSupportSchoolName: previousSchool,
      });

      res.json({ message: "Exited support mode" });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // Get current support mode status
  app.get("/api/owner/support-status", requireRole(...PLATFORM_OWNER_ROLES), async (req, res) => {
    res.json({
      inSupportMode: !!req.session.supportSchoolId,
      supportSchoolId: req.session.supportSchoolId || null,
      supportSchoolName: req.session.supportSchoolName || null,
    });
  });

  // ═══ OWNER SCHOOL MANAGEMENT ════════════════════════════════
  app.get("/api/owner/schools", requireRole(...PLATFORM_OWNER_ROLES), async (req, res) => {
    try {
      const includeDeleted = req.query.includeDeleted === "true";
      const statusFilter = typeof req.query.status === "string" ? req.query.status : undefined;

      const [rawSchools, users, books, classes, students] = await Promise.all([
        storage.getSchools(),
        storage.getUsers(),
        storage.getBooks(),
        storage.getClasses(),
        storage.getStudents(),
      ]);

      // Apply status filters
      let schools = rawSchools;
      if (!includeDeleted && statusFilter !== "deleted") {
        schools = schools.filter(s => s.status !== "deleted" && !s.isDeleted);
      }
      if (statusFilter && statusFilter !== "all") {
        schools = schools.filter(s => s.status === statusFilter);
      }

      const invitesBySchool: Record<string, any[]> = {};
      await Promise.all(
        schools.map(async (school) => {
          invitesBySchool[school.id] = await storage.getInvitesBySchool(school.id);
        }),
      );

      const payload = schools
        .map((school) => {
          const userScope = users.filter((u) => u.schoolId === school.id);
          const schoolInvites = (invitesBySchool[school.id] || []).filter((invite) => resolveRole(invite.role) === "school_admin");
          const latestSchoolAdminInvite = schoolInvites[0] || null;
          return {
            ...school,
            schoolCode: school.code,
            setupStatus: normalizeSchoolSetupStatus(school.setupStatus as string | null | undefined, school.status),
            latestInviteId: latestSchoolAdminInvite?.id || null,
            firstAdminEmail: latestSchoolAdminInvite?.email || null,
            firstAdminName: latestSchoolAdminInvite?.inviteeName || null,
            firstAdminInviteStatus: deriveInviteStatus(latestSchoolAdminInvite),
            counts: {
              admins: userScope.filter((u) => resolveRole(u.role) === "school_admin").length,
              teachers: userScope.filter((u) => resolveRole(u.role) === "teacher").length,
              parents: userScope.filter((u) => resolveRole(u.role) === "parent").length,
              students: students.filter((s) => s.schoolId === school.id).length,
              classes: classes.filter((c) => c.schoolId === school.id).length,
              books: books.filter((b) => b.schoolId === school.id).length,
            },
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name));

      res.json(payload);
    } catch (e: any) {
      res.status(500).json({ message: e.message || "Failed to load schools" });
    }
  });

  app.post("/api/owner/schools", requireRole(...PLATFORM_OWNER_ROLES), async (req, res) => {
    try {
      const name = String(req.body?.name || "").trim();
      const codeRaw = String(req.body?.code || "").trim();

      if (!name || !codeRaw) {
        return res.status(400).json({ message: "School name and code are required." });
      }

      const code = normalizeSchoolCode(codeRaw);
      const existing = await storage.getSchools();
      if (existing.some((s) => normalizeSchoolCode(s.code) === code)) {
        return res.status(409).json({ message: "A school with this code already exists." });
      }

      const school = await storage.createSchool({
        name,
        code,
        status: "pending_setup",
        setupStatus: "pending_admin_invite",
        contactEmail: req.body?.contactEmail || null,
        contactPhone: req.body?.contactPhone || null,
        address: req.body?.address || null,
        notes: req.body?.notes || null,
      });

      await auditLog(req, "school_created", `school:${school.id}`, { code: school.code, name: school.name });
      res.status(201).json(school);
    } catch (e: any) {
      res.status(400).json({ message: e.message || "Failed to create school" });
    }
  });

  app.patch("/api/owner/schools/:id", requireRole(...PLATFORM_OWNER_ROLES), async (req, res) => {
    try {
      const id = routeParam(req.params.id);
      const school = await storage.getSchoolById(id);
      if (!school) return res.status(404).json({ message: "School not found" });

      const updates: Record<string, unknown> = {};
      if (typeof req.body?.name === "string" && req.body.name.trim()) {
        updates.name = req.body.name.trim();
      }
      if (typeof req.body?.code === "string" && req.body.code.trim()) {
        const nextCode = normalizeSchoolCode(req.body.code);
        const rawSchools = await storage.getSchools();
      const showDeleted = req.query.includeDeleted === "true";
      const statusFilter = req.query.status as string | undefined;
      let allSchools = rawSchools;
      if (!showDeleted) {
        allSchools = allSchools.filter(s => s.status !== "deleted" && !s.isDeleted);
      }
      if (statusFilter && statusFilter !== "all") {
        allSchools = allSchools.filter(s => s.status === statusFilter);
      }
        const duplicate = allSchools.some((s) => s.id !== id && normalizeSchoolCode(s.code) === nextCode);
        if (duplicate) {
          return res.status(409).json({ message: "A school with this code already exists." });
        }
        updates.code = nextCode;
      }
      if (typeof req.body?.status === "string") {
        if (!["active", "pending_setup", "suspended"].includes(req.body.status)) {
          return res.status(400).json({ message: "Invalid school status." });
        }
        updates.status = req.body.status;
      }
      if ("contactEmail" in req.body) updates.contactEmail = req.body.contactEmail || null;
      if ("contactPhone" in req.body) updates.contactPhone = req.body.contactPhone || null;
      if ("address" in req.body) updates.address = req.body.address || null;
      if ("notes" in req.body) updates.notes = req.body.notes || null;

      const updated = await storage.updateSchool(id, updates as any);
      if (!updated) return res.status(404).json({ message: "School not found" });

      await auditLog(req, "school_updated", `school:${updated.id}`, {
        previousStatus: school.status,
        nextStatus: updated.status,
      });
      res.json(updated);
    } catch (e: any) {
      res.status(400).json({ message: e.message || "Failed to update school" });
    }
  });

  app.get("/api/owner/schools/:schoolId", requireRole(...PLATFORM_OWNER_ROLES), async (req, res) => {
    try {
      const schoolId = routeParam(req.params.schoolId);
      const school = await storage.getSchoolById(schoolId);
      if (!school) {
        return res.status(404).json({ message: "School not found" });
      }

      const [users, classes, books, students, invites] = await Promise.all([
        storage.getUsers(),
        storage.getClasses(schoolId),
        storage.getBooks(schoolId),
        storage.getStudents(schoolId),
        storage.getInvitesBySchool(schoolId),
      ]);

      const schoolUsers = users.filter((u) => u.schoolId === schoolId);
      const schoolAdminInvites = invites.filter((invite) => resolveRole(invite.role) === "school_admin");
      const latestInvite = schoolAdminInvites[0] || null;
      const firstAdminInviteStatus = deriveInviteStatus(latestInvite);
      const hasActiveSchoolAdmin = schoolUsers.some((u) => resolveRole(u.role) === "school_admin" && u.status === "active");
      const setupStatus = normalizeSchoolSetupStatus(school.setupStatus as string | null | undefined, school.status);

      res.json({
        ...school,
        schoolCode: school.code,
        setupStatus,
        firstAdminEmail: latestInvite?.email || null,
        firstAdminName: latestInvite?.inviteeName || null,
        firstAdminInviteStatus,
        milestones: setupMilestonesFromState({
          schoolStatus: school.status,
          setupStatus,
          firstAdminInviteStatus,
          hasActiveSchoolAdmin,
        }),
        counts: {
          admins: schoolUsers.filter((u) => resolveRole(u.role) === "school_admin").length,
          teachers: schoolUsers.filter((u) => resolveRole(u.role) === "teacher").length,
          parents: schoolUsers.filter((u) => resolveRole(u.role) === "parent").length,
          students: students.length,
          classes: classes.length,
          books: books.length,
        },
      });
    } catch (e: any) {
      res.status(500).json({ message: e.message || "Failed to load school details" });
    }
  });

  // ─── SCHOOL LIFECYCLE: SUSPEND ──────────────────────────────────
  app.post("/api/owner/schools/:id/suspend", requireRole(...PLATFORM_OWNER_ROLES), async (req, res) => {
    try {
      const id = routeParam(req.params.id);
      const school = await storage.getSchoolById(id);
      if (!school) return res.status(404).json({ message: "School not found" });

      if (school.status !== "active") {
        return res.status(409).json({ message: `Cannot suspend a school with status "${school.status}". Only active schools can be suspended.` });
      }

      const reason = String(req.body?.reason || "").trim();
      if (!reason) return res.status(400).json({ message: "A suspension reason is required." });

      const confirmText = String(req.body?.confirmText || "").trim();
      if (confirmText !== "SUSPEND") {
        return res.status(400).json({ message: "Typed confirmation required. Please type SUSPEND to confirm." });
      }

      const updated = await storage.updateSchool(id, {
        status: "suspended",
        suspendedAt: new Date(),
        suspendedBy: req.session.userId!,
        suspensionReason: reason,
      });

      await auditLog(req, "school_suspended", `school:${id}`, {
        schoolId: id, schoolName: school.name, schoolCode: school.code,
        previousStatus: school.status, newStatus: "suspended", reason,
      });

      res.json(updated);
    } catch (e: any) {
      res.status(500).json({ message: e.message || "Failed to suspend school" });
    }
  });

  // ─── SCHOOL LIFECYCLE: ARCHIVE ────────────────────────────────────
  app.post("/api/owner/schools/:id/archive", requireRole(...PLATFORM_OWNER_ROLES), async (req, res) => {
    try {
      const id = routeParam(req.params.id);
      const school = await storage.getSchoolById(id);
      if (!school) return res.status(404).json({ message: "School not found" });

      if (school.status !== "active" && school.status !== "suspended") {
        return res.status(409).json({ message: `Cannot archive a school with status "${school.status}". Only active or suspended schools can be archived.` });
      }

      const reason = String(req.body?.reason || "").trim();
      if (!reason) return res.status(400).json({ message: "An archive reason is required." });

      const confirmText = String(req.body?.confirmText || "").trim();
      if (confirmText !== "ARCHIVE") {
        return res.status(400).json({ message: "Typed confirmation required. Please type ARCHIVE to confirm." });
      }

      const updated = await storage.updateSchool(id, {
        status: "archived",
        archivedAt: new Date(),
        archivedBy: req.session.userId!,
        archiveReason: reason,
      });

      await auditLog(req, "school_archived", `school:${id}`, {
        schoolId: id, schoolName: school.name, schoolCode: school.code,
        previousStatus: school.status, newStatus: "archived", reason,
      });

      res.json(updated);
    } catch (e: any) {
      res.status(500).json({ message: e.message || "Failed to archive school" });
    }
  });

  // ─── SCHOOL LIFECYCLE: RESTORE ────────────────────────────────────
  app.post("/api/owner/schools/:id/restore", requireRole(...PLATFORM_OWNER_ROLES), async (req, res) => {
    try {
      const id = routeParam(req.params.id);
      const school = await storage.getSchoolById(id);
      if (!school) return res.status(404).json({ message: "School not found" });

      if (school.status !== "suspended" && school.status !== "archived" && school.status !== "pending_deletion") {
        return res.status(409).json({ message: `Cannot restore a school with status "${school.status}". Only suspended, archived, or pending-deletion schools can be restored.` });
      }

      const reason = String(req.body?.reason || "").trim();
      if (!reason) return res.status(400).json({ message: "A restore reason is required." });

      const updated = await storage.updateSchool(id, {
        status: "active",
        restoredAt: new Date(),
        restoredBy: req.session.userId!,
        restoreReason: reason,
        // Clear suspension/archive/deletion metadata
        suspendedAt: null,
        suspendedBy: null,
        suspensionReason: null,
        archivedAt: null,
        archivedBy: null,
        archiveReason: null,
        deletionRequestedAt: null,
        deletionRequestedBy: null,
        deletionReason: null,
      });

      await auditLog(req, "school_restored", `school:${id}`, {
        schoolId: id, schoolName: school.name, schoolCode: school.code,
        previousStatus: school.status, newStatus: "active", reason,
      });

      res.json(updated);
    } catch (e: any) {
      res.status(500).json({ message: e.message || "Failed to restore school" });
    }
  });

  // ─── SCHOOL LIFECYCLE: REQUEST DELETION ───────────────────────────
  app.post("/api/owner/schools/:id/request-deletion", requireRole(...PLATFORM_OWNER_ROLES), async (req, res) => {
    try {
      const id = routeParam(req.params.id);
      const school = await storage.getSchoolById(id);
      if (!school) return res.status(404).json({ message: "School not found" });

      if (school.status !== "archived") {
        return res.status(409).json({ message: `Cannot request deletion for a school with status "${school.status}". Only archived schools can be marked for deletion.` });
      }

      const reason = String(req.body?.reason || "").trim();
      if (!reason) return res.status(400).json({ message: "A deletion reason is required." });

      const confirmText = String(req.body?.confirmText || "").trim();
      if (confirmText !== `DELETE ${school.code}`) {
        return res.status(400).json({ message: `Typed confirmation required. Please type DELETE ${school.code} to confirm.` });
      }

      const updated = await storage.updateSchool(id, {
        status: "pending_deletion",
        deletionRequestedAt: new Date(),
        deletionRequestedBy: req.session.userId!,
        deletionReason: reason,
      });

      await auditLog(req, "school_deletion_requested", `school:${id}`, {
        schoolId: id, schoolName: school.name, schoolCode: school.code,
        previousStatus: school.status, newStatus: "pending_deletion", reason,
      });

      res.json(updated);
    } catch (e: any) {
      res.status(500).json({ message: e.message || "Failed to request school deletion" });
    }
  });

  // ─── SCHOOL LIFECYCLE: PERMANENT DELETE (SOFT) ────────────────────
  app.delete("/api/owner/schools/:id", requireRole(...PLATFORM_OWNER_ROLES), async (req, res) => {
    try {
      const id = routeParam(req.params.id);
      const school = await storage.getSchoolById(id);
      if (!school) return res.status(404).json({ message: "School not found" });

      if (school.status !== "pending_deletion" && school.status !== "archived") {
        return res.status(409).json({
          message: `Cannot permanently delete a school with status "${school.status}". School must be archived or pending deletion first.`,
        });
      }

      const reason = String(req.body?.reason || "").trim();
      if (!reason) return res.status(400).json({ message: "A deletion reason is required." });

      const confirmText = String(req.body?.confirmText || "").trim();
      if (confirmText !== `DELETE ${school.code}`) {
        return res.status(400).json({ message: `Typed confirmation required. Please type DELETE ${school.code} to confirm.` });
      }

      // Check for blockers
      const blockers: string[] = [];
      const schoolUsers = await storage.getUsers();
      const schoolUserIds = schoolUsers.filter(u => u.schoolId === id).map(u => u.id);

      if (schoolUserIds.length > 0) {
        // Check active orders (payments with non-terminal status)
        const payments = await storage.getPayments(id);
        const activePayments = payments.filter(p =>
          !["confirmed", "completed", "rejected", "failed", "cancelled", "collected"].includes(p.status)
        );
        if (activePayments.length > 0) {
          blockers.push(`${activePayments.length} active payment order(s) exist. Resolve or cancel them first.`);
        }

        // Check pending payment references
        const pendingRefs = payments.filter(p => p.status === "reference_submitted");
        if (pendingRefs.length > 0) {
          blockers.push(`${pendingRefs.length} pending payment reference(s) awaiting review.`);
        }

        // Check active distribution records
        try {
          const allocations = await storage.getAllocations(id);
          const activeDistributions = allocations.filter(a =>
            a.distributionStatus === "pending_distribution"
          );
          if (activeDistributions.length > 0) {
            blockers.push(`${activeDistributions.length} pending book distribution(s). Complete or cancel them first.`);
          }
        } catch {}
      }

      // Check active invites
      try {
        const invites = await storage.getInvitesBySchool(id);
        const pendingInvites = invites.filter((i: any) => i.status === "pending");
        if (pendingInvites.length > 0) {
          blockers.push(`${pendingInvites.length} pending invite(s). Revoke them first or let them expire.`);
        }
      } catch {}

      if (blockers.length > 0) {
        return res.status(409).json({
          message: "Cannot delete school — active records exist. Consider archiving instead.",
          blockers,
        });
      }

      // Soft delete
      const updated = await storage.updateSchool(id, {
        status: "deleted",
        isDeleted: true,
        deletedAt: new Date(),
        deletedBy: req.session.userId!,
        deleteReason: reason,
      });

      await auditLog(req, "school_deleted", `school:${id}`, {
        schoolId: id, schoolName: school.name, schoolCode: school.code,
        previousStatus: school.status, newStatus: "deleted", reason,
      });

      res.json({ message: "School has been permanently deleted (soft).", school: updated });
    } catch (e: any) {
      res.status(500).json({ message: e.message || "Failed to delete school" });
    }
  });

  app.post("/api/owner/schools/:schoolId/invite-admin", requireRole(...PLATFORM_OWNER_ROLES), async (req, res) => {
    try {
      const schoolId = routeParam(req.params.schoolId);
      const school = await storage.getSchoolById(schoolId);
      if (!school) {
        return res.status(404).json({ message: "School not found" });
      }

      const adminName = String(req.body?.adminName || req.body?.name || "").trim();
      const adminEmail = String(req.body?.adminEmail || req.body?.email || "").trim();
      if (!adminName || !adminEmail) {
        return res.status(400).json({ message: "First School Admin name and email are required." });
      }

      const existingUser = await storage.getUserByEmail(adminEmail);
      if (existingUser && existingUser.status === "active") {
        return res.status(409).json({ message: "A user with this email already exists." });
      }

      const updatedSchool = await storage.updateSchool(school.id, {
        status: "pending_setup",
        setupStatus: "pending_admin_acceptance",
      } as any);

      if (!updatedSchool) {
        return res.status(404).json({ message: "School not found" });
      }

      const rawToken = nodeCrypto.randomBytes(32).toString("hex");
      const tokenHash = await bcrypt.hash(rawToken, 10);

      const invite = await storage.createInvite({
        email: adminEmail,
        inviteeName: adminName,
        role: "school_admin",
        schoolId: school.id,
        tokenHash,
        invitedBy: req.session.userId || null,
        status: "pending",
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      const inviteLink = `${getPublicBaseUrl(req)}/accept-invite/${invite.id}.${rawToken}`;
      const emailSent = await sendSchoolSetupInviteEmail(
        adminEmail,
        adminName,
        school.name,
        inviteLink,
        await getEmailBrandingForSchool(req, school.id),
      );

      if (!emailSent) {
        // Never log the invite link — it accepts into a school-admin account.
        console.error(`[SCHOOL SETUP INVITE] delivery failed for school ${school.id}. Resend the invite from the owner console.`);
        if (!isResendConfigured()) {
          console.warn("[Resend] RESEND_API_KEY/RESEND_FROM_EMAIL not configured; invite email cannot be delivered.");
        }
      }

      await auditLog(req, "school_setup_invite_sent", `school:${school.id}`, {
        adminEmail,
        adminName,
        inviteId: invite.id,
        emailSent,
      });

      res.status(201).json({
        inviteId: invite.id,
        inviteLink,
        emailSent,
        manualInviteLinkAllowed: !emailSent || process.env.NODE_ENV !== "production",
        school: {
          id: updatedSchool.id,
          name: updatedSchool.name,
          code: updatedSchool.code,
          status: updatedSchool.status,
          setupStatus: normalizeSchoolSetupStatus(updatedSchool.setupStatus as string | null | undefined, updatedSchool.status),
        },
      });
    } catch (e: any) {
      res.status(400).json({ message: e.message || "Failed to send school admin invite" });
    }
  });

  app.post("/api/owner/invites/:inviteId/resend", requireRole(...PLATFORM_OWNER_ROLES), async (req, res) => {
    try {
      const inviteId = routeParam(req.params.inviteId);
      const invite = await storage.getInviteById(inviteId);
      if (!invite || !invite.schoolId || resolveRole(invite.role) !== "school_admin") {
        return res.status(404).json({ message: "Invite not found" });
      }

      const school = await storage.getSchoolById(invite.schoolId);
      if (!school) {
        return res.status(404).json({ message: "School not found" });
      }

      if (invite.status === "accepted") {
        return res.status(400).json({ message: "Accepted invites cannot be resent." });
      }

      if (invite.status === "pending") {
        await storage.revokeInvite(invite.id);
      }

      const rawToken = nodeCrypto.randomBytes(32).toString("hex");
      const tokenHash = await bcrypt.hash(rawToken, 10);

      const replacement = await storage.createInvite({
        email: invite.email,
        inviteeName: invite.inviteeName || "School Admin",
        role: "school_admin",
        schoolId: school.id,
        tokenHash,
        invitedBy: req.session.userId || null,
        status: "pending",
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      await storage.updateSchool(school.id, {
        status: "pending_setup",
        setupStatus: "pending_admin_acceptance",
      } as any);

      const inviteLink = `${getPublicBaseUrl(req)}/accept-invite/${replacement.id}.${rawToken}`;
      const emailSent = await sendSchoolSetupInviteEmail(
        invite.email,
        invite.inviteeName || "School Admin",
        school.name,
        inviteLink,
        await getEmailBrandingForSchool(req, school.id),
      );

      await auditLog(req, "school_setup_invite_resent", `school:${school.id}`, {
        originalInviteId: invite.id,
        newInviteId: replacement.id,
        adminEmail: invite.email,
        emailSent,
      });

      res.json({
        inviteId: replacement.id,
        inviteLink,
        emailSent,
        manualInviteLinkAllowed: !emailSent || process.env.NODE_ENV !== "production",
      });
    } catch (e: any) {
      res.status(400).json({ message: e.message || "Failed to resend invite" });
    }
  });

  app.post("/api/owner/invites/:inviteId/revoke", requireRole(...PLATFORM_OWNER_ROLES), async (req, res) => {
    try {
      const inviteId = routeParam(req.params.inviteId);
      const invite = await storage.getInviteById(inviteId);
      if (!invite || !invite.schoolId || resolveRole(invite.role) !== "school_admin") {
        return res.status(404).json({ message: "Invite not found" });
      }

      if (invite.status === "accepted") {
        return res.status(400).json({ message: "Accepted invites cannot be revoked." });
      }

      await storage.revokeInvite(inviteId);
      await storage.updateSchool(invite.schoolId, {
        status: "pending_setup",
        setupStatus: "pending_admin_invite",
      } as any);

      await auditLog(req, "school_setup_invite_revoked", `school:${invite.schoolId}`, {
        inviteId,
        adminEmail: invite.email,
      });

      res.json({ message: "Invite revoked" });
    } catch (e: any) {
      res.status(400).json({ message: e.message || "Failed to revoke invite" });
    }
  });

  app.get("/api/owner/pending-setups", requireRole(...PLATFORM_OWNER_ROLES), async (_req, res) => {
    try {
      const [schools, users] = await Promise.all([
        storage.getSchools(),
        storage.getUsers(),
      ]);

      const invitesBySchool: Record<string, any[]> = {};
      await Promise.all(
        schools.map(async (school) => {
          invitesBySchool[school.id] = await storage.getInvitesBySchool(school.id);
        }),
      );

      const rows = schools.map((school) => {
        const schoolInvites = (invitesBySchool[school.id] || []).filter((invite) => resolveRole(invite.role) === "school_admin");
        const latestInvite = schoolInvites[0] || null;
        const firstAdminInviteStatus = deriveInviteStatus(latestInvite);
        const hasActiveSchoolAdmin = users.some((u) => u.schoolId === school.id && resolveRole(u.role) === "school_admin" && u.status === "active");
        const setupStatus = normalizeSchoolSetupStatus(school.setupStatus as string | null | undefined, school.status);

        return {
          schoolId: school.id,
          schoolName: school.name,
          schoolCode: school.code,
          schoolStatus: school.status,
          setupStatus,
          firstAdminEmail: latestInvite?.email || null,
          firstAdminInviteStatus,
          updatedAt: school.updatedAt,
          category:
            // Treat an existing active school admin as equivalent to "accepted"
            (firstAdminInviteStatus === "not_invited" && !hasActiveSchoolAdmin)
              ? "school_created_no_admin_invite"
              : (firstAdminInviteStatus !== "accepted" && !hasActiveSchoolAdmin)
                ? "admin_invited_not_accepted"
                : !COMPLETE_SETUP_STATUSES.has(setupStatus)
                  ? "admin_accepted_setup_not_complete"
                  : school.status !== "active"
                    ? "setup_complete_not_active"
                    : "complete",
          recommendedNextAction: nextOwnerAction(setupStatus, firstAdminInviteStatus, school.status || "pending_setup"),
          milestones: setupMilestonesFromState({
            schoolStatus: school.status,
            setupStatus,
            firstAdminInviteStatus,
            hasActiveSchoolAdmin,
          }),
        };
      });

      const pending = rows.filter((row) => row.category !== "complete");
      res.json({
        totalPending: pending.length,
        groups: {
          schoolCreatedNoAdminInvite: pending.filter((r) => r.category === "school_created_no_admin_invite"),
          adminInvitedNotAccepted: pending.filter((r) => r.category === "admin_invited_not_accepted"),
          adminAcceptedSetupNotComplete: pending.filter((r) => r.category === "admin_accepted_setup_not_complete"),
          setupCompleteNotActive: pending.filter((r) => r.category === "setup_complete_not_active"),
        },
        items: pending,
      });
    } catch (e: any) {
      res.status(500).json({ message: e.message || "Failed to load pending setups" });
    }
  });

  app.get("/api/owner/email-status", requireRole(...PLATFORM_OWNER_ROLES), async (_req, res) => {
    try {
      const emailConfigured = isResendConfigured();
      const schools = await storage.getSchools();

      const recentInvites: Array<{
        schoolId: string;
        schoolName: string;
        inviteId: string;
        email: string;
        status: string;
        createdAt: Date;
      }> = [];

      for (const school of schools) {
        const invites = await storage.getInvitesBySchool(school.id);
        for (const invite of invites.filter((i) => resolveRole(i.role) === "school_admin").slice(0, 2)) {
          recentInvites.push({
            schoolId: school.id,
            schoolName: school.name,
            inviteId: invite.id,
            email: invite.email,
            status: deriveInviteStatus(invite),
            createdAt: invite.createdAt || new Date(0),
          });
        }
      }

      recentInvites.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      res.json({
        emailConfigured,
        message: emailConfigured
          ? "Email sending is configured."
          : "Email sending is not configured. Copy this setup link and send it manually.",
        manualInviteLinkAllowed: !emailConfigured || process.env.NODE_ENV !== "production",
        recentInvites: recentInvites.slice(0, 20),
      });
    } catch (e: any) {
      res.status(500).json({ message: e.message || "Failed to load email status" });
    }
  });

  // ═══ SYSTEM HEALTH ════════════════════════════════════════════
  // Real infrastructure telemetry for the platform owner.
  app.get("/api/owner/system-health", requireRole(...PLATFORM_OWNER_ROLES), async (_req, res) => {
    const startedAt = Date.now();

    // Database round-trip (real query) → latency + connectivity
    let dbOk = false;
    let dbLatencyMs: number | null = null;
    let schoolsCount = 0;
    try {
      const t = Date.now();
      const schools = await storage.getSchools();
      dbLatencyMs = Date.now() - t;
      schoolsCount = schools.length;
      dbOk = true;
    } catch {
      dbOk = false;
    }

    const storageMode = getStorageMode();
    const emailConfigured = isResendConfigured();
    const mem = process.memoryUsage();

    const overallStatus = !dbOk
      ? "down"
      : emailConfigured
      ? "operational"
      : "degraded";

    res.json({
      generatedAt: new Date().toISOString(),
      overallStatus,
      database: {
        label: "PostgreSQL Cluster (Neon)",
        status: dbOk ? "healthy" : "down",
        storageMode,
        latencyMs: dbLatencyMs,
        schools: schoolsCount,
      },
      email: {
        label: "Resend Infrastructure",
        provider: "Resend",
        status: emailConfigured ? "operational" : "not_configured",
      },
      rateLimiter: {
        label: "Rate Limiter",
        store: storageMode === "database" ? "postgres" : "memory",
        status: storageMode === "database" ? "distributed" : "in_memory",
      },
      runtime: {
        node: process.version,
        platform: `${process.platform}/${process.arch}`,
        env: process.env.NODE_ENV || "development",
        uptimeSeconds: Math.round(process.uptime()),
        rssMb: Math.round(mem.rss / 1024 / 1024),
        heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
        heapTotalMb: Math.round(mem.heapTotal / 1024 / 1024),
      },
      responseTimeMs: Date.now() - startedAt,
    });
  });

  app.get("/api/owner/activity", requireRole(...PLATFORM_OWNER_ROLES), async (_req, res) => {
    try {
      const [logs, schools, allUsers] = await Promise.all([
        storage.getAuditLogs(200),
        storage.getSchools(),
        storage.getUsers(),
      ]);
      const schoolById = new Map<string, { name: string; code: string }>(
        schools.map((school) => [school.id, { name: school.name, code: school.code }]),
      );
      const userById = new Map<string, { username: string; email: string }>(
        allUsers.map((u) => [u.id, { username: u.username, email: u.email ?? "" }]),
      );
      const ownerActions = new Set([
        "school_created",
        "school_updated",
        "school_deleted",
        "school_setup_invite_sent",
        "school_setup_invite_resent",
        "school_setup_invite_revoked",
        "invite_accepted",
        "school_setup_completed",
        "support_mode_enter",
        "support_mode_exit",
      ]);

      const items = logs
        .filter((log) => ownerActions.has(log.action))
        .slice(0, 100)
        .map((log) => {
          const target = log.target || null;
          let targetLabel = target || "Platform";
          if (target && target.startsWith("school:")) {
            const school = schoolById.get(target.slice("school:".length));
            if (school) {
              targetLabel = `${school.name} (${school.code})`;
            }
          }

          const actor = log.userId ? userById.get(log.userId) : null;
          return {
            id: log.id,
            action: log.action,
            target,
            targetLabel,
            actorUserId: log.userId,
            actorName: actor?.username || actor?.email || log.userId || null,
            timestamp: log.createdAt,
            metadata: log.metadata ? JSON.parse(log.metadata) : null,
          };
        });

      res.json({ items });
    } catch (e: any) {
      res.status(500).json({ message: e.message || "Failed to load activity" });
    }
  });
}
