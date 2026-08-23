/**
 * server/routes/mfa.routes.ts
 *
 * Multi-factor authentication (TOTP) endpoints:
 *   - /api/auth/mfa/verify           complete a login challenged by MFA (partial-auth session)
 *   - /api/auth/mfa/status           whether the signed-in user has MFA enabled
 *   - /api/auth/mfa/setup            begin enrolment (generate secret + otpauth URI)
 *   - /api/auth/mfa/enable           confirm a code and turn MFA on (returns recovery codes once)
 *   - /api/auth/mfa/disable          turn MFA off (password required)
 *   - /api/auth/mfa/recovery-codes   regenerate recovery codes (password required)
 */
import type { Express } from "express";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { storage } from "../storage.js";
import { getDb } from "../config/database.js";
import { users } from "../../shared/schema.js";
import {
  requireAuth, resolveRole, auditLog, safeUser, buildAuthUserResponse, rateLimit,
  isPlatformOwnerRole,
} from "../middleware/auth.js";
import { getSessionMaxAge } from "../app.js";
import {
  generateSecret, verifyTOTP, otpauthURL, generateRecoveryCodes, hashRecoveryCode, matchRecoveryCode,
} from "../mfa.js";

function parseHashes(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((h) => typeof h === "string") : [];
  } catch {
    return [];
  }
}

