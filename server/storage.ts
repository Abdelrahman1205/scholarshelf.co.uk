import { eq, and, lt, desc, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import * as schema from "../shared/schema.js";

// Lazy DB initialisation — safe when DATABASE_URL is absent (falls back to memory)
let _db: ReturnType<typeof drizzle> | null = null;
function getDb(): ReturnType<typeof drizzle> {
  if (!_db) {
    if (!process.env.DATABASE_URL) throw new Error("No DATABASE_URL configured");
    const sql = neon(process.env.DATABASE_URL);
    _db = drizzle(sql, { schema });
  }
  return _db;
}

// PostgreSQL supports RETURNING — no need for a separate SELECT after insert/update
async function insertAndFetchById<TTable extends { id: any }>(table: TTable, values: unknown): Promise<any> {
  const createdRows = (await getDb().insert(table as any).values(values as any).returning()) as any[];
  const [created] = createdRows;
  return created as any;
}

async function updateAndFetchFirst<TTable extends { id: any }>(table: TTable, whereClause: any, values: unknown): Promise<any> {
  const [updated] = await getDb().update(table as any).set(values as any).where(whereClause).returning();
  return updated as any;
}

function isDbUnavailableError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  const code = (error as { code?: string } | undefined)?.code;

  // No DATABASE_URL configured at all
  if (message.includes("No DATABASE_URL")) return true;

  if (code === "ECONNREFUSED" || code === "ENOTFOUND") return true;

  return (
    message.includes("ECONNREFUSED") ||
    message.includes("ENOTFOUND") ||
    message.includes("fetch failed") ||          // Neon HTTP fetch failure
    message.includes("NeonDbError") ||           // Neon driver error class
    message.includes("Connection terminated") ||
    message.includes("SASL") ||
    message.includes("password authentication") ||
    message.includes("does not exist") ||
    message.includes("SSL") ||
    message.includes("certificate")
  );
}

const memoryUsers = new Map<string, schema.User>();
const memorySchools = new Map<string, schema.School>();
const memoryInvites = new Map<string, schema.Invite>();
const memoryAuditLogs: schema.AuditLog[] = [];

function now() {
  return new Date();
}

function ensureDemoUsersInMemory() {
  if (memoryUsers.size > 0) return;

  // Create a stable demo school ID for memory-mode tenant scoping
  const demoSchoolId = "demo-school-00000001";
  if (!memorySchools.has(demoSchoolId)) {
    memorySchools.set(demoSchoolId, {
      id: demoSchoolId,
      name: "Al-Noor International School",
      code: "DEMO-001",
      status: "active",
      setupStatus: "active",
      contactEmail: "admin@alnoor.edu.ly",
      contactPhone: "+218-21-555-0100",
      address: "Tripoli, Libya",
      notes: "Demo school (memory mode)",
      createdAt: now(),
      updatedAt: now(),
    });
  }

  const demoUsers: Array<schema.User> = [
    {
      id: randomUUID(),
      username: "bythub",
      passwordHash: bcrypt.hashSync("bythub123", 10),
      name: "BytHub Platform Owner",
      role: "owner",
      email: "owner@bythub.co",
      status: "active",
      schoolId: null,
      emailVerifiedAt: null,
      createdAt: now(),
      updatedAt: now(),
      lastLoginAt: null,
    },
    {
      id: randomUUID(),
      username: "admin",
      passwordHash: bcrypt.hashSync("admin123", 10),
      name: "School Administrator",
      role: "school_admin",
      email: "admin@alnoor.edu.ly",
      status: "active",
      schoolId: demoSchoolId,
      emailVerifiedAt: null,
      createdAt: now(),
      updatedAt: now(),
      lastLoginAt: null,
    },
    {
      id: randomUUID(),
      username: "teacher",
      passwordHash: bcrypt.hashSync("teacher123", 10),
      name: "Ms. Fatima Johnson",
      role: "teacher",
      email: "teacher@alnoor.edu.ly",
      status: "active",
      schoolId: demoSchoolId,
      emailVerifiedAt: null,
      createdAt: now(),
      updatedAt: now(),
      lastLoginAt: null,
    },
    {
      id: randomUUID(),
      username: "parent",
      passwordHash: bcrypt.hashSync("parent123", 10),
      name: "Ahmed Al-Mansouri",
      role: "parent",
      email: "parent@example.com",
      status: "active",
      schoolId: demoSchoolId,
      emailVerifiedAt: null,
      createdAt: now(),
      updatedAt: now(),
      lastLoginAt: null,
    },
  ];

  for (const user of demoUsers) {
    memoryUsers.set(user.id, user);
  }
}

// Helper: build a school-scoped WHERE condition
function schoolFilter<T extends { schoolId: any }>(table: T, schoolId?: string | null) {
  if (typeof schoolId === "string") {
    return eq(table.schoolId, schoolId);
  }
  return undefined; // no filter for owner/demo (null schoolId)
}

export interface IStorage {
  // Schools (owner-managed tenants)
  getSchools(): Promise<schema.School[]>;
  getSchoolById(id: string): Promise<schema.School | undefined>;
  createSchool(school: schema.InsertSchool): Promise<schema.School>;
  updateSchool(id: string, school: Partial<schema.InsertSchool>): Promise<schema.School | undefined>;
  deleteSchool(id: string): Promise<void>;
  deleteSchoolAndRelatedData(id: string): Promise<void>;

  // Books
  getBooks(schoolId?: string | null): Promise<schema.Book[]>;
  getBook(id: string, schoolId?: string | null): Promise<schema.Book | undefined>;
  getBookByIsbn(isbn: string, schoolId?: string | null): Promise<schema.Book | undefined>;
  createBook(book: schema.InsertBook): Promise<schema.Book>;
  updateBook(id: string, book: Partial<schema.InsertBook>, schoolId?: string | null): Promise<schema.Book | undefined>;
  deleteBook(id: string, schoolId?: string | null): Promise<void>;
  getLowStockBooks(schoolId?: string | null): Promise<schema.Book[]>;
  adjustStock(bookId: string, quantity: number, type: string, reason?: string, schoolId?: string | null): Promise<schema.Book>;
  getInventoryTransactions(schoolId?: string | null): Promise<schema.BookInventoryTransaction[]>;

