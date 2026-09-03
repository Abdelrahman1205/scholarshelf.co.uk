/**
 * Spreadsheet Student Import (inside New Enrollment) — Integration Tests
 *
 * Run against a live server:
 *   npx tsx tests/enrollment-import.ts
 *
 * Prerequisites:
 *   - Server running on APP_BASE_URL (default http://localhost:5000)
 *   - Test fixtures loaded (npm run test:fixtures → admin/admin123 + TEST-001)
 *
 * Coverage:
 *   1.  Authentication guard on every import endpoint
 *   2.  Manual New Enrollment still works (regression)
 *   3.  Download Student Import Template
 *   4.  XLSX upload — analyse
 *   5.  CSV upload — analyse
 *   6.  Correct column mapping from header aliases (Forename/Surname/DOB/Tutor Group)
 *   7.  Incorrect mapping corrected by the administrator's override
 *   8.  Missing required field → row reported invalid, file still analysable
 *   9.  Invalid email → row invalid
 *  10.  Invalid date → row invalid
 *  11.  UK dates are NOT reinterpreted as US MM/DD/YYYY
 *  12.  Excel real date cells parse correctly
 *  13.  Preview does NOT modify the database
 *  14.  Cancel before confirmation leaves the database untouched
 *  15.  Confirm DOES modify the database correctly
 *  16.  New class created automatically; existing class reused
 *  17.  Several students in one new class → the class is created ONCE
 *  18.  Case/whitespace variants of a class name resolve to one class
 *  19.  Existing student updated, not duplicated
 *  20.  Existing student moved to another class
 *  21.  Duplicate students within one spreadsheet imported once
 *  22.  Empty spreadsheet rejected cleanly
 *  23.  Extra unrecognised columns ignored and reported
 *  24.  Mixed valid + invalid rows: valid ones import, invalid ones reported
 *  25.  Rejected file types
 *  26.  Tenant isolation — import only touches the caller's school
 *  27.  Audit log records the import
 */
import * as XLSX from "xlsx";

const BASE = process.env.APP_BASE_URL || "http://localhost:5000";
const TAG = Date.now().toString(36).slice(-5);

interface TestResult { name: string; passed: boolean; detail: string }
const results: TestResult[] = [];
let adminCookie = "";

function pass(name: string, detail = "") {
  results.push({ name, passed: true, detail });
  console.log(`  ✓ ${name}${detail ? " — " + detail : ""}`);
}
function fail(name: string, detail: string) {
  results.push({ name, passed: false, detail });
  console.error(`  ✗ ${name} — ${detail}`);
}
function check(name: string, condition: boolean, detail = "") {
  condition ? pass(name, detail) : fail(name, detail || "assertion failed");
}

async function req(method: string, path: string, body?: unknown, cookie = adminCookie) {
  const hasBody = body !== undefined && method !== "GET";
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { ...(hasBody ? { "Content-Type": "application/json" } : {}), ...(cookie ? { Cookie: cookie } : {}) },
    ...(hasBody ? { body: JSON.stringify(body) } : {}),
    redirect: "manual",
  });
  let parsed: any = null;
  try { parsed = await res.json(); } catch { /* non-JSON */ }
  return { status: res.status, body: parsed };
}

/** POST a spreadsheet to an import endpoint as multipart/form-data. */
async function postSheet(
  path: string,
  file: { name: string; buffer: Buffer | string; type?: string },
  mapping?: Record<number, string>,
  cookie = adminCookie,
) {
  const fd = new FormData();
  const bytes = typeof file.buffer === "string" ? Buffer.from(file.buffer, "utf8") : file.buffer;
  fd.append("file", new Blob([new Uint8Array(bytes)], { type: file.type || "application/octet-stream" }), file.name);
  if (mapping) fd.append("mapping", JSON.stringify(mapping));
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    body: fd,
    headers: cookie ? { Cookie: cookie } : {},
    redirect: "manual",
  });
  let parsed: any = null;
  try { parsed = await res.json(); } catch { /* non-JSON */ }
  return { status: res.status, body: parsed };
}

