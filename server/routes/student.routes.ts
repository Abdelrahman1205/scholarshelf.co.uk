/**
 * server/routes/student.routes.ts
 *
 * Route handlers: student domain.
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

import { sendParentCodeEmail, isResendConfigured } from "../email.js";

export function registerStudentRoutes(app: Express): void {
  app.get("/api/linking-codes", requireRole(...ADMIN_UI_ROLES), async (req, res) => {
    const sid = sessionSchoolId(req);
    const codes = await storage.getLinkingCodes(sid);
    res.json(codes);
  });

  app.post("/api/students/:id/linking-code", requireRole(...ADMIN_UI_ROLES), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      if (sid) {
        const setupState = await getSchoolSetupState(sid);
        if (!setupState) {
          return res.status(404).json({ message: "School not found" });
        }
        if (!setupState.checklist.studentsAdded) {
          return res.status(409).json({ message: "Add students before generating parent linking codes." });
        }
      }

      const { parentEmail } = req.body;
      const code = generateLinkingCode();
      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + 3);

      const student = await storage.getStudentById(routeParam(req.params.id), sid);
      const studentName = student?.name || "your child";

      const linkingCode = await storage.createLinkingCode({
        studentId: routeParam(req.params.id),
        code,
        parentEmail,
        expiresAt,
        schoolId: sid,
      });

      // Send linking code to parent via email
      if (parentEmail) {
        const sent = await sendParentCodeEmail(parentEmail, studentName, code, expiresAt);
        if (!sent) {
          console.log(`[LINKING CODE] Code for ${parentEmail} (student: ${studentName}): ${code}`);
          if (!isResendConfigured()) {
            console.warn("[Resend] RESEND_API_KEY not configured; using log fallback for linking codes.");
          }
        }
      }

      res.status(201).json(linkingCode);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  // Rotate a student's link code — invalidates existing unused codes, generates a fresh one
  // Spec §16.6: link code leaked / rotation
  app.post("/api/students/:id/linking-code/rotate", requireRole(...ADMIN_UI_ROLES), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      const studentId = routeParam(req.params.id);
      const { parentEmail } = req.body;
      if (!parentEmail?.trim()) return res.status(400).json({ message: "parentEmail is required for rotation" });

      const student = await storage.getStudentById(studentId, sid);
      if (!student) return res.status(404).json({ message: "Student not found" });

      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + 3);

      const newCode = await storage.rotateLinkingCode(studentId, parentEmail.trim(), sid ?? null, expiresAt);

      await auditLog(req, "linking_code_rotated", `student:${studentId}`, { parentEmail: parentEmail.trim() });

      // Email the new code to the parent
      if (parentEmail) {
        const sent = await sendParentCodeEmail(parentEmail.trim(), student.name ?? "your child", newCode.code, expiresAt);
        if (!sent) console.log(`[ROTATE CODE] New code for ${parentEmail}: ${newCode.code}`);
      }

      res.status(201).json(newCode);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  // === STUDENT BULK IMPORT ===

  // POST /api/students/import/preview — parse CSV and return rows without committing
  app.post("/api/students/import/preview", requireRole(...ADMIN_UI_ROLES), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      const { csv } = req.body as { csv: string };
      if (!csv?.trim()) return res.status(400).json({ message: "csv field is required" });

      // Parse CSV lines (skip blank lines)
      const lines = csv.split(/\r?\n/).filter((l) => l.trim().length > 0);
      if (lines.length < 2) return res.status(400).json({ message: "CSV must have a header row and at least one data row" });

      const header = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/[^a-z_]/g, ""));
      const nameIdx = header.indexOf("name");
      const classIdx = header.indexOf("class") !== -1 ? header.indexOf("class") : header.indexOf("class_name");
      const emailIdx = header.indexOf("parent_email") !== -1 ? header.indexOf("parent_email") : header.indexOf("parentemail") !== -1 ? header.indexOf("parentemail") : header.indexOf("email");

      if (nameIdx === -1) return res.status(400).json({ message: "CSV must have a 'name' column" });

      // Load classes for name → id resolution
      const classes = await storage.getClasses(sid);
      const classMap = new Map(classes.map((c: any) => [c.name.trim().toLowerCase(), c.id]));

      const rows: { name: string; className: string | null; classId: string | null; parentEmail: string | null; error: string | null; valid: boolean }[] = [];

      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
        const name = cols[nameIdx]?.trim() ?? "";
        if (!name) { rows.push({ name: "", className: null, classId: null, parentEmail: null, error: "Name is required", valid: false }); continue; }

        const className = classIdx !== -1 ? (cols[classIdx]?.trim() ?? null) : null;
        const classId = className ? (classMap.get(className.toLowerCase()) ?? null) : null;
        const classError = className && !classId ? `Class "${className}" not found` : null;

        const parentEmail = emailIdx !== -1 ? (cols[emailIdx]?.trim() || null) : null;

        rows.push({ name, className, classId, parentEmail, error: classError, valid: !classError });
      }

      const valid = rows.filter((r) => !r.error).length;
      const invalid = rows.length - valid;
      const withEmail = rows.filter((r) => r.parentEmail).length;

      res.json({ rows, summary: { total: rows.length, valid, invalid, withEmail } });
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  // POST /api/students/import/confirm — commit parsed rows (valid only)
  app.post("/api/students/import/confirm", requireRole(...ADMIN_UI_ROLES), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      const { rows } = req.body as { rows: { name: string; classId: string | null; parentEmail?: string | null }[] };
      if (!Array.isArray(rows) || rows.length === 0) return res.status(400).json({ message: "rows array is required" });

      const created: any[] = [];
      const errors: { name: string; error: string }[] = [];
      let invitesSent = 0;

      for (const row of rows) {
        if (!row.name?.trim()) { errors.push({ name: row.name ?? "", error: "Name is required" }); continue; }
        try {
          const student = await storage.createStudent({ name: row.name.trim(), classId: row.classId ?? null, schoolId: sid ?? null });
          created.push(student);

          // Auto-send parent invite if email provided
          if (row.parentEmail?.trim()) {
            try {
              const code = generateLinkingCode();
              const expiresAt = new Date();
              expiresAt.setMonth(expiresAt.getMonth() + 3);
              await storage.createLinkingCode({ studentId: student.id, code, parentEmail: row.parentEmail.trim(), expiresAt, schoolId: sid });
              const sent = await sendParentCodeEmail(row.parentEmail.trim(), student.name ?? "your child", code, expiresAt);
              if (sent) invitesSent++;
            } catch (_) {
              // Don't fail the import if invite sending fails
            }
          }
        } catch (e: any) {
          errors.push({ name: row.name, error: e.message });
        }
      }

      await auditLog(req, "students_bulk_imported", `school:${sid}`, { count: created.length, invitesSent });

      res.status(201).json({ created: created.length, invitesSent, errors, students: created });
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  // === PARENT ENDPOINTS ===

  // Preview a link code — returns student info without creating the link
  // Spec §6.3: POST /api/parent/link-code/preview
}
