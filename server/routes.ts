import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { storage } from "./storage.js";
import { createExternalPayment, verifyWebhookSignature, isExternalIntegrationEnabled } from "./paymentIntegration.js";
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
  LEGACY_ROLE_MAP, USER_ROLES,
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
  if (!req.session.userId) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  next();
}

function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    if (!roles.includes(req.session.role!)) {
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
      return res.status(201).json(safeUser(user));
    }
    req.session.userId = user.id;
    req.session.role = user.role;
    req.session.schoolId = user.schoolId;
    res.status(201).json(safeUser(user));
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

function isPlatformOwnerRole(role: string | null | undefined): boolean {
  if (!role) return false;
  const normalized = resolveRole(role);
  return PLATFORM_OWNER_ROLES.includes(normalized);
}

function isPlatformOwnerRequest(req: Request): boolean {
  return isPlatformOwnerRole(req.session.role);
}

// Safe user response — strips passwordHash
function safeUser(user: { id: string; username: string; name: string; role: string; email: string | null; status: string; schoolId: string | null }) {
  return { id: user.id, username: user.username, name: user.name, role: user.role, email: user.email, status: user.status, schoolId: user.schoolId };
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
  const [school, users, classes, books, bookLevels, classBookLevels, students, linkingCodes, payments] = await Promise.all([
    storage.getSchoolById(schoolId),
    storage.getUsers(),
    storage.getClasses(schoolId),
    storage.getBooks(schoolId),
    storage.getBookLevels(schoolId),
    storage.getClassBookLevels(schoolId),
    storage.getStudents(schoolId),
    storage.getLinkingCodes(schoolId),
    storage.getPayments(undefined, schoolId),
  ]);

  if (!school) return null;

  const schoolUsers = users.filter((user) => user.schoolId === schoolId);
  const activeSchoolAdmins = schoolUsers.filter((user) => resolveRole(user.role) === "school_admin" && user.status === "active");
  const teachers = schoolUsers.filter((user) => resolveRole(user.role) === "teacher" && user.status === "active");
  const setupStatus = normalizeSchoolSetupStatus(school.setupStatus as string | null | undefined, school.status);

  const schoolProfileComplete = !!(school.name && school.code);
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
      verifiedPayments: payments.filter((payment) => payment.status === "completed").length,
      pendingPayments: payments.filter((payment) => payment.status === "pending").length,
    },
    checklist,
    missingStepKeys,
    missingSteps,
    nextRecommendedAction,
    readyForOperationalCompletion,
    operationalSetupComplete,
    completionRules: [
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
        req.session.schoolId = user.schoolId;

        storage.updateLastLogin(user.id).catch(() => {});
        auditLog(req, "login_success", `user:${user.id}`).catch(() => {});

        res.json(safeUser(user));
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
          return res.status(201).json(safeUser(user));
        }
        req.session.userId = user.id;
        req.session.role = user.role;
        req.session.schoolId = null;
        res.status(201).json(safeUser(user));
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
      const inviteStatus = deriveInviteStatus(invite);
      res.json({
        id: invite.id,
        email: invite.email,
        inviteeName: invite.inviteeName || null,
        role: invite.role,
        schoolId: invite.schoolId,
        schoolName: school?.name || null,
        schoolCode: school?.code || null,
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
      const sent = await sendPasswordResetEmail(email, resetLink);
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
    const user = await storage.getUserById(req.session.userId);
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }
    if (user.status !== "active") {
      req.session.destroy(() => {});
      return res.status(401).json({ message: "Account is not active" });
    }
    const response: any = safeUser(user);
    // Include support mode state for owner users
    if (isPlatformOwnerRole(user.role)) {
      response.supportMode = {
        active: !!req.session.supportSchoolId,
        schoolId: req.session.supportSchoolId || null,
        schoolName: req.session.supportSchoolName || null,
      };
    }
    res.json(response);
  });

  // === BOOKS (school-scoped) ===
  app.get("/api/books", requireAuth, async (req, res) => {
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

  // === CLASSES (school-scoped) ===
  app.get("/api/classes", requireAuth, async (req, res) => {
    const sid = sessionSchoolId(req);
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
    const students = await storage.getStudents(sid);
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

  app.delete("/api/students/:id", requireRole(...ADMIN_UI_ROLES), async (req, res) => {
    const sid = sessionSchoolId(req);
    await storage.deleteStudent(routeParam(req.params.id), sid);
    res.status(204).send();
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

  // === PARENT ENDPOINTS ===
  app.post("/api/parent/link-child", requireRole("parent"), async (req, res) => {
    try {
      const { code } = req.body;
      const user = await storage.getUserById(req.session.userId!);
      if (!user?.email) return res.status(400).json({ message: "No email set for your account" });
      const result = await storage.useLinkingCode(code, user.email);
      if (!result) return res.status(404).json({ message: "Invalid or already used linking code" });
      res.json(result);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.get("/api/parent/children", requireRole("parent"), async (req, res) => {
    const user = await storage.getUserById(req.session.userId!);
    if (!user?.email) return res.status(400).json({ message: "No email set for your account" });
    const children = await storage.getParentChildren(user.email);
    res.json(children);
  });

  app.post("/api/parent/children/:id/basket", requireRole("parent"), async (req, res) => {
    try {
      const user = await storage.getUserById(req.session.userId!);
      if (!user?.email) return res.status(400).json({ message: "No email set for your account" });
      // Parent doesn't have a schoolId, but generateBasket derives it from the student
      const basket = await storage.generateBasket(routeParam(req.params.id), user.email);
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

  app.post("/api/parent/payments", requireRole("parent"), async (req, res) => {
    try {
      const user = await storage.getUserById(req.session.userId!);
      if (!user?.email) return res.status(400).json({ message: "No email set for your account" });
      const { basketIds, paymentMethod, paymentReference } = req.body;
      const loadedBaskets = [];
      let total = 0;
      for (const id of basketIds) {
        const basket = await storage.getBasket(id);
        if (!basket) return res.status(404).json({ message: `Basket ${id} not found` });
        // Verify this basket belongs to the parent
        if (basket.parentIdentifier !== user.email) {
          return res.status(403).json({ message: "Access denied" });
        }
        loadedBaskets.push(basket);
        total += parseFloat(basket.totalAmount);
      }

      const reference = paymentReference || generatePaymentReference();

      let externalPaymentId: string | undefined;
      let externalPaymentStatus: string | undefined;

      if (isExternalIntegrationEnabled() && loadedBaskets.length > 0) {
        const firstBasket = loadedBaskets[0];
        const extResult = await createExternalPayment({
          eduBookReference: reference,
          studentName: firstBasket.student?.name || "Unknown",
          studentClass: firstBasket.student?.class?.name || "Unknown",
          parentEmail: user.email,
          amountGBP: total,
          items: (firstBasket.items || []).map((item: any) => ({
            title: item.book?.title || "Book",
            quantity: item.quantity || 1,
            unitPrice: parseFloat(item.unitPrice || "0"),
          })),
        });
        if (extResult) {
          externalPaymentId = extResult.externalPaymentId;
          externalPaymentStatus = extResult.externalStatus;
        }
      }

      // Derive schoolId from the first basket's student
      const firstStudent = loadedBaskets[0]?.student;
      const paymentSchoolId = firstStudent?.schoolId || loadedBaskets[0]?.schoolId || null;

      const payment = await storage.createPayment({
        parentIdentifier: user.email,
        totalAmount: total.toFixed(2),
        paymentMethod: paymentMethod || "bank_transfer",
        paymentReference: reference,
        status: "pending",
        externalPaymentId,
        externalPaymentStatus,
        schoolId: paymentSchoolId,
      }, basketIds);

      // Notify parent that payment submission has been received
      const submittedSent = await sendPaymentSubmittedEmail(
        user.email,
        reference,
        total.toFixed(2),
        paymentMethod || "bank_transfer"
      );
      if (!submittedSent) {
        console.log(`[PAYMENT SUBMITTED] Parent: ${user.email}, Ref: ${reference}, Amount: £${total.toFixed(2)}`);
        if (!isResendConfigured()) {
          console.warn("[Resend] RESEND_API_KEY not configured; using log fallback for payment submission email.");
        }
      }

      res.status(201).json(payment);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.get("/api/parent/payments", requireRole("parent"), async (req, res) => {
    const user = await storage.getUserById(req.session.userId!);
    if (!user?.email) return res.status(400).json({ message: "No email set for your account" });
    const payments = await storage.getPayments(user.email);
    res.json(payments);
  });

  // === ADMIN PAYMENTS (school-scoped) ===
  app.get("/api/admin/payments", requireRole(...ADMIN_UI_ROLES), async (req, res) => {
    const sid = sessionSchoolId(req);
    const payments = await storage.getPayments(undefined, sid);
    res.json(payments);
  });

  app.post("/api/admin/payments/:id/confirm", requireRole(...ADMIN_UI_ROLES), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      if (sid) {
        const setupState = await getSchoolSetupState(sid);
        if (!setupState) {
          return res.status(404).json({ message: "School not found" });
        }
        if (!setupState.operationalSetupComplete) {
          return res.status(409).json({
            message: "Complete school setup before confirming payments.",
            missingSteps: setupState.missingSteps,
          });
        }
      }
      const payment = await storage.confirmPayment(routeParam(req.params.id), sid);

      // Notify parent that payment has been verified
      if (payment?.parentIdentifier) {
        const sent = await sendPaymentVerifiedEmail(
          payment.parentIdentifier,
          payment.paymentReference || payment.id,
          payment.totalAmount || "0.00"
        );
        if (!sent) {
          console.log(`[PAYMENT VERIFIED] Parent: ${payment.parentIdentifier}, Ref: ${payment.paymentReference}`);
          if (!isResendConfigured()) {
            console.warn("[Resend] RESEND_API_KEY not configured; using log fallback for payment verified email.");
          }
        }
      }

      res.json(payment);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.post("/api/admin/payments/:id/reject", requireRole(...ADMIN_UI_ROLES), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      if (sid) {
        const setupState = await getSchoolSetupState(sid);
        if (!setupState) {
          return res.status(404).json({ message: "School not found" });
        }
        if (!setupState.operationalSetupComplete) {
          return res.status(409).json({
            message: "Complete school setup before processing payments.",
            missingSteps: setupState.missingSteps,
          });
        }
      }
      const payment = await storage.rejectPayment(routeParam(req.params.id), sid);

      // Notify parent that payment has been rejected
      if (payment?.parentIdentifier) {
        const sent = await sendPaymentRejectedEmail(
          payment.parentIdentifier,
          payment.paymentReference || payment.id,
          payment.totalAmount || "0.00"
        );
        if (!sent) {
          console.log(`[PAYMENT REJECTED] Parent: ${payment.parentIdentifier}, Ref: ${payment.paymentReference}`);
          if (!isResendConfigured()) {
            console.warn("[Resend] RESEND_API_KEY not configured; using log fallback for payment rejected email.");
          }
        }
      }

      res.json(payment);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  // === ALLOCATIONS (school-scoped) ===
  app.get("/api/allocations", requireAuth, async (req, res) => {
    const sid = sessionSchoolId(req);
    const classId = req.query.classId as string | undefined;
    const allocations = await storage.getAllocations(classId, sid);
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

  app.post("/api/allocations/:id/confirm", requireAuth, async (req, res) => {
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
      const allocation = await storage.confirmReceipt(routeParam(req.params.id), sid);
      res.json(allocation);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.post("/api/allocations/:id/absent", requireAuth, async (req, res) => {
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
      const allocation = await storage.markAllocationAbsent(routeParam(req.params.id), sid);
      res.json(allocation);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  // === EXTRA COPY REQUESTS (school-scoped) ===
  app.get("/api/extra-requests", requireAuth, async (req, res) => {
    const sid = sessionSchoolId(req);
    const filters: { teacherId?: string; status?: string; schoolId?: string | null } = { schoolId: sid };
    if (req.query.teacherId) filters.teacherId = req.query.teacherId as string;
    if (req.query.status) filters.status = req.query.status as string;
    // If teacher role, restrict to their own requests
    if (req.session.role === "teacher") {
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
      const users = await getScopedAdminUsers(req);
      const parentChildrenCount = new Map<string, number>();

      await Promise.all(users.map(async (user) => {
        if (resolveRole(user.role) !== "parent" || !user.email) return;
        const sid = sessionSchoolId(req);
        const children = await storage.getParentChildren(user.email);
        const scopedChildren = sid ? children.filter((child) => child.student?.schoolId === sid) : children;
        parentChildrenCount.set(user.id, scopedChildren.length);
      }));

      const payload = users.map((u) => formatUserForAdmin(u, {
        linkedChildrenCount: parentChildrenCount.get(u.id) ?? 0,
      }));
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
      const users = await getScopedAdminUsers(req);
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

        return formatUserForAdmin(parent, {
          schoolId: parent.schoolId || scopedLinks[0]?.student?.schoolId || "Not available",
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
      const { username, password, name, role, email } = req.body;
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

      const hash = await bcrypt.hash(password, 12);
      const user = await storage.createUser({ username, passwordHash: hash, name, role: normalizedRole, email, status: "active", schoolId: sid });
      const { passwordHash: _ph, ...safeUserData } = user;
      res.status(201).json(safeUserData);
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

      const { password, ...rest } = req.body;
      const updates: any = { ...rest };
      if (password) {
        updates.passwordHash = await bcrypt.hash(password, 12);
      }

      if (updates.role) {
        updates.role = resolveRole(updates.role);
      }

      const user = await storage.updateUser(routeParam(req.params.id), updates);
      if (!user) return res.status(404).json({ message: "User not found" });
      res.json(formatUserForAdmin(user));
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
      const sent = await sendInviteEmail(email, normalizedRole, inviteLink);
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
        await storage.confirmPayment(payment.id);
      } else if (status === "rejected" || status === "failed" || status === "cancelled") {
        await storage.rejectPayment(payment.id);
      }

      res.json({ message: "Payment updated", paymentId: payment.id });
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
  app.get("/api/owner/schools", requireRole(...PLATFORM_OWNER_ROLES), async (_req, res) => {
    try {
      const [schools, users, books, classes, students] = await Promise.all([
        storage.getSchools(),
        storage.getUsers(),
        storage.getBooks(),
        storage.getClasses(),
        storage.getStudents(),
      ]);

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
        const allSchools = await storage.getSchools();
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

  app.delete("/api/owner/schools/:id", requireRole(...PLATFORM_OWNER_ROLES), async (req, res) => {
    try {
      const id = routeParam(req.params.id);
      const school = await storage.getSchoolById(id);
      if (!school) return res.status(404).json({ message: "School not found" });

      if (school.status !== "suspended") {
        return res.status(409).json({
          message: "School must be suspended before deletion.",
        });
      }

      await storage.deleteSchoolAndRelatedData(id);
      await auditLog(req, "school_deleted", `school:${id}`, { code: school.code, name: school.name });
      res.status(204).send();
    } catch (e: any) {
      res.status(400).json({ message: e.message || "Failed to delete school" });
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
      const emailSent = await sendSchoolSetupInviteEmail(adminEmail, adminName, school.name, inviteLink);

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
      const emailSent = await sendSchoolSetupInviteEmail(invite.email, invite.inviteeName || "School Admin", school.name, inviteLink);

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
            firstAdminInviteStatus === "not_invited"
              ? "school_created_no_admin_invite"
              : firstAdminInviteStatus !== "accepted"
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
      const logs = await storage.getAuditLogs(200);
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
        .map((log) => ({
          id: log.id,
          action: log.action,
          target: log.target,
          actorUserId: log.userId,
          timestamp: log.createdAt,
          metadata: log.metadata ? JSON.parse(log.metadata) : null,
        }));

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
      const pendingPayments = payments.filter((p) => p.status === "pending").length;
      const paidOrders = payments.filter((p) => p.status === "completed").length;
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
          .map((log) => ({
            id: log.id,
            action: log.action,
            target: log.target,
            createdAt: log.createdAt,
            metadata: log.metadata ? JSON.parse(log.metadata) : null,
          })),
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

      const pendingPayments = scopedPayments.filter((p) => p.status === "pending").length;
      const paymentsSubmitted = scopedPayments.length;
      const paymentsVerified = scopedPayments.filter((p) => p.status === "completed").length;

      const allocatedItems = scopedAllocations.filter((a: any) => a.status === "allocated");
      const readyForDistribution = allocatedItems.length;
      const teacherConfirmationsPending = allocatedItems.length;

      const extraCopyRequestsPending = scopedExtraRequests.filter((r: any) => r.status === "pending").length;

      const setupChecklist = setupState
        ? {
            schoolProfileComplete: setupState.checklist.schoolProfileComplete,
            classesCreated: setupState.checklist.classesCreated,
            booksAdded: setupState.checklist.booksAdded,
            bookLevelsCreated: setupState.checklist.bookLevelsCreated,
            bookLevelsAssignedToClasses: setupState.checklist.bookLevelsAssignedToClasses,
            studentsAdded: setupState.checklist.studentsAdded,
            parentCodesGenerated: setupState.checklist.parentCodesGenerated,
            parentsLinked: setupState.checklist.parentsLinked,
            paymentSetupReviewed: setupState.checklist.paymentSetupReviewed,
            operationalSetupComplete: setupState.checklist.operationalSetupComplete,
            // Legacy aliases used by older UI labels
            schoolProfileCompleted: setupState.checklist.schoolProfileComplete,
            bookBundlesCreated: setupState.checklist.bookLevelsCreated,
            bundlesAssignedToClasses: setupState.checklist.bookLevelsAssignedToClasses,
          }
        : {
            schoolProfileComplete: true,
            classesCreated: scopedClasses.length > 0,
            booksAdded: scopedBooks.length > 0,
            bookLevelsCreated: scopedBookLevels.length > 0,
            bookLevelsAssignedToClasses: scopedClassBookLevels.length > 0,
            studentsAdded: scopedStudents.length > 0,
            parentCodesGenerated: parentCodesGenerated > 0,
            parentsLinked: parentCodesUsed > 0,
            paymentSetupReviewed: paymentsVerified > 0 || paymentsSubmitted > 0,
            operationalSetupComplete: false,
            schoolProfileCompleted: true,
            bookBundlesCreated: scopedBookLevels.length > 0,
            bundlesAssignedToClasses: scopedClassBookLevels.length > 0,
          };

      const setupDoneCount = Object.values(setupChecklist)
        .filter((value, index) => index < 10 && !!value)
        .length;
      const setupTotalCount = 10;
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
      if (isDbUnavailableError(e)) {
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
        });
      }
      res.status(500).json({ message: "Failed to load dashboard summary" });
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

  return httpServer;
}

