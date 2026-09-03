/**
 * server/middleware/auth.ts
 *
 * Centralised auth middleware, role guards, session helpers, and shared
 * business-logic utilities used across all route domain files.
 *
 * Extracted from the original routes.ts monolith.
 */
import type { Express, Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import multer from "multer";
import { storage, getStorageMode } from "../storage.js";
import { contextLabel } from "../../shared/contexts.js";
export { getStorageMode };
import {
  BRANDING_UPLOAD_MAX_BYTES,
  brandingFileFilter,
  buildBrandingResponse,
} from "../branding.js";
import {
  LEGACY_ROLE_MAP,
  BRANDING_PERMISSIONS,
} from "../../shared/schema.js";

// ─── Constants ────────────────────────────────────────────────────────────────

export const COMPLETE_SETUP_STATUSES = new Set(["operational_setup_complete", "complete", "active"]);

export const PLATFORM_OWNER_ROLES = ["owner", "platform_admin"];
export const ADMIN_UI_ROLES = ["admin", "school_admin", "owner", "platform_admin"] as const;
export const IT_WEBSITE_ROLES = ["it_personnel"] as const;
export const FINANCE_ROLES = [...ADMIN_UI_ROLES, "finance"] as const;

export const BRANDING_VIEW_PERMISSION    = "BRANDING_VIEW";
export const BRANDING_MANAGE_PERMISSION  = "BRANDING_MANAGE";
export const BRANDING_UPLOAD_LOGO_PERMISSION  = "BRANDING_UPLOAD_LOGO";
export const BRANDING_UPDATE_THEME_PERMISSION = "BRANDING_UPDATE_THEME";
export const BRANDING_RESET_DEFAULT_PERMISSION = "BRANDING_RESET_DEFAULT";

export const CONTEXT_DEFAULT_PATHS: Record<string, string> = {
  owner: "/admin/owner",
  platform_admin: "/admin/owner",
  school_admin: "/admin",
  admin: "/admin",
  teacher: "/teacher",
  parent: "/parent",
  finance: "/finance",
  it_personnel: "/admin/website",
};

// ─── Multer (branding uploads) ─────────────────────────────────────────────────

export const brandingUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: BRANDING_UPLOAD_MAX_BYTES, files: 1 },
  fileFilter: brandingFileFilter,
});

export function runSingleBrandingUpload(req: Request, res: Response): Promise<void> {
  return new Promise((resolve, reject) => {
    brandingUpload.single("file")(req as any, res as any, (error: unknown) => {
      if (error) { reject(error); return; }
      resolve();
    });
  });
}

// ─── Utility helpers ───────────────────────────────────────────────────────────

export function generateLinkingCode(): string {
  // SECURITY: use crypto.randomBytes() — Math.random() is predictable.
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.randomBytes(6); // 6 random bytes → 6 character positions
  let code = "";
  for (let i = 0; i < 6; i++) {
    if (i === 3) code += "-";
    code += chars[bytes[i] % chars.length];
  }
  return code;
}

export function generatePaymentReference(): string {
  // SECURITY: use crypto.randomBytes() — Math.random() is predictable.
  // Format: EDU-<timestamp>-<8 random hex chars> — timestamp for traceability,
  // random suffix for uniqueness and unpredictability.
  const ts = Date.now().toString(36).toUpperCase();
  const rand = crypto.randomBytes(4).toString("hex").toUpperCase();
  return `EDU-${ts}-${rand}`;
}

/**
 * The client's IP address, as resolved by Express's trust-proxy setting.
 *
 * SECURITY: never read `x-forwarded-for` directly. Its LEFTMOST entry is the
 * value the client sent, so keying a rate limit on it lets an attacker rotate
 * one header and get unlimited attempts. `req.ip` is derived from the trusted
 * proxy configuration (`app.set("trust proxy", 1)` in app.ts), which is the
 * value this deployment can actually rely on.
 */
export function clientIp(req: Request): string {
  return req.ip || req.socket?.remoteAddress || "unknown";
}

export function routeParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export function splitInviteToken(token: string): { inviteId: string; rawToken: string } | null {
  const dotIndex = token.indexOf(".");
  if (dotIndex === -1) return null;
  return { inviteId: token.substring(0, dotIndex), rawToken: token.substring(dotIndex + 1) };
}

export function normalizeEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  return email.trim().toLowerCase();
}

export function normalizeSchoolCode(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, "-");
}

export function extractSupportReason(req: Request): string | null {
  const fromBody = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
  const fromQuery = typeof req.query?.reason === "string" ? req.query.reason.trim() : "";
  return fromBody || fromQuery || null;
}

export function isDbUnavailableError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  const code = (error as { code?: string } | undefined)?.code;
  const nestedErrors = (error as { errors?: Array<{ code?: string }> } | undefined)?.errors ?? [];
  if (code === "ECONNREFUSED" || code === "ENOTFOUND") return true;
  if (nestedErrors.some((nested) => nested.code === "ECONNREFUSED" || nested.code === "ENOTFOUND")) return true;
  return (
    message.includes("ECONNREFUSED") ||
    message.includes("Connection terminated") ||
    message.includes("ENOTFOUND")
  );
}