  // Classes
  getClasses(schoolId?: string | null): Promise<schema.Class[]>;
  createClass(c: schema.InsertClass): Promise<schema.Class>;
  updateClass(id: string, c: Partial<schema.InsertClass>, schoolId?: string | null): Promise<schema.Class | undefined>;
  deleteClass(id: string, schoolId?: string | null): Promise<void>;

  // Students
  getStudents(schoolId?: string | null): Promise<schema.Student[]>;
  getStudentsByClass(classId: string, schoolId?: string | null): Promise<schema.Student[]>;
  createStudent(s: schema.InsertStudent): Promise<schema.Student>;
  updateStudent(id: string, s: Partial<schema.InsertStudent>, schoolId?: string | null): Promise<schema.Student | undefined>;
  deleteStudent(id: string, schoolId?: string | null): Promise<void>;

  // Book Levels
  getBookLevels(schoolId?: string | null): Promise<schema.BookLevel[]>;
  createBookLevel(bl: schema.InsertBookLevel): Promise<schema.BookLevel>;
  updateBookLevel(id: string, bl: Partial<schema.InsertBookLevel>, schoolId?: string | null): Promise<schema.BookLevel | undefined>;
  deleteBookLevel(id: string, schoolId?: string | null): Promise<void>;
  getBookLevelItems(bookLevelId: string): Promise<(schema.BookLevelItem & { book?: schema.Book })[]>;
  addBookLevelItem(item: schema.InsertBookLevelItem): Promise<schema.BookLevelItem>;
  removeBookLevelItem(id: string): Promise<void>;

  // Class Book Levels
  getClassBookLevels(schoolId?: string | null): Promise<(schema.ClassBookLevel & { class?: schema.Class; bookLevel?: schema.BookLevel })[]>;
  assignClassBookLevel(cbl: schema.InsertClassBookLevel): Promise<schema.ClassBookLevel>;

  // Linking Codes
  getLinkingCodes(schoolId?: string | null): Promise<(schema.ChildLinkingCode & { student?: schema.Student; class?: schema.Class })[]>;
  createLinkingCode(code: schema.InsertChildLinkingCode): Promise<schema.ChildLinkingCode>;
  useLinkingCode(code: string, parentIdentifier: string): Promise<{ student: schema.Student; linkingCode: schema.ChildLinkingCode } | null>;

  // Parent
  getParentChildren(parentIdentifier: string): Promise<(schema.ParentChild & { student?: schema.Student & { class?: schema.Class } })[]>;

  // Baskets
  generateBasket(studentId: string, parentIdentifier: string, schoolId?: string | null): Promise<schema.ChildBookBasket>;
  getBaskets(parentIdentifier?: string, schoolId?: string | null): Promise<any[]>;
  getBasket(id: string, schoolId?: string | null): Promise<any>;

  // Payments
  createPayment(payment: schema.InsertBookPayment, basketIds: string[]): Promise<schema.BookPayment>;
  getPayments(parentIdentifier?: string, schoolId?: string | null): Promise<schema.BookPayment[]>;
  confirmPayment(paymentId: string, schoolId?: string | null): Promise<schema.BookPayment>;
  rejectPayment(paymentId: string, schoolId?: string | null): Promise<schema.BookPayment>;
  updatePaymentByReference(reference: string, updates: { externalPaymentId?: string; externalPaymentStatus?: string; notes?: string }): Promise<schema.BookPayment | null>;

  // Allocations
  getAllocations(classId?: string, schoolId?: string | null): Promise<any[]>;
  createAllocation(allocation: schema.InsertAllocation): Promise<schema.FinanceBookAllocation>;
  confirmReceipt(allocationId: string, schoolId?: string | null): Promise<schema.FinanceBookAllocation>;

  // Extra Copy Requests
  getExtraCopyRequests(filters?: { teacherId?: string; status?: string; schoolId?: string | null }): Promise<any[]>;
  createExtraCopyRequest(request: schema.InsertExtraCopyRequest): Promise<schema.ExtraCopyRequest>;
  approveExtraCopyRequest(id: string, adminNotes?: string, schoolId?: string | null): Promise<schema.ExtraCopyRequest>;
  rejectExtraCopyRequest(id: string, adminNotes?: string, schoolId?: string | null): Promise<schema.ExtraCopyRequest>;

  markAllocationAbsent(allocationId: string, schoolId?: string | null): Promise<schema.FinanceBookAllocation>;

  // Users (not school-scoped in interface — filtered in routes)
  getUsers(): Promise<schema.User[]>;
  getUserByUsername(username: string): Promise<schema.User | undefined>;
  getUserByEmail(email: string): Promise<schema.User | undefined>;
  getUserById(id: string): Promise<schema.User | undefined>;
  createUser(user: schema.InsertUser): Promise<schema.User>;
  updateUser(id: string, user: Partial<schema.InsertUser>): Promise<schema.User | undefined>;
  deleteUser(id: string): Promise<void>;
  updateLastLogin(id: string): Promise<void>;

  // Invites
  createInvite(invite: schema.InsertInvite): Promise<schema.Invite>;
  getInviteById(id: string): Promise<schema.Invite | undefined>;
  getPendingInviteByEmail(email: string): Promise<schema.Invite | undefined>;
  getInvitesBySchool(schoolId: string): Promise<schema.Invite[]>;
  markInviteAccepted(id: string): Promise<void>;
  revokeInvite(id: string): Promise<void>;

  // Audit logs
  createAuditLog(log: schema.InsertAuditLog): Promise<schema.AuditLog>;
  getAuditLogs(limit?: number): Promise<schema.AuditLog[]>;
}

class DatabaseStorage implements IStorage {
  // === SCHOOLS ===

  async getSchools(): Promise<schema.School[]> {
    try {
      return getDb().select().from(schema.schools);
    } catch (e) {
      if (!isDbUnavailableError(e)) throw e;
      return Array.from(memorySchools.values());
    }
  }

  async getSchoolById(id: string): Promise<schema.School | undefined> {
    try {
      const [school] = await getDb().select().from(schema.schools).where(eq(schema.schools.id, id));
      return school;
    } catch (e) {
      if (!isDbUnavailableError(e)) throw e;
      return memorySchools.get(id);
    }
  }

