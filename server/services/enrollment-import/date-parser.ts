/**
 * server/services/enrollment-import/date-parser.ts
 *
 * Turns whatever a spreadsheet cell contains into the ISO `yyyy-mm-dd` string
 * that `students.dateOfBirth` stores (see shared/schema.ts — it is a text column
 * holding ISO dates, which is what the manual form's <input type="date"> posts).
 *
 * ScholarShelf is a UK product. A bare `20/08/2012` is DD/MM/YYYY and is NEVER
 * reinterpreted as MM/DD/YYYY. `03/11/2011` is therefore 3 November 2011.
 * Where a US-style reading would be the ONLY valid one (e.g. 12/25/2011, whose
 * "month" is 25) we say so explicitly rather than silently swapping — the row
 * is reported as invalid so a human decides.
 */

const ISO_RE = /^(\d{4})-(\d{1,2})-(\d{1,2})$/;
const DMY_RE = /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/;
const DMY_TEXT_RE = /^(\d{1,2})\s+([a-z]{3,9})\s+(\d{2,4})$/i;

const MONTH_NAMES: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4,
  may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8,
  sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11,
  dec: 12, december: 12,
};

export interface ParsedDate {
  /** ISO yyyy-mm-dd, or null when the value could not be understood. */
  iso: string | null;
  /** Human-readable reason, present only when iso is null. */
  error?: string;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** True when y-m-d is a real calendar date (rejects 31 Feb, month 13, …). */
function isRealDate(y: number, m: number, d: number): boolean {
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function toIso(y: number, m: number, d: number): string {
  return `${y}-${pad(m)}-${pad(d)}`;
}

/** Two-digit years: 00–29 → 2000s, 30–99 → 1900s. A DOB is always in the past. */
function expandYear(y: number): number {
  if (y >= 1000) return y;
  return y <= 29 ? 2000 + y : 1900 + y;
}

/**
 * Excel stores dates as a serial number of days since 1899-12-30 (the 1900
 * system, including the deliberate 1900-leap-year bug that the epoch offset
 * already accounts for). SheetJS is asked for real Date objects, so this only
 * runs when a sheet stores the value as a bare number.
 */
export function fromExcelSerial(serial: number): string | null {
  if (!Number.isFinite(serial) || serial <= 0 || serial > 2958465) return null; // > 9999-12-31
  const ms = Math.round(serial) * 86400000;
  const epoch = Date.UTC(1899, 11, 30);
  const dt = new Date(epoch + ms);
  if (Number.isNaN(dt.getTime())) return null;
  return toIso(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

/**
 * Parse one cell value into an ISO date.
 *
 * Accepts: a real Date (what SheetJS gives for genuine Excel date cells),
 * an Excel serial number, `DD/MM/YYYY`, `DD-MM-YYYY`, `DD.MM.YYYY`,
 * `YYYY-MM-DD`, and `20 Aug 2012`.
 */
export function parseSpreadsheetDate(value: unknown): ParsedDate {
  if (value === null || value === undefined || value === "") {
    return { iso: null, error: "Missing date of birth" };
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return { iso: null, error: "Unreadable date cell" };
    // SheetJS builds these in UTC when cellDates is on.
    return { iso: toIso(value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate()) };
  }

  if (typeof value === "number") {
    const iso = fromExcelSerial(value);
    return iso ? { iso } : { iso: null, error: `"${value}" is not a valid Excel date` };
  }

  const raw = String(value).trim();
  if (!raw) return { iso: null, error: "Missing date of birth" };

  // ISO first — unambiguous, and what ScholarShelf itself stores.
  const iso = ISO_RE.exec(raw);
  if (iso) {
    const y = Number(iso[1]), m = Number(iso[2]), d = Number(iso[3]);
    if (!isRealDate(y, m, d)) return { iso: null, error: `"${raw}" is not a real calendar date` };
    return { iso: toIso(y, m, d) };
  }

  // "20 Aug 2012" / "20 August 2012"
  const txt = DMY_TEXT_RE.exec(raw);
  if (txt) {
    const d = Number(txt[1]);
    const m = MONTH_NAMES[txt[2].toLowerCase()];
    const y = expandYear(Number(txt[3]));
    if (!m || !isRealDate(y, m, d)) return { iso: null, error: `"${raw}" is not a real calendar date` };
    return { iso: toIso(y, m, d) };
  }

  // UK day-first. This is the ONLY reading we accept for ambiguous values.
  const dmy = DMY_RE.exec(raw);
  if (dmy) {
    const first = Number(dmy[1]);
    const second = Number(dmy[2]);
    const y = expandYear(Number(dmy[3]));
    if (isRealDate(y, second, first)) return { iso: toIso(y, second, first) };
    // Day-first failed. If month-first would have worked, the sheet is almost
    // certainly US-formatted — say so instead of quietly swapping the fields.
    if (isRealDate(y, first, second)) {
      return {
        iso: null,
        error: `"${raw}" is not a valid UK date (DD/MM/YYYY). It looks like US MM/DD/YYYY — please correct the spreadsheet`,
      };
    }
    return { iso: null, error: `"${raw}" is not a real calendar date` };
  }

  return { iso: null, error: `"${raw}" is not a recognised date. Use DD/MM/YYYY or YYYY-MM-DD` };
}

/**
 * Same rule the manual enrollment form applies server-side (isValidDob in
 * family-enrollment.routes.ts): a real date, in the past, not before 1900.
 */
export function isPlausibleDob(iso: string): boolean {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return false;
  return d <= new Date() && d.getUTCFullYear() >= 1900;
}
