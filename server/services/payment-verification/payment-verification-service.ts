/**
 * server/services/payment-verification/payment-verification-service.ts
 *
 * The finance stage itself.
 *
 * An order reaching finance no longer waits for someone to press Confirm. It
 * comes here, gets checked against imported provider payments, and then either
 *
 *   · settles through the EXISTING approval path — `storage.confirmPayment()`
 *     plus the same `orderStatus` transition the manual button performs, so the
 *     order continues down the workflow that already exists; or
 *   · goes to `needs_review`, which is ScholarShelf's existing Finance
 *     Investigation state (see admin/reconciliation.tsx), with a recorded
 *     reason.
 *
 * It never rejects. A payment ScholarShelf cannot confirm is a question for a
 * Finance Officer, not a decision to make automatically.
 *
 * There is NO second workflow here. This module calls the same storage
 * functions the Confirm button calls; the only difference is who pressed it.
 */
import { and, desc, eq } from "drizzle-orm";
import { storage } from "../../storage.js";
import { getDb } from "../../config/database.js";
import {
  bookPayments, paymentVerificationAttempts, providerPayments,
  type BookPayment, type PaymentVerificationAttempt, type ProviderPayment,
  type VerificationMethod, type VerificationOutcome,
} from "../../../shared/schema.js";
import { findCandidatePayments, providerPaymentStats } from "./provider-payment-repository.js";
import { matchPayment, REASON_TEXT, type MatchDecision, type OrderToVerify } from "./payment-matcher.js";
import { SCHOLARSHELF_CURRENCY } from "./provider-payment.js";

/**
 * The order statuses that sit AT the finance stage — i.e. the ones automatic
 * verification is allowed to act on. Anything already confirmed or beyond is
 * left alone; anything before finance has not reached this stage yet.
 */
export const FINANCE_STAGE_STATUSES = ["reference_submitted", "needs_review"] as const;

export interface VerificationRunResult {
  paymentId: string;
  outcome: VerificationOutcome;
  method: VerificationMethod | null;
  reasonCode: string | null;
  reason: string | null;
  matchedProviderPaymentId: string | null;
  /** The order after the workflow acted on it. */
  payment: BookPayment | null;
  /** True when this call changed the order's status. */
  changed: boolean;
}

// ── Audit ───────────────────────────────────────────────────────────────────

/**
 * Append one verification attempt. Append-only by design: a manual override
 * that follows three failed automatic attempts leaves all four rows in place,
 * so "why was this approved by hand" is always answerable.
 */
export async function recordAttempt(input: {
  schoolId: string;
  paymentId: string;
  outcome: VerificationOutcome;
  method: VerificationMethod;
  reasonCode?: string | null;
  reasonDetail?: string | null;
  matchedProviderPaymentId?: string | null;
  candidateCount?: number;
  evidence?: Record<string, unknown> | null;
  actorUserId?: string | null;
}): Promise<void> {
  await getDb().insert(paymentVerificationAttempts).values({
    schoolId: input.schoolId,
    paymentId: input.paymentId,
    outcome: input.outcome,
    method: input.method,
    reasonCode: input.reasonCode ?? null,
    reasonDetail: input.reasonDetail ?? null,
    matchedProviderPaymentId: input.matchedProviderPaymentId ?? null,
    candidateCount: input.candidateCount ?? 0,
    evidence: input.evidence ? JSON.stringify(input.evidence).slice(0, 20000) : null,
    actorUserId: input.actorUserId ?? null,
  });
}

/** The most recent attempt for each of the given orders, for the finance UI. */
export async function latestAttemptsFor(
  schoolId: string,
  paymentIds: string[],
): Promise<Map<string, PaymentVerificationAttempt>> {
  const out = new Map<string, PaymentVerificationAttempt>();
  if (paymentIds.length === 0) return out;
  const rows: PaymentVerificationAttempt[] = await getDb()
    .select().from(paymentVerificationAttempts)
    .where(eq(paymentVerificationAttempts.schoolId, schoolId))
    .orderBy(desc(paymentVerificationAttempts.createdAt));
  for (const r of rows) {
    if (!out.has(r.paymentId)) out.set(r.paymentId, r);
  }
  return out;
}

/** Full history for one order, oldest first — never truncated or overwritten. */
export async function attemptHistory(schoolId: string, paymentId: string): Promise<PaymentVerificationAttempt[]> {
  return getDb().select().from(paymentVerificationAttempts)
    .where(and(
      eq(paymentVerificationAttempts.schoolId, schoolId),
      eq(paymentVerificationAttempts.paymentId, paymentId),
    ))
    .orderBy(paymentVerificationAttempts.createdAt);
}