export function registerMfaRoutes(app: Express): void {
  // ── Complete a login that was challenged for MFA (uses the partial-auth marker) ──
  app.post("/api/auth/mfa/verify", async (req, res) => {
    try {
      const pending = req.session.pendingMfa;
      if (!pending?.userId || pending.expiresAt < Date.now()) {
        return res.status(401).json({ message: "No MFA challenge in progress. Please sign in again." });
      }
      if (await rateLimit(`mfa-verify:${pending.userId}`, 10, 15 * 60 * 1000)) {
        return res.status(429).json({ message: "Too many attempts. Please sign in again later." });
      }

      const token = String(req.body?.token || "").trim();
      const recovery = String(req.body?.recoveryCode || "").trim();
      const user = await storage.getUserById(pending.userId);
      if (!user || !user.mfaEnabled || !user.mfaSecret) {
        return res.status(401).json({ message: "MFA is not configured for this account." });
      }

      let ok = false;
      let usedRecovery = false;
      if (token) {
        ok = verifyTOTP(user.mfaSecret, token);
      } else if (recovery) {
        const hashes = parseHashes(user.mfaRecoveryCodes);
        const matched = matchRecoveryCode(recovery, hashes);
        if (matched) {
          ok = true;
          usedRecovery = true;
          const remaining = hashes.filter((h) => h !== matched); // single-use
          await getDb().update(users).set({ mfaRecoveryCodes: JSON.stringify(remaining) }).where(eq(users.id, user.id));
        }
      }

      if (!ok) {
        await auditLog(req, "login_mfa_failed", `user:${user.id}`).catch(() => {});
        return res.status(401).json({ message: "Invalid code. Please try again." });
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
        if (req.session.cookie) req.session.cookie.maxAge = getSessionMaxAge(resolveRole(user.role));
        storage.updateLastLogin(user.id).catch(() => {});
        auditLog(req, usedRecovery ? "login_mfa_recovery_used" : "login_mfa_success", `user:${user.id}`).catch(() => {});
        buildAuthUserResponse(req, user).then((r) => res.json(r)).catch(() => res.json(safeUser(user)));
      });
    } catch (e: any) {
      console.error("MFA verify error:", e);
      res.status(500).json({ message: "Verification failed" });
    }
  });

  // ── Status for the signed-in user ──
  app.get("/api/auth/mfa/status", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUserById(req.session.userId!);
      if (!user) return res.status(404).json({ message: "User not found" });
      res.json({
        enabled: !!user.mfaEnabled,
        enrolledAt: user.mfaEnrolledAt ?? null,
        recoveryCodesRemaining: user.mfaEnabled ? parseHashes(user.mfaRecoveryCodes).length : 0,
      });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // ── Begin enrolment: generate a secret held server-side, return the otpauth URI ──
  app.post("/api/auth/mfa/setup", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUserById(req.session.userId!);
      if (!user) return res.status(404).json({ message: "User not found" });
      if (user.mfaEnabled) return res.status(400).json({ message: "MFA is already enabled. Disable it first to re-enrol." });

      const secret = generateSecret();
      req.session.pendingMfaSetupSecret = secret;
      const account = user.email || user.username;
      res.json({ secret, otpauthUrl: otpauthURL(secret, account) });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // ── Confirm a code and enable MFA — returns the plaintext recovery codes ONCE ──
  app.post("/api/auth/mfa/enable", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUserById(req.session.userId!);
      if (!user) return res.status(404).json({ message: "User not found" });
      if (user.mfaEnabled) return res.status(400).json({ message: "MFA is already enabled." });

      const secret = req.session.pendingMfaSetupSecret;
      if (!secret) return res.status(400).json({ message: "Start setup first, then enter a code." });

      const token = String(req.body?.token || "").trim();
      if (!verifyTOTP(secret, token)) {
        return res.status(400).json({ message: "That code didn't match. Check your authenticator app and try again." });
      }

      const recoveryCodes = generateRecoveryCodes(10);
      await getDb().update(users).set({
        mfaEnabled: true,
        mfaSecret: secret,
        mfaRecoveryCodes: JSON.stringify(recoveryCodes.map(hashRecoveryCode)),
        mfaEnrolledAt: new Date(),
      }).where(eq(users.id, user.id));
      req.session.pendingMfaSetupSecret = null;
      req.session.mfaEnabled = true;

      await auditLog(req, "mfa_enabled", `user:${user.id}`).catch(() => {});
      res.json({ enabled: true, recoveryCodes });
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  // ── Disable MFA (password confirmation required) ──
  app.post("/api/auth/mfa/disable", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUserById(req.session.userId!);
      if (!user) return res.status(404).json({ message: "User not found" });
      if (!user.mfaEnabled) return res.status(400).json({ message: "MFA is not enabled." });

      // SECURITY: MFA is mandatory for platform-owner roles — these accounts can
      // reach every tenant's data. Allowing self-service disable would make the
      // requirement advisory.
      if (isPlatformOwnerRole(user.role)) {
        return res.status(403).json({
          message: "Two-factor authentication cannot be disabled on a platform administrator account.",
        });
      }

      const password = String(req.body?.password || "");
      if (!(await bcrypt.compare(password, user.passwordHash))) {
        return res.status(401).json({ message: "Incorrect password." });
      }

      await getDb().update(users).set({
        mfaEnabled: false,
        mfaSecret: null,
        mfaRecoveryCodes: null,
        mfaEnrolledAt: null,
      }).where(eq(users.id, user.id));
      req.session.pendingMfaSetupSecret = null;
      req.session.mfaEnabled = false;

      await auditLog(req, "mfa_disabled", `user:${user.id}`).catch(() => {});
      res.json({ enabled: false });
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  // ── Regenerate recovery codes (password confirmation required) ──
  app.post("/api/auth/mfa/recovery-codes", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUserById(req.session.userId!);
      if (!user || !user.mfaEnabled) return res.status(400).json({ message: "MFA is not enabled." });

      const password = String(req.body?.password || "");
      if (!(await bcrypt.compare(password, user.passwordHash))) {
        return res.status(401).json({ message: "Incorrect password." });
      }

      const recoveryCodes = generateRecoveryCodes(10);
      await getDb().update(users).set({
        mfaRecoveryCodes: JSON.stringify(recoveryCodes.map(hashRecoveryCode)),
      }).where(eq(users.id, user.id));

      await auditLog(req, "mfa_recovery_regenerated", `user:${user.id}`).catch(() => {});
      res.json({ recoveryCodes });
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });
}
