/**
 * tests/teacher-distribution.ts — H2: subject-assigned teachers must see their
 * distribution list.
 *
 * WHY THIS EXISTS
 *
 * There are two ways to make someone a class's teacher:
 *
 *   legacy   classes.teacher_id — one teacher per class
 *   current  class_teacher_assignments — several teachers per class, by subject.
 *            Full CRUD, its own UI, and the way a school with subject teachers
 *            is expected to be set up.
 *
 * Different code paths consulted different ones. /api/classes and /api/students
 * read both; /api/allocations, every custody guard, and getDistributionsByTeacher
 * read only classes.teacher_id — and that last one early-returned [] when it
 * found nothing.
 *
 * So a teacher assigned the CURRENT way signed in, was given a teacher
 * dashboard, saw their classes on it, and then found an empty distribution list
 * on the day the books were meant to be handed out. No error, client or server.
 * Assigning teachers the documented way silently broke the last stage of the
 * term.
 *
 * This suite sets up exactly that teacher — assigned ONLY through
 * class_teacher_assignments, with classes.teacher_id left null — and asserts
 * they can see and act on their pupils' allocations.
 *
 * Needs DATABASE_URL and a running server. Self-cleaning.
 *   npm run test:teacher
 */
import "dotenv/config";
import { Pool } from "pg";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { buildSslConfig } from "../server/config/database.js";
import { storage } from "../server/storage.js";

const BASE = process.env.APP_BASE_URL || "http://localhost:5000";
const TAG = Math.random().toString(36).slice(2, 8);

const results: { name: string; passed: boolean; detail: string }[] = [];
const ok = (n: string, d = "") => { results.push({ name: n, passed: true, detail: d }); console.log(`  ✓ ${n}${d ? " — " + d : ""}`); };
const no = (n: string, d: string) => { results.push({ name: n, passed: false, detail: d }); console.log(`  ✗ ${n} — ${d}`); };
const expect = (c: boolean, n: string, d = "") => c ? ok(n, d) : no(n, d || "assertion failed");

async function signIn(username: string, password: string, schoolCode?: string): Promise<string | null> {
  const res = await fetch(`${BASE}/api/auth/sign-in`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password, ...(schoolCode ? { schoolCode } : {}) }),
    redirect: "manual",
  });
  if (res.status !== 200) return null;
  return (res.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ") || null;
}

async function get(path: string, cookie: string) {
  const res = await fetch(`${BASE}${path}`, { headers: { Cookie: cookie } });
  let body: any = null;
  try { body = await res.json(); } catch { /* empty body is fine */ }
  return { status: res.status, body };
}