// ── The finance stage ───────────────────────────────────────────────────────

function toOrder(p: BookPayment): OrderToVerify {
  return {
    id: p.id,
    schoolId: p.schoolId!,
    paymentReference: p.paymentReference,
    paymentReferenceNumber: p.paymentReferenceNumber,
    totalAmount: String(p.totalAmount ?? "0"),
    parentIdentifier: p.parentIdentifier,
  };
}

/**
 * Run automatic verification for ONE order.
 *
 * `actorUserId` is the user whose action caused the run (the parent submitting
 * their reference, or the finance user importing a Stripe file). The
 * VERIFICATION itself is still recorded as automatic — the point is that no
 * human judged the payment.
 */
export async function verifyOrder(
  paymentId: string,
  schoolId: string,
  opts: { actorUserId?: string | null; systemUserId?: string | null } = {},
): Promise<VerificationRunResult> {
  const db = getDb();
  const [order] = await db.select().from(bookPayments)
    .where(and(eq(bookPayments.id, paymentId), eq(bookPayments.schoolId, schoolId)));

  if (!order) throw Object.assign(new Error("Payment not found"), { httpStatus: 404 });

  // Only act at the finance stage. An order already confirmed (or collected)
  // must never be re-decided by an import running later.
  if (!(FINANCE_STAGE_STATUSES as readonly string[]).includes(order.status)) {
    return {
      paymentId, outcome: "verified", method: null, reasonCode: null, reason: null,
      matchedProviderPaymentId: null, payment: order, changed: false,
    };
  }

  const stats = await providerPaymentStats(db, schoolId);
  const candidates: ProviderPayment[] = await findCandidatePayments(db, schoolId, {
    scholarShelfReference: order.paymentReference,
    externalReference: order.paymentReferenceNumber,
    customerEmail: order.parentIdentifier,
  });

  const decision: MatchDecision = matchPayment(toOrder(order), candidates, {
    providerDataPresent: stats.total > 0,
  });

  if (decision.verified && decision.matched) {
    return applyAutomaticVerification(order, decision, opts.systemUserId ?? opts.actorUserId ?? null);
  }
  return applyInvestigation(order, decision);
}

/**
 * The automatic pass. Reuses the EXISTING approval path exactly:
 * `storage.confirmPayment` (which creates allocations and deducts stock,
 * idempotently) followed by the same order-status transition the manual
 * Confirm route performs.
 */
async function applyAutomaticVerification(
  order: BookPayment,
  decision: MatchDecision,
  systemUserId: string | null,
): Promise<VerificationRunResult> {
  const matched = decision.matched!;
  const note =
    `Automatically verified against Stripe ${matched.providerPaymentId} ` +
    `(${SCHOLARSHELF_CURRENCY} ${matched.amount}, ${matched.rawStatus || matched.status}).`;

  // `confirmPayment` requires a reviewer id for its audit fields. Automatic runs
  // may have no human at all (a cron/import), so fall back to the id already on
  // the order rather than inventing a user.
  const reviewer = systemUserId || order.paymentReferenceSubmittedBy || order.paymentReviewedBy || "system";

  const confirmed = await storage.confirmPayment(order.id, reviewer, note, order.schoolId);

  // Same transition the manual Confirm route performs. Reused, not reimplemented.
  try { await storage.updateOrderStatus(order.id, "ready_for_teacher_distribution", order.schoolId); } catch { /* non-fatal, as in the manual path */ }

  await getDb().update(bookPayments)
    .set({ verificationMethod: "automatic_stripe" })
    .where(eq(bookPayments.id, order.id));

  await recordAttempt({
    schoolId: order.schoolId!,
    paymentId: order.id,
    outcome: "verified",
    method: "automatic_stripe",
    matchedProviderPaymentId: matched.id,
    candidateCount: decision.candidates.length,
    evidence: decision.evidence,
    actorUserId: null, // no human judged this
  });

  return {
    paymentId: order.id,
    outcome: "verified",
    method: "automatic_stripe",
    reasonCode: null,
    reason: null,
    matchedProviderPaymentId: matched.id,
    payment: { ...confirmed, verificationMethod: "automatic_stripe" } as BookPayment,
    changed: true,
  };
}

/**
 * The cannot-confirm path. Routes the order to the Finance Officer's existing
 * worklist (`needs_review`) with the reason recorded — it does NOT reject.
 */