  async createSchool(school: schema.InsertSchool): Promise<schema.School> {
    try {
      const created = await insertAndFetchById(schema.schools, school);
      return created;
    } catch (e) {
      if (!isDbUnavailableError(e)) throw e;
      const created: schema.School = {
        id: randomUUID(),
        name: school.name,
        code: school.code,
        status: school.status ?? "active",
        setupStatus: school.setupStatus ?? (school.status === "active" ? "active" : "pending_admin_invite"),
        contactEmail: school.contactEmail ?? null,
        contactPhone: school.contactPhone ?? null,
        address: school.address ?? null,
        notes: school.notes ?? null,
        createdAt: now(),
        updatedAt: now(),
      };
      memorySchools.set(created.id, created);
      return created;
    }
  }

  async updateSchool(id: string, school: Partial<schema.InsertSchool>): Promise<schema.School | undefined> {
    const updates = { ...school, updatedAt: new Date() };
    try {
      const updated = await updateAndFetchFirst(schema.schools, eq(schema.schools.id, id), updates);
      return updated;
    } catch (e) {
      if (!isDbUnavailableError(e)) throw e;
      const existing = memorySchools.get(id);
      if (!existing) return undefined;
      const updated: schema.School = {
        ...existing,
        ...school,
        updatedAt: now(),
      };
      memorySchools.set(id, updated);
      return updated;
    }
  }

  async deleteSchool(id: string): Promise<void> {
    try {
      await getDb().delete(schema.schools).where(eq(schema.schools.id, id));
    } catch (e) {
      if (!isDbUnavailableError(e)) throw e;
      memorySchools.delete(id);
    }
  }

  async deleteSchoolAndRelatedData(id: string): Promise<void> {
    try {
      const db = getDb();
      const schoolUsers = await db
        .select({ id: schema.users.id })
        .from(schema.users)
        .where(eq(schema.users.schoolId, id));

      for (const schoolUser of schoolUsers) {
        await db.update(schema.invites).set({ invitedBy: null }).where(eq(schema.invites.invitedBy, schoolUser.id));
      }

      await db.delete(schema.extraCopyRequests).where(eq(schema.extraCopyRequests.schoolId, id));
      await db.delete(schema.financeBookAllocations).where(eq(schema.financeBookAllocations.schoolId, id));
      await db.delete(schema.childBookBaskets).where(eq(schema.childBookBaskets.schoolId, id));
      await db.delete(schema.bookPayments).where(eq(schema.bookPayments.schoolId, id));
      await db.delete(schema.childLinkingCodes).where(eq(schema.childLinkingCodes.schoolId, id));
      await db.delete(schema.invites).where(eq(schema.invites.schoolId, id));
      await db.delete(schema.users).where(eq(schema.users.schoolId, id));
      await db.delete(schema.students).where(eq(schema.students.schoolId, id));
      await db.delete(schema.classes).where(eq(schema.classes.schoolId, id));
      await db.delete(schema.bookLevels).where(eq(schema.bookLevels.schoolId, id));
      await db.delete(schema.books).where(eq(schema.books.schoolId, id));
      await db.delete(schema.schools).where(eq(schema.schools.id, id));
    } catch (e) {
      if (!isDbUnavailableError(e)) throw e;

      const deletedUserIds = new Set<string>();
      memoryUsers.forEach((user, userId) => {
        if (user.schoolId === id) {
          deletedUserIds.add(userId);
          memoryUsers.delete(userId);
        }
      });

      memoryInvites.forEach((invite, inviteId) => {
        if (invite.schoolId === id) {
          memoryInvites.delete(inviteId);
          return;
        }
        if (invite.invitedBy && deletedUserIds.has(invite.invitedBy)) {
          memoryInvites.set(inviteId, { ...invite, invitedBy: null });
        }
      });

      memorySchools.delete(id);
    }
  }

  // === BOOKS ===

  async getBooks(schoolId?: string | null): Promise<schema.Book[]> {
    const filter = schoolFilter(schema.books, schoolId);
    if (filter) return getDb().select().from(schema.books).where(filter);
    return getDb().select().from(schema.books);
  }

  async getBook(id: string, schoolId?: string | null): Promise<schema.Book | undefined> {
    const conditions = [eq(schema.books.id, id)];
    const sf = schoolFilter(schema.books, schoolId);
    if (sf) conditions.push(sf);
    const [book] = await getDb().select().from(schema.books).where(and(...conditions));
    return book;
  }

  async getBookByIsbn(isbn: string, schoolId?: string | null): Promise<schema.Book | undefined> {
    const conditions = [eq(schema.books.isbn, isbn)];
    const sf = schoolFilter(schema.books, schoolId);
    if (sf) conditions.push(sf);
    const [book] = await getDb().select().from(schema.books).where(and(...conditions));
    return book;
  }

  async createBook(book: schema.InsertBook): Promise<schema.Book> {
    const created = await insertAndFetchById(schema.books, book);
    return created;
  }

  async updateBook(id: string, book: Partial<schema.InsertBook>, schoolId?: string | null): Promise<schema.Book | undefined> {
    const conditions = [eq(schema.books.id, id)];
    const sf = schoolFilter(schema.books, schoolId);
    if (sf) conditions.push(sf);
    const updated = await updateAndFetchFirst(schema.books, and(...conditions), book);
    return updated;
  }

  async deleteBook(id: string, schoolId?: string | null): Promise<void> {
    const conditions = [eq(schema.books.id, id)];
    const sf = schoolFilter(schema.books, schoolId);
    if (sf) conditions.push(sf);
    await getDb().delete(schema.books).where(and(...conditions));
  }

  async getLowStockBooks(schoolId?: string | null): Promise<schema.Book[]> {
    const conditions = [
      eq(schema.books.isActive, true),
      sql`${schema.books.stockQuantity} < ${schema.books.lowStockThreshold}`,
    ];
    const sf = schoolFilter(schema.books, schoolId);
    if (sf) conditions.push(sf);
    return getDb().select().from(schema.books).where(and(...conditions));
  }

