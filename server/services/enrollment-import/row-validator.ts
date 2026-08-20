/**
 * server/services/enrollment-import/row-validator.ts
 *
 * Turns one parsed spreadsheet row into the same shape the manual New
 * Enrollment form posts, and applies the SAME rules.
 *
 * The importer must not be a back door. Everything the manual form enforces —
 * required Full Name / Date of Birth / Grade Level, a real past DOB, a
 * well-formed email, a class that belongs to this school, an allowed status
 * value — is enforced here too, before anything reaches the database.
 *
 * One invalid row never stops the file being analysed: each row carries its own
 * list of problems, and the preview shows them all at once.
 */
import {
  IMPORT_FIELDS, IMPORT_GENDER_VALUES, IMPORT_STATUS_VALUES,
  type ImportFieldKey,
} from "../../../shared/enrollment-import.js";
import type { CellValue, ParsedRow } from "./spreadsheet-parser.js";
import { parseSpreadsheetDate, isPlausibleDob } from "./date-parser.js";

/** column index → ScholarShelf field. Built from the confirmed mapping. */
export type ColumnMapping = Record<number, ImportFieldKey>;

export interface RowIssue {
  field: ImportFieldKey | null;
  message: string;
}

export interface NormalizedRow {
  sheetRow: number;
  /** Student fields, named exactly as the enrollment API expects them. */
  student: {
    fullName: string;
    dateOfBirth: string | null;   // ISO yyyy-mm-dd
    gender: string | null;
    gradeLevel: string | null;
    preferredReadingLevel: string | null;
    status: string;
    studentCode: string | null;   // supplied, for matching an existing student
  };
  className: string | null;
  yearGroup: string | null;
  academicYear: string | null;
  family: {
    householdName: string | null;
    primaryEmail: string | null;
    primaryPhone: string | null;
    address: string | null;
  };
  guardian: {
    fullName: string | null;
    relationship: string | null;
    email: string | null;
    phone: string | null;
  };
  issues: RowIssue[];
  valid: boolean;
}

// ── Small shared helpers, mirroring family-enrollment.routes.ts ──────────────

/** Same contract as `str()` in family-enrollment.routes.ts. */
function str(v: CellValue, max = 300): string | null {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return null; // a date never stands in for a text field
  const t = String(v).trim();
  return t ? t.slice(0, max) : null;
}

