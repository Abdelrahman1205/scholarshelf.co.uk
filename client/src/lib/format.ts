/**
 * client/src/lib/format.ts
 *
 * One place for money, dates and year groups.
 *
 * Before this existed there were five different money helpers — four rendering
 * "£1234.50" and one rendering "£1,234.50" — and thirty date calls that passed
 * NO locale, so they rendered in whatever locale the viewer's browser happened to
 * be set to. A UK school with a US-configured laptop saw 03/04/2026 meaning
 * 4 March, on a payment reconciliation screen. Non-deterministic formatting is
 * worse than consistently wrong formatting, because nobody can reproduce it.
 *
 * ScholarShelf is a UK product. Everything here is pinned to en-GB and GBP.
 */

const LOCALE = "en-GB";
const CURRENCY = "GBP";

const moneyFormatter = new Intl.NumberFormat(LOCALE, {
  style: "currency",
  currency: CURRENCY,
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Coerce the many shapes money arrives in — numeric strings from pg, numbers, null. */
function toNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const n = parseFloat(String(value ?? "0"));
  return Number.isFinite(n) ? n : 0;
}

/** "£1,234.50" — always GBP, always two decimals, always grouped. */
export function formatMoney(value: unknown): string {
  return moneyFormatter.format(toNumber(value));
}

/** The bare number, for inputs and CSV export where a symbol would be wrong. */
export function formatAmount(value: unknown): string {
  return toNumber(value).toFixed(2);
}

function toDate(value: unknown): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "12 Mar 2026" — unambiguous, which numeric UK/US formats are not. */
export function formatDate(value: unknown, fallback = "—"): string {
  const d = toDate(value);
  if (!d) return fallback;
  return d.toLocaleDateString(LOCALE, { day: "numeric", month: "short", year: "numeric" });
}

/** "12/03/2026" — for dense tables and date inputs, where the long form won't fit. */
export function formatDateNumeric(value: unknown, fallback = "—"): string {
  const d = toDate(value);
  if (!d) return fallback;
  return d.toLocaleDateString(LOCALE, { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** "12 Mar 2026, 14:05" — 24-hour, because UK schools write rotas in 24-hour. */
export function formatDateTime(value: unknown, fallback = "—"): string {
  const d = toDate(value);
  if (!d) return fallback;
  return d.toLocaleString(LOCALE, {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: false,
  });
}

/**
 * UK year-group vocabulary.
 *
 * The product was showing "Grade 4" to parents, "Year 3 Blue" to teachers and
 * "Y10" to finance — three conventions for one idea, two of which no English
 * primary school uses. English state schools run Reception, then Years 1–6
 * (primary) and 7–13 (secondary).
 *
 * Accepts whatever is on the record: a number, "4", "Year 4", "R", "Reception".
 */
export function formatYearGroup(value: unknown, fallback = ""): string {
  const raw = String(value ?? "").trim();
  if (!raw) return fallback;

  const normalised = raw.toLowerCase().replace(/\s+/g, "");
  if (normalised === "r" || normalised === "0" || normalised === "reception") return "Reception";
  if (normalised === "n" || normalised === "nursery") return "Nursery";

  // "4" | "y4" | "yr4" | "year4" → Year 4
  const m = normalised.match(/^(?:y|yr|year|grade|g)?(\d{1,2})$/);
  if (m) return `Year ${parseInt(m[1], 10)}`;

  // Already a label we don't recognise ("Year 3 Blue", "Upper Sixth") — leave it.
  return raw;
}

/** Prefers the student's own year group, falling back to their class name. */
export function studentYearLabel(student: any, fallback = ""): string {
  const direct = student?.yearGroup ?? student?.gradeLevel ?? student?.class?.yearGroup;
  const label = formatYearGroup(direct, "");
  if (label) return label;
  return student?.class?.name || student?.className || fallback;
}
