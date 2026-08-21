/**
 * server/services/payment-verification/provider-payment-repository.ts
 *
 * The only thing that reads and writes `provider_payments`.
 *
 * Verification queries THIS, never a spreadsheet. That is the whole point of
 * the table: an order reaching the finance stage does a single indexed lookup,
 * not a file parse, and the same lookup works whether the row arrived from a
 * Stripe export this morning or from the Stripe API in real time.
 *
 * Every method is school-scoped. Payment data is tenant data.
 */
import { and, eq, inArray, desc, sql } from "drizzle-orm";
import { providerPayments } from "../../../shared/schema.js";
import type { ProviderPayment } from "../../../shared/schema.js";
import type { NormalisedProviderPayment } from "./provider-payment.js";

export interface UpsertResult {
  imported: number;
  updated: number;
  unchanged: number;
  /** Rows the file contained more than once — counted, imported once. */
  duplicatesInFile: number;
}

/** Row shape for insert/update; keeps Drizzle's typing out of callers. */
function toRow(p: NormalisedProviderPayment, schoolId: string, importedBy: string | null) {
  return {
    schoolId,
    provider: p.provider,
    providerPaymentId: p.providerPaymentId,
    providerChargeId: p.providerChargeId,
    status: p.status,
    rawStatus: p.rawStatus,
    amount: p.amount,
    amountRefunded: p.amountRefunded,
    currency: p.currency,
    reference: p.reference,
    customerEmail: p.customerEmail,
    customerName: p.customerName,
    description: p.description,
    disputed: p.disputed,
    paidAt: p.paidAt,
    source: p.source,
    sourceFilename: p.sourceFilename,
    importedBy,
    raw: p.raw ? JSON.stringify(p.raw).slice(0, 20000) : null,
  };
}

/**
 * Store payments, idempotently.
 *
 * Identity is (school, provider, provider payment id) — Stripe's own id. Re-
 * uploading the same export therefore updates rows in place instead of
 * duplicating them, which matters because a later export legitimately carries
 * NEWER information about the same payment: a charge that was "Paid" last week
 * may be "Refunded" today, and finance must see the refund.
 *
 * Returns counts so the uploader can be told what actually happened.
 */
export async function upsertProviderPayments(
  db: any,
  schoolId: string,
  payments: NormalisedProviderPayment[],
  importedBy: string | null,
): Promise<UpsertResult> {
  const result: UpsertResult = { imported: 0, updated: 0, unchanged: 0, duplicatesInFile: 0 };
  if (payments.length === 0) return result;

  // Collapse duplicates within the file first — last occurrence wins, so a
  // export listing a payment twice cannot fight itself row by row.
  const byIdentity = new Map<string, NormalisedProviderPayment>();
  for (const p of payments) {
    const key = `${p.provider}:${p.providerPaymentId}`;
    if (byIdentity.has(key)) result.duplicatesInFile++;
    byIdentity.set(key, p);
  }
  const unique = Array.from(byIdentity.values());

  const ids = unique.map((p) => p.providerPaymentId);
  const existing: ProviderPayment[] = ids.length
    ? await db.select().from(providerPayments).where(and(
        eq(providerPayments.schoolId, schoolId),
        inArray(providerPayments.providerPaymentId, ids),
      ))
    : [];
  const existingByKey = new Map(existing.map((e) => [`${e.provider}:${e.providerPaymentId}`, e]));

  for (const p of unique) {
    const key = `${p.provider}:${p.providerPaymentId}`;
    const prior = existingByKey.get(key);
    const row = toRow(p, schoolId, importedBy);

    if (!prior) {
      await db.insert(providerPayments).values(row);
      result.imported++;
      continue;
    }
    // Only touch the row when the provider actually told us something new.
    const changed =
      prior.status !== row.status ||
      String(prior.amount) !== row.amount ||
      String(prior.amountRefunded ?? "0") !== row.amountRefunded ||
      prior.currency !== row.currency ||
      (prior.reference ?? null) !== (row.reference ?? null) ||
      prior.disputed !== row.disputed;
    if (!changed) { result.unchanged++; continue; }

    await db.update(providerPayments)
      .set({ ...row, importedAt: new Date() })
      .where(eq(providerPayments.id, prior.id));
    result.updated++;
  }

  return result;
}

/**
 * Candidate payments for a ScholarShelf order.
 *
 * Deliberately returns EVERYTHING that could plausibly relate to the order and
 * leaves the judgement to the matcher — including failed, pending and refunded
 * rows, because "we found your payment but it failed" is a far more useful
 * answer for a Finance Officer than "no payment found".
 */
export async function findCandidatePayments(
  db: any,
  schoolId: string,
  keys: { scholarShelfReference?: string | null; externalReference?: string | null; customerEmail?: string | null },
): Promise<ProviderPayment[]> {
  const wanted = [keys.scholarShelfReference, keys.externalReference]
    .map((r) => (r ? String(r).trim() : ""))
    .filter(Boolean);

  const rows: ProviderPayment[] = await db.select().from(providerPayments)
    .where(eq(providerPayments.schoolId, schoolId))
    .orderBy(desc(providerPayments.paidAt));

  if (rows.length === 0) return [];

  const norm = (v: string | null | undefined) => (v ?? "").trim().toUpperCase();
  const wantedSet = new Set(wanted.map(norm));
  const email = (keys.customerEmail ?? "").trim().toLowerCase();

  return rows.filter((r) => {
    // Strong: our reference, or the provider's own id quoted by the parent.
    if (wantedSet.size > 0) {
      if (wantedSet.has(norm(r.reference))) return true;
      if (wantedSet.has(norm(r.providerPaymentId))) return true;
      if (r.providerChargeId && wantedSet.has(norm(r.providerChargeId))) return true;
      // The reference may be buried in the description of an older export.
      if (r.description && Array.from(wantedSet).some((w) => norm(r.description).includes(w))) return true;
    }
    // Weak: same customer. Included ONLY so the matcher can show a Finance
    // Officer a near-miss; a weak candidate can never auto-verify.
    if (email && (r.customerEmail ?? "").toLowerCase() === email) return true;
    return false;
  });
}

/** Provider payments already consumed by a verified order, for reuse guards. */
export async function findPaymentsById(db: any, schoolId: string, ids: string[]): Promise<ProviderPayment[]> {
  if (ids.length === 0) return [];
  return db.select().from(providerPayments).where(and(
    eq(providerPayments.schoolId, schoolId),
    inArray(providerPayments.id, ids),
  ));
}

/** Counts for the finance UI header. */
export async function providerPaymentStats(db: any, schoolId: string) {
  const rows = await db.select({
    status: providerPayments.status,
    n: sql<number>`count(*)::int`,
  }).from(providerPayments)
    .where(eq(providerPayments.schoolId, schoolId))
    .groupBy(providerPayments.status);
  const byStatus: Record<string, number> = {};
  let total = 0;
  for (const r of rows as Array<{ status: string; n: number }>) {
    byStatus[r.status] = r.n;
    total += r.n;
  }
  return { total, byStatus };
}
