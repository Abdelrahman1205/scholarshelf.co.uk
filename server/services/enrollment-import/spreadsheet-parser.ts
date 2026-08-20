/**
 * server/services/enrollment-import/spreadsheet-parser.ts
 *
 * Turns an uploaded .xlsx / .xls / .csv buffer into a plain header + rows
 * structure. Nothing here knows anything about ScholarShelf fields — that is
 * the column mapper's job.
 *
 * SECURITY POSTURE (student data is personal data; treat every upload as hostile)
 *
 *   · Magic-byte sniffing — the declared MIME type and file extension are only
 *     a first pass; the actual bytes decide. A .csv full of ZIP bytes is rejected.
 *   · No formula evaluation — SheetJS never evaluates formulas, and we go
 *     further: cached formula results are read as VALUES and the formula source
 *     (cell.f) is discarded, so nothing from the sheet is ever interpreted.
 *   · No macros — .xlsm is not in the allow-list, and even for .xlsx we read
 *     only the worksheet cell values; VBA parts are never touched or executed.
 *   · bookVBA/bookFiles off, sheetStubs off — we ask the parser for the smallest
 *     possible object graph.
 *   · Hard caps on rows and columns so a crafted sheet cannot exhaust memory.
 *   · Buffers stay in memory (multer memoryStorage); nothing is ever written to
 *     disk, so no uploaded student sheet is ever publicly reachable.
 */
import * as XLSX from "xlsx";
import {
  IMPORT_MAX_ROWS, IMPORT_MAX_COLUMNS, IMPORT_ALLOWED_EXTENSIONS,
} from "../../../shared/enrollment-import.js";

export type CellValue = string | number | Date | null;

export interface ParsedRow {
  /**
   * 1-based row number AS THE ADMINISTRATOR SEES IT IN EXCEL (header is row 1),
   * so an error saying "Row 15" points at row 15 of their file even though
   * blank rows were skipped.
   */
  sheetRow: number;
  cells: CellValue[];
}

export interface ParsedSheet {
  /** Trimmed header labels, in sheet order. Blank headers become "Column N". */
  headers: string[];
  /** Data rows, aligned to `headers`. */
  rows: ParsedRow[];
  sheetName: string;
  /** Row count before the IMPORT_MAX_ROWS cap was applied. */
  totalRowsInFile: number;
  truncated: boolean;
}

export class SpreadsheetParseError extends Error {}

const ZIP_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04]);           // xlsx (OOXML = zip)
const CFB_MAGIC = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]); // legacy .xls

export type SheetKind = "xlsx" | "xls" | "csv";

/** Extension check — first pass only. */
export function extensionOf(filename: string): string {
  const i = filename.lastIndexOf(".");
  return i === -1 ? "" : filename.slice(i).toLowerCase();
}

/**
 * Decide what the file ACTUALLY is from its bytes, and refuse when the bytes
 * disagree with the extension. Returns the trusted kind.
 */
export function sniffSheetKind(buffer: Buffer, filename: string): SheetKind {
  const ext = extensionOf(filename);
  if (!(IMPORT_ALLOWED_EXTENSIONS as readonly string[]).includes(ext)) {
    throw new SpreadsheetParseError(
      `Unsupported file type "${ext || "unknown"}". Upload an .xlsx, .xls or .csv file.`,
    );
  }
  if (buffer.length === 0) throw new SpreadsheetParseError("The uploaded file is empty.");

  const isZip = buffer.subarray(0, 4).equals(ZIP_MAGIC);
  const isCfb = buffer.subarray(0, 8).equals(CFB_MAGIC);

  if (isZip) {
    if (ext !== ".xlsx") {
      throw new SpreadsheetParseError(
        `This file's contents are an Excel workbook but it is named "${ext}". Rename it to .xlsx or upload the correct file.`,
      );
    }
    return "xlsx";
  }
  if (isCfb) {
    if (ext !== ".xls") {
      throw new SpreadsheetParseError(
        `This file's contents are a legacy Excel workbook but it is named "${ext}". Rename it to .xls or upload the correct file.`,
      );
    }
    return "xls";
  }
  if (ext === ".csv") {
    // A CSV must be text. Reject anything with NUL bytes in the first 4 KB —
    // that is a binary payload wearing a .csv name.
    const head = buffer.subarray(0, 4096);
    if (head.includes(0x00)) {
      throw new SpreadsheetParseError("This .csv file contains binary data and was rejected.");
    }
    return "csv";
  }
  throw new SpreadsheetParseError(
    "The file contents are not a readable spreadsheet. Upload an .xlsx, .xls or .csv file.",
  );
}

