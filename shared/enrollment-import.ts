/**
 * shared/enrollment-import.ts
 *
 * THE single source of truth for the "Import Student Sheet" feature that lives
 * inside the New Enrollment screen (/admin/family-enroll).
 *
 * Why this file exists, and why it is in shared/:
 *
 *   The spreadsheet importer must populate exactly the same information the
 *   manual enrollment form collects — no more, no less. Both the client (which
 *   renders the column-mapping table and builds the downloadable template) and
 *   the server (which parses, validates and commits) need to agree on:
 *
 *     · which ScholarShelf fields a spreadsheet can carry,
 *     · which of those are mandatory (mirroring family-enrollment.tsx),
 *     · which spreadsheet header names map to which field.
 *
 *   Keeping that in ONE place is a hard requirement: alias tables scattered
 *   across files drift, and drifting aliases silently put data in the wrong
 *   column. Everything below is imported, never re-declared.
 *
 * Field set is derived from the real enrollment form:
 *   Student  — Full Name*, Date of Birth*, Grade Level*, Gender, Reading Level, Class
 *   Family   — Household Name, Primary Email, Primary Phone, Address
 *   Guardian — Full Name, Relationship, Email, Phone
 *   Class    — Year Group, Academic Year (used only when a class must be created)
 *
 * Student ID is deliberately NOT a required field: ScholarShelf generates
 * studentCode (STU-XXXX) on enrollment and the form shows it as read-only.
 * It IS accepted as an OPTIONAL column so an existing student can be matched
 * exactly by their ScholarShelf code on a re-import.
 */

export type ImportFieldKey =
  | "studentCode"
  | "fullName"
  | "firstName"
  | "middleName"
  | "lastName"
  | "dateOfBirth"
  | "gender"
  | "gradeLevel"
  | "preferredReadingLevel"
  | "className"
  | "yearGroup"
  | "academicYear"
  | "status"
  | "householdName"
  | "familyEmail"
  | "familyPhone"
  | "address"
  | "guardianName"
  | "guardianRelationship"
  | "guardianEmail"
  | "guardianPhone";

export type ImportFieldGroup = "student" | "class" | "family" | "guardian";

export interface ImportFieldDef {
  key: ImportFieldKey;
  /** Human label shown in the mapping UI and used as the template header. */
  label: string;
  group: ImportFieldGroup;
  /**
   * Required to enrol a student, mirroring the manual form's `*` markers.
   * fullName can be satisfied by firstName + lastName instead — see
   * `NAME_PART_KEYS` and the validator.
   */
  required: boolean;
  /** One-line hint shown under the header in the template / mapping UI. */
  hint?: string;
  /**
   * Header spellings that map to this field. Compared after normalisation
   * (lowercased, punctuation and spaces stripped) so "First Name", "first_name",
   * "FIRSTNAME" and "Forename" all collapse to the same token.
   */
  aliases: string[];
}

/**
 * The canonical field registry. Order matters: it is the column order of the
 * downloadable template and of the mapping table.
 */
