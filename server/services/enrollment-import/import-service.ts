/**
 * server/services/enrollment-import/import-service.ts
 *
 * Orchestrates the spreadsheet enrollment import that lives inside the New
 * Enrollment screen. Two entry points, and the split between them is the whole
 * safety story:
 *
 *   analyzeImport()  — READ ONLY. Parses, maps, validates, works out which
 *                      students and classes already exist and which would be
 *                      created. Writes NOTHING. This is what the preview shows.
 *
 *   commitImport()   — the only function that writes, and it does all of its
 *                      work inside ONE database transaction over getTxDb(), so
 *                      an import either lands completely or not at all. There is
 *                      no state in between where a family exists without its
 *                      students, or a class exists with nothing pointing at it.
 *
 * The commit re-parses and re-validates the ORIGINAL FILE rather than trusting
 * a list of rows posted back by the browser. The preview is a preview, not an
 * authorisation token: a client cannot smuggle a row past validation by editing
 * it between the two calls.
 *
 * Everything the database sees goes through Drizzle's parameterised query
 * builder — no spreadsheet value is ever concatenated into SQL.
 */
import { and, eq, inArray, isNull } from "drizzle-orm";
import { randomBytes } from "crypto";
import { families, guardians, students, familyStudents, classes, childLinkingCodes } from "../../../shared/schema.js";
import { academicYearFor } from "../../../shared/academic-year.js";
import {
  autoMapHeaders, IMPORT_FIELD_BY_KEY, type ImportFieldKey,
} from "../../../shared/enrollment-import.js";
import { parseSpreadsheet, type ParsedSheet } from "./spreadsheet-parser.js";
import {
  normalizeRow, missingRequiredFields, householdNameFromStudent,
  type ColumnMapping, type NormalizedRow,
} from "./row-validator.js";
import { planClasses, ClassResolver, classKey } from "./class-resolver.js";
import { StudentIndex, SeenInFile, type ExistingStudentLike } from "./student-resolver.js";
import {
  FamilyIndex, familyGroupKey, householdKey,
  type ExistingFamilyLike, type ExistingGuardianLike,
} from "./family-resolver.js";

// ── Public result shapes (also the API response shapes) ─────────────────────

export type RowAction = "create" | "update" | "duplicate" | "error";

/**
 * One parent invitation the commit created but has NOT sent.
 *
 * Emails are deliberately not sent inside the transaction: a send is slow, and
 * an email cannot be un-sent if the transaction later rolls back. The commit
 * writes the linking-code rows atomically with the import and hands the caller
 * this list to deliver afterwards.
 */
export interface PendingInvitation {
  familyId: string;
  familyName: string;
  guardianId: string;
  guardianName: string;
  email: string;
  code: string;
  expiresAt: Date;
}

export interface PreviewRow {
  sheetRow: number;
  studentName: string;
  dateOfBirth: string | null;
  gradeLevel: string | null;
  className: string | null;
  householdName: string;
  guardianName: string | null;
  action: RowAction;
  /** For "update": the existing student's code, and what changes. */
  existingStudentCode?: string | null;
  matchedOn?: "studentCode" | "nameAndDob";
  classChange?: { from: string | null; to: string | null } | null;
  /** For "duplicate": the earlier row in the same file. */
  duplicateOfRow?: number;
  problems: string[];
}

export interface ColumnReport {
  column: string;
  index: number;
  field: ImportFieldKey | null;
  fieldLabel: string | null;
  confidence: "exact" | "none";
  /** True when an earlier column already claimed this field. */
  duplicate: boolean;
  /** First few non-empty values, so the admin can sanity-check the mapping. */
  samples: string[];
}