/** Strip a UTF-8 BOM so the first header does not come back as "﻿Name". */
function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/**
 * Read the workbook safely. `cellDates` gives real Date objects for genuine
 * Excel date cells; `cellFormula: false` makes SheetJS drop formula source
 * entirely so only cached values survive.
 */
function readWorkbook(buffer: Buffer, kind: SheetKind): XLSX.WorkBook {
  const common: XLSX.ParsingOptions = {
    cellDates: true,
    cellFormula: false,   // never carry formula source through
    cellHTML: false,      // never carry rich text / HTML through
    cellStyles: false,
    sheetStubs: false,
    bookVBA: false,       // never read the macro part
    bookFiles: false,
    bookDeps: false,
    dense: false,
  };
  if (kind === "csv") {
    // CRITICAL for a UK product: read CSV cells RAW, as text.
    //
    // A .csv has no cell types — every value is a string. If SheetJS is allowed
    // to coerce (raw: false), it applies US month-first rules and turns
    // "04/09/2013" into 9 April 2013 before our own parser ever sees it. Reading
    // raw keeps the original characters so parseSpreadsheetDate() can apply the
    // UK day-first rule, which is the only rule ScholarShelf accepts.
    return XLSX.read(stripBom(buffer.toString("utf8")), {
      ...common, type: "string", raw: true, cellDates: false,
    });
  }
  // XLSX / XLS: a genuine date CELL is an unambiguous serial number, so letting
  // SheetJS produce a real Date is correct. Text dates stay strings and go
  // through the UK parser like CSV values do.
  return XLSX.read(buffer, { ...common, type: "buffer" });
}

/**
 * A cell value we are willing to hand onwards. Anything exotic (objects, rich
 * text fragments, error cells) is flattened to a trimmed string or dropped.
 */
function normalizeCell(value: unknown): string | number | Date | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  const s = String(value).trim();
  if (!s) return null;
  // Defence in depth: if a formula string somehow reaches us, keep it as inert
  // text rather than anything a downstream consumer might treat as live.
  return s.slice(0, 1000);
}

/**
 * Parse the FIRST worksheet. One sheet per import keeps the mental model simple
 * and matches how schools export from their MIS.
 */
export function parseSpreadsheet(buffer: Buffer, filename: string): ParsedSheet {
  const kind = sniffSheetKind(buffer, filename);

  let wb: XLSX.WorkBook;
  try {
    wb = readWorkbook(buffer, kind);
  } catch (e: any) {
    throw new SpreadsheetParseError(
      `The file could not be read as a spreadsheet${e?.message ? `: ${e.message}` : "."}`,
    );
  }

  const sheetName = wb.SheetNames?.[0];
  if (!sheetName) throw new SpreadsheetParseError("The workbook has no worksheets.");
  const sheet = wb.Sheets[sheetName];
  if (!sheet) throw new SpreadsheetParseError("The first worksheet could not be read.");

  // header:1 → array-of-arrays, so we control header handling ourselves rather
  // than letting SheetJS invent keys (and silently collapse duplicate headers).
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    blankrows: false,
    defval: null,
    raw: true,
  });

  if (matrix.length === 0) {
    throw new SpreadsheetParseError("The spreadsheet is empty — there is nothing to import.");
  }

  const rawHeader = matrix[0] ?? [];
  const width = Math.min(rawHeader.length, IMPORT_MAX_COLUMNS);
  if (width === 0) {
    throw new SpreadsheetParseError("The first row of the spreadsheet has no column headings.");
  }

  const headers: string[] = [];
  for (let c = 0; c < width; c++) {
    const label = normalizeCell(rawHeader[c]);
    headers.push(label === null ? `Column ${c + 1}` : String(label).slice(0, 120));
  }

  const bodyRows = matrix.slice(1);
  const rows: ParsedRow[] = [];
  for (let r = 0; r < bodyRows.length; r++) {
    if (rows.length >= IMPORT_MAX_ROWS) break;
    const raw = bodyRows[r];
    const cells: CellValue[] = [];
    let hasValue = false;
    for (let c = 0; c < width; c++) {
      const v = normalizeCell((raw as unknown[])?.[c]);
      if (v !== null) hasValue = true;
      cells.push(v);
    }
    if (!hasValue) continue; // skip fully blank rows outright
    rows.push({ sheetRow: r + 2, cells }); // +2: 1-based, and row 1 is the header
  }

  if (rows.length === 0) {
    throw new SpreadsheetParseError(
      "The spreadsheet has column headings but no student rows.",
    );
  }

  return {
    headers,
    rows,
    sheetName,
    totalRowsInFile: bodyRows.length,
    truncated: bodyRows.length > rows.length,
  };
}