// ─── Role resolution ───────────────────────────────────────────────────────────

export function resolveRole(role: string): string {
  return LEGACY_ROLE_MAP[role] || role;
}

export function isPlatformOwnerRole(role: string | null | undefined): boolean {
  if (!role) return false;
  const normalized = resolveRole(role);
  return PLATFORM_OWNER_ROLES.includes(normalized);
}

export function getActiveRequestContext(req: Request): string {
  return resolveRole(req.session.activeContext || req.session.role || "");
}

export function isPlatformOwnerRequest(req: Request): boolean {
  return isPlatformOwnerRole(req.session.role);
}

// ─── Session helpers ───────────────────────────────────────────────────────────

/** Returns the school ID to scope data queries to. Returns null for owner/platform requests. */
export function sessionSchoolId(req: Request): string | null {
  if (isPlatformOwnerRole(req.session.role)) {
    if (req.session.supportSchoolId) return req.session.supportSchoolId;
    return null;
  }
  return req.session.schoolId ?? null;
}

export function isInSupportMode(req: Request): boolean {
  return isPlatformOwnerRole(req.session.role) && !!req.session.supportSchoolId;
}

// ─── Rate limiting ────────────────────────────────────────────────────────────
//
// IMPORTANT — PRODUCTION LIMITATION:
// This implementation stores counters in process memory (a Map). On serverless
// platforms (Vercel), each cold start creates a fresh process with an empty Map,
// making the limit effectively useless under concurrent invocations.
//
// For production: replace rateLimitStore with a shared store backed by
// PostgreSQL or Redis (e.g., Upstash Redis + ioredis). Until then, this
// provides rate-limiting only on single-instance / local deployments.
// The startup warning below alerts operators in production.

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

// Warn on startup only when no distributed store is available.
if (process.env.NODE_ENV === "production" && !process.env.DATABASE_URL) {
  console.warn(
    "[SECURITY WARNING] In-memory rate limiter is active (no DATABASE_URL). " +
    "On serverless deployments (Vercel), rate limits are NOT enforced across " +
    "concurrent function instances.",
  );
}

function rateLimitMemory(key: string, maxAttempts: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = rateLimitStore.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  entry.count++;
  return entry.count > maxAttempts;
}

// PostgreSQL-backed distributed rate limiter.
// Each serverless instance has its own memory, so the Map alone cannot enforce
// limits across concurrent instances. With DATABASE_URL set, an atomic upsert
// against rate_limits does; the Map remains a fast fallback for dev/DB outages.
let rateLimitTableReady = false;

async function ensureRateLimitTable(): Promise<void> {
  if (rateLimitTableReady) return;
  const { getPool } = await import("../config/database.js");
  await getPool().query(
    `CREATE TABLE IF NOT EXISTS rate_limits (
       key text PRIMARY KEY,
       count integer NOT NULL,
       reset_at timestamptz NOT NULL
     )`,
  );
  rateLimitTableReady = true;
}

export async function rateLimit(key: string, maxAttempts: number, windowMs: number): Promise<boolean> {
  // Always run the in-memory check — free, and still throttles within this
  // instance if the database is unreachable.
  const memoryLimited = rateLimitMemory(key, maxAttempts, windowMs);
  // Use the distributed store only when the app is actually running on the
  // database. In memory mode (dev/test) we must NOT touch a DB — otherwise a
  // stray DATABASE_URL from a .env would pull test traffic onto a shared DB.
  if (getStorageMode() !== "database") return memoryLimited;
  try {
    await ensureRateLimitTable();
    const { getPool } = await import("../config/database.js");
    const { rows } = await getPool().query(
      `INSERT INTO rate_limits (key, count, reset_at)
       VALUES ($1, 1, now() + ($2 || ' milliseconds')::interval)
       ON CONFLICT (key) DO UPDATE SET
         count = CASE WHEN rate_limits.reset_at < now() THEN 1 ELSE rate_limits.count + 1 END,
         reset_at = CASE WHEN rate_limits.reset_at < now()
                    THEN now() + ($2 || ' milliseconds')::interval
                    ELSE rate_limits.reset_at END
       RETURNING count`,
      [key, String(windowMs)],
    );
    // Opportunistic cleanup of long-expired keys (~1% of calls).
    if (Math.random() < 0.01) {
      void getPool()
        .query(`DELETE FROM rate_limits WHERE reset_at < now() - interval '1 day'`)
        .catch(() => {});
    }
    return memoryLimited || Number(rows[0]?.count ?? 0) > maxAttempts;
  } catch (e) {
    console.error(
      "[rateLimit] Distributed check failed; using in-memory fallback:",
      (e as Error).message,
    );
    return memoryLimited;
  }
}

/**
 * Reset a rate-limit counter.
 *
 * Used to clear a per-ACCOUNT login counter once the password has been verified,
 * so the lockout only ever counts *failed* attempts. Without this, a legitimate
 * user signing in repeatedly would lock themselves out.
 *
 * Best-effort by design: if the store is unavailable the counter simply expires
 * on its own, so a failure here can never block a successful login.
 */