export interface AnalyzeResult {
  file: { name: string; sheetName: string; rowsRead: number; totalRowsInFile: number; truncated: boolean };
  columns: ColumnReport[];
  /** Columns ScholarShelf could not place — informational, they are ignored. */
  ignoredColumns: string[];
  /** Required ScholarShelf fields with no column mapped to them. */
  missingRequiredFields: string[];
  summary: {
    studentsDetected: number;
    newStudents: number;
    existingStudents: number;
    duplicateRowsInFile: number;
    invalidRows: number;
    existingClasses: number;
    newClasses: number;
    familiesToCreate: number;
    familiesReused: number;
  };
  classesToCreate: Array<{ name: string; rowCount: number }>;
  existingClassNames: string[];
  rows: PreviewRow[];
  /** Just the failing rows, in the Row / Student / Problem shape the UI lists. */
  invalidRows: Array<{ sheetRow: number; studentName: string; problem: string }>;
  /** The mapping that was applied — echoed so confirm can post it back. */
  mapping: ColumnMapping;
  canImport: boolean;
}

export interface CommitResult {
  processed: number;
  created: number;
  updated: number;
  skipped: number;
  classesCreated: number;
  createdClassNames: string[];
  familiesCreated: number;
  guardiansCreated: number;
  errorCount: number;
  failedRows: Array<{ sheetRow: number; studentName: string; problem: string }>;
  /**
   * Linking codes written for guardians who can now be invited. The caller is
   * responsible for actually sending these — see PendingInvitation.
   */
  pendingInvitations: PendingInvitation[];
}

// ── Shared analysis core (used by both entry points) ────────────────────────

interface SchoolSnapshot {
  classes: Array<{ id: string; name: string; yearGroup: string | null; academicYear: string | null }>;
  students: ExistingStudentLike[];
  families: ExistingFamilyLike[];
  guardians: ExistingGuardianLike[];
}

/**
 * Load everything the import needs to know about the school, scoped to the
 * caller's schoolId. Every subsequent decision is made against this snapshot,
 * so tenant isolation is enforced once, here.
 */
export async function loadSchoolSnapshot(db: any, schoolId: string): Promise<SchoolSnapshot> {
  const [classRows, studentRows, familyRows] = await Promise.all([
    db.select({ id: classes.id, name: classes.name, yearGroup: classes.yearGroup, academicYear: classes.academicYear })
      .from(classes).where(eq(classes.schoolId, schoolId)),
    db.select({
      id: students.id, name: students.name, dateOfBirth: students.dateOfBirth,
      studentCode: students.studentCode, classId: students.classId,
      familyId: students.familyId, gradeLevel: students.gradeLevel, status: students.status,
    }).from(students).where(eq(students.schoolId, schoolId)),
    db.select({
      id: families.id, name: families.name, householdName: families.householdName,
      primaryEmail: families.primaryEmail, primaryPhone: families.primaryPhone,
      familyCode: families.familyCode,
    }).from(families).where(eq(families.schoolId, schoolId)),
  ]);

  const guardianRows: ExistingGuardianLike[] = await db
    .select({ id: guardians.id, familyId: guardians.familyId, fullName: guardians.fullName, email: guardians.email, phone: guardians.phone })
    .from(guardians).where(eq(guardians.schoolId, schoolId));

  return { classes: classRows, students: studentRows, families: familyRows, guardians: guardianRows };
}

/** Build the effective column mapping: auto-detected, then admin overrides. */
export function buildMapping(
  headers: string[],
  overrides?: Record<string, string | null> | null,
): { mapping: ColumnMapping; columns: Array<{ column: string; index: number; field: ImportFieldKey | null; confidence: "exact" | "none"; duplicate: boolean }> } {
  const auto = autoMapHeaders(headers);
  const mapping: ColumnMapping = {};
  const columns = auto.map((c) => ({ ...c }));

  // Apply the administrator's corrections. A field may be claimed by exactly one
  // column: a later override steals it from an earlier column rather than
  // silently writing the same field twice.
  if (overrides) {
    for (const [idxStr, rawField] of Object.entries(overrides)) {
      const index = Number(idxStr);
      const col = columns.find((c) => c.index === index);
      if (!col) continue;
      if (rawField === null || rawField === "" || rawField === "ignore") {
        col.field = null;
        col.confidence = "none";
        col.duplicate = false;
        continue;
      }
      if (!(rawField in IMPORT_FIELD_BY_KEY)) continue; // unknown field name — ignore
      const field = rawField as ImportFieldKey;
      for (const other of columns) {
        if (other.index !== index && other.field === field) other.field = null;
      }
      col.field = field;
      col.confidence = "exact";
      col.duplicate = false;
    }
  }

  for (const c of columns) {
    if (c.field) mapping[c.index] = c.field;
  }
  return { mapping, columns };
}

