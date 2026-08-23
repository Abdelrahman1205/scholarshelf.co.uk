/**
 * script/seed-school-b.ts
 *
 * Seeds a SECOND tenant so tests/tenant-isolation.ts can actually run.
 *
 * That suite is the only thing in the repo that can catch a cross-tenant leak,
 * and it has never run — in CI it is marked continue-on-error with the note
 * "non-blocking until a two-school seed fixture exists". This is that fixture.
 * A single-tenant database cannot prove isolation: with one school there is no
 * boundary to cross, so every probe passes vacuously.
 *
 * Creates school DEMO-002 with its own admin and one of each resource the
 * suite probes, so every check finds a real id to attempt rather than skipping.
 *
 *   npm run seed:school-b
 *
 * Refuses to run in production. Idempotent — re-running adopts what exists.
 */
import bcrypt from "bcryptjs";
import { storage } from "../server/storage.js";
import { getDb } from "../server/config/database.js";
import {
  classes, students, books, bookLevels, bookLevelItems, families, guardians,
  familyStudents, financeBookAllocations,
} from "../shared/schema.js";
import { eq, and } from "drizzle-orm";

const CODE = process.env.SCHOOL_B_CODE || "DEMO-002";
const ADMIN = process.env.SCHOOL_B_ADMIN || "admin2";
const PASSWORD = process.env.SCHOOL_B_PASSWORD || "admin123";

function bail(message: string): never {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
}