export async function clearRateLimit(key: string): Promise<void> {
  rateLimitStore.delete(key);
  if (getStorageMode() !== "database") return;
  try {
    const { getPool } = await import("../config/database.js");
    await getPool().query(`DELETE FROM rate_limits WHERE key = $1`, [key]);
  } catch {
    /* non-fatal: the row expires on its own. */
  }
}

// ─── Audit logging ─────────────────────────────────────────────────────────────

export async function auditLog(
  req: Request,
  action: string,
  target?: string,
  metadata?: Record<string, unknown>,
) {
  try {
    await storage.createAuditLog({
      userId: req.session?.userId || null,
      action,
      target: target || null,
      metadata: metadata ? JSON.stringify(metadata) : null,
      ipAddress: clientIp(req),
      userAgent: (req.headers["user-agent"] as string) || null,
    });
  } catch (e) {
    console.error("Audit log failed:", e);
  }
}

// ─── School active check ───────────────────────────────────────────────────────

export async function ensureSessionSchoolIsActive(req: Request, res: Response): Promise<boolean> {
  if (!req.session.userId) return false;
  const sessionRole = resolveRole(req.session.role || "");
  if (isPlatformOwnerRole(sessionRole)) return true;
  const schoolId = sessionSchoolId(req);
  if (!schoolId) return true;

  const school = await storage.getSchoolById(schoolId);
  if (!school) {
    req.session.destroy(() => {});
    res.clearCookie("connect.sid");
    res.status(401).json({ message: "School account is not correctly configured" });
    // SECURITY: must be `false`, not the Response. Callers test `if (!allowed) return;`
    // and a Response object is truthy, which would fall through into the route body.
    return false;
  }

  const INACTIVE_STATUSES: Record<string, string> = {
    suspended: "This school account is currently suspended. Please contact platform support.",
    archived: "This school account has been archived. Please contact platform support.",
    pending_deletion: "This school account is pending deletion. Please contact platform support.",
    deleted: "This school account has been removed. Please contact platform support.",
  };

  const inactiveMsg = INACTIVE_STATUSES[school.status];
  if (inactiveMsg) {
    await auditLog(req, `session_blocked_${school.status}_school`, `school:${schoolId}`, {
      userId: req.session.userId,
      role: req.session.role || null,
      activeContext: req.session.activeContext || null,
    }).catch(() => {});
    req.session.destroy(() => {});
    res.clearCookie("connect.sid");
    res.status(403).json({ message: inactiveMsg, schoolStatus: school.status });
    // SECURITY: see above — returning the Response here let users of suspended,
    // archived and deleted schools pass requireAuth and requireRole.
    return false;
  }
  return true;
}

// ─── Express middleware ────────────────────────────────────────────────────────

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  (async () => {
    if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
    const allowed = await ensureSessionSchoolIsActive(req, res);
    if (!allowed) return;
    next();
  })().catch((error) => {
    console.error("Auth guard failure:", error);
    res.status(500).json({ message: "Authentication failed" });
  });
}

export function requireRole(...roles: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
    const allowed = await ensureSessionSchoolIsActive(req, res);
    if (!allowed) return;
    const currentContext = getActiveRequestContext(req);
    if (!roles.includes(currentContext)) {
      return res.status(403).json({ message: "Access denied" });
    }

    // SECURITY: platform-owner roles can reach every tenant's data, so MFA is
    // mandatory for them. Enrolment endpoints sit behind requireAuth rather than
    // requireRole, so /api/auth/mfa/* stays reachable and no one can be locked
    // out by this check — they are funnelled to enrolment, not shut out.
    //
    // There is no exemption. Every session reaching a platform-owner context
    // must hold MFA.
    if (isPlatformOwnerRole(currentContext) && req.session.mfaEnabled !== true) {
      return res.status(403).json({
        message: "Two-factor authentication is required for platform administrator accounts. Set it up to continue.",
        needsMfaEnrolment: true,
      });
    }

    next();
  };
}

// ─── School setup helpers ──────────────────────────────────────────────────────

export function normalizeSchoolSetupStatus(
  status: string | null | undefined,
  schoolStatus: string | null | undefined,
): string {
  if (status && status.trim()) return status;
  if (schoolStatus === "active") return "active";
  return "pending_admin_invite";
}

export function deriveInviteStatus(invite: { status: string; expiresAt: Date } | null | undefined): string {
  if (!invite) return "not_invited";
  if (invite.status === "pending" && new Date(invite.expiresAt).getTime() < Date.now()) return "expired";
  return invite.status;
}

export function setupMilestonesFromState(input: {
  schoolStatus: string | null | undefined;
  setupStatus: string | null | undefined;
  firstAdminInviteStatus: string;
  hasActiveSchoolAdmin: boolean;
}) {
  const schoolStatus = input.schoolStatus || "pending_setup";
  const setupStatus = normalizeSchoolSetupStatus(input.setupStatus, schoolStatus);
  return {
    schoolCreated: true,
    firstAdminInvited: input.firstAdminInviteStatus !== "not_invited",
    firstAdminAccepted: input.firstAdminInviteStatus === "accepted" || input.hasActiveSchoolAdmin,
    schoolAdminAccountActive: input.hasActiveSchoolAdmin,
    operationalSetupStarted: ["admin_accepted", "operational_setup_in_progress", "operational_setup_complete", "complete", "active"].includes(setupStatus),
    operationalSetupCompleted: COMPLETE_SETUP_STATUSES.has(setupStatus),
    schoolActive: schoolStatus === "active",
  };
}

