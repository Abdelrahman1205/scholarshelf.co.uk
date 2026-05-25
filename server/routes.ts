import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { storage } from "./storage";
import { createExternalPayment, verifyWebhookSignature, isExternalIntegrationEnabled } from "./paymentIntegration";
import {
  signInSchema, signUpParentSchema, acceptInviteSchema,
  forgotPasswordSchema, resetPasswordSchema,
  LEGACY_ROLE_MAP, USER_ROLES,
} from "@shared/schema";

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
function sessionSchoolId(req: Request): string | null {
  return req.session.schoolId ?? null;
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

// Safe user response — strips passwordHash
function safeUser(user: { id: string; username: string; name: string; role: string; email: string | null; status: string; schoolId: string | null }) {
  return { id: user.id, username: user.username, name: user.name, role: user.role, email: user.email, status: user.status, schoolId: user.schoolId };
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
      const { username, password } = parsed.data;

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

      const dotIndex = token.indexOf(".");
      if (dotIndex === -1) {
        return res.status(400).json({ message: "Invalid invite link" });
      }
      const inviteId = token.substring(0, dotIndex);
      const rawToken = token.substring(dotIndex + 1);

      const invite = await storage.getInviteById(inviteId);
      if (!invite) {
        return res.status(400).json({ message: "Invalid or expired invite link" });
      }
      if (invite.status !== "pending") {
        return res.status(400).json({ message: "This invite has already been used or revoked" });
      }
      if (new Date() > invite.expiresAt) {
        return res.status(400).json({ message: "This invite has expired" });
      }

      const tokenValid = await bcrypt.compare(rawToken, invite.tokenHash);
      if (!tokenValid) {
        return res.status(400).json({ message: "Invalid invite link" });
      }

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
    } catch (e: any) {
      console.error("Accept-invite error:", e);
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

      const resetLink = `${req.protocol}://${req.get("host")}/reset-password?token=${invite.id}.${rawToken}`;
      console.log(`[PASSWORD RESET] Link for ${email}: ${resetLink}`);

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
    res.json(safeUser(user));
  });

  // === BOOKS (school-scoped) ===
  app.get("/api/books", requireAuth, async (req, res) => {
    const sid = sessionSchoolId(req);
    const books = await storage.getBooks(sid);
    res.json(books);
  });

  app.post("/api/books", requireRole("admin", "school_admin"), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      const book = await storage.createBook({ ...req.body, schoolId: sid });
      res.status(201).json(book);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.patch("/api/books/:id", requireRole("admin", "school_admin"), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      const book = await storage.updateBook(routeParam(req.params.id), req.body, sid);
      if (!book) return res.status(404).json({ message: "Book not found" });
      res.json(book);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.delete("/api/books/:id", requireRole("admin", "school_admin"), async (req, res) => {
    const sid = sessionSchoolId(req);
    await storage.deleteBook(routeParam(req.params.id), sid);
    res.status(204).send();
  });

  app.get("/api/books/low-stock", requireRole("admin", "school_admin"), async (req, res) => {
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
  app.post("/api/books/:id/stock", requireRole("admin", "school_admin"), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      const { quantity, type, reason } = req.body;
      const book = await storage.adjustStock(routeParam(req.params.id), quantity, type, reason, sid);
      res.json(book);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.get("/api/inventory-transactions", requireRole("admin", "school_admin"), async (req, res) => {
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

  app.post("/api/classes", requireRole("admin", "school_admin"), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      const cls = await storage.createClass({ ...req.body, schoolId: sid });
      res.status(201).json(cls);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.patch("/api/classes/:id", requireRole("admin", "school_admin"), async (req, res) => {
    const sid = sessionSchoolId(req);
    const cls = await storage.updateClass(routeParam(req.params.id), req.body, sid);
    if (!cls) return res.status(404).json({ message: "Class not found" });
    res.json(cls);
  });

  app.delete("/api/classes/:id", requireRole("admin", "school_admin"), async (req, res) => {
    const sid = sessionSchoolId(req);
    await storage.deleteClass(routeParam(req.params.id), sid);
    res.status(204).send();
  });

  // === STUDENTS (school-scoped) ===
  app.get("/api/students", requireRole("admin", "school_admin", "teacher"), async (req, res) => {
    const sid = sessionSchoolId(req);
    const students = await storage.getStudents(sid);
    res.json(students);
  });

  app.post("/api/students", requireRole("admin", "school_admin"), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      const student = await storage.createStudent({ ...req.body, schoolId: sid });
      res.status(201).json(student);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.patch("/api/students/:id", requireRole("admin", "school_admin"), async (req, res) => {
    const sid = sessionSchoolId(req);
    const student = await storage.updateStudent(routeParam(req.params.id), req.body, sid);
    if (!student) return res.status(404).json({ message: "Student not found" });
    res.json(student);
  });

  app.delete("/api/students/:id", requireRole("admin", "school_admin"), async (req, res) => {
    const sid = sessionSchoolId(req);
    await storage.deleteStudent(routeParam(req.params.id), sid);
    res.status(204).send();
  });

  // === BOOK LEVELS (school-scoped) ===
  app.get("/api/book-levels", requireRole("admin", "school_admin"), async (req, res) => {
    const sid = sessionSchoolId(req);
    const levels = await storage.getBookLevels(sid);
    res.json(levels);
  });

  app.post("/api/book-levels", requireRole("admin", "school_admin"), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      const level = await storage.createBookLevel({ ...req.body, schoolId: sid });
      res.status(201).json(level);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.patch("/api/book-levels/:id", requireRole("admin", "school_admin"), async (req, res) => {
    const sid = sessionSchoolId(req);
    const level = await storage.updateBookLevel(routeParam(req.params.id), req.body, sid);
    if (!level) return res.status(404).json({ message: "Book level not found" });
    res.json(level);
  });

  app.delete("/api/book-levels/:id", requireRole("admin", "school_admin"), async (req, res) => {
    const sid = sessionSchoolId(req);
    await storage.deleteBookLevel(routeParam(req.params.id), sid);
    res.status(204).send();
  });

  app.get("/api/book-levels/:id/items", requireRole("admin", "school_admin"), async (req, res) => {
    const items = await storage.getBookLevelItems(routeParam(req.params.id));
    res.json(items);
  });

  app.post("/api/book-levels/:id/items", requireRole("admin", "school_admin"), async (req, res) => {
    try {
      const item = await storage.addBookLevelItem({ ...req.body, bookLevelId: routeParam(req.params.id) });
      res.status(201).json(item);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.delete("/api/book-level-items/:id", requireRole("admin", "school_admin"), async (req, res) => {
    await storage.removeBookLevelItem(routeParam(req.params.id));
    res.status(204).send();
  });

  // === CLASS BOOK LEVELS (school-scoped) ===
  app.get("/api/class-book-levels", requireRole("admin", "school_admin"), async (req, res) => {
    const sid = sessionSchoolId(req);
    const cbls = await storage.getClassBookLevels(sid);
    res.json(cbls);
  });

  app.post("/api/class-book-levels", requireRole("admin", "school_admin"), async (req, res) => {
    try {
      const cbl = await storage.assignClassBookLevel(req.body);
      res.status(201).json(cbl);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  // === LINKING CODES (school-scoped) ===
  app.get("/api/linking-codes", requireRole("admin", "school_admin"), async (req, res) => {
    const sid = sessionSchoolId(req);
    const codes = await storage.getLinkingCodes(sid);
    res.json(codes);
  });

  app.post("/api/students/:id/linking-code", requireRole("admin", "school_admin"), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      const { parentEmail } = req.body;
      const code = generateLinkingCode();
      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + 3);

      const linkingCode = await storage.createLinkingCode({
        studentId: routeParam(req.params.id),
        code,
        parentEmail,
        expiresAt,
        schoolId: sid,
      });
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
  app.get("/api/admin/payments", requireRole("admin", "school_admin"), async (req, res) => {
    const sid = sessionSchoolId(req);
    const payments = await storage.getPayments(undefined, sid);
    res.json(payments);
  });

  app.post("/api/admin/payments/:id/confirm", requireRole("admin", "school_admin"), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      const payment = await storage.confirmPayment(routeParam(req.params.id), sid);
      res.json(payment);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.post("/api/admin/payments/:id/reject", requireRole("admin", "school_admin"), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      const payment = await storage.rejectPayment(routeParam(req.params.id), sid);
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

  app.post("/api/allocations", requireRole("admin", "school_admin"), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      const allocation = await storage.createAllocation({ ...req.body, schoolId: sid });
      res.status(201).json(allocation);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.post("/api/allocations/:id/confirm", requireAuth, async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      const allocation = await storage.confirmReceipt(routeParam(req.params.id), sid);
      res.json(allocation);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.post("/api/allocations/:id/absent", requireAuth, async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
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

  app.post("/api/extra-requests/:id/approve", requireRole("admin", "school_admin"), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      const request = await storage.approveExtraCopyRequest(routeParam(req.params.id), req.body.adminNotes, sid);
      res.json(request);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.post("/api/extra-requests/:id/reject", requireRole("admin", "school_admin"), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      const request = await storage.rejectExtraCopyRequest(routeParam(req.params.id), req.body.adminNotes, sid);
      res.json(request);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  // === USERS (admin-scoped, filtered by schoolId for school admins) ===
  app.get("/api/users", requireRole("admin", "school_admin"), async (req, res) => {
    const allUsers = await storage.getUsers();
    const sid = sessionSchoolId(req);
    // If admin has a schoolId, only show users from their school (or with no school)
    const filtered = sid
      ? allUsers.filter(u => u.schoolId === sid || u.schoolId === null)
      : allUsers;
    const safeUsers = filtered.map(({ passwordHash, ...u }) => u);
    res.json(safeUsers);
  });

  app.post("/api/users", requireRole("admin", "school_admin"), async (req, res) => {
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
      const hash = await bcrypt.hash(password, 12);
      const user = await storage.createUser({ username, passwordHash: hash, name, role, email, status: "active", schoolId: sid });
      const { passwordHash: _ph, ...safeUserData } = user;
      res.status(201).json(safeUserData);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.patch("/api/users/:id", requireRole("admin", "school_admin"), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      // Verify the target user belongs to this school
      const targetUser = await storage.getUserById(routeParam(req.params.id));
      if (!targetUser) return res.status(404).json({ message: "User not found" });
      if (sid && targetUser.schoolId !== sid && targetUser.schoolId !== null) {
        return res.status(403).json({ message: "Access denied" });
      }
      const { password, ...rest } = req.body;
      const updates: any = { ...rest };
      if (password) {
        updates.passwordHash = await bcrypt.hash(password, 12);
      }
      const user = await storage.updateUser(routeParam(req.params.id), updates);
      if (!user) return res.status(404).json({ message: "User not found" });
      const { passwordHash: _ph, ...safeUserData } = user;
      res.json(safeUserData);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.delete("/api/users/:id", requireRole("admin", "school_admin"), async (req, res) => {
    const sid = sessionSchoolId(req);
    const targetUser = await storage.getUserById(routeParam(req.params.id));
    if (!targetUser) return res.status(404).json({ message: "User not found" });
    if (sid && targetUser.schoolId !== sid && targetUser.schoolId !== null) {
      return res.status(403).json({ message: "Access denied" });
    }
    await storage.deleteUser(routeParam(req.params.id));
    res.status(204).send();
  });

  // === INVITE MANAGEMENT (admin only, school-scoped) ===
  app.post("/api/invites", requireRole("admin", "school_admin"), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      const { email, role } = req.body;
      if (!email || !role) {
        return res.status(400).json({ message: "Email and role are required" });
      }
      if (!USER_ROLES.includes(role) || role === "parent") {
        return res.status(400).json({ message: "Invalid role for invite. Parents self-register." });
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
        role,
        schoolId: sid,
        tokenHash,
        invitedBy: req.session.userId!,
        status: "pending",
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      const inviteLink = `${req.protocol}://${req.get("host")}/accept-invite?token=${invite.id}.${rawToken}`;
      console.log(`[INVITE] Link for ${email} (${role}): ${inviteLink}`);

      await auditLog(req, "invite_created", `invite:${invite.id}`, { email, role });

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
      const defaults = [
        { username: "admin", password: "admin123", name: "School Administrator", role: "admin", email: "admin@school.edu", status: "active" as const, schoolId: null },
        { username: "teacher", password: "teacher123", name: "Ms. Johnson", role: "teacher", email: "teacher@school.edu", status: "active" as const, schoolId: null },
        { username: "parent", password: "parent123", name: "John Smith", role: "parent", email: "parent@example.com", status: "active" as const, schoolId: null },
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

      const allUsers = await storage.getUsers();
      const teacherUser = allUsers.find((u) => u.role === "teacher");

      let classItem = (await storage.getClasses())[0];
      if (!classItem && teacherUser) {
        classItem = await storage.createClass({
          name: "Year 7 - A",
          academicYear: "2025/2026",
          teacherId: teacherUser.id,
        });
      }

      let books = await storage.getBooks();
      if (books.length === 0) {
        await storage.createBook({
          title: "Mathematics Essentials",
          author: "School Board",
          isbn: "9780000000001",
          price: "12.50",
          description: "Core maths textbook",
          isActive: true,
          stockQuantity: 100,
          lowStockThreshold: 10,
          reorderQuantity: 50,
        });
        await storage.createBook({
          title: "Science Fundamentals",
          author: "School Board",
          isbn: "9780000000002",
          price: "14.00",
          description: "Core science textbook",
          isActive: true,
          stockQuantity: 80,
          lowStockThreshold: 10,
          reorderQuantity: 50,
        });
        books = await storage.getBooks();
      }

      let students = await storage.getStudents();
      if (students.length === 0 && classItem) {
        await storage.createStudent({ name: "Amelia Carter", classId: classItem.id });
        await storage.createStudent({ name: "Noah Khan", classId: classItem.id });
        students = await storage.getStudents();
      }

      const allocations = await storage.getAllocations(classItem?.id);
      const hasAbsent = allocations.some((a: any) => a.status === "absent");
      if (!hasAbsent && students.length > 0 && books.length > 0) {
        const createdAllocation = await storage.createAllocation({
          studentId: students[0].id,
          bookId: books[0].id,
          basketId: null,
          status: "allocated",
        });
        await storage.markAllocationAbsent(createdAllocation.id);
      }

      const teacherRequests = teacherUser
        ? await storage.getExtraCopyRequests({ teacherId: teacherUser.id })
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
            notes: "Demo pending request",
            status: "pending",
          });
        }

        if (!hasResolvedRequest) {
          const resolved = await storage.createExtraCopyRequest({
            teacherId: teacherUser.id,
            classId: classItem.id,
            bookId: books[0].id,
            quantity: 1,
            reason: "DAMAGED_IN_CLASS",
            notes: "Demo request to resolve",
            status: "pending",
          });
          await storage.approveExtraCopyRequest(resolved.id, "Approved for demo data");
        }
      }

      const refreshedRequests = teacherUser
        ? await storage.getExtraCopyRequests({ teacherId: teacherUser.id })
        : [];
      const refreshedAllocations = await storage.getAllocations(classItem?.id);

      res.json({
        message: "Seed completed",
        createdUsers: created,
        summary: {
          hasAbsentAllocation: refreshedAllocations.some((a: any) => a.status === "absent"),
          pendingExtraRequests: refreshedRequests.filter((r: any) => r.status === "pending").length,
          resolvedExtraRequests: refreshedRequests.filter((r: any) => r.status !== "pending").length,
        },
      });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // === ADMIN DASHBOARD SUMMARY (school-scoped) ===
  app.get("/api/admin/dashboard-summary", requireRole("admin", "school_admin"), async (req, res) => {
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

      const lowStockBooks = books.filter(
        (b) => b.isActive && (b.stockQuantity ?? 0) < (b.lowStockThreshold ?? 10)
      ).length;

      const parentCodesGenerated = linkingCodes.length;
      const parentCodesUsed = linkingCodes.filter((c) => c.isUsed).length;
      const parentCodesNotSent = linkingCodes.filter((c) => !c.isUsed).length;
      // Approximate parents linked via used linking codes
      const parentsLinked = parentCodesUsed;

      const pendingPayments = payments.filter((p) => p.status === "pending").length;
      const paymentsSubmitted = payments.length;
      const paymentsVerified = payments.filter((p) => p.status === "completed").length;

      const allocatedItems = allocations.filter((a: any) => a.status === "allocated");
      const readyForDistribution = allocatedItems.length;
      const teacherConfirmationsPending = allocatedItems.length;

      const extraCopyRequestsPending = extraRequests.filter((r: any) => r.status === "pending").length;

      const setupChecklist = {
        schoolProfileCompleted: true, // Admin is authenticated — account exists
        classesCreated: classes.length > 0,
        booksAdded: books.length > 0,
        bookBundlesCreated: bookLevels.length > 0,
        bundlesAssignedToClasses: classBookLevels.length > 0,
        studentsAdded: students.length > 0,
        parentCodesGenerated: parentCodesGenerated > 0,
        parentsLinked: parentCodesUsed > 0,
        paymentSetupReviewed: paymentsVerified > 0 || paymentsSubmitted > 0,
      };

      res.json({
        totalBooks: books.length,
        lowStockBooks,
        totalStudents: students.length,
        parentsLinked,
        parentCodesNotSent,
        pendingPayments,
        paymentsSubmitted,
        paymentsVerified,
        readyForDistribution,
        teacherConfirmationsPending,
        extraCopyRequestsPending,
        totalClasses: classes.length,
        totalBookLevels: bookLevels.length,
        totalLinkingCodes: parentCodesGenerated,
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
          setupChecklist: {
            schoolProfileCompleted: true,
            classesCreated: false,
            booksAdded: false,
            bookBundlesCreated: false,
            bundlesAssignedToClasses: false,
            studentsAdded: false,
            parentCodesGenerated: false,
            parentsLinked: false,
            paymentSetupReviewed: false,
          },
        });
      }
      res.status(500).json({ message: "Failed to load dashboard summary" });
    }
  });

  // === RECENT ACTIVITY (school-scoped audit log) ===
  app.get("/api/admin/recent-activity", requireRole("admin", "school_admin"), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      const logs = await storage.getAuditLogs(100);

      if (!sid) {
        return res.json(logs.slice(0, 20));
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