async function main() {
  if (process.env.NODE_ENV === "production") {
    bail("Refusing to seed a test tenant in production.");
  }
  if (!process.env.DATABASE_URL) {
    bail("DATABASE_URL is not set.");
  }

  const db = getDb();

  // ── School ────────────────────────────────────────────────────────────────
  let school = (await storage.getSchools()).find((s) => s.code === CODE);
  if (!school) {
    school = await storage.createSchool({
      name: "Second Tenant Test School",
      code: CODE,
      status: "active",
      setupStatus: "complete",
      contactEmail: `admin@${CODE.toLowerCase()}.test`,
      notes: "Isolation-test tenant. Exists so a cross-tenant boundary exists to test.",
    });
    console.log(`  created school ${CODE} (${school.id})`);
  } else {
    console.log(`  school ${CODE} already present (${school.id})`);
  }
  const schoolId = school.id;

  // ── Admin ─────────────────────────────────────────────────────────────────
  let admin = await storage.getUserByUsername(ADMIN);
  if (!admin) {
    admin = await storage.createUser({
      username: ADMIN,
      passwordHash: await bcrypt.hash(PASSWORD, 10),
      name: "Second School Administrator",
      role: "school_admin",
      email: `${ADMIN}@${CODE.toLowerCase()}.test`,
      status: "active",
      schoolId,
    });
    console.log(`  created admin ${ADMIN}`);
  } else if (admin.schoolId !== schoolId) {
    bail(`User "${ADMIN}" already exists but belongs to another school. Pick a different SCHOOL_B_ADMIN.`);
  }

  // ── One of each resource the isolation suite probes ───────────────────────
  // Every probe reads school B's list to find a REAL id, then requests it as
  // school A. A resource with no rows is skipped, and a skipped probe proves
  // nothing — so each of these must exist.

  const existingClass = await db.select().from(classes).where(eq(classes.schoolId, schoolId)).limit(1);
  const cls = existingClass[0] ?? (await db.insert(classes).values({
    name: "Year 4 Amber", yearGroup: "Year 4", academicYear: "2026/2027", schoolId,
  }).returning())[0];

  const existingBook = await db.select().from(books).where(eq(books.schoolId, schoolId)).limit(1);
  const book = existingBook[0] ?? (await db.insert(books).values({
    title: "Isolation Test Reader", author: "Test Author", isbn: `ISO-${Date.now()}`,
    price: "12.50", stockQuantity: 25, schoolId,
  }).returning())[0];

  const existingLevel = await db.select().from(bookLevels).where(eq(bookLevels.schoolId, schoolId)).limit(1);
  const level = existingLevel[0] ?? (await db.insert(bookLevels).values({
    name: "Year 4 Bundle", description: "Isolation-test bundle", schoolId,
  }).returning())[0];

  const levelItem = await db.select().from(bookLevelItems)
    .where(and(eq(bookLevelItems.bookLevelId, level.id), eq(bookLevelItems.bookId, book.id))).limit(1);
  if (!levelItem.length) {
    await db.insert(bookLevelItems).values({ bookLevelId: level.id, bookId: book.id, quantity: 1 });
  }

  const existingFamily = await db.select().from(families).where(eq(families.schoolId, schoolId)).limit(1);
  const family = existingFamily[0] ?? (await db.insert(families).values({
    name: "Tenant B Household", householdName: "Tenant B Household",
    familyCode: `FAM-B${Date.now().toString().slice(-5)}`,
    primaryEmail: `parent@${CODE.toLowerCase()}.test`, status: "enrolled", schoolId,
  }).returning())[0];

  const existingGuardian = await db.select().from(guardians).where(eq(guardians.familyId, family.id)).limit(1);
  if (!existingGuardian.length) {
    await db.insert(guardians).values({
      schoolId, familyId: family.id, fullName: "Tenant B Guardian",
      email: `parent@${CODE.toLowerCase()}.test`, isPrimaryContact: true,
    });
  }

  const existingStudent = await db.select().from(students).where(eq(students.schoolId, schoolId)).limit(1);
  const student = existingStudent[0] ?? (await db.insert(students).values({
    name: "Tenant B Pupil", studentCode: `STU-B${Date.now().toString().slice(-4)}`,
    classId: cls.id, familyId: family.id, dateOfBirth: "2016-09-01",
    gradeLevel: "4", status: "active", schoolId,
  }).returning())[0];

  const joined = await db.select().from(familyStudents)
    .where(eq(familyStudents.studentId, student.id)).limit(1);
  if (!joined.length) {
    await db.insert(familyStudents).values({ familyId: family.id, studentId: student.id });
  }

  const existingAlloc = await db.select().from(financeBookAllocations)
    .where(eq(financeBookAllocations.schoolId, schoolId)).limit(1);
  if (!existingAlloc.length) {
    await db.insert(financeBookAllocations).values({
      studentId: student.id, bookId: book.id, status: "allocated",
      distributionStatus: "pending_distribution", custodyStatus: "reserved",
      academicYear: "2026/2027", classIdAtAllocation: cls.id,
      classNameAtAllocation: cls.name, yearGroupAtAllocation: cls.yearGroup, schoolId,
    });
  }

  // ── The S1 fixture: a staff account with NO school ────────────────────────
  // This is the account shape the report describes — created with no bug
  // involved, because ADMIN_UI_ROLES includes owner and a platform owner outside
  // support mode creates users with schoolId null. schoolFilter turns that null
  // into "no WHERE clause", so such an account reads every tenant. The isolation
  // suite signs in as this account and asserts it is refused.
  const ORPHAN = process.env.ORPHAN_ADMIN || "orphanadmin";
  const orphan = await storage.getUserByUsername(ORPHAN);
  if (!orphan) {
    await storage.createUser({
      username: ORPHAN,
      passwordHash: await bcrypt.hash(process.env.ORPHAN_PASSWORD || PASSWORD, 10),
      name: "School-less Administrator (S1 fixture)",
      role: "school_admin",
      email: `${ORPHAN}@isolation.test`,
      status: "active",
      schoolId: null,
    });
    console.log(`  created school-less admin ${ORPHAN} (S1 fixture)`);
  }

  console.log(`
✓ Second tenant ready.

  School code   ${CODE}
  Admin         ${ADMIN} / ${PASSWORD}

  Run the isolation suite:  npm run test:tenant
`);
}

main().catch((e) => { console.error(e); process.exit(1); });