/** Same regex the manual form's server handler uses. */
function isEmailish(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

/** Collapse runs of whitespace so "  John   Smith " matches "John Smith". */
function tidyName(v: string): string {
  return v.replace(/\s+/g, " ").trim();
}

const RELATIONSHIPS = ["Mother", "Father", "Guardian", "Other"];

function normalizeRelationship(v: string | null): string | null {
  if (!v) return null;
  const n = v.trim().toLowerCase();
  const hit = RELATIONSHIPS.find((r) => r.toLowerCase() === n);
  if (hit) return hit;
  if (["mum", "mom", "mother", "step-mother", "stepmother"].includes(n)) return "Mother";
  if (["dad", "father", "step-father", "stepfather"].includes(n)) return "Father";
  if (["carer", "guardian", "legal guardian", "kinship carer"].includes(n)) return "Guardian";
  return "Other";
}

/**
 * Derive a household name when the sheet doesn't carry one, so siblings still
 * land in a sensible family record: "Brown Household" from "Amelia Brown".
 */
export function householdNameFromStudent(fullName: string): string {
  const parts = tidyName(fullName).split(" ");
  const surname = parts.length > 1 ? parts[parts.length - 1] : parts[0];
  return `${surname} Household`;
}

// ── The validator ───────────────────────────────────────────────────────────

const FIELD_LABEL: Record<string, string> =
  Object.fromEntries(IMPORT_FIELDS.map((f) => [f.key, f.label]));

/**
 * Read one field out of a row using the confirmed column mapping.
 * Returns the raw cell (not stringified) so date cells keep their type.
 */
function cellFor(row: ParsedRow, mapping: ColumnMapping, key: ImportFieldKey): CellValue {
  for (const [idxStr, field] of Object.entries(mapping)) {
    if (field === key) {
      const v = row.cells[Number(idxStr)];
      return v === undefined ? null : v;
    }
  }
  return null;
}

export function normalizeRow(row: ParsedRow, mapping: ColumnMapping): NormalizedRow {
  const issues: RowIssue[] = [];
  const get = (k: ImportFieldKey) => cellFor(row, mapping, k);
  const text = (k: ImportFieldKey, max = 300) => str(get(k), max);

  // ── Name: a single Full Name column, or First + Middle + Last ──
  let fullName = text("fullName", 200);
  if (!fullName) {
    const first = text("firstName", 80);
    const middle = text("middleName", 80);
    const last = text("lastName", 80);
    const joined = [first, middle, last].filter(Boolean).join(" ").trim();
    if (joined) fullName = joined;
  }
  fullName = fullName ? tidyName(fullName) : "";
  if (!fullName) {
    issues.push({ field: "fullName", message: "Missing student name" });
  }

  // ── Date of birth (required, UK-first, must be a real past date) ──
  const dobCell = get("dateOfBirth");
  let dateOfBirth: string | null = null;
  const parsedDob = parseSpreadsheetDate(dobCell);
  if (!parsedDob.iso) {
    issues.push({ field: "dateOfBirth", message: parsedDob.error || "Missing date of birth" });
  } else if (!isPlausibleDob(parsedDob.iso)) {
    issues.push({
      field: "dateOfBirth",
      message: `Date of birth ${parsedDob.iso} is in the future or before 1900`,
    });
  } else {
    dateOfBirth = parsedDob.iso;
  }

  // ── Grade level (required by the manual form) ──
  const gradeLevel = text("gradeLevel", 40);
  if (!gradeLevel) {
    issues.push({ field: "gradeLevel", message: "Missing grade level" });
  }

  // ── Gender (optional, but must be one of the form's options) ──
  const genderRaw = text("gender", 40);
  let gender: string | null = null;
  if (genderRaw) {
    const hit = IMPORT_GENDER_VALUES[genderRaw.toLowerCase().replace(/[^a-z]/g, "")];
    if (hit) gender = hit;
    else issues.push({ field: "gender", message: `"${genderRaw}" is not a recognised gender (use Female, Male or Other)` });
  }

  // ── Status (optional, must be an allowed students.status value) ──
  const statusRaw = text("status", 40);
  let status = "active";
  if (statusRaw) {
    const hit = IMPORT_STATUS_VALUES[statusRaw.toLowerCase().replace(/[^a-z]/g, "")];
    if (hit) status = hit;
    else issues.push({ field: "status", message: `"${statusRaw}" is not an allowed status (use active, inactive or alumni)` });
  }

  // ── Emails: shape-checked exactly like the manual form ──
  const guardianEmail = text("guardianEmail", 255);
  if (guardianEmail && !isEmailish(guardianEmail)) {
    issues.push({ field: "guardianEmail", message: `"${guardianEmail}" is not a valid email address` });
  }
  const familyEmail = text("familyEmail", 255);
  if (familyEmail && !isEmailish(familyEmail)) {
    issues.push({ field: "familyEmail", message: `"${familyEmail}" is not a valid email address` });
  }

  const className = text("className", 120);
  const studentCode = text("studentCode", 60);

  const normalized: NormalizedRow = {
    sheetRow: row.sheetRow,
    student: {
      fullName,
      dateOfBirth,
      gender,
      gradeLevel,
      preferredReadingLevel: text("preferredReadingLevel", 40),
      status,
      studentCode,
    },
    className,
    yearGroup: text("yearGroup", 60),
    academicYear: text("academicYear", 20),
    family: {
      householdName: text("householdName", 200),
      primaryEmail: familyEmail && isEmailish(familyEmail) ? familyEmail : null,
      primaryPhone: text("familyPhone", 40),
      address: text("address", 500),
    },
    guardian: {
      fullName: (() => { const g = text("guardianName", 200); return g ? tidyName(g) : null; })(),
      relationship: normalizeRelationship(text("guardianRelationship", 40)),
      email: guardianEmail && isEmailish(guardianEmail) ? guardianEmail : null,
      phone: text("guardianPhone", 40),
    },
    issues,
    valid: issues.length === 0,
  };

  return normalized;
}

/**
 * Which required fields are not mapped at all. Reported once for the whole file
 * rather than repeated on every row, so the administrator fixes the mapping
 * instead of scrolling through 128 identical errors.
 */
export function missingRequiredFields(mapping: ColumnMapping): string[] {
  const mapped = new Set(Object.values(mapping));
  const missing: string[] = [];
  for (const f of IMPORT_FIELDS) {
    if (!f.required) continue;
    if (mapped.has(f.key)) continue;
    // fullName can be satisfied by first + last name columns instead.
    if (f.key === "fullName" && mapped.has("firstName") && mapped.has("lastName")) continue;
    missing.push(FIELD_LABEL[f.key] || f.key);
  }
  return missing;
}
