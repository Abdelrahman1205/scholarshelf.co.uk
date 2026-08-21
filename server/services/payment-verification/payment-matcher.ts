/**
 * server/services/payment-verification/payment-matcher.ts
 *
 * Decides whether a provider payment belongs to a ScholarShelf order, and
 * whether it is good enough to settle the finance stage without a human.
 *
 * The rule this file exists to enforce: **it is always better to ask a Finance
 * Officer than to verify the wrong payment.** Every ambiguity resolves to
 * investigation, never to approval.
 *
 * MATCH STRENGTH, strongest first:
 *   1. `strong`  — the order's own `paymentReference` (EDU-…, unique, and the
 *                  string the parent was told to quote) appears on the payment.
 *   2. `strong`  — the reference the parent typed in (`paymentReferenceNumber`)
 *                  is the provider's own payment/charge id (pi_… / ch_…). This
 *                  is what will normally happen once Stripe is live.
 *   3. `weak`    — same customer email, nothing else. NEVER auto-verifies.
 *
 * Customer name and amount are not match keys at all. Two families share a
 * surname; two orders share a price.
 */
import type { ProviderPayment } from "../../../shared/schema.js";
import {
  isVerifiableStatus, moneyEquals, SCHOLARSHELF_CURRENCY,
} from "./provider-payment.js";
import type { VerificationReasonCode } from "../../../shared/schema.js";

export type MatchStrength = "strong" | "weak";

export interface OrderToVerify {
  id: string;
  schoolId: string;
  /** ScholarShelf's own unique reference, e.g. EDU-M1A2B3-0F1E2D3C. */
  paymentReference: string | null;
  /** Whatever the parent typed when confirming they had paid. */
  paymentReferenceNumber: string | null;
  /** Decimal string, e.g. "120.00". */
  totalAmount: string;
  parentIdentifier: string | null;
}

export interface Candidate {
  payment: ProviderPayment;
  strength: MatchStrength;
  /** Which identifier connected this payment to the order. */
  matchedOn: "scholarshelf_reference" | "provider_payment_id" | "customer_email";
}

export interface MatchDecision {
  verified: boolean;
  reasonCode: VerificationReasonCode | null;
  /** One sentence a Finance Officer can act on. */
  reason: string | null;
  /** The payment used, or the best near-miss to show the officer. */
  matched: ProviderPayment | null;
  candidates: Candidate[];
  evidence: Record<string, unknown>;
}

/** Case-insensitive, whitespace-insensitive comparison of two references. */
const norm = (v: string | null | undefined) => (v ?? "").trim().toUpperCase();

/**
 * Classify every candidate the repository returned, strongest first.
 * The repository casts a wide net; this is where strength is decided.
 */
export function classifyCandidates(order: OrderToVerify, payments: ProviderPayment[]): Candidate[] {
  const ourRef = norm(order.paymentReference);
  const parentRef = norm(order.paymentReferenceNumber);
  const email = (order.parentIdentifier ?? "").trim().toLowerCase();

  const out: Candidate[] = [];
  for (const p of payments) {
    // 1. Our reference, carried on the payment (metadata, description, or a
    //    dedicated reference column).
    if (ourRef && (
      norm(p.reference) === ourRef ||
      (p.description && norm(p.description).includes(ourRef))
    )) {
      out.push({ payment: p, strength: "strong", matchedOn: "scholarshelf_reference" });
      continue;
    }
    // 2. The parent quoted the provider's own transaction id.
    if (parentRef && (norm(p.providerPaymentId) === parentRef || norm(p.providerChargeId) === parentRef)) {
      out.push({ payment: p, strength: "strong", matchedOn: "provider_payment_id" });
      continue;
    }
    // 2b. The parent typed our reference into their bank/Stripe description and
    //     it came back on the payment's reference field.
    if (parentRef && norm(p.reference) === parentRef) {
      out.push({ payment: p, strength: "strong", matchedOn: "scholarshelf_reference" });
      continue;
    }
    // 3. Same customer, nothing else. Shown to a human; never auto-verified.
    if (email && (p.customerEmail ?? "").toLowerCase() === email) {
      out.push({ payment: p, strength: "weak", matchedOn: "customer_email" });
    }
  }

  // Strong before weak; within a group, successful money first so the officer's
  // "possible match" is the most useful one.
  const rank = (c: Candidate) =>
    (c.strength === "strong" ? 0 : 10) + (isVerifiableStatus(c.payment) ? 0 : 1);
  return out.sort((a, b) => rank(a) - rank(b));
}

/** Human sentence per reason code, shown to the Finance Officer. */
const REASON_TEXT: Record<VerificationReasonCode, string> = {
  no_provider_payment_found: "No matching Stripe transaction was found for this order.",
  missing_payment_reference: "This order has no payment reference to match against.",
  reference_mismatch: "A Stripe transaction was found but its reference does not match this order.",
  payment_pending: "The Stripe transaction exists but the payment has not completed yet.",
  payment_failed: "A Stripe transaction exists but the payment was unsuccessful.",
  payment_cancelled: "The Stripe transaction was cancelled.",
  payment_refunded: "The Stripe payment has been refunded.",
  payment_disputed: "The Stripe payment is disputed or charged back.",
  amount_mismatch: "The Stripe payment amount does not match the amount owed.",
  currency_mismatch: "The Stripe payment is in a different currency to the order.",
  multiple_possible_matches: "More than one Stripe transaction could match this order.",
  weak_match_only: "Only a weak match was found (same customer, no matching reference).",
  provider_data_unavailable: "No Stripe payment data has been imported for this school yet.",
  unknown_provider_status: "The Stripe transaction has a status ScholarShelf does not recognise.",
};