  async adjustStock(bookId: string, quantity: number, type: string, reason?: string, schoolId?: string | null): Promise<schema.Book> {
    const book = await this.getBook(bookId, schoolId);
    if (!book) throw new Error("Book not found");

    const prev = book.stockQuantity ?? 0;
    let newQty: number;

    if (type === "purchase" || type === "return" || type === "adjustment") {
      newQty = prev + quantity;
    } else if (type === "damage" || type === "allocation") {
      newQty = prev - quantity;
    } else {
      newQty = prev + quantity;
    }

    if (newQty < 0) throw new Error("Stock cannot go below zero");

    await getDb().insert(schema.bookInventoryTransactions).values({
      bookId,
      transactionType: type,
      quantity,
      previousQuantity: prev,
      newQuantity: newQty,
      reason,
    });

    const updated = await updateAndFetchFirst(schema.books, eq(schema.books.id, bookId), { stockQuantity: newQty });
    return updated;
  }

  async getInventoryTransactions(schoolId?: string | null): Promise<schema.BookInventoryTransaction[]> {
    // bookInventoryTransactions doesn't have schoolId directly — join through books
    if (typeof schoolId === "string") {
      const txns = await getDb().select().from(schema.bookInventoryTransactions).orderBy(desc(schema.bookInventoryTransactions.createdAt));
      const result = [];
      for (const txn of txns) {
        const book = await this.getBook(txn.bookId, schoolId);
        if (book) result.push(txn);
      }
      return result;
    }
    return getDb().select().from(schema.bookInventoryTransactions).orderBy(desc(schema.bookInventoryTransactions.createdAt));
  }

  // === CLASSES ===

  async getClasses(schoolId?: string | null): Promise<schema.Class[]> {
    const filter = schoolFilter(schema.classes, schoolId);
    if (filter) return getDb().select().from(schema.classes).where(filter);
    return getDb().select().from(schema.classes);
  }

  async createClass(c: schema.InsertClass): Promise<schema.Class> {
    const created = await insertAndFetchById(schema.classes, c);
    return created;
  }

  async updateClass(id: string, c: Partial<schema.InsertClass>, schoolId?: string | null): Promise<schema.Class | undefined> {
    const conditions = [eq(schema.classes.id, id)];
    const sf = schoolFilter(schema.classes, schoolId);
    if (sf) conditions.push(sf);
    const updated = await updateAndFetchFirst(schema.classes, and(...conditions), c);
    return updated;
  }

  async deleteClass(id: string, schoolId?: string | null): Promise<void> {
    const conditions = [eq(schema.classes.id, id)];
    const sf = schoolFilter(schema.classes, schoolId);
    if (sf) conditions.push(sf);
    await getDb().delete(schema.classes).where(and(...conditions));
  }

  // === STUDENTS ===

  async getStudents(schoolId?: string | null): Promise<schema.Student[]> {
    const filter = schoolFilter(schema.students, schoolId);
    if (filter) return getDb().select().from(schema.students).where(filter);
    return getDb().select().from(schema.students);
  }

  async getStudentById(id: string, schoolId?: string | null): Promise<schema.Student | undefined> {
    const conditions = [eq(schema.students.id, id)];
    const sf = schoolFilter(schema.students, schoolId);
    if (sf) conditions.push(sf);
    const [student] = await getDb().select().from(schema.students).where(and(...conditions)).limit(1);
    return student;
  }

  async getStudentsByClass(classId: string, schoolId?: string | null): Promise<schema.Student[]> {
    const conditions = [eq(schema.students.classId, classId)];
    const sf = schoolFilter(schema.students, schoolId);
    if (sf) conditions.push(sf);
    return getDb().select().from(schema.students).where(and(...conditions));
  }

