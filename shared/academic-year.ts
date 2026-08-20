/**
 * shared/academic-year.ts
 *
 * The English academic year, as a value the whole system agrees on.
 *
 * WHY THIS EXISTS
 *
 * There was no academic year or term anywhere in the data model. `academicYear`
 * was free text on `classes`, and a student had a single mutable `classId`. So
 * when children move up in September you overwrite classId — and every historical
 * record that reaches a class by joining through the student silently
 * re-attributes to the class they are in NOW. Last year's distribution reports,
 * allocation summaries and revenue-by-class breakdowns quietly change. Nobody
 * gets an error.
 *
 * The full fix is a student_class_enrolments table with (student_id, class_id,
 * academic_year, start, end), and historical rows referencing the enrolment
 * rather than the student. That is a large change.
 *
 * The cheap fix, which is what the rest of this file supports, is to stop
 * treating history as a join and start treating it as a recorded fact: stamp the
 * academic year and a snapshot of the class onto each row AT WRITE TIME. History
 * then says what was true when it happened, whatever the student record does
 * afterwards.
 */

/** September (month index 8) starts the new academic year in England. */
const ACADEMIC_YEAR_START_MONTH = 8;

/**
 * "2026/27" for any date in that year.
 *
 * September 2026 through August 2027 all return "2026/27"; September 2027 rolls
 * over to "2027/28". Uses UTC deliberately — the server runs UTC and a date
 * derived from local time would flip a day early or late around midnight.
 */
export function academicYearFor(date: Date = new Date()): string {
  const y = date.getUTCFullYear();
  const startYear = date.getUTCMonth() >= ACADEMIC_YEAR_START_MONTH ? y : y - 1;
  return `${startYear}/${String(startYear + 1).slice(-2)}`;
}

/** The academic year we are in right now. */
export function currentAcademicYear(): string {
  return academicYearFor(new Date());
}

/**
 * Accepts the many ways a year has been typed into the free-text column —
 * "2026/27", "2026-27", "2026/2027", "26/27" — and returns the canonical form.
 * Anything unrecognised is returned trimmed, so a hand-written label survives.
 */
export function normaliseAcademicYear(value: string | null | undefined): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;

  const m = raw.match(/^(\d{2}|\d{4})\s*[\/\-–]\s*(\d{2}|\d{4})$/);
  if (m) {
    const start = m[1].length === 2 ? 2000 + parseInt(m[1], 10) : parseInt(m[1], 10);
    return `${start}/${String(start + 1).slice(-2)}`;
  }
  const single = raw.match(/^(\d{4})$/);
  if (single) {
    const start = parseInt(single[1], 10);
    return `${start}/${String(start + 1).slice(-2)}`;
  }
  return raw;
}

/** Chronological sort key — "2026/27" → 2026. Unparseable sorts last. */
export function academicYearSortKey(value: string | null | undefined): number {
  const n = normaliseAcademicYear(value);
  const m = n?.match(/^(\d{4})/);
  return m ? parseInt(m[1], 10) : -Infinity;
}

/** The academic years a school could plausibly be looking at, newest first. */
export function recentAcademicYears(count = 4, from: Date = new Date()): string[] {
  const current = academicYearFor(from);
  const start = parseInt(current.slice(0, 4), 10);
  return Array.from({ length: count }, (_, i) => {
    const y = start - i;
    return `${y}/${String(y + 1).slice(-2)}`;
  });
}