async function applyInvestigation(order: BookPayment, decision: MatchDecision): Promise<VerificationRunResult> {
  const reason = decision.reason ?? "Automatic payment verification could not confirm this order.";

  // Already in the investigation queue: record the fresh attempt (the evidence
  // may have changed since the last import) but do not re-write the status.
  const alreadyInvestigating = order.status === "needs_review";
  let payment: BookPayment = order;
  if (!alreadyInvestigating) {
    payment = await storage.markPaymentNeedsReview(
      order.id,
      order.paymentReferenceSubmittedBy || "system",
      `Automatic verification: ${reason}`,
      order.schoolId,
    );
  }

  await recordAttempt({
    schoolId: order.schoolId!,
    paymentId: order.id,
    outcome: "investigation",
    method: "automatic_stripe",
    reasonCode: decision.reasonCode,
    reasonDetail: reason,
    matchedProviderPaymentId: decision.matched?.id ?? null,
    candidateCount: decision.candidates.length,
    evidence: decision.evidence,
    actorUserId: null,
  });

  return {
    paymentId: order.id,
    outcome: "investigation",
    method: "automatic_stripe",
    reasonCode: decision.reasonCode,
    reason,
    matchedProviderPaymentId: decision.matched?.id ?? null,
    payment,
    changed: !alreadyInvestigating,
  };
}

/**
 * Re-run verification across every order currently sitting at the finance
 * stage. Called after a Stripe import, because the usual reason an order is
 * waiting is simply that its payment had not been imported yet.
 *
 * Orders past finance are untouched — see the guard in `verifyOrder`.
 */
export async function verifyPendingOrders(
  schoolId: string,
  opts: { actorUserId?: string | null; limit?: number } = {},
): Promise<{ examined: number; verified: number; investigation: number; results: VerificationRunResult[] }> {
  const db = getDb();
  const pending: BookPayment[] = await db.select().from(bookPayments)
    .where(and(
      eq(bookPayments.schoolId, schoolId),
      eq(bookPayments.status, "reference_submitted"),
    ))
    .orderBy(desc(bookPayments.paymentReferenceSubmittedAt))
    .limit(opts.limit ?? 500);

  const results: VerificationRunResult[] = [];
  let verified = 0, investigation = 0;
  for (const order of pending) {
    try {
      const r = await verifyOrder(order.id, schoolId, { systemUserId: opts.actorUserId ?? null });
      results.push(r);
      if (r.outcome === "verified" && r.changed) verified++;
      else if (r.outcome === "investigation") investigation++;
    } catch {
      // One bad order must never stop the sweep.
    }
  }
  return { examined: pending.length, verified, investigation, results };
}

/**
 * Refund / dispute surveillance.
 *
 * A payment that was good when it verified can go bad later — the refund or
 * chargeback shows up in a subsequent Stripe export. Silently leaving the order
 * verified would mean books issued against money the school no longer has, so
 * any already-verified order whose matched payment has since been refunded or
 * disputed is flagged for finance review.
 *
 * It deliberately does NOT un-confirm the order: allocations and stock have
 * already moved, and reversing that is a human decision.
 */
export async function flagReversedPayments(schoolId: string): Promise<{ flagged: number; details: Array<{ paymentId: string; reason: string }> }> {
  const db = getDb();
  const attempts: PaymentVerificationAttempt[] = await db.select()
    .from(paymentVerificationAttempts)
    .where(and(
      eq(paymentVerificationAttempts.schoolId, schoolId),
      eq(paymentVerificationAttempts.outcome, "verified"),
    ));

  const details: Array<{ paymentId: string; reason: string }> = [];
  const seen = new Set<string>();

  for (const a of attempts) {
    if (!a.matchedProviderPaymentId || seen.has(a.paymentId)) continue;
    seen.add(a.paymentId);

    const [provider] = await db.select().from(providerPayments)
      .where(eq(providerPayments.id, a.matchedProviderPaymentId));
    if (!provider) continue;

    const reversed = provider.disputed
      || provider.status === "disputed"
      || provider.status === "refunded"
      || provider.status === "partially_refunded"
      || Number(provider.amountRefunded ?? "0") > 0;
    if (!reversed) continue;

    const [order] = await db.select().from(bookPayments)
      .where(and(eq(bookPayments.id, a.paymentId), eq(bookPayments.schoolId, schoolId)));
    if (!order) continue;
    // Only orders that actually passed finance are interesting here.
    if (!["confirmed", "ready_for_collection", "collected"].includes(order.status)) continue;

    const reasonCode = provider.disputed || provider.status === "disputed" ? "payment_disputed" : "payment_refunded";
    const reason = `${REASON_TEXT[reasonCode]} This order had already passed finance verification — review whether books or a refund are owed.`;

    // Do not re-flag the same reversal every time an export is uploaded.
    const priorFlag = await db.select().from(paymentVerificationAttempts).where(and(
      eq(paymentVerificationAttempts.paymentId, order.id),
      eq(paymentVerificationAttempts.reasonCode, reasonCode),
    ));
    if (priorFlag.length > 0) continue;

    await recordAttempt({
      schoolId,
      paymentId: order.id,
      outcome: "investigation",
      method: "automatic_stripe",
      reasonCode,
      reasonDetail: reason,
      matchedProviderPaymentId: provider.id,
      evidence: {
        providerPaymentId: provider.providerPaymentId,
        status: provider.status,
        amountRefunded: provider.amountRefunded,
        disputed: provider.disputed,
        orderStatusAtFlag: order.status,
      },
      actorUserId: null,
    });
    details.push({ paymentId: order.id, reason });
  }

  return { flagged: details.length, details };
}