interface AnalyzedRow {
  normalized: NormalizedRow;
  action: RowAction;
  existing: ExistingStudentLike | null;
  matchedOn?: "studentCode" | "nameAndDob";
  duplicateOfRow?: number;
  familyKey: string;
  householdName: string;
}

/**
 * The pure decision pass shared by preview and commit: for every row, work out
 * whether it is invalid, an in-file duplicate, an update or a create, and which
 * family group it belongs to. No I/O.
 */
function analyzeRows(sheet: ParsedSheet, mapping: ColumnMapping, snapshot: SchoolSnapshot): AnalyzedRow[] {
  const studentIndex = new StudentIndex(snapshot.students);
  const seen = new SeenInFile();
  const out: AnalyzedRow[] = [];

  for (const parsed of sheet.rows) {
    const normalized = normalizeRow(parsed, mapping);
    const householdName = normalized.family.householdName
      || (normalized.student.fullName ? householdNameFromStudent(normalized.student.fullName) : "New Family");
    const familyKey = familyGroupKey(
      {
        sheetRow: normalized.sheetRow,
        studentFullName: normalized.student.fullName,
        householdName: normalized.family.householdName,
        guardianEmail: normalized.guardian.email,
        guardianPhone: normalized.guardian.phone,
        familyEmail: normalized.family.primaryEmail,
        familyPhone: normalized.family.primaryPhone,
      },
      householdName,
    );

    if (!normalized.valid) {
      out.push({ normalized, action: "error", existing: null, familyKey, householdName });
      continue;
    }

    const priorRow = seen.claim({
      studentCode: normalized.student.studentCode,
      fullName: normalized.student.fullName,
      dateOfBirth: normalized.student.dateOfBirth,
      sheetRow: normalized.sheetRow,
    });
    if (priorRow !== null) {
      out.push({ normalized, action: "duplicate", existing: null, duplicateOfRow: priorRow, familyKey, householdName });
      continue;
    }

    const match = studentIndex.find({
      studentCode: normalized.student.studentCode,
      fullName: normalized.student.fullName,
      dateOfBirth: normalized.student.dateOfBirth,
    });
    if (match) {
      out.push({ normalized, action: "update", existing: match.student, matchedOn: match.matchedOn, familyKey, householdName });
    } else {
      out.push({ normalized, action: "create", existing: null, familyKey, householdName });
    }
  }

  return out;
}

// ── 1. PREVIEW — read only ──────────────────────────────────────────────────

