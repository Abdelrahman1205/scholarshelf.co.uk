import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import multer from "multer";
import { storage, getStorageMode } from "./storage.js";
import { createExternalPayment, verifyWebhookSignature, isExternalIntegrationEnabled } from "./paymentIntegration.js";
import {
  BRANDING_UPLOAD_MAX_BYTES,
  brandingFileFilter,
  buildBrandingResponse,
  getBrandingFieldColumns,
  normalizeFontPreference,
  normalizeHexColour,
  normalizeThemeName,
  storeBrandingImage,
  type BrandingUploadField,
} from "./branding.js";
import {
  sendInviteEmail,
  sendSchoolSetupInviteEmail,
  sendPasswordResetEmail,
  sendParentCodeEmail,
  sendPaymentSubmittedEmail,
  sendPaymentVerifiedEmail,
  sendPaymentRejectedEmail,
  isResendConfigured,
} from "./email.js";
import {
  signInSchema, signUpParentSchema, acceptInviteSchema,
  forgotPasswordSchema, resetPasswordSchema,
  LEGACY_ROLE_MAP, USER_ROLES, BRANDING_PERMISSIONS,
} from "../shared/schema.js";

function generateLinkingCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 7; i++) {
    if (i === 3) code += "-";
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function generatePaymentReference(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `EDU-${ts}-${rand}`;
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  (async () => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const allowed = await ensureSessionSchoolIsActive(req, res);
    if (!allowed) return;
    next();
  })().catch((error) => {
    console.error("Auth guard failure:", error);
    res.status(500).json({ message: "Authentication failed" });
  });
}

function requireRole(...roles: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const allowed = await ensureSessionSchoolIsActive(req, res);
    if (!allowed) return;
    const currentContext = getActiveRequestContext(req);
    if (!roles.includes(currentContext)) {
      return res.status(403).json({ message: "Access denied" });
    }
    next();
  };
}

function routeParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function splitInviteToken(token: string): { inviteId: string; rawToken: string } | null {
  const dotIndex = token.indexOf(".");
  if (dotIndex === -1) return null;
  return {
    inviteId: token.substring(0, dotIndex),
    rawToken: token.substring(dotIndex + 1),
  };
}

async function ensureSessionSchoolIsActive(req: Request, res: Response): Promise<boolean> {
  if (!req.session.userId) return false;

  const sessionRole = resolveRole(req.session.role || "");
  if (isPlatformOwnerRole(sessionRole)) {
    return true;
  }

  const schoolId = sessionSchoolId(req);
  if (!schoolId) {
    return true;
  }

  const school = await storage.getSchoolById(schoolId);
  if (!school) {
    req.session.destroy(() => {});
    res.clearCookie("connect.sid");
    return res.status(401).json({ message: "School account is not correctly configured" }) as any;
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
    return res.status(403).json({ message: inactiveMsg, schoolStatus: school.status }) as any;
  }

  return true;
}

const COMPLETE_SETUP_STATUSES = new Set(["operational_setup_complete", "complete", "active"]);

function normalizeSchoolSetupStatus(status: string | null | undefined, schoolStatus: string | null | undefined): string {
  if (status && status.trim()) return status;
  if (schoolStatus === "active") return "active";
  return "pending_admin_invite";
}

function deriveInviteStatus(invite: { status: string; expiresAt: Date } | null | undefined): string {
  if (!invite) return "not_invited";
  if (invite.status === "pending" && new Date(invite.expiresAt).getTime() < Date.now()) {
    return "expired";
  }
  return invite.status;
}

function setupMilestonesFromState(input: {
  schoolStatus: string | null | undefined;
  setupStatus: string | null | undefined;
  firstAdminInviteStatus: string;
  hasActiveSchoolAdmin: boolean;
}) {
  const schoolStatus = input.schoolStatus || "pending_setup";
  const setupStatus = normalizeSchoolSetupStatus(input.setupStatus, schoolStatus);
  const schoolCreated = true;
  const firstAdminInvited = input.firstAdminInviteStatus !== "not_invited";
  const firstAdminAccepted = input.firstAdminInviteStatus === "accepted" || input.hasActiveSchoolAdmin;
  const operationalSetupStarted = ["admin_accepted", "operational_setup_in_progress", "operational_setup_complete", "complete", "active"].includes(setupStatus);
  const operationalSetupCompleted = COMPLETE_SETUP_STATUSES.has(setupStatus);
  const schoolActive = schoolStatus === "active";

  return {
    schoolCreated,
    firstAdminInvited,
    firstAdminAccepted,
    schoolAdminAccountActive: input.hasActiveSchoolAdmin,
    operationalSetupStarted,
    operationalSetupCompleted,
    schoolActive,
  };
}

function nextOwnerAction(setupStatus: string, inviteStatus: string, schoolStatus: string): string {
  if (inviteStatus === "not_invited" || setupStatus === "pending_admin_invite" || setupStatus === "school_created") {
    return "Invite First Admin";
  }
  if (inviteStatus === "pending" || setupStatus === "pending_admin_acceptance") {
    return "Resend Invite";
  }
  if (inviteStatus === "expired") {
    return "Generate New Invite";
  }
  if (inviteStatus === "accepted" && !COMPLETE_SETUP_STATUSES.has(setupStatus)) {
    return "View Setup Status";
  }
  if (COMPLETE_SETUP_STATUSES.has(setupStatus) && schoolStatus !== "active") {
    return "Activate School";
  }
  return "Enter Support Mode";
}