// ── Manual decisions by a Finance Officer ───────────────────────────────────

/**
 * A Finance Officer approving an order automatic verification could not.
 *
 * Uses the same `storage.confirmPayment` path, so the order continues down the
 * existing workflow identically — the only difference is the recorded method
 * and the required reason.
 */
export async function manuallyVerify(input: {
  paymentId: string;
  schoolId: string;
  actorUserId: string;
  reason: string;
}): Promise<VerificationRunResult> {
  const db = getDb();
  const [order] = await db.select().from(bookPayments)
    .where(and(eq(bookPayments.id, input.paymentId), eq(bookPayments.schoolId, input.schoolId)));
  if (!order) throw Object.assign(new Error("Payment not found"), { httpStatus: 404 });

  const reason = input.reason.trim();
  if (reason.length < 5) {
    throw Object.assign(
      new Error("A reason is required when approving a payment that automatic verification could not confirm."),
      { httpStatus: 400 },
    );
  }

  const confirmed = await storage.confirmPayment(order.id, input.actorUserId, reason, order.schoolId);
  try { await storage.updateOrderStatus(order.id, "ready_for_teacher_distribution", order.schoolId); } catch { /* as in the manual path */ }

  await db.update(bookPayments)
    .set({ verificationMethod: "manual_finance_override" })
    .where(eq(bookPayments.id, order.id));

  // The last automatic attempt tells us what the officer was overriding.
  const [lastAuto] = await db.select().from(paymentVerificationAttempts)
    .where(and(
      eq(paymentVerificationAttempts.paymentId, order.id),
      eq(paymentVerificationAttempts.method, "automatic_stripe"),
    ))
    .orderBy(desc(paymentVerificationAttempts.createdAt))
    .limit(1);

  await recordAttempt({
    schoolId: order.schoolId!,
    paymentId: order.id,
    outcome: "verified",
    method: "manual_finance_override",
    reasonDetail: reason,
    matchedProviderPaymentId: lastAuto?.matchedProviderPaymentId ?? null,
    evidence: {
      overrodeReasonCode: lastAuto?.reasonCode ?? null,
      overrodeReasonDetail: lastAuto?.reasonDetail ?? null,
    },
    actorUserId: input.actorUserId,
  });

  return {
    paymentId: order.id,
    outcome: "verified",
    method: "manual_finance_override",
    reasonCode: null,
    reason,
    matchedProviderPaymentId: lastAuto?.matchedProviderPaymentId ?? null,
    payment: { ...confirmed, verificationMethod: "manual_finance_override" } as BookPayment,
    changed: true,
  };
}

/** A Finance Officer deciding the payment was genuinely not received. */
export async function manuallyReject(input: {
  paymentId: string;
  schoolId: string;
  actorUserId: string;
  reason: string;
}): Promise<VerificationRunResult> {
  const reason = input.reason.trim();
  if (reason.length < 5) {
    throw Object.assign(new Error("A reason is required when rejecting a payment."), { httpStatus: 400 });
  }
  const rejected = await storage.rejectPayment(input.paymentId, input.actorUserId, reason, input.schoolId);

  await getDb().update(bookPayments)
    .set({ verificationMethod: "manual_finance_rejection" })
    .where(eq(bookPayments.id, input.paymentId));

  await recordAttempt({
    schoolId: input.schoolId,
    paymentId: input.paymentId,
    outcome: "rejected",
    method: "manual_finance_rejection",
    reasonDetail: reason,
    actorUserId: input.actorUserId,
  });

  return {
    paymentId: input.paymentId,
    outcome: "rejected",
    method: "manual_finance_rejection",
    reasonCode: null,
    reason,
    matchedProviderPaymentId: null,
    payment: { ...rejected, verificationMethod: "manual_finance_rejection" } as BookPayment,
    changed: true,
  };
}
