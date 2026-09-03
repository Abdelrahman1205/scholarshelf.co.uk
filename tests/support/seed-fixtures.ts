/**
 * tests/support/seed-fixtures.ts
 *
 * TEST FIXTURES — NOT PART OF THE APPLICATION.
 *
 * Creates the school, users, classes, books, students, allocations and
 * extra-copy requests that the scripts in tests/ sign in against. This used to
 * be a POST /api/seed-users route on the server; it was moved here so that no
 * fixture data is reachable from the running application.
 *
 *   npm run test:fixtures
 *
 * It refuses to run against production. Point DATABASE_URL at a scratch
 * database — never at a database holding a real school's records.
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { storage } from "../../server/storage.js";

if (process.env.NODE_ENV === "production") {
  console.error("Refusing to load test fixtures against a production environment.");
  process.exit(1);
}

async function main() {

  // ── 1. Fixture school ──────────────────────────────────────
  let fixtureSchool = (await storage.getSchools()).find((s) => s.code === "TEST-001");
  if (!fixtureSchool) {
    fixtureSchool = await storage.createSchool({
      name: "Fixture School",
      code: "TEST-001",
      status: "active",
      setupStatus: "complete",
      contactEmail: "admin@fixture.invalid",
      contactPhone: "+00-000-000-0000",
      address: "Fixture address",
      notes: "Automated-test fixture school. Not a real tenant.",
    });
  }
  const schoolId = fixtureSchool.id;

  // ── 2. Fixture users ───────────────────────────────────────
  const defaults = [
    { username: "bythub", password: "bythub123", name: "Fixture Platform Owner", role: "owner", email: "owner@fixture.invalid", status: "active" as const, schoolId: null as string | null },
    { username: "admin", password: "admin123", name: "School Administrator", role: "school_admin", email: "admin@fixture.invalid", status: "active" as const, schoolId },
    { username: "teacher", password: "teacher123", name: "Fixture Teacher One", role: "teacher", email: "teacher@fixture.invalid", status: "active" as const, schoolId },
    { username: "teacher2", password: "teacher123", name: "Fixture Teacher Two", role: "teacher", email: "ali.hassan@fixture.invalid", status: "active" as const, schoolId },
    { username: "parent", password: "parent123", name: "Fixture Parent", role: "parent", email: "parent@fixture.invalid", status: "active" as const, schoolId },
    { username: "it_admin", password: "it123", name: "IT Support", role: "it_personnel", email: "it@fixture.invalid", status: "active" as const, schoolId },
    { username: "finance", password: "finance123", name: "Fixture Finance Officer", role: "finance", email: "finance@fixture.invalid", status: "active" as const, schoolId },
  ];
  const created: Array<{ username: string; role: string }> = [];
  for (const d of defaults) {
    const existing = await storage.getUserByUsername(d.username);
    if (!existing) {
      const hash = await bcrypt.hash(d.password, 10);
      const user = await storage.createUser({ username: d.username, passwordHash: hash, name: d.name, role: d.role, email: d.email, status: d.status, schoolId: d.schoolId });
      created.push({ username: user.username, role: user.role });
    }
  }

  // ── 3. Look up users for linking ───────────────────────────
  const allUsers = await storage.getUsers();
  const teacherUser = allUsers.find((u) => u.role === "teacher" && u.schoolId === schoolId);

  // ── 4. Create classes (scoped to school) ───────────────────
  let existingClasses = await storage.getClasses(schoolId);
  let classItem = existingClasses[0];
  if (!classItem && teacherUser) {
    classItem = await storage.createClass({
      name: "Year 7 - A",
      academicYear: "2025/2026",
      teacherId: teacherUser.id,
      schoolId,
    });
    // Create a second class for teacher2
    const teacher2 = allUsers.find((u) => u.username === "teacher2");
    if (teacher2) {
      await storage.createClass({
        name: "Year 8 - B",
        academicYear: "2025/2026",
        teacherId: teacher2.id,
        schoolId,
      });
    }
  }

  // ── 5. Create books (scoped to school) ─────────────────────
  let books = await storage.getBooks(schoolId);
  if (books.length === 0) {
    const bookData = [
      { title: "Mathematics Essentials", author: "School Board", isbn: "9780000000001", price: "12.50", description: "Core maths textbook for Year 7-8", isActive: true, stockQuantity: 100, lowStockThreshold: 10, reorderQuantity: 50, schoolId },
      { title: "Science Fundamentals", author: "School Board", isbn: "9780000000002", price: "14.00", description: "Core science textbook", isActive: true, stockQuantity: 80, lowStockThreshold: 10, reorderQuantity: 50, schoolId },
      { title: "English Language Arts", author: "National Curriculum", isbn: "9780000000003", price: "11.00", description: "English language and comprehension", isActive: true, stockQuantity: 90, lowStockThreshold: 10, reorderQuantity: 50, schoolId },
      { title: "Arabic Language", author: "Ministry of Education", isbn: "9780000000004", price: "10.00", description: "Arabic reading and writing", isActive: true, stockQuantity: 120, lowStockThreshold: 15, reorderQuantity: 60, schoolId },
      { title: "Islamic Studies", author: "Ministry of Education", isbn: "9780000000005", price: "8.50", description: "Religious education", isActive: true, stockQuantity: 5, lowStockThreshold: 10, reorderQuantity: 40, schoolId },
    ];
    for (const b of bookData) {
      await storage.createBook(b);
    }
    books = await storage.getBooks(schoolId);
  }

  // ── 6. Create students (scoped to school) ──────────────────
  let students = await storage.getStudents(schoolId);
  if (students.length === 0 && classItem) {
    const studentNames = ["Fixture Pupil 1", "Fixture Pupil 2", "Fixture Pupil 3", "Fixture Pupil 4", "Fixture Pupil 5"];
    for (const name of studentNames) {
      await storage.createStudent({ name, classId: classItem.id, schoolId });
    }
    students = await storage.getStudents(schoolId);
  }

  // ── 7. Create allocations (one marked absent) ──────────────
  const allocations = await storage.getAllocations(classItem?.id, schoolId);
  const hasAbsent = allocations.some((a: any) => a.status === "absent");
  if (!hasAbsent && students.length > 0 && books.length > 0) {
    const createdAllocation = await storage.createAllocation({
      studentId: students[0].id,
      bookId: books[0].id,
      basketId: null,
      status: "allocated",
      schoolId,
    });
    await storage.markAllocationAbsent(createdAllocation.id);
  }

  // ── 8. Create extra copy requests ──────────────────────────
  const teacherRequests = teacherUser
    ? await storage.getExtraCopyRequests({ teacherId: teacherUser.id, schoolId })
    : [];
  const hasPendingRequest = teacherRequests.some((r: any) => r.status === "pending");
  const hasResolvedRequest = teacherRequests.some((r: any) => r.status !== "pending");

  if (teacherUser && classItem && books.length > 0) {
    if (!hasPendingRequest) {
      await storage.createExtraCopyRequest({
        teacherId: teacherUser.id,
        classId: classItem.id,
        bookId: books[0].id,
        quantity: 2,
        reason: "NEW_STUDENT",
        notes: "Two new students enrolled mid-term",
        status: "pending",
        schoolId,
      });
    }

    if (!hasResolvedRequest) {
      const resolved = await storage.createExtraCopyRequest({
        teacherId: teacherUser.id,
        classId: classItem.id,
        bookId: books[0].id,
        quantity: 1,
        reason: "DAMAGED_IN_CLASS",
        notes: "Book damaged during lab session",
        status: "pending",
        schoolId,
      });
      await storage.approveExtraCopyRequest(resolved.id, "Approved — replacement copy dispatched");
    }
  }

  console.log(
    `Test fixtures loaded — school ${fixtureSchool.code}, ` +
    `${created.length} user(s) created, ${students.length} pupil(s), ${books.length} book(s).`,
  );
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  },
);
