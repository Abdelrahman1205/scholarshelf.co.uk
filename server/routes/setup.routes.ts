/**
 * server/routes/setup.routes.ts
 *
 * Route handlers: setup domain.
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
  buildBrandingResponse, getBrandingFieldColumns,
  normalizeFontPreference, normalizeHexColour, normalizeThemeName,
  storeBrandingImage, type BrandingUploadField,
} from "../branding.js";

export function registerSetupRoutes(app: Express): void {
  // === BOOKS (school-scoped) ===
  app.get("/api/books", requireRole(...ADMIN_UI_ROLES, "teacher"), async (req, res) => {
    const sid = sessionSchoolId(req);
    const books = await storage.getBooks(sid);
    res.json(books);
  });

  app.get("/api/admin/setup-status", requireRole(...ADMIN_UI_ROLES), async (req, res) => {
    try {
      const schoolId = sessionSchoolId(req);
      if (!schoolId) {
        return res.status(400).json({ message: "No school is currently selected." });
      }

      const [setupState, invites] = await Promise.all([
        getSchoolSetupState(schoolId),
        storage.getInvitesBySchool(schoolId),
      ]);

      if (!setupState) {
        return res.status(404).json({ message: "School not found" });
      }

      const school = setupState.school;
      const activeSchoolAdmins = setupState.activeSchoolAdmins;
      const schoolAdminInvites = invites.filter((invite) => resolveRole(invite.role) === "school_admin");
      const latestInvite = schoolAdminInvites[0] || null;
      const firstAdminInviteStatus = deriveInviteStatus(latestInvite);
      const firstAdminAccepted = schoolAdminInvites.some((invite) => deriveInviteStatus(invite) === "accepted") || activeSchoolAdmins.length > 0;
      const setupStatus = setupState.setupStatus;
      const schoolActive = school.status === "active";
      const operationalSetupCompleted = setupState.operationalSetupComplete;
      const checklist = setupState.checklist;
      const setupProgressTotal = Object.keys(checklist).length;
      const setupProgressDone = Object.values(checklist).filter(Boolean).length;
      const setupPercent = Math.round((setupProgressDone / Math.max(setupProgressTotal, 1)) * 100);

      res.json({
        school: {
          id: school.id,
          name: school.name,
          code: school.code,
          schoolCode: school.code,
          status: school.status,
          setupStatus,
          contactEmail: school.contactEmail,
          contactPhone: school.contactPhone,
          address: school.address,
          notes: school.notes,
          paymentAppName: school.paymentAppName ?? null,
        },
        invite: latestInvite
          ? {
              id: latestInvite.id,
              email: latestInvite.email,
              inviteeName: latestInvite.inviteeName || null,
              status: firstAdminInviteStatus,
              expiresAt: latestInvite.expiresAt,
            }
          : null,
        schoolCreated: true,
        firstAdminInvited: schoolAdminInvites.length > 0,
        firstAdminAccepted,
        operationalSetupCompleted,
        schoolActive,
        readyForOperationalCompletion: setupState.readyForOperationalCompletion,
        setupStatus,
        schoolStatus: school.status,
        firstAdminEmail: latestInvite?.email || activeSchoolAdmins[0]?.email || null,
        firstAdminInviteStatus,
        checklist,
        missingSteps: setupState.missingSteps,
        missingStepKeys: setupState.missingStepKeys,
        completionRules: setupState.completionRules,
        setupProgress: {
          done: setupProgressDone,
          total: setupProgressTotal,
          percent: setupPercent,
        },
        counts: setupState.counts,
        progress: {
          schoolCreated: true,
          firstAdminInvited: schoolAdminInvites.length > 0,
          firstAdminAccepted,
          operationalSetupComplete: operationalSetupCompleted,
        },
        nextStep:
          schoolAdminInvites.length === 0
            ? "Invite the first School Admin to start onboarding."
            : !firstAdminAccepted
              ? "Waiting for the first School Admin to accept the invite."
              : !setupState.readyForOperationalCompletion
                ? `Complete the remaining setup steps. Next: ${setupState.nextRecommendedAction}`
                : !operationalSetupCompleted
                  ? "All prerequisites are complete. Mark setup complete to activate school operations."
                : "Setup complete. You can proceed to the dashboard.",
      });
    } catch (e: any) {
      res.status(500).json({ message: e.message || "Failed to load setup status" });
    }
  });

  async function handleBrandingUpload(req: Request, res: Response, schoolId: string, field: BrandingUploadField, auditAction: string, requiredPermission: string) {
    if (!(await canManageBrandingOperation(req, schoolId, requiredPermission))) {
      return res.status(403).json({ message: "Access denied" });
    }

    await runSingleBrandingUpload(req, res);
    if (!req.file) {
      return res.status(400).json({ message: "File upload is required" });
    }

    const existing = await storage.getSchoolBranding(schoolId);
    const columns = getBrandingFieldColumns(field);
    const previousFileId = (existing?.[columns.fileId] as string | null | undefined) || null;
    const uploaded = await storeBrandingImage(schoolId, field, req.file, previousFileId);

    const updatedBranding = await storage.upsertSchoolBranding(
      schoolId,
      {
        [columns.url]: uploaded.url,
        [columns.fileId]: uploaded.fileId,
        setupStatus: "completed",
      } as any,
      req.session.userId,
    );

    await auditLog(req, auditAction, `school:${schoolId}`, {
      schoolId,
      actorUserId: req.session.userId,
      actorRole: getActiveRequestContext(req),
      previousValue: existing ? { [columns.url]: existing[columns.url], [columns.fileId]: existing[columns.fileId] } : null,
      newValue: { [columns.url]: uploaded.url, [columns.fileId]: uploaded.fileId },
      reason: isPlatformOwnerRole(req.session.role) ? extractSupportReason(req) : null,
    });

    return res.json({
      field,
      url: uploaded.url,
      fileId: uploaded.fileId,
      branding: buildBrandingResponse(updatedBranding),
    });
  }

  app.get("/api/school/branding", requireAuth, async (req, res) => {
    try {
      const schoolId = sessionSchoolId(req);
      if (!schoolId) return res.status(400).json({ message: "No school context available" });
      if (!(await canViewBranding(req, schoolId))) {
        return res.status(403).json({ message: "Access denied" });
      }

      const resolved = await resolveTenantBranding(schoolId);
      if (!resolved) return res.status(404).json({ message: "School not found" });
      res.json({ schoolId, ...resolved.brandingResponse });
    } catch (e: any) {
      res.status(500).json({ message: e.message || "Failed to load branding" });
    }
  });

  app.patch("/api/school/branding", requireAuth, async (req, res) => {
    try {
      const schoolId = sessionSchoolId(req);
      if (!schoolId) return res.status(400).json({ message: "No school context available" });
      if (!(await canManageBrandingOperation(req, schoolId, BRANDING_UPDATE_THEME_PERMISSION))) {
        return res.status(403).json({ message: "Access denied" });
      }

      const existing = await storage.getSchoolBranding(schoolId);
      const payload = {
        primaryColour: normalizeHexColour(req.body?.primaryColour, existing?.primaryColour || "#2563EB"),
        secondaryColour: normalizeHexColour(req.body?.secondaryColour, existing?.secondaryColour || "#1E3A8A"),
        accentColour: normalizeHexColour(req.body?.accentColour, existing?.accentColour || "#0EA5E9"),
        themeName: normalizeThemeName(req.body?.themeName),
        fontPreference: normalizeFontPreference(req.body?.fontPreference),
        setupStatus: "completed",
      };

      const updated = await storage.upsertSchoolBranding(schoolId, payload, req.session.userId);
      await auditLog(req, "BRANDING_UPDATED", `school:${schoolId}`, {
        schoolId,
        actorUserId: req.session.userId,
        actorRole: getActiveRequestContext(req),
        previousValue: existing
          ? {
              primaryColour: existing.primaryColour,
              secondaryColour: existing.secondaryColour,
              accentColour: existing.accentColour,
              themeName: existing.themeName,
              fontPreference: existing.fontPreference,
            }
          : null,
        newValue: payload,
      });

      await auditLog(req, "BRANDING_THEME_CHANGED", `school:${schoolId}`, {
        schoolId,
        actorUserId: req.session.userId,
        actorRole: getActiveRequestContext(req),
        newValue: {
          primaryColour: payload.primaryColour,
          secondaryColour: payload.secondaryColour,
          accentColour: payload.accentColour,
          themeName: payload.themeName,
          fontPreference: payload.fontPreference,
        },
      });

      res.json({ schoolId, ...buildBrandingResponse(updated) });
    } catch (e: any) {
      res.status(400).json({ message: e.message || "Failed to update branding" });
    }
  });

  app.post("/api/school/branding/logo", requireAuth, async (req, res) => {
    try {
      const schoolId = sessionSchoolId(req);
      if (!schoolId) return res.status(400).json({ message: "No school context available" });
      return await handleBrandingUpload(req, res, schoolId, "logo", "BRANDING_LOGO_UPLOADED", BRANDING_UPLOAD_LOGO_PERMISSION);
    } catch (e: any) {
      res.status(400).json({ message: e.message || "Logo upload failed" });
    }
  });

  app.post("/api/school/branding/banner", requireAuth, async (req, res) => {
    try {
      const schoolId = sessionSchoolId(req);
      if (!schoolId) return res.status(400).json({ message: "No school context available" });
      return await handleBrandingUpload(req, res, schoolId, "banner", "BRANDING_BANNER_UPLOADED", BRANDING_MANAGE_PERMISSION);
    } catch (e: any) {
      res.status(400).json({ message: e.message || "Banner upload failed" });
    }
  });

  app.post("/api/school/branding/favicon", requireAuth, async (req, res) => {
    try {
      const schoolId = sessionSchoolId(req);
      if (!schoolId) return res.status(400).json({ message: "No school context available" });
      return await handleBrandingUpload(req, res, schoolId, "favicon", "BRANDING_FAVICON_UPLOADED", BRANDING_MANAGE_PERMISSION);
    } catch (e: any) {
      res.status(400).json({ message: e.message || "Favicon upload failed" });
    }
  });

  app.post("/api/school/branding/email-logo", requireAuth, async (req, res) => {
    try {
      const schoolId = sessionSchoolId(req);
      if (!schoolId) return res.status(400).json({ message: "No school context available" });
      return await handleBrandingUpload(req, res, schoolId, "emailLogo", "BRANDING_EMAIL_LOGO_UPDATED", BRANDING_MANAGE_PERMISSION);
    } catch (e: any) {
      res.status(400).json({ message: e.message || "Email logo upload failed" });
    }
  });

  app.post("/api/school/branding/pdf-logo", requireAuth, async (req, res) => {
    try {
      const schoolId = sessionSchoolId(req);
      if (!schoolId) return res.status(400).json({ message: "No school context available" });
      return await handleBrandingUpload(req, res, schoolId, "pdfLogo", "BRANDING_PDF_LOGO_UPDATED", BRANDING_MANAGE_PERMISSION);
    } catch (e: any) {
      res.status(400).json({ message: e.message || "PDF logo upload failed" });
    }
  });

  app.post("/api/school/branding/reset", requireAuth, async (req, res) => {
    try {
      const schoolId = sessionSchoolId(req);
      if (!schoolId) return res.status(400).json({ message: "No school context available" });
      if (!(await canManageBrandingOperation(req, schoolId, BRANDING_RESET_DEFAULT_PERMISSION))) {
        return res.status(403).json({ message: "Access denied" });
      }
      const previous = await storage.getSchoolBranding(schoolId);
      const updated = await storage.resetSchoolBranding(schoolId, req.session.userId);
      await auditLog(req, "BRANDING_RESET_TO_DEFAULT", `school:${schoolId}`, {
        schoolId,
        actorUserId: req.session.userId,
        actorRole: getActiveRequestContext(req),
        previousValue: previous || null,
      });
      res.json({ schoolId, ...buildBrandingResponse(updated) });
    } catch (e: any) {
      res.status(400).json({ message: e.message || "Failed to reset branding" });
    }
  });

  app.post("/api/admin/setup/branding-skip", requireRole(...ADMIN_UI_ROLES), async (req, res) => {
    try {
      const schoolId = sessionSchoolId(req);
      if (!schoolId) return res.status(400).json({ message: "No school context available" });
      const updated = await storage.upsertSchoolBranding(schoolId, { setupStatus: "skipped" }, req.session.userId);
      await auditLog(req, "BRANDING_UPDATED", `school:${schoolId}`, {
        schoolId,
        actorUserId: req.session.userId,
        actorRole: getActiveRequestContext(req),
        newValue: { setupStatus: "skipped" },
      });
      res.json({ schoolId, ...buildBrandingResponse(updated) });
    } catch (e: any) {
      res.status(400).json({ message: e.message || "Failed to skip branding setup" });
    }
  });

  app.get("/api/owner/schools/:schoolId/branding", requireRole(...PLATFORM_OWNER_ROLES), async (req, res) => {
    try {
      const schoolId = routeParam(req.params.schoolId);
      const school = await storage.getSchoolById(schoolId);
      if (!school) return res.status(404).json({ message: "School not found" });

      const reason = extractSupportReason(req);
      if (isInSupportMode(req) && !reason) {
        return res.status(400).json({ message: "Support mode reason is required for owner branding access" });
      }

      const branding = await storage.getSchoolBranding(schoolId);
      await auditLog(req, "BRANDING_VIEWED_BY_OWNER", `school:${schoolId}`, {
        schoolId,
        actorUserId: req.session.userId,
        actorRole: req.session.role,
        reason: reason || null,
      });
      res.json({ schoolId, ...buildBrandingResponse(branding, school.name) });
    } catch (e: any) {
      res.status(500).json({ message: e.message || "Failed to load school branding" });
    }
  });

  app.patch("/api/owner/schools/:schoolId/branding", requireRole(...PLATFORM_OWNER_ROLES), async (req, res) => {
    try {
      const schoolId = routeParam(req.params.schoolId);
      const school = await storage.getSchoolById(schoolId);
      if (!school) return res.status(404).json({ message: "School not found" });

      const reason = extractSupportReason(req);
      if (isInSupportMode(req) && !reason) {
        return res.status(400).json({ message: "Support mode reason is required for owner branding updates" });
      }

      const existing = await storage.getSchoolBranding(schoolId);
      const payload = {
        primaryColour: normalizeHexColour(req.body?.primaryColour, existing?.primaryColour || "#2563EB"),
        secondaryColour: normalizeHexColour(req.body?.secondaryColour, existing?.secondaryColour || "#1E3A8A"),
        accentColour: normalizeHexColour(req.body?.accentColour, existing?.accentColour || "#0EA5E9"),
        themeName: normalizeThemeName(req.body?.themeName),
        fontPreference: normalizeFontPreference(req.body?.fontPreference),
        setupStatus: "completed",
      };
      const updated = await storage.upsertSchoolBranding(schoolId, payload, req.session.userId);
      await auditLog(req, "BRANDING_UPDATED", `school:${schoolId}`, {
        schoolId,
        actorUserId: req.session.userId,
        actorRole: req.session.role,
        reason: reason || null,
        previousValue: existing || null,
        newValue: payload,
      });
      res.json({ schoolId, ...buildBrandingResponse(updated, school.name) });
    } catch (e: any) {
      res.status(400).json({ message: e.message || "Failed to update school branding" });
    }
  });

  app.post("/api/owner/schools/:schoolId/branding/logo", requireRole(...PLATFORM_OWNER_ROLES), async (req, res) => {
    try {
      const schoolId = routeParam(req.params.schoolId);
      const school = await storage.getSchoolById(schoolId);
      if (!school) return res.status(404).json({ message: "School not found" });

      const reason = extractSupportReason(req);
      if (isInSupportMode(req) && !reason) {
        return res.status(400).json({ message: "Support mode reason is required for owner logo upload" });
      }

      return await handleBrandingUpload(req, res, schoolId, "logo", "BRANDING_LOGO_UPLOADED", BRANDING_MANAGE_PERMISSION);
    } catch (e: any) {
      res.status(400).json({ message: e.message || "Failed to upload school logo" });
    }
  });

  app.post("/api/owner/schools/:schoolId/branding/reset", requireRole(...PLATFORM_OWNER_ROLES), async (req, res) => {
    try {
      const schoolId = routeParam(req.params.schoolId);
      const school = await storage.getSchoolById(schoolId);
      if (!school) return res.status(404).json({ message: "School not found" });

      const reason = extractSupportReason(req);
      if (isInSupportMode(req) && !reason) {
        return res.status(400).json({ message: "Support mode reason is required for owner branding reset" });
      }

      const previous = await storage.getSchoolBranding(schoolId);
      const updated = await storage.resetSchoolBranding(schoolId, req.session.userId);
      await auditLog(req, "BRANDING_RESET_TO_DEFAULT", `school:${schoolId}`, {
        schoolId,
        actorUserId: req.session.userId,
        actorRole: req.session.role,
        reason: reason || null,
        previousValue: previous || null,
      });
      res.json({ schoolId, ...buildBrandingResponse(updated, school.name) });
    } catch (e: any) {
      res.status(400).json({ message: e.message || "Failed to reset school branding" });
    }
  });

  app.get("/api/public/schools/:code/branding", async (req, res) => {
    try {
      const code = normalizeSchoolCode(routeParam(req.params.code));
      const schools = await storage.getSchools();
      const school = schools.find((item) => normalizeSchoolCode(item.code) === code);
      if (!school) return res.status(404).json({ message: "School not found" });
      const branding = await storage.getSchoolBranding(school.id);
      res.json({ schoolId: school.id, schoolCode: school.code, ...buildBrandingResponse(branding, school.name) });
    } catch (e: any) {
      res.status(500).json({ message: e.message || "Failed to load public branding" });
    }
  });

  app.get("/api/public/schools/:code/email-logo", async (req, res) => {
    try {
      const code = normalizeSchoolCode(routeParam(req.params.code));
      const schools = await storage.getSchools();
      const school = schools.find((item) => normalizeSchoolCode(item.code) === code);
      if (!school) return res.status(404).json({ message: "School not found" });

      const branding = await storage.getSchoolBranding(school.id);
      const rawLogo = branding?.emailHeaderLogoUrl || branding?.logoUrl || null;
      if (!rawLogo) return res.status(404).json({ message: "Logo not found" });

      if (rawLogo.startsWith("data:")) {
        const parsed = parseDataUriImage(rawLogo);
        if (!parsed) return res.status(400).json({ message: "Invalid logo format" });
        res.setHeader("Content-Type", parsed.mimeType);
        res.setHeader("Cache-Control", "public, max-age=600");
        return res.send(parsed.buffer);
      }

      if (rawLogo.startsWith("/")) {
        return res.redirect(302, `${getPublicBaseUrl(req)}${rawLogo}`);
      }

      return res.redirect(302, rawLogo);
    } catch (e: any) {
      res.status(500).json({ message: e.message || "Failed to load public email logo" });
    }
  });

  app.post("/api/admin/setup-complete", requireRole(...ADMIN_UI_ROLES), async (req, res) => {
    try {
      const schoolId = sessionSchoolId(req);
      if (!schoolId) {
        return res.status(400).json({ message: "No school is currently selected." });
      }

      const setupState = await getSchoolSetupState(schoolId);
      if (!setupState) {
        return res.status(404).json({ message: "School not found" });
      }

      const schoolAdmins = setupState.activeSchoolAdmins;
      if (schoolAdmins.length === 0) {
        return res.status(400).json({ message: "First School Admin must accept the invite before setup can be completed." });
      }

      if (!setupState.readyForOperationalCompletion) {
        return res.status(400).json({
          message: "Setup prerequisites are not complete.",
          missingSteps: setupState.missingSteps,
        });
      }

      const updated = await storage.updateSchool(schoolId, { status: "active", setupStatus: "complete" } as any);
      await auditLog(req, "school_setup_completed", `school:${schoolId}`, { schoolName: setupState.school.name });
      res.json(updated);
    } catch (e: any) {
      res.status(400).json({ message: e.message || "Failed to complete setup" });
    }
  });


  // === SCHOOL SETTINGS (admin) ===

  // GET school settings (paymentAppName, etc.)
  app.get("/api/admin/school/settings", requireRole(...ADMIN_UI_ROLES), async (req, res) => {
    try {
      const schoolId = sessionSchoolId(req);
      if (!schoolId) return res.status(400).json({ message: "No school context available" });
      const school = await storage.getSchoolById(schoolId);
      if (!school) return res.status(404).json({ message: "School not found" });
      res.json({ paymentAppName: school.paymentAppName ?? null });
    } catch (e: any) {
      res.status(500).json({ message: e.message || "Failed to load school settings" });
    }
  });

  // PATCH school settings (paymentAppName, etc.)
  app.patch("/api/admin/school/settings", requireRole(...ADMIN_UI_ROLES), async (req, res) => {
    try {
      const schoolId = sessionSchoolId(req);
      if (!schoolId) return res.status(400).json({ message: "No school context available" });
      const { paymentAppName } = req.body;
      if (typeof paymentAppName !== "string" && paymentAppName !== null) {
        return res.status(400).json({ message: "paymentAppName must be a string or null" });
      }
      const trimmed = typeof paymentAppName === "string" ? paymentAppName.trim() || null : null;
      const updated = await storage.updateSchool(schoolId, { paymentAppName: trimmed } as any);
      await auditLog(req, "school_settings_updated", `school:${schoolId}`, { paymentAppName: trimmed });
      res.json({ paymentAppName: (updated as any)?.paymentAppName ?? null });
    } catch (e: any) {
      res.status(400).json({ message: e.message || "Failed to update school settings" });
    }
  });

  // GET payment info for parents (school-scoped, no sensitive data)
  app.get("/api/school/payment-info", requireAuth, async (req, res) => {
    try {
      const schoolId = sessionSchoolId(req);
      if (!schoolId) return res.status(400).json({ message: "No school context available" });
      const school = await storage.getSchoolById(schoolId);
      if (!school) return res.status(404).json({ message: "School not found" });
      res.json({ paymentAppName: school.paymentAppName ?? null });
    } catch (e: any) {
      res.status(500).json({ message: e.message || "Failed to load payment info" });
    }
  });

}