export async function analyzeImport(opts: {
  db: any;
  schoolId: string;
  buffer: Buffer;
  filename: string;
  mappingOverrides?: Record<string, string | null> | null;
}): Promise<AnalyzeResult> {
  const sheet = parseSpreadsheet(opts.buffer, opts.filename);
  const { mapping, columns } = buildMapping(sheet.headers, opts.mappingOverrides);
  const snapshot = await loadSchoolSnapshot(opts.db, opts.schoolId);

  const missing = missingRequiredFields(mapping);
  const analyzed = analyzeRows(sheet, mapping, snapshot);

  // ── Classes: which exist, which would be created (no writes) ──
  const classRequests = analyzed
    .filter((a) => a.action === "create" || a.action === "update")
    .map((a) => ({ name: a.normalized.className || "", yearGroup: a.normalized.yearGroup, academicYear: a.normalized.academicYear }))
    .filter((r) => r.name);
  const { existingByKey, toCreate } = planClasses(snapshot.classes, classRequests);
  const existingClassNamesUsed = Array.from(new Set(
    classRequests.map((r) => existingByKey.get(classKey(r.name))?.name).filter(Boolean) as string[],
  ));

  // ── Families: which groups reuse an existing household, which are new ──
  const familyIndex = new FamilyIndex(snapshot.families, snapshot.guardians);
  const groupResolution = new Map<string, { existing: boolean }>();
  for (const a of analyzed) {
    if (a.action === "error" || a.action === "duplicate") continue;
    if (groupResolution.has(a.familyKey)) continue;
    const viaExistingStudent = a.existing?.familyId ? true : false;
    const viaHousehold = familyIndex.matchByHousehold(a.normalized.family.householdName || a.householdName);
    const viaContact = familyIndex.matchByContact(
      a.normalized.guardian.email || a.normalized.family.primaryEmail,
      a.normalized.guardian.phone || a.normalized.family.primaryPhone,
    );
    groupResolution.set(a.familyKey, { existing: viaExistingStudent || !!viaHousehold || !!viaContact });
  }
  let familiesReused = 0, familiesToCreate = 0;
  for (const r of Array.from(groupResolution.values())) r.existing ? familiesReused++ : familiesToCreate++;

  // ── Column report with sample values ──
  const columnReport: ColumnReport[] = columns.map((c) => ({
    column: c.column,
    index: c.index,
    field: c.field,
    fieldLabel: c.field ? IMPORT_FIELD_BY_KEY[c.field].label : null,
    confidence: c.confidence,
    duplicate: c.duplicate,
    samples: sheet.rows.slice(0, 4)
      .map((r) => r.cells[c.index])
      .filter((v) => v !== null && v !== undefined && v !== "")
      .map((v) => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v)))
      .slice(0, 3),
  }));

  const rows: PreviewRow[] = analyzed.map((a) => {
    const existingClassName = a.existing?.classId
      ? snapshot.classes.find((c) => c.id === a.existing!.classId)?.name || null
      : null;
    const targetClassName = a.normalized.className || null;
    const classChanged = a.action === "update" && targetClassName
      && classKey(existingClassName || "") !== classKey(targetClassName);
    return {
      sheetRow: a.normalized.sheetRow,
      studentName: a.normalized.student.fullName || "(no name)",
      dateOfBirth: a.normalized.student.dateOfBirth,
      gradeLevel: a.normalized.student.gradeLevel,
      className: targetClassName,
      householdName: a.householdName,
      guardianName: a.normalized.guardian.fullName,
      action: a.action,
      existingStudentCode: a.existing?.studentCode ?? null,
      matchedOn: a.matchedOn,
      classChange: classChanged ? { from: existingClassName, to: targetClassName } : null,
      duplicateOfRow: a.duplicateOfRow,
      problems: a.normalized.issues.map((i) => i.message),
    };
  });

  const invalidRows = rows
    .filter((r) => r.action === "error")
    .map((r) => ({ sheetRow: r.sheetRow, studentName: r.studentName, problem: r.problems.join("; ") }));

  const newStudents = analyzed.filter((a) => a.action === "create").length;
  const existingStudents = analyzed.filter((a) => a.action === "update").length;
  const duplicateRowsInFile = analyzed.filter((a) => a.action === "duplicate").length;

  return {
    file: {
      name: opts.filename,
      sheetName: sheet.sheetName,
      rowsRead: sheet.rows.length,
      totalRowsInFile: sheet.totalRowsInFile,
      truncated: sheet.truncated,
    },
    columns: columnReport,
    ignoredColumns: columnReport.filter((c) => !c.field).map((c) => c.column),
    missingRequiredFields: missing,
    summary: {
      studentsDetected: sheet.rows.length,
      newStudents,
      existingStudents,
      duplicateRowsInFile,
      invalidRows: invalidRows.length,
      existingClasses: existingClassNamesUsed.length,
      newClasses: toCreate.length,
      familiesToCreate,
      familiesReused,
    },
    classesToCreate: toCreate.map((c) => ({ name: c.name, rowCount: c.rowCount })),
    existingClassNames: existingClassNamesUsed,
    rows,
    invalidRows,
    mapping,
    canImport: missing.length === 0 && (newStudents + existingStudents) > 0,
  };
}

// ── 2. COMMIT — one transaction, all or nothing ─────────────────────────────

const genFamilyCode = () => `FAM-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
const genStudentCode = () => `STU-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

/**
 * A linking code is a credential: it lets whoever holds it attach a parent
 * account to a family's children. Math.random() is predictable and must never
 * generate one — this mirrors generateLinkingCode() in middleware/auth.ts.
 * Ambiguous characters (I, O, 0, 1) are excluded because parents read these
 * off a screen and type them on a phone.
 */
