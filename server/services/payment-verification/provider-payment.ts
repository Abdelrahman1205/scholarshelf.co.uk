/**
 * server/services/payment-verification/provider-payment.ts
 *
 * The contract between "where payments come from" and "what ScholarShelf does
 * with them". Everything downstream of this file — matching, verification, the
 * finance workflow — speaks only `NormalisedProviderPayment` and knows nothing
 * about Stripe exports, CSV columns, or HTTP.
 *
 * Today one implementation of `ProviderPaymentSource` exists: the Stripe
 * spreadsheet importer. When the Stripe API arrives it becomes a second
 * implementation returning the same shape, and no other file changes.
 *
 * Status vocabulary is the important part. Stripe's own exports are not
 * consistent — a Payments export says "Paid", a Balance/PaymentIntent export
 * says "succeeded", some reports say "Complete" — and a refund or dispute may
 * appear as a separate column rather than as a status. All of that is flattened
 * here, ONCE, and the original string is preserved so a Finance Officer can
 * always see what the file actually said.
 */
import {
  PROVIDER_PAYMENT_VERIFIABLE_STATUSES,
  type PaymentProvider,
  type ProviderPaymentStatus,
  type ProviderPaymentSourceKind,
} from "../../../shared/schema.js";

/** One payment, as ScholarShelf understands it, whatever produced it. */
export interface NormalisedProviderPayment {
  provider: PaymentProvider;
  /** The provider's unique id — Payment Intent, Charge, or Transaction id. */
  providerPaymentId: string;
  providerChargeId: string | null;
  status: ProviderPaymentStatus;
  /** Exactly what the source said, before normalisation. Never interpreted. */
  rawStatus: string | null;
  /** Decimal string, e.g. "120.00". Never a float — money is not binary. */
  amount: string;
  amountRefunded: string;
  /** Uppercase ISO-4217, e.g. "GBP". */
  currency: string;
  /** The ScholarShelf payment reference carried by the payment, if any. */
  reference: string | null;
  customerEmail: string | null;
  customerName: string | null;
  description: string | null;
  disputed: boolean;
  paidAt: Date | null;
  source: ProviderPaymentSourceKind;
  sourceFilename: string | null;
  /** The original record, for the audit trail. */
  raw: Record<string, unknown> | null;
}

/**
 * What any payment source must provide. The spreadsheet importer implements it
 * now; `StripeApiSource` will implement it later against the live API.
 *
 * Note there is no `verify()` here on purpose: a source's only job is to
 * PRODUCE payment records. Deciding whether a payment satisfies a ScholarShelf
 * order is the verification service's job, and must not vary by source.
 */
export interface ProviderPaymentSource {
  readonly provider: PaymentProvider;
  readonly kind: ProviderPaymentSourceKind;
  /** Produce the payments this source currently knows about. */
  fetchPayments(context?: { schoolId: string }): Promise<NormalisedProviderPayment[]>;
}

// ── Status normalisation ────────────────────────────────────────────────────

/**
 * Every raw status string we are willing to recognise, mapped to the normalised
 * vocabulary. Anything NOT in this table becomes "unknown", which never
 * auto-verifies — an unrecognised status is a reason to ask a human, not a
 * reason to guess.
 */
const STATUS_MAP: Record<string, ProviderPaymentStatus> = {
  // success
  succeeded: "succeeded", success: "succeeded", paid: "succeeded",
  complete: "succeeded", completed: "succeeded", captured: "succeeded",
  // not yet money
  pending: "pending", processing: "pending", requires_capture: "pending",
  requires_action: "pending", requires_confirmation: "pending",
  requires_payment_method: "pending", incomplete: "pending", unpaid: "pending",
  in_transit: "pending", available: "pending",
  // never money
  failed: "failed", declined: "failed", error: "failed",
  canceled: "cancelled", cancelled: "cancelled", voided: "cancelled", expired: "cancelled",
  // money that came back
  refunded: "refunded", refund: "refunded", reversed: "refunded",
  partially_refunded: "partially_refunded", partial_refund: "partially_refunded",
  // contested
  disputed: "disputed", dispute: "disputed", chargeback: "disputed",
  charge_dispute: "disputed", warning_needs_response: "disputed",
  needs_response: "disputed", under_review: "disputed", lost: "disputed",
};

/** Normalise one raw status. Unrecognised input is "unknown", never a guess. */
export function normaliseProviderStatus(raw: unknown): ProviderPaymentStatus {
  const key = String(raw ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (!key) return "unknown";
  return STATUS_MAP[key] ?? "unknown";
}

/**
 * The single place that decides whether a provider payment's STATUS is
 * acceptable. Refunds and disputes are folded in here so no caller can
 * accidentally treat a refunded "succeeded" row as good money.
 */
export function isVerifiableStatus(payment: {
  /** Accepts the raw DB row type (string) as well as the narrowed union. */
  status: string;
  disputed?: boolean | null;
  amountRefunded?: string | number | null;
}): boolean {
  if (payment.disputed) return false;
  if (Number(payment.amountRefunded ?? "0") > 0) return false;
  return (PROVIDER_PAYMENT_VERIFIABLE_STATUSES as readonly string[]).includes(payment.status);
}

// ── Money ───────────────────────────────────────────────────────────────────

/**
 * Parse a money value from a spreadsheet cell into a fixed 2dp decimal string.
 *
 * Handles "£120.00", "120", "1,234.56", "(12.00)" (negative), and Stripe's
 * minor-unit exports ("Amount" in pence) when `minorUnits` is set. Returns null
 * when the value cannot be understood — which becomes a row-level import error
 * rather than a silent zero.
 */
export function parseMoney(value: unknown, opts: { minorUnits?: boolean } = {}): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    return (opts.minorUnits ? value / 100 : value).toFixed(2);
  }
  let s = String(value).trim();
  if (!s) return null;
  const negative = /^\(.*\)$/.test(s) || s.startsWith("-");
  // Strip currency symbols, spaces and thousands separators.
  s = s.replace(/[()£$€,\s]/g, "").replace(/^-/, "");
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  const value2dp = (opts.minorUnits ? n / 100 : n).toFixed(2);
  return negative ? `-${value2dp}` : value2dp;
}

/** Exact comparison of two 2dp money strings. No tolerance — money is exact. */
export function moneyEquals(a: string | null | undefined, b: string | null | undefined): boolean {
  if (a === null || a === undefined || b === null || b === undefined) return false;
  const na = Number(a), nb = Number(b);
  if (!Number.isFinite(na) || !Number.isFinite(nb)) return false;
  return Math.round(na * 100) === Math.round(nb * 100);
}

/** Normalise a currency code. "gbp" → "GBP". Anything else → null. */
export function normaliseCurrency(value: unknown): string | null {
  const c = String(value ?? "").trim().toUpperCase();
  return /^[A-Z]{3}$/.test(c) ? c : null;
}

/**
 * The currency ScholarShelf orders are denominated in.
 *
 * `book_payments` has no currency column — every price in the system is in
 * pounds (the parent portal renders `formatMoney` as GBP). Rather than invent a
 * column and pretend orders are multi-currency, the expectation is stated here,
 * in one place, so a USD Stripe payment can never satisfy a GBP order.
 */
export const SCHOLARSHELF_CURRENCY = "GBP";
