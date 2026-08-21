/**
 * server/routes/auth.routes.ts
 *
 * Route handlers: auth domain.
 * Extracted from routes.ts monolith.
 */
import type { Express, Request, Response, NextFunction } from "express";
import { storage } from "../storage.js";
import {
  requireAuth, requireRole, clientIp, clearRateLimit,
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
  getStorageMode,
  ensureSessionSchoolIsActive,
} from "../middleware/auth.js";
import type { EmailBrandingPayload } from "../middleware/auth.js";
import { buildBrandingResponse } from "../branding.js";
import { getSessionMaxAge } from "../app.js";

import bcrypt from "bcryptjs";
import crypto from "crypto";
import {
  sendInviteEmail, sendSchoolSetupInviteEmail, sendPasswordResetEmail,
  sendParentCodeEmail, sendPaymentSubmittedEmail, sendPaymentVerifiedEmail,
  sendPaymentRejectedEmail, isResendConfigured, sendWelcomeParentEmail,
} from "../email.js";
import {
  signInSchema, signUpParentSchema, acceptInviteSchema,
  forgotPasswordSchema, resetPasswordSchema,
  LEGACY_ROLE_MAP, USER_ROLES, BRANDING_PERMISSIONS,
} from "../../shared/schema.js";

export function registerAuthRoutes(app: Express): void {
  app.get("/api/health", (_req, res) => {
    const mode = getStorageMode();
    res.json({
      status: mode === "database" ? "ok" : "degraded",
      storageMode: mode,
      timestamp: new Date().toISOString(),
    });
  });

  // === AUTH ===

  // POST /api/auth/sign-in
  app.post("/api/auth/sign-in", async (req, res) => {
    try {
      const parsed = signInSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid credentials" });
      }
      const { username, password, schoolCode } = parsed.data;

      const ip = clientIp(req);

      // Two independent limits.
      //
      // Per-ACCOUNT is the real brake on password guessing: it survives an
      // attacker rotating IPs, because the account is the thing being attacked.
      //
      // Per-IP is deliberately generous. A primary school sits behind one public
      // IP, so a tight per-IP cap locks the whole staff room out every Monday
      // morning while doing nothing to a distributed attacker.
      const accountKey = `signin-user:${username.trim().toLowerCase()}`;
      if (await rateLimit(accountKey, 5, 15 * 60 * 1000)) {
        await auditLog(req, "login_account_locked", `username:${username}`, { ip });
        return res.status(429).json({
          message: "Too many failed attempts for this account. Please try again in 15 minutes, or reset your password.",
        });
      }
      if (await rateLimit(`signin:${ip}`, 50, 15 * 60 * 1000)) {
        await auditLog(req, "login_rate_limited", `ip:${ip}`);
        return res.status(429).json({ message: "Too many login attempts. Please try again later." });
      }

      const user = await storage.getUserByUsername(username);
      if (!user) {
        await auditLog(req, "login_failed", `username:${username}`, { reason: "user_not_found" });
        return res.status(401).json({ message: "Invalid username or password" });
      }

      if (user.status === "disabled" || user.status === "locked" || user.status === "invited") {
        await auditLog(req, "login_failed", `user:${user.id}`, { reason: `account_${user.status}` });
        return res.status(401).json({ message: "Invalid username or password" });
      }

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        await auditLog(req, "login_failed", `user:${user.id}`, { reason: "invalid_password" });
        return res.status(401).json({ message: "Invalid username or password" });
      }

      // The password was correct, so this attempt was not an attack. Reset the
      // per-account counter — it must only ever accumulate FAILED attempts, or a
      // legitimate user signing in six times in an afternoon would lock themselves out.
      await clearRateLimit(accountKey);

      if (user.schoolId) {
        const school = await storage.getSchoolById(user.schoolId);
        if (!school) {
          await auditLog(req, "login_failed", `user:${user.id}`, {
            reason: "school_not_found",
            schoolId: user.schoolId,
          });
          return res.status(401).json({ message: "School account is not correctly configured" });
        }

        if (school.status === "suspended") {
          await auditLog(req, "login_failed", `user:${user.id}`, {
            reason: "school_suspended",
            schoolId: user.schoolId,
          });
          return res.status(403).json({ message: "This school account is suspended. Contact support." });
        }

        const providedSchoolCode = normalizeSchoolCode(String(schoolCode || ""));
        const expectedSchoolCode = normalizeSchoolCode(String(school.code || ""));

        if (!providedSchoolCode || providedSchoolCode !== expectedSchoolCode) {
          await auditLog(req, "login_failed", `user:${user.id}`, {
            reason: "school_code_mismatch",
            schoolId: user.schoolId,
          });
          return res.status(401).json({ message: "Invalid school code for this account" });
        }
      }

      // ── MFA gate ──────────────────────────────────────────────
      // Password (and school code) are correct. If the account has MFA enabled,
      // do NOT complete the login — issue a short-lived partial-auth marker and
      // require the TOTP / recovery-code step at /api/auth/mfa/verify. The marker
      // alone grants no access (requireAuth checks userId, which stays unset).
      if (user.mfaEnabled) {
        return req.session.regenerate((err) => {
          if (err) {
            console.error("Session regeneration failed:", err);
            return res.status(500).json({ message: "Login failed" });
          }
          req.session.pendingMfa = { userId: user.id, expiresAt: Date.now() + 5 * 60 * 1000 };
          auditLog(req, "login_mfa_challenge", `user:${user.id}`).catch(() => {});
          res.json({ mfaRequired: true });
        });
      }

      req.session.regenerate((err) => {
        if (err) {
          console.error("Session regeneration failed:", err);
          return res.status(500).json({ message: "Login failed" });
        }
        req.session.userId = user.id;
        req.session.role = user.role;
        req.session.activeContext = resolveRole(user.role);
        req.session.mfaEnabled = !!user.mfaEnabled;
        req.session.username = user.username;
        req.session.schoolId = user.schoolId;
        // Apply role-based session lifetime (privileged roles get 8h, parents 30d).
        if (req.session.cookie) {
          req.session.cookie.maxAge = getSessionMaxAge(resolveRole(user.role));
        }

        storage.updateLastLogin(user.id).catch(() => {});
        auditLog(req, "login_success", `user:${user.id}`).catch(() => {});

        buildAuthUserResponse(req, user).then((response) => res.json(response)).catch(() => res.json(safeUser(user)));
      });
    } catch (e: any) {
      console.error("Sign-in error:", e);
      res.status(500).json({ message: "Login failed" });
    }
  });

  // Legacy login endpoint
  app.post("/api/auth/login", async (req, res, next) => {
    req.url = "/api/auth/sign-in";
    (app as any).handle(req, res, next);
  });

  // POST /api/auth/sign-up-parent
  app.post("/api/auth/sign-up-parent", async (req, res) => {
    try {
      const parsed = signUpParentSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid registration data", errors: parsed.error.flatten().fieldErrors });
      }
      const { name, email, username, password } = parsed.data;

      const ip = clientIp(req);
      if (await rateLimit(`signup:${ip}`, 5, 60 * 60 * 1000)) {
        return res.status(429).json({ message: "Too many registration attempts. Please try again later." });
      }

      const existingUsername = await storage.getUserByUsername(username);
      if (existingUsername) {
        return res.status(409).json({ message: "Username is already taken" });
      }

      const existingEmail = await storage.getUserByEmail(email);
      if (existingEmail) {
        return res.status(409).json({ message: "An account with this email already exists" });
      }

      const passwordHash = await bcrypt.hash(password, 12);
      const user = await storage.createUser({
        username,
        passwordHash,
        name,
        email,
        role: "parent",
        status: "active",
        schoolId: null,
      });

      await auditLog(req, "parent_registered", `user:${user.id}`);

      // Welcome email (fire-and-forget — never block signup on email delivery).
      if (user.email) {
        sendWelcomeParentEmail(user.email, user.name).catch(() => {});
      }

      req.session.regenerate((err) => {
        if (err) {
          buildAuthUserResponse(req, user).then((response) => res.status(201).json(response)).catch(() => res.status(201).json(safeUser(user)));
          return;
        }
        req.session.userId = user.id;
        req.session.role = user.role;
        req.session.activeContext = "parent";
        req.session.mfaEnabled = false;
        req.session.schoolId = null;
        // Parents get a longer session; apply the role-based lifetime.
        if (req.session.cookie) {
          req.session.cookie.maxAge = getSessionMaxAge("parent");
        }
        buildAuthUserResponse(req, user).then((response) => res.status(201).json(response)).catch(() => res.status(201).json(safeUser(user)));
      });
    } catch (e: any) {
      console.error("Sign-up error:", e);
      res.status(500).json({ message: "Registration failed" });
    }
  });

  // POST /api/auth/sign-out
  app.post("/api/auth/sign-out", async (req, res) => {
    const userId = req.session?.userId;
    if (userId) {
      await auditLog(req, "logout", `user:${userId}`).catch(() => {});
    }
    req.session.destroy((err) => {
      if (err) return res.status(500).json({ message: "Logout failed" });
      res.clearCookie("connect.sid");
      res.json({ message: "Logged out" });
    });
  });

  // Legacy logout endpoint
  app.post("/api/auth/logout", async (req, res, next) => {
    req.url = "/api/auth/sign-out";
    (app as any).handle(req, res, next);
  });

  app.post("/api/auth/context", requireAuth, async (req, res) => {
    try {
      const requestedContext = resolveRole(String(req.body?.context || ""));
      if (!requestedContext) {
        return res.status(400).json({ message: "Context is required" });
      }

      const user = await storage.getUserById(req.session.userId!);
      if (!user || user.status !== "active") {
        return res.status(401).json({ message: "User not found" });
      }

      const { profile, activeContext } = await syncSessionActiveContext(req, user, requestedContext);
      if (activeContext !== requestedContext) {
        return res.status(403).json({ message: "Requested context is not available for this account." });
      }

      const response = await buildAuthUserResponse(req, user);
      // Role simulation by the test account is worth telling apart from a real
      // user switching between roles they genuinely hold.
      await auditLog(req, profile.isTestAccount ? "test_account_context_switched" : "context_switched",
        `user:${user.id}`,
        { context: activeContext, availableContexts: profile.contexts.map((item) => item.key) });
      res.json(response);
    } catch (e: any) {
      res.status(400).json({ message: e.message || "Failed to switch context" });
    }
  });

  // POST /api/auth/accept-invite
  app.post("/api/auth/accept-invite", async (req, res) => {
    try {
      const parsed = acceptInviteSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid invite data", errors: parsed.error.flatten().fieldErrors });
      }
      const { token, name, username, password } = parsed.data;
      await acceptInviteToken(req, res, token, name, username, password);
    } catch (e: any) {
      console.error("Accept-invite error:", e);
      res.status(500).json({ message: "Failed to accept invite" });
    }
  });

  app.get("/api/invites/:token", async (req, res) => {
    try {
      const ip = clientIp(req);
      if (await rateLimit(`invite-lookup:${ip}`, 20, 15 * 60 * 1000)) {
        return res.status(429).json({ message: "Too many requests. Please try again later." });
      }
      const token = routeParam(req.params.token);
      const resolved = await resolveInviteByToken(token);
      if ("error" in resolved) {
        return res.status(400).json({ message: resolved.error });
      }

      const { invite, school } = resolved;
      const branding = school ? await storage.getSchoolBranding(school.id) : null;
      const inviteStatus = deriveInviteStatus(invite);
      res.json({
        id: invite.id,
        email: invite.email,
        inviteeName: invite.inviteeName || null,
        role: invite.role,
        schoolId: invite.schoolId,
        schoolName: school?.name || null,
        schoolCode: school?.code || null,
        schoolBranding: buildBrandingResponse(branding, school?.name || null),
        schoolStatus: school?.status || null,
        setupStatus: school?.setupStatus || null,
        status: inviteStatus,
        expiresAt: invite.expiresAt,
      });
    } catch (e: any) {
      res.status(500).json({ message: e.message || "Failed to load invite" });
    }
  });

  app.post("/api/invites/:token/accept", async (req, res) => {
    try {
      const ip = clientIp(req);
      if (await rateLimit(`invite-accept:${ip}`, 10, 15 * 60 * 1000)) {
        return res.status(429).json({ message: "Too many requests. Please try again later." });
      }
      const token = routeParam(req.params.token);
      const parsed = acceptInviteSchema.omit({ token: true }).safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid invite data", errors: parsed.error.flatten().fieldErrors });
      }
      const { name, username, password } = parsed.data;
      await acceptInviteToken(req, res, token, name, username, password);
    } catch (e: any) {
      console.error("Invite accept error:", e);
      res.status(500).json({ message: "Failed to accept invite" });
    }
  });

  // POST /api/auth/forgot-password
  app.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const parsed = forgotPasswordSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.json({ message: "If an account with that email exists, a password reset link has been sent." });
      }
      const { email } = parsed.data;

      const ip = clientIp(req);
      if (await rateLimit(`forgot:${ip}`, 3, 15 * 60 * 1000)) {
        return res.json({ message: "If an account with that email exists, a password reset link has been sent." });
      }

      const user = await storage.getUserByEmail(email);
      if (!user || user.status !== "active") {
        return res.json({ message: "If an account with that email exists, a password reset link has been sent." });
      }

      const rawToken = crypto.randomBytes(32).toString("hex");
      const tokenHash = await bcrypt.hash(rawToken, 10);

      const invite = await storage.createInvite({
        email,
        role: "__password_reset__",
        schoolId: null,
        tokenHash,
        invitedBy: null,
        status: "pending",
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      });

      const resetLink = `${getPublicBaseUrl(req)}/reset-password?token=${invite.id}.${rawToken}`;

      let emailBranding: EmailBrandingPayload | undefined;

      let brandingSchoolId: string | null = user.schoolId;

      if (!brandingSchoolId && user.email) {
        const parentLinks = await storage.getParentChildren(user.email);
        brandingSchoolId = parentLinks.find((link) => !!link.student?.schoolId)?.student?.schoolId ?? null;

        if (!brandingSchoolId) {
          const normalizedEmail = user.email.trim().toLowerCase();
          const linkingCodes = await storage.getLinkingCodes();
          brandingSchoolId =
            linkingCodes.find((code) => (code.parentEmail || "").trim().toLowerCase() === normalizedEmail)?.student?.schoolId ?? null;
        }
      }

      emailBranding = await getEmailBrandingForSchool(req, brandingSchoolId);

      const sent = await sendPasswordResetEmail(email, resetLink, emailBranding);
      if (!sent) {
        console.log(`[PASSWORD RESET] Link for ${email}: ${resetLink}`);
        if (!isResendConfigured()) {
          console.warn("[Resend] RESEND_API_KEY/RESEND_FROM_EMAIL not configured; using log fallback for reset links.");
        }
      }

      await auditLog(req, "password_reset_requested", `user:${user.id}`);

      res.json({ message: "If an account with that email exists, a password reset link has been sent." });
    } catch (e: any) {
      console.error("Forgot-password error:", e);
      res.json({ message: "If an account with that email exists, a password reset link has been sent." });
    }
  });

  // POST /api/auth/reset-password
  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const ip = clientIp(req);
      if (await rateLimit(`reset-password:${ip}`, 5, 15 * 60 * 1000)) {
        return res.status(429).json({ message: "Too many requests. Please try again later." });
      }
      const parsed = resetPasswordSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid reset data" });
      }
      const { token, password } = parsed.data;

      const dotIndex = token.indexOf(".");
      if (dotIndex === -1) {
        return res.status(400).json({ message: "Invalid reset link" });
      }
      const inviteId = token.substring(0, dotIndex);
      const rawToken = token.substring(dotIndex + 1);

      const invite = await storage.getInviteById(inviteId);
      if (!invite || invite.role !== "__password_reset__") {
        return res.status(400).json({ message: "Invalid or expired reset link" });
      }
      if (invite.status !== "pending") {
        return res.status(400).json({ message: "This reset link has already been used" });
      }
      if (new Date() > invite.expiresAt) {
        return res.status(400).json({ message: "This reset link has expired" });
      }

      const tokenValid = await bcrypt.compare(rawToken, invite.tokenHash);
      if (!tokenValid) {
        return res.status(400).json({ message: "Invalid reset link" });
      }

      const user = await storage.getUserByEmail(invite.email);
      if (!user) {
        return res.status(400).json({ message: "Invalid reset link" });
      }

      const passwordHash = await bcrypt.hash(password, 12);
      await storage.updateUser(user.id, { passwordHash } as any);
      await storage.markInviteAccepted(invite.id);

      await auditLog(req, "password_reset_completed", `user:${user.id}`);

      res.json({ message: "Password has been reset successfully. You can now sign in with your new password." });
    } catch (e: any) {
      console.error("Reset-password error:", e);
      res.status(500).json({ message: "Failed to reset password" });
    }
  });

  // GET /api/auth/me
  app.get("/api/auth/me", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const allowed = await ensureSessionSchoolIsActive(req, res);
    if (!allowed) return;
    const user = await storage.getUserById(req.session.userId);
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }
    if (user.status !== "active") {
      req.session.destroy(() => {});
      return res.status(401).json({ message: "Account is not active" });
    }
    const response: any = await buildAuthUserResponse(req, user);
    res.json(response);
  });

}
