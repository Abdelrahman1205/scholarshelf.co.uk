import { eq, and, lt, desc, sql, inArray } from "drizzle-orm";
// NOTE: getAllocations uses batched inArray lookups (no N+1).
import { drizzle } from "drizzle-orm/neon-http";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { neon } from "@neondatabase/serverless";
import { Pool } from "pg";
import { buildSslConfig } from "./config/database.js";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import * as schema from "../shared/schema.js";
import { currentAcademicYear } from "../shared/academic-year.js";
import {
  isValidCustodyStatus, isTransitionAllowed, CustodyTransitionError,
  deriveCustodyFromLegacy, type CustodyStatus,
} from "./custody.js";

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

/**
 * A transaction-capable handle.
 *
 * `getDb()` above is the Neon serverless HTTP driver. It cannot open an
 * interactive transaction: every statement is its own round trip, so a sequence
 * of statements through it is a sequence, not an atomic unit. Anything that must
 * either all happen or not happen — settlement, in particular — runs through
 * this pooled node-postgres handle instead.
 */
let _txPool: Pool | null = null;
// Deliberately loosely typed. Drizzle's node-postgres generics instantiated over
// a 41-table schema push `tsc` from seconds to minutes; the queries run through
// it below are the same ones the rest of this file runs through the typed handle.
let _txDb: any = null;
function getTxDb(): any {
  if (_txDb) return _txDb;
  if (!RESOLVED_DATABASE_URL) throw new Error("No DATABASE_URL configured");
  _txPool = new Pool({ connectionString: RESOLVED_DATABASE_URL, ssl: buildSslConfig(RESOLVED_DATABASE_URL) });
  // `drizzlePg` is called through an `any` cast on purpose. Inferring its return
  // type over a 36-table schema makes `tsc` take minutes — which would also make
  // the CI type-check step useless. The queries below are the same ones the rest
  // of this file runs through the typed handle.
  _txDb = (drizzlePg as any)(_txPool, { schema });
  return _txDb;
}

