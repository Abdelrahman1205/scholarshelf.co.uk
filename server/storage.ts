import { eq, and, lt, desc, sql, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import * as schema from "../shared/schema.js";

// ── Storage mode detection ────────────────────────────────────────────
const IS_PRODUCTION = process.env.NODE_ENV === "production";
const FORCE_MEMORY_STORAGE =
  !IS_PRODUCTION && process.env.FORCE_MEMORY_STORAGE === "true";
const MEMORY_ALLOWED =
  !IS_PRODUCTION && process.env.ALLOW_MEMORY_STORAGE === "true";
const RESOLVED_DATABASE_URL = FORCE_MEMORY_STORAGE
  ? ""
  : (process.env.DATABASE_URL?.trim() ?? "");

let _storageMode: "database" | "memory" | "unknown" = "unknown";

/** Expose current storage mode for health checks (no secrets leaked). */
export function getStorageMode(): "database" | "memory" | "unknown" {
  return _storageMode;
}

// Lazy DB initialisation — safe when DATABASE_URL is absent (falls back to memory)
let _db: ReturnType<typeof drizzle> | null = null;
function getDb(): ReturnType<typeof drizzle> {
  if (!_db) {
    if (!RESOLVED_DATABASE_URL) throw new Error("No DATABASE_URL configured");
    const sql = neon(RESOLVED_DATABASE_URL);
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

/**
 * Determines whether an error indicates a database connectivity problem.
 *
 * **Production behaviour**: always re-throws — the app must never silently
 * degrade to in-memory storage when NODE_ENV=production.
 *
 * **Development behaviour**: returns `true` for connection-class errors so the
 * caller can fall back to the in-memory Map store, but only when
 * ALLOW_MEMORY_STORAGE=true.
 */
function isDbUnavailableError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  const code = (error as { code?: string } | undefined)?.code;

  const isConnectionError =
    message.includes("No DATABASE_URL") ||
    code === "ECONNREFUSED" ||
    code === "ENOTFOUND" ||
    message.includes("ECONNREFUSED") ||
    message.includes("ENOTFOUND") ||
    message.includes("fetch failed") ||
    message.includes("NeonDbError") ||
    message.includes("Connection terminated") ||
    message.includes("SASL") ||
    message.includes("password authentication") ||
    message.includes("SSL") ||
    message.includes("certificate");

  if (!isConnectionError) return false;

  // ── Production: fail fast — never fall back silently ──
  if (IS_PRODUCTION) {
    console.error("[STORAGE] Database unavailable in production — refusing to fall back to memory.", message);
    throw error instanceof Error ? error : new Error(message);
  }

  // ── Development: only fall back if explicitly allowed ──
  if (!MEMORY_ALLOWED && !FORCE_MEMORY_STORAGE) {
    console.error(
      "[STORAGE] Database unavailable and ALLOW_MEMORY_STORAGE is not 'true'. " +
      "Set ALLOW_MEMORY_STORAGE=true in .env for local dev without a database."
    );
    throw error instanceof Error ? error : new Error(message);
  }

  // Switch mode on first fallback
  if (_storageMode !== "memory") {
    _storageMode = "memory";
    console.warn("[STORAGE] ⚠ Falling back to in-memory storage (development only).");
    ensureDemoUsersInMemory();
  }

  return true;
}

const memoryUsers = new Map<string, schema.User>();
const memorySchools = new Map<string, schema.School>();
const memoryInvites = new Map<string, schema.Invite>();
const memoryAuditLogs: schema.AuditLog[] = [];
const memorySchoolBranding = new Map<string, schema.SchoolBranding>();
const memoryUserPermissions = new Map<string, Set<string>>();

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
      paymentAppName: null,
      createdAt: now(),
      updatedAt: now(),
      isDeleted: false,
      suspendedAt: null,
      suspendedBy: null,
      suspensionReason: null,
      archivedAt: null,
      archivedBy: null,
      archiveReason: null,
      restoredAt: null,
      restoredBy: null,
      restoreReason: null,
      deletionRequestedAt: null,
      deletionRequestedBy: null,
      deletionReason: null,
      deletedAt: null,
      deletedBy: null,
      deleteReason: null,
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
    {
      id: randomUUID(),
      username: "finance",
      passwordHash: bcrypt.hashSync("finance123", 10),
      name: "Youssef Al-Baruni",
      role: "finance",
      email: "finance@alnoor.edu.ly",
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
  updateSchool(id: string, school: Partial<Omit<schema.School, "id">>): Promise<schema.School | undefined>;
  deleteSchool(id: string): Promise<void>;
  deleteSchoolAndRelatedData(id: string): Promise<void>;

  // Books
  getBooks(schoolId?: string | null): Promise<schema.Book[]>;
  getBook(id: string, schoolId?: string | null): Promise<schema.Book | undefined>;
  getBookByIsbn(isbn: string, schoolId?: string | null): Promise<schema.Book | undefined>;
  getBookByCode(code: string, schoolId?: string | null): Promise<schema.Book | undefined>;
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
  removeClassBookLevel(id: string, schoolId?: string | null): Promise<void>;
  getStudentBookLevelOverride(studentId: string): Promise<(schema.StudentBookLevel & { bookLevel?: schema.BookLevel }) | undefined>;
  setStudentBookLevelOverride(studentId: string, bookLevelId: string, schoolId?: string | null): Promise<schema.StudentBookLevel>;
  deleteStudentBookLevelOverride(studentId: string): Promise<void>;
  getAllStudentBookLevelOverrides(schoolId?: string | null): Promise<(schema.StudentBookLevel & { bookLevel?: schema.BookLevel })[]>;

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
  getPaymentsEnriched(schoolId?: string | null): Promise<any[]>;
  getPaymentById(id: string, schoolId?: string | null): Promise<schema.BookPayment | undefined>;
  submitPaymentReference(paymentId: string, referenceNumber: string, submittedBy: string, notes?: string, schoolId?: string | null): Promise<schema.BookPayment>;
  confirmPayment(paymentId: string, reviewedBy: string, reviewNote?: string, schoolId?: string | null): Promise<schema.BookPayment>;
  rejectPayment(paymentId: string, reviewedBy: string, reviewNote?: string, schoolId?: string | null): Promise<schema.BookPayment>;
  markPaymentNeedsReview(paymentId: string, reviewedBy: string, reviewNote?: string, schoolId?: string | null): Promise<schema.BookPayment>;
  markPaymentReadyForCollection(paymentId: string, reviewedBy: string, reviewNote?: string, schoolId?: string | null): Promise<schema.BookPayment>;
  markPaymentCollected(paymentId: string, reviewedBy: string, reviewNote?: string, schoolId?: string | null): Promise<schema.BookPayment>;
  cancelPayment(paymentId: string, reviewedBy: string, reviewNote?: string, schoolId?: string | null): Promise<schema.BookPayment>;
  isPaymentReferenceDuplicate(referenceNumber: string, schoolId: string, excludePaymentId?: string): Promise<boolean>;
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

  // === Teacher-led Distribution ===
  getDistributionsByTeacher(teacherId: string, schoolId: string, filters?: { classId?: string; status?: string }): Promise<any[]>;
  confirmDistribution(allocationId: string, teacherId: string, schoolId: string): Promise<schema.FinanceBookAllocation>;
  markDistributionAbsent(allocationId: string, teacherId: string, schoolId: string): Promise<schema.FinanceBookAllocation>;
  reportDistributionIssue(allocationId: string, teacherId: string, issueNote: string, schoolId: string): Promise<schema.FinanceBookAllocation>;
  getDistributionOverview(schoolId: string): Promise<any>;
  adminConfirmDistribution(allocationId: string, schoolId: string): Promise<schema.FinanceBookAllocation>;
  updateOrderStatus(paymentId: string, orderStatus: string, schoolId?: string | null): Promise<schema.BookPayment>;

  // Multi-role user management
  getSecondaryRoles(userId: string): Promise<string[]>;
  addSecondaryRole(userId: string, role: string): Promise<void>;
  removeSecondaryRole(userId: string, role: string): Promise<void>;
  getTeacherProfile(userId: string, schoolId: string): Promise<schema.TeacherProfile | undefined>;
  upsertTeacherProfile(profile: schema.InsertTeacherProfile): Promise<schema.TeacherProfile>;
  addParentStudentLink(opts: { parentIdentifier: string; studentId: string; relationship?: string; addedByAdminId?: string; schoolId?: string }): Promise<schema.ParentChild & { alreadyLinked: boolean }>;
  getUserWithDetail(userId: string, schoolId: string): Promise<any>;
  searchStudentsForAdmin(query: string, schoolId: string): Promise<any[]>;

  // Users — optional schoolId filters at the query layer to avoid full table scans.
  getUsers(schoolId?: string | null): Promise<schema.User[]>;
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

  // Branding and permissions
  getSchoolBranding(schoolId: string): Promise<schema.SchoolBranding | undefined>;
  upsertSchoolBranding(schoolId: string, payload: Partial<schema.InsertSchoolBranding>, updatedBy?: string | null): Promise<schema.SchoolBranding>;
  resetSchoolBranding(schoolId: string, updatedBy?: string | null): Promise<schema.SchoolBranding>;
  getUserPermissions(userId: string): Promise<string[]>;
  setUserPermissions(userId: string, permissions: string[]): Promise<void>;

  // === Messaging ===
  getMessageThreads(filters: { schoolId: string; parentUserId?: string; teacherUserId?: string; status?: string }): Promise<any[]>;
  getMessageThread(id: string, schoolId: string): Promise<any | undefined>;
  createMessageThread(thread: schema.InsertMessageThread): Promise<schema.MessageThread>;
  updateThreadStatus(id: string, status: string, closedBy?: string, schoolId?: string): Promise<schema.MessageThread | undefined>;
  getMessages(threadId: string, schoolId: string): Promise<schema.Message[]>;
  createMessage(msg: schema.InsertMessage): Promise<schema.Message>;
  markMessagesRead(threadId: string, readerUserId: string, schoolId: string): Promise<void>;
  getUnreadCount(userId: string, schoolId: string): Promise<number>;
  createMessageAuditLog(log: schema.InsertMessageAuditLog): Promise<schema.MessageAuditLog>;
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
        paymentAppName: school.paymentAppName ?? null,
        createdAt: now(),
        updatedAt: now(),
        isDeleted: false,
        suspendedAt: null, suspendedBy: null, suspensionReason: null,
        archivedAt: null, archivedBy: null, archiveReason: null,
        restoredAt: null, restoredBy: null, restoreReason: null,
        deletionRequestedAt: null, deletionRequestedBy: null, deletionReason: null,
        deletedAt: null, deletedBy: null, deleteReason: null,
      };
      memorySchools.set(created.id, created);
      return created;
    }
  }

  async updateSchool(id: string, school: Partial<Omit<schema.School, "id">>): Promise<schema.School | undefined> {
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

      const schoolClasses = await db
        .select({ id: schema.classes.id })
        .from(schema.classes)
        .where(eq(schema.classes.schoolId, id));

      const schoolStudents = await db
        .select({ id: schema.students.id })
        .from(schema.students)
        .where(eq(schema.students.schoolId, id));

      const schoolBooks = await db
        .select({ id: schema.books.id })
        .from(schema.books)
        .where(eq(schema.books.schoolId, id));

      const schoolBookLevels = await db
        .select({ id: schema.bookLevels.id })
        .from(schema.bookLevels)
        .where(eq(schema.bookLevels.schoolId, id));

      const schoolUserIds = schoolUsers.map((u) => u.id);
      const schoolClassIds = schoolClasses.map((c) => c.id);
      const schoolStudentIds = schoolStudents.map((s) => s.id);
      const schoolBookIds = schoolBooks.map((b) => b.id);
      const schoolBookLevelIds = schoolBookLevels.map((l) => l.id);

      const classLinkedStudents = schoolClassIds.length > 0
        ? await db
            .select({ id: schema.students.id })
            .from(schema.students)
            .where(inArray(schema.students.classId, schoolClassIds))
        : [];
      const allStudentIds = Array.from(new Set([...schoolStudentIds, ...classLinkedStudents.map((s) => s.id)]));

      if (schoolUserIds.length > 0) {
        await db.update(schema.invites).set({ invitedBy: null }).where(inArray(schema.invites.invitedBy, schoolUserIds));
        await db.delete(schema.userPermissions).where(inArray(schema.userPermissions.userId, schoolUserIds));

        await db.delete(schema.messageAuditLogs).where(inArray(schema.messageAuditLogs.actorUserId, schoolUserIds));
        await db.delete(schema.messages).where(inArray(schema.messages.senderUserId, schoolUserIds));
        await db.delete(schema.messageThreads).where(inArray(schema.messageThreads.parentUserId, schoolUserIds));
        await db.delete(schema.messageThreads).where(inArray(schema.messageThreads.teacherUserId, schoolUserIds));

        await db.delete(schema.financeBookAllocations).where(inArray(schema.financeBookAllocations.receivedByTeacherId, schoolUserIds));
        await db.delete(schema.financeBookAllocations).where(inArray(schema.financeBookAllocations.absentMarkedByTeacherId, schoolUserIds));
        await db.delete(schema.extraCopyRequests).where(inArray(schema.extraCopyRequests.teacherId, schoolUserIds));
      }

      if (schoolClassIds.length > 0) {
        await db.delete(schema.classBookLevels).where(inArray(schema.classBookLevels.classId, schoolClassIds));
        await db.delete(schema.extraCopyRequests).where(inArray(schema.extraCopyRequests.classId, schoolClassIds));
      }

      if (allStudentIds.length > 0) {
        await db.delete(schema.financeBookAllocations).where(inArray(schema.financeBookAllocations.studentId, allStudentIds));
        await db.delete(schema.childBookBaskets).where(inArray(schema.childBookBaskets.studentId, allStudentIds));
      }

      if (schoolBookIds.length > 0) {
        await db.delete(schema.extraCopyRequests).where(inArray(schema.extraCopyRequests.bookId, schoolBookIds));
        await db.delete(schema.financeBookAllocations).where(inArray(schema.financeBookAllocations.bookId, schoolBookIds));
        await db.delete(schema.basketItems).where(inArray(schema.basketItems.bookId, schoolBookIds));
      }

      if (schoolBookLevelIds.length > 0) {
        await db.delete(schema.classBookLevels).where(inArray(schema.classBookLevels.bookLevelId, schoolBookLevelIds));
        await db.delete(schema.bookLevelItems).where(inArray(schema.bookLevelItems.bookLevelId, schoolBookLevelIds));
      }

      await db.delete(schema.extraCopyRequests).where(eq(schema.extraCopyRequests.schoolId, id));
      await db.delete(schema.schoolBranding).where(eq(schema.schoolBranding.schoolId, id));
      await db.delete(schema.financeBookAllocations).where(eq(schema.financeBookAllocations.schoolId, id));
      // Messaging tables reference users/students, so delete them before users/students.
      await db.delete(schema.messageAuditLogs).where(eq(schema.messageAuditLogs.schoolId, id));
      await db.delete(schema.messages).where(eq(schema.messages.schoolId, id));
      await db.delete(schema.messageThreads).where(eq(schema.messageThreads.schoolId, id));
      await db.delete(schema.childBookBaskets).where(eq(schema.childBookBaskets.schoolId, id));
      await db.delete(schema.bookPayments).where(eq(schema.bookPayments.schoolId, id));
      await db.delete(schema.childLinkingCodes).where(eq(schema.childLinkingCodes.schoolId, id));
      await db.delete(schema.invites).where(eq(schema.invites.schoolId, id));
      await db.delete(schema.users).where(eq(schema.users.schoolId, id));
      if (allStudentIds.length > 0) {
        await db.delete(schema.students).where(inArray(schema.students.id, allStudentIds));
      }
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

      for (let i = memoryMessages.length - 1; i >= 0; i--) {
        if (memoryMessages[i].schoolId === id) {
          memoryMessages.splice(i, 1);
        }
      }

      for (let i = memoryMessageThreads.length - 1; i >= 0; i--) {
        if (memoryMessageThreads[i].schoolId === id) {
          memoryMessageThreads.splice(i, 1);
        }
      }

      memorySchools.delete(id);
      memorySchoolBranding.delete(id);
    }
  }

  // === BRANDING & PERMISSIONS ===

  async getSchoolBranding(schoolId: string): Promise<schema.SchoolBranding | undefined> {
    try {
      const [branding] = await getDb().select().from(schema.schoolBranding).where(eq(schema.schoolBranding.schoolId, schoolId));
      return branding;
    } catch (e) {
      if (!isDbUnavailableError(e)) throw e;
      return memorySchoolBranding.get(schoolId);
    }
  }

  async upsertSchoolBranding(schoolId: string, payload: Partial<schema.InsertSchoolBranding>, updatedBy?: string | null): Promise<schema.SchoolBranding> {
    const updates = {
      ...payload,
      updatedAt: new Date(),
      updatedBy: updatedBy ?? null,
    } as any;

    try {
      const existing = await this.getSchoolBranding(schoolId);
      if (existing) {
        const [updated] = await getDb().update(schema.schoolBranding).set(updates).where(eq(schema.schoolBranding.schoolId, schoolId)).returning();
        return updated;
      }

      const [created] = await getDb().insert(schema.schoolBranding).values({
        schoolId,
        primaryColour: "#2563EB",
        secondaryColour: "#1E3A8A",
        accentColour: "#0EA5E9",
        themeName: "default",
        fontPreference: "Inter",
        setupStatus: "pending",
        updatedBy: updatedBy ?? null,
        ...payload,
      } as any).returning();
      return created;
    } catch (e) {
      if (!isDbUnavailableError(e)) throw e;
      const current = memorySchoolBranding.get(schoolId);
      if (current) {
        const updated: schema.SchoolBranding = {
          ...current,
          ...(payload as any),
          updatedBy: updatedBy ?? null,
          updatedAt: now(),
        };
        memorySchoolBranding.set(schoolId, updated);
        return updated;
      }

      const created: schema.SchoolBranding = {
        id: randomUUID(),
        schoolId,
        logoUrl: (payload as any).logoUrl ?? null,
        logoFileId: (payload as any).logoFileId ?? null,
        faviconUrl: (payload as any).faviconUrl ?? null,
        faviconFileId: (payload as any).faviconFileId ?? null,
        bannerImageUrl: (payload as any).bannerImageUrl ?? null,
        bannerFileId: (payload as any).bannerFileId ?? null,
        emailHeaderLogoUrl: (payload as any).emailHeaderLogoUrl ?? null,
        emailHeaderLogoFileId: (payload as any).emailHeaderLogoFileId ?? null,
        pdfLogoUrl: (payload as any).pdfLogoUrl ?? null,
        pdfLogoFileId: (payload as any).pdfLogoFileId ?? null,
        primaryColour: (payload as any).primaryColour ?? "#2563EB",
        secondaryColour: (payload as any).secondaryColour ?? "#1E3A8A",
        accentColour: (payload as any).accentColour ?? "#0EA5E9",
        themeName: (payload as any).themeName ?? "default",
        fontPreference: (payload as any).fontPreference ?? "Inter",
        setupStatus: (payload as any).setupStatus ?? "pending",
        createdAt: now(),
        updatedAt: now(),
        updatedBy: updatedBy ?? null,
      };
      memorySchoolBranding.set(schoolId, created);
      return created;
    }
  }

  async resetSchoolBranding(schoolId: string, updatedBy?: string | null): Promise<schema.SchoolBranding> {
    return this.upsertSchoolBranding(schoolId, {
      logoUrl: null,
      logoFileId: null,
      faviconUrl: null,
      faviconFileId: null,
      bannerImageUrl: null,
      bannerFileId: null,
      emailHeaderLogoUrl: null,
      emailHeaderLogoFileId: null,
      pdfLogoUrl: null,
      pdfLogoFileId: null,
      primaryColour: "#2563EB",
      secondaryColour: "#1E3A8A",
      accentColour: "#0EA5E9",
      themeName: "default",
      fontPreference: "Inter",
      setupStatus: "pending",
    }, updatedBy);
  }

  async getUserPermissions(userId: string): Promise<string[]> {
    try {
      const rows = await getDb().select().from(schema.userPermissions).where(eq(schema.userPermissions.userId, userId));
      return rows.map((row) => row.permission);
    } catch (e) {
      if (!isDbUnavailableError(e)) throw e;
      return Array.from(memoryUserPermissions.get(userId) || []);
    }
  }

  async setUserPermissions(userId: string, permissions: string[]): Promise<void> {
    const deduped = Array.from(new Set(permissions));
    try {
      await getDb().delete(schema.userPermissions).where(eq(schema.userPermissions.userId, userId));
      if (deduped.length > 0) {
        await getDb().insert(schema.userPermissions).values(deduped.map((permission) => ({ userId, permission })) as any);
      }
      return;
    } catch (e) {
      if (!isDbUnavailableError(e)) throw e;
      memoryUserPermissions.set(userId, new Set(deduped));
    }
  }

  // === BOOKS ===

  async getBooks(schoolId?: string | null): Promise<schema.Book[]> {
    try {
      const filter = schoolFilter(schema.books, schoolId);
      if (filter) return getDb().select().from(schema.books).where(filter);
      return getDb().select().from(schema.books);
    } catch (e) {
      if (!isDbUnavailableError(e)) throw e;
      return [];
    }
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

  async getBookByCode(code: string, schoolId?: string | null): Promise<schema.Book | undefined> {
    const conditions = [eq(schema.books.bookCode, code)];
    const sf = schoolFilter(schema.books, schoolId);
    if (sf) conditions.push(sf);
    const [book] = await getDb().select().from(schema.books).where(and(...conditions));
    return book;
  }

  async createBook(book: schema.InsertBook): Promise<schema.Book> {
    // Auto-generate bookCode: BK-{schoolCode}-{sequenceNumber}
    let bookCode: string | undefined;
    if (book.schoolId) {
      // Get the school code
      const [school] = await getDb().select({ code: schema.schools.code }).from(schema.schools).where(eq(schema.schools.id, book.schoolId));
      const schoolCode = school?.code || "UNK";
      // Count existing books for this school to determine sequence
      const [result] = await getDb().select({ count: sql<number>`count(*)` }).from(schema.books).where(eq(schema.books.schoolId, book.schoolId));
      const seq = (Number(result?.count) || 0) + 1;
      bookCode = `BK-${schoolCode}-${String(seq).padStart(6, "0")}`;
    }
    const created = await insertAndFetchById(schema.books, {
      ...book,
      bookCode: bookCode || null,
      barcodeGeneratedAt: bookCode ? new Date() : null,
    });
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
    try {
      const filter = schoolFilter(schema.classes, schoolId);
      if (filter) return getDb().select().from(schema.classes).where(filter);
      return getDb().select().from(schema.classes);
    } catch (e) {
      if (!isDbUnavailableError(e)) throw e;
      return [];
    }
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

  async getStudents(schoolId?: string | null, includeArchived = false): Promise<schema.Student[]> {
    try {
      const conditions: any[] = [];
      const sf = schoolFilter(schema.students, schoolId);
      if (sf) conditions.push(sf);
      if (!includeArchived) conditions.push(eq(schema.students.isArchived, false));
      if (conditions.length > 0) return getDb().select().from(schema.students).where(and(...conditions));
      return getDb().select().from(schema.students);
    } catch (e) {
      if (!isDbUnavailableError(e)) throw e;
      return [];
    }
  }

  async getStudentById(id: string, schoolId?: string | null): Promise<schema.Student | undefined> {
    const conditions = [eq(schema.students.id, id)];
    const sf = schoolFilter(schema.students, schoolId);
    if (sf) conditions.push(sf);
    const [student] = await getDb().select().from(schema.students).where(and(...conditions)).limit(1);
    return student;
  }

  async getStudentsByClass(classId: string, schoolId?: string | null): Promise<schema.Student[]> {
    const conditions: any[] = [eq(schema.students.classId, classId), eq(schema.students.isArchived, false)];
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

  async archiveStudent(id: string, archivedBy: string, schoolId?: string | null): Promise<void> {
    const conditions: any[] = [eq(schema.students.id, id)];
    const sf = schoolFilter(schema.students, schoolId);
    if (sf) conditions.push(sf);
    await getDb().update(schema.students)
      .set({ isArchived: true, archivedAt: new Date(), archivedBy })
      .where(and(...conditions));
  }

  async unarchiveStudent(id: string, schoolId?: string | null): Promise<void> {
    const conditions: any[] = [eq(schema.students.id, id)];
    const sf = schoolFilter(schema.students, schoolId);
    if (sf) conditions.push(sf);
    await getDb().update(schema.students)
      .set({ isArchived: false, archivedAt: null, archivedBy: null })
      .where(and(...conditions));
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

  async removeClassBookLevel(id: string, schoolId?: string | null): Promise<void> {
    const [cbl] = await getDb().select().from(schema.classBookLevels).where(eq(schema.classBookLevels.id, id));
    if (!cbl) throw new Error("Assignment not found");
    // Verify school ownership via the linked class
    if (schoolId) {
      const [cls] = await getDb().select().from(schema.classes).where(eq(schema.classes.id, cbl.classId));
      if (cls?.schoolId !== schoolId) throw new Error("Access denied");
    }
    await getDb().delete(schema.classBookLevels).where(eq(schema.classBookLevels.id, id));
  }

  async getStudentBookLevelOverride(studentId: string): Promise<(schema.StudentBookLevel & { bookLevel?: schema.BookLevel }) | undefined> {
    const [row] = await getDb().select().from(schema.studentBookLevels).where(eq(schema.studentBookLevels.studentId, studentId));
    if (!row) return undefined;
    const [bl] = await getDb().select().from(schema.bookLevels).where(eq(schema.bookLevels.id, row.bookLevelId));
    return { ...row, bookLevel: bl };
  }

  async setStudentBookLevelOverride(studentId: string, bookLevelId: string, schoolId?: string | null): Promise<schema.StudentBookLevel> {
    await getDb().delete(schema.studentBookLevels).where(eq(schema.studentBookLevels.studentId, studentId));
    const created = await insertAndFetchById(schema.studentBookLevels, { studentId, bookLevelId, schoolId: schoolId ?? null });
    return created;
  }

  async deleteStudentBookLevelOverride(studentId: string): Promise<void> {
    await getDb().delete(schema.studentBookLevels).where(eq(schema.studentBookLevels.studentId, studentId));
  }

  async getAllStudentBookLevelOverrides(schoolId?: string | null): Promise<(schema.StudentBookLevel & { bookLevel?: schema.BookLevel })[]> {
    const filter = schoolId ? eq(schema.studentBookLevels.schoolId, schoolId) : undefined;
    const rows = filter ? await getDb().select().from(schema.studentBookLevels).where(filter) : await getDb().select().from(schema.studentBookLevels);
    const result = [];
    for (const row of rows) {
      const [bl] = await getDb().select().from(schema.bookLevels).where(eq(schema.bookLevels.id, row.bookLevelId));
      result.push({ ...row, bookLevel: bl });
    }
    return result;
  }

  // === LINKING CODES ===

  async getLinkingCodes(schoolId?: string | null): Promise<(schema.ChildLinkingCode & { student?: schema.Student; class?: schema.Class })[]> {
    try {
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
    } catch (e) {
      if (!isDbUnavailableError(e)) throw e;
      return [];
    }
  }

  async createLinkingCode(codeData: schema.InsertChildLinkingCode): Promise<schema.ChildLinkingCode> {
    const created = await insertAndFetchById(schema.childLinkingCodes, codeData);
    return created;
  }

  // Look up a single link code by its code string — for preview (does not consume)
  async getLinkingCodeByCode(code: string): Promise<(schema.ChildLinkingCode & { student?: schema.Student; class?: schema.Class }) | null> {
    const [linkingCode] = await getDb().select().from(schema.childLinkingCodes)
      .where(eq(schema.childLinkingCodes.code, code));
    if (!linkingCode) return null;
    const [student] = linkingCode.studentId
      ? await getDb().select().from(schema.students).where(eq(schema.students.id, linkingCode.studentId))
      : [undefined];
    let cls: schema.Class | undefined;
    if (student?.classId) {
      [cls] = await getDb().select().from(schema.classes).where(eq(schema.classes.id, student.classId));
    }
    return { ...linkingCode, student, class: cls };
  }

  // Rotate a student's link code — marks all existing codes used and creates a fresh one
  async rotateLinkingCode(studentId: string, parentEmail: string, schoolId: string | null, expiresAt?: Date | null): Promise<schema.ChildLinkingCode> {
    // Mark existing unused codes as used
    await getDb().update(schema.childLinkingCodes)
      .set({ isUsed: true })
      .where(and(eq(schema.childLinkingCodes.studentId, studentId), eq(schema.childLinkingCodes.isUsed, false)));
    // Generate new code
    const newCode = `${Math.random().toString(36).substring(2, 5).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const created = await insertAndFetchById(schema.childLinkingCodes, {
      studentId,
      code: newCode,
      parentEmail,
      isUsed: false,
      expiresAt: expiresAt ?? null,
      schoolId,
    });
    return created;
  }

  async useLinkingCode(code: string, parentIdentifier: string): Promise<{ student: schema.Student; linkingCode: schema.ChildLinkingCode } | null> {
    const [linkingCode] = await getDb().select().from(schema.childLinkingCodes).where(
      eq(schema.childLinkingCodes.code, code)
    );
    if (!linkingCode) return null;

    // SECURITY: Check if already used
    if (linkingCode.isUsed) {
      throw new Error("This linking code has already been used.");
    }

    // SECURITY: Check expiry — if expiresAt is set, it must be in the future
    if (linkingCode.expiresAt && new Date(linkingCode.expiresAt) < new Date()) {
      throw new Error("This linking code has expired. Please request a new code from the school.");
    }

    // SECURITY: Check parentEmail — if the code was generated for a specific parent, enforce it
    if (linkingCode.parentEmail && linkingCode.parentEmail.trim() !== "") {
      const codeEmail = linkingCode.parentEmail.trim().toLowerCase();
      const callerEmail = parentIdentifier.trim().toLowerCase();
      if (codeEmail !== callerEmail) {
        throw new Error("This linking code is not assigned to your email address.");
      }
    }

    const [student] = await getDb().select().from(schema.students).where(eq(schema.students.id, linkingCode.studentId));
    if (!student) return null;

    await getDb().update(schema.childLinkingCodes).set({ isUsed: true, linkedAt: new Date() }).where(eq(schema.childLinkingCodes.id, linkingCode.id));

    await getDb().insert(schema.parentChildren).values({ parentIdentifier, studentId: student.id });

    return { student, linkingCode: { ...linkingCode, isUsed: true, linkedAt: new Date() } };
  }

  // === PARENT ===

  async getParentChildren(parentIdentifier: string): Promise<(schema.ParentChild & { student?: schema.Student & { class?: schema.Class } })[]> {
    try {
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
    } catch (e) {
      if (!isDbUnavailableError(e)) throw e;
      return [];
    }
  }

  // === BASKETS ===

  async generateBasket(studentId: string, parentIdentifier: string, schoolId?: string | null): Promise<schema.ChildBookBasket> {
    const conditions = [eq(schema.students.id, studentId)];
    const sf = schoolFilter(schema.students, schoolId);
    if (sf) conditions.push(sf);
    const [student] = await getDb().select().from(schema.students).where(and(...conditions));
    if (!student || !student.classId) throw new Error("Your child's details couldn't be found. Please contact the school.");

    // Check for per-student override first, fall back to class-level assignment
    const studentOverride = await getDb().select().from(schema.studentBookLevels).where(eq(schema.studentBookLevels.studentId, studentId));
    let classLevels: (typeof schema.classBookLevels.$inferSelect)[] = [];
    if (studentOverride.length > 0) {
      // Use student-level override: treat it like a single class-level entry
      classLevels = [{ id: studentOverride[0].id, classId: student.classId ?? "", bookLevelId: studentOverride[0].bookLevelId }] as unknown as (typeof schema.classBookLevels.$inferSelect)[];
    } else {
      classLevels = await getDb().select().from(schema.classBookLevels).where(eq(schema.classBookLevels.classId, student.classId));
    }
    if (classLevels.length === 0) throw new Error("Your child's book list isn't ready yet. Please contact the school to let them know.");

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

    if (allItems.length === 0) throw new Error("No books have been added to your child's level yet. Please check back soon or contact the school.");

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

  async getPaymentById(id: string, schoolId?: string | null): Promise<schema.BookPayment | undefined> {
    const conditions = [eq(schema.bookPayments.id, id)];
    const sf = schoolFilter(schema.bookPayments, schoolId);
    if (sf) conditions.push(sf);
    const [payment] = await getDb().select().from(schema.bookPayments).where(and(...conditions));
    return payment;
  }

  async getPaymentsEnriched(schoolId?: string | null): Promise<any[]> {
    const payments = await this.getPayments(undefined, schoolId);
    const result = [];
    for (const payment of payments) {
      // Get baskets linked to this payment
      const links = await getDb().select().from(schema.basketPayments).where(eq(schema.basketPayments.paymentId, payment.id));
      let studentName: string | null = null;
      let className: string | null = null;
      let classId: string | null = null;
      if (links.length > 0) {
        const [basket] = await getDb().select().from(schema.childBookBaskets).where(eq(schema.childBookBaskets.id, links[0].basketId));
        if (basket?.studentId) {
          const [student] = await getDb().select().from(schema.students).where(eq(schema.students.id, basket.studentId));
          if (student) {
            studentName = student.name;
            classId = student.classId;
            if (student.classId) {
              const [cls] = await getDb().select().from(schema.classes).where(eq(schema.classes.id, student.classId));
              className = cls?.name ?? null;
            }
          }
        }
      }
      result.push({ ...payment, studentName, className, classId });
    }
    return result;
  }

  async submitPaymentReference(
    paymentId: string,
    referenceNumber: string,
    submittedBy: string,
    notes?: string,
    schoolId?: string | null,
  ): Promise<schema.BookPayment> {
    const conditions = [eq(schema.bookPayments.id, paymentId)];
    const sf = schoolFilter(schema.bookPayments, schoolId);
    if (sf) conditions.push(sf);
    const [existing] = await getDb().select().from(schema.bookPayments).where(and(...conditions));
    if (!existing) throw new Error("Payment not found");

    // Only allow submission when status is awaiting_reference, rejected, or legacy pending
    const allowedStatuses = ["awaiting_reference", "rejected", "pending", "failed"];
    if (!allowedStatuses.includes(existing.status)) {
      throw new Error(`Cannot submit reference for payment in status: ${existing.status}`);
    }

    const payment = await updateAndFetchFirst(schema.bookPayments, eq(schema.bookPayments.id, paymentId), {
      paymentReferenceNumber: referenceNumber,
      paymentReferenceSubmittedAt: new Date(),
      paymentReferenceSubmittedBy: submittedBy,
      status: "reference_submitted",
      notes: notes || existing.notes,
    });

    // Update basket status to "paid" (reference submitted)
    const bps = await getDb().select().from(schema.basketPayments).where(eq(schema.basketPayments.paymentId, paymentId));
    for (const bp of bps) {
      await getDb().update(schema.childBookBaskets).set({ status: "paid" }).where(eq(schema.childBookBaskets.id, bp.basketId));
    }

    return payment;
  }

  async confirmPayment(paymentId: string, reviewedBy: string, reviewNote?: string, schoolId?: string | null): Promise<schema.BookPayment> {
    const conditions = [eq(schema.bookPayments.id, paymentId)];
    const sf = schoolFilter(schema.bookPayments, schoolId);
    if (sf) conditions.push(sf);
    const [existing] = await getDb().select().from(schema.bookPayments).where(and(...conditions));
    if (!existing) throw new Error("Payment not found");

    const payment = await updateAndFetchFirst(schema.bookPayments, eq(schema.bookPayments.id, paymentId), {
      status: "confirmed",
      confirmedAt: new Date(),
      paymentReviewedAt: new Date(),
      paymentReviewedBy: reviewedBy,
      paymentReviewNote: reviewNote || null,
    });

    // Create allocations from linked baskets
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
            // Stock adjustment failure should not block allocation
          }
        }
      }
    }

    return payment;
  }

  async rejectPayment(paymentId: string, reviewedBy: string, reviewNote?: string, schoolId?: string | null): Promise<schema.BookPayment> {
    const conditions = [eq(schema.bookPayments.id, paymentId)];
    const sf = schoolFilter(schema.bookPayments, schoolId);
    if (sf) conditions.push(sf);
    const [existing] = await getDb().select().from(schema.bookPayments).where(and(...conditions));
    if (!existing) throw new Error("Payment not found");

    const payment = await updateAndFetchFirst(schema.bookPayments, eq(schema.bookPayments.id, paymentId), {
      status: "rejected",
      paymentReviewedAt: new Date(),
      paymentReviewedBy: reviewedBy,
      paymentReviewNote: reviewNote || null,
    });
    // Reset baskets to pending so parent can resubmit
    const bps = await getDb().select().from(schema.basketPayments).where(eq(schema.basketPayments.paymentId, paymentId));
    for (const bp of bps) {
      await getDb().update(schema.childBookBaskets).set({ status: "pending" }).where(eq(schema.childBookBaskets.id, bp.basketId));
    }
    return payment;
  }

  async markPaymentNeedsReview(paymentId: string, reviewedBy: string, reviewNote?: string, schoolId?: string | null): Promise<schema.BookPayment> {
    const conditions = [eq(schema.bookPayments.id, paymentId)];
    const sf = schoolFilter(schema.bookPayments, schoolId);
    if (sf) conditions.push(sf);
    const [existing] = await getDb().select().from(schema.bookPayments).where(and(...conditions));
    if (!existing) throw new Error("Payment not found");

    return updateAndFetchFirst(schema.bookPayments, eq(schema.bookPayments.id, paymentId), {
      status: "needs_review",
      paymentReviewedAt: new Date(),
      paymentReviewedBy: reviewedBy,
      paymentReviewNote: reviewNote || null,
    });
  }

  async markPaymentReadyForCollection(paymentId: string, reviewedBy: string, reviewNote?: string, schoolId?: string | null): Promise<schema.BookPayment> {
    const conditions = [eq(schema.bookPayments.id, paymentId)];
    const sf = schoolFilter(schema.bookPayments, schoolId);
    if (sf) conditions.push(sf);
    const [existing] = await getDb().select().from(schema.bookPayments).where(and(...conditions));
    if (!existing) throw new Error("Payment not found");
    if (existing.status !== "confirmed") throw new Error("Only confirmed payments can be marked ready for collection");

    return updateAndFetchFirst(schema.bookPayments, eq(schema.bookPayments.id, paymentId), {
      status: "ready_for_collection",
      paymentReviewedAt: new Date(),
      paymentReviewedBy: reviewedBy,
      paymentReviewNote: reviewNote || existing.paymentReviewNote,
    });
  }

  async markPaymentCollected(paymentId: string, reviewedBy: string, reviewNote?: string, schoolId?: string | null): Promise<schema.BookPayment> {
    const conditions = [eq(schema.bookPayments.id, paymentId)];
    const sf = schoolFilter(schema.bookPayments, schoolId);
    if (sf) conditions.push(sf);
    const [existing] = await getDb().select().from(schema.bookPayments).where(and(...conditions));
    if (!existing) throw new Error("Payment not found");
    if (existing.status !== "ready_for_collection" && existing.status !== "confirmed") {
      throw new Error("Only confirmed or ready-for-collection orders can be marked as collected");
    }

    return updateAndFetchFirst(schema.bookPayments, eq(schema.bookPayments.id, paymentId), {
      status: "collected",
      paymentReviewedAt: new Date(),
      paymentReviewedBy: reviewedBy,
      paymentReviewNote: reviewNote || existing.paymentReviewNote,
    });
  }

  async cancelPayment(paymentId: string, reviewedBy: string, reviewNote?: string, schoolId?: string | null): Promise<schema.BookPayment> {
    const conditions = [eq(schema.bookPayments.id, paymentId)];
    const sf = schoolFilter(schema.bookPayments, schoolId);
    if (sf) conditions.push(sf);
    const [existing] = await getDb().select().from(schema.bookPayments).where(and(...conditions));
    if (!existing) throw new Error("Payment not found");
    if (existing.status === "collected") throw new Error("Collected orders cannot be cancelled");

    // Reset associated baskets
    const links = await getDb().select().from(schema.basketPayments).where(eq(schema.basketPayments.paymentId, paymentId));
    for (const link of links) {
      await getDb().update(schema.childBookBaskets).set({ status: "cancelled" }).where(eq(schema.childBookBaskets.id, link.basketId));

      // If payment was already confirmed, stock was deducted — restore it now
      const wasConfirmed = ["confirmed", "ready_for_collection"].includes(existing.status);
      if (wasConfirmed) {
        const basket = await this.getBasket(link.basketId);
        if (basket) {
          for (const item of basket.items) {
            try {
              await this.adjustStock(item.bookId, item.quantity, "return", 'Stock restored: payment ' + paymentId + ' cancelled');
            } catch (_) {}
          }
          // Remove the finance allocations so books are no longer shown as allocated
          await getDb().delete(schema.financeBookAllocations).where(eq(schema.financeBookAllocations.basketId, link.basketId));
        }
      }
    }

    return updateAndFetchFirst(schema.bookPayments, eq(schema.bookPayments.id, paymentId), {
      status: "cancelled",
      paymentReviewedAt: new Date(),
      paymentReviewedBy: reviewedBy,
      paymentReviewNote: reviewNote || null,
    });
  }

  async isPaymentReferenceDuplicate(referenceNumber: string, schoolId: string, excludePaymentId?: string): Promise<boolean> {
    const conditions = [
      eq(schema.bookPayments.paymentReferenceNumber, referenceNumber),
      eq(schema.bookPayments.schoolId, schoolId),
    ];
    if (excludePaymentId) {
      // We need sql`!=` but drizzle doesn't have neq in simple form, use raw
      // Actually drizzle has `ne` — but safer to just filter in JS for one check
    }
    const rows = await getDb().select({ id: schema.bookPayments.id }).from(schema.bookPayments).where(and(...conditions));
    if (excludePaymentId) {
      return rows.some(r => r.id !== excludePaymentId);
    }
    return rows.length > 0;
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

  // === TEACHER-LED DISTRIBUTION ===

  async getDistributionsByTeacher(teacherId: string, schoolId: string, filters?: { classId?: string; status?: string }): Promise<any[]> {
    // Get classes assigned to this teacher
    const teacherClasses = await getDb().select().from(schema.classes)
      .where(and(eq(schema.classes.teacherId, teacherId), eq(schema.classes.schoolId, schoolId)));
    if (teacherClasses.length === 0) return [];

    const classIds = teacherClasses.map(c => c.id);
    // Get students in those classes
    let studentQuery = getDb().select().from(schema.students)
      .where(and(
        inArray(schema.students.classId, classIds),
        eq(schema.students.schoolId, schoolId)
      ));
    const students = await studentQuery;
    if (students.length === 0) return [];

    const studentIds = students.map(s => s.id);
    // Get allocations for those students
    const conditions: any[] = [
      inArray(schema.financeBookAllocations.studentId, studentIds),
      eq(schema.financeBookAllocations.schoolId, schoolId),
    ];
    if (filters?.status) {
      conditions.push(eq(schema.financeBookAllocations.distributionStatus, filters.status));
    }
    if (filters?.classId) {
      const classStudents = students.filter(s => s.classId === filters.classId).map(s => s.id);
      if (classStudents.length === 0) return [];
      conditions.push(inArray(schema.financeBookAllocations.studentId, classStudents));
    }

    const allocations = await getDb().select().from(schema.financeBookAllocations)
      .where(and(...conditions));

    // Enrich with student, book, class info
    const books = await getDb().select().from(schema.books).where(eq(schema.books.schoolId, schoolId));
    const bookMap = new Map(books.map(b => [b.id, b]));
    const studentMap = new Map(students.map(s => [s.id, s]));
    const classMap = new Map(teacherClasses.map(c => [c.id, c]));

    return allocations.map(a => {
      const student = studentMap.get(a.studentId);
      return {
        ...a,
        student,
        book: bookMap.get(a.bookId),
        class: student?.classId ? classMap.get(student.classId) : undefined,
      };
    });
  }

  async confirmDistribution(allocationId: string, teacherId: string, schoolId: string): Promise<schema.FinanceBookAllocation> {
    const [existing] = await getDb().select().from(schema.financeBookAllocations)
      .where(and(eq(schema.financeBookAllocations.id, allocationId), eq(schema.financeBookAllocations.schoolId, schoolId)));
    if (!existing) throw new Error("Allocation not found");

    const updated = await updateAndFetchFirst(
      schema.financeBookAllocations,
      eq(schema.financeBookAllocations.id, allocationId),
      {
        distributionStatus: "received_by_student",
        status: "received",
        receivedAt: new Date(),
        receivedByTeacherId: teacherId,
      }
    );
    return updated;
  }

  async markDistributionAbsent(allocationId: string, teacherId: string, schoolId: string): Promise<schema.FinanceBookAllocation> {
    const [existing] = await getDb().select().from(schema.financeBookAllocations)
      .where(and(eq(schema.financeBookAllocations.id, allocationId), eq(schema.financeBookAllocations.schoolId, schoolId)));
    if (!existing) throw new Error("Allocation not found");

    const updated = await updateAndFetchFirst(
      schema.financeBookAllocations,
      eq(schema.financeBookAllocations.id, allocationId),
      {
        distributionStatus: "student_absent",
        absentMarkedAt: new Date(),
        absentMarkedByTeacherId: teacherId,
      }
    );
    return updated;
  }

  async reportDistributionIssue(allocationId: string, teacherId: string, issueNote: string, schoolId: string): Promise<schema.FinanceBookAllocation> {
    const [existing] = await getDb().select().from(schema.financeBookAllocations)
      .where(and(eq(schema.financeBookAllocations.id, allocationId), eq(schema.financeBookAllocations.schoolId, schoolId)));
    if (!existing) throw new Error("Allocation not found");

    const updated = await updateAndFetchFirst(
      schema.financeBookAllocations,
      eq(schema.financeBookAllocations.id, allocationId),
      {
        distributionStatus: "issue_reported",
        issueNote,
        absentMarkedByTeacherId: teacherId,
      }
    );
    return updated;
  }

  async getDistributionOverview(schoolId: string): Promise<any> {
    const allocations = await getDb().select().from(schema.financeBookAllocations)
      .where(eq(schema.financeBookAllocations.schoolId, schoolId));
    const total = allocations.length;
    const pending = allocations.filter(a => a.distributionStatus === "pending_distribution" || !a.distributionStatus).length;
    const received = allocations.filter(a => a.distributionStatus === "received_by_student").length;
    const absent = allocations.filter(a => a.distributionStatus === "student_absent").length;
    const issues = allocations.filter(a => a.distributionStatus === "issue_reported").length;
    return { total, pending, received, absent, issues };
  }

  async adminConfirmDistribution(allocationId: string, schoolId: string): Promise<schema.FinanceBookAllocation> {
    const [existing] = await getDb().select().from(schema.financeBookAllocations)
      .where(and(eq(schema.financeBookAllocations.id, allocationId), eq(schema.financeBookAllocations.schoolId, schoolId)));
    if (!existing) throw new Error("Allocation not found");

    const updated = await updateAndFetchFirst(
      schema.financeBookAllocations,
      eq(schema.financeBookAllocations.id, allocationId),
      {
        distributionStatus: "received_by_student",
        status: "received",
        receivedAt: new Date(),
      }
    );
    return updated;
  }

  async updateOrderStatus(paymentId: string, orderStatus: string, schoolId?: string | null): Promise<schema.BookPayment> {
    const conditions = [eq(schema.bookPayments.id, paymentId)];
    const sf = schoolFilter(schema.bookPayments, schoolId);
    if (sf) conditions.push(sf);
    const [existing] = await getDb().select().from(schema.bookPayments).where(and(...conditions));
    if (!existing) throw new Error("Payment not found");

    const updated = await updateAndFetchFirst(
      schema.bookPayments,
      eq(schema.bookPayments.id, paymentId),
      { orderStatus }
    );
    return updated;
  }

  // === USERS ===

  async getUsers(schoolId?: string | null): Promise<schema.User[]> {
    try {
      const db = getDb();
      if (schoolId) {
        // Scoped query — avoids a full platform-wide user table scan.
        return await db.select().from(schema.users).where(eq(schema.users.schoolId, schoolId));
      }
      return await db.select().from(schema.users);
    } catch (e) {
      if (!isDbUnavailableError(e)) throw e;
      ensureDemoUsersInMemory();
      const all = Array.from(memoryUsers.values());
      if (schoolId) return all.filter((u) => u.schoolId === schoolId);
      return all;
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

  // === MULTI-ROLE USER MANAGEMENT ===

  async getSecondaryRoles(userId: string): Promise<string[]> {
    const perms = await this.getUserPermissions(userId);
    return perms
      .filter((p) => p.startsWith("SECONDARY_ROLE:"))
      .map((p) => p.replace("SECONDARY_ROLE:", ""));
  }

  async addSecondaryRole(userId: string, role: string): Promise<void> {
    const permission = `SECONDARY_ROLE:${role}`;
    try {
      await getDb()
        .insert(schema.userPermissions)
        .values({ userId, permission } as any)
        .onConflictDoNothing();
    } catch (e) {
      if (!isDbUnavailableError(e)) throw e;
      const set = memoryUserPermissions.get(userId) || new Set<string>();
      set.add(permission);
      memoryUserPermissions.set(userId, set);
    }
  }

  async removeSecondaryRole(userId: string, role: string): Promise<void> {
    const permission = `SECONDARY_ROLE:${role}`;
    try {
      await getDb()
        .delete(schema.userPermissions)
        .where(and(eq(schema.userPermissions.userId, userId), eq(schema.userPermissions.permission, permission)));
    } catch (e) {
      if (!isDbUnavailableError(e)) throw e;
      const set = memoryUserPermissions.get(userId);
      if (set) set.delete(permission);
    }
  }

  async getTeacherProfile(userId: string, schoolId: string): Promise<schema.TeacherProfile | undefined> {
    try {
      const [profile] = await getDb()
        .select()
        .from(schema.teacherProfiles)
        .where(and(eq(schema.teacherProfiles.userId, userId), eq(schema.teacherProfiles.schoolId, schoolId)));
      return profile;
    } catch (e) {
      if (!isDbUnavailableError(e)) throw e;
      return undefined;
    }
  }

  async upsertTeacherProfile(profile: schema.InsertTeacherProfile): Promise<schema.TeacherProfile> {
    try {
      const existing = await this.getTeacherProfile(profile.userId, profile.schoolId);
      if (existing) {
        const [updated] = await getDb()
          .update(schema.teacherProfiles)
          .set({ department: profile.department, subjects: profile.subjects })
          .where(eq(schema.teacherProfiles.id, existing.id))
          .returning();
        return updated;
      }
      const [created] = await getDb()
        .insert(schema.teacherProfiles)
        .values(profile as any)
        .returning();
      return created;
    } catch (e) {
      if (!isDbUnavailableError(e)) throw e;
      throw new Error("DB unavailable");
    }
  }

  async addParentStudentLink(opts: {
    parentIdentifier: string;
    studentId: string;
    relationship?: string;
    addedByAdminId?: string;
    schoolId?: string;
  }): Promise<schema.ParentChild & { alreadyLinked: boolean }> {
    try {
      const existing = await getDb()
        .select()
        .from(schema.parentChildren)
        .where(
          and(
            eq(schema.parentChildren.parentIdentifier, opts.parentIdentifier),
            eq(schema.parentChildren.studentId, opts.studentId),
          ),
        );
      if (existing.length > 0) {
        return { ...existing[0], alreadyLinked: true };
      }
      const [created] = await getDb()
        .insert(schema.parentChildren)
        .values({
          parentIdentifier: opts.parentIdentifier,
          studentId: opts.studentId,
          relationship: opts.relationship ?? null,
          addedByAdminId: opts.addedByAdminId ?? null,
          schoolId: opts.schoolId ?? null,
        } as any)
        .returning();
      return { ...created, alreadyLinked: false };
    } catch (e) {
      if (!isDbUnavailableError(e)) throw e;
      throw new Error("DB unavailable");
    }
  }

  async getUserWithDetail(userId: string, schoolId: string): Promise<any> {
    const user = await this.getUserById(userId);
    if (!user) return null;

    const [secondaryRoles, teacherProfile, parentLinks, allClasses] = await Promise.all([
      this.getSecondaryRoles(userId),
      this.getTeacherProfile(userId, schoolId),
      user.email ? this.getParentChildren(user.email) : Promise.resolve([]),
      this.getClasses(schoolId),
    ]);

    const assignedClasses = allClasses.filter((c) => c.teacherId === userId);

    // School-scoped parent links only
    const schoolParentLinks = parentLinks.filter(
      (link) => !link.student?.schoolId || link.student.schoolId === schoolId,
    );

    return {
      ...user,
      secondaryRoles,
      teacherProfile: teacherProfile ?? null,
      parentLinks: schoolParentLinks,
      assignedClasses,
    };
  }

  async searchStudentsForAdmin(query: string, schoolId: string): Promise<any[]> {
    const students = await this.getStudents(schoolId);
    const q = query.toLowerCase().trim();
    if (!q) return students.slice(0, 20);
    return students
      .filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          (s.studentCode?.toLowerCase().includes(q) ?? false),
      )
      .slice(0, 20);
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

  // === MESSAGING ===

  async getMessageThreads(filters: { schoolId: string; parentUserId?: string; teacherUserId?: string; status?: string }): Promise<any[]> {
    try {
      const db = getDb();
      const conditions: any[] = [eq(schema.messageThreads.schoolId, filters.schoolId)];
      if (filters.parentUserId) conditions.push(eq(schema.messageThreads.parentUserId, filters.parentUserId));
      if (filters.teacherUserId) conditions.push(eq(schema.messageThreads.teacherUserId, filters.teacherUserId));
      if (filters.status) conditions.push(eq(schema.messageThreads.status, filters.status));

      const threads = await db
        .select()
        .from(schema.messageThreads)
        .where(and(...conditions))
        .orderBy(desc(schema.messageThreads.lastMessageAt));

      // Enrich with participant names, student name, and unread counts
      const enriched = [];
      for (const t of threads) {
        const [parent] = await db.select({ name: schema.users.name }).from(schema.users).where(eq(schema.users.id, t.parentUserId));
        const [teacher] = await db.select({ name: schema.users.name }).from(schema.users).where(eq(schema.users.id, t.teacherUserId));
        const [student] = await db.select({ name: schema.students.name, classId: schema.students.classId }).from(schema.students).where(eq(schema.students.id, t.studentId));

        const allMsgs = await db.select().from(schema.messages).where(
          and(eq(schema.messages.threadId, t.id), eq(schema.messages.schoolId, filters.schoolId))
        );
        const totalMessages = allMsgs.length;
        const unreadByParent = allMsgs.filter((m) => m.senderRole !== "parent" && !m.isRead && !m.deletedAt).length;
        const unreadByTeacher = allMsgs.filter((m) => m.senderRole !== "teacher" && !m.isRead && !m.deletedAt).length;

        enriched.push({
          ...t,
          parentName: parent?.name || "Unknown",
          teacherName: teacher?.name || "Unknown",
          studentName: student?.name || "Unknown",
          studentClassId: student?.classId || null,
          totalMessages,
          unreadByParent,
          unreadByTeacher,
        });
      }
      return enriched;
    } catch (e) {
      if (!isDbUnavailableError(e)) throw e;
      return memoryMessageThreads
        .filter((t) => t.schoolId === filters.schoolId)
        .filter((t) => !filters.parentUserId || t.parentUserId === filters.parentUserId)
        .filter((t) => !filters.teacherUserId || t.teacherUserId === filters.teacherUserId)
        .filter((t) => !filters.status || t.status === filters.status);
    }
  }

  async getMessageThread(id: string, schoolId: string): Promise<any | undefined> {
    try {
      const db = getDb();
      const [thread] = await db.select().from(schema.messageThreads).where(
        and(eq(schema.messageThreads.id, id), eq(schema.messageThreads.schoolId, schoolId))
      );
      if (!thread) return undefined;

      const [parent] = await db.select({ name: schema.users.name, email: schema.users.email }).from(schema.users).where(eq(schema.users.id, thread.parentUserId));
      const [teacher] = await db.select({ name: schema.users.name, email: schema.users.email }).from(schema.users).where(eq(schema.users.id, thread.teacherUserId));
      const [student] = await db.select().from(schema.students).where(eq(schema.students.id, thread.studentId));

      return {
        ...thread,
        parentName: parent?.name || "Unknown",
        parentEmail: parent?.email || null,
        teacherName: teacher?.name || "Unknown",
        teacherEmail: teacher?.email || null,
        studentName: student?.name || "Unknown",
        studentClassId: student?.classId || null,
      };
    } catch (e) {
      if (!isDbUnavailableError(e)) throw e;
      return memoryMessageThreads.find((t) => t.id === id && t.schoolId === schoolId);
    }
  }

  async createMessageThread(thread: schema.InsertMessageThread): Promise<schema.MessageThread> {
    try {
      return await insertAndFetchById(schema.messageThreads, thread);
    } catch (e) {
      if (!isDbUnavailableError(e)) throw e;
      const created: schema.MessageThread = {
        id: randomUUID(),
        ...thread,
        status: thread.status || "open",
        lastMessageAt: now(),
        closedBy: null,
        closedAt: null,
        createdAt: now(),
        updatedAt: now(),
      };
      memoryMessageThreads.push(created);
      return created;
    }
  }

  async updateThreadStatus(id: string, status: string, closedBy?: string, schoolId?: string): Promise<schema.MessageThread | undefined> {
    try {
      const updates: any = { status, updatedAt: new Date() };
      if (status === "closed" || status === "archived") {
        updates.closedBy = closedBy || null;
        updates.closedAt = new Date();
      } else if (status === "open") {
        updates.closedBy = null;
        updates.closedAt = null;
      }
      const conditions = schoolId
        ? and(eq(schema.messageThreads.id, id), eq(schema.messageThreads.schoolId, schoolId))
        : eq(schema.messageThreads.id, id);
      const [updated] = await getDb().update(schema.messageThreads).set(updates).where(conditions!).returning();
      return updated;
    } catch (e) {
      if (!isDbUnavailableError(e)) throw e;
      const t = memoryMessageThreads.find((t) => t.id === id);
      if (t) { t.status = status; t.updatedAt = now(); }
      return t;
    }
  }

  async getMessages(threadId: string, schoolId: string): Promise<schema.Message[]> {
    try {
      return await getDb().select().from(schema.messages).where(
        and(
          eq(schema.messages.threadId, threadId),
          eq(schema.messages.schoolId, schoolId),
        )
      ).orderBy(schema.messages.createdAt);
    } catch (e) {
      if (!isDbUnavailableError(e)) throw e;
      return memoryMessages.filter((m) => m.threadId === threadId && m.schoolId === schoolId);
    }
  }

  async createMessage(msg: schema.InsertMessage): Promise<schema.Message> {
    try {
      const created = await insertAndFetchById(schema.messages, msg);
      // Update thread lastMessageAt
      await getDb().update(schema.messageThreads).set({ lastMessageAt: new Date(), updatedAt: new Date() })
        .where(eq(schema.messageThreads.id, msg.threadId));
      return created;
    } catch (e) {
      if (!isDbUnavailableError(e)) throw e;
      const created: schema.Message = {
        id: randomUUID(),
        ...msg,
        isRead: false,
        createdAt: now(),
        editedAt: null,
        deletedAt: null,
      };
      memoryMessages.push(created);
      const t = memoryMessageThreads.find((t) => t.id === msg.threadId);
      if (t) { t.lastMessageAt = now(); t.updatedAt = now(); }
      return created;
    }
  }

  async markMessagesRead(threadId: string, readerUserId: string, schoolId: string): Promise<void> {
    try {
      // Mark all messages NOT sent by the reader as read
      await getDb().update(schema.messages)
        .set({ isRead: true })
        .where(
          and(
            eq(schema.messages.threadId, threadId),
            eq(schema.messages.schoolId, schoolId),
            sql`${schema.messages.senderUserId} != ${readerUserId}`,
            eq(schema.messages.isRead, false),
          )
        );
    } catch (e) {
      if (!isDbUnavailableError(e)) throw e;
      for (const m of memoryMessages) {
        if (m.threadId === threadId && m.schoolId === schoolId && m.senderUserId !== readerUserId) {
          m.isRead = true;
        }
      }
    }
  }

  async getUnreadCount(userId: string, schoolId: string): Promise<number> {
    try {
      const db = getDb();
      // Find all threads this user is part of
      const threads = await db.select({ id: schema.messageThreads.id }).from(schema.messageThreads).where(
        and(
          eq(schema.messageThreads.schoolId, schoolId),
          sql`(${schema.messageThreads.parentUserId} = ${userId} OR ${schema.messageThreads.teacherUserId} = ${userId})`,
        )
      );
      if (threads.length === 0) return 0;
      const threadIds = threads.map((t) => t.id);
      const unread = await db.select({ id: schema.messages.id }).from(schema.messages).where(
        and(
          eq(schema.messages.schoolId, schoolId),
          sql`${schema.messages.threadId} IN (${sql.join(threadIds.map(id => sql`${id}`), sql`, `)})`,
          sql`${schema.messages.senderUserId} != ${userId}`,
          eq(schema.messages.isRead, false),
          sql`${schema.messages.deletedAt} IS NULL`,
        )
      );
      return unread.length;
    } catch (e) {
      if (!isDbUnavailableError(e)) throw e;
      return memoryMessages.filter(
        (m) => m.schoolId === schoolId && m.senderUserId !== userId && !m.isRead && !m.deletedAt
      ).length;
    }
  }

  async createMessageAuditLog(log: schema.InsertMessageAuditLog): Promise<schema.MessageAuditLog> {
    try {
      return await insertAndFetchById(schema.messageAuditLogs, log);
    } catch (e) {
      if (!isDbUnavailableError(e)) throw e;
      const created: schema.MessageAuditLog = {
        id: randomUUID(),
        ...log,
        reason: log.reason ?? null,
        threadId: log.threadId ?? null,
        createdAt: now(),
      };
      return created;
      }
  }
}

// In-memory stores for messaging (memory fallback)
const memoryMessageThreads: schema.MessageThread[] = [];
const memoryMessages: schema.Message[] = [];

// ── Startup storage-mode detection ────────────────────────────────────
if (FORCE_MEMORY_STORAGE) {
  _storageMode = "memory";
  console.warn("[STORAGE] ⚠ Memory storage forced — FORCE_MEMORY_STORAGE=true (development only).");
  ensureDemoUsersInMemory();
} else if (RESOLVED_DATABASE_URL) {
  _storageMode = "database";
  console.log("[STORAGE] ✓ Database storage active (DATABASE_URL is set).");
} else if (MEMORY_ALLOWED) {
  _storageMode = "memory";
  console.warn("[STORAGE] ⚠ Memory storage active — ALLOW_MEMORY_STORAGE=true (development only).");
  ensureDemoUsersInMemory();
} else if (IS_PRODUCTION) {
  console.error("[STORAGE] ✗ FATAL: No DATABASE_URL in production. Server cannot start safely.");
  process.exit(1);
} else {
  console.error(
    "[STORAGE] ✗ No DATABASE_URL and ALLOW_MEMORY_STORAGE is not 'true'. " +
    "Set DATABASE_URL or ALLOW_MEMORY_STORAGE=true in .env to continue."
  );
  process.exit(1);
}

export const storage = new DatabaseStorage();