/** Map a non-successful provider status onto the reason a human will read. */
function statusReason(p: ProviderPayment): VerificationReasonCode {
  if (p.disputed || p.status === "disputed") return "payment_disputed";
  if (p.status === "refunded" || p.status === "partially_refunded" || Number(p.amountRefunded ?? "0") > 0) return "payment_refunded";
  switch (p.status) {
    case "pending": return "payment_pending";
    case "failed": return "payment_failed";
    case "cancelled": return "payment_cancelled";
    case "unknown": return "unknown_provider_status";
    default: return "payment_failed";
  }
}

function decide(
  reasonCode: VerificationReasonCode,
  matched: ProviderPayment | null,
  candidates: Candidate[],
  evidence: Record<string, unknown>,
  extra?: string,
): MatchDecision {
  return {
    verified: false,
    reasonCode,
    reason: extra ? `${REASON_TEXT[reasonCode]} ${extra}` : REASON_TEXT[reasonCode],
    matched,
    candidates,
    evidence,
  };
}

/**
 * The decision. Verified only when ALL of these hold:
 *   correct order · strong match · successful status · exact amount · right currency
 *
 * `providerDataPresent` distinguishes "we looked and found nothing" from "no
 * Stripe data has ever been imported", because those need different actions
 * from the Finance Officer.
 */
export function matchPayment(
  order: OrderToVerify,
  payments: ProviderPayment[],
  opts: { providerDataPresent: boolean } = { providerDataPresent: true },
): MatchDecision {
  const candidates = classifyCandidates(order, payments);
  const baseEvidence: Record<string, unknown> = {
    expectedAmount: order.totalAmount,
    expectedCurrency: SCHOLARSHELF_CURRENCY,
    scholarShelfReference: order.paymentReference,
    submittedReference: order.paymentReferenceNumber,
    candidateCount: candidates.length,
  };

  if (!opts.providerDataPresent) {
    return decide("provider_data_unavailable", null, candidates, baseEvidence);
  }
  if (!order.paymentReference && !order.paymentReferenceNumber) {
    return decide("missing_payment_reference", null, candidates, baseEvidence);
  }

  const strong = candidates.filter((c) => c.strength === "strong");

  // No strong match at all.
  if (strong.length === 0) {
    if (candidates.length === 0) {
      return decide("no_provider_payment_found", null, candidates, baseEvidence);
    }
    // Weak candidates only — show the best one, but never approve on it.
    const best = candidates[0].payment;
    return decide("weak_match_only", best, candidates, {
      ...baseEvidence,
      weakMatchOn: candidates[0].matchedOn,
      foundAmount: best.amount,
      foundCurrency: best.currency,
      foundStatus: best.status,
    });
  }

  // More than one strong match: ScholarShelf cannot choose, so a human must.
  // (Deduplicated by provider id first — the same transaction appearing twice
  // in the candidate list is not an ambiguity.)
  const distinctStrong = Array.from(
    new Map(strong.map((c) => [`${c.payment.provider}:${c.payment.providerPaymentId}`, c])).values(),
  );
  if (distinctStrong.length > 1) {
    return decide("multiple_possible_matches", distinctStrong[0].payment, candidates, {
      ...baseEvidence,
      matches: distinctStrong.map((c) => ({
        providerPaymentId: c.payment.providerPaymentId,
        amount: c.payment.amount,
        currency: c.payment.currency,
        status: c.payment.status,
      })),
    }, `${distinctStrong.length} transactions matched this reference.`);
  }

  const candidate = distinctStrong[0];
  const p = candidate.payment;
  const evidence = {
    ...baseEvidence,
    matchedOn: candidate.matchedOn,
    providerPaymentId: p.providerPaymentId,
    foundAmount: p.amount,
    foundCurrency: p.currency,
    foundStatus: p.status,
    foundRawStatus: p.rawStatus,
    amountRefunded: p.amountRefunded,
    disputed: p.disputed,
  };

  // Status must be genuinely successful — and NOT refunded or disputed.
  if (!isVerifiableStatus(p)) {
    return decide(statusReason(p), p, candidates, evidence,
      p.rawStatus ? `Stripe reports "${p.rawStatus}".` : undefined);
  }

  // Currency before amount: "120" GBP and "120" USD are not the same money, and
  // saying "wrong currency" is more useful than saying the amount matched.
  if (p.currency !== SCHOLARSHELF_CURRENCY) {
    return decide("currency_mismatch", p, candidates, evidence,
      `Order is in ${SCHOLARSHELF_CURRENCY}, payment is in ${p.currency}.`);
  }

  // Exact amount. ScholarShelf has no partial-payment concept — one order, one
  // total — so a short payment is an exception for a human, not a part-payment.
  if (!moneyEquals(p.amount, order.totalAmount)) {
    return decide("amount_mismatch", p, candidates, evidence,
      `Expected £${order.totalAmount}, Stripe shows £${p.amount}.`);
  }

  return {
    verified: true,
    reasonCode: null,
    reason: null,
    matched: p,
    candidates,
    evidence,
  };
}

export { REASON_TEXT };