/** Postgres serialization failure / deadlock — safe to retry the whole transaction. */
function isRetryableTxError(e: unknown): boolean {
  const code = (e as { code?: string } | null)?.code;
  return code === "40001" || code === "40P01";
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
    console.warn(
      "[STORAGE] ⚠ Falling back to in-memory storage (development only). " +
      "It starts empty — create the accounts you need."
    );
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

// Helper: build a school-scoped WHERE condition
function schoolFilter<T extends { schoolId: any }>(table: T, schoolId?: string | null) {
  if (typeof schoolId === "string") {
    return eq(table.schoolId, schoolId);
  }
  return undefined; // no filter for the platform owner (null schoolId)
}

export interface IStorage {
  // Schools (owner-managed tenants)
  getSchools(): Promise<schema.School[]>;
  getSchoolById(id: string): Promise<schema.School | undefined>;
  getSchoolByCode(code: string): Promise<schema.School | undefined>;
  createSchool(school: schema.InsertSchool): Promise<schema.School>;
  updateSchool(id: string, school: Partial<Omit<schema.School, "id">>): Promise<schema.School | undefined>;
  deleteSchool(id: string): Promise<void>;

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
  generateBookCopies(opts: { bookId: string; schoolId: string; quantity: number; academicYear?: string | null }): Promise<schema.BookCopy[]>;
  getBookCopies(bookId: string, schoolId?: string | null): Promise<schema.BookCopy[]>;
  getBookCopyByCode(copyCode: string, schoolId?: string | null): Promise<schema.BookCopy | undefined>;
  getBookCopyCounts(bookId: string, schoolId?: string | null): Promise<Record<string, number>>;
  updateBookCopy(id: string, patch: Partial<schema.InsertBookCopy>, schoolId?: string | null): Promise<schema.BookCopy | undefined>;
  getInventoryTransactions(schoolId?: string | null): Promise<schema.BookInventoryTransaction[]>;

  // Classes
  getClasses(schoolId?: string | null): Promise<schema.Class[]>;
  createClass(c: schema.InsertClass): Promise<schema.Class>;
  updateClass(id: string, c: Partial<schema.InsertClass>, schoolId?: string | null): Promise<schema.Class | undefined>;
  getSubjects(schoolId?: string | null): Promise<schema.Subject[]>;
  createSubject(s: schema.InsertSubject): Promise<schema.Subject>;
  deleteSubject(id: string, schoolId?: string | null): Promise<void>;
  getClassTeacherAssignments(schoolId: string, opts?: { classId?: string; teacherId?: string; activeOnly?: boolean }): Promise<schema.ClassTeacherAssignment[]>;
  createClassTeacherAssignment(a: schema.InsertClassTeacherAssignment): Promise<schema.ClassTeacherAssignment>;
  updateClassTeacherAssignment(id: string, patch: Partial<schema.InsertClassTeacherAssignment>, schoolId?: string | null): Promise<schema.ClassTeacherAssignment | undefined>;
  deleteClassTeacherAssignment(id: string, schoolId?: string | null): Promise<void>;
  getAssignedClassIdsForTeacher(teacherId: string, schoolId?: string | null): Promise<string[]>;
  deleteClass(id: string, schoolId?: string | null): Promise<void>;

  // Students
  getStudents(schoolId?: string | null): Promise<schema.Student[]>;
  getStudentsByClass(classId: string, schoolId?: string | null): Promise<schema.Student[]>;
  getStudentsByFamily(familyId: string, schoolId?: string | null): Promise<schema.Student[]>;
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
  useLinkingCode(code: string, parentIdentifier: string): Promise<{ student?: schema.Student; students?: schema.Student[]; linkingCode: schema.ChildLinkingCode; isFamily?: boolean } | null>;
  // Slice 2: explicit guardian↔portal-user link
  linkGuardiansToUser(email: string, userId: string): Promise<number>;
  backfillGuardianUserIds(schoolId: string): Promise<number>;
  // Family management
  getFamilies(schoolId?: string | null): Promise<(schema.Family & { students?: schema.Student[] })[]>;
  getFamilyById(id: string): Promise<(schema.Family & { students?: schema.Student[] }) | undefined>;
  createFamily(data: schema.InsertFamily): Promise<schema.Family>;
  updateFamily(id: string, data: Partial<schema.InsertFamily>): Promise<schema.Family | undefined>;
  deleteFamily(id: string): Promise<void>;
  addStudentToFamily(familyId: string, studentId: string): Promise<void>;
  removeStudentFromFamily(familyId: string, studentId: string): Promise<void>;

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
  updatePaymentByReference(reference: string, updates: { externalPaymentStatus?: string; notes?: string }): Promise<schema.BookPayment | null>;
  getPaymentsByReference(reference: string): Promise<schema.BookPayment[]>;
  claimProviderPayment(
    orderId: string,
    providerPaymentId: string,
    providerStatus: string | null,
    schoolId?: string | null,
  ): Promise<{ claimed: boolean; heldByAnotherOrder: boolean }>;
  claimWebhookEvent(source: string, eventId: string): Promise<boolean>;
  completeWebhookEvent(source: string, eventId: string, status: string, detail?: string): Promise<void>;

  // Allocations
  getAllocations(classId?: string, schoolId?: string | null): Promise<any[]>;
  createAllocation(allocation: schema.InsertAllocation): Promise<schema.FinanceBookAllocation>;
  // Slice 4: book-custody state machine
  recordCustodyTransition(allocationId: string, to: string, opts?: { actorUserId?: string | null; actorRole?: string | null; note?: string | null; schoolId?: string | null }): Promise<{ changed: boolean; from: string; to: string }>;
  getCustodyEvents(allocationId: string): Promise<schema.CustodyEvent[]>;
  backfillCustodyStatus(schoolId: string): Promise<number>;
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
  markDistributionOutOfStock(allocationId: string, teacherId: string, schoolId: string): Promise<schema.FinanceBookAllocation>;
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

  // === School Website CMS ===
  getWebsiteSections(schoolId: string, publishedOnly?: boolean): Promise<schema.SchoolWebsiteSection[]>;
  createWebsiteSection(data: schema.InsertSchoolWebsiteSection): Promise<schema.SchoolWebsiteSection>;
  updateWebsiteSection(id: string, schoolId: string, data: Partial<schema.InsertSchoolWebsiteSection>): Promise<schema.SchoolWebsiteSection>;
  deleteWebsiteSection(id: string, schoolId: string): Promise<void>;
  moveWebsiteSection(id: string, schoolId: string, direction: "up" | "down"): Promise<void>;
  getUserPermissions(userId: string): Promise<string[]>;
  addUserPermission(userId: string, permission: string): Promise<void>;
  removeUserPermission(userId: string, permission: string): Promise<void>;
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

  async getSchoolByCode(code: string): Promise<schema.School | undefined> {
    try {
      const [school] = await getDb().select().from(schema.schools).where(eq(schema.schools.code, code));
      return school;
    } catch (e) {
      if (!isDbUnavailableError(e)) throw e;
      return Array.from(memorySchools.values()).find((s) => s.code === code);
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

  // `deleteSchoolAndRelatedData()` was REMOVED on 3 September 2026.
  //
  // It performed a long sequence of independent DELETE statements with no
  // transaction — audit finding 5.6, Critical: a failure partway through left a
  // tenant half-erased, with broken relationships and nothing to roll back to.
  //
  // It was not repaired, because it had no callers. Its only entry point was the
  // owner console's whole-tenant wipe route, removed in Phase A. Making
  // dormant destructive code transactional would have made it safer to run
  // without making it any less dormant — and left a whole-tenant wipe sitting in
  // the storage layer waiting for someone to wire it back up.
  //
  // Tenant erasure is a real requirement (GDPR Art. 17) and it still needs
  // building. When it is, it belongs in the school lifecycle with the cooldown,
  // the audit trail and the completeness proof the audit's section 6 asks for —
  // not as a single method that deletes 23 tables in a guessed order.

  // === BRANDING & PERMISSIONS ===

  // === School Website CMS ===

  async getWebsiteSections(schoolId: string, publishedOnly = false): Promise<schema.SchoolWebsiteSection[]> {
    const conditions = [eq(schema.schoolWebsiteSections.schoolId, schoolId)];
    if (publishedOnly) conditions.push(eq(schema.schoolWebsiteSections.isPublished, true));
    return getDb().select().from(schema.schoolWebsiteSections)
      .where(and(...conditions))
      .orderBy(schema.schoolWebsiteSections.sortOrder, schema.schoolWebsiteSections.createdAt);
  }

  async createWebsiteSection(data: schema.InsertSchoolWebsiteSection): Promise<schema.SchoolWebsiteSection> {
    // Append at the end of the current ordering.
    const existing = await this.getWebsiteSections(data.schoolId);
    const maxOrder = existing.reduce((m, s) => Math.max(m, s.sortOrder ?? 0), -1);
    return insertAndFetchById(schema.schoolWebsiteSections, { ...data, sortOrder: maxOrder + 1 });
  }

  async updateWebsiteSection(id: string, schoolId: string, data: Partial<schema.InsertSchoolWebsiteSection>): Promise<schema.SchoolWebsiteSection> {
    const [existing] = await getDb().select().from(schema.schoolWebsiteSections)
      .where(and(eq(schema.schoolWebsiteSections.id, id), eq(schema.schoolWebsiteSections.schoolId, schoolId)));
    if (!existing) throw new Error("Section not found");
    return updateAndFetchFirst(
      schema.schoolWebsiteSections,
      eq(schema.schoolWebsiteSections.id, id),
      { ...data, updatedAt: new Date() },
    );
  }

  async deleteWebsiteSection(id: string, schoolId: string): Promise<void> {
    const [existing] = await getDb().select().from(schema.schoolWebsiteSections)
      .where(and(eq(schema.schoolWebsiteSections.id, id), eq(schema.schoolWebsiteSections.schoolId, schoolId)));
    if (!existing) throw new Error("Section not found");
    await getDb().delete(schema.schoolWebsiteSections).where(eq(schema.schoolWebsiteSections.id, id));
  }

  async moveWebsiteSection(id: string, schoolId: string, direction: "up" | "down"): Promise<void> {
    const sections = await this.getWebsiteSections(schoolId);
    const idx = sections.findIndex((s) => s.id === id);
    if (idx === -1) throw new Error("Section not found");
    const swapWith = direction === "up" ? idx - 1 : idx + 1;
    if (swapWith < 0 || swapWith >= sections.length) return; // already at edge
    const a = sections[idx], b = sections[swapWith];
    await getDb().update(schema.schoolWebsiteSections).set({ sortOrder: b.sortOrder }).where(eq(schema.schoolWebsiteSections.id, a.id));
    await getDb().update(schema.schoolWebsiteSections).set({ sortOrder: a.sortOrder }).where(eq(schema.schoolWebsiteSections.id, b.id));
  }

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

  /**
   * Grant one permission. Idempotent — the table has a unique index on
   * (user_id, permission), so re-granting is a no-op rather than a duplicate.
   * Mirrors addSecondaryRole(), which stores its own entries in this same table.
   */
  async addUserPermission(userId: string, permission: string): Promise<void> {
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

  /** Revoke one permission, leaving the user's other permissions untouched. */
  async removeUserPermission(userId: string, permission: string): Promise<void> {
    try {
      await getDb().delete(schema.userPermissions).where(and(
        eq(schema.userPermissions.userId, userId),
        eq(schema.userPermissions.permission, permission),
      ));
    } catch (e) {
      if (!isDbUnavailableError(e)) throw e;
      const set = memoryUserPermissions.get(userId);
      if (set) { set.delete(permission); memoryUserPermissions.set(userId, set); }
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

  // ── Book copies (per-physical-copy tracking) ──────────────────────────────
  private luhnCheck(numStr: string): number {
    let sum = 0, alt = false;
    for (let i = numStr.length - 1; i >= 0; i--) {
      let d = numStr.charCodeAt(i) - 48;
      if (alt) { d *= 2; if (d > 9) d -= 9; }
      sum += d; alt = !alt;
    }
    return (10 - (sum % 10)) % 10;
  }

  async generateBookCopies(opts: { bookId: string; schoolId: string; quantity: number; academicYear?: string | null }): Promise<schema.BookCopy[]> {
    const qty = Math.max(1, Math.min(2000, Math.floor(Number(opts.quantity) || 0)));
    const db = getDb();
    // Per-school running serial so copy codes are unique and human-readable.
    const [row] = await db
      .select({ max: sql<number>`COALESCE(MAX(${schema.bookCopies.copyNumber}), 0)` })
      .from(schema.bookCopies)
      .where(eq(schema.bookCopies.schoolId, opts.schoolId));
    const base = Number(row?.max) || 0;
    const values: schema.InsertBookCopy[] = [];
    for (let i = 1; i <= qty; i++) {
      const n = base + i;
      const padded = String(n).padStart(6, "0");
      values.push({
        schoolId: opts.schoolId,
        bookId: opts.bookId,
        copyNumber: n,
        copyCode: `SSC-${padded}-${this.luhnCheck(padded)}`,
        status: "in_stock",
        academicYear: opts.academicYear ?? null,
      } as schema.InsertBookCopy);
    }
    return await db.insert(schema.bookCopies).values(values).returning();
  }

  async getBookCopies(bookId: string, schoolId?: string | null): Promise<schema.BookCopy[]> {
    const conditions = [eq(schema.bookCopies.bookId, bookId)];
    const sf = schoolFilter(schema.bookCopies, schoolId);
    if (sf) conditions.push(sf);
    return getDb().select().from(schema.bookCopies).where(and(...conditions)).orderBy(desc(schema.bookCopies.copyNumber));
  }

  async getBookCopyByCode(copyCode: string, schoolId?: string | null): Promise<schema.BookCopy | undefined> {
    const conditions = [eq(schema.bookCopies.copyCode, copyCode)];
    const sf = schoolFilter(schema.bookCopies, schoolId);
    if (sf) conditions.push(sf);
    const [copy] = await getDb().select().from(schema.bookCopies).where(and(...conditions)).limit(1);
    return copy;
  }

  async getBookCopyCounts(bookId: string, schoolId?: string | null): Promise<Record<string, number>> {
    const conditions = [eq(schema.bookCopies.bookId, bookId)];
    const sf = schoolFilter(schema.bookCopies, schoolId);
    if (sf) conditions.push(sf);
    const rows = await getDb()
      .select({ status: schema.bookCopies.status, n: sql<number>`count(*)` })
      .from(schema.bookCopies)
      .where(and(...conditions))
      .groupBy(schema.bookCopies.status);
    const out: Record<string, number> = {};
    for (const r of rows) out[String(r.status)] = Number(r.n) || 0;
    return out;
  }

  async updateBookCopy(id: string, patch: Partial<schema.InsertBookCopy>, schoolId?: string | null): Promise<schema.BookCopy | undefined> {
    const conditions = [eq(schema.bookCopies.id, id)];
    const sf = schoolFilter(schema.bookCopies, schoolId);
    if (sf) conditions.push(sf);
    return updateAndFetchFirst(schema.bookCopies, and(...conditions), { ...patch, updatedAt: new Date() });
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

    const qty = Math.abs(quantity);
    const isDeduction = type === "damage" || type === "allocation";
    const delta = isDeduction ? -qty : qty;

    // Slice 5: ATOMIC read-modify-write. A single guarded UPDATE prevents lost
    // updates / overselling under concurrent adjustments (two simultaneous
    // deductions can't both read the same starting stock and each write it back).
    // For deductions the WHERE guard rejects dropping below zero.
    const whereClause = isDeduction
      ? and(eq(schema.books.id, bookId), sql`${schema.books.stockQuantity} >= ${qty}`)
      : eq(schema.books.id, bookId);
    const [updated] = await getDb()
      .update(schema.books)
      .set({ stockQuantity: sql`${schema.books.stockQuantity} + ${delta}` })
      .where(whereClause)
      .returning();
    if (!updated) {
      // Book exists (checked above), so a missing row here means the guard failed.
      throw new Error("Stock cannot go below zero");
    }

    const newQty = updated.stockQuantity ?? 0;
    await getDb().insert(schema.bookInventoryTransactions).values({
      bookId,
      transactionType: type,
      quantity,
      previousQuantity: newQty - delta,
      newQuantity: newQty,
      reason,
    });

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

  // ── Subjects ──────────────────────────────────────────────────────────────
  async getSubjects(schoolId?: string | null): Promise<schema.Subject[]> {
    const filter = schoolFilter(schema.subjects, schoolId);
    return filter
      ? getDb().select().from(schema.subjects).where(filter).orderBy(schema.subjects.name)
      : getDb().select().from(schema.subjects).orderBy(schema.subjects.name);
  }
  async createSubject(s: schema.InsertSubject): Promise<schema.Subject> {
    return insertAndFetchById(schema.subjects, s);
  }
  async deleteSubject(id: string, schoolId?: string | null): Promise<void> {
    const conditions = [eq(schema.subjects.id, id)];
    const sf = schoolFilter(schema.subjects, schoolId);
    if (sf) conditions.push(sf);
    await getDb().delete(schema.subjects).where(and(...conditions));
  }

  // ── Class ↔ teacher assignments (many-to-many, subject-based) ──────────────
  async getClassTeacherAssignments(schoolId: string, opts?: { classId?: string; teacherId?: string; activeOnly?: boolean }): Promise<schema.ClassTeacherAssignment[]> {
    const conditions: any[] = [eq(schema.classTeacherAssignments.schoolId, schoolId)];
    if (opts?.classId) conditions.push(eq(schema.classTeacherAssignments.classId, opts.classId));
    if (opts?.teacherId) conditions.push(eq(schema.classTeacherAssignments.teacherId, opts.teacherId));
    if (opts?.activeOnly) conditions.push(eq(schema.classTeacherAssignments.isActive, true));
    return getDb().select().from(schema.classTeacherAssignments).where(and(...conditions)).orderBy(desc(schema.classTeacherAssignments.createdAt));
  }
  async createClassTeacherAssignment(a: schema.InsertClassTeacherAssignment): Promise<schema.ClassTeacherAssignment> {
    return insertAndFetchById(schema.classTeacherAssignments, a);
  }
  async updateClassTeacherAssignment(id: string, patch: Partial<schema.InsertClassTeacherAssignment>, schoolId?: string | null): Promise<schema.ClassTeacherAssignment | undefined> {
    const conditions = [eq(schema.classTeacherAssignments.id, id)];
    const sf = schoolFilter(schema.classTeacherAssignments, schoolId);
    if (sf) conditions.push(sf);
    return updateAndFetchFirst(schema.classTeacherAssignments, and(...conditions), patch);
  }
  async deleteClassTeacherAssignment(id: string, schoolId?: string | null): Promise<void> {
    const conditions = [eq(schema.classTeacherAssignments.id, id)];
    const sf = schoolFilter(schema.classTeacherAssignments, schoolId);
    if (sf) conditions.push(sf);
    await getDb().delete(schema.classTeacherAssignments).where(and(...conditions));
  }
  async getAssignedClassIdsForTeacher(teacherId: string, schoolId?: string | null): Promise<string[]> {
    const conditions: any[] = [eq(schema.classTeacherAssignments.teacherId, teacherId), eq(schema.classTeacherAssignments.isActive, true)];
    const sf = schoolFilter(schema.classTeacherAssignments, schoolId);
    if (sf) conditions.push(sf);
    const rows = await getDb().select({ classId: schema.classTeacherAssignments.classId }).from(schema.classTeacherAssignments).where(and(...conditions));
    return Array.from(new Set(rows.map((r) => r.classId)));
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

  async getStudentsByFamily(familyId: string, schoolId?: string | null): Promise<schema.Student[]> {
    const conditions: any[] = [eq(schema.students.familyId, familyId)];
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
        const [student] = code.studentId ? await getDb().select().from(schema.students).where(eq(schema.students.id, code.studentId)) : [undefined];
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
  /**
   * Canonical form of a linking code.
   *
   * Codes are generated uppercase with a dash (ABC-123) and printed on paper, so
   * parents type them by hand — often in lowercase, often with a stray space from
   * a paste. Both lookups below MUST normalise identically: the preview endpoint
   * used to uppercase its input while confirm did not, so a parent could see
   * their own child's name on the preview screen, press Confirm, and be told the
   * code was invalid. Normalising here means no caller can reintroduce that.
   */
  /**
   * What was true about this student when a history row was written.
   *
   * Allocations reach a class only through students.classId, which is
   * overwritten every September. Capturing the class here means a distribution
   * recorded in Year 3 still reads as Year 3 after the child moves to Year 4.
   *
   * Best-effort: if the lookup fails we still write the row, just without the
   * snapshot. Losing a label is acceptable; losing the allocation is not.
   */
  private async snapshotStudentContext(studentId: string | null | undefined): Promise<{
    academicYear: string;
    classIdAtAllocation: string | null;
    classNameAtAllocation: string | null;
    yearGroupAtAllocation: string | null;
  }> {
    const base = {
      academicYear: currentAcademicYear(),
      classIdAtAllocation: null as string | null,
      classNameAtAllocation: null as string | null,
      yearGroupAtAllocation: null as string | null,
    };
    if (!studentId) return base;
    try {
      const [student] = await getDb().select().from(schema.students).where(eq(schema.students.id, studentId));
      if (!student?.classId) return base;
      const [cls] = await getDb().select().from(schema.classes).where(eq(schema.classes.id, student.classId));
      return {
        // Prefer the class's own recorded year over today's date — a class
        // explicitly labelled 2025/26 should stamp that, not the wall clock.
        academicYear: cls?.academicYear?.trim() || base.academicYear,
        classIdAtAllocation: student.classId,
        classNameAtAllocation: cls?.name ?? null,
        yearGroupAtAllocation: cls?.yearGroup ?? student.gradeLevel ?? null,
      };
    } catch {
      return base;
    }
  }

  private normaliseLinkingCode(code: string): string {
    return String(code ?? "").trim().toUpperCase();
  }

  async getLinkingCodeByCode(code: string): Promise<(schema.ChildLinkingCode & { student?: schema.Student; class?: schema.Class; family?: schema.Family & { students?: (schema.Student & { class?: schema.Class })[] } }) | null> {
    const [linkingCode] = await getDb().select().from(schema.childLinkingCodes)
      .where(eq(schema.childLinkingCodes.code, this.normaliseLinkingCode(code)));
    if (!linkingCode) return null;

    // Family code path
    if (linkingCode.familyId) {
      const [family] = await getDb().select().from(schema.families).where(eq(schema.families.id, linkingCode.familyId));
      if (!family) return { ...linkingCode };
      const memberships = await getDb().select().from(schema.familyStudents).where(eq(schema.familyStudents.familyId, linkingCode.familyId));
      const familyStudentsWithClass: (schema.Student & { class?: schema.Class })[] = [];
      for (const m of memberships) {
        const [s] = await getDb().select().from(schema.students).where(eq(schema.students.id, m.studentId));
        if (s) {
          let cls: schema.Class | undefined;
          if (s.classId) [cls] = await getDb().select().from(schema.classes).where(eq(schema.classes.id, s.classId));
          familyStudentsWithClass.push({ ...s, class: cls });
        }
      }
      return { ...linkingCode, family: { ...family, students: familyStudentsWithClass } };
    }

    // Single-student code path
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

  async useLinkingCode(code: string, parentIdentifier: string): Promise<{ student?: schema.Student; students?: schema.Student[]; linkingCode: schema.ChildLinkingCode; isFamily?: boolean } | null> {
    const [linkingCode] = await getDb().select().from(schema.childLinkingCodes).where(
      eq(schema.childLinkingCodes.code, this.normaliseLinkingCode(code))
    );
    if (!linkingCode) return null;

    // SECURITY: Check if already used
    if (linkingCode.isUsed) {
      throw new Error("This linking code has already been used.");
    }

    // SECURITY: Check expiry
    if (linkingCode.expiresAt && new Date(linkingCode.expiresAt) < new Date()) {
      throw new Error("This linking code has expired. Please request a new code from the school.");
    }

    // SECURITY: Check parentEmail
    if (linkingCode.parentEmail && linkingCode.parentEmail.trim() !== "") {
      const codeEmail = linkingCode.parentEmail.trim().toLowerCase();
      const callerEmail = parentIdentifier.trim().toLowerCase();
      if (codeEmail !== callerEmail) {
        throw new Error("This linking code is not assigned to your email address.");
      }
    }

    await getDb().update(schema.childLinkingCodes).set({ isUsed: true, linkedAt: new Date() }).where(eq(schema.childLinkingCodes.id, linkingCode.id));

    // Family code: link all students in the family
    if (linkingCode.familyId) {
      const familyMemberships = await getDb().select().from(schema.familyStudents).where(eq(schema.familyStudents.familyId, linkingCode.familyId));
      const students: schema.Student[] = [];
      for (const m of familyMemberships) {
        const [student] = await getDb().select().from(schema.students).where(eq(schema.students.id, m.studentId));
        if (student) {
          // Skip if already linked to avoid duplicate key error
          const [existing] = await getDb().select().from(schema.parentChildren).where(
            and(eq(schema.parentChildren.parentIdentifier, parentIdentifier), eq(schema.parentChildren.studentId, student.id))
          );
          if (!existing) {
            await getDb().insert(schema.parentChildren).values({ parentIdentifier, studentId: student.id });
          }
          students.push(student);
        }
      }
      return { students, linkingCode: { ...linkingCode, isUsed: true, linkedAt: new Date() }, isFamily: true };
    }

    // Single-child code
    if (!linkingCode.studentId) return null;
    const [student] = await getDb().select().from(schema.students).where(eq(schema.students.id, linkingCode.studentId));
    if (!student) return null;

    const [existing] = await getDb().select().from(schema.parentChildren).where(
      and(eq(schema.parentChildren.parentIdentifier, parentIdentifier), eq(schema.parentChildren.studentId, student.id))
    );
    if (!existing) {
      await getDb().insert(schema.parentChildren).values({ parentIdentifier, studentId: student.id });
    }

    return { student, linkingCode: { ...linkingCode, isUsed: true, linkedAt: new Date() }, isFamily: false };
  }

  /**
   * Slice 2 — explicit guardian↔user link (write-point).
   * When a portal user redeems a linking code, bind that user to any guardian
   * record sharing their email that has no `userId` yet, and flip portal status
   * to "active". Case-insensitive, idempotent (only touches `userId IS NULL`
   * rows, so re-redemption is a no-op). Returns the number of guardians linked.
   */
  async linkGuardiansToUser(email: string, userId: string): Promise<number> {
    const e = (email || "").trim().toLowerCase();
    if (!e || !userId) return 0;
    const rows = await getDb()
      .update(schema.guardians)
      .set({ userId, portalAccessStatus: "active", updatedAt: new Date() })
      .where(
        and(
          sql`lower(${schema.guardians.email}) = ${e}`,
          sql`${schema.guardians.userId} IS NULL`,
        ),
      )
      .returning({ id: schema.guardians.id });
    return rows.length;
  }

  /**
   * Slice 2 — one-time backfill for existing data.
   * For a school, link guardians that still have no `userId` (but do have an
   * email) to an existing parent user with the same email — but ONLY when there
   * is exactly one matching user, so it never guesses on ambiguity. Idempotent
   * and reversible (drop the column to undo). Callers guard per-school so this
   * runs at most once per process. Returns the number of guardians linked.
   */
  async backfillGuardianUserIds(schoolId: string): Promise<number> {
    if (!schoolId) return 0;
    const pending = await getDb()
      .select({ id: schema.guardians.id, email: schema.guardians.email })
      .from(schema.guardians)
      .where(
        and(
          eq(schema.guardians.schoolId, schoolId),
          sql`${schema.guardians.userId} IS NULL`,
          sql`${schema.guardians.email} IS NOT NULL AND ${schema.guardians.email} <> ''`,
        ),
      );
    let linked = 0;
    for (const g of pending) {
      const e = (g.email || "").trim().toLowerCase();
      if (!e) continue;
      const matches = await getDb()
        .select({ id: schema.users.id })
        .from(schema.users)
        .where(and(sql`lower(${schema.users.email}) = ${e}`, eq(schema.users.role, "parent")));
      if (matches.length !== 1) continue; // ambiguous or no match — leave untouched
      await getDb()
        .update(schema.guardians)
        .set({ userId: matches[0].id, portalAccessStatus: "active", updatedAt: new Date() })
        .where(eq(schema.guardians.id, g.id));
      linked++;
    }
    return linked;
  }

  // === FAMILIES ===

  async getFamilies(schoolId?: string | null): Promise<(schema.Family & { students?: schema.Student[] })[]> {
    try {
      const conditions: any[] = [];
      const sf = schoolFilter(schema.families, schoolId);
      if (sf) conditions.push(sf);
      const rows = conditions.length > 0
        ? await getDb().select().from(schema.families).where(and(...conditions))
        : await getDb().select().from(schema.families);
      const result = [];
      for (const family of rows) {
        const memberships = await getDb().select().from(schema.familyStudents).where(eq(schema.familyStudents.familyId, family.id));
        const students: schema.Student[] = [];
        for (const m of memberships) {
          const [s] = await getDb().select().from(schema.students).where(eq(schema.students.id, m.studentId));
          if (s) students.push(s);
        }
        result.push({ ...family, students });
      }
      return result;
    } catch (e) {
      if (!isDbUnavailableError(e)) throw e;
      return [];
    }
  }

  async getFamilyById(id: string): Promise<(schema.Family & { students?: schema.Student[] }) | undefined> {
    const [family] = await getDb().select().from(schema.families).where(eq(schema.families.id, id));
    if (!family) return undefined;
    const memberships = await getDb().select().from(schema.familyStudents).where(eq(schema.familyStudents.familyId, id));
    const students: schema.Student[] = [];
    for (const m of memberships) {
      const [s] = await getDb().select().from(schema.students).where(eq(schema.students.id, m.studentId));
      if (s) students.push(s);
    }
    return { ...family, students };
  }

  async createFamily(data: schema.InsertFamily): Promise<schema.Family> {
    return await insertAndFetchById(schema.families, data);
  }

  async updateFamily(id: string, data: Partial<schema.InsertFamily>): Promise<schema.Family | undefined> {
    return await updateAndFetchFirst(schema.families, eq(schema.families.id, id), data);
  }

  async deleteFamily(id: string): Promise<void> {
    await getDb().delete(schema.families).where(eq(schema.families.id, id));
  }

  async addStudentToFamily(familyId: string, studentId: string): Promise<void> {
    // Idempotent — skip if already a member
    const [existing] = await getDb().select().from(schema.familyStudents).where(
      and(eq(schema.familyStudents.familyId, familyId), eq(schema.familyStudents.studentId, studentId))
    );
    if (!existing) {
      await getDb().insert(schema.familyStudents).values({ familyId, studentId });
    }
  }

  async removeStudentFromFamily(familyId: string, studentId: string): Promise<void> {
    await getDb().delete(schema.familyStudents).where(
      and(eq(schema.familyStudents.familyId, familyId), eq(schema.familyStudents.studentId, studentId))
    );
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

    // Reuse an existing pending basket instead of creating a duplicate —
    // double-clicking "Create Book Basket" must never lead to double payment.
    const [existingPending] = await getDb().select().from(schema.childBookBaskets)
      .where(and(
        eq(schema.childBookBaskets.studentId, studentId),
        eq(schema.childBookBaskets.parentIdentifier, parentIdentifier),
        eq(schema.childBookBaskets.status, "pending"),
      ));
    if (existingPending) return existingPending;

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

    // A basket belongs to the student's academic context at the moment it is
    // created. Prefer the class's recorded academic year over the wall clock.
    const { academicYear } = await this.snapshotStudentContext(studentId);

    const basket = await insertAndFetchById(schema.childBookBaskets, {
      studentId,
      parentIdentifier,
      status: "pending",
      totalAmount: total.toFixed(2),
      schoolId: student.schoolId,
      academicYear,
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

  /**
   * Create a payment claim over one or more baskets.
   *
   * The baskets are checked against the payment's school BEFORE anything is
   * written. Cross-school basket mixing was permitted here: a caller could name
   * a basket from another tenant and it would be linked, paid for, and later
   * settled against the wrong school's books. The composite foreign keys in
   * migrations/006 make that impossible at the database level as well; this is
   * the same rule stated where the user can be given a sensible message.
   */
  async createPayment(payment: schema.InsertBookPayment, basketIds: string[]): Promise<schema.BookPayment> {
    const schoolId = (payment as { schoolId?: string | null }).schoolId;

    if (!schoolId) {
      throw new Error("School context required");
    }

    const baskets = basketIds.length
      ? await getDb().select().from(schema.childBookBaskets)
          .where(inArray(schema.childBookBaskets.id, basketIds))
      : [];

    if (baskets.length !== basketIds.length) {
      throw new Error("One or more baskets in this order no longer exist.");
    }
    for (const basket of baskets) {
      if (basket.schoolId !== schoolId) {
        throw new Error("An order cannot combine baskets from more than one school.");
      }
    }

    // Revenue has to stay attributable to the year it was taken in.
    const created = await insertAndFetchById(schema.bookPayments, {
      academicYear: currentAcademicYear(),
      ...payment,
    } as schema.InsertBookPayment);

    for (const basketId of basketIds) {
      // school_id on the link row is what the composite FKs key off. A NULL here
      // silently disables them (MATCH SIMPLE), so it is always written.
      await getDb().insert(schema.basketPayments).values({ basketId, paymentId: created.id, schoolId });
      await getDb().update(schema.childBookBaskets).set({ status: "paid" }).where(eq(schema.childBookBaskets.id, basketId));
    }
    return created;
  }

  /**
   * Every payment matching a reference, across all schools.
   *
   * `updatePaymentByReference` takes the first row it finds. References are only
   * unique WITHIN a school (`book_payments(school_id, upper(btrim(ref)))`), so a
   * caller that has no school context — the webhook — must check that exactly one
   * school owns the reference before acting on it. Two schools issuing the same
   * reference would otherwise settle the wrong tenant's order.
   */
  async getPaymentsByReference(reference: string): Promise<schema.BookPayment[]> {
    const normalised = String(reference ?? "").trim();
    if (!normalised) return [];
    return getDb().select().from(schema.bookPayments)
      .where(sql`upper(btrim(${schema.bookPayments.paymentReference})) = upper(btrim(${normalised}))`);
  }

  /**
   * Claim a provider transaction for one order.
   *
   * THE INVARIANT: one real-world payment settles one order.
   *
   * It is enforced by the partial unique index on
   * `book_payments.external_payment_id` (migrations/006), not by a check in
   * application code — so two concurrent verification runs cannot both decide
   * they own the same Stripe transaction. Writing the id IS the claim.
   *
   * Note where the constraint deliberately does NOT live:
   * `payment_verification_attempts` is append-only audit history. An order may
   * legitimately be attempted many times — a failed import, a re-run after the
   * provider export is corrected, a finance override — and every one of those
   * attempts records the provider payment it considered. A unique constraint
   * there would forbid the history, not the double-settlement.
   *
   * Returns:
   *   { claimed: true }                          this order now holds it
   *   { claimed: false, heldByAnotherOrder }     someone else got there first
   *
   * Re-claiming the same provider payment for the SAME order succeeds, so a
   * repeated verification run is idempotent rather than an error.
   */
  async claimProviderPayment(
    orderId: string,
    providerPaymentId: string,
    providerStatus: string | null,
    schoolId?: string | null,
  ): Promise<{ claimed: boolean; heldByAnotherOrder: boolean }> {
    const id = String(providerPaymentId ?? "").trim();
    if (!id) return { claimed: false, heldByAnotherOrder: false };

    const conditions = [
      eq(schema.bookPayments.id, orderId),
      sql`(${schema.bookPayments.externalPaymentId} IS NULL
           OR btrim(${schema.bookPayments.externalPaymentId}) = ''
           OR ${schema.bookPayments.externalPaymentId} = ${id})`,
    ];
    const sf = schoolFilter(schema.bookPayments, schoolId);
    if (sf) conditions.push(sf);

    try {
      const [claimed] = await getDb()
        .update(schema.bookPayments)
        .set({
          externalPaymentId: id,
          ...(providerStatus ? { externalPaymentStatus: providerStatus } : {}),
        })
        .where(and(...conditions))
        .returning({ id: schema.bookPayments.id });

      // No row came back: this order already carries a DIFFERENT provider id.
      return { claimed: !!claimed, heldByAnotherOrder: false };
    } catch (e: unknown) {
      // 23505 — the unique index refused it, so another ORDER holds this
      // provider transaction. That is the double-settlement this exists to stop.
      const code = (e as { code?: string } | null)?.code;
      const message = e instanceof Error ? e.message : String(e);
      if (code === "23505" || /book_payments_external_payment_id_unique|duplicate key/i.test(message)) {
        return { claimed: false, heldByAnotherOrder: true };
      }
      throw e;
    }
  }

  /**
   * Claim a webhook delivery. Returns true if this process now owns it, false if
   * it has already been seen — the insert is the lock, so two concurrent
   * deliveries of the same event cannot both win.
   */
  async claimWebhookEvent(source: string, eventId: string): Promise<boolean> {
    const inserted = await getDb()
      .insert(schema.webhookEvents)
      .values({ source, eventId, status: "processing" })
      .onConflictDoNothing({ target: [schema.webhookEvents.source, schema.webhookEvents.eventId] })
      .returning({ id: schema.webhookEvents.id });
    return inserted.length > 0;
  }

  async completeWebhookEvent(source: string, eventId: string, status: string, detail?: string): Promise<void> {
    await getDb().update(schema.webhookEvents)
      .set({ status, detail: detail ?? null, completedAt: new Date() })
      .where(and(
        eq(schema.webhookEvents.source, source),
        eq(schema.webhookEvents.eventId, eventId),
      ));
  }

  async updatePaymentByReference(reference: string, updates: { externalPaymentStatus?: string; notes?: string }): Promise<schema.BookPayment | null> {
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

  /**
   * Settlement. Finance turns a payment claim into a settled position: the order
   * is marked confirmed, every linked basket becomes allocations, and stock moves.
   *
   * This is the product's core money invariant, and all of it happens in ONE
   * SERIALIZABLE transaction. Three things that were wrong here before:
   *
   *   1. It ran on the Neon HTTP driver, which cannot open a transaction. The
   *      status flip, the allocation inserts and the stock deduction were
   *      separate round trips: a failure halfway left a confirmed order with
   *      half its allocations and half its stock movement.
   *   2. Idempotency was a SELECT followed by an UPDATE. Two finance officers
   *      clicking Confirm at the same moment both read "pending", both proceeded,
   *      and the child was allocated twice and the stock deducted twice. The
   *      claim is now a single conditional UPDATE — exactly one caller can win it.
   *   3. `adjustStock` was wrapped in `catch {}`. An out-of-stock book produced a
   *      confirmed order, a real allocation, and no stock movement — books owed
   *      to a child that the school does not have. A stock failure now aborts the
   *      whole settlement and the order stays claimable.
   *
   * SERIALIZABLE means a concurrent conflicting transaction may be aborted by
   * Postgres with 40001. That is not an error to show a user: it means someone
   * else got there first, so the whole transaction is retried from the top. On
   * the retry the claim-lock finds the order already confirmed and returns it.
   */
  async confirmPayment(paymentId: string, reviewedBy: string, reviewNote?: string, schoolId?: string | null): Promise<schema.BookPayment> {
    // Statuses at or past settlement. Claiming skips them, so a repeated click
    // (or a retry after a serialization failure) is a no-op rather than a
    // second allocation run.
    const ALREADY_PROCESSED = ["confirmed", "ready_for_collection", "collected"];

    for (let attempt = 0; ; attempt++) {
      try {
        return await getTxDb().transaction(async (tx: any) => {
          const conditions = [eq(schema.bookPayments.id, paymentId)];
          const sf = schoolFilter(schema.bookPayments, schoolId);
          if (sf) conditions.push(sf);

          const [existing] = await tx.select().from(schema.bookPayments).where(and(...conditions));
          if (!existing) throw new Error("Payment not found");
          if (ALREADY_PROCESSED.includes(existing.status)) return existing;

          // ── The claim-lock ──────────────────────────────────────────────
          // One conditional UPDATE. Whoever's UPDATE returns a row owns the
          // settlement; a loser gets no row back and returns the order as it
          // now stands. There is no window between the check and the write.
          const [payment] = await tx
            .update(schema.bookPayments)
            .set({
              status: "confirmed",
              confirmedAt: new Date(),
              paymentReviewedAt: new Date(),
              paymentReviewedBy: reviewedBy,
              paymentReviewNote: reviewNote || null,
            })
            .where(and(
              eq(schema.bookPayments.id, paymentId),
              sql`${schema.bookPayments.status} NOT IN ('confirmed', 'ready_for_collection', 'collected')`,
            ))
            .returning();

          if (!payment) {
            const [current] = await tx.select().from(schema.bookPayments).where(eq(schema.bookPayments.id, paymentId));
            return current ?? existing;
          }

          const links = await tx.select().from(schema.basketPayments)
            .where(eq(schema.basketPayments.paymentId, paymentId));

          for (const link of links) {
            const [basket] = await tx.select().from(schema.childBookBaskets)
              .where(eq(schema.childBookBaskets.id, link.basketId));
            if (!basket) continue;

            // TENANT BOUNDARY. A basket linked to this payment must belong to the
            // same school as the payment. If it does not, this is either a bug or
            // an attempt to settle one school's books against another's money —
            // either way the whole settlement is abandoned, not silently skipped.
            if (basket.schoolId !== payment.schoolId) {
              throw new Error(
                `Refusing to settle payment ${paymentId}: basket ${basket.id} belongs to a different school.`,
              );
            }

            const existingAllocs = await tx
              .select({ id: schema.financeBookAllocations.id })
              .from(schema.financeBookAllocations)
              .where(eq(schema.financeBookAllocations.basketId, basket.id));

            if (basket.status === "allocated" || existingAllocs.length > 0) {
              // Already turned into allocations by an earlier partial run — make
              // the basket flag agree and move on without re-deducting stock.
              await tx.update(schema.childBookBaskets)
                .set({ status: "allocated" })
                .where(eq(schema.childBookBaskets.id, basket.id));
              continue;
            }

            await tx.update(schema.childBookBaskets)
              .set({ status: "allocated" })
              .where(eq(schema.childBookBaskets.id, basket.id));

            // Resolved once per basket, not per book — every item in a basket
            // belongs to the same child in the same class on the same day.
            const snapshot = await this.snapshotStudentContextTx(tx, basket.studentId);

            const items = await tx.select().from(schema.basketItems)
              .where(eq(schema.basketItems.basketId, basket.id));

            for (const item of items) {
              await tx.insert(schema.financeBookAllocations).values({
                studentId: basket.studentId,
                bookId: item.bookId,
                basketId: basket.id,
                status: "allocated",
                schoolId: payment.schoolId,
                ...snapshot,
              });
              await this.deductStockTx(
                tx, item.bookId, item.quantity ?? 1, payment.schoolId,
                `Allocated to student via payment ${paymentId}`,
              );
            }
          }

          return payment;
        }, { isolationLevel: "serializable" });
      } catch (e) {
        if (isRetryableTxError(e) && attempt < 3) continue;
        throw e;
      }
    }
  }

  /**
   * Deduct stock inside a caller's transaction.
   *
   * The guarded UPDATE is the same one `adjustStock` uses — `WHERE stock >= qty`
   * so two concurrent deductions cannot both read the same starting figure — but
   * here a failure is allowed to propagate and roll the settlement back.
   */
  private async deductStockTx(
    tx: any, bookId: string, quantity: number, schoolId: string | null, reason: string,
  ): Promise<void> {
    const qty = Math.abs(quantity ?? 1);

    const [book] = await tx.select().from(schema.books).where(eq(schema.books.id, bookId));
    if (!book) throw new Error(`Cannot allocate: book ${bookId} no longer exists.`);
    if (schoolId && book.schoolId && book.schoolId !== schoolId) {
      throw new Error(`Refusing to allocate book ${bookId}: it belongs to a different school.`);
    }

    const [updated] = await tx
      .update(schema.books)
      .set({ stockQuantity: sql`${schema.books.stockQuantity} - ${qty}` })
      .where(and(
        eq(schema.books.id, bookId),
        sql`${schema.books.stockQuantity} >= ${qty}`,
      ))
      .returning();

    if (!updated) {
      throw new Error(
        `Not enough stock of "${book.title}" to complete this order (${qty} needed, ${book.stockQuantity ?? 0} on hand).`,
      );
    }

    const newQty = updated.stockQuantity ?? 0;
    await tx.insert(schema.bookInventoryTransactions).values({
      bookId,
      transactionType: "allocation",
      quantity: qty,
      previousQuantity: newQty + qty,
      newQuantity: newQty,
      reason,
    });
  }

  /** `snapshotStudentContext`, but reading inside a caller's transaction. */
  private async snapshotStudentContextTx(tx: any, studentId: string | null | undefined): Promise<{
    academicYear: string;
    classIdAtAllocation: string | null;
    classNameAtAllocation: string | null;
    yearGroupAtAllocation: string | null;
  }> {
    const base = {
      academicYear: currentAcademicYear(),
      classIdAtAllocation: null as string | null,
      classNameAtAllocation: null as string | null,
      yearGroupAtAllocation: null as string | null,
    };
    if (!studentId) return base;
    const [student] = await tx.select().from(schema.students).where(eq(schema.students.id, studentId));
    if (!student?.classId) return base;
    const [cls] = await tx.select().from(schema.classes).where(eq(schema.classes.id, student.classId));
    return {
      academicYear: cls?.academicYear?.trim() || base.academicYear,
      classIdAtAllocation: student.classId,
      classNameAtAllocation: cls?.name ?? null,
      yearGroupAtAllocation: cls?.yearGroup ?? student.gradeLevel ?? null,
    };
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
    // Idempotent: a repeat call once already ready-for-collection is a no-op.
    if (existing.status === "ready_for_collection") return existing;
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
    // Idempotent: a repeat call once already collected is a no-op.
    if (existing.status === "collected") return existing;
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
    if (allocs.length === 0) return [];

    // Batch-fetch related students, books, and classes (avoids N+1 queries).
    const studentIds = Array.from(new Set(allocs.map((a) => a.studentId).filter(Boolean))) as string[];
    const bookIds = Array.from(new Set(allocs.map((a) => a.bookId).filter(Boolean))) as string[];
    const students = studentIds.length
      ? await getDb().select().from(schema.students).where(inArray(schema.students.id, studentIds))
      : [];
    const books = bookIds.length
      ? await getDb().select().from(schema.books).where(inArray(schema.books.id, bookIds))
      : [];
    const classIds = Array.from(new Set(students.map((s) => s.classId).filter(Boolean))) as string[];
    const classes = classIds.length
      ? await getDb().select().from(schema.classes).where(inArray(schema.classes.id, classIds))
      : [];

    const studentById = new Map(students.map((s) => [s.id, s]));
    const bookById = new Map(books.map((b) => [b.id, b]));
    const classById = new Map(classes.map((c) => [c.id, c]));

    const result = [];
    for (const alloc of allocs) {
      const student = studentById.get(alloc.studentId);
      if (classId && student?.classId !== classId) continue;
      const cls = student?.classId ? classById.get(student.classId) : undefined;
      result.push({
        ...alloc,
        student: student ? { ...student, class: cls } : undefined,
        book: bookById.get(alloc.bookId),
      });
    }
    return result;
  }

  async createAllocation(allocation: schema.InsertAllocation): Promise<schema.FinanceBookAllocation> {
    // Stamp the year and class BEFORE inserting, so the row records what was
    // true at allocation time rather than depending on a join that changes.
    const snapshot = await this.snapshotStudentContext((allocation as any).studentId);
    const created = await insertAndFetchById(schema.financeBookAllocations, {
      ...snapshot,
      ...allocation, // an explicit value from the caller always wins
    } as schema.InsertAllocation);
    // Slice 4: seed the custody timeline with the opening state (null → reserved).
    try {
      await getDb().insert(schema.custodyEvents).values({
        allocationId: created.id,
        schoolId: created.schoolId ?? null,
        fromStatus: null,
        toStatus: created.custodyStatus || "reserved",
        actorUserId: null,
        actorRole: "system",
        note: "allocation created",
      });
    } catch { /* non-fatal: custody log is best-effort at creation */ }
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

  // === CUSTODY (Slice 4) ===

  /**
   * Apply a custody transition and append a custody_event. Strict: an illegal
   * transition throws CustodyTransitionError (callers map to 409). Idempotent:
   * a no-op (same state) returns changed:false and writes nothing.
   */
  async recordCustodyTransition(
    allocationId: string,
    to: string,
    opts: { actorUserId?: string | null; actorRole?: string | null; note?: string | null; schoolId?: string | null } = {},
  ): Promise<{ changed: boolean; from: string; to: string }> {
    const [alloc] = await getDb().select().from(schema.financeBookAllocations).where(eq(schema.financeBookAllocations.id, allocationId));
    if (!alloc) throw new Error("Allocation not found");
    const from = (alloc.custodyStatus || "reserved") as CustodyStatus;
    if (!isValidCustodyStatus(to)) throw new CustodyTransitionError(from, to);
    if (from === to) return { changed: false, from, to };
    if (!isTransitionAllowed(from, to)) throw new CustodyTransitionError(from, to);

    await getDb().update(schema.financeBookAllocations)
      .set({ custodyStatus: to })
      .where(eq(schema.financeBookAllocations.id, allocationId));
    await getDb().insert(schema.custodyEvents).values({
      allocationId,
      schoolId: opts.schoolId ?? alloc.schoolId ?? null,
      fromStatus: from,
      toStatus: to,
      actorUserId: opts.actorUserId ?? null,
      actorRole: opts.actorRole ?? null,
      note: opts.note ?? null,
    });
    return { changed: true, from, to };
  }

  async getCustodyEvents(allocationId: string): Promise<schema.CustodyEvent[]> {
    return await getDb().select().from(schema.custodyEvents)
      .where(eq(schema.custodyEvents.allocationId, allocationId))
      .orderBy(schema.custodyEvents.createdAt);
  }

  /**
   * One-time backfill: seed custody for allocations that have no custody_events
   * yet, deriving the starting state from legacy status/distributionStatus. Rows
   * that already have events are skipped, so app-driven custody is never clobbered
   * — making this safe to re-run. Guarded per-school by the caller.
   */
  async backfillCustodyStatus(schoolId: string): Promise<number> {
    if (!schoolId) return 0;
    const rows = await getDb().select().from(schema.financeBookAllocations)
      .where(eq(schema.financeBookAllocations.schoolId, schoolId));
    let updated = 0;
    for (const r of rows) {
      const [hasEvent] = await getDb().select({ id: schema.custodyEvents.id }).from(schema.custodyEvents)
        .where(eq(schema.custodyEvents.allocationId, r.id)).limit(1);
      if (hasEvent) continue; // already tracked — never overwrite app-driven custody
      const derived = deriveCustodyFromLegacy({ status: r.status, distributionStatus: r.distributionStatus });
      await getDb().update(schema.financeBookAllocations)
        .set({ custodyStatus: derived })
        .where(eq(schema.financeBookAllocations.id, r.id));
      await getDb().insert(schema.custodyEvents).values({
        allocationId: r.id, schoolId, fromStatus: null, toStatus: derived,
        actorUserId: null, actorRole: "system", note: "backfilled from legacy status",
      });
      updated++;
    }
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

    // Approve even if stock adjustment fails (e.g. insufficient stock),
    // but record the failure in adminNotes so it is visible and recoverable
    // instead of silently drifting inventory.
    let stockNote = "";
    try {
      await this.adjustStock(request.bookId, request.quantity, "allocation", `Extra copy request approved: ${request.reason}`);
    } catch (e: any) {
      const reason = e?.message || "unknown error";
      console.warn(`[extra-copy] Stock adjustment failed for request ${id} (book ${request.bookId}, qty ${request.quantity}): ${reason}`);
      stockNote = ` [Stock NOT adjusted: ${reason}. Adjust manually.]`;
    }

    const updated = await updateAndFetchFirst(
      schema.extraCopyRequests,
      eq(schema.extraCopyRequests.id, id),
      { status: "approved", adminNotes: `${adminNotes ?? ""}${stockNote}`.trim() || undefined, resolvedAt: new Date() }
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

  async markDistributionOutOfStock(allocationId: string, teacherId: string, schoolId: string): Promise<schema.FinanceBookAllocation> {
    const [existing] = await getDb().select().from(schema.financeBookAllocations)
      .where(and(eq(schema.financeBookAllocations.id, allocationId), eq(schema.financeBookAllocations.schoolId, schoolId)));
    if (!existing) throw new Error("Allocation not found");

    const updated = await updateAndFetchFirst(
      schema.financeBookAllocations,
      eq(schema.financeBookAllocations.id, allocationId),
      {
        distributionStatus: "out_of_stock",
        issueNote: "Out of stock at distribution",
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
      return Array.from(memoryUsers.values()).find((u) => u.username === username);
    }
  }

  async getUserByEmail(email: string): Promise<schema.User | undefined> {
    try {
      const [user] = await getDb().select().from(schema.users).where(eq(schema.users.email, email));
      return user;
    } catch (e) {
      if (!isDbUnavailableError(e)) throw e;
      return Array.from(memoryUsers.values()).find((u) => u.email === email);
    }
  }

  async getUserById(id: string): Promise<schema.User | undefined> {
    try {
      const [user] = await getDb().select().from(schema.users).where(eq(schema.users.id, id));
      return user;
    } catch (e) {
      if (!isDbUnavailableError(e)) throw e;
      return memoryUsers.get(id);
    }
  }

  async createUser(user: schema.InsertUser): Promise<schema.User> {
    try {
      const created = await insertAndFetchById(schema.users, user);
      return created;
    } catch (e) {
      if (!isDbUnavailableError(e)) throw e;
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
        mfaEnabled: false,
        mfaSecret: null,
        mfaRecoveryCodes: null,
        mfaEnrolledAt: null,
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
        familyId: invite.familyId ?? null,
        relationship: invite.relationship ?? null,
        guardianPermissions: invite.guardianPermissions ?? null,
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
} else if (RESOLVED_DATABASE_URL) {
  _storageMode = "database";
  console.log("[STORAGE] ✓ Database storage active (DATABASE_URL is set).");
} else if (MEMORY_ALLOWED) {
  _storageMode = "memory";
  console.warn("[STORAGE] ⚠ Memory storage active — ALLOW_MEMORY_STORAGE=true (development only).");
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