const LINK_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function genLinkingCode(): string {
  const bytes = randomBytes(6);
  let code = "";
  for (let i = 0; i < 6; i++) {
    if (i === 3) code += "-";
    code += LINK_CODE_ALPHABET[bytes[i] % LINK_CODE_ALPHABET.length];
  }
  return code;
}

/** Loose but sufficient: the real validation is that Resend accepts it. */
function looksLikeEmail(value: string | null | undefined): value is string {
  return !!value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

/** Parent invitations expire after 30 days, matching manual family enrolment. */
const INVITE_TTL_MS = 30 * 86_400_000;

export async function commitImport(opts: {
  /** A transaction-capable Drizzle handle — see getTxDb(). */
  txDb: any;
  schoolId: string;
  buffer: Buffer;
  filename: string;
  mappingOverrides?: Record<string, string | null> | null;
}): Promise<CommitResult> {
  const sheet = parseSpreadsheet(opts.buffer, opts.filename);
  const { mapping } = buildMapping(sheet.headers, opts.mappingOverrides);

  const missing = missingRequiredFields(mapping);
  if (missing.length > 0) {
    throw Object.assign(
      new Error(`Map a column to ${missing.join(", ")} before importing.`),
      { httpStatus: 400 },
    );
  }

  return opts.txDb.transaction(async (trx: any) => {
    // Re-read the school snapshot INSIDE the transaction so the decisions are
    // made against the same state we are about to write to.
    const snapshot = await loadSchoolSnapshot(trx, opts.schoolId);
    const analyzed = analyzeRows(sheet, mapping, snapshot);

    const classResolver = new ClassResolver(snapshot.classes, async (input) => {
      const [row] = await trx.insert(classes).values({
        name: input.name,
        yearGroup: input.yearGroup,
        academicYear: input.academicYear || academicYearFor(),
        schoolId: opts.schoolId,
      }).returning();
      return row;
    });

    const familyIndex = new FamilyIndex(snapshot.families, snapshot.guardians);
    const studentIndex = new StudentIndex(snapshot.students);
    /** familyGroupKey → family id, so siblings share one household record. */
    const familyByGroup = new Map<string, string>();
    /** family id → set of guardian contact keys already attached. */
    const guardianKeysByFamily = new Map<string, Set<string>>();
    for (const g of snapshot.guardians) {
      const set = guardianKeysByFamily.get(g.familyId) || new Set<string>();
      if (g.email) set.add(`e:${g.email.toLowerCase()}`);
      if (g.phone) set.add(`p:${g.phone.replace(/\D/g, "")}`);
      set.add(`n:${(g.fullName || "").trim().toLowerCase()}`);
      guardianKeysByFamily.set(g.familyId, set);
    }

    let created = 0, updated = 0, skipped = 0, familiesCreated = 0, guardiansCreated = 0;
    const failedRows: CommitResult["failedRows"] = [];
    /** Families this import created or wrote a student into — the invite candidates. */
    const touchedFamilyIds = new Set<string>();

    for (const a of analyzed) {
      if (a.action === "error") {
        failedRows.push({
          sheetRow: a.normalized.sheetRow,
          studentName: a.normalized.student.fullName || "(no name)",
          problem: a.normalized.issues.map((i) => i.message).join("; "),
        });
        continue;
      }
      if (a.action === "duplicate") {
        skipped++;
        failedRows.push({
          sheetRow: a.normalized.sheetRow,
          studentName: a.normalized.student.fullName,
          problem: `Duplicate of row ${a.duplicateOfRow} in this spreadsheet — imported once`,
        });
        continue;
      }

      const n = a.normalized;

      // ── Class: reuse or create (cached, so never created twice) ──
      const resolvedClass = await classResolver.resolve(n.className, {
        yearGroup: n.yearGroup,
        academicYear: n.academicYear,
      });

      // ── Family: reuse the student's existing household, an existing family
      //    matched on household name or guardian contact, or create one. ──
      let familyId = familyByGroup.get(a.familyKey) || null;
      if (!familyId && a.existing?.familyId) familyId = a.existing.familyId;
      if (!familyId) {
        const viaHousehold = familyIndex.matchByHousehold(n.family.householdName || a.householdName);
        const viaContact = familyIndex.matchByContact(
          n.guardian.email || n.family.primaryEmail,
          n.guardian.phone || n.family.primaryPhone,
        );
        const match = viaHousehold || viaContact;
        if (match) {
          familyId = match.id;
        } else {
          const [famRow] = await trx.insert(families).values({
            name: a.householdName,
            householdName: a.householdName,
            schoolId: opts.schoolId,
            familyCode: genFamilyCode(),
            primaryEmail: n.family.primaryEmail || n.guardian.email || null,
            primaryPhone: n.family.primaryPhone || n.guardian.phone || null,
            address: n.family.address || null,
            status: "enrolled",
          }).returning();
          familyId = famRow.id;
          familiesCreated++;
          familyIndex.add(famRow, n.guardian.email, n.guardian.phone);
        }
      }
      familyByGroup.set(a.familyKey, familyId!);
      touchedFamilyIds.add(familyId!);

      // ── Guardian: attach once per family, never duplicated across siblings ──
      if (n.guardian.fullName) {
        const keys = guardianKeysByFamily.get(familyId!) || new Set<string>();
        const gk = n.guardian.email
          ? `e:${n.guardian.email.toLowerCase()}`
          : n.guardian.phone
            ? `p:${n.guardian.phone.replace(/\D/g, "")}`
            : `n:${n.guardian.fullName.toLowerCase()}`;
        if (!keys.has(gk)) {
          const isFirst = keys.size === 0;
          const [gRow] = await trx.insert(guardians).values({
            schoolId: opts.schoolId,
            familyId: familyId!,
            fullName: n.guardian.fullName,
            relationship: n.guardian.relationship,
            email: n.guardian.email,
            phone: n.guardian.phone,
            isPrimaryContact: isFirst,
          }).returning();
          guardiansCreated++;
          keys.add(gk);
          guardianKeysByFamily.set(familyId!, keys);
          if (isFirst) {
            await trx.update(families)
              .set({ primaryContactGuardianId: gRow.id, updatedAt: new Date() })
              .where(eq(families.id, familyId!));
          }
        }
      }

      // ── Student: update the existing record, or create a new one ──
      if (a.action === "update" && a.existing) {
        await trx.update(students).set({
          name: n.student.fullName,
          dateOfBirth: n.student.dateOfBirth,
          gender: n.student.gender ?? undefined,
          gradeLevel: n.student.gradeLevel,
          preferredReadingLevel: n.student.preferredReadingLevel ?? undefined,
          status: n.student.status,
          // Only move the student when the sheet actually names a class.
          ...(resolvedClass ? { classId: resolvedClass.id } : {}),
          familyId: familyId!,
        }).where(and(eq(students.id, a.existing.id), eq(students.schoolId, opts.schoolId)));

        // Keep the family_students join in step with the move.
        const joinRows = await trx.select({ id: familyStudents.id, familyId: familyStudents.familyId })
          .from(familyStudents).where(eq(familyStudents.studentId, a.existing.id));
        if (!joinRows.some((j: any) => j.familyId === familyId)) {
          await trx.delete(familyStudents).where(eq(familyStudents.studentId, a.existing.id));
          await trx.insert(familyStudents).values({ familyId: familyId!, studentId: a.existing.id });
        }
        updated++;
      } else {
        const [row] = await trx.insert(students).values({
          name: n.student.fullName,
          schoolId: opts.schoolId,
          familyId: familyId!,
          studentCode: genStudentCode(),
          classId: resolvedClass?.id || null,
          dateOfBirth: n.student.dateOfBirth,
          gender: n.student.gender,
          gradeLevel: n.student.gradeLevel,
          preferredReadingLevel: n.student.preferredReadingLevel,
          status: n.student.status,
        }).returning();
        await trx.insert(familyStudents).values({ familyId: familyId!, studentId: row.id });
        studentIndex.add({
          id: row.id, name: row.name, dateOfBirth: row.dateOfBirth,
          studentCode: row.studentCode, classId: row.classId, familyId: row.familyId,
        });
        created++;
      }
    }

    // ── Parent invitations ────────────────────────────────────────────────
    //
    // This is the step whose absence made the importer unusable for a real
    // school. Manual enrolment issues a family linking code and emails it;
    // commitImport did not, so importing 300 families produced 300 households
    // in which NOT ONE parent could log in. The only remedy was clicking the
    // per-guardian invite button three hundred times.
    //
    // One code per family, matching manual enrolment: the code links a parent
    // account to the household, so siblings do not need one each.
    const pendingInvitations: PendingInvitation[] = [];
    if (touchedFamilyIds.size > 0) {
      const familyIds = [...touchedFamilyIds];

      const familyRows = await trx.select({
        id: families.id, name: families.name, householdName: families.householdName,
      }).from(families).where(inArray(families.id, familyIds));
      const familyNameById = new Map<string, string>(
        familyRows.map((f: any) => [f.id, f.householdName || f.name || "your family"]),
      );

      const guardianRows = await trx.select({
        id: guardians.id, familyId: guardians.familyId, fullName: guardians.fullName,
        email: guardians.email, isPrimaryContact: guardians.isPrimaryContact,
        portalAccessStatus: guardians.portalAccessStatus, userId: guardians.userId,
      }).from(guardians).where(inArray(guardians.familyId, familyIds));

      // A family that already has a live, unredeemed code does not need another.
      // Re-running an import is a normal thing to do — it must not re-issue
      // credentials, or the code in the parent's inbox stops working.
      const now = new Date();
      const existingCodes = await trx.select({
        familyId: childLinkingCodes.familyId,
        isUsed: childLinkingCodes.isUsed,
        expiresAt: childLinkingCodes.expiresAt,
      }).from(childLinkingCodes).where(inArray(childLinkingCodes.familyId, familyIds));

      const familiesWithLiveCode = new Set<string>(
        existingCodes
          .filter((c: any) => !c.isUsed && (!c.expiresAt || new Date(c.expiresAt) > now))
          .map((c: any) => c.familyId)
          .filter(Boolean),
      );

      const byFamily = new Map<string, any[]>();
      for (const g of guardianRows) {
        byFamily.set(g.familyId, [...(byFamily.get(g.familyId) || []), g]);
      }

      for (const familyId of familyIds) {
        if (familiesWithLiveCode.has(familyId)) continue;
        const candidates = (byFamily.get(familyId) || []).filter((g: any) => looksLikeEmail(g.email));
        // Already has a portal account, or was invited earlier — leave alone.
        if (candidates.some((g: any) => g.userId || g.portalAccessStatus === "active")) continue;
        const guardian = candidates.find((g: any) => g.isPrimaryContact) || candidates[0];
        if (!guardian) continue;   // no email on file: the admin invites by hand

        const email = String(guardian.email).trim().toLowerCase();
        const code = genLinkingCode();
        const expiresAt = new Date(Date.now() + INVITE_TTL_MS);

        await trx.insert(childLinkingCodes).values({
          studentId: null, familyId, code, parentEmail: email,
          expiresAt, schoolId: opts.schoolId,
        });
        await trx.update(guardians)
          .set({ portalAccessStatus: "invited", updatedAt: new Date() })
          .where(eq(guardians.id, guardian.id));

        pendingInvitations.push({
          familyId,
          familyName: familyNameById.get(familyId) || "your family",
          guardianId: guardian.id,
          guardianName: guardian.fullName || "Parent/Guardian",
          email,
          code,
          expiresAt,
        });
      }
    }

    return {
      processed: analyzed.length,
      created,
      updated,
      skipped,
      classesCreated: classResolver.createdClasses.length,
      createdClassNames: classResolver.createdClasses.map((c) => c.name),
      familiesCreated,
      guardiansCreated,
      errorCount: failedRows.filter((f) => !f.problem.startsWith("Duplicate of row")).length,
      failedRows,
      pendingInvitations,
    } satisfies CommitResult;
  });
}

/** Re-exported so the routes file does not reach into submodules. */
export { parseSpreadsheet };
export { SpreadsheetParseError } from "./spreadsheet-parser.js";