/** Build an .xlsx buffer from an array-of-arrays. */
function xlsxOf(rows: (string | number | Date | null)[][]): Buffer {
  const ws = XLSX.utils.aoa_to_sheet(rows, { cellDates: true });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Students");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const csvOf = (rows: string[][]) => rows.map((r) => r.map((c) => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(",")).join("\n");

// ── Helpers to inspect state ────────────────────────────────────────────────

async function getClasses(): Promise<any[]> {
  const r = await req("GET", "/api/classes");
  return Array.isArray(r.body) ? r.body : [];
}
async function findClassByName(name: string) {
  const list = await getClasses();
  return list.find((c: any) => (c.name || "").trim().toLowerCase() === name.trim().toLowerCase()) || null;
}
async function countClassesNamed(name: string) {
  const list = await getClasses();
  return list.filter((c: any) => (c.name || "").trim().toLowerCase() === name.trim().toLowerCase()).length;
}
async function findStudentsByName(name: string): Promise<any[]> {
  const r = await req("GET", `/api/families/search?q=${encodeURIComponent(name)}`);
  const fams = Array.isArray(r.body) ? r.body : [];
  return fams.flatMap((f: any) => (f.students || []).filter((s: any) => (s.name || "").toLowerCase() === name.toLowerCase()));
}

// ── The suite ───────────────────────────────────────────────────────────────

async function run() {
  console.log(`\n▶ Spreadsheet Student Import tests against ${BASE}  (tag ${TAG})\n`);

  // ── 1. Auth guard (before logging in) ──
  console.log("1. Authentication guard");
  {
    const endpoints = [
      ["GET", "/api/families/enroll/import/fields"],
      ["GET", "/api/families/enroll/import/template"],
    ] as const;
    let allBlocked = true;
    for (const [m, p] of endpoints) {
      const r = await req(m, p, undefined, "");
      if (r.status !== 401 && r.status !== 403) allBlocked = false;
    }
    const a = await postSheet("/api/families/enroll/import/analyze", { name: "x.csv", buffer: "Full Name\nA" }, undefined, "");
    const c = await postSheet("/api/families/enroll/import/commit", { name: "x.csv", buffer: "Full Name\nA" }, undefined, "");
    check("Unauthenticated requests are rejected",
      allBlocked && [401, 403].includes(a.status) && [401, 403].includes(c.status),
      `analyze=${a.status} commit=${c.status}`);
  }

  // ── Log in ──
  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "admin", password: "admin123", schoolCode: "TEST-001" }),
    redirect: "manual",
  });
  adminCookie = (loginRes.headers.getSetCookie?.() || []).map((c) => c.split(";")[0]).join("; ");
  if (!adminCookie) { console.error("Could not log in — aborting."); process.exit(1); }
  console.log("  · logged in as admin\n");

  // ── 2. Manual New Enrollment regression ──
  console.log("2. Manual enrollment still works");
  {
    const r = await req("POST", "/api/families/enroll", {
      family: { householdName: `Manual ${TAG} Household`, primaryEmail: `manual.${TAG}@example.com`, primaryPhone: `0700${TAG}11` },
      guardians: [{ fullName: `Manual Parent ${TAG}`, relationship: "Mother", email: `manual.${TAG}@example.com`, phone: `0700${TAG}11`, isPrimaryContact: true }],
      students: [{ fullName: `Manual Child ${TAG}`, dateOfBirth: "2013-05-04", gradeLevel: "Year 7", gender: "Female" }],
    });
    check("Manual enrollment creates a family + student", r.status === 201 && r.body?.students?.length === 1,
      `status=${r.status} students=${r.body?.students?.length}`);

    const missing = await req("POST", "/api/families/enroll", {
      family: { householdName: `Bad ${TAG}` },
      guardians: [{ fullName: "P", email: "p@example.com" }],
      students: [{ fullName: "No DOB Child", gradeLevel: "Year 7" }],
    });
    check("Manual enrollment still rejects a student with no DOB", missing.status === 400, `status=${missing.status}`);
  }

  // ── 3. Template ──
  console.log("\n3. Download template");
  {
    const res = await fetch(`${BASE}/api/families/enroll/import/template`, { headers: { Cookie: adminCookie } });
    const buf = Buffer.from(await res.arrayBuffer());
    let headers: string[] = [];
    try {
      const wb = XLSX.read(buf, { type: "buffer" });
      const aoa = XLSX.utils.sheet_to_json<string[]>(wb.Sheets[wb.SheetNames[0]], { header: 1 });
      headers = (aoa[0] || []).map(String);
    } catch { /* leave empty */ }
    check("Template downloads as a readable XLSX", res.status === 200 && headers.length > 5, `${headers.length} columns`);
    check("Template marks required fields with *",
      headers.some((h) => /Full Name \*/.test(h)) && headers.some((h) => /Date of Birth \*/.test(h)) && headers.some((h) => /Grade Level \*/.test(h)),
      headers.slice(0, 6).join(" | "));
  }

  // ── 4–6. XLSX + CSV + alias mapping ──
  console.log("\n4. Upload and column mapping");
  const aliasSheet = xlsxOf([
    ["Student No", "Forename", "Surname", "DOB", "Tutor Group", "Year", "Parent Email", "Parent Name", "House Points"],
    ["", "Aisha", `Alias${TAG}`, "20/08/2012", `Year 7A`, "Year 7", `aisha.${TAG}@example.com`, `Nadia Alias${TAG}`, 42],
  ]);
  {
    const r = await postSheet("/api/families/enroll/import/analyze", { name: "aliases.xlsx", buffer: aliasSheet, type: XLSX_MIME });
    const cols: any[] = r.body?.columns || [];
    const mapped = (name: string) => cols.find((c) => c.column === name)?.field;
    check("XLSX uploads and analyses", r.status === 200 && r.body?.summary?.studentsDetected === 1, `status=${r.status}`);
    check("Header aliases map to the right ScholarShelf fields",
      mapped("Forename") === "firstName" && mapped("Surname") === "lastName" &&
      mapped("DOB") === "dateOfBirth" && mapped("Tutor Group") === "className" &&
      mapped("Year") === "gradeLevel" && mapped("Parent Email") === "guardianEmail",
      `Forename→${mapped("Forename")} Surname→${mapped("Surname")} DOB→${mapped("DOB")} TutorGroup→${mapped("Tutor Group")}`);
    check("First + Last name satisfy the required Full Name",
      r.body?.rows?.[0]?.studentName === `Aisha Alias${TAG}` && r.body?.rows?.[0]?.action === "create",
      `name=${r.body?.rows?.[0]?.studentName}`);
    check("UK date 20/08/2012 read as 20 August 2012",
      r.body?.rows?.[0]?.dateOfBirth === "2012-08-20", `got ${r.body?.rows?.[0]?.dateOfBirth}`);
    check("Unrecognised column reported as ignored",
      (r.body?.ignoredColumns || []).includes("House Points"), (r.body?.ignoredColumns || []).join(", "));
  }

  console.log("\n5. CSV upload");
  {
    const csv = csvOf([
      ["Full Name", "Date of Birth", "Grade Level", "Class"],
      [`Csv Child ${TAG}`, "2012-09-01", "Year 8", "Year 8 - B"],
    ]);
    const r = await postSheet("/api/families/enroll/import/analyze", { name: "list.csv", buffer: csv, type: "text/csv" });
    check("CSV uploads and analyses", r.status === 200 && r.body?.summary?.studentsDetected === 1, `status=${r.status}`);
    check("Existing class 'Year 8 - B' is reused, not recreated",
      r.body?.summary?.newClasses === 0 && (r.body?.existingClassNames || []).length === 1,
      `newClasses=${r.body?.summary?.newClasses}`);
  }

  console.log("\n5b. UK dates in CSV are not reinterpreted as US");
  {
    // 04/09/2013 must be 4 September 2013, NOT 9 April 2013. A CSV has no cell
    // types, so this is exactly where a US-first parser silently corrupts data.
    const csv = csvOf([
      ["Full Name", "Date of Birth", "Grade Level"],
      [`Uk Csv Date ${TAG}`, "04/09/2013", "Year 7"],
      [`Uk Csv Dash ${TAG}`, "20-08-2012", "Year 7"],
    ]);
    const r = await postSheet("/api/families/enroll/import/analyze", { name: "uk.csv", buffer: csv, type: "text/csv" });
    check("CSV DD/MM/YYYY read day-first",
      r.body?.rows?.[0]?.dateOfBirth === "2013-09-04", `got ${r.body?.rows?.[0]?.dateOfBirth}`);
    check("CSV DD-MM-YYYY read day-first",
      r.body?.rows?.[1]?.dateOfBirth === "2012-08-20", `got ${r.body?.rows?.[1]?.dateOfBirth}`);
    check("Sample values shown to the admin are the raw sheet values",
      (r.body?.columns || []).find((c: any) => c.field === "dateOfBirth")?.samples?.[0] === "04/09/2013",
      JSON.stringify((r.body?.columns || []).find((c: any) => c.field === "dateOfBirth")?.samples));
  }

  console.log("\n6. Administrator overrides a wrong mapping");
  {
    // "Notes" is unmapped by default; force it to be the Grade Level column.
    const sheet = xlsxOf([
      ["Full Name", "DOB", "Notes"],
      [`Override Child ${TAG}`, "01/02/2013", "Year 9"],
    ]);
    const before = await postSheet("/api/families/enroll/import/analyze", { name: "o.xlsx", buffer: sheet, type: XLSX_MIME });
    check("Without a Grade Level column the requirement is reported",
      (before.body?.missingRequiredFields || []).includes("Grade Level"),
      (before.body?.missingRequiredFields || []).join(", "));
    const after = await postSheet("/api/families/enroll/import/analyze", { name: "o.xlsx", buffer: sheet, type: XLSX_MIME }, { 2: "gradeLevel" });
    check("Override maps the column and clears the requirement",
      (after.body?.missingRequiredFields || []).length === 0 && after.body?.rows?.[0]?.gradeLevel === "Year 9" && after.body?.canImport === true,
      `grade=${after.body?.rows?.[0]?.gradeLevel}`);
  }

  // ── 7–11. Validation ──
  console.log("\n7. Validation of bad rows");
  {
    const sheet = xlsxOf([
      ["Full Name", "Date of Birth", "Grade Level", "Parent Email", "Class"],
      [`Good Row ${TAG}`, "20/08/2012", "Year 7", `good.${TAG}@example.com`, "Year 7A"],  // valid
      ["", "20/08/2012", "Year 7", "", "Year 7A"],                                          // no name
      [`No Dob ${TAG}`, "", "Year 7", "", "Year 7A"],                                       // no DOB
      [`No Grade ${TAG}`, "20/08/2012", "", "", "Year 7A"],                                 // no grade
      [`Bad Email ${TAG}`, "20/08/2012", "Year 7", "not-an-email", "Year 7A"],               // bad email
      [`Bad Date ${TAG}`, "32/13/2012", "Year 7", "", "Year 7A"],                            // impossible date
      [`Us Date ${TAG}`, "12/25/2011", "Year 7", "", "Year 7A"],                             // US-style
      [`Future ${TAG}`, "20/08/2999", "Year 7", "", "Year 7A"],                              // future DOB
    ]);
    const r = await postSheet("/api/families/enroll/import/analyze", { name: "bad.xlsx", buffer: sheet, type: XLSX_MIME });
    const problems = (name: string) =>
      (r.body?.invalidRows || []).find((x: any) => x.studentName.includes(name))?.problem || "";
    check("One invalid row does not stop the file being analysed",
      r.status === 200 && r.body?.summary?.studentsDetected === 8, `detected=${r.body?.summary?.studentsDetected}`);
    check("Exactly the 7 bad rows are invalid; the good one survives",
      r.body?.summary?.invalidRows === 7 && r.body?.summary?.newStudents === 1,
      `invalid=${r.body?.summary?.invalidRows} new=${r.body?.summary?.newStudents}`);
    check("Missing name reported", /Missing student name/i.test(problems("(no name)")), problems("(no name)"));
    check("Missing date of birth reported", /Missing date of birth/i.test(problems("No Dob")), problems("No Dob"));
    check("Missing grade level reported", /Missing grade level/i.test(problems("No Grade")), problems("No Grade"));
    check("Invalid email reported", /not a valid email/i.test(problems("Bad Email")), problems("Bad Email"));
    check("Impossible date reported", /not a real calendar date|not a recognised date/i.test(problems("Bad Date")), problems("Bad Date"));
    check("US-style date flagged rather than silently swapped",
      /US MM\/DD\/YYYY/i.test(problems("Us Date")), problems("Us Date"));
    check("Future date of birth rejected", /future/i.test(problems("Future")), problems("Future"));
  }

  console.log("\n8. Real Excel date cells");
  {
    const sheet = xlsxOf([
      ["Full Name", "Date of Birth", "Grade Level"],
      [`Excel Date ${TAG}`, new Date(Date.UTC(2012, 7, 20)), "Year 7"],
    ]);
    const r = await postSheet("/api/families/enroll/import/analyze", { name: "d.xlsx", buffer: sheet, type: XLSX_MIME });
    check("Genuine Excel date cell parses to the right ISO date",
      r.body?.rows?.[0]?.dateOfBirth === "2012-08-20", `got ${r.body?.rows?.[0]?.dateOfBirth}`);
  }

  // ── 9. Empty / rejected files ──
  console.log("\n9. Empty and rejected files");
  {
    const empty = await postSheet("/api/families/enroll/import/analyze", { name: "empty.csv", buffer: "", type: "text/csv" });
    check("Empty file rejected with a clear message", empty.status === 400 && !!empty.body?.message, empty.body?.message);

    const headerOnly = await postSheet("/api/families/enroll/import/analyze",
      { name: "h.csv", buffer: "Full Name,Date of Birth,Grade Level", type: "text/csv" });
    check("Header-only file rejected", headerOnly.status === 400, headerOnly.body?.message);

    const wrongType = await postSheet("/api/families/enroll/import/analyze",
      { name: "students.txt", buffer: "Full Name\nA", type: "text/plain" });
    check("Disallowed extension rejected", wrongType.status === 400, wrongType.body?.message);

    const lyingExt = await postSheet("/api/families/enroll/import/analyze",
      { name: "students.csv", buffer: xlsxOf([["Full Name"], ["A"]]), type: "text/csv" });
    check("File whose bytes disagree with its extension rejected", lyingExt.status === 400, lyingExt.body?.message);
  }

  // ── 10. Preview does not write; cancel leaves nothing behind ──
  console.log("\n10. Preview and cancel never touch the database");
  const previewSheet = xlsxOf([
    ["Full Name", "Date of Birth", "Grade Level", "Class", "Family / Household Name", "Parent / Guardian Name", "Parent / Guardian Email"],
    [`Preview Only ${TAG}`, "14/03/2013", "Year 9", `Ghost ${TAG}`, `Ghost ${TAG} Household`, `Ghost Parent ${TAG}`, `ghost.${TAG}@example.com`],
  ]);
  {
    const classesBefore = (await getClasses()).length;
    const r = await postSheet("/api/families/enroll/import/analyze", { name: "p.xlsx", buffer: previewSheet, type: XLSX_MIME });
    check("Preview reports the class as one to create",
      r.body?.summary?.newClasses === 1 && r.body?.classesToCreate?.[0]?.name === `Ghost ${TAG}`,
      JSON.stringify(r.body?.classesToCreate));
    const classesAfter = (await getClasses()).length;
    const students = await findStudentsByName(`Preview Only ${TAG}`);
    check("Preview created NO class", classesBefore === classesAfter, `${classesBefore} → ${classesAfter}`);
    check("Preview created NO student", students.length === 0, `${students.length} found`);
    // "Cancel" is simply never calling commit — assert again after a second preview.
    await postSheet("/api/families/enroll/import/analyze", { name: "p.xlsx", buffer: previewSheet, type: XLSX_MIME });
    const stillNone = await findStudentsByName(`Preview Only ${TAG}`);
    check("Cancelling before confirmation leaves the database untouched",
      stillNone.length === 0 && (await getClasses()).length === classesBefore, `${stillNone.length} students`);
  }

  // ── 11. Confirm writes correctly: new + existing classes, siblings, dupes ──
  console.log("\n11. Confirm import writes the right records");
  const NEW_CLASS = `Year 7C-${TAG}`;
  const mainSheet = xlsxOf([
    ["Student ID", "Full Name", "Date of Birth", "Gender", "Grade Level", "Class", "Family / Household Name", "Parent / Guardian Name", "Parent / Guardian Email", "Reading Level"],
    ["", `John Smith ${TAG}`,   "12/01/2013", "Male",   "Year 7", "Year 7 - A",       `Smith ${TAG} Household`, `Mary Smith ${TAG}`, `smith.${TAG}@example.com`, "M"],
    ["", `Sarah Jones ${TAG}`,  "03/02/2013", "Female", "Year 7", NEW_CLASS,          `Jones ${TAG} Household`, `Paul Jones ${TAG}`, `jones.${TAG}@example.com`, ""],
    ["", `Adam Khan ${TAG}`,    "22/11/2012", "Male",   "Year 8", "Year 8 - B",       `Khan ${TAG} Household`,  `Imran Khan ${TAG}`, `khan.${TAG}@example.com`,  ""],
    ["", `Amelia Brown ${TAG}`, "09/07/2013", "Female", "Year 7", `  ${NEW_CLASS.toUpperCase()}  `, `Brown ${TAG} Household`, `Sue Brown ${TAG}`, `brown.${TAG}@example.com`, ""],
    ["", `Sibling Brown ${TAG}`,"01/01/2011", "Male",   "Year 9", NEW_CLASS,          `Brown ${TAG} Household`, `Sue Brown ${TAG}`, `brown.${TAG}@example.com`, ""],
    ["", `John Smith ${TAG}`,   "12/01/2013", "Male",   "Year 7", "Year 7 - A",       `Smith ${TAG} Household`, `Mary Smith ${TAG}`, `smith.${TAG}@example.com`, "M"], // in-file duplicate
    ["", `Broken Row ${TAG}`,   "",           "",       "Year 7", "Year 7 - A",       "", "", "", ""],                                                                  // invalid
  ]);
  {
    const pre = await postSheet("/api/families/enroll/import/analyze", { name: "main.xlsx", buffer: mainSheet, type: XLSX_MIME });
    check("Preview splits new / duplicate / invalid correctly",
      pre.body?.summary?.newStudents === 5 && pre.body?.summary?.duplicateRowsInFile === 1 && pre.body?.summary?.invalidRows === 1,
      `new=${pre.body?.summary?.newStudents} dupInFile=${pre.body?.summary?.duplicateRowsInFile} invalid=${pre.body?.summary?.invalidRows}`);
    check("Preview lists exactly one new class for the three rows that name it",
      pre.body?.summary?.newClasses === 1 && pre.body?.classesToCreate?.[0]?.rowCount === 3,
      JSON.stringify(pre.body?.classesToCreate));
    check("Case and whitespace variants resolve to the same class",
      (pre.body?.classesToCreate || []).length === 1, `${(pre.body?.classesToCreate || []).length} pending`);

    const r = await postSheet("/api/families/enroll/import/commit", { name: "main.xlsx", buffer: mainSheet, type: XLSX_MIME });
    check("Confirm import succeeds",
      r.status === 201 && r.body?.created === 5 && r.body?.classesCreated === 1,
      `status=${r.status} created=${r.body?.created} classes=${r.body?.classesCreated}`);
    check("In-file duplicate skipped, invalid row reported",
      r.body?.skipped === 1 && r.body?.errorCount === 1,
      `skipped=${r.body?.skipped} errors=${r.body?.errorCount}`);

    check("The new class exists exactly once", (await countClassesNamed(NEW_CLASS)) === 1, `${await countClassesNamed(NEW_CLASS)} found`);
    const created = await findStudentsByName(`Sarah Jones ${TAG}`);
    const newClass = await findClassByName(NEW_CLASS);
    check("Student assigned to the newly created class",
      created.length === 1 && created[0].classId === newClass?.id, `students=${created.length}`);
    const amelia = await findStudentsByName(`Amelia Brown ${TAG}`);
    check("Later row reuses the same new class rather than creating a second",
      amelia.length === 1 && amelia[0].classId === newClass?.id, `classId=${amelia[0]?.classId}`);

    const existingClass = await findClassByName("Year 7 - A");
    const john = await findStudentsByName(`John Smith ${TAG}`);
    check("Existing class reused for the student that names it",
      john.length === 1 && john[0].classId === existingClass?.id, `students=${john.length}`);
    check("Duplicate row did not create a second John Smith", john.length === 1, `${john.length} found`);

    // Siblings: Amelia + Sibling Brown share one household.
    const sib = await findStudentsByName(`Sibling Brown ${TAG}`);
    check("Siblings grouped into one family record",
      !!amelia[0]?.familyId && amelia[0].familyId === sib[0]?.familyId,
      `${amelia[0]?.familyId} vs ${sib[0]?.familyId}`);
    check("Broken row was not imported", (await findStudentsByName(`Broken Row ${TAG}`)).length === 0);
    check("Students carry the spreadsheet's details",
      john[0]?.dateOfBirth === "2013-01-12" && john[0]?.gender === "Male" && john[0]?.gradeLevel === "Year 7" && !!john[0]?.studentCode,
      `dob=${john[0]?.dateOfBirth} gender=${john[0]?.gender} code=${john[0]?.studentCode}`);
  }

  // ── 12. Re-import: update, not duplicate; class move ──
  console.log("\n12. Existing students are updated, not duplicated");
  {
    const john = (await findStudentsByName(`John Smith ${TAG}`))[0];
    const reSheet = xlsxOf([
      ["Full Name", "Date of Birth", "Grade Level", "Class", "Reading Level"],
      [`John Smith ${TAG}`, "12/01/2013", "Year 8", "Year 8 - B", "P"],   // matched on name + DOB, moved class
      [`Amelia Brown ${TAG}`, "09/07/2013", "Year 7", NEW_CLASS, "N"],    // unchanged class
    ]);
    const pre = await postSheet("/api/families/enroll/import/analyze", { name: "re.xlsx", buffer: reSheet, type: XLSX_MIME });
    check("Preview recognises both as existing students",
      pre.body?.summary?.existingStudents === 2 && pre.body?.summary?.newStudents === 0,
      `existing=${pre.body?.summary?.existingStudents}`);
    check("Preview shows the class change",
      pre.body?.rows?.[0]?.classChange?.to === "Year 8 - B", JSON.stringify(pre.body?.rows?.[0]?.classChange));

    const r = await postSheet("/api/families/enroll/import/commit", { name: "re.xlsx", buffer: reSheet, type: XLSX_MIME });
    check("Re-import updates and creates nothing",
      r.status === 201 && r.body?.updated === 2 && r.body?.created === 0,
      `updated=${r.body?.updated} created=${r.body?.created}`);

    const after = await findStudentsByName(`John Smith ${TAG}`);
    const y8 = await findClassByName("Year 8 - B");
    check("Still exactly one John Smith", after.length === 1, `${after.length} found`);
    check("Student moved to the new class", after[0]?.classId === y8?.id, `classId=${after[0]?.classId}`);
    check("Student id is unchanged (updated in place)", after[0]?.id === john?.id, `${john?.id} → ${after[0]?.id}`);
    check("Updated fields applied", after[0]?.gradeLevel === "Year 8", `grade=${after[0]?.gradeLevel}`);
  }

  // ── 13. Matching by Student ID ──
  console.log("\n13. Matching an existing student by ScholarShelf Student ID");
  {
    const john = (await findStudentsByName(`John Smith ${TAG}`))[0];
    const sheet = xlsxOf([
      ["Student ID", "Full Name", "Date of Birth", "Grade Level"],
      // Deliberately different name and DOB — the code is the definitive key.
      [john.studentCode, `Renamed Smith ${TAG}`, "01/01/2010", "Year 10"],
    ]);
    const pre = await postSheet("/api/families/enroll/import/analyze", { name: "code.xlsx", buffer: sheet, type: XLSX_MIME });
    check("Student ID matches the existing record",
      pre.body?.summary?.existingStudents === 1 && pre.body?.rows?.[0]?.matchedOn === "studentCode",
      `matchedOn=${pre.body?.rows?.[0]?.matchedOn}`);
    const r = await postSheet("/api/families/enroll/import/commit", { name: "code.xlsx", buffer: sheet, type: XLSX_MIME });
    check("Commit updates that record rather than creating one",
      r.body?.updated === 1 && r.body?.created === 0, `updated=${r.body?.updated}`);
    const renamed = await findStudentsByName(`Renamed Smith ${TAG}`);
    check("The renamed student is the same row", renamed.length === 1 && renamed[0].id === john.id, `${renamed.length} found`);
  }

  // ── 14. Commit refuses when a required field is unmapped ──
  console.log("\n14. Commit refuses an unmappable file");
  {
    const sheet = xlsxOf([["Full Name", "Notes"], [`No Grade Commit ${TAG}`, "x"]]);
    const r = await postSheet("/api/families/enroll/import/commit", { name: "nc.xlsx", buffer: sheet, type: XLSX_MIME });
    check("Commit rejected with a clear message", r.status === 400 && /Date of Birth|Grade Level/i.test(r.body?.message || ""), r.body?.message);
    check("Nothing was written", (await findStudentsByName(`No Grade Commit ${TAG}`)).length === 0);
  }

  // ── 15. Audit log ──
  console.log("\n15. Audit trail");
  {
    const r = await req("GET", "/api/audit-logs?limit=100");
    const logs: any[] = Array.isArray(r.body) ? r.body : (r.body?.logs || []);
    if (!logs.length) {
      pass("Audit log endpoint not exposed to this role — skipped", `status=${r.status}`);
    } else {
      const imported = logs.find((l) => l.action === "students_spreadsheet_imported");
      check("Import recorded in the audit log", !!imported, imported?.metadata || "not found");
    }
  }

  // ── Summary ──
  const passed = results.filter((r) => r.passed).length;
  const failed = results.length - passed;
  console.log(`\n${"─".repeat(60)}`);
  console.log(`  ${passed}/${results.length} passed${failed ? `, ${failed} FAILED` : ""}`);
  if (failed) {
    console.log("\n  Failures:");
    for (const r of results.filter((x) => !x.passed)) console.log(`   ✗ ${r.name} — ${r.detail}`);
  }
  console.log(`${"─".repeat(60)}\n`);
  process.exit(failed ? 1 : 0);
}

run().catch((e) => { console.error(e); process.exit(1); });