export function nextOwnerAction(setupStatus: string, inviteStatus: string, schoolStatus: string): string {
  if (inviteStatus === "not_invited" || setupStatus === "pending_admin_invite" || setupStatus === "school_created") return "Invite First Admin";
  if (inviteStatus === "pending" || setupStatus === "pending_admin_acceptance") return "Resend Invite";
  if (inviteStatus === "expired") return "Generate New Invite";
  if (inviteStatus === "accepted" && !COMPLETE_SETUP_STATUSES.has(setupStatus)) return "View Setup Status";
  if (COMPLETE_SETUP_STATUSES.has(setupStatus) && schoolStatus !== "active") return "Activate School";
  return "Enter Support Mode";
}

// ─── Invite helpers ────────────────────────────────────────────────────────────

export async function resolveInviteByToken(token: string) {
  const parts = splitInviteToken(token);
  if (!parts) return { error: "Invalid invite link" as const };
  const invite = await storage.getInviteById(parts.inviteId);
  if (!invite) return { error: "Invalid or expired invite link" as const };
  if (invite.status !== "pending") return { error: "This invite has already been used or revoked" as const };
  if (new Date() > invite.expiresAt) return { error: "This invite has expired" as const };
  const tokenValid = await bcrypt.compare(parts.rawToken, invite.tokenHash);
  if (!tokenValid) return { error: "Invalid invite link" as const };
  const school = invite.schoolId ? await storage.getSchoolById(invite.schoolId) : undefined;
  return { invite, school };
}

export async function acceptInviteToken(
  req: Request,
  res: Response,
  token: string,
  name: string,
  username: string,
  password: string,
) {
  const resolved = await resolveInviteByToken(token);
  if ("error" in resolved) return res.status(400).json({ message: resolved.error });

  const { invite } = resolved;
  const existingUsername = await storage.getUserByUsername(username);
  if (existingUsername) return res.status(409).json({ message: "Username is already taken" });

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await storage.createUser({
    username, passwordHash, name,
    email: invite.email,
    role: invite.role,
    status: "active",
    schoolId: invite.schoolId,
  });

  if (invite.schoolId && invite.role === "school_admin") {
    await storage.updateSchool(invite.schoolId, {
      status: "pending_setup",
      setupStatus: "operational_setup_in_progress",
    } as any);
  }

  await storage.markInviteAccepted(invite.id);
  await auditLog(req, "invite_accepted", `user:${user.id}`, { inviteId: invite.id });

  // Staff-invite wizard family link: if this invite carried a family, the new
  // account is also a parent — add the parent role and link them to every child
  // in that family. School-scoped in getStudentsByFamily so no cross-tenant leak.
  // Wrapped so a linking hiccup never blocks account creation (admin can finish
  // via "Link Child" on the staff profile).
  const linkFamilyId = (invite as any).familyId as string | null | undefined;
  const parentEmail = user.email;
  if (linkFamilyId && parentEmail) {
    try {
      if (resolveRole(user.role) !== "parent") {
        await storage.addSecondaryRole(user.id, "parent");
      }
      const kids = await storage.getStudentsByFamily(linkFamilyId, invite.schoolId);
      for (const s of kids) {
        await storage.addParentStudentLink({
          parentIdentifier: parentEmail,
          studentId: s.id,
          relationship: (invite as any).relationship || undefined,
          addedByAdminId: invite.invitedBy || undefined,
          schoolId: invite.schoolId || undefined,
        });
      }
      await auditLog(req, "invite_family_linked", `user:${user.id}`, { familyId: linkFamilyId, children: kids.length });
    } catch (e) {
      console.error("[invite-accept] family link failed:", e);
    }
  }

  req.session.regenerate((err) => {
    if (err) {
      buildAuthUserResponse(req, user).then((response) => res.status(201).json(response)).catch(() => res.status(201).json(safeUser(user)));
      return;
    }
    req.session.userId = user.id;
    req.session.role = user.role;
    req.session.activeContext = resolveRole(user.role);
    req.session.mfaEnabled = !!user.mfaEnabled;
    req.session.username = user.username;
    req.session.schoolId = user.schoolId;
    buildAuthUserResponse(req, user).then((response) => res.status(201).json(response)).catch(() => res.status(201).json(safeUser(user)));
  });

  return { invite, user };
}

// ─── User response helpers ─────────────────────────────────────────────────────

export function safeUser(user: {
  id: string; username: string; name: string; role: string;
  email: string | null; status: string; schoolId: string | null;
}) {
  return { id: user.id, username: user.username, name: user.name, role: user.role, email: user.email, status: user.status, schoolId: user.schoolId };
}