  async createStudent(s: schema.InsertStudent): Promise<schema.Student> {
    const code = `STU-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const created = await insertAndFetchById(schema.students, { ...s, studentCode: code });
    return created;
  }

  async updateStudent(id: string, s: Partial<schema.InsertStudent>, schoolId?: string | null): Promise<schema.Student | undefined> {
    const conditions = [eq(schema.students.id, id)];
    const sf = schoolFilter(schema.students, schoolId);
    if (sf) conditions.push(sf);
    const updated = await updateAndFetchFirst(schema.students, and(...conditions), s);
    return updated;
  }

  async deleteStudent(id: string, schoolId?: string | null): Promise<void> {
    const conditions = [eq(schema.students.id, id)];
    const sf = schoolFilter(schema.students, schoolId);
    if (sf) conditions.push(sf);
    await getDb().delete(schema.students).where(and(...conditions));
  }

  // === BOOK LEVELS ===

  async getBookLevels(schoolId?: string | null): Promise<schema.BookLevel[]> {
    const filter = schoolFilter(schema.bookLevels, schoolId);
    if (filter) return getDb().select().from(schema.bookLevels).where(filter);
    return getDb().select().from(schema.bookLevels);
  }

  async createBookLevel(bl: schema.InsertBookLevel): Promise<schema.BookLevel> {
    const created = await insertAndFetchById(schema.bookLevels, bl);
    return created;
  }

  async updateBookLevel(id: string, bl: Partial<schema.InsertBookLevel>, schoolId?: string | null): Promise<schema.BookLevel | undefined> {
    const conditions = [eq(schema.bookLevels.id, id)];
    const sf = schoolFilter(schema.bookLevels, schoolId);
    if (sf) conditions.push(sf);
    const updated = await updateAndFetchFirst(schema.bookLevels, and(...conditions), bl);
    return updated;
  }

  async deleteBookLevel(id: string, schoolId?: string | null): Promise<void> {
    const conditions = [eq(schema.bookLevels.id, id)];
    const sf = schoolFilter(schema.bookLevels, schoolId);
    if (sf) conditions.push(sf);
    await getDb().delete(schema.bookLevels).where(and(...conditions));
  }

  async getBookLevelItems(bookLevelId: string): Promise<(schema.BookLevelItem & { book?: schema.Book })[]> {
    const items = await getDb().select().from(schema.bookLevelItems).where(eq(schema.bookLevelItems.bookLevelId, bookLevelId));
    const result = [];
    for (const item of items) {
      const [book] = await getDb().select().from(schema.books).where(eq(schema.books.id, item.bookId));
      result.push({ ...item, book });
    }
    return result;
  }

  async addBookLevelItem(item: schema.InsertBookLevelItem): Promise<schema.BookLevelItem> {
    const created = await insertAndFetchById(schema.bookLevelItems, item);
    return created;
  }

  async removeBookLevelItem(id: string): Promise<void> {
    await getDb().delete(schema.bookLevelItems).where(eq(schema.bookLevelItems.id, id));
  }

  // === CLASS BOOK LEVELS ===

  async getClassBookLevels(schoolId?: string | null): Promise<(schema.ClassBookLevel & { class?: schema.Class; bookLevel?: schema.BookLevel })[]> {
    const cbls = await getDb().select().from(schema.classBookLevels);
    const result = [];
    for (const cbl of cbls) {
      const [cls] = await getDb().select().from(schema.classes).where(eq(schema.classes.id, cbl.classId));
      // Filter by school: if schoolId is set, only include classes from that school
      if (typeof schoolId === "string" && cls?.schoolId !== schoolId) continue;
      const [bl] = await getDb().select().from(schema.bookLevels).where(eq(schema.bookLevels.id, cbl.bookLevelId));
      result.push({ ...cbl, class: cls, bookLevel: bl });
    }
    return result;
  }

  async assignClassBookLevel(cbl: schema.InsertClassBookLevel): Promise<schema.ClassBookLevel> {
    const created = await insertAndFetchById(schema.classBookLevels, cbl);
    return created;
  }

  // === LINKING CODES ===

  async getLinkingCodes(schoolId?: string | null): Promise<(schema.ChildLinkingCode & { student?: schema.Student; class?: schema.Class })[]> {
    let codes;
    const filter = schoolFilter(schema.childLinkingCodes, schoolId);
    if (filter) {
      codes = await getDb().select().from(schema.childLinkingCodes).where(filter);
    } else {
      codes = await getDb().select().from(schema.childLinkingCodes);
    }
    const result = [];
    for (const code of codes) {
      const [student] = await getDb().select().from(schema.students).where(eq(schema.students.id, code.studentId));
      let cls;
      if (student?.classId) {
        [cls] = await getDb().select().from(schema.classes).where(eq(schema.classes.id, student.classId));
      }
      result.push({ ...code, student, class: cls });
    }
    return result;
  }

  async createLinkingCode(codeData: schema.InsertChildLinkingCode): Promise<schema.ChildLinkingCode> {
    const created = await insertAndFetchById(schema.childLinkingCodes, codeData);
    return created;
  }

  async useLinkingCode(code: string, parentIdentifier: string): Promise<{ student: schema.Student; linkingCode: schema.ChildLinkingCode } | null> {
    const [linkingCode] = await getDb().select().from(schema.childLinkingCodes).where(
      and(eq(schema.childLinkingCodes.code, code), eq(schema.childLinkingCodes.isUsed, false))
    );
    if (!linkingCode) return null;

    const [student] = await getDb().select().from(schema.students).where(eq(schema.students.id, linkingCode.studentId));
    if (!student) return null;

    await getDb().update(schema.childLinkingCodes).set({ isUsed: true, linkedAt: new Date() }).where(eq(schema.childLinkingCodes.id, linkingCode.id));

    await getDb().insert(schema.parentChildren).values({ parentIdentifier, studentId: student.id });

    return { student, linkingCode: { ...linkingCode, isUsed: true, linkedAt: new Date() } };
  }

  // === PARENT ===

  async getParentChildren(parentIdentifier: string): Promise<(schema.ParentChild & { student?: schema.Student & { class?: schema.Class } })[]> {
    const links = await getDb().select().from(schema.parentChildren).where(eq(schema.parentChildren.parentIdentifier, parentIdentifier));
    const result = [];
    for (const link of links) {
      const [student] = await getDb().select().from(schema.students).where(eq(schema.students.id, link.studentId));
      let cls;
      if (student?.classId) {
        [cls] = await getDb().select().from(schema.classes).where(eq(schema.classes.id, student.classId));
      }
      result.push({ ...link, student: student ? { ...student, class: cls } : undefined });
    }
    return result;
  }

  // === BASKETS ===

  async generateBasket(studentId: string, parentIdentifier: string, schoolId?: string | null): Promise<schema.ChildBookBasket> {
    const conditions = [eq(schema.students.id, studentId)];
    const sf = schoolFilter(schema.students, schoolId);
    if (sf) conditions.push(sf);
    const [student] = await getDb().select().from(schema.students).where(and(...conditions));
    if (!student || !student.classId) throw new Error("Student or class not found");

    const classLevels = await getDb().select().from(schema.classBookLevels).where(eq(schema.classBookLevels.classId, student.classId));
    if (classLevels.length === 0) throw new Error("No book level assigned to this class");

    const allItems: { bookId: string; quantity: number; unitPrice: string }[] = [];
    for (const cl of classLevels) {
      const levelItems = await this.getBookLevelItems(cl.bookLevelId);
      for (const item of levelItems) {
        if (item.book && item.book.isActive) {
          allItems.push({
            bookId: item.bookId,
            quantity: item.quantity ?? 1,
            unitPrice: item.book.price,
          });
        }
      }
    }

    if (allItems.length === 0) throw new Error("No books found in the assigned level");

    let total = 0;
    for (const item of allItems) {
      total += parseFloat(item.unitPrice) * item.quantity;
    }

    const basket = await insertAndFetchById(schema.childBookBaskets, {
      studentId,
      parentIdentifier,
      status: "pending",
      totalAmount: total.toFixed(2),
      schoolId: student.schoolId,
    });

    for (const item of allItems) {
      const tp = parseFloat(item.unitPrice) * item.quantity;
      await getDb().insert(schema.basketItems).values({
        basketId: basket.id,
        bookId: item.bookId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: tp.toFixed(2),
      });
    }

    return basket;
  }

  async getBaskets(parentIdentifier?: string, schoolId?: string | null): Promise<any[]> {
    let baskets;
    const conditions = [];
    if (parentIdentifier) {
      conditions.push(eq(schema.childBookBaskets.parentIdentifier, parentIdentifier));
    }
    const sf = schoolFilter(schema.childBookBaskets, schoolId);
    if (sf) conditions.push(sf);

    if (conditions.length > 0) {
      baskets = await getDb().select().from(schema.childBookBaskets).where(and(...conditions));
    } else {
      baskets = await getDb().select().from(schema.childBookBaskets);
    }

    const result = [];
    for (const basket of baskets) {
      const items = await getDb().select().from(schema.basketItems).where(eq(schema.basketItems.basketId, basket.id));
      const itemsWithBooks = [];
      for (const item of items) {
        const [book] = await getDb().select().from(schema.books).where(eq(schema.books.id, item.bookId));
        itemsWithBooks.push({ ...item, book });
      }
      const [student] = await getDb().select().from(schema.students).where(eq(schema.students.id, basket.studentId));
      let cls;
      if (student?.classId) {
        [cls] = await getDb().select().from(schema.classes).where(eq(schema.classes.id, student.classId));
      }
      result.push({ ...basket, items: itemsWithBooks, student: student ? { ...student, class: cls } : undefined });
    }
    return result;
  }

  async getBasket(id: string, schoolId?: string | null): Promise<any> {
    const conditions = [eq(schema.childBookBaskets.id, id)];
    const sf = schoolFilter(schema.childBookBaskets, schoolId);
    if (sf) conditions.push(sf);
    const [basket] = await getDb().select().from(schema.childBookBaskets).where(and(...conditions));
    if (!basket) return null;
    const items = await getDb().select().from(schema.basketItems).where(eq(schema.basketItems.basketId, basket.id));
    const itemsWithBooks = [];
    for (const item of items) {
      const [book] = await getDb().select().from(schema.books).where(eq(schema.books.id, item.bookId));
      itemsWithBooks.push({ ...item, book });
    }
    return { ...basket, items: itemsWithBooks };
  }

  // === PAYMENTS ===

  async createPayment(payment: schema.InsertBookPayment, basketIds: string[]): Promise<schema.BookPayment> {
    const created = await insertAndFetchById(schema.bookPayments, payment);
    for (const basketId of basketIds) {
      await getDb().insert(schema.basketPayments).values({ basketId, paymentId: created.id });
      await getDb().update(schema.childBookBaskets).set({ status: "paid" }).where(eq(schema.childBookBaskets.id, basketId));
    }
    return created;
  }

  async updatePaymentByReference(reference: string, updates: { externalPaymentId?: string; externalPaymentStatus?: string; notes?: string }): Promise<schema.BookPayment | null> {
    const [payment] = await getDb().select().from(schema.bookPayments).where(eq(schema.bookPayments.paymentReference, reference));
    if (!payment) return null;
    const updated = await updateAndFetchFirst(schema.bookPayments, eq(schema.bookPayments.paymentReference, reference), updates);
    return updated;
  }

  async getPayments(parentIdentifier?: string, schoolId?: string | null): Promise<schema.BookPayment[]> {
    const conditions = [];
    if (parentIdentifier) {
      conditions.push(eq(schema.bookPayments.parentIdentifier, parentIdentifier));
    }
    const sf = schoolFilter(schema.bookPayments, schoolId);
    if (sf) conditions.push(sf);

    if (conditions.length > 0) {
      return getDb().select().from(schema.bookPayments).where(and(...conditions)).orderBy(desc(schema.bookPayments.paidAt));
    }
    return getDb().select().from(schema.bookPayments).orderBy(desc(schema.bookPayments.paidAt));
  }

  async confirmPayment(paymentId: string, schoolId?: string | null): Promise<schema.BookPayment> {
    // Verify ownership if schoolId set
    const conditions = [eq(schema.bookPayments.id, paymentId)];
    const sf = schoolFilter(schema.bookPayments, schoolId);
    if (sf) conditions.push(sf);
    const [existing] = await getDb().select().from(schema.bookPayments).where(and(...conditions));
    if (!existing) throw new Error("Payment not found");

    const payment = await updateAndFetchFirst(schema.bookPayments, eq(schema.bookPayments.id, paymentId), { status: "completed", confirmedAt: new Date() });

    const bps = await getDb().select().from(schema.basketPayments).where(eq(schema.basketPayments.paymentId, paymentId));
    for (const bp of bps) {
      await getDb().update(schema.childBookBaskets).set({ status: "allocated" }).where(eq(schema.childBookBaskets.id, bp.basketId));

      const basket = await this.getBasket(bp.basketId);
      if (basket) {
        for (const item of basket.items) {
          await getDb().insert(schema.financeBookAllocations).values({
            studentId: basket.studentId,
            bookId: item.bookId,
            basketId: basket.id,
            status: "allocated",
            schoolId: existing.schoolId,
          });
          try {
            await this.adjustStock(item.bookId, item.quantity, "allocation", `Allocated to student via payment ${paymentId}`);
          } catch (e) {
          }
        }
      }
    }

    return payment;
  }

  async rejectPayment(paymentId: string, schoolId?: string | null): Promise<schema.BookPayment> {
    const conditions = [eq(schema.bookPayments.id, paymentId)];
    const sf = schoolFilter(schema.bookPayments, schoolId);
    if (sf) conditions.push(sf);
    const [existing] = await getDb().select().from(schema.bookPayments).where(and(...conditions));
    if (!existing) throw new Error("Payment not found");

    const payment = await updateAndFetchFirst(schema.bookPayments, eq(schema.bookPayments.id, paymentId), { status: "failed" });
    const bps = await getDb().select().from(schema.basketPayments).where(eq(schema.basketPayments.paymentId, paymentId));
    for (const bp of bps) {
      await getDb().update(schema.childBookBaskets).set({ status: "pending" }).where(eq(schema.childBookBaskets.id, bp.basketId));
    }
    return payment;
  }

  // === ALLOCATIONS ===

  async getAllocations(classId?: string, schoolId?: string | null): Promise<any[]> {
    let allocs;
    const sf = schoolFilter(schema.financeBookAllocations, schoolId);
    if (sf) {
      allocs = await getDb().select().from(schema.financeBookAllocations).where(sf);
    } else {
      allocs = await getDb().select().from(schema.financeBookAllocations);
    }
    const result = [];
    for (const alloc of allocs) {
      const [student] = await getDb().select().from(schema.students).where(eq(schema.students.id, alloc.studentId));
      const [book] = await getDb().select().from(schema.books).where(eq(schema.books.id, alloc.bookId));
      if (classId && student?.classId !== classId) continue;
      let cls;
      if (student?.classId) {
        [cls] = await getDb().select().from(schema.classes).where(eq(schema.classes.id, student.classId));
      }
      result.push({ ...alloc, student: student ? { ...student, class: cls } : undefined, book });
    }
    return result;
  }

  async createAllocation(allocation: schema.InsertAllocation): Promise<schema.FinanceBookAllocation> {
    const created = await insertAndFetchById(schema.financeBookAllocations, allocation);
    return created;
  }

  async confirmReceipt(allocationId: string, schoolId?: string | null): Promise<schema.FinanceBookAllocation> {
    const conditions = [eq(schema.financeBookAllocations.id, allocationId)];
    const sf = schoolFilter(schema.financeBookAllocations, schoolId);
    if (sf) conditions.push(sf);
    const [existing] = await getDb().select().from(schema.financeBookAllocations).where(and(...conditions));
    if (!existing) throw new Error("Allocation not found");

    const updated = await updateAndFetchFirst(
      schema.financeBookAllocations,
      eq(schema.financeBookAllocations.id, allocationId),
      { status: "received", receivedAt: new Date() }
    );
    return updated;
  }

  // === EXTRA COPY REQUESTS ===

  async getExtraCopyRequests(filters?: { teacherId?: string; status?: string; schoolId?: string | null }): Promise<any[]> {
    const conditions = [];
    if (filters?.teacherId) {
      conditions.push(eq(schema.extraCopyRequests.teacherId, filters.teacherId));
    }
    if (filters?.status) {
      conditions.push(eq(schema.extraCopyRequests.status, filters.status));
    }
    const sf = schoolFilter(schema.extraCopyRequests, filters?.schoolId);
    if (sf) conditions.push(sf);

    let requests;
    if (conditions.length > 0) {
      requests = await getDb().select().from(schema.extraCopyRequests)
        .where(and(...conditions))
        .orderBy(desc(schema.extraCopyRequests.createdAt));
    } else {
      requests = await getDb().select().from(schema.extraCopyRequests)
        .orderBy(desc(schema.extraCopyRequests.createdAt));
    }
    const result = [];
    for (const req of requests) {
      const teacher = await this.getUserById(req.teacherId);
      const [book] = await getDb().select().from(schema.books).where(eq(schema.books.id, req.bookId));
      const [cls] = await getDb().select().from(schema.classes).where(eq(schema.classes.id, req.classId));
      result.push({
        ...req,
        teacher: teacher ? { id: teacher.id, name: teacher.name } : undefined,
        book: book ? { id: book.id, title: book.title, stockQuantity: book.stockQuantity } : undefined,
        class: cls ? { id: cls.id, name: cls.name } : undefined,
      });
    }
    return result;
  }

  async createExtraCopyRequest(request: schema.InsertExtraCopyRequest): Promise<schema.ExtraCopyRequest> {
    const created = await insertAndFetchById(schema.extraCopyRequests, request);
    return created;
  }

  async approveExtraCopyRequest(id: string, adminNotes?: string, schoolId?: string | null): Promise<schema.ExtraCopyRequest> {
    const conditions = [eq(schema.extraCopyRequests.id, id)];
    const sf = schoolFilter(schema.extraCopyRequests, schoolId);
    if (sf) conditions.push(sf);
    const [request] = await getDb().select().from(schema.extraCopyRequests).where(and(...conditions));
    if (!request) throw new Error("Request not found");
    if (request.status !== "pending") throw new Error("Request is not pending");

    try {
      await this.adjustStock(request.bookId, request.quantity, "allocation", `Extra copy request approved: ${request.reason}`);
    } catch (e) {
      // Stock may be insufficient but we still approve the request
    }

    const updated = await updateAndFetchFirst(
      schema.extraCopyRequests,
      eq(schema.extraCopyRequests.id, id),
      { status: "approved", adminNotes, resolvedAt: new Date() }
    );
    return updated;
  }

  async rejectExtraCopyRequest(id: string, adminNotes?: string, schoolId?: string | null): Promise<schema.ExtraCopyRequest> {
    const conditions = [eq(schema.extraCopyRequests.id, id)];
    const sf = schoolFilter(schema.extraCopyRequests, schoolId);
    if (sf) conditions.push(sf);
    const [existing] = await getDb().select().from(schema.extraCopyRequests).where(and(...conditions));
    if (!existing) throw new Error("Request not found");

    const updated = await updateAndFetchFirst(
      schema.extraCopyRequests,
      eq(schema.extraCopyRequests.id, id),
      { status: "rejected", adminNotes, resolvedAt: new Date() }
    );
    return updated;
  }

  async markAllocationAbsent(allocationId: string, schoolId?: string | null): Promise<schema.FinanceBookAllocation> {
    const conditions = [eq(schema.financeBookAllocations.id, allocationId)];
    const sf = schoolFilter(schema.financeBookAllocations, schoolId);
    if (sf) conditions.push(sf);
    const [existing] = await getDb().select().from(schema.financeBookAllocations).where(and(...conditions));
    if (!existing) throw new Error("Allocation not found");

    const updated = await updateAndFetchFirst(
      schema.financeBookAllocations,
      eq(schema.financeBookAllocations.id, allocationId),
      { status: "absent" }
    );
    return updated;
  }

  // === USERS ===

  async getUsers(): Promise<schema.User[]> {
    try {
      return await getDb().select().from(schema.users);
    } catch (e) {
      if (!isDbUnavailableError(e)) throw e;
      ensureDemoUsersInMemory();
      return Array.from(memoryUsers.values());
    }
  }

  async getUserByUsername(username: string): Promise<schema.User | undefined> {
    try {
      const [user] = await getDb().select().from(schema.users).where(eq(schema.users.username, username));
      return user;
    } catch (e) {
      if (!isDbUnavailableError(e)) throw e;
      ensureDemoUsersInMemory();
      return Array.from(memoryUsers.values()).find((u) => u.username === username);
    }
  }

  async getUserByEmail(email: string): Promise<schema.User | undefined> {
    try {
      const [user] = await getDb().select().from(schema.users).where(eq(schema.users.email, email));
      return user;
    } catch (e) {
      if (!isDbUnavailableError(e)) throw e;
      ensureDemoUsersInMemory();
      return Array.from(memoryUsers.values()).find((u) => u.email === email);
    }
  }

  async getUserById(id: string): Promise<schema.User | undefined> {
    try {
      const [user] = await getDb().select().from(schema.users).where(eq(schema.users.id, id));
      return user;
    } catch (e) {
      if (!isDbUnavailableError(e)) throw e;
      ensureDemoUsersInMemory();
      return memoryUsers.get(id);
    }
  }

  async createUser(user: schema.InsertUser): Promise<schema.User> {
    try {
      const created = await insertAndFetchById(schema.users, user);
      return created;
    } catch (e) {
      if (!isDbUnavailableError(e)) throw e;
      ensureDemoUsersInMemory();
      const created: schema.User = {
        id: randomUUID(),
        username: user.username,
        passwordHash: user.passwordHash,
        name: user.name,
        role: user.role,
        email: user.email ?? null,
        status: user.status ?? "active",
        schoolId: user.schoolId ?? null,
        emailVerifiedAt: null,
        createdAt: now(),
        updatedAt: now(),
        lastLoginAt: null,
      };
      memoryUsers.set(created.id, created);
      return created;
    }
  }

  async updateUser(id: string, user: Partial<schema.InsertUser>): Promise<schema.User | undefined> {
    try {
      const updated = await updateAndFetchFirst(schema.users, eq(schema.users.id, id), user);
      return updated;
    } catch (e) {
      if (!isDbUnavailableError(e)) throw e;
      ensureDemoUsersInMemory();
      const existing = memoryUsers.get(id);
      if (!existing) return undefined;
      const updated: schema.User = {
        ...existing,
        ...user,
        updatedAt: now(),
      } as schema.User;
      memoryUsers.set(id, updated);
      return updated;
    }
  }

  async deleteUser(id: string): Promise<void> {
    try {
      // Preserve invite history while allowing inviter accounts to be removed.
      await getDb().update(schema.invites).set({ invitedBy: null }).where(eq(schema.invites.invitedBy, id));
      await getDb().delete(schema.users).where(eq(schema.users.id, id));
    } catch (e) {
      if (!isDbUnavailableError(e)) throw e;
      memoryUsers.delete(id);
      memoryInvites.forEach((invite, inviteId) => {
        if (invite.invitedBy === id) {
          memoryInvites.set(inviteId, { ...invite, invitedBy: null });
        }
      });
    }
  }

  async updateLastLogin(id: string): Promise<void> {
    try {
      await getDb().update(schema.users).set({ lastLoginAt: new Date(), updatedAt: new Date() }).where(eq(schema.users.id, id));
    } catch (e) {
      if (!isDbUnavailableError(e)) throw e;
      const existing = memoryUsers.get(id);
      if (!existing) return;
      memoryUsers.set(id, { ...existing, lastLoginAt: now(), updatedAt: now() });
    }
  }

  // === INVITES ===

  async createInvite(invite: schema.InsertInvite): Promise<schema.Invite> {
    try {
      const created = await insertAndFetchById(schema.invites, invite);
      return created;
    } catch (e) {
      if (!isDbUnavailableError(e)) throw e;
      const created: schema.Invite = {
        id: randomUUID(),
        email: invite.email,
        inviteeName: invite.inviteeName ?? null,
        role: invite.role,
        schoolId: invite.schoolId ?? null,
        tokenHash: invite.tokenHash,
        invitedBy: invite.invitedBy ?? null,
        status: invite.status ?? "pending",
        expiresAt: invite.expiresAt,
        createdAt: now(),
        acceptedAt: null,
      };
      memoryInvites.set(created.id, created);
      return created;
    }
  }

  async getInviteById(id: string): Promise<schema.Invite | undefined> {
    try {
      const [invite] = await getDb().select().from(schema.invites).where(eq(schema.invites.id, id));
      return invite;
    } catch (e) {
      if (!isDbUnavailableError(e)) throw e;
      return memoryInvites.get(id);
    }
  }

  async getPendingInviteByEmail(email: string): Promise<schema.Invite | undefined> {
    try {
      const [invite] = await getDb().select().from(schema.invites)
        .where(and(eq(schema.invites.email, email), eq(schema.invites.status, "pending")));
      return invite;
    } catch (e) {
      if (!isDbUnavailableError(e)) throw e;
      return Array.from(memoryInvites.values()).find((i) => i.email === email && i.status === "pending");
    }
  }

  async getInvitesBySchool(schoolId: string): Promise<schema.Invite[]> {
    try {
      return await getDb().select().from(schema.invites)
        .where(eq(schema.invites.schoolId, schoolId))
        .orderBy(desc(schema.invites.createdAt));
    } catch (e) {
      if (!isDbUnavailableError(e)) throw e;
      return Array.from(memoryInvites.values())
        .filter((invite) => invite.schoolId === schoolId)
        .sort((a, b) => {
          const left = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const right = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return right - left;
        });
    }
  }

  async markInviteAccepted(id: string): Promise<void> {
    try {
      await getDb().update(schema.invites).set({ status: "accepted", acceptedAt: new Date() }).where(eq(schema.invites.id, id));
    } catch (e) {
      if (!isDbUnavailableError(e)) throw e;
      const invite = memoryInvites.get(id);
      if (!invite) return;
      memoryInvites.set(id, { ...invite, status: "accepted", acceptedAt: now() });
    }
  }

  async revokeInvite(id: string): Promise<void> {
    try {
      await getDb().update(schema.invites).set({ status: "revoked" }).where(eq(schema.invites.id, id));
    } catch (e) {
      if (!isDbUnavailableError(e)) throw e;
      const invite = memoryInvites.get(id);
      if (!invite) return;
      memoryInvites.set(id, { ...invite, status: "revoked" });
    }
  }

  // === AUDIT LOGS ===

  async createAuditLog(log: schema.InsertAuditLog): Promise<schema.AuditLog> {
    try {
      const created = await insertAndFetchById(schema.auditLogs, log);
      return created;
    } catch (e) {
      if (!isDbUnavailableError(e)) throw e;
      const created: schema.AuditLog = {
        id: randomUUID(),
        userId: log.userId ?? null,
        action: log.action,
        target: log.target ?? null,
        metadata: log.metadata ?? null,
        ipAddress: log.ipAddress ?? null,
        userAgent: log.userAgent ?? null,
        createdAt: now(),
      };
      memoryAuditLogs.push(created);
      return created;
    }
  }

  async getAuditLogs(limit = 100): Promise<schema.AuditLog[]> {
    try {
      return await getDb().select().from(schema.auditLogs).orderBy(desc(schema.auditLogs.createdAt)).limit(limit);
    } catch (e) {
      if (!isDbUnavailableError(e)) throw e;
      return memoryAuditLogs.slice().reverse().slice(0, limit);
    }
  }
}

export const storage = new DatabaseStorage();