export const IMPORT_FIELDS: ImportFieldDef[] = [
  {
    key: "studentCode",
    label: "Student ID",
    group: "student",
    required: false,
    hint: "Existing ScholarShelf code (STU-XXXX). Leave blank for new students — it is generated automatically.",
    aliases: [
      "studentid", "studentno", "studentnumber", "studentcode", "admissionnumber",
      "admissionno", "admissionid", "upn", "uniquepupilnumber", "pupilid",
      "pupilnumber", "reference", "ref", "id",
    ],
  },
  {
    key: "fullName",
    label: "Full Name",
    group: "student",
    required: true,
    hint: "Required — or supply First Name and Last Name instead.",
    aliases: [
      "fullname", "name", "studentname", "pupilname", "student", "pupil",
      "childname", "child", "learnername",
    ],
  },
  {
    key: "firstName",
    label: "First Name",
    group: "student",
    required: false,
    hint: "Used with Last Name when there is no single Full Name column.",
    aliases: ["firstname", "forename", "givenname", "first", "christianname"],
  },
  {
    key: "middleName",
    label: "Middle Name",
    group: "student",
    required: false,
    aliases: ["middlename", "middle", "middlenames", "othernames"],
  },
  {
    key: "lastName",
    label: "Last Name",
    group: "student",
    required: false,
    hint: "Used with First Name when there is no single Full Name column.",
    aliases: ["lastname", "surname", "familyname", "last"],
  },
  {
    key: "dateOfBirth",
    label: "Date of Birth",
    group: "student",
    required: true,
    hint: "Required. UK format DD/MM/YYYY, or YYYY-MM-DD, or a real Excel date cell.",
    aliases: ["dateofbirth", "dob", "birthdate", "dateofbirthdmy", "birthday", "born", "dateborn"],
  },
  {
    key: "gender",
    label: "Gender",
    group: "student",
    required: false,
    hint: "Female, Male or Other.",
    aliases: ["gender", "sex"],
  },
  {
    key: "gradeLevel",
    label: "Grade Level",
    group: "student",
    required: true,
    hint: "Required. e.g. Year 7, 3rd Grade.",
    // NOTE: "form" is deliberately NOT here — in UK schools a "form" is a tutor
    // group, i.e. a class. It belongs to className below.
    aliases: ["gradelevel", "grade", "year", "yearlevel", "level", "keystage"],
  },
  {
    key: "preferredReadingLevel",
    label: "Reading Level",
    group: "student",
    required: false,
    hint: "Optional. e.g. M",
    aliases: ["readinglevel", "preferredreadinglevel", "bookband", "readingband", "bandlevel"],
  },
  {
    key: "className",
    label: "Class",
    group: "class",
    required: false,
    hint: "Existing or new class name. Missing classes are created automatically.",
    aliases: [
      "class", "classname", "tutorgroup", "tutor", "form", "formgroup",
      "registrationgroup", "reggroup", "set", "section", "homeroom",
    ],
  },
  {
    key: "yearGroup",
    label: "Year Group",
    group: "class",
    required: false,
    hint: "Only used when a new class has to be created.",
    aliases: ["yeargroup", "yeargrp", "nationalcurriculumyear", "ncyear", "cohort"],
  },
  {
    key: "academicYear",
    label: "Academic Year",
    group: "class",
    required: false,
    hint: "Only used when a new class has to be created. Defaults to the current academic year.",
    aliases: ["academicyear", "schoolyear", "acadyear", "intakeyear"],
  },
  {
    key: "status",
    label: "Status",
    group: "student",
    required: false,
    hint: "active, inactive or alumni. Defaults to active.",
    aliases: ["status", "studentstatus", "enrolmentstatus", "enrollmentstatus", "state"],
  },
  {
    key: "householdName",
    label: "Family / Household Name",
    group: "family",
    required: false,
    hint: "Groups siblings into one family record. Defaults to the student's surname.",
    // NOTE: "familyname" is NOT here — it is a common spelling of Surname and is
    // claimed by lastName above. Household grouping uses the explicit spellings.
    aliases: [
      "household", "householdname", "family", "familyhousehold",
      "familyreference", "familycode", "householdreference",
    ],
  },
  {
    key: "familyEmail",
    label: "Family Email",
    group: "family",
    required: false,
    aliases: ["familyemail", "householdemail", "primaryemail", "contactemail", "homeemail"],
  },
  {
    key: "familyPhone",
    label: "Family Phone",
    group: "family",
    required: false,
    aliases: ["familyphone", "householdphone", "primaryphone", "contactphone", "hometelephone", "hometel", "telephone", "phone"],
  },
  {
    key: "address",
    label: "Address",
    group: "family",
    required: false,
    aliases: ["address", "homeaddress", "postaladdress", "street", "addressline1"],
  },
  {
    key: "guardianName",
    label: "Parent / Guardian Name",
    group: "guardian",
    required: false,
    hint: "Recommended so the family can be invited to the parent portal.",
    aliases: [
      "guardianname", "guardian", "parentname", "parent", "parentguardian",
      "parentguardianname", "carername", "carer", "nextofkin", "mothername", "fathername",
    ],
  },
  {
    key: "guardianRelationship",
    label: "Relationship",
    group: "guardian",
    required: false,
    hint: "Mother, Father, Guardian or Other.",
    aliases: ["relationship", "guardianrelationship", "parentrelationship", "relation", "relationshiptostudent"],
  },
  {
    key: "guardianEmail",
    label: "Parent / Guardian Email",
    group: "guardian",
    required: false,
    hint: "Used to match siblings into one family and to send the portal invite.",
    aliases: ["guardianemail", "parentemail", "parentsemail", "carersemail", "email", "emailaddress", "parentmail"],
  },
  {
    key: "guardianPhone",
    label: "Parent / Guardian Phone",
    group: "guardian",
    required: false,
    aliases: ["guardianphone", "parentphone", "guardianmobile", "parentmobile", "mobile", "mobilenumber", "contactnumber"],
  },
];

export const IMPORT_FIELD_BY_KEY: Record<ImportFieldKey, ImportFieldDef> =
  Object.fromEntries(IMPORT_FIELDS.map((f) => [f.key, f])) as Record<ImportFieldKey, ImportFieldDef>;

/** Keys that together can stand in for `fullName`. */
export const NAME_PART_KEYS: ImportFieldKey[] = ["firstName", "middleName", "lastName"];