export async function getUserAccessProfile(user: {
  id: string; role: string; email: string | null; schoolId: string | null;
}) {
  const contexts = new Map<string, { key: string; label: string; defaultPath: string }>();
  const primaryRole = resolveRole(user.role);
  const normalizedEmail = normalizeEmail(user.email);
  const assignedClassIds: string[] = [];
  const linkedStudentIds: string[] = [];

  const addContext = (key: string) => {
    const normalizedKey = resolveRole(key);
    if (!normalizedKey || contexts.has(normalizedKey)) return;
    const label = contextLabel(normalizedKey);
    contexts.set(normalizedKey, { key: normalizedKey, label, defaultPath: CONTEXT_DEFAULT_PATHS[normalizedKey] || "/login" });
  };

  addContext(primaryRole);
  const secondaryRoles = await storage.getSecondaryRoles(user.id);
  for (const role of secondaryRoles) addContext(role);

  if (normalizedEmail) {
    const parentLinks = await storage.getParentChildren(user.email!);
    for (const link of parentLinks) {
      if (!user.schoolId || link.student?.schoolId === user.schoolId) {
        if (link.studentId) linkedStudentIds.push(link.studentId);
      }
    }
    const linkingCodes = user.schoolId ? await storage.getLinkingCodes(user.schoolId) : await storage.getLinkingCodes();
    const hasPendingParentLink = linkingCodes.some((code) => normalizeEmail(code.parentEmail) === normalizedEmail);
    if (primaryRole === "parent" || linkedStudentIds.length > 0 || hasPendingParentLink) addContext("parent");
  }

  if (user.schoolId) {
    const classes = await storage.getClasses(user.schoolId);
    for (const cls of classes) { if (cls.teacherId === user.id) assignedClassIds.push(cls.id); }
    // Also include subject-based assignments (class_teacher_assignments) so a
    // teacher assigned only via the new model — e.g. a shared Quran teacher with
    // no legacy classes.teacherId — still gets the teacher context and class list.
    try {
      const assigned = await storage.getAssignedClassIdsForTeacher(user.id, user.schoolId);
      for (const cid of assigned) if (!assignedClassIds.includes(cid)) assignedClassIds.push(cid);
    } catch { /* additive — never block access resolution */ }
  }
  if (primaryRole === "teacher" || assignedClassIds.length > 0) addContext("teacher");

  return {
    primaryRole,
    contexts: Array.from(contexts.values()),
    assignedClassIds,
    linkedStudentIds: Array.from(new Set(linkedStudentIds)),
  };
}

export async function syncSessionActiveContext(
  req: Request,
  user: { id: string; role: string; email: string | null; schoolId: string | null },
  preferredContext?: string | null,
) {
  const profile = await getUserAccessProfile(user);
  const availableKeys = profile.contexts.map((c) => c.key);
  const desired = resolveRole(preferredContext || req.session.activeContext || profile.primaryRole);
  req.session.activeContext = availableKeys.includes(desired) ? desired : (availableKeys[0] || profile.primaryRole);

  return { profile, activeContext: req.session.activeContext };
}

export async function buildAuthUserResponse(
  req: Request,
  user: { id: string; username: string; name: string; role: string; email: string | null; status: string; schoolId: string | null },
) {
  const base = safeUser(user) as any;
  const school = user.schoolId ? await storage.getSchoolById(user.schoolId) : null;
  const { profile, activeContext } = await syncSessionActiveContext(req, user);
  base.primaryRole = profile.primaryRole;
  base.role = activeContext;
  base.activeContext = activeContext;
  base.schoolName = school?.name || null;
  base.schoolCode = school?.code || null;
  base.availableContexts = profile.contexts;
  base.contextMetadata = { assignedClassIds: profile.assignedClassIds, linkedStudentIds: profile.linkedStudentIds };
  base.secondaryRoles = await storage.getSecondaryRoles(user.id);
  if (isPlatformOwnerRole(user.role)) {
    base.supportMode = {
      active: !!req.session.supportSchoolId,
      schoolId: req.session.supportSchoolId || null,
      schoolName: req.session.supportSchoolName || null,
    };
  }
  return base;
}

// ─── URL / email helpers ───────────────────────────────────────────────────────

export function getPublicBaseUrl(req: Request): string {
  const configured = process.env.APP_BASE_URL || process.env.PUBLIC_APP_URL;
  if (configured) return configured.replace(/\/$/, "");
  const forwardedProto = (req.headers["x-forwarded-proto"] as string | undefined)?.split(",")[0]?.trim();
  const forwardedHost = (req.headers["x-forwarded-host"] as string | undefined)?.split(",")[0]?.trim();
  const protocol = forwardedProto || req.protocol;
  const host = forwardedHost || req.get("host") || "localhost:5000";
  return `${protocol}://${host}`;
}

export function toEmailSafeLogoUrl(req: Request, schoolCode: string | null | undefined, rawLogoUrl: string | null | undefined): string | null {
  if (!rawLogoUrl) return null;
  if (rawLogoUrl.startsWith("data:")) {
    if (!schoolCode) return null;
    return `${getPublicBaseUrl(req)}/api/public/schools/${encodeURIComponent(schoolCode)}/email-logo`;
  }
  if (rawLogoUrl.startsWith("/")) return `${getPublicBaseUrl(req)}${rawLogoUrl}`;
  return rawLogoUrl;
}