async function run() {
  console.log("═══════════════════════════════════════════════");
  console.log("  H2 — subject-assigned teacher distribution");
  console.log(`  TAG: ${TAG}`);
  console.log("═══════════════════════════════════════════════\n");

  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: buildSslConfig() });

  const schools = await storage.getSchools();
  const demo = schools.find((s: any) => s.code === "DEMO-001") || schools[0];
  if (!demo) { console.error("No school seeded. Run: curl -X POST /api/seed-users"); process.exit(2); }
  const schoolId = demo.id;

  const classId = randomUUID();
  const studentId = randomUUID();
  const bookId = randomUUID();
  const allocationId = randomUUID();
  const teacherId = randomUUID();
  const username = `subjectteacher${TAG}`;
  const password = "teacher-h2-test-2026";

  try {
    // A class with NO legacy teacher. Under the old lookup this class is
    // invisible to everyone, which is the point.
    await pool.query(
      `INSERT INTO classes (id, name, year_group, academic_year, school_id, teacher_id)
       VALUES ($1,$2,$3,$4,$5,NULL)`,
      [classId, `Subject Class ${TAG}`, "Year 6", "2026/2027", schoolId]);

    await pool.query(
      `INSERT INTO students (id, name, student_code, class_id, school_id, status)
       VALUES ($1,$2,$3,$4,$5,'active')`,
      [studentId, `H2 Pupil ${TAG}`, `STU-H${TAG.slice(0, 4)}`, classId, schoolId]);

    await pool.query(
      `INSERT INTO books (id, title, author, isbn, price, stock_quantity, school_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [bookId, `H2 Reader ${TAG}`, "Tester", `H2-${TAG}`, "7.50", 30, schoolId]);

    await pool.query(
      `INSERT INTO finance_book_allocations
         (id, student_id, book_id, status, distribution_status, custody_status, school_id,
          academic_year, class_id_at_allocation, class_name_at_allocation)
       VALUES ($1,$2,$3,'allocated','pending_distribution','reserved',$4,$5,$6,$7)`,
      [allocationId, studentId, bookId, schoolId, "2026/2027", classId, `Subject Class ${TAG}`]);

    await pool.query(
      `INSERT INTO users (id, username, password_hash, name, role, email, status, school_id)
       VALUES ($1,$2,$3,$4,'teacher',$5,'active',$6)`,
      [teacherId, username, await bcrypt.hash(password, 10),
       `Subject Teacher ${TAG}`, `${username}@test.local`, schoolId]);

    // Assigned ONLY the current way.
    await pool.query(
      `INSERT INTO class_teacher_assignments (id, class_id, teacher_id, school_id, is_active)
       VALUES ($1,$2,$3,$4,true)`,
      [randomUUID(), classId, teacherId, schoolId]);

    console.log("─── Fixture: teacher assigned by subject only (classes.teacher_id IS NULL) ───\n");

    const cookie = await signIn(username, password, demo.code);
    if (!cookie) { no("Subject teacher can sign in", "sign-in failed"); throw new Error("cannot continue"); }
    ok("Subject teacher can sign in");

    // The half that always worked — included so a failure here is distinguishable
    // from the half that did not.
    const classes = await get("/api/classes", cookie);
    const seesClass = Array.isArray(classes.body) && classes.body.some((c: any) => c.id === classId);
    expect(seesClass, "Teacher sees their class on the dashboard",
      seesClass ? "" : `GET /api/classes returned ${classes.status}, class not present`);

    // The half that did not. This is H2.
    const dist = await get("/api/teacher/book-distribution", cookie);
    const rows = Array.isArray(dist.body) ? dist.body : dist.body?.rows ?? dist.body?.data ?? [];
    const seesAllocation = Array.isArray(rows) && rows.some((r: any) => r.id === allocationId);
    expect(seesAllocation,
      "Teacher sees their pupils' allocations in the distribution list",
      seesAllocation ? `${rows.length} row(s)` :
        `GET /api/teacher/book-distribution returned ${dist.status} with ${Array.isArray(rows) ? rows.length : "?"} row(s) — the allocation is missing`);

    // Seeing it is not enough: the custody guards read the same lookup, so a
    // teacher who can see a row but cannot act on it is still blocked.
    const act = await fetch(`${BASE}/api/teacher/book-distribution/${allocationId}/confirm-received`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({}),
    });
    expect(act.status >= 200 && act.status < 300,
      "Teacher can mark one of their pupils' books received",
      `POST confirm-received returned ${act.status}`);

    const after = await pool.query(
      `SELECT distribution_status FROM finance_book_allocations WHERE id = $1`, [allocationId]);
    expect(after.rows[0]?.distribution_status === "received_by_student",
      "Allocation moved to received_by_student",
      `status=${after.rows[0]?.distribution_status}`);
  } catch (e: any) {
    if (e?.message !== "cannot continue") no("Unexpected throw", e?.message || String(e));
  } finally {
    await pool.query(`DELETE FROM class_teacher_assignments WHERE class_id = $1`, [classId]).catch(() => {});
    await pool.query(`DELETE FROM finance_book_allocations WHERE id = $1`, [allocationId]).catch(() => {});
    await pool.query(`DELETE FROM book_inventory_transactions WHERE book_id = $1`, [bookId]).catch(() => {});
    await pool.query(`DELETE FROM books WHERE id = $1`, [bookId]).catch(() => {});
    await pool.query(`DELETE FROM students WHERE id = $1`, [studentId]).catch(() => {});
    await pool.query(`DELETE FROM users WHERE id = $1`, [teacherId]).catch(() => {});
    await pool.query(`DELETE FROM classes WHERE id = $1`, [classId]).catch(() => {});
    await pool.end();
  }

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed);
  console.log("\n═══════════════════════════════════════════════");
  console.log(`  Results: ${passed}/${results.length} passed`);
  if (failed.length) { console.log("\n  Failures:"); failed.forEach((r) => console.log(`    ✗ ${r.name} — ${r.detail}`)); }
  console.log("═══════════════════════════════════════════════\n");
  process.exit(failed.length > 0 ? 1 : 0);
}

run().catch((err) => { console.error("Unexpected error:", err); process.exit(1); });