/** Columns written into the downloadable template, in order. */
export const TEMPLATE_COLUMNS: ImportFieldKey[] = [
  "studentCode", "fullName", "dateOfBirth", "gender", "gradeLevel", "className",
  "yearGroup", "preferredReadingLevel", "householdName", "guardianName",
  "guardianRelationship", "guardianEmail", "guardianPhone", "address",
];

/** Two example rows shipped in the template so the expected shape is obvious. */
export const TEMPLATE_SAMPLE_ROWS: Partial<Record<ImportFieldKey, string>>[] = [
  {
    fullName: "Amelia Brown", dateOfBirth: "20/08/2012", gender: "Female",
    gradeLevel: "Year 7", className: "Year 7C", yearGroup: "Year 7",
    householdName: "Brown Household", guardianName: "Sarah Brown",
    guardianRelationship: "Mother", guardianEmail: "sarah.brown@example.com",
    guardianPhone: "07700 900123", address: "12 Elm Road, Manchester",
  },
  {
    fullName: "Adam Khan", dateOfBirth: "03/11/2011", gender: "Male",
    gradeLevel: "Year 8", className: "Year 8A", yearGroup: "Year 8",
    householdName: "Khan Household", guardianName: "Imran Khan",
    guardianRelationship: "Father", guardianEmail: "imran.khan@example.com",
    guardianPhone: "07700 900456", address: "5 Oak Lane, Manchester",
  },
];

// ── Upload limits (enforced server-side; echoed in the UI) ──────────────────

export const IMPORT_MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB
export const IMPORT_MAX_ROWS = 2000;
export const IMPORT_MAX_COLUMNS = 60;
export const IMPORT_ALLOWED_EXTENSIONS = [".xlsx", ".xls", ".csv"] as const;
export const IMPORT_ACCEPT_ATTR = IMPORT_ALLOWED_EXTENSIONS.join(",");

/** Values accepted in a Status column, normalised to the students.status enum. */
export const IMPORT_STATUS_VALUES: Record<string, string> = {
  active: "active", enrolled: "active", current: "active", onroll: "active",
  inactive: "inactive", left: "inactive", withdrawn: "inactive", suspended: "inactive",
  alumni: "alumni", graduated: "alumni", leaver: "alumni",
};

/** Values accepted in a Gender column, normalised to the form's options. */
export const IMPORT_GENDER_VALUES: Record<string, string> = {
  f: "Female", female: "Female", girl: "Female", w: "Female",
  m: "Male", male: "Male", boy: "Male",
  o: "Other", other: "Other", x: "Other", nonbinary: "Other", prefernottosay: "Other",
};

/**
 * Header normalisation used by BOTH the alias table above and the matcher.
 * Strips everything that is not a letter or digit so punctuation, spacing and
 * casing can never change the result.
 */
export function normalizeHeader(raw: string): string {
  return String(raw ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Reverse index: normalised alias → field key. Built once. */
const ALIAS_INDEX: Map<string, ImportFieldKey> = (() => {
  const m = new Map<string, ImportFieldKey>();
  for (const f of IMPORT_FIELDS) {
    // The field's own key and label are always valid headers.
    for (const candidate of [f.key, f.label, ...f.aliases]) {
      const n = normalizeHeader(candidate);
      if (n && !m.has(n)) m.set(n, f.key);
    }
  }
  return m;
})();

export interface HeaderMatch {
  field: ImportFieldKey | null;
  /** "exact" = unambiguous alias hit. "none" = we could not place it. */
  confidence: "exact" | "none";
}

/**
 * Map ONE spreadsheet header to a ScholarShelf field.
 *
 * Deliberately conservative: exact alias match only. There is NO fuzzy /
 * edit-distance matching, because a near-miss that silently writes "Guardian
 * Email" into "Family Email" is worse than asking the administrator to pick.
 * Anything we cannot place comes back as `null` and is highlighted in the UI
 * for the administrator to map or ignore.
 */
export function matchHeader(raw: string): HeaderMatch {
  const n = normalizeHeader(raw);
  if (!n) return { field: null, confidence: "none" };
  const hit = ALIAS_INDEX.get(n);
  return hit ? { field: hit, confidence: "exact" } : { field: null, confidence: "none" };
}

/**
 * Map a whole header row, refusing to assign the same field twice — the first
 * column wins and later collisions are reported as unmapped so the
 * administrator resolves them explicitly.
 */
export function autoMapHeaders(headers: string[]): Array<{ column: string; index: number; field: ImportFieldKey | null; confidence: "exact" | "none"; duplicate: boolean }> {
  const taken = new Set<ImportFieldKey>();
  return headers.map((column, index) => {
    const { field, confidence } = matchHeader(column);
    if (field && taken.has(field)) {
      return { column, index, field: null, confidence: "none" as const, duplicate: true };
    }
    if (field) taken.add(field);
    return { column, index, field, confidence, duplicate: false };
  });
}
