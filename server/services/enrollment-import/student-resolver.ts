/**
 * server/services/enrollment-import/student-resolver.ts
 *
 * Decides, for each spreadsheet row, whether ScholarShelf already knows this
 * student — so a re-uploaded sheet updates people instead of duplicating them.
 *
 * HOW A STUDENT IS IDENTIFIED (using the system's own rules, not invented ones)
 *
 *   1. `students.studentCode` — the unique key ScholarShelf itself generates
 *      (STU-XXXX) and displays. If the sheet carries it, that is definitive.
 *   2. Otherwise full name + date of birth within the same school — exactly the
 *      pair `findDuplicateStudentsByNameDob()` in family-enrollment.routes.ts
 *      already treats as "possible duplicate" for the manual form.
 *
 * Email is deliberately NOT an identity key: in ScholarShelf an email address
 * belongs to a GUARDIAN, not a student, and siblings share one.
 *
 * The same two keys also catch duplicates WITHIN one uploaded file: the second
 * row describing the same person is reported and skipped rather than creating a
 * second record.
 */

export interface ExistingStudentLike {
  id: string;
  name: string;
  dateOfBirth: string | null;
  studentCode: string | null;
  classId: string | null;
  familyId: string | null;
  gradeLevel?: string | null;
  status?: string | null;
}

/** Normalised identity keys for one student. */
export function studentCodeKey(code: string | null | undefined): string | null {
  const c = (code || "").trim().toLowerCase();
  return c || null;
}

export function nameDobKey(name: string, dob: string | null | undefined): string | null {
  const n = (name || "").trim().replace(/\s+/g, " ").toLowerCase();
  const d = (dob || "").trim();
  if (!n || !d) return null;
  return `${n}|${d}`;
}

/**
 * An index over the school's existing students, built once per import so row
 * matching is O(1) instead of one query per row.
 */
export class StudentIndex {
  private byCode = new Map<string, ExistingStudentLike>();
  private byNameDob = new Map<string, ExistingStudentLike>();

  constructor(existing: ExistingStudentLike[]) {
    for (const s of existing) {
      const ck = studentCodeKey(s.studentCode);
      if (ck && !this.byCode.has(ck)) this.byCode.set(ck, s);
      const nk = nameDobKey(s.name, s.dateOfBirth);
      if (nk && !this.byNameDob.has(nk)) this.byNameDob.set(nk, s);
    }
  }

  /** Returns the matched student and which key matched, or null. */
  find(row: { studentCode: string | null; fullName: string; dateOfBirth: string | null }):
    { student: ExistingStudentLike; matchedOn: "studentCode" | "nameAndDob" } | null {
    const ck = studentCodeKey(row.studentCode);
    if (ck) {
      const hit = this.byCode.get(ck);
      if (hit) return { student: hit, matchedOn: "studentCode" };
    }
    const nk = nameDobKey(row.fullName, row.dateOfBirth);
    if (nk) {
      const hit = this.byNameDob.get(nk);
      if (hit) return { student: hit, matchedOn: "nameAndDob" };
    }
    return null;
  }

  /** Register a student created during this import so later rows can see it. */
  add(student: ExistingStudentLike): void {
    const ck = studentCodeKey(student.studentCode);
    if (ck) this.byCode.set(ck, student);
    const nk = nameDobKey(student.name, student.dateOfBirth);
    if (nk) this.byNameDob.set(nk, student);
  }
}

/**
 * Tracks identities already seen in THIS file so a sheet listing the same child
 * twice creates them once.
 */
export class SeenInFile {
  private seen = new Map<string, number>(); // key → the sheet row that claimed it

  /**
   * Returns the earlier row number when this row duplicates one already seen,
   * or null when it is new. Registers the row either way.
   */
  claim(row: { studentCode: string | null; fullName: string; dateOfBirth: string | null; sheetRow: number }): number | null {
    const keys = [studentCodeKey(row.studentCode), nameDobKey(row.fullName, row.dateOfBirth)].filter(Boolean) as string[];
    for (const k of keys) {
      const prior = this.seen.get(k);
      if (prior !== undefined) return prior;
    }
    for (const k of keys) this.seen.set(k, row.sheetRow);
    return null;
  }
}
