/**
 * server/services/enrollment-import/template.ts
 *
 * Builds the "Download Student Import Template" workbook offered inside the
 * import dialog. Columns come from the SAME registry the parser and validator
 * use (shared/enrollment-import.ts), so the template can never drift away from
 * what the importer actually accepts.
 *
 * Sheet 1 "Students"  — the header row, marked with * where required, plus two
 *                       filled example rows showing the expected UK date format.
 * Sheet 2 "Instructions" — what each column means and which are mandatory.
 */
import * as XLSX from "xlsx";
import {
  IMPORT_FIELDS, IMPORT_FIELD_BY_KEY, TEMPLATE_COLUMNS, TEMPLATE_SAMPLE_ROWS,
} from "../../../shared/enrollment-import.js";

/** Header label as written into the template: required fields carry a *. */
export function templateHeader(key: (typeof TEMPLATE_COLUMNS)[number]): string {
  const f = IMPORT_FIELD_BY_KEY[key];
  return f.required ? `${f.label} *` : f.label;
}

/**
 * Guard against CSV/Excel formula injection in anything we WRITE OUT. Nothing
 * here is user-supplied today, but the rule belongs with the writer so it still
 * holds if these strings ever become dynamic.
 */
function inert(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

export function buildTemplateWorkbook(): Buffer {
  const header = TEMPLATE_COLUMNS.map((k) => inert(templateHeader(k)));
  const sampleRows = TEMPLATE_SAMPLE_ROWS.map((row) =>
    TEMPLATE_COLUMNS.map((k) => inert(row[k] ?? "")),
  );

  const students = XLSX.utils.aoa_to_sheet([header, ...sampleRows]);
  students["!cols"] = TEMPLATE_COLUMNS.map((k) => ({
    wch: Math.max(14, IMPORT_FIELD_BY_KEY[k].label.length + 4),
  }));

  const instructions = XLSX.utils.aoa_to_sheet([
    ["ScholarShelf — Student Import Template"],
    [],
    ["Each row is one student. Delete the two example rows before importing."],
    ["Columns marked * are required, exactly as on the New Enrollment form."],
    ["Dates are UK format: DD/MM/YYYY (20/08/2012 is 20 August 2012). YYYY-MM-DD also works."],
    ["Classes that do not exist yet are created automatically when you confirm the import."],
    ["Students already in ScholarShelf are updated, not duplicated."],
    [],
    ["Column", "Required", "Notes"],
    ...IMPORT_FIELDS
      .filter((f) => TEMPLATE_COLUMNS.includes(f.key as any))
      .map((f) => [inert(f.label), f.required ? "Yes" : "Optional", inert(f.hint || "")]),
    [],
    ["Optional extra columns ScholarShelf also understands:"],
    ...IMPORT_FIELDS
      .filter((f) => !TEMPLATE_COLUMNS.includes(f.key as any))
      .map((f) => [inert(f.label), "Optional", inert(f.hint || "")]),
  ]);
  instructions["!cols"] = [{ wch: 28 }, { wch: 12 }, { wch: 86 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, students, "Students");
  XLSX.utils.book_append_sheet(wb, instructions, "Instructions");

  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