export function parseDataUriImage(dataUri: string): { mimeType: string; buffer: Buffer } | null {
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(dataUri);
  if (!match) return null;
  try { return { mimeType: match[1], buffer: Buffer.from(match[2], "base64") }; }
  catch { return null; }
}

export type EmailBrandingPayload = {
  schoolName?: string | null;
  logoUrl?: string | null;
  primaryColour?: string | null;
  secondaryColour?: string | null;
};

export async function getEmailBrandingForSchool(
  req: Request,
  schoolId: string | null | undefined,
): Promise<EmailBrandingPayload | undefined> {
  if (!schoolId) return undefined;
  const [school, branding] = await Promise.all([
    storage.getSchoolById(schoolId),
    storage.getSchoolBranding(schoolId),
  ]);
  const rawLogoUrl = branding?.emailHeaderLogoUrl || branding?.logoUrl || null;
  return {
    schoolName: school?.name || null,
    logoUrl: toEmailSafeLogoUrl(req, school?.code || null, rawLogoUrl),
    primaryColour: branding?.primaryColour || null,
    secondaryColour: branding?.secondaryColour || null,
  };
}

// ─── Branding permission helpers ───────────────────────────────────────────────

export async function getBrandingPermissionSet(userId: string): Promise<Set<string>> {
  const permissions = await storage.getUserPermissions(userId);
  return new Set(permissions.filter((p) => BRANDING_PERMISSIONS.includes(p as any)));
}

export async function canViewBranding(req: Request, schoolId: string): Promise<boolean> {
  if (!req.session.userId) return false;
  if (isPlatformOwnerRole(req.session.role)) {
    if (!isInSupportMode(req)) return false;
    return req.session.supportSchoolId === schoolId;
  }
  const user = await storage.getUserById(req.session.userId);
  if (!user || user.status !== "active") return false;
  const context = getActiveRequestContext(req);
  if (context === "school_admin" || context === "admin") return user.schoolId === schoolId;
  if (context === "it_personnel") {
    if (user.schoolId !== schoolId) return false;
    const permSet = await getBrandingPermissionSet(user.id);
    return permSet.has(BRANDING_VIEW_PERMISSION) || permSet.has(BRANDING_MANAGE_PERMISSION);
  }
  return user.schoolId === schoolId;
}

export async function canManageBranding(req: Request, schoolId: string): Promise<boolean> {
  if (!req.session.userId) return false;
  if (isPlatformOwnerRole(req.session.role)) {
    if (!isInSupportMode(req)) return false;
    return req.session.supportSchoolId === schoolId;
  }
  const user = await storage.getUserById(req.session.userId);
  if (!user || user.status !== "active") return false;
  const context = getActiveRequestContext(req);
  if ((context === "school_admin" || context === "admin") && user.schoolId === schoolId) return true;
  if (context === "it_personnel" && user.schoolId === schoolId) {
    const permSet = await getBrandingPermissionSet(user.id);
    return permSet.has(BRANDING_MANAGE_PERMISSION);
  }
  return false;
}

export async function canManageBrandingOperation(
  req: Request,
  schoolId: string,
  requiredPermission: string,
): Promise<boolean> {
  if (!req.session.userId) return false;
  if (isPlatformOwnerRole(req.session.role)) return canManageBranding(req, schoolId);
  const user = await storage.getUserById(req.session.userId);
  if (!user || user.status !== "active") return false;
  const context = getActiveRequestContext(req);
  if ((context === "school_admin" || context === "admin") && user.schoolId === schoolId) return true;
  if (context === "it_personnel" && user.schoolId === schoolId) {
    const permSet = await getBrandingPermissionSet(user.id);
    if (!permSet.has(BRANDING_MANAGE_PERMISSION)) return false;
    return permSet.has(requiredPermission) || requiredPermission === BRANDING_MANAGE_PERMISSION;
  }
  return false;
}

export async function resolveTenantBranding(schoolId: string) {
  const school = await storage.getSchoolById(schoolId);
  if (!school) return null;
  const branding = await storage.getSchoolBranding(schoolId);
  return { school, branding, brandingResponse: buildBrandingResponse(branding, school.name) };
}

// ─── Admin formatting helpers ──────────────────────────────────────────────────

export function roleBadge(role: string): string {
  const normalized = resolveRole(role);
  if (isPlatformOwnerRole(normalized)) return "platform_owner";
  if (normalized === "school_admin") return "school_admin";
  return normalized;
}

export function formatUserForAdmin(user: any, extras?: Record<string, unknown>) {
  const { passwordHash, ...safe } = user;
  return { ...safe, role: roleBadge(user.role), ...(extras || {}) };
}

// ─── School setup state ────────────────────────────────────────────────────────

