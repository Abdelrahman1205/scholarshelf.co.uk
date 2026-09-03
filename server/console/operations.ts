/**
 * server/console/operations.ts
 *
 * Tier 1 of the console: typed, named support actions.
 *
 * This is the tier that makes support FASTER, not just safer. Roughly ninety
 * percent of what BytHub actually does to a live tenant is one of a short list
 * of predictable jobs. Expressing them as parameterised operations means no SQL
 * is typed, so no SQL can be wrong — and each one carries its own before/after
 * snapshot into the audit trail for free.
 *
 * Adding a support capability is a single explicit operation here. Recurring
 * support work belongs in this typed, authorised and audited layer rather than
 * in an unrestricted database-write console.
 */
import { z } from "zod";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import type { Request } from "express";
import { storage } from "../storage.js";
import { getDb } from "../config/database.js";
import { users, bookPayments } from "../../shared/schema.js";
import { PAYMENT_STATUSES } from "../../shared/schema.js";
import { getPublicBaseUrl, getEmailBrandingForSchool } from "../middleware/auth.js";
import { sendPasswordResetEmail, isResendConfigured } from "../email.js";

export type OperationContext = {
  req: Request;
  actorUserId: string;
  reason: string | null;
};

export type Operation<S extends z.ZodTypeAny = z.ZodTypeAny> = {
  /** Shown in the console UI as the button label. */
  label: string;
  /** One line of help text under the label. */
  help: string;
  input: S;
  /** Written verbatim into the audit trail. */
  describe: (i: z.infer<S>) => string;
  /** Requires a typed reason in the UI, and is styled as dangerous. */
  destructive?: boolean;
  /** Rows about to change, captured for the before-snapshot. */
  before?: (i: z.infer<S>) => Promise<unknown>;
  run: (i: z.infer<S>, ctx: OperationContext) => Promise<unknown>;
};

// ── School lifecycle ────────────────────────────────────────────────────────

const schoolSuspend: Operation<z.ZodObject<any>> = {
  label: "Suspend school",
  help: "Blocks every user at the school from signing in. Reversible.",
  input: z.object({
    schoolId: z.string().min(1),
    note: z.string().min(3, "Say why in a few words."),
  }),
  describe: (i) => `Suspend school ${i.schoolId}`,
  destructive: true,
  before: (i) => storage.getSchoolById(i.schoolId),
  run: async (i) => storage.updateSchool(i.schoolId, { status: "suspended" } as any),
};

const schoolReactivate: Operation<z.ZodObject<any>> = {
  label: "Reactivate school",
  help: "Restores sign-in for a suspended school.",
  input: z.object({ schoolId: z.string().min(1) }),
  describe: (i) => `Reactivate school ${i.schoolId}`,
  before: (i) => storage.getSchoolById(i.schoolId),
  run: async (i) => storage.updateSchool(i.schoolId, { status: "active" } as any),
};

// ── User support ────────────────────────────────────────────────────────────

const userResetMfa: Operation<z.ZodObject<any>> = {
  label: "Clear MFA enrolment",
  help: "For a user who has lost their authenticator AND their recovery codes.",
  input: z.object({
    userId: z.string().min(1),
    note: z.string().min(10, "Record how you verified their identity."),
  }),
  describe: (i) => `Clear MFA enrolment for user ${i.userId}`,
  destructive: true,
  before: async (i) => {
    const [row] = await getDb()
      .select({ id: users.id, username: users.username, mfaEnabled: users.mfaEnabled })
      .from(users).where(eq(users.id, i.userId));
    return row ?? null;
  },
  run: async (i) =>
    getDb().update(users)
      .set({ mfaEnabled: false, mfaSecret: null, mfaRecoveryCodes: null, mfaEnrolledAt: null })
      .where(eq(users.id, i.userId))
      .returning({ id: users.id, username: users.username, mfaEnabled: users.mfaEnabled }),
};

const userSendPasswordReset: Operation<z.ZodObject<any>> = {
  label: "Send password reset",
  help: "Emails the user a reset link. You never see or set their password.",
  input: z.object({ userId: z.string().min(1) }),
  describe: (i) => `Send a password reset email to user ${i.userId}`,
  run: async (i, ctx) => {
    const user = await storage.getUserById(i.userId);
    if (!user) throw new Error("User not found.");
    if (!user.email) throw new Error("That account has no email address on file.");

    // Same mechanism as /api/auth/forgot-password — a hashed, single-use,
    // one-hour token. Support triggers the email; the user chooses the password,
    // so BytHub never handles a customer credential.
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = await bcrypt.hash(rawToken, 10);
    const invite = await storage.createInvite({
      email: user.email,
      role: "__password_reset__",
      schoolId: null,
      tokenHash,
      invitedBy: ctx.actorUserId,
      status: "pending",
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    } as any);

    const resetLink = `${getPublicBaseUrl(ctx.req)}/reset-password?token=${invite.id}.${rawToken}`;
    const branding = await getEmailBrandingForSchool(ctx.req, user.schoolId);
    const sent = await sendPasswordResetEmail(user.email, resetLink, branding);

    if (!sent) {
      console.error(`[console] password reset delivery failed for user ${user.id}.`);
      if (!isResendConfigured()) {
        console.warn("[console] Resend not configured; password reset email cannot be delivered.");
      }
    }
    // Never return the link itself — it would land in the audit trail as a
    // live credential.
    return { emailed: sent, email: user.email };
  },
};

// ── Finance ─────────────────────────────────────────────────────────────────

const paymentCorrectStatus: Operation<z.ZodObject<any>> = {
  label: "Correct payment status",
  help: "For a payment stuck in the wrong state. Use the school's own record as the source of truth.",
  input: z.object({
    paymentId: z.string().min(1),
    status: z.enum(PAYMENT_STATUSES),
    note: z.string().min(10, "Record what the school confirmed."),
  }),
  describe: (i) => `Set payment ${i.paymentId} to "${i.status}"`,
  destructive: true,
  before: async (i) => {
    const [row] = await getDb().select().from(bookPayments).where(eq(bookPayments.id, i.paymentId));
    return row ?? null;
  },
  run: async (i) =>
    getDb().update(bookPayments)
      .set({ status: i.status })
      .where(eq(bookPayments.id, i.paymentId))
      .returning(),
};

export const OPERATIONS = {
  "school.suspend":            schoolSuspend,
  "school.reactivate":         schoolReactivate,
  "user.reset_mfa":            userResetMfa,
  "user.send_password_reset":  userSendPasswordReset,
  "payment.correct_status":    paymentCorrectStatus,
} as const;

export type OperationName = keyof typeof OPERATIONS;

/** Catalogue for the console UI — no executable bits leave the server. */
export function operationCatalogue() {
  return Object.entries(OPERATIONS).map(([name, op]) => ({
    name,
    label: op.label,
    help: op.help,
    destructive: !!op.destructive,
    fields: Object.entries((op.input as any).shape ?? {}).map(([key, def]: [string, any]) => ({
      key,
      optional: typeof def?.isOptional === "function" ? def.isOptional() : false,
      type: def?._def?.typeName === "ZodEnum" ? "enum" : "string",
      options: def?._def?.values ?? null,
    })),
  }));
}