async function resolveInviteByToken(token: string) {
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

async function acceptInviteToken(req: Request, res: Response, token: string, name: string, username: string, password: string) {
  const resolved = await resolveInviteByToken(token);
  if ("error" in resolved) {
    return res.status(400).json({ message: resolved.error });
  }

  const { invite } = resolved;
  const existingUsername = await storage.getUserByUsername(username);
  if (existingUsername) {
    return res.status(409).json({ message: "Username is already taken" });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await storage.createUser({
    username,
    passwordHash,
    name,
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

  req.session.regenerate((err) => {
    if (err) {
      buildAuthUserResponse(req, user).then((response) => res.status(201).json(response)).catch(() => res.status(201).json(safeUser(user)));
      return;
    }
    req.session.userId = user.id;
    req.session.role = user.role;
    req.session.activeContext = resolveRole(user.role);
    req.session.schoolId = user.schoolId;
    buildAuthUserResponse(req, user).then((response) => res.status(201).json(response)).catch(() => res.status(201).json(safeUser(user)));
  });

  return { invite, user };
}

function isDbUnavailableError(error: unknown): boolean {
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

// Extract the session schoolId — returns string or null
// When null, storage methods return all data (owner/demo mode)
// When owner is in support mode, returns the support school context
function sessionSchoolId(req: Request): string | null {
  if (isPlatformOwnerRole(req.session.role)) {
    // Support mode: owner is operating inside a specific school
    if (req.session.supportSchoolId) {
      return req.session.supportSchoolId;
    }
    return null;
  }
  return req.session.schoolId ?? null;
}

// Check if the current request is in support mode
function isInSupportMode(req: Request): boolean {
  return isPlatformOwnerRole(req.session.role) && !!req.session.supportSchoolId;
}

// Simple in-memory rate limiter for auth endpoints
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();
function rateLimit(key: string, maxAttempts: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = rateLimitStore.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  entry.count++;
  if (entry.count > maxAttempts) return true;
  return false;
}

// Audit log helper
async function auditLog(req: Request, action: string, target?: string, metadata?: Record<string, unknown>) {
  try {
    await storage.createAuditLog({
      userId: req.session?.userId || null,
      action,
      target: target || null,
      metadata: metadata ? JSON.stringify(metadata) : null,
      ipAddress: (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket?.remoteAddress || null,
      userAgent: (req.headers["user-agent"] as string) || null,
    });
  } catch (e) {
    console.error("Audit log failed:", e);
  }
}

// Resolve role — supports legacy "admin" → "school_admin" mapping
function resolveRole(role: string): string {
  return LEGACY_ROLE_MAP[role] || role;
}

const PLATFORM_OWNER_ROLES = ["owner", "platform_admin"];
const ADMIN_UI_ROLES = ["admin", "school_admin", ...PLATFORM_OWNER_ROLES];
const FINANCE_ROLES = [...ADMIN_UI_ROLES, "finance"] as const;
const BRANDING_VIEW_PERMISSION = "BRANDING_VIEW";
const BRANDING_MANAGE_PERMISSION = "BRANDING_MANAGE";
const BRANDING_UPLOAD_LOGO_PERMISSION = "BRANDING_UPLOAD_LOGO";
const BRANDING_UPDATE_THEME_PERMISSION = "BRANDING_UPDATE_THEME";
const BRANDING_RESET_DEFAULT_PERMISSION = "BRANDING_RESET_DEFAULT";
const CONTEXT_DEFAULT_PATHS: Record<string, string> = {
  owner: "/admin/owner",
  platform_admin: "/admin/owner",
  school_admin: "/admin",
  admin: "/admin",
  teacher: "/teacher",
  parent: "/parent",
  finance: "/finance",
};

const brandingUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: BRANDING_UPLOAD_MAX_BYTES,
    files: 1,
  },
  fileFilter: brandingFileFilter,
});

function extractSupportReason(req: Request): string | null {
  const fromBody = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
  const fromQuery = typeof req.query?.reason === "string" ? req.query.reason.trim() : "";
  return fromBody || fromQuery || null;
}

async function getBrandingPermissionSet(userId: string): Promise<Set<string>> {
  const permissions = await storage.getUserPermissions(userId);
  return new Set(permissions.filter((permission) => BRANDING_PERMISSIONS.includes(permission as any)));
}

async function canViewBranding(req: Request, schoolId: string): Promise<boolean> {
  if (!req.session.userId) return false;
  if (isPlatformOwnerRole(req.session.role)) {
    if (!isInSupportMode(req)) return false;
    return req.session.supportSchoolId === schoolId;
  }

  const user = await storage.getUserById(req.session.userId);
  if (!user || user.status !== "active") return false;
  const context = getActiveRequestContext(req);
  if (context === "school_admin" || context === "admin") {
    return user.schoolId === schoolId;
  }
  if (context === "it_personnel") {
    if (user.schoolId !== schoolId) return false;
    const permissionSet = await getBrandingPermissionSet(user.id);
    return permissionSet.has(BRANDING_VIEW_PERMISSION) || permissionSet.has(BRANDING_MANAGE_PERMISSION);
  }

  return user.schoolId === schoolId;
}

async function canManageBranding(req: Request, schoolId: string): Promise<boolean> {
  if (!req.session.userId) return false;

  if (isPlatformOwnerRole(req.session.role)) {
    if (!isInSupportMode(req)) return false;
    return req.session.supportSchoolId === schoolId;
  }

  const user = await storage.getUserById(req.session.userId);
  if (!user || user.status !== "active") return false;
  const context = getActiveRequestContext(req);
  if ((context === "school_admin" || context === "admin") && user.schoolId === schoolId) {
    return true;
  }
  if (context === "it_personnel" && user.schoolId === schoolId) {
    const permissionSet = await getBrandingPermissionSet(user.id);
    return permissionSet.has(BRANDING_MANAGE_PERMISSION);
  }
  return false;
}

async function canManageBrandingOperation(req: Request, schoolId: string, requiredPermission: string): Promise<boolean> {
  if (!req.session.userId) return false;
  if (isPlatformOwnerRole(req.session.role)) {
    return canManageBranding(req, schoolId);
  }

  const user = await storage.getUserById(req.session.userId);
  if (!user || user.status !== "active") return false;
  const context = getActiveRequestContext(req);
  if ((context === "school_admin" || context === "admin") && user.schoolId === schoolId) return true;

  if (context === "it_personnel" && user.schoolId === schoolId) {
    const permissionSet = await getBrandingPermissionSet(user.id);
    if (!permissionSet.has(BRANDING_MANAGE_PERMISSION)) return false;
    return permissionSet.has(requiredPermission) || requiredPermission === BRANDING_MANAGE_PERMISSION;
  }
  return false;
}

async function resolveTenantBranding(schoolId: string) {
  const school = await storage.getSchoolById(schoolId);
  if (!school) return null;
  const branding = await storage.getSchoolBranding(schoolId);
  return {
    school,
    branding,
    brandingResponse: buildBrandingResponse(branding, school.name),
  };
}

function runSingleBrandingUpload(req: Request, res: Response): Promise<void> {
  return new Promise((resolve, reject) => {
    brandingUpload.single("file")(req as any, res as any, (error: unknown) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

function isPlatformOwnerRole(role: string | null | undefined): boolean {
  if (!role) return false;
  const normalized = resolveRole(role);
  return PLATFORM_OWNER_ROLES.includes(normalized);
}

function getActiveRequestContext(req: Request): string {
  return resolveRole(req.session.activeContext || req.session.role || "");
}

function isPlatformOwnerRequest(req: Request): boolean {
  return isPlatformOwnerRole(req.session.role);
}

// Safe user response — strips passwordHash
function safeUser(user: { id: string; username: string; name: string; role: string; email: string | null; status: string; schoolId: string | null }) {
  return { id: user.id, username: user.username, name: user.name, role: user.role, email: user.email, status: user.status, schoolId: user.schoolId };
}

async function getUserAccessProfile(user: { id: string; role: string; email: string | null; schoolId: string | null }) {
  const contexts = new Map<string, { key: string; label: string; defaultPath: string }>();
  const primaryRole = resolveRole(user.role);
  const normalizedEmail = normalizeEmail(user.email);
  const assignedClassIds: string[] = [];
  const linkedStudentIds: string[] = [];

  const addContext = (key: string) => {
    const normalizedKey = resolveRole(key);
    if (!normalizedKey || contexts.has(normalizedKey)) return;
    const label = normalizedKey === "school_admin"
      ? "School Admin"
      : normalizedKey === "platform_admin"
        ? "Platform Admin"
        : normalizedKey.charAt(0).toUpperCase() + normalizedKey.slice(1).replace(/_/g, " ");
    contexts.set(normalizedKey, {
      key: normalizedKey,
      label,
      defaultPath: CONTEXT_DEFAULT_PATHS[normalizedKey] || "/login",
    });
  };

  addContext(primaryRole);

  // Check explicit secondary role grants (admin-assigned via user_permissions)
  const secondaryRoles = await storage.getSecondaryRoles(user.id);
  for (const role of secondaryRoles) {
    addContext(role);
  }

  if (normalizedEmail) {
    const parentLinks = await storage.getParentChildren(user.email!);
    for (const link of parentLinks) {
      if (!user.schoolId || link.student?.schoolId === user.schoolId) {
        if (link.studentId) linkedStudentIds.push(link.studentId);
      }
    }

    const linkingCodes = user.schoolId ? await storage.getLinkingCodes(user.schoolId) : await storage.getLinkingCodes();
    const hasPendingParentLink = linkingCodes.some((code) => normalizeEmail(code.parentEmail) === normalizedEmail);
    if (primaryRole === "parent" || linkedStudentIds.length > 0 || hasPendingParentLink) {
      addContext("parent");
    }
  }

  if (user.schoolId) {
    const classes = await storage.getClasses(user.schoolId);
    for (const cls of classes) {
      if (cls.teacherId === user.id) assignedClassIds.push(cls.id);
    }
  }

  if (primaryRole === "teacher" || assignedClassIds.length > 0) {
    addContext("teacher");
  }

  return {
    primaryRole,
    contexts: Array.from(contexts.values()),
    assignedClassIds,
    linkedStudentIds: Array.from(new Set(linkedStudentIds)),
  };
}

async function syncSessionActiveContext(req: Request, user: { id: string; role: string; email: string | null; schoolId: string | null }, preferredContext?: string | null) {
  const profile = await getUserAccessProfile(user);
  const availableKeys = profile.contexts.map((context) => context.key);
  const desired = resolveRole(preferredContext || req.session.activeContext || profile.primaryRole);
  req.session.activeContext = availableKeys.includes(desired) ? desired : (availableKeys[0] || profile.primaryRole);
  return { profile, activeContext: req.session.activeContext };
}

async function buildAuthUserResponse(req: Request, user: { id: string; username: string; name: string; role: string; email: string | null; status: string; schoolId: string | null }) {
  const base = safeUser(user) as any;
  const school = user.schoolId ? await storage.getSchoolById(user.schoolId) : null;
  const { profile, activeContext } = await syncSessionActiveContext(req, user);
  base.primaryRole = profile.primaryRole;
  base.role = activeContext;
  base.activeContext = activeContext;
  base.schoolName = school?.name || null;
  base.schoolCode = school?.code || null;
  base.availableContexts = profile.contexts;
  base.contextMetadata = {
    assignedClassIds: profile.assignedClassIds,
    linkedStudentIds: profile.linkedStudentIds,
  };
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

function getPublicBaseUrl(req: Request): string {
  const configured = process.env.APP_BASE_URL || process.env.PUBLIC_APP_URL;
  if (configured) {
    return configured.replace(/\/$/, "");
  }

  const forwardedProto = (req.headers["x-forwarded-proto"] as string | undefined)?.split(",")[0]?.trim();
  const forwardedHost = (req.headers["x-forwarded-host"] as string | undefined)?.split(",")[0]?.trim();
  const protocol = forwardedProto || req.protocol;
  const host = forwardedHost || req.get("host") || "localhost:5000";
  return `${protocol}://${host}`;
}

function toEmailSafeLogoUrl(req: Request, schoolCode: string | null | undefined, rawLogoUrl: string | null | undefined): string | null {
  if (!rawLogoUrl) return null;

  if (rawLogoUrl.startsWith("data:")) {
    if (!schoolCode) return null;
    return `${getPublicBaseUrl(req)}/api/public/schools/${encodeURIComponent(schoolCode)}/email-logo`;
  }

  if (rawLogoUrl.startsWith("/")) {
    return `${getPublicBaseUrl(req)}${rawLogoUrl}`;
  }

  return rawLogoUrl;
}

function parseDataUriImage(dataUri: string): { mimeType: string; buffer: Buffer } | null {
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(dataUri);
  if (!match) return null;
  try {
    return {
      mimeType: match[1],
      buffer: Buffer.from(match[2], "base64"),
    };
  } catch {
    return null;
  }
}

type EmailBrandingPayload = {
  schoolName?: string | null;
  logoUrl?: string | null;
  primaryColour?: string | null;
  secondaryColour?: string | null;
};

async function getEmailBrandingForSchool(req: Request, schoolId: string | null | undefined): Promise<EmailBrandingPayload | undefined> {
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

function normalizeEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  return email.trim().toLowerCase();
}

function normalizeSchoolCode(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, "-");
}

function roleBadge(role: string): string {
  const normalized = resolveRole(role);
  if (isPlatformOwnerRole(normalized)) return "platform_owner";
  if (normalized === "school_admin") return "school_admin";
  return normalized;
}

function formatUserForAdmin(user: any, extras?: Record<string, unknown>) {
  const { passwordHash, ...safe } = user;
  return {
    ...safe,
    role: roleBadge(user.role),
    ...(extras || {}),
  };
}

const SCHOOL_SETUP_STEP_LABELS: Record<string, string> = {
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

async function getSchoolSetupState(schoolId: string) {
  const [school, users, classes, books, bookLevels, classBookLevels, students, linkingCodes, payments, branding] = await Promise.all([
    storage.getSchoolById(schoolId),
    storage.getUsers(),
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

  const schoolUsers = users.filter((user) => user.schoolId === schoolId);
  const activeSchoolAdmins = schoolUsers.filter((user) => resolveRole(user.role) === "school_admin" && user.status === "active");
  const teachers = schoolUsers.filter((user) => resolveRole(user.role) === "teacher" && user.status === "active");
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
  const paymentSetupReviewed = payments.length > 0;
  const readyForOperationalCompletion = paymentSetupReviewed;
  const operationalSetupComplete =
    readyForOperationalCompletion && COMPLETE_SETUP_STATUSES.has(setupStatus) && school.status === "active";

  const checklist = {
    schoolProfileComplete,
    brandingDesignConfigured,
    classesCreated,
    booksAdded,
    bookLevelsCreated,
    bookLevelsAssignedToClasses,
    studentsAdded,
    parentCodesGenerated,
    parentsLinked,
    paymentSetupReviewed,
    operationalSetupComplete,
  };

  const orderedStepKeys = [
    "schoolProfileComplete",
    "brandingDesignConfigured",
    "classesCreated",
    "booksAdded",
    "bookLevelsCreated",
    "bookLevelsAssignedToClasses",
    "studentsAdded",
    "parentCodesGenerated",
    "parentsLinked",
    "paymentSetupReviewed",
    "operationalSetupComplete",
  ];

  const missingStepKeys = orderedStepKeys.filter((key) => !(checklist as any)[key]);
  const missingSteps = missingStepKeys.map((key) => SCHOOL_SETUP_STEP_LABELS[key] || key);

  const nextRecommendedAction =
    missingSteps[0] || "Setup complete. School is operational.";

  return {
    school,
    setupStatus,
    schoolUsers,
    activeSchoolAdmins,
    teachers,
    counts: {
      classes: classes.length,
      books: books.length,
      bookLevels: bookLevels.length,
      classBookLevels: classBookLevels.length,
      students: students.length,
      linkingCodes: linkingCodes.length,
      linkedParents: linkingCodes.filter((code) => code.isUsed).length,
      payments: payments.length,
      verifiedPayments: payments.filter((payment) => payment.status === "completed" || payment.status === "confirmed").length,
      pendingPayments: payments.filter((payment) => ["pending", "awaiting_reference", "reference_submitted", "needs_review"].includes(payment.status!)).length,
      brandingConfigured: brandingSetupStatus,
    },
    checklist,
    missingStepKeys,
    missingSteps,
    nextRecommendedAction,
    readyForOperationalCompletion,
    operationalSetupComplete,
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

async function getScopedAdminUsers(req: Request): Promise<any[]> {
  if (isPlatformOwnerRequest(req)) {
    const schoolFilter = typeof req.query.schoolId === "string" ? req.query.schoolId : null;
    const users = await storage.getUsers();
    if (!schoolFilter) return users;
    return users.filter((u) => u.schoolId === schoolFilter);
  }

  const sid = sessionSchoolId(req);
  const allUsers = await storage.getUsers();
  if (!sid) {
    return allUsers.filter((u) => !isPlatformOwnerRole(u.role) && !u.schoolId);
  }

  const scoped = allUsers.filter((u) => u.schoolId === sid);
  const parentUsers = allUsers.filter((u) => resolveRole(u.role) === "parent" && !!u.email);
  const linkingCodes = await storage.getLinkingCodes(sid);
  const linkedParentEmails = new Set(
    linkingCodes.map((c) => normalizeEmail(c.parentEmail)).filter((email): email is string => !!email)
  );

  const additionalParents: any[] = [];
  for (const parent of parentUsers) {
    const parentEmail = normalizeEmail(parent.email);
    if (!parentEmail) continue;
    if (scoped.some((u) => u.id === parent.id)) continue;
    if (linkedParentEmails.has(parentEmail)) {
      additionalParents.push(parent);
      continue;
    }

    const links = await storage.getParentChildren(parent.email!);
    const belongsToSchool = links.some((link) => link.student?.schoolId === sid);
    if (belongsToSchool) additionalParents.push(parent);
  }

  return [...scoped, ...additionalParents];
}

async function canManageUser(req: Request, targetUser: any): Promise<boolean> {
  if (isPlatformOwnerRequest(req)) {
    // Owner can only manage users while explicitly in support mode for a selected school.
    if (!isInSupportMode(req) || !req.session.supportSchoolId) return false;
    if (isPlatformOwnerRole(targetUser.role)) return false;
    return targetUser.schoolId === req.session.supportSchoolId;
  }

  if (isPlatformOwnerRole(targetUser.role)) return false;

  const sid = sessionSchoolId(req);
  if (!sid) {
    return !targetUser.schoolId;
  }
  if (targetUser.schoolId === sid) return true;

  if (resolveRole(targetUser.role) !== "parent") return false;
  const email = normalizeEmail(targetUser.email);
  if (!email) return false;

  const linkingCodes = await storage.getLinkingCodes(sid);
  if (linkingCodes.some((code) => normalizeEmail(code.parentEmail) === email)) {
    return true;
  }

  const children = await storage.getParentChildren(targetUser.email);
  return children.some((child) => child.student?.schoolId === sid);
}

function enforceRoleUpdateGuards(req: Request, targetUser: any, nextRole: string | undefined): string | null {
  if (!nextRole || nextRole === targetUser.role) return null;

  if (req.session.userId === targetUser.id) {
    return "You cannot change your own admin role.";
  }

  const requesterIsOwner = isPlatformOwnerRequest(req);
  const currentRole = resolveRole(targetUser.role);
  const requestedRole = resolveRole(nextRole);
  const protectedAdminRoles = new Set(["admin", "school_admin", "platform_admin", "owner", "platform_owner"]);

  if (isPlatformOwnerRole(currentRole)) {
    return "Platform owner role changes are blocked from the standard dashboard workflow.";
  }

  if (isPlatformOwnerRole(requestedRole)) {
    return requesterIsOwner
      ? "Platform owner role assignment is blocked from the standard dashboard workflow."
      : "Only platform owners can manage platform-level roles.";
  }

  if (!requesterIsOwner) {
    return "Role changes are restricted. Use protected owner workflows.";
  }

  if (protectedAdminRoles.has(currentRole)) {
    return "Admin role changes are restricted. Use protected admin provisioning workflows.";
  }

  if (["parent", "teacher", "student"].includes(requestedRole)) {
    return "Role changes to parent/teacher/student are restricted. Use onboarding or invite workflows.";
  }

  return null;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // === HEALTH ===

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

      const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket?.remoteAddress || "unknown";
      if (rateLimit(`signin:${ip}`, 10, 15 * 60 * 1000)) {
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

      req.session.regenerate((err) => {
        if (err) {
          console.error("Session regeneration failed:", err);
          return res.status(500).json({ message: "Login failed" });
        }
        req.session.userId = user.id;
        req.session.role = user.role;
        req.session.activeContext = resolveRole(user.role);
        req.session.schoolId = user.schoolId;

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

      const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket?.remoteAddress || "unknown";
      if (rateLimit(`signup:${ip}`, 5, 60 * 60 * 1000)) {
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

      req.session.regenerate((err) => {
        if (err) {
          buildAuthUserResponse(req, user).then((response) => res.status(201).json(response)).catch(() => res.status(201).json(safeUser(user)));
          return;
        }
        req.session.userId = user.id;
        req.session.role = user.role;
        req.session.activeContext = "parent";
        req.session.schoolId = null;
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
      await auditLog(req, "context_switched", `user:${user.id}`, { context: activeContext, availableContexts: profile.contexts.map((item) => item.key) });
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

      const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket?.remoteAddress || "unknown";
      if (rateLimit(`forgot:${ip}`, 3, 15 * 60 * 1000)) {
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

  app.post("/api/books", requireRole(...ADMIN_UI_ROLES), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      const book = await storage.createBook({ ...req.body, schoolId: sid });
      res.status(201).json(book);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.patch("/api/books/:id", requireRole(...ADMIN_UI_ROLES), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      const book = await storage.updateBook(routeParam(req.params.id), req.body, sid);
      if (!book) return res.status(404).json({ message: "Book not found" });
      res.json(book);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.delete("/api/books/:id", requireRole(...ADMIN_UI_ROLES), async (req, res) => {
    const sid = sessionSchoolId(req);
    await storage.deleteBook(routeParam(req.params.id), sid);
    res.status(204).send();
  });

  app.get("/api/books/low-stock", requireRole(...ADMIN_UI_ROLES), async (req, res) => {
    const sid = sessionSchoolId(req);
    const books = await storage.getLowStockBooks(sid);
    res.json(books);
  });

  app.get("/api/books/by-isbn/:isbn", requireAuth, async (req, res) => {
    const sid = sessionSchoolId(req);
    const book = await storage.getBookByIsbn(routeParam(req.params.isbn), sid);
    if (!book) return res.status(404).json({ message: "Book not found" });
    res.json(book);
  });

  // Scan book by barcode/bookCode
  app.get("/api/books/scan/:code", requireRole(...ADMIN_UI_ROLES, "teacher"), async (req, res) => {
    const sid = sessionSchoolId(req);
    const book = await storage.getBookByCode(routeParam(req.params.code), sid);
    if (!book) return res.status(404).json({ message: "Book not found for this code" });
    res.json(book);
  });

  // === INVENTORY (school-scoped) ===
  app.post("/api/books/:id/stock", requireRole(...ADMIN_UI_ROLES), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      const { quantity, type, reason } = req.body;
      const book = await storage.adjustStock(routeParam(req.params.id), quantity, type, reason, sid);
      res.json(book);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.get("/api/inventory-transactions", requireRole(...ADMIN_UI_ROLES), async (req, res) => {
    const sid = sessionSchoolId(req);
    const txns = await storage.getInventoryTransactions(sid);
    res.json(txns);
  });

  async function getTeacherAssignedClasses(teacherUserId: string, schoolId?: string | null) {
    if (!schoolId) return [];

    const scopedClasses = await storage.getClasses(schoolId);
    const assignedById = new Map(
      scopedClasses
        .filter((cls) => cls.teacherId === teacherUserId)
        .map((cls) => [cls.id, cls]),
    );

    // Fallback for legacy data where class rows may have mismatched school IDs.
    // We only allow classes that are actually referenced by students in this school.
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

  // === CLASSES (school-scoped) ===
  app.get("/api/classes", requireRole(...ADMIN_UI_ROLES, "teacher"), async (req, res) => {
    const sid = sessionSchoolId(req);
    if (getActiveRequestContext(req) === "teacher") {
      const classes = await getTeacherAssignedClasses(req.session.userId!, sid);
      return res.json(classes);
    }
    const classes = await storage.getClasses(sid);
    res.json(classes);
  });

  app.post("/api/classes", requireRole(...ADMIN_UI_ROLES), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      const cls = await storage.createClass({ ...req.body, schoolId: sid });
      res.status(201).json(cls);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.patch("/api/classes/:id", requireRole(...ADMIN_UI_ROLES), async (req, res) => {
    const sid = sessionSchoolId(req);
    const cls = await storage.updateClass(routeParam(req.params.id), req.body, sid);
    if (!cls) return res.status(404).json({ message: "Class not found" });
    res.json(cls);
  });

  app.delete("/api/classes/:id", requireRole(...ADMIN_UI_ROLES), async (req, res) => {
    const sid = sessionSchoolId(req);
    await storage.deleteClass(routeParam(req.params.id), sid);
    res.status(204).send();
  });

  // === STUDENTS (school-scoped) ===
  app.get("/api/students", requireRole(...ADMIN_UI_ROLES, "teacher"), async (req, res) => {
    const sid = sessionSchoolId(req);
    const includeArchived = req.query.includeArchived === "true";
    const students = await storage.getStudents(sid, includeArchived);
    if (getActiveRequestContext(req) === "teacher") {
      const classes = await getTeacherAssignedClasses(req.session.userId!, sid);
      const assignedClassIds = new Set(classes.filter((cls) => cls.teacherId === req.session.userId).map((cls) => cls.id));
      return res.json(students.filter((student) => student.classId && assignedClassIds.has(student.classId)));
    }
    res.json(students);
  });

  app.post("/api/students", requireRole(...ADMIN_UI_ROLES), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);

      if (sid) {
        const classes = await storage.getClasses(sid);
        if (classes.length === 0) {
          return res.status(409).json({ message: "Create at least one class before adding students." });
        }
      }

      const student = await storage.createStudent({ ...req.body, schoolId: sid });
      res.status(201).json(student);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.patch("/api/students/:id", requireRole(...ADMIN_UI_ROLES), async (req, res) => {
    const sid = sessionSchoolId(req);
    const student = await storage.updateStudent(routeParam(req.params.id), req.body, sid);
    if (!student) return res.status(404).json({ message: "Student not found" });
    res.json(student);
  });

  // Soft-delete (archive) a student — preserves allocation/payment history
  app.delete("/api/students/:id", requireRole(...ADMIN_UI_ROLES), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      const user = await storage.getUserById(req.session.userId!);
      await storage.archiveStudent(routeParam(req.params.id), user?.id ?? "system", sid);
      await auditLog(req, "student_archived", `student:${req.params.id}`);
      res.status(204).send();
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  // Restore an archived student
  app.post("/api/students/:id/unarchive", requireRole(...ADMIN_UI_ROLES), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      await storage.unarchiveStudent(routeParam(req.params.id), sid);
      await auditLog(req, "student_unarchived", `student:${req.params.id}`);
      res.status(204).send();
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  // === BOOK LEVELS (school-scoped) ===
  app.get("/api/book-levels", requireRole(...ADMIN_UI_ROLES), async (req, res) => {
    const sid = sessionSchoolId(req);
    const levels = await storage.getBookLevels(sid);
    res.json(levels);
  });

  app.post("/api/book-levels", requireRole(...ADMIN_UI_ROLES), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);

      if (sid) {
        const books = await storage.getBooks(sid);
        if (books.length === 0) {
          return res.status(409).json({ message: "Add books before creating book levels." });
        }
      }

      const level = await storage.createBookLevel({ ...req.body, schoolId: sid });
      res.status(201).json(level);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.patch("/api/book-levels/:id", requireRole(...ADMIN_UI_ROLES), async (req, res) => {
    const sid = sessionSchoolId(req);
    const level = await storage.updateBookLevel(routeParam(req.params.id), req.body, sid);
    if (!level) return res.status(404).json({ message: "Book level not found" });
    res.json(level);
  });

  app.delete("/api/book-levels/:id", requireRole(...ADMIN_UI_ROLES), async (req, res) => {
    const sid = sessionSchoolId(req);
    await storage.deleteBookLevel(routeParam(req.params.id), sid);
    res.status(204).send();
  });

  app.get("/api/book-levels/:id/items", requireRole(...ADMIN_UI_ROLES), async (req, res) => {
    const items = await storage.getBookLevelItems(routeParam(req.params.id));
    res.json(items);
  });

  app.post("/api/book-levels/:id/items", requireRole(...ADMIN_UI_ROLES), async (req, res) => {
    try {
      const item = await storage.addBookLevelItem({ ...req.body, bookLevelId: routeParam(req.params.id) });
      res.status(201).json(item);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.delete("/api/book-level-items/:id", requireRole(...ADMIN_UI_ROLES), async (req, res) => {
    await storage.removeBookLevelItem(routeParam(req.params.id));
    res.status(204).send();
  });

  // === CLASS BOOK LEVELS (school-scoped) ===
  app.get("/api/class-book-levels", requireRole(...ADMIN_UI_ROLES), async (req, res) => {
    const sid = sessionSchoolId(req);
    const cbls = await storage.getClassBookLevels(sid);
    res.json(cbls);
  });

  app.post("/api/class-book-levels", requireRole(...ADMIN_UI_ROLES), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      if (sid) {
        const setupState = await getSchoolSetupState(sid);
        if (!setupState) {
          return res.status(404).json({ message: "School not found" });
        }
        if (!setupState.checklist.bookLevelsCreated) {
          return res.status(409).json({ message: "Create book levels before assigning them to classes." });
        }
      }

      const cbl = await storage.assignClassBookLevel(req.body);
      res.status(201).json(cbl);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  // === LINKING CODES (school-scoped) ===
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

      if (nameIdx === -1) return res.status(400).json({ message: "CSV must have a 'name' column" });

      // Load classes for name → id resolution
      const classes = await storage.getClasses(sid);
      const classMap = new Map(classes.map((c: any) => [c.name.trim().toLowerCase(), c.id]));

      const rows: { name: string; className: string | null; classId: string | null; error: string | null; valid: boolean }[] = [];

      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
        const name = cols[nameIdx]?.trim() ?? "";
        if (!name) { rows.push({ name: "", className: null, classId: null, error: "Name is required", valid: false }); continue; }

        const className = classIdx !== -1 ? (cols[classIdx]?.trim() ?? null) : null;
        const classId = className ? (classMap.get(className.toLowerCase()) ?? null) : null;
        const classError = className && !classId ? `Class "${className}" not found` : null;

        rows.push({ name, className, classId, error: classError, valid: !classError });
      }

      const valid = rows.filter((r) => !r.error).length;
      const invalid = rows.length - valid;

      res.json({ rows, summary: { total: rows.length, valid, invalid } });
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  // POST /api/students/import/confirm — commit parsed rows (valid only)
  app.post("/api/students/import/confirm", requireRole(...ADMIN_UI_ROLES), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      const { rows } = req.body as { rows: { name: string; classId: string | null }[] };
      if (!Array.isArray(rows) || rows.length === 0) return res.status(400).json({ message: "rows array is required" });

      const created: any[] = [];
      const errors: { name: string; error: string }[] = [];

      for (const row of rows) {
        if (!row.name?.trim()) { errors.push({ name: row.name ?? "", error: "Name is required" }); continue; }
        try {
          const student = await storage.createStudent({ name: row.name.trim(), classId: row.classId ?? null, schoolId: sid ?? null });
          created.push(student);
        } catch (e: any) {
          errors.push({ name: row.name, error: e.message });
        }
      }

      await auditLog(req, "students_bulk_imported", `school:${sid}`, { count: created.length });

      res.status(201).json({ created: created.length, errors, students: created });
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  // === PARENT ENDPOINTS ===

  // Preview a link code — returns student info without creating the link
  // Spec §6.3: POST /api/parent/link-code/preview
  app.post("/api/parent/link-code/preview", requireRole("parent"), async (req, res) => {
    try {
      const { code } = req.body;
      if (!code?.trim()) return res.status(400).json({ message: "Link code is required" });
      const user = await storage.getUserById(req.session.userId!);
      if (!user?.email) return res.status(400).json({ message: "No email set for your account" });
      // Look up without consuming the code
      const linkingCode = await storage.getLinkingCodeByCode(code.trim().toUpperCase());
      if (!linkingCode) return res.status(404).json({ message: "Invalid linking code" });
      if (linkingCode.isUsed) return res.status(400).json({ message: "This linking code has already been used." });
      if (linkingCode.expiresAt && new Date(linkingCode.expiresAt) < new Date()) {
        return res.status(400).json({ message: "This linking code has expired. Please ask the school to generate a new one." });
      }
      if (linkingCode.parentEmail && linkingCode.parentEmail.trim().toLowerCase() !== user.email.trim().toLowerCase()) {
        return res.status(403).json({ message: "This linking code is not assigned to your email address." });
      }
      // Return safe preview — no PII beyond name
      const student = linkingCode.student;
      res.json({
        code: linkingCode.code,
        studentId: linkingCode.studentId,
        studentName: student?.name ?? "Unknown Student",
        studentCode: student?.studentCode ?? null,
        className: (linkingCode as any).class?.name ?? null,
      });
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  // Confirm a link code — creates the parent-student link
  // Spec §6.4: POST /api/parent/link-code/confirm
  app.post("/api/parent/link-code/confirm", requireRole("parent"), async (req, res) => {
    try {
      const { code } = req.body;
      const user = await storage.getUserById(req.session.userId!);
      if (!user?.email) return res.status(400).json({ message: "No email set for your account" });
      const result = await storage.useLinkingCode(code, user.email);
      if (!result) return res.status(404).json({ message: "Invalid linking code" });
      await auditLog(req, "parent_child_linked", `student:${result.student.id}`);
      res.json(result);
    } catch (e: any) {
      const msg = e.message || "Unknown error";
      if (msg.includes("not assigned to your email")) return res.status(403).json({ message: msg });
      res.status(400).json({ message: msg });
    }
  });

  // Legacy single-step link (kept for backward compat)
  app.post("/api/parent/link-child", requireRole("parent"), async (req, res) => {
    try {
      const { code } = req.body;
      const user = await storage.getUserById(req.session.userId!);
      if (!user?.email) return res.status(400).json({ message: "No email set for your account" });
      const result = await storage.useLinkingCode(code, user.email);
      if (!result) return res.status(404).json({ message: "Invalid linking code" });
      res.json(result);
    } catch (e: any) {
      // Map specific security errors to appropriate HTTP status codes
      const msg = e.message || "Unknown error";
      if (msg.includes("not assigned to your email")) {
        return res.status(403).json({ message: msg });
      }
      res.status(400).json({ message: msg });
    }
  });

  app.get("/api/parent/children", requireRole("parent"), async (req, res) => {
    const user = await storage.getUserById(req.session.userId!);
    if (!user?.email) return res.status(400).json({ message: "No email set for your account" });
    const children = await storage.getParentChildren(user.email);
    res.json(children);
  });

  // GET /api/parent/children/:id/books — Spec §7: book allocations for a linked child
  app.get("/api/parent/children/:id/books", requireRole("parent"), async (req, res) => {
    try {
      const user = await storage.getUserById(req.session.userId!);
      if (!user?.email) return res.status(400).json({ message: "No email set for your account" });

      const studentId = routeParam(req.params.id);

      // SECURITY: Verify the parent is linked to this student
      const children = await storage.getParentChildren(user.email);
      const isLinked = children.some((c) => c.studentId === studentId);
      if (!isLinked) {
        return res.status(403).json({ message: "You are not authorised to view books for this student" });
      }

      // Pull all allocations for this student (no schoolId filter — parent can see across any school they're linked to)
      const allocs = await storage.getAllocations(undefined, undefined);
      const studentAllocs = allocs.filter((a: any) => a.student?.id === studentId || a.studentId === studentId);

      const books = studentAllocs.map((a: any) => ({
        allocationId: a.id,
        bookTitle: a.book?.title ?? "Unknown",
        bookIsbn: a.book?.isbn ?? null,
        quantity: a.quantity ?? 1,
        unitPrice: a.book?.price ?? null,
        status: a.status ?? "allocated",
        paymentStatus: a.paymentStatus ?? null,
        allocatedAt: a.createdAt ?? null,
      }));

      res.json(books);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/parent/children/:id/basket", requireRole("parent"), async (req, res) => {
    try {
      const user = await storage.getUserById(req.session.userId!);
      if (!user?.email) return res.status(400).json({ message: "No email set for your account" });

      // SECURITY: Verify parent is linked to this student
      const studentId = routeParam(req.params.id);
      const children = await storage.getParentChildren(user.email);
      const isLinked = children.some(c => c.studentId === studentId);
      if (!isLinked) {
        return res.status(403).json({ message: "You are not authorised to create a basket for this student" });
      }

      const basket = await storage.generateBasket(studentId, user.email);
      res.status(201).json(basket);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.get("/api/parent/baskets", requireRole("parent"), async (req, res) => {
    const user = await storage.getUserById(req.session.userId!);
    if (!user?.email) return res.status(400).json({ message: "No email set for your account" });
    const baskets = await storage.getBaskets(user.email);
    res.json(baskets);
  });

  // POST /api/parent/payments — create order (awaiting external payment reference)
  app.post("/api/parent/payments", requireRole("parent"), async (req, res) => {
    try {
      const user = await storage.getUserById(req.session.userId!);
      if (!user?.email) return res.status(400).json({ message: "No email set for your account" });
      const { basketIds } = req.body;
      if (!basketIds || !Array.isArray(basketIds) || basketIds.length === 0) {
        return res.status(400).json({ message: "basketIds is required" });
      }
      const loadedBaskets = [];
      let total = 0;
      for (const id of basketIds) {
        const basket = await storage.getBasket(id);
        if (!basket) return res.status(404).json({ message: `Basket ${id} not found` });
        if (basket.parentIdentifier !== user.email) {
          return res.status(403).json({ message: "Access denied" });
        }
        loadedBaskets.push(basket);
        total += parseFloat(basket.totalAmount);
      }

      const reference = generatePaymentReference();

      // Derive schoolId from the first basket's student
      const firstStudent = loadedBaskets[0]?.student;
      const paymentSchoolId = firstStudent?.schoolId || loadedBaskets[0]?.schoolId || null;

      const payment = await storage.createPayment({
        parentIdentifier: user.email,
        totalAmount: total.toFixed(2),
        paymentMethod: "external_reference",
        paymentReference: reference,
        status: "awaiting_reference",
        schoolId: paymentSchoolId,
      }, basketIds);

      await storage.createAuditLog({
        action: "payment_order_created",
        userId: req.session.userId!,
        metadata: `Order created: ref=${reference}, amount=£${total.toFixed(2)}, baskets=${basketIds.length}`,
      });

      res.status(201).json(payment);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  // POST /api/parent/payments/:id/submit-reference — submit external payment reference
  app.post("/api/parent/payments/:id/submit-reference", requireRole("parent"), async (req, res) => {
    try {
      const user = await storage.getUserById(req.session.userId!);
      if (!user?.email) return res.status(400).json({ message: "No email set for your account" });

      const paymentId = routeParam(req.params.id);
      const { referenceNumber, confirmed, notes } = req.body;

      // Validate required fields
      if (!referenceNumber || typeof referenceNumber !== "string" || referenceNumber.trim().length < 3) {
        return res.status(400).json({ message: "A valid payment reference number is required (minimum 3 characters)." });
      }
      if (confirmed !== true) {
        return res.status(400).json({ message: "You must confirm that you have completed the payment." });
      }

      // Sanitise
      const cleanRef = referenceNumber.trim().toUpperCase();

      // Verify this payment belongs to the parent
      const existing = await storage.getPaymentById(paymentId);
      if (!existing) return res.status(404).json({ message: "Payment not found" });
      if (existing.parentIdentifier !== user.email) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Check for duplicate reference within the same school
      if (existing.schoolId) {
        const isDuplicate = await storage.isPaymentReferenceDuplicate(cleanRef, existing.schoolId, paymentId);
        if (isDuplicate) {
          return res.status(409).json({ message: "This payment reference has already been submitted for another order in this school." });
        }
      }

      const payment = await storage.submitPaymentReference(
        paymentId,
        cleanRef,
        req.session.userId!,
        notes?.trim() || undefined,
      );

      await storage.createAuditLog({
        action: "payment_reference_submitted",
        userId: req.session.userId!,
        metadata: `Reference submitted: ref=${cleanRef}, paymentId=${paymentId}`,
      });

      // Notify parent
      const submittedSent = await sendPaymentSubmittedEmail(
        user.email,
        payment.paymentReference || paymentId,
        payment.totalAmount || "0.00",
        "external_reference",
        await getEmailBrandingForSchool(req, payment.schoolId)
      );
      if (!submittedSent) {
        console.log(`[PAYMENT REF SUBMITTED] Parent: ${user.email}, Ref: ${cleanRef}, OrderRef: ${payment.paymentReference}`);
      }

      res.json(payment);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  // GET /api/parent/payments — list parent's payments
  app.get("/api/parent/payments", requireRole("parent"), async (req, res) => {
    const user = await storage.getUserById(req.session.userId!);
    if (!user?.email) return res.status(400).json({ message: "No email set for your account" });
    const payments = await storage.getPayments(user.email);
    res.json(payments);
  });

  // === FINANCE SUMMARY ===
  app.get("/api/finance/summary", requireRole(...FINANCE_ROLES), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      const payments = await storage.getPayments(undefined, sid);
      const totalRevenue = payments
        .filter((p) => p.status === "confirmed" || p.status === "completed")
        .reduce((sum, p) => sum + parseFloat(p.totalAmount || "0"), 0);
      const pendingReview = payments.filter((p) => p.status === "reference_submitted").length;
      const awaitingRef = payments.filter((p) => p.status === "awaiting_reference" || p.status === "pending").length;
      const confirmed = payments.filter((p) => p.status === "confirmed" || p.status === "completed").length;
      const rejected = payments.filter((p) => p.status === "rejected" || p.status === "failed").length;
      const needsReview = payments.filter((p) => p.status === "needs_review").length;
      const cancelled = payments.filter((p) => p.status === "cancelled").length;
      const totalOutstanding = payments
        .filter((p) => !["confirmed", "completed", "cancelled", "rejected", "failed"].includes(p.status))
        .reduce((sum, p) => sum + parseFloat(p.totalAmount || "0"), 0);
      res.json({
        totalPayments: payments.length,
        totalRevenue: totalRevenue.toFixed(2),
        totalOutstanding: totalOutstanding.toFixed(2),
        pendingReview,
        awaitingRef,
        confirmed,
        rejected,
        needsReview,
        cancelled,
      });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // === ADMIN PAYMENTS (school-scoped) ===
  app.get("/api/admin/payments", requireRole(...FINANCE_ROLES), async (req, res) => {
    const sid = sessionSchoolId(req);
    const payments = await storage.getPayments(undefined, sid);
    res.json(payments);
  });

  app.post("/api/admin/payments/:id/confirm", requireRole(...FINANCE_ROLES), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      if (sid) {
        const setupState = await getSchoolSetupState(sid);
        if (!setupState) return res.status(404).json({ message: "School not found" });
        if (!setupState.operationalSetupComplete) {
          return res.status(409).json({ message: "Complete school setup before confirming payments.", missingSteps: setupState.missingSteps });
        }
      }
      const { reviewNote } = req.body || {};
      const payment = await storage.confirmPayment(routeParam(req.params.id), req.session.userId!, reviewNote, sid);

      // Update order status to ready_for_teacher_distribution
      try { await storage.updateOrderStatus(payment.id, "ready_for_teacher_distribution", sid); } catch (_) {}

      await storage.createAuditLog({
        action: "payment_confirmed",
        userId: req.session.userId!,
        metadata: `Payment confirmed: id=${payment.id}, ref=${payment.paymentReference}, extRef=${payment.paymentReferenceNumber || "N/A"}`,
      });

      if (payment?.parentIdentifier) {
        const sent = await sendPaymentVerifiedEmail(
          payment.parentIdentifier,
          payment.paymentReference || payment.id,
          payment.totalAmount || "0.00",
          await getEmailBrandingForSchool(req, payment.schoolId),
        );
        if (!sent) {
          console.log(`[PAYMENT CONFIRMED] Parent: ${payment.parentIdentifier}, Ref: ${payment.paymentReference}`);
        }
      }

      res.json(payment);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.post("/api/admin/payments/:id/reject", requireRole(...FINANCE_ROLES), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      if (sid) {
        const setupState = await getSchoolSetupState(sid);
        if (!setupState) return res.status(404).json({ message: "School not found" });
        if (!setupState.operationalSetupComplete) {
          return res.status(409).json({ message: "Complete school setup before processing payments.", missingSteps: setupState.missingSteps });
        }
      }
      const { reviewNote } = req.body || {};
      const payment = await storage.rejectPayment(routeParam(req.params.id), req.session.userId!, reviewNote, sid);

      await storage.createAuditLog({
        action: "payment_rejected",
        userId: req.session.userId!,
        metadata: `Payment rejected: id=${payment.id}, ref=${payment.paymentReference}, reason=${reviewNote || "none"}`,
      });

      if (payment?.parentIdentifier) {
        const sent = await sendPaymentRejectedEmail(
          payment.parentIdentifier,
          payment.paymentReference || payment.id,
          payment.totalAmount || "0.00",
          await getEmailBrandingForSchool(req, payment.schoolId),
        );
        if (!sent) {
          console.log(`[PAYMENT REJECTED] Parent: ${payment.parentIdentifier}, Ref: ${payment.paymentReference}`);
        }
      }

      res.json(payment);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.post("/api/admin/payments/:id/needs-review", requireRole(...FINANCE_ROLES), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      const { reviewNote } = req.body || {};
      const payment = await storage.markPaymentNeedsReview(routeParam(req.params.id), req.session.userId!, reviewNote, sid);

      await storage.createAuditLog({
        action: "payment_needs_review",
        userId: req.session.userId!,
        metadata: `Payment flagged for review: id=${payment.id}, ref=${payment.paymentReference}, note=${reviewNote || "none"}`,
      });

      res.json(payment);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  // === ORDER FULFILMENT STATUS ===
  app.post("/api/admin/payments/:id/ready-for-collection", requireRole(...FINANCE_ROLES), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      const { reviewNote } = req.body || {};
      const payment = await storage.markPaymentReadyForCollection(routeParam(req.params.id), req.session.userId!, reviewNote, sid);

      await storage.createAuditLog({
        action: "payment_ready_for_collection",
        userId: req.session.userId!,
        metadata: `Order marked ready for collection: id=${payment.id}, ref=${payment.paymentReference}`,
      });

      res.json(payment);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.post("/api/admin/payments/:id/collected", requireRole(...FINANCE_ROLES), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      const { reviewNote } = req.body || {};
      const payment = await storage.markPaymentCollected(routeParam(req.params.id), req.session.userId!, reviewNote, sid);

      await storage.createAuditLog({
        action: "payment_collected",
        userId: req.session.userId!,
        metadata: `Order collected: id=${payment.id}, ref=${payment.paymentReference}`,
      });

      res.json(payment);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.post("/api/admin/payments/:id/cancel", requireRole(...FINANCE_ROLES), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      const { reviewNote } = req.body || {};
      const payment = await storage.cancelPayment(routeParam(req.params.id), req.session.userId!, reviewNote, sid);

      await storage.createAuditLog({
        action: "payment_cancelled",
        userId: req.session.userId!,
        metadata: `Order cancelled: id=${payment.id}, ref=${payment.paymentReference}, reason=${reviewNote || "none"}`,
      });

      res.json(payment);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  // === ALLOCATIONS (school-scoped) ===
  app.get("/api/allocations", requireRole(...ADMIN_UI_ROLES, "teacher"), async (req, res) => {
    const sid = sessionSchoolId(req);
    const classId = req.query.classId as string | undefined;
    let allocations = await storage.getAllocations(classId, sid);
    if (getActiveRequestContext(req) === "teacher") {
      const classes = await getTeacherAssignedClasses(req.session.userId!, sid);
      const assignedClassIds = new Set(classes.filter((cls) => cls.teacherId === req.session.userId).map((cls) => cls.id));
      allocations = allocations.filter((allocation: any) => allocation.student?.class?.id && assignedClassIds.has(allocation.student.class.id));
    }
    res.json(allocations);
  });

  app.post("/api/allocations", requireRole(...ADMIN_UI_ROLES), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      if (sid) {
        const setupState = await getSchoolSetupState(sid);
        if (!setupState) {
          return res.status(404).json({ message: "School not found" });
        }
        if (!setupState.operationalSetupComplete) {
          return res.status(409).json({
            message: "Complete school setup before managing allocations.",
            missingSteps: setupState.missingSteps,
          });
        }
      }
      const allocation = await storage.createAllocation({ ...req.body, schoolId: sid });
      res.status(201).json(allocation);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.post("/api/allocations/:id/confirm", requireRole(...ADMIN_UI_ROLES, "teacher"), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      if (sid) {
        const setupState = await getSchoolSetupState(sid);
        if (!setupState) {
          return res.status(404).json({ message: "School not found" });
        }
        if (!setupState.operationalSetupComplete) {
          return res.status(409).json({
            message: "Complete school setup before confirming allocations.",
            missingSteps: setupState.missingSteps,
          });
        }
      }

      if (getActiveRequestContext(req) === "teacher") {
        const classes = await getTeacherAssignedClasses(req.session.userId!, sid);
        const assignedClassIds = new Set(classes.filter((cls) => cls.teacherId === req.session.userId).map((cls) => cls.id));
        const allocations = await storage.getAllocations(undefined, sid);
        const targetAllocation = allocations.find((allocation: any) => allocation.id === routeParam(req.params.id));
        if (!targetAllocation || !targetAllocation.student?.class?.id || !assignedClassIds.has(targetAllocation.student.class.id)) {
          return res.status(403).json({ message: "Access denied" });
        }

        const user = await storage.getUserById(req.session.userId!);
        if (user?.email) {
          const parentLinks = await storage.getParentChildren(user.email);
          const linkedStudentIds = new Set(parentLinks.filter((link) => !sid || link.student?.schoolId === sid).map((link) => link.studentId));
          if (linkedStudentIds.has(targetAllocation.studentId)) {
            await auditLog(req, "teacher_self_child_allocation_blocked", `allocation:${targetAllocation.id}`, {
              studentId: targetAllocation.studentId,
              action: "confirm",
            });
            return res.status(403).json({ message: "A school admin or another authorised teacher must confirm handover for your own linked child." });
          }
        }
      }

      const allocation = await storage.confirmReceipt(routeParam(req.params.id), sid);
      res.json(allocation);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.post("/api/allocations/:id/absent", requireRole(...ADMIN_UI_ROLES, "teacher"), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      if (sid) {
        const setupState = await getSchoolSetupState(sid);
        if (!setupState) {
          return res.status(404).json({ message: "School not found" });
        }
        if (!setupState.operationalSetupComplete) {
          return res.status(409).json({
            message: "Complete school setup before managing allocations.",
            missingSteps: setupState.missingSteps,
          });
        }
      }

      if (getActiveRequestContext(req) === "teacher") {
        const classes = await getTeacherAssignedClasses(req.session.userId!, sid);
        const assignedClassIds = new Set(classes.filter((cls) => cls.teacherId === req.session.userId).map((cls) => cls.id));
        const allocations = await storage.getAllocations(undefined, sid);
        const targetAllocation = allocations.find((allocation: any) => allocation.id === routeParam(req.params.id));
        if (!targetAllocation || !targetAllocation.student?.class?.id || !assignedClassIds.has(targetAllocation.student.class.id)) {
          return res.status(403).json({ message: "Access denied" });
        }

        const user = await storage.getUserById(req.session.userId!);
        if (user?.email) {
          const parentLinks = await storage.getParentChildren(user.email);
          const linkedStudentIds = new Set(parentLinks.filter((link) => !sid || link.student?.schoolId === sid).map((link) => link.studentId));
          if (linkedStudentIds.has(targetAllocation.studentId)) {
            await auditLog(req, "teacher_self_child_allocation_blocked", `allocation:${targetAllocation.id}`, {
              studentId: targetAllocation.studentId,
              action: "absent",
            });
            return res.status(403).json({ message: "A school admin or another authorised teacher must update handover for your own linked child." });
          }
        }
      }

      const allocation = await storage.markAllocationAbsent(routeParam(req.params.id), sid);
      res.json(allocation);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  // === TEACHER-LED BOOK DISTRIBUTION ===

  // Teacher: get distribution list for their assigned classes
  app.get("/api/teacher/book-distribution", requireRole("teacher"), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      if (!sid) return res.status(400).json({ message: "School context required" });
      const filters: { classId?: string; status?: string } = {};
      if (req.query.classId) filters.classId = req.query.classId as string;
      if (req.query.status) filters.status = req.query.status as string;
      const distributions = await storage.getDistributionsByTeacher(req.session.userId!, sid, filters);
      res.json(distributions);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // Teacher: confirm student received book
  app.post("/api/teacher/book-distribution/:id/confirm-received", requireRole("teacher"), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      if (!sid) return res.status(400).json({ message: "School context required" });

      // Teacher-child protection: teachers cannot confirm for their own linked children
      const allocations = await storage.getDistributionsByTeacher(req.session.userId!, sid);
      const target = allocations.find((a: any) => a.id === routeParam(req.params.id));
      if (!target) return res.status(404).json({ message: "Allocation not found or not in your classes" });

      const user = await storage.getUserById(req.session.userId!);
      if (user?.email) {
        const parentLinks = await storage.getParentChildren(user.email);
        const linkedStudentIds = new Set(parentLinks.map((l) => l.studentId));
        if (linkedStudentIds.has(target.studentId)) {
          return res.status(403).json({ message: "Cannot confirm distribution for your own linked child. Another teacher or admin must do this." });
        }
      }

      const result = await storage.confirmDistribution(routeParam(req.params.id), req.session.userId!, sid);
      res.json(result);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  // Teacher: mark student absent
  app.post("/api/teacher/book-distribution/:id/mark-absent", requireRole("teacher"), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      if (!sid) return res.status(400).json({ message: "School context required" });
      const result = await storage.markDistributionAbsent(routeParam(req.params.id), req.session.userId!, sid);
      res.json(result);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  // Teacher: report issue with distribution
  app.post("/api/teacher/book-distribution/:id/report-issue", requireRole("teacher"), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      if (!sid) return res.status(400).json({ message: "School context required" });
      const { issueNote } = req.body;
      if (!issueNote) return res.status(400).json({ message: "Issue note is required" });
      const result = await storage.reportDistributionIssue(routeParam(req.params.id), req.session.userId!, issueNote, sid);
      res.json(result);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  // Admin: get distribution overview for school
  app.get("/api/admin/book-distribution", requireRole(...ADMIN_UI_ROLES), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      if (!sid) return res.status(400).json({ message: "School context required" });
      const overview = await storage.getDistributionOverview(sid);
      res.json(overview);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // Admin: confirm distribution on behalf
  app.post("/api/admin/book-distribution/:id/confirm", requireRole(...ADMIN_UI_ROLES), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      if (!sid) return res.status(400).json({ message: "School context required" });
      const result = await storage.adminConfirmDistribution(routeParam(req.params.id), sid);
      res.json(result);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  // Admin: update order status on a payment
  app.post("/api/admin/payments/:id/order-status", requireRole(...ADMIN_UI_ROLES), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      const { orderStatus } = req.body;
      if (!orderStatus) return res.status(400).json({ message: "orderStatus is required" });
      const result = await storage.updateOrderStatus(routeParam(req.params.id), orderStatus, sid);
      res.json(result);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  // === EXTRA COPY REQUESTS (school-scoped) ===
  app.get("/api/extra-requests", requireRole(...ADMIN_UI_ROLES, "teacher"), async (req, res) => {
    const sid = sessionSchoolId(req);
    const filters: { teacherId?: string; status?: string; schoolId?: string | null } = { schoolId: sid };
    if (req.query.teacherId) filters.teacherId = req.query.teacherId as string;
    if (req.query.status) filters.status = req.query.status as string;
    // If teacher role, restrict to their own requests
    if (getActiveRequestContext(req) === "teacher") {
      filters.teacherId = req.session.userId!;
    }
    const requests = await storage.getExtraCopyRequests(filters);
    res.json(requests);
  });

  app.post("/api/extra-requests", requireRole("teacher"), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      const request = await storage.createExtraCopyRequest({
        ...req.body,
        teacherId: req.session.userId!,
        schoolId: sid,
      });
      res.status(201).json(request);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.post("/api/extra-requests/:id/approve", requireRole(...ADMIN_UI_ROLES), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      const request = await storage.approveExtraCopyRequest(routeParam(req.params.id), req.body.adminNotes, sid);
      res.json(request);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.post("/api/extra-requests/:id/reject", requireRole(...ADMIN_UI_ROLES), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      const request = await storage.rejectExtraCopyRequest(routeParam(req.params.id), req.body.adminNotes, sid);
      res.json(request);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  // === USERS (admin-scoped; includes school-linked parents) ===
  const listAdminUsers = async (req: Request, res: Response) => {
    try {
      const [users, schools] = await Promise.all([
        getScopedAdminUsers(req),
        storage.getSchools(),
      ]);
      const parentChildrenCount = new Map<string, number>();
      const brandingPermissionMap = new Map<string, string[]>();
      const schoolsById = new Map<string, { name: string; code: string }>(
        schools.map((school) => [school.id, { name: school.name, code: school.code }]),
      );

      // For users whose school is not in the bulk list, try individual lookup
      const missingSchoolIds = new Set<string>();
      for (const u of users) {
        if (u.schoolId && !schoolsById.has(u.schoolId)) {
          missingSchoolIds.add(u.schoolId);
        }
      }
      await Promise.all(Array.from(missingSchoolIds).map(async (sid) => {
        try {
          const school = await storage.getSchoolById(sid);
          if (school) schoolsById.set(school.id, { name: school.name, code: school.code });
        } catch { /* ignore lookup failures */ }
      }));

      await Promise.all(users.map(async (user) => {
        if (resolveRole(user.role) !== "parent" || !user.email) return;
        const sid = sessionSchoolId(req);
        const children = await storage.getParentChildren(user.email);
        const scopedChildren = sid ? children.filter((child) => child.student?.schoolId === sid) : children;
        parentChildrenCount.set(user.id, scopedChildren.length);
      }));

      await Promise.all(users.map(async (user) => {
        if (resolveRole(user.role) !== "it_personnel") return;
        const permissions = await storage.getUserPermissions(user.id);
        brandingPermissionMap.set(user.id, permissions.filter((permission) => BRANDING_PERMISSIONS.includes(permission as any)));
      }));

      const payload = users.map((u) => {
        const school = u.schoolId ? schoolsById.get(u.schoolId) : undefined;
        return formatUserForAdmin(u, {
          schoolName: school?.name || null,
          schoolCode: school?.code || null,
          linkedChildrenCount: parentChildrenCount.get(u.id) ?? 0,
          brandingPermissions: brandingPermissionMap.get(u.id) || [],
        });
      });
      res.json(payload);
    } catch (e: any) {
      res.status(500).json({ message: e.message || "Failed to load users" });
    }
  };

  app.get("/api/users", requireRole(...ADMIN_UI_ROLES), listAdminUsers);
  app.get("/api/admin/users", requireRole(...ADMIN_UI_ROLES), listAdminUsers);

  app.get("/api/admin/parents", requireRole(...ADMIN_UI_ROLES), async (req, res) => {
    try {
      const requestedSchoolId = typeof req.query.schoolId === "string" ? req.query.schoolId : null;
      const sid = isPlatformOwnerRequest(req) ? requestedSchoolId : sessionSchoolId(req);
      const [users, schools] = await Promise.all([
        getScopedAdminUsers(req),
        storage.getSchools(),
      ]);
      const schoolsById = new Map<string, { name: string; code: string }>(
        schools.map((school) => [school.id, { name: school.name, code: school.code }]),
      );
      const parents = users.filter((u) => resolveRole(u.role) === "parent" && !!u.email);
      const linkingCodes = sid ? await storage.getLinkingCodes(sid) : await storage.getLinkingCodes();

      const payload = await Promise.all(parents.map(async (parent) => {
        const links = await storage.getParentChildren(parent.email);
        const scopedLinks = sid ? links.filter((link) => link.student?.schoolId === sid) : links;
        const baskets = await storage.getBaskets(parent.email, sid);
        const payments = await storage.getPayments(parent.email, sid);
        const parentCodes = linkingCodes.filter((code) => normalizeEmail(code.parentEmail) === normalizeEmail(parent.email));

        const linkedStudents = scopedLinks.map((link) => ({
          id: link.student?.id,
          name: link.student?.name,
          className: link.student?.class?.name || null,
        })).filter((s) => !!s.id);

        const resolvedSchoolId = parent.schoolId || scopedLinks[0]?.student?.schoolId || null;
        let resolvedSchool = resolvedSchoolId ? schoolsById.get(resolvedSchoolId) : undefined;
        // Fallback: try individual lookup if not found in bulk list
        if (!resolvedSchool && resolvedSchoolId) {
          try {
            const school = await storage.getSchoolById(resolvedSchoolId);
            if (school) {
              resolvedSchool = { name: school.name, code: school.code };
              schoolsById.set(school.id, resolvedSchool);
            }
          } catch { /* ignore lookup failures */ }
        }

        return formatUserForAdmin(parent, {
          schoolName: resolvedSchool?.name || null,
          schoolCode: resolvedSchool?.code || null,
          linkedChildrenCount: scopedLinks.length,
          linkedStudents,
          linkingCodesIssued: parentCodes.length,
          linkingCodesUsed: parentCodes.filter((c) => c.isUsed).length,
          basketsCount: baskets.length,
          activeBasketsCount: baskets.filter((b) => b.status === "pending").length,
          unpaidBasketsCount: baskets.filter((b) => b.status === "pending").length,
          paidAwaitingCollectionCount: baskets.filter((b) => b.status === "allocated").length,
          paymentsCount: payments.length,
          completedPaymentsCount: payments.filter((p) => p.status === "completed").length,
          lastPaymentAt: payments[0]?.paidAt || null,
          parentStatus: parent.status || "unknown",
          signupStatus: parent.status === "invited" ? "Invite pending" : parent.status === "active" ? "Completed" : "Not available",
          collectionStatus: "Not available",
        });
      }));

      res.json(payload);
    } catch (e: any) {
      res.status(500).json({ message: e.message || "Failed to load parents" });
    }
  });

  app.post("/api/users", requireRole(...ADMIN_UI_ROLES), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      const { username, password, name, role, email, brandingPermissions } = req.body;
      if (!username || !password || !name || !role) {
        return res.status(400).json({ message: "Username, password, name, and role are required" });
      }
      const existing = await storage.getUserByUsername(username);
      if (existing) {
        return res.status(400).json({ message: "Username already taken" });
      }

      const normalizedRole = resolveRole(role);
      if (isPlatformOwnerRole(normalizedRole)) {
        return res.status(403).json({ message: "Platform owner accounts cannot be created from this endpoint." });
      }

      if (!isPlatformOwnerRequest(req) && !["school_admin", "teacher", "finance", "it_personnel", "student", "parent"].includes(normalizedRole)) {
        return res.status(403).json({ message: "Role is not allowed for school-level administrators." });
      }

      // Duplicate email detection: if email already exists with a compatible role, suggest merging
      if (email) {
        const emailUser = await storage.getUserByEmail(email.toLowerCase().trim());
        if (emailUser) {
          const existingRole = resolveRole(emailUser.role);
          const secondaryRoles = await storage.getSecondaryRoles(emailUser.id);
          const allRoles = [existingRole, ...secondaryRoles];
          if (!allRoles.includes(normalizedRole as any)) {
            const canMerge =
              (normalizedRole === "teacher" && allRoles.includes("parent")) ||
              (normalizedRole === "parent" && allRoles.includes("teacher")) ||
              (normalizedRole === "teacher" && existingRole === "parent") ||
              (normalizedRole === "parent" && existingRole === "teacher");
            if (canMerge) {
              return res.status(409).json({
                message: `An account with email ${email} already exists as ${existingRole}. Add ${normalizedRole} role to this account?`,
                existingUserId: emailUser.id,
                existingUserName: emailUser.name,
                existingRole,
                suggestedAction: "merge_role",
              });
            }
          }
        }
      }

      const hash = await bcrypt.hash(password, 12);
      const user = await storage.createUser({ username, passwordHash: hash, name, role: normalizedRole, email, status: "active", schoolId: sid });
      if (normalizedRole === "it_personnel" && Array.isArray(brandingPermissions)) {
        const scoped = brandingPermissions.filter((permission: string) => BRANDING_PERMISSIONS.includes(permission as any));
        await storage.setUserPermissions(user.id, scoped);
      }
      const { passwordHash: _ph, ...safeUserData } = user;
      res.status(201).json({ ...safeUserData, brandingPermissions: normalizedRole === "it_personnel" ? await storage.getUserPermissions(user.id) : [] });
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  const updateAdminUser = async (req: Request, res: Response) => {
    try {
      const targetUser = await storage.getUserById(routeParam(req.params.id));
      if (!targetUser) return res.status(404).json({ message: "User not found" });

      if (!(await canManageUser(req, targetUser))) {
        return res.status(403).json({ message: "Access denied" });
      }

      const guardMessage = enforceRoleUpdateGuards(req, targetUser, req.body?.role);
      if (guardMessage) {
        return res.status(403).json({ message: guardMessage });
      }

      const { password, brandingPermissions, ...rest } = req.body;
      const updates: any = { ...rest };
      if (password) {
        updates.passwordHash = await bcrypt.hash(password, 12);
      }

      if (updates.role) {
        updates.role = resolveRole(updates.role);
      }

      const user = await storage.updateUser(routeParam(req.params.id), updates);
      if (!user) return res.status(404).json({ message: "User not found" });
      const targetRole = resolveRole(user.role);
      if (targetRole === "it_personnel" && Array.isArray(brandingPermissions)) {
        const scoped = brandingPermissions.filter((permission: string) => BRANDING_PERMISSIONS.includes(permission as any));
        await storage.setUserPermissions(user.id, scoped);
      }
      const effectivePermissions = targetRole === "it_personnel" ? await storage.getUserPermissions(user.id) : [];
      res.json(formatUserForAdmin(user, { brandingPermissions: effectivePermissions }));
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  };

  app.patch("/api/users/:id", requireRole(...ADMIN_UI_ROLES), updateAdminUser);
  app.patch("/api/admin/users/:id", requireRole(...ADMIN_UI_ROLES), updateAdminUser);

  const deleteAdminUser = async (req: Request, res: Response) => {
    const targetUser = await storage.getUserById(routeParam(req.params.id));
    if (!targetUser) return res.status(404).json({ message: "User not found" });

    const targetRole = resolveRole(targetUser.role);
    const ownerCanDeleteAdminAnywhere =
      isPlatformOwnerRequest(req) && ["admin", "school_admin", "platform_admin", "owner"].includes(targetRole);

    if (isPlatformOwnerRequest(req) && !ownerCanDeleteAdminAnywhere && !isInSupportMode(req)) {
      return res.status(403).json({
        message: "Owner user management is only allowed inside Support Mode for a selected school.",
      });
    }

    if (!ownerCanDeleteAdminAnywhere && !(await canManageUser(req, targetUser))) {
      return res.status(403).json({ message: "Access denied" });
    }

    if (req.session.userId === targetUser.id) {
      return res.status(403).json({ message: "You cannot delete your own account." });
    }

    if (isPlatformOwnerRole(targetUser.role)) {
      return res.status(403).json({ message: "Platform owner accounts cannot be deleted from the standard dashboard workflow." });
    }

    if (["admin", "school_admin", "platform_admin", "owner"].includes(targetRole) && !isPlatformOwnerRequest(req)) {
      return res.status(403).json({ message: "Deleting admin-level users is restricted." });
    }

    await storage.deleteUser(routeParam(req.params.id));
    res.status(204).send();
  };

  app.delete("/api/users/:id", requireRole(...ADMIN_UI_ROLES), deleteAdminUser);
  app.delete("/api/admin/users/:id", requireRole(...ADMIN_UI_ROLES), deleteAdminUser);

  // === MULTI-ROLE USER MANAGEMENT ===

  // GET /api/admin/users/:userId — full user detail with roles, profiles, links, classes
  app.get("/api/admin/users/:userId", requireRole(...ADMIN_UI_ROLES), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      if (!sid) return res.status(400).json({ message: "School context required" });
      const userId = routeParam(req.params.userId);
      if (!(await canManageUser(req, { id: userId, schoolId: sid, role: "" }))) {
        // Fallback: just get the user and check school
        const u = await storage.getUserById(userId);
        if (!u || u.schoolId !== sid) return res.status(404).json({ message: "User not found" });
      }
      const detail = await storage.getUserWithDetail(userId, sid);
      if (!detail) return res.status(404).json({ message: "User not found" });
      const { passwordHash: _ph, ...safe } = detail;
      res.json(safe);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // GET /api/admin/students/search — search students for the admin's school
  app.get("/api/admin/students/search", requireRole(...ADMIN_UI_ROLES), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      if (!sid) return res.status(400).json({ message: "School context required" });
      const q = typeof req.query.q === "string" ? req.query.q : "";
      const results = await storage.searchStudentsForAdmin(q, sid);
      res.json(results);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // POST /api/admin/users/:userId/roles/parent — add parent role to an existing user
  app.post("/api/admin/users/:userId/roles/parent", requireRole(...ADMIN_UI_ROLES), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      if (!sid) return res.status(400).json({ message: "School context required" });
      const userId = routeParam(req.params.userId);
      const { relationship, studentId } = req.body as { relationship?: string; studentId?: string };

      const targetUser = await storage.getUserById(userId);
      if (!targetUser) return res.status(404).json({ message: "User not found" });
      if (targetUser.schoolId !== sid) return res.status(403).json({ message: "User belongs to a different school" });
      if (!targetUser.email) return res.status(400).json({ message: "User must have an email address to receive a parent role" });

      const primaryRole = resolveRole(targetUser.role);
      const secondaryRoles = await storage.getSecondaryRoles(userId);

      if (primaryRole === "parent" || secondaryRoles.includes("parent")) {
        return res.status(409).json({ message: "User already has the parent role" });
      }

      // Add secondary role
      await storage.addSecondaryRole(userId, "parent");

      // If a student was specified, create the link immediately
      let linkResult: any = null;
      if (studentId) {
        const validStudent = await storage.getStudentById(studentId, sid);
        if (!validStudent) return res.status(400).json({ message: "Student not found in this school" });

        linkResult = await storage.addParentStudentLink({
          parentIdentifier: targetUser.email!,
          studentId,
          relationship: relationship || undefined,
          addedByAdminId: req.session.userId,
          schoolId: sid,
        });
      }

      await storage.createAuditLog({
        action: "USER_ROLE_ADDED",
        userId: req.session.userId!,
        target: `user:${userId}`,
        metadata: JSON.stringify({ role: "parent", addedTo: targetUser.username, schoolId: sid }),
      });
      if (studentId && linkResult) {
        await storage.createAuditLog({
          action: "ADMIN_LINKED_TEACHER_AS_PARENT",
          userId: req.session.userId!,
          target: `user:${userId}`,
          metadata: JSON.stringify({ studentId, relationship, schoolId: sid }),
        });
      }

      const detail = await storage.getUserWithDetail(userId, sid);
      const { passwordHash: _ph, ...safe } = detail;
      res.json({ message: "Parent role added successfully", user: safe, link: linkResult });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // POST /api/admin/users/:userId/roles/teacher — add teacher role to an existing user
  app.post("/api/admin/users/:userId/roles/teacher", requireRole(...ADMIN_UI_ROLES), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      if (!sid) return res.status(400).json({ message: "School context required" });
      const userId = routeParam(req.params.userId);
      const { department, subjects, classIds } = req.body as {
        department?: string;
        subjects?: string[];
        classIds?: string[];
      };

      const targetUser = await storage.getUserById(userId);
      if (!targetUser) return res.status(404).json({ message: "User not found" });
      if (targetUser.schoolId !== sid) return res.status(403).json({ message: "User belongs to a different school" });

      const primaryRole = resolveRole(targetUser.role);
      const secondaryRoles = await storage.getSecondaryRoles(userId);

      if (primaryRole === "teacher" || secondaryRoles.includes("teacher")) {
        return res.status(409).json({ message: "User already has the teacher role" });
      }

      // Add secondary role
      await storage.addSecondaryRole(userId, "teacher");

      // Create teacher profile
      await storage.upsertTeacherProfile({
        userId,
        schoolId: sid,
        department: department || null,
        subjects: subjects ? JSON.stringify(subjects) : null,
        createdByAdminId: req.session.userId,
      });

      // Assign to specified classes
      if (classIds && classIds.length > 0) {
        const allClasses = await storage.getClasses(sid);
        for (const classId of classIds) {
          const cls = allClasses.find((c) => c.id === classId);
          if (cls && cls.schoolId === sid) {
            await storage.updateClass(classId, { teacherId: userId });
          }
        }
      }

      await storage.createAuditLog({
        action: "USER_ROLE_ADDED",
        userId: req.session.userId!,
        target: `user:${userId}`,
        metadata: JSON.stringify({ role: "teacher", addedTo: targetUser.username, department, schoolId: sid }),
      });
      await storage.createAuditLog({
        action: "TEACHER_PROFILE_CREATED",
        userId: req.session.userId!,
        target: `user:${userId}`,
        metadata: JSON.stringify({ department, subjects, schoolId: sid }),
      });

      const detail = await storage.getUserWithDetail(userId, sid);
      const { passwordHash: _ph, ...safe } = detail;
      res.json({ message: "Teacher role added successfully", user: safe });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // POST /api/admin/users/:userId/link-child — link a child to an existing parent/multi-role user
  app.post("/api/admin/users/:userId/link-child", requireRole(...ADMIN_UI_ROLES), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      if (!sid) return res.status(400).json({ message: "School context required" });
      const userId = routeParam(req.params.userId);
      const { studentId, relationship } = req.body as { studentId: string; relationship?: string };
      if (!studentId) return res.status(400).json({ message: "studentId is required" });

      const targetUser = await storage.getUserById(userId);
      if (!targetUser) return res.status(404).json({ message: "User not found" });
      if (targetUser.schoolId !== sid) return res.status(403).json({ message: "User belongs to a different school" });
      if (!targetUser.email) return res.status(400).json({ message: "User must have an email to be linked to a student" });

      // Verify user has parent role (primary or secondary)
      const primaryRole = resolveRole(targetUser.role);
      const secondaryRoles = await storage.getSecondaryRoles(userId);
      if (primaryRole !== "parent" && !secondaryRoles.includes("parent")) {
        return res.status(400).json({ message: "User does not have a parent role. Add parent role first." });
      }

      // Verify student belongs to this school
      const students = await storage.getStudents(sid);
      const validStudent = students.find((s) => s.id === studentId);
      if (!validStudent) return res.status(400).json({ message: "Student not found in this school" });

      const link = await storage.addParentStudentLink({
        parentIdentifier: targetUser.email!,
        studentId,
        relationship: relationship || undefined,
        addedByAdminId: req.session.userId,
        schoolId: sid,
      });

      await storage.createAuditLog({
        action: "PARENT_STUDENT_LINK_CREATED",
        userId: req.session.userId!,
        target: `user:${userId}`,
        metadata: JSON.stringify({ studentId, relationship, alreadyLinked: link.alreadyLinked, schoolId: sid }),
      });

      if (link.alreadyLinked) {
        return res.status(200).json({ message: "Child was already linked to this parent", link });
      }
      res.status(201).json({ message: "Child linked successfully", link });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // DELETE /api/admin/users/:userId/roles/:role — remove a secondary role
  app.delete("/api/admin/users/:userId/roles/:role", requireRole(...ADMIN_UI_ROLES), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      if (!sid) return res.status(400).json({ message: "School context required" });
      const userId = routeParam(req.params.userId);
      const role = req.params.role as string;

      if (!["parent", "teacher"].includes(role)) {
        return res.status(400).json({ message: "Only parent and teacher secondary roles can be removed" });
      }

      const targetUser = await storage.getUserById(userId);
      if (!targetUser) return res.status(404).json({ message: "User not found" });
      if (targetUser.schoolId !== sid) return res.status(403).json({ message: "User belongs to a different school" });

      const secondaryRoles = await storage.getSecondaryRoles(userId);
      if (!secondaryRoles.includes(role)) {
        return res.status(404).json({ message: `User does not have ${role} as a secondary role` });
      }

      await storage.removeSecondaryRole(userId, role);

      await storage.createAuditLog({
        action: "USER_ROLE_REMOVED",
        userId: req.session.userId!,
        target: `user:${userId}`,
        metadata: JSON.stringify({ role, removedFrom: targetUser.username, schoolId: sid }),
      });

      res.json({ message: `${role} role removed successfully` });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // POST /api/admin/users/:userId/suspend — suspend a user
  app.post("/api/admin/users/:userId/suspend", requireRole(...ADMIN_UI_ROLES), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      if (!sid) return res.status(400).json({ message: "School context required" });
      const userId = routeParam(req.params.userId);

      const targetUser = await storage.getUserById(userId);
      if (!targetUser) return res.status(404).json({ message: "User not found" });
      if (targetUser.schoolId !== sid) return res.status(403).json({ message: "User belongs to a different school" });
      if (req.session.userId === userId) return res.status(403).json({ message: "You cannot suspend your own account" });

      const updated = await storage.updateUser(userId, { status: "disabled" });
      await storage.createAuditLog({
        action: "USER_SUSPENDED",
        userId: req.session.userId!,
        target: `user:${userId}`,
        metadata: JSON.stringify({ username: targetUser.username, schoolId: sid }),
      });
      res.json({ message: "User suspended", user: updated });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // POST /api/admin/users/:userId/reactivate — reactivate a suspended user
  app.post("/api/admin/users/:userId/reactivate", requireRole(...ADMIN_UI_ROLES), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      if (!sid) return res.status(400).json({ message: "School context required" });
      const userId = routeParam(req.params.userId);

      const targetUser = await storage.getUserById(userId);
      if (!targetUser) return res.status(404).json({ message: "User not found" });
      if (targetUser.schoolId !== sid) return res.status(403).json({ message: "User belongs to a different school" });

      const updated = await storage.updateUser(userId, { status: "active" });
      res.json({ message: "User reactivated", user: updated });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // === INVITE MANAGEMENT (admin only, school-scoped) ===
  app.post("/api/invites", requireRole(...ADMIN_UI_ROLES), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      const { email, role } = req.body;
      if (!email || !role) {
        return res.status(400).json({ message: "Email and role are required" });
      }
      const normalizedRole = resolveRole(role);
      if (!USER_ROLES.includes(normalizedRole as any) || normalizedRole === "parent") {
        return res.status(400).json({ message: "Invalid role for invite. Parents self-register." });
      }

      if (isPlatformOwnerRole(normalizedRole)) {
        return res.status(403).json({ message: "Platform owner invites are blocked from this workflow." });
      }

      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(409).json({ message: "A user with this email already exists" });
      }

      const existingInvite = await storage.getPendingInviteByEmail(email);
      if (existingInvite) {
        return res.status(409).json({ message: "A pending invite for this email already exists" });
      }

      const rawToken = crypto.randomBytes(32).toString("hex");
      const tokenHash = await bcrypt.hash(rawToken, 10);

      const invite = await storage.createInvite({
        email,
        role: normalizedRole,
        schoolId: sid,
        tokenHash,
        invitedBy: req.session.userId!,
        status: "pending",
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      const inviteLink = `${getPublicBaseUrl(req)}/accept-invite/${invite.id}.${rawToken}`;
      const sent = await sendInviteEmail(email, normalizedRole, inviteLink, await getEmailBrandingForSchool(req, sid));
      if (!sent) {
        console.log(`[INVITE] Link for ${email} (${role}): ${inviteLink}`);
        if (!isResendConfigured()) {
          console.warn("[Resend] RESEND_API_KEY/RESEND_FROM_EMAIL not configured; using log fallback for invite links.");
        }
      }

      await auditLog(req, "invite_created", `invite:${invite.id}`, { email, role: normalizedRole });

      res.status(201).json({
        id: invite.id,
        email: invite.email,
        role: invite.role,
        expiresAt: invite.expiresAt,
        inviteLink: process.env.NODE_ENV !== "production" ? inviteLink : undefined,
      });
    } catch (e: any) {
      res.status(500).json({ message: "Failed to create invite" });
    }
  });

  // === EXTERNAL PAYMENT WEBHOOK ===
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
  app.get("/api/notifications/summary", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUserById(req.session.userId!);
      if (!user) return res.status(401).json({ message: "Not authenticated" });

      const context = getActiveRequestContext(req);
      const sid = sessionSchoolId(req) || user.schoolId || null;

      const items: Array<{
        key: string;
        label: string;
        count: number;
        href: string;
        severity: "info" | "warning" | "success";
      }> = [];

      const pushItem = (
        key: string,
        label: string,
        count: number,
        href: string,
        severity: "info" | "warning" | "success" = "info",
      ) => {
        const safeCount = Math.max(0, Number(count) || 0);
        if (safeCount > 0) {
          items.push({ key, label, count: safeCount, href, severity });
        }
      };

      if (context === "parent" && sid) {
        const unreadMessages = await storage.getUnreadCount(user.id, sid);
        pushItem("messages", "New messages", unreadMessages, "/parent/messages", "info");

        const baskets = await storage.getBaskets(user.email || user.id, sid);
        const pendingBaskets = baskets.filter((basket: any) => basket.status === "pending").length;
        pushItem("baskets", "Pending baskets", pendingBaskets, "/parent/baskets", "warning");

        const payments = await storage.getPayments(user.email || user.id, sid);
        const readyForCollection = payments.filter((payment: any) => payment.status === "ready_for_collection").length;
        pushItem("collection", "Ready for collection", readyForCollection, "/parent/payments", "success");
      }

      if (context === "teacher" && sid) {
        const unreadMessages = await storage.getUnreadCount(user.id, sid);
        pushItem("messages", "New messages", unreadMessages, "/teacher/messages", "info");

        const pendingDistribution = (await storage.getDistributionsByTeacher(user.id, sid, { status: "pending_distribution" })).length;
        pushItem("distribution_pending", "Books to distribute", pendingDistribution, "/teacher/distribution", "warning");

        const approvedExtraRequests = (await storage.getExtraCopyRequests({
          teacherId: user.id,
          status: "approved",
          schoolId: sid,
        })).length;
        pushItem("extra_requests", "Approved extra requests", approvedExtraRequests, "/teacher/requests", "success");
      }

      if ((context === "admin" || context === "school_admin") && sid) {
        const communicationThreads = await storage.getMessageThreads({ schoolId: sid, status: "open" });
        const unreadConversations = communicationThreads.filter((thread: any) =>
          (Number(thread.unreadByParent) || 0) + (Number(thread.unreadByTeacher) || 0) > 0
        ).length;
        pushItem("communications", "Unread conversations", unreadConversations, "/admin/communications", "info");

        const pendingRequests = (await storage.getExtraCopyRequests({ status: "pending", schoolId: sid })).length;
        pushItem("extra_requests", "Pending extra requests", pendingRequests, "/admin/requests", "warning");

        const payments = await storage.getPayments(undefined, sid);
        const paymentsToReview = payments.filter((payment: any) =>
          payment.status === "reference_submitted" || payment.status === "needs_review"
        ).length;
        pushItem("payments_review", "Payments to review", paymentsToReview, "/admin/payments", "warning");

        const distributionOverview = await storage.getDistributionOverview(sid);
        pushItem("distribution_issues", "Distribution issues", Number(distributionOverview?.issues) || 0, "/admin/allocations", "warning");
      }

      if (context === "finance" && sid) {
        const payments = await storage.getPayments(undefined, sid);
        const paymentsToReview = payments.filter((payment: any) =>
          payment.status === "reference_submitted" || payment.status === "needs_review"
        ).length;
        pushItem("payments_review", "Payments to review", paymentsToReview, "/finance/review", "warning");

        const awaitingReference = payments.filter((payment: any) =>
          payment.status === "awaiting_reference" || payment.status === "pending"
        ).length;
        pushItem("awaiting_reference", "Awaiting payment reference", awaitingReference, "/finance/payments", "info");
      }

      if ((context === "owner" || context === "platform_admin") && !sid) {
        const schools = await storage.getSchools();
        const pendingSetup = schools.filter((school: any) =>
          school.status === "pending_setup" || school.setupStatus === "pending_admin_invite" || school.setupStatus === "pending_admin_acceptance"
        ).length;
        pushItem("pending_setups", "Schools pending setup", pendingSetup, "/admin/pending-setups", "warning");
      }

      if ((context === "owner" || context === "platform_admin") && sid) {
        const communicationThreads = await storage.getMessageThreads({ schoolId: sid, status: "open" });
        const unreadConversations = communicationThreads.filter((thread: any) =>
          (Number(thread.unreadByParent) || 0) + (Number(thread.unreadByTeacher) || 0) > 0
        ).length;
        pushItem("communications", "Unread conversations", unreadConversations, "/admin/communications", "info");
      }

      items.sort((a, b) => b.count - a.count);
      const totalUnread = items.reduce((sum, item) => sum + item.count, 0);

      res.json({
        context,
        totalUnread,
        items,
        updatedAt: new Date().toISOString(),
      });
    } catch (e: any) {
      res.status(500).json({ message: e.message || "Failed to load notifications" });
    }
  });

  // ── School Admin communication oversight ────────────────────
  app.get("/api/admin/communications", requireRole(...ADMIN_UI_ROLES), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      if (!sid) return res.json([]);
      const statusFilter = typeof req.query.status === "string" ? req.query.status : undefined;
      const threads = await storage.getMessageThreads({ schoolId: sid, status: statusFilter });
      res.json(threads);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/admin/communications/:threadId", requireRole(...ADMIN_UI_ROLES), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      if (!sid) return res.status(400).json({ message: "No school context" });
      const thread = await storage.getMessageThread(routeParam(req.params.threadId), sid);
      if (!thread) return res.status(404).json({ message: "Thread not found" });
      const messages = await storage.getMessages(thread.id, sid);
      res.json({ thread, messages });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.patch("/api/admin/communications/:threadId/status", requireRole(...ADMIN_UI_ROLES), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      if (!sid) return res.status(400).json({ message: "No school context" });
      const { status } = req.body;
      if (!status || !["open", "closed", "archived"].includes(status)) {
        return res.status(400).json({ message: "Status must be open, closed, or archived" });
      }
      const thread = await storage.updateThreadStatus(routeParam(req.params.threadId), status, req.session.userId, sid);
      if (!thread) return res.status(404).json({ message: "Thread not found" });

      await storage.createMessageAuditLog({
        schoolId: sid,
        threadId: thread.id,
        actorUserId: req.session.userId!,
        action: `thread_${status}`,
        reason: req.body.reason || null,
      });

      await auditLog(req, `communication_thread_${status}`, `thread:${thread.id}`);
      res.json(thread);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // ── Owner Support Mode — communications access ─────────────
  // Requires active support mode and creates audit log with reason
  app.get("/api/owner/support/schools/:schoolId/communications", requireRole(...PLATFORM_OWNER_ROLES), async (req, res) => {
    try {
      if (!req.session.supportSchoolId) {
        return res.status(403).json({ message: "Support mode must be active to view school communications" });
      }
      const schoolId = routeParam(req.params.schoolId);
      if (schoolId !== req.session.supportSchoolId) {
        return res.status(403).json({ message: "You can only view communications for the school you are currently supporting" });
      }
      const reason = typeof req.query.reason === "string" ? req.query.reason : "Support access — viewing communications";
      await storage.createMessageAuditLog({
        schoolId,
        threadId: null,
        actorUserId: req.session.userId!,
        action: "owner_support_view_threads",
        reason,
      });
      await auditLog(req, "support_view_communications", `school:${schoolId}`, { reason });

      const threads = await storage.getMessageThreads({ schoolId });
      res.json(threads);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/owner/support/communications/:threadId", requireRole(...PLATFORM_OWNER_ROLES), async (req, res) => {
    try {
      if (!req.session.supportSchoolId) {
        return res.status(403).json({ message: "Support mode must be active to view conversations" });
      }
      const threadId = routeParam(req.params.threadId);
      const thread = await storage.getMessageThread(threadId, req.session.supportSchoolId);
      if (!thread) return res.status(404).json({ message: "Thread not found" });

      const reason = typeof req.query.reason === "string" ? req.query.reason : "Support access — viewing thread";
      await storage.createMessageAuditLog({
        schoolId: req.session.supportSchoolId,
        threadId,
        actorUserId: req.session.userId!,
        action: "owner_support_view_thread",
        reason,
      });
      await auditLog(req, "support_view_thread", `thread:${threadId}`, { reason });

      const messages = await storage.getMessages(thread.id, req.session.supportSchoolId);
      res.json({ thread, messages });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // === SEED DATA ===
  app.post("/api/seed-users", async (_req, res) => {
    try {
      // ── 1. Create demo school ──────────────────────────────────
      let demoSchool = (await storage.getSchools()).find((s) => s.code === "DEMO-001");
      if (!demoSchool) {
        demoSchool = await storage.createSchool({
          name: "Al-Noor International School",
          code: "DEMO-001",
          status: "active",
          setupStatus: "complete",
          contactEmail: "admin@alnoor.edu.ly",
          contactPhone: "+218-21-555-0100",
          address: "Tripoli, Libya",
          notes: "Demo school for EduCore platform demonstration",
        });
      }
      const schoolId = demoSchool.id;

      // ── 2. Create demo users ───────────────────────────────────
      const defaults = [
        { username: "bythub", password: "bythub123", name: "BytHub Platform Owner", role: "owner", email: "owner@bythub.co", status: "active" as const, schoolId: null as string | null },
        { username: "admin", password: "admin123", name: "School Administrator", role: "school_admin", email: "admin@alnoor.edu.ly", status: "active" as const, schoolId },
        { username: "teacher", password: "teacher123", name: "Ms. Fatima Johnson", role: "teacher", email: "teacher@alnoor.edu.ly", status: "active" as const, schoolId },
        { username: "teacher2", password: "teacher123", name: "Mr. Ali Hassan", role: "teacher", email: "ali.hassan@alnoor.edu.ly", status: "active" as const, schoolId },
        { username: "parent", password: "parent123", name: "Ahmed Al-Mansouri", role: "parent", email: "parent@example.com", status: "active" as const, schoolId },
        { username: "it_admin", password: "it123", name: "IT Support", role: "it_personnel", email: "it@alnoor.edu.ly", status: "active" as const, schoolId },
        { username: "finance", password: "finance123", name: "Youssef Al-Baruni", role: "finance", email: "finance@alnoor.edu.ly", status: "active" as const, schoolId },
      ];
      const created: Array<{ username: string; role: string }> = [];
      for (const d of defaults) {
        const existing = await storage.getUserByUsername(d.username);
        if (!existing) {
          const hash = await bcrypt.hash(d.password, 10);
          const user = await storage.createUser({ username: d.username, passwordHash: hash, name: d.name, role: d.role, email: d.email, status: d.status, schoolId: d.schoolId });
          created.push({ username: user.username, role: user.role });
        }
      }

      // ── 3. Look up users for linking ───────────────────────────
      const allUsers = await storage.getUsers();
      const teacherUser = allUsers.find((u) => u.role === "teacher" && u.schoolId === schoolId);

      // ── 4. Create classes (scoped to school) ───────────────────
      let existingClasses = await storage.getClasses(schoolId);
      let classItem = existingClasses[0];
      if (!classItem && teacherUser) {
        classItem = await storage.createClass({
          name: "Year 7 - A",
          academicYear: "2025/2026",
          teacherId: teacherUser.id,
          schoolId,
        });
        // Create a second class for teacher2
        const teacher2 = allUsers.find((u) => u.username === "teacher2");
        if (teacher2) {
          await storage.createClass({
            name: "Year 8 - B",
            academicYear: "2025/2026",
            teacherId: teacher2.id,
            schoolId,
          });
        }
      }

      // ── 5. Create books (scoped to school) ─────────────────────
      let books = await storage.getBooks(schoolId);
      if (books.length === 0) {
        const bookData = [
          { title: "Mathematics Essentials", author: "School Board", isbn: "9780000000001", price: "12.50", description: "Core maths textbook for Year 7-8", isActive: true, stockQuantity: 100, lowStockThreshold: 10, reorderQuantity: 50, schoolId },
          { title: "Science Fundamentals", author: "School Board", isbn: "9780000000002", price: "14.00", description: "Core science textbook", isActive: true, stockQuantity: 80, lowStockThreshold: 10, reorderQuantity: 50, schoolId },
          { title: "English Language Arts", author: "National Curriculum", isbn: "9780000000003", price: "11.00", description: "English language and comprehension", isActive: true, stockQuantity: 90, lowStockThreshold: 10, reorderQuantity: 50, schoolId },
          { title: "Arabic Language", author: "Ministry of Education", isbn: "9780000000004", price: "10.00", description: "Arabic reading and writing", isActive: true, stockQuantity: 120, lowStockThreshold: 15, reorderQuantity: 60, schoolId },
          { title: "Islamic Studies", author: "Ministry of Education", isbn: "9780000000005", price: "8.50", description: "Religious education", isActive: true, stockQuantity: 5, lowStockThreshold: 10, reorderQuantity: 40, schoolId },
        ];
        for (const b of bookData) {
          await storage.createBook(b);
        }
        books = await storage.getBooks(schoolId);
      }

      // ── 6. Create students (scoped to school) ──────────────────
      let students = await storage.getStudents(schoolId);
      if (students.length === 0 && classItem) {
        const studentNames = ["Amelia Carter", "Noah Khan", "Sara Al-Farsi", "Omar Benali", "Layla Hassan"];
        for (const name of studentNames) {
          await storage.createStudent({ name, classId: classItem.id, schoolId });
        }
        students = await storage.getStudents(schoolId);
      }

      // ── 7. Create allocations (with absent demo) ───────────────
      const allocations = await storage.getAllocations(classItem?.id, schoolId);
      const hasAbsent = allocations.some((a: any) => a.status === "absent");
      if (!hasAbsent && students.length > 0 && books.length > 0) {
        const createdAllocation = await storage.createAllocation({
          studentId: students[0].id,
          bookId: books[0].id,
          basketId: null,
          status: "allocated",
          schoolId,
        });
        await storage.markAllocationAbsent(createdAllocation.id);
      }

      // ── 8. Create extra copy requests ──────────────────────────
      const teacherRequests = teacherUser
        ? await storage.getExtraCopyRequests({ teacherId: teacherUser.id, schoolId })
        : [];
      const hasPendingRequest = teacherRequests.some((r: any) => r.status === "pending");
      const hasResolvedRequest = teacherRequests.some((r: any) => r.status !== "pending");

      if (teacherUser && classItem && books.length > 0) {
        if (!hasPendingRequest) {
          await storage.createExtraCopyRequest({
            teacherId: teacherUser.id,
            classId: classItem.id,
            bookId: books[0].id,
            quantity: 2,
            reason: "NEW_STUDENT",
            notes: "Two new students enrolled mid-term",
            status: "pending",
            schoolId,
          });
        }

        if (!hasResolvedRequest) {
          const resolved = await storage.createExtraCopyRequest({
            teacherId: teacherUser.id,
            classId: classItem.id,
            bookId: books[0].id,
            quantity: 1,
            reason: "DAMAGED_IN_CLASS",
            notes: "Book damaged during lab session",
            status: "pending",
            schoolId,
          });
          await storage.approveExtraCopyRequest(resolved.id, "Approved — replacement copy dispatched");
        }
      }

      const refreshedRequests = teacherUser
        ? await storage.getExtraCopyRequests({ teacherId: teacherUser.id, schoolId })
        : [];
      const refreshedAllocations = await storage.getAllocations(classItem?.id, schoolId);

      res.json({
        message: "Seed completed",
        createdUsers: created,
        demoSchool: { id: demoSchool.id, name: demoSchool.name, code: demoSchool.code },
        summary: {
          hasAbsentAllocation: refreshedAllocations.some((a: any) => a.status === "absent"),
          pendingExtraRequests: refreshedRequests.filter((r: any) => r.status === "pending").length,
          resolvedExtraRequests: refreshedRequests.filter((r: any) => r.status !== "pending").length,
          totalStudents: students.length,
          totalBooks: books.length,
        },
      });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

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

      const rawToken = crypto.randomBytes(32).toString("hex");
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
        console.log(`[SCHOOL SETUP INVITE] Link for ${adminEmail}: ${inviteLink}`);
        if (!isResendConfigured()) {
          console.warn("[Resend] RESEND_API_KEY/RESEND_FROM_EMAIL not configured; using log fallback for school setup invites.");
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

      const rawToken = crypto.randomBytes(32).toString("hex");
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

  app.get("/api/admin/book-management-summary", requireRole(...ADMIN_UI_ROLES), async (req, res) => {
    try {
      const requestedSchoolId = typeof req.query.schoolId === "string" ? req.query.schoolId : null;
      const ownerMode = isPlatformOwnerRequest(req);
      const sid = ownerMode ? requestedSchoolId : sessionSchoolId(req);

      const [books, levels, classes, students, payments, allocations] = await Promise.all([
        storage.getBooks(sid),
        storage.getBookLevels(sid),
        storage.getClasses(sid),
        storage.getStudents(sid),
        storage.getPayments(undefined, sid),
        storage.getAllocations(undefined, sid),
      ]);

      const lowStock = books.filter((b) => b.isActive && (b.stockQuantity ?? 0) <= (b.lowStockThreshold ?? 10)).length;
      const pendingPayments = payments.filter((p) => ["pending", "awaiting_reference", "reference_submitted", "needs_review"].includes(p.status!)).length;
      const paidOrders = payments.filter((p) => p.status === "completed" || p.status === "confirmed").length;
      const awaitingCollection = allocations.filter((a: any) => a.status === "allocated").length;
      const completedHandovers = allocations.filter((a: any) => a.status === "received").length;

      res.json({
        schoolId: sid || null,
        books: books.length,
        lowStockBooks: lowStock,
        bookLevels: levels.length,
        classes: classes.length,
        students: students.length,
        orders: payments.length,
        pendingPayments,
        paidOrders,
        awaitingCollection,
        completedHandovers,
      });
    } catch (e: any) {
      res.status(500).json({ message: e.message || "Failed to load book management summary" });
    }
  });

  app.get("/api/owner/dashboard", requireRole(...PLATFORM_OWNER_ROLES), async (req, res) => {
    try {
      const requestedSchoolId = typeof req.query.schoolId === "string" ? req.query.schoolId : null;

      const [schools, users] = await Promise.all([
        storage.getSchools(),
        storage.getUsers(),
      ]);

      const scopedSchools = requestedSchoolId ? schools.filter((s) => s.id === requestedSchoolId) : schools;
      const scopedSchoolIds = new Set(scopedSchools.map((s) => s.id));
      const scopedUsers = users.filter((u) => u.schoolId && scopedSchoolIds.has(u.schoolId));

      const invitesBySchool: Record<string, any[]> = {};
      await Promise.all(
        scopedSchools.map(async (school) => {
          invitesBySchool[school.id] = await storage.getInvitesBySchool(school.id);
        }),
      );

      const recentActivityLogs = await storage.getAuditLogs(60);

      let pendingAdminInviteSchools = 0;
      let pendingAdminAcceptanceSchools = 0;
      let setupInProgressSchools = 0;
      let activeSchools = 0;
      let suspendedSchools = 0;
      let pendingInvites = 0;
      let expiredInvites = 0;
      let schoolsNeedingAttention = 0;

      for (const school of scopedSchools) {
        const schoolInvites = (invitesBySchool[school.id] || []).filter((invite) => resolveRole(invite.role) === "school_admin");
        const latestInvite = schoolInvites[0] || null;
        const inviteStatus = deriveInviteStatus(latestInvite);
        const setupStatus = normalizeSchoolSetupStatus(school.setupStatus as string | null | undefined, school.status);
        const hasActiveSchoolAdmin = scopedUsers.some((u) => u.schoolId === school.id && resolveRole(u.role) === "school_admin" && u.status === "active");
        const milestones = setupMilestonesFromState({
          schoolStatus: school.status,
          setupStatus,
          firstAdminInviteStatus: inviteStatus,
          hasActiveSchoolAdmin,
        });

        if (school.status === "active") activeSchools += 1;
        if (school.status === "suspended") suspendedSchools += 1;

        if (setupStatus === "pending_admin_invite" || setupStatus === "school_created" || inviteStatus === "not_invited") {
          pendingAdminInviteSchools += 1;
        }
        if (setupStatus === "pending_admin_acceptance" || inviteStatus === "pending" || inviteStatus === "expired") {
          pendingAdminAcceptanceSchools += 1;
        }
        if (setupStatus === "admin_accepted" || setupStatus === "operational_setup_in_progress") {
          setupInProgressSchools += 1;
        }

        if (inviteStatus === "pending") pendingInvites += 1;
        if (inviteStatus === "expired") expiredInvites += 1;

        if (!milestones.operationalSetupCompleted || school.status !== "active" || inviteStatus === "expired") {
          schoolsNeedingAttention += 1;
        }
      }

      const pendingSetupSchools = scopedSchools.filter((s) => s.status !== "active").length;

      res.json({
        totalSchools: scopedSchools.length,
        pendingSetupSchools,
        pendingAdminInviteSchools,
        pendingAdminAcceptanceSchools,
        setupInProgressSchools,
        activeSchools,
        suspendedSchools,
        pendingInvites,
        expiredInvites,
        schoolsNeedingAttention,
        recentActivity: recentActivityLogs
          .filter((log) => ["school_created", "school_updated", "school_setup_invite_sent", "school_setup_invite_resent", "support_mode_enter", "support_mode_exit", "invite_accepted", "school_setup_completed"].includes(log.action))
          .slice(0, 12)
          .map((log) => {
            const target = log.target || null;
            let targetLabel = target || "Platform";
            if (target && target.startsWith("school:")) {
              const school = schools.find((item) => item.id === target.slice("school:".length));
              if (school) {
                targetLabel = `${school.name} (${school.code})`;
              }
            }

            return {
              id: log.id,
              action: log.action,
              target,
              targetLabel,
              createdAt: log.createdAt,
              metadata: log.metadata ? JSON.parse(log.metadata) : null,
            };
          }),
      });
    } catch (e: any) {
      res.status(500).json({ message: e.message || "Failed to load owner dashboard" });
    }
  });

  // === ADMIN DASHBOARD SUMMARY (school-scoped) ===
  app.get("/api/admin/dashboard-summary", requireRole(...ADMIN_UI_ROLES), async (req, res) => {
    try {
      const ownerMode = isPlatformOwnerRequest(req);
      const sid = sessionSchoolId(req);

      const [
        books,
        students,
        classes,
        bookLevels,
        classBookLevels,
        linkingCodes,
        payments,
        allocations,
        extraRequests,
      ] = await Promise.all([
        storage.getBooks(sid),
        storage.getStudents(sid),
        storage.getClasses(sid),
        storage.getBookLevels(sid),
        storage.getClassBookLevels(sid),
        storage.getLinkingCodes(sid),
        storage.getPayments(undefined, sid),
        storage.getAllocations(undefined, sid),
        storage.getExtraCopyRequests({ schoolId: sid }),
      ]);

      const scopedBooks = !ownerMode && !sid ? books.filter((b) => !b.schoolId) : books;
      const scopedStudents = !ownerMode && !sid ? students.filter((s) => !s.schoolId) : students;
      const scopedClasses = !ownerMode && !sid ? classes.filter((c) => !c.schoolId) : classes;
      const scopedBookLevels = !ownerMode && !sid ? bookLevels.filter((b) => !b.schoolId) : bookLevels;
      const scopedClassBookLevels = !ownerMode && !sid ? classBookLevels.filter((c: any) => !c.class?.schoolId) : classBookLevels;
      const scopedLinkingCodes = !ownerMode && !sid ? linkingCodes.filter((c) => !c.schoolId) : linkingCodes;
      const scopedPayments = !ownerMode && !sid ? payments.filter((p) => !p.schoolId) : payments;
      const scopedAllocations = !ownerMode && !sid ? allocations.filter((a: any) => !a.schoolId) : allocations;
      const scopedExtraRequests = !ownerMode && !sid ? extraRequests.filter((r: any) => !r.schoolId) : extraRequests;
      const setupState = sid ? await getSchoolSetupState(sid) : null;

      const lowStockBooks = scopedBooks.filter(
        (b) => b.isActive && (b.stockQuantity ?? 0) < (b.lowStockThreshold ?? 10)
      ).length;

      const parentCodesGenerated = scopedLinkingCodes.length;
      const parentCodesUsed = scopedLinkingCodes.filter((c) => c.isUsed).length;
      const parentCodesNotSent = scopedLinkingCodes.filter((c) => !c.isUsed).length;
      // Approximate parents linked via used linking codes
      const parentsLinked = parentCodesUsed;

      const pendingPayments = scopedPayments.filter((p) => ["pending", "awaiting_reference", "reference_submitted", "needs_review"].includes(p.status!)).length;
      const paymentsSubmitted = scopedPayments.length;
      const paymentsVerified = scopedPayments.filter((p) => p.status === "completed" || p.status === "confirmed").length;

      const allocatedItems = scopedAllocations.filter((a: any) => a.status === "allocated");
      const readyForDistribution = allocatedItems.length;
      const teacherConfirmationsPending = allocatedItems.length;

      const extraCopyRequestsPending = scopedExtraRequests.filter((r: any) => r.status === "pending").length;

      const setupChecklist = setupState
        ? {
            schoolProfileComplete: setupState.checklist.schoolProfileComplete,
            brandingDesignConfigured: setupState.checklist.brandingDesignConfigured,
            classesCreated: setupState.checklist.classesCreated,
            booksAdded: setupState.checklist.booksAdded,
            bookLevelsCreated: setupState.checklist.bookLevelsCreated,
            bookLevelsAssignedToClasses: setupState.checklist.bookLevelsAssignedToClasses,
            studentsAdded: setupState.checklist.studentsAdded,
            parentCodesGenerated: setupState.checklist.parentCodesGenerated,
            parentsLinked: setupState.checklist.parentsLinked,
            paymentSetupReviewed: setupState.checklist.paymentSetupReviewed,
            operationalSetupComplete: setupState.checklist.operationalSetupComplete,
          }
        : {
            schoolProfileComplete: true,
            brandingDesignConfigured: false,
            classesCreated: scopedClasses.length > 0,
            booksAdded: scopedBooks.length > 0,
            bookLevelsCreated: scopedBookLevels.length > 0,
            bookLevelsAssignedToClasses: scopedClassBookLevels.length > 0,
            studentsAdded: scopedStudents.length > 0,
            parentCodesGenerated: parentCodesGenerated > 0,
            parentsLinked: parentCodesUsed > 0,
            paymentSetupReviewed: paymentsVerified > 0 || paymentsSubmitted > 0,
            operationalSetupComplete: false,
          };

      const setupDoneCount = Object.values(setupChecklist).filter(Boolean).length;
      const setupTotalCount = 11;
      const setupPercent = Math.round((setupDoneCount / setupTotalCount) * 100);

      res.json({
        school: setupState
          ? {
              id: setupState.school.id,
              name: setupState.school.name,
              code: setupState.school.code,
              status: setupState.school.status,
              setupStatus: setupState.setupStatus,
            }
          : null,
        totalBooks: scopedBooks.length,
        lowStockBooks,
        totalStudents: scopedStudents.length,
        parentsLinked,
        parentCodesNotSent,
        pendingPayments,
        paymentsSubmitted,
        paymentsVerified,
        readyForDistribution,
        teacherConfirmationsPending,
        extraCopyRequestsPending,
        totalClasses: scopedClasses.length,
        totalBookLevels: scopedBookLevels.length,
        totalLinkingCodes: parentCodesGenerated,
        setupMissingSteps: setupState?.missingSteps || [],
        setupNextAction: setupState?.nextRecommendedAction || null,
        setupProgress: {
          done: setupDoneCount,
          total: setupTotalCount,
          percent: setupPercent,
        },
        setupChecklist,
      });
    } catch (e: any) {
      console.error("Dashboard summary error:", e);
      // Return safe fallback data for any error so the dashboard still renders
      return res.json({
        totalBooks: 0,
        lowStockBooks: 0,
        totalStudents: 0,
        parentsLinked: 0,
        parentCodesNotSent: 0,
        pendingPayments: 0,
        paymentsSubmitted: 0,
        paymentsVerified: 0,
        readyForDistribution: 0,
        teacherConfirmationsPending: 0,
        extraCopyRequestsPending: 0,
        totalClasses: 0,
        totalBookLevels: 0,
        totalLinkingCodes: 0,
        school: null,
        setupMissingSteps: [],
        setupNextAction: null,
        setupProgress: {
          done: 1,
          total: 10,
          percent: 10,
        },
        setupChecklist: {
          schoolProfileComplete: true,
          classesCreated: false,
          booksAdded: false,
          bookLevelsCreated: false,
          bookLevelsAssignedToClasses: false,
          studentsAdded: false,
          parentCodesGenerated: false,
          parentsLinked: false,
          paymentSetupReviewed: false,
          operationalSetupComplete: false,
          schoolProfileCompleted: true,
          bookBundlesCreated: false,
          bundlesAssignedToClasses: false,
        },
        _error: e.message || "Failed to load dashboard data",
      });
    }
  });

  // === RECENT ACTIVITY (school-scoped audit log) ===
  app.get("/api/admin/recent-activity", requireRole(...ADMIN_UI_ROLES), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      const logs = await storage.getAuditLogs(100);

      if (isPlatformOwnerRequest(req)) {
        return res.json(logs.slice(0, 20));
      }

      if (!sid) {
        const own = logs.filter((log) => log.userId === req.session.userId);
        return res.json(own.slice(0, 20));
      }

      const users = await storage.getUsers();
      const userIdsInTenant = new Set(
        users
          .filter((u) => u.schoolId === sid)
          .map((u) => u.id),
      );

      const filtered = logs.filter((log) => {
        if (!log.userId) return false;
        return userIdsInTenant.has(log.userId);
      });

      res.json(filtered.slice(0, 20));
    } catch (e: any) {
      console.error("Recent activity error:", e);
      if (isDbUnavailableError(e)) {
        return res.json([]);
      }
      res.status(500).json({ message: "Failed to load recent activity" });
    }
  });

  // === REPORTS (school-scoped operational reports) ===

  app.get("/api/admin/reports", requireRole(...ADMIN_UI_ROLES), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);

      const [
        books,
        students,
        classes,
        bookLevels,
        classBookLevels,
        linkingCodes,
        payments,
        allocations,
        extraRequests,
        users,
        inventoryTx,
      ] = await Promise.all([
        storage.getBooks(sid),
        storage.getStudents(sid),
        storage.getClasses(sid),
        storage.getBookLevels(sid),
        storage.getClassBookLevels(sid),
        storage.getLinkingCodes(sid),
        storage.getPayments(undefined, sid),
        storage.getAllocations(undefined, sid),
        storage.getExtraCopyRequests({ schoolId: sid }),
        storage.getUsers(),
        storage.getInventoryTransactions(sid),
      ]);

      // Scope users to this school
      const schoolUsers = sid ? users.filter((u) => u.schoolId === sid) : users;

      // ── Inventory report ──
      const activeBooks = books.filter((b) => b.isActive);
      const totalStockValue = activeBooks.reduce((sum, b) => sum + (b.stockQuantity ?? 0) * Number(b.price ?? 0), 0);
      const lowStockBooks = activeBooks.filter((b) => (b.stockQuantity ?? 0) < (b.lowStockThreshold ?? 10));
      const outOfStockBooks = activeBooks.filter((b) => (b.stockQuantity ?? 0) === 0);

      // ── Payment report ──
      const paymentsByStatus = {
        awaiting_reference: payments.filter((p) => p.status === "awaiting_reference" || p.status === "pending"),
        reference_submitted: payments.filter((p) => p.status === "reference_submitted"),
        confirmed: payments.filter((p) => p.status === "confirmed" || p.status === "completed"),
        rejected: payments.filter((p) => p.status === "rejected" || p.status === "failed"),
        needs_review: payments.filter((p) => p.status === "needs_review"),
      };
      const totalRevenue = paymentsByStatus.confirmed.reduce((sum, p) => sum + Number(p.totalAmount ?? 0), 0);
      const pendingRevenue = [...paymentsByStatus.awaiting_reference, ...paymentsByStatus.reference_submitted, ...paymentsByStatus.needs_review].reduce((sum, p) => sum + Number(p.totalAmount ?? 0), 0);

      // ── Allocation / distribution report ──
      const allocationsByStatus = {
        allocated: allocations.filter((a: any) => a.status === "allocated"),
        confirmed: allocations.filter((a: any) => a.status === "received"),
        absent: allocations.filter((a: any) => a.status === "absent"),
      };

      // ── Extra copy request report ──
      const requestsByStatus = {
        pending: extraRequests.filter((r: any) => r.status === "pending"),
        approved: extraRequests.filter((r: any) => r.status === "approved"),
           rejected: extraRequests.filter((r: any) => r.status === "rejected"),
      };
      const requestsByReason: Record<string, number> = {};
      for (const r of extraRequests) {
        const reason = (r as any).reason || "OTHER";
        requestsByReason[reason] = (requestsByReason[reason] || 0) + 1;
      }

      // ── Class distribution report ──
      const classReport = classes.map((cls) => {
        const clsStudents = students.filter((s) => s.classId === cls.id);
        const clsAllocations = allocations.filter((a: any) => a.student?.classId === cls.id);
        const clsConfirmed = clsAllocations.filter((a: any) => a.status === "received");
        return {
          id: cls.id,
          name: cls.name,
          grade: cls.academicYear,
          studentCount: clsStudents.length,
          totalAllocations: clsAllocations.length,
          confirmedAllocations: clsConfirmed.length,
          completionRate: clsAllocations.length > 0
            ? Math.round((clsConfirmed.length / clsAllocations.length) * 100)
            : 0,
        };
      });

      // ── User report ──
      const usersByRole: Record<string, number> = {};
      for (const u of schoolUsers) {
        const role = u.role || "unknown";
        usersByRole[role] = (usersByRole[role] || 0) + 1;
      }

      // ── Parent linking report ──
      const codesTotal = linkingCodes.length;
      const codesUsed = linkingCodes.filter((c) => c.isUsed).length;
      const codesUnused = codesTotal - codesUsed;

      res.json({
        generatedAt: new Date().toISOString(),
        inventory: {
          totalBooks: books.length,
          activeBooks: activeBooks.length,
          totalStockUnits: activeBooks.reduce((s, b) => s + (b.stockQuantity ?? 0), 0),
          totalStockValue: Math.round(totalStockValue * 100) / 100,
          lowStockBooks: lowStockBooks.map((b) => ({ id: b.id, title: b.title, stock: b.stockQuantity, threshold: b.lowStockThreshold })),
          outOfStockCount: outOfStockBooks.length,
          recentTransactions: inventoryTx.slice(0, 20).map((t) => ({ id: t.id, bookId: t.bookId, type: t.transactionType, quantity: t.quantity, reason: t.reason, createdAt: t.createdAt })),
        },
        payments: {
          total: payments.length,
          awaitingReference: paymentsByStatus.awaiting_reference.length,
          referenceSubmitted: paymentsByStatus.reference_submitted.length,
          confirmed: paymentsByStatus.confirmed.length,
          rejected: paymentsByStatus.rejected.length,
          needsReview: paymentsByStatus.needs_review.length,
          totalRevenue: Math.round(totalRevenue * 100) / 100,
          pendingRevenue: Math.round(pendingRevenue * 100) / 100,
        },
        allocations: {
          total: allocations.length,
          allocated: allocationsByStatus.allocated.length,
          confirmed: allocationsByStatus.confirmed.length,
          absent: allocationsByStatus.absent.length,
          confirmationRate: allocations.length > 0
            ? Math.round((allocationsByStatus.confirmed.length / allocations.length) * 100)
            : 0,
        },
        extraCopyRequests: {
          total: extraRequests.length,
          pending: requestsByStatus.pending.length,
          approved: requestsByStatus.approved.length,
          rejected: requestsByStatus.rejected.length,
          byReason: requestsByReason,
        },
        classes: {
          total: classes.length,
          details: classReport,
        },
        students: {
          total: students.length,
        },
        users: {
          total: schoolUsers.length,
          byRole: usersByRole,
        },
        parentLinking: {
          totalCodes: codesTotal,
          used: codesUsed,
          unused: codesUnused,
          linkRate: codesTotal > 0 ? Math.round((codesUsed / codesTotal) * 100) : 0,
        },
        bookLevels: {
          total: bookLevels.length,
          assignedToClasses: classBookLevels.length,
        },
      });
    } catch (e: any) {
      console.error("Reports endpoint error:", e);
      res.status(500).json({ message: "Failed to generate reports" });
    }
  });

  // ── API catch-all: return JSON 404 for unknown /api routes ──
  app.all("/api/*path", (_req: Request, res: Response) => {
    res.status(404).json({ message: "API endpoint not found" });
  });

  return httpServer;
}