export const SCHOOL_SETUP_STEP_LABELS: Record<string, string> = {
  schoolProfileComplete: "School profile complete",
  brandingDesignConfigured: "Branding & design configured",
  classesCreated: "Classes created",
  booksAdded: "Books added",
  bookLevelsCreated: "Book levels created",
  bookLevelsAssignedToClasses: "Book levels assigned to classes",
  studentsAdded: "Students added",
  parentCodesGenerated: "Parent codes generated",
  parentsLinked: "Parents linked",
  paymentSetupReviewed: "Payment setup reviewed",
  operationalSetupComplete: "Operational setup complete",
};

export async function getSchoolSetupState(schoolId: string) {
  const [school, users, classes, books, bookLevels, classBookLevels, students, linkingCodes, payments, branding] = await Promise.all([
    storage.getSchoolById(schoolId),
    storage.getUsers(schoolId), // scoped: avoids full platform user table scan
    storage.getClasses(schoolId),
    storage.getBooks(schoolId),
    storage.getBookLevels(schoolId),
    storage.getClassBookLevels(schoolId),
    storage.getStudents(schoolId),
    storage.getLinkingCodes(schoolId),
    storage.getPayments(undefined, schoolId),
    storage.getSchoolBranding(schoolId),
  ]);
  if (!school) return null;

  const schoolUsers = users.filter((u) => u.schoolId === schoolId);
  const activeSchoolAdmins = schoolUsers.filter((u) => resolveRole(u.role) === "school_admin" && u.status === "active");
  const teachers = schoolUsers.filter((u) => resolveRole(u.role) === "teacher" && u.status === "active");
  const setupStatus = normalizeSchoolSetupStatus(school.setupStatus as string | null | undefined, school.status);

  const schoolProfileComplete = !!(school.name && school.code);
  const brandingSetupStatus = branding?.setupStatus || "pending";
  const brandingDesignConfigured = brandingSetupStatus === "completed" || brandingSetupStatus === "skipped";
  const classesCreated = schoolProfileComplete && classes.length > 0;
  const booksAdded = books.length > 0;
  const bookLevelsCreated = bookLevels.length > 0;
  const bookLevelsAssignedToClasses = classBookLevels.length > 0;
  const studentsAdded = students.length > 0;
  const parentCodesGenerated = linkingCodes.length > 0;
  const parentsLinked = linkingCodes.some((code) => code.isUsed);
  // Payment setup reviewed: true once core setup is done (classes, books, students, invites sent)
  // Does NOT require an actual payment — that would block new schools from ever completing setup
  const paymentSetupReviewed = classesCreated && booksAdded && bookLevelsAssignedToClasses && studentsAdded && parentCodesGenerated;
  const readyForOperationalCompletion = classesCreated && booksAdded && bookLevelsAssignedToClasses && studentsAdded && parentCodesGenerated;
  const operationalSetupComplete =
    readyForOperationalCompletion && COMPLETE_SETUP_STATUSES.has(setupStatus) && school.status === "active";

  const checklist = {
    schoolProfileComplete, brandingDesignConfigured, classesCreated, booksAdded, bookLevelsCreated,
    bookLevelsAssignedToClasses, studentsAdded, parentCodesGenerated, parentsLinked,
    paymentSetupReviewed, operationalSetupComplete,
  };

  const orderedStepKeys = [
    "schoolProfileComplete", "brandingDesignConfigured", "classesCreated", "booksAdded",
    "bookLevelsCreated", "bookLevelsAssignedToClasses", "studentsAdded", "parentCodesGenerated",
    "parentsLinked", "paymentSetupReviewed", "operationalSetupComplete",
  ];

  const missingStepKeys = orderedStepKeys.filter((key) => !(checklist as any)[key]);
  const missingSteps = missingStepKeys.map((key) => SCHOOL_SETUP_STEP_LABELS[key] || key);

  return {
    school, setupStatus, schoolUsers, activeSchoolAdmins, teachers,
    counts: {
      classes: classes.length, books: books.length, bookLevels: bookLevels.length,
      classBookLevels: classBookLevels.length, students: students.length,
      linkingCodes: linkingCodes.length,
      linkedParents: linkingCodes.filter((c) => c.isUsed).length,
      payments: payments.length,
      verifiedPayments: payments.filter((p) => p.status === "completed" || p.status === "confirmed").length,
      pendingPayments: payments.filter((p) => ["pending", "awaiting_reference", "reference_submitted", "needs_review"].includes(p.status!)).length,
      brandingConfigured: brandingSetupStatus,
    },
    checklist, missingStepKeys, missingSteps,
    nextRecommendedAction: missingSteps[0] || "Setup complete. School is operational.",
    readyForOperationalCompletion, operationalSetupComplete,
    completionRules: [
      "Configure Branding & Design or mark it as skipped (recommended but optional).",
      "Create at least one class.",
      "Add at least one book.",
      "Create at least one book level.",
      "Assign at least one book level to a class.",
      "Add at least one student.",
      "Generate at least one parent linking code.",
      "Link at least one parent account.",
      "Record at least one payment submission to confirm payment setup.",
    ],
  };
}


// ─── Teacher class helper ─────────────────────────────────────────────────────
// Shared between book.routes.ts and allocation.routes.ts.
export async function getTeacherAssignedClasses(
  teacherUserId: string,
  schoolId?: string | null,
) {
  if (!schoolId) return [];
  const scopedClasses = await storage.getClasses(schoolId);
  const assignedById = new Map(
    scopedClasses
      .filter((cls) => cls.teacherId === teacherUserId)
      .map((cls) => [cls.id, cls]),
  );
  const schoolStudents = await storage.getStudents(schoolId);
  const schoolStudentClassIds = new Set(
    schoolStudents
      .map((student) => student.classId)
      .filter((classId): classId is string => !!classId),
  );
  const missingClassIds = Array.from(schoolStudentClassIds).filter((classId) => !assignedById.has(classId));
  if (missingClassIds.length > 0) {
    const allClasses = await storage.getClasses();
    for (const cls of allClasses) {
      if (!schoolStudentClassIds.has(cls.id)) continue;
      if (cls.teacherId !== teacherUserId) continue;
      assignedById.set(cls.id, cls);
    }
  }
  return Array.from(assignedById.values());
}

// ─── Scoped user helpers ───────────────────────────────────────────────────────

export async function getScopedAdminUsers(req: Request): Promise<any[]> {
  if (isPlatformOwnerRequest(req)) {
    const schoolFilter = typeof req.query.schoolId === "string" ? req.query.schoolId : null;
    // Pass schoolFilter to getUsers() so the DB does the filtering, not JS.
    const users = await storage.getUsers(schoolFilter ?? undefined);
    return users;
  }
  const sid = sessionSchoolId(req);
  if (!sid) {
    // No school context — return unassigned non-platform users only.
    const allUsers = await storage.getUsers();
    return allUsers.filter((u) => !isPlatformOwnerRole(u.role) && !u.schoolId);
  }

  // Scoped query: only fetch users belonging to this school.
  const scoped = await storage.getUsers(sid);
  // Additionally pull parent users from other schools who are linked to this school.
  const allUsers = await storage.getUsers();
  const parentUsers = allUsers.filter((u) => resolveRole(u.role) === "parent" && !!u.email && u.schoolId !== sid);
  const linkingCodes = await storage.getLinkingCodes(sid);
  const linkedParentEmails = new Set(
    linkingCodes.map((c) => normalizeEmail(c.parentEmail)).filter((e): e is string => !!e),
  );

  const additionalParents: any[] = [];
  for (const parent of parentUsers) {
    const parentEmail = normalizeEmail(parent.email);
    if (!parentEmail) continue;
    if (scoped.some((u) => u.id === parent.id)) continue;
    if (linkedParentEmails.has(parentEmail)) { additionalParents.push(parent); continue; }
    const links = await storage.getParentChildren(parent.email!);
    const belongsToSchool = links.some((link) => link.student?.schoolId === sid);
    if (belongsToSchool) additionalParents.push(parent);
  }
  return [...scoped, ...additionalParents];
}

export async function canManageUser(req: Request, targetUser: any): Promise<boolean> {
  if (isPlatformOwnerRequest(req)) {
    if (!isInSupportMode(req) || !req.session.supportSchoolId) return false;
    if (isPlatformOwnerRole(targetUser.role)) return false;
    return targetUser.schoolId === req.session.supportSchoolId;
  }
  if (isPlatformOwnerRole(targetUser.role)) return false;
  const sid = sessionSchoolId(req);
  if (!sid) return !targetUser.schoolId;
  if (targetUser.schoolId === sid) return true;
  if (resolveRole(targetUser.role) !== "parent") return false;
  const email = normalizeEmail(targetUser.email);
  if (!email) return false;
  const linkingCodes = await storage.getLinkingCodes(sid);
  if (linkingCodes.some((code) => normalizeEmail(code.parentEmail) === email)) return true;
  const children = await storage.getParentChildren(targetUser.email);
  return children.some((child) => child.student?.schoolId === sid);
}

export function enforceRoleUpdateGuards(req: Request, targetUser: any, nextRole: string | undefined): string | null {
  if (!nextRole || nextRole === targetUser.role) return null;
  if (req.session.userId === targetUser.id) return "You cannot change your own admin role.";
  const requesterIsOwner = isPlatformOwnerRequest(req);
  const currentRole = resolveRole(targetUser.role);
  const requestedRole = resolveRole(nextRole);
  const protectedAdminRoles = new Set(["admin", "school_admin", "platform_admin", "owner", "platform_owner"]);
  if (isPlatformOwnerRole(currentRole)) return "Platform owner role changes are blocked from the standard dashboard workflow.";
  if (isPlatformOwnerRole(requestedRole)) {
    return requesterIsOwner
      ? "Platform owner role assignment is blocked from the standard dashboard workflow."
      : "Only platform owners can manage platform-level roles.";
  }
  if (!requesterIsOwner) return "Role changes are restricted. Use protected owner workflows.";
  if (protectedAdminRoles.has(currentRole)) return "Admin role changes are restricted. Use protected admin provisioning workflows.";
  if (["parent", "teacher", "student"].includes(requestedRole)) return "Role changes to parent/teacher/student are restricted. Use onboarding or invite workflows.";
  return null;
}
