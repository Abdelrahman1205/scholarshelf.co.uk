/**
 * server/routes/book.routes.ts
 *
 * Route handlers: book domain.
 * Extracted from routes.ts monolith.
 */
import type { Express, Request, Response, NextFunction } from "express";
import { storage } from "../storage.js";
import {
  requireAuth, requireRole,
  sessionSchoolId, isInSupportMode, isPlatformOwnerRequest, isPlatformOwnerRole,
  getActiveRequestContext, resolveRole,
  auditLog, rateLimit,
  routeParam, normalizeEmail, normalizeSchoolCode, extractSupportReason,
  PLATFORM_OWNER_ROLES, ADMIN_UI_ROLES, FINANCE_ROLES,
  BRANDING_VIEW_PERMISSION, BRANDING_MANAGE_PERMISSION,
  BRANDING_UPLOAD_LOGO_PERMISSION, BRANDING_UPDATE_THEME_PERMISSION, BRANDING_RESET_DEFAULT_PERMISSION,
  COMPLETE_SETUP_STATUSES, CONTEXT_DEFAULT_PATHS,
  safeUser, buildAuthUserResponse, syncSessionActiveContext, getUserAccessProfile,
  getPublicBaseUrl, toEmailSafeLogoUrl, parseDataUriImage, getEmailBrandingForSchool,
  splitInviteToken, resolveInviteByToken, acceptInviteToken,
  generateLinkingCode, generatePaymentReference,
  roleBadge, formatUserForAdmin,
  getScopedAdminUsers, canManageUser, enforceRoleUpdateGuards,
  getSchoolSetupState, setupMilestonesFromState, deriveInviteStatus, nextOwnerAction,
  normalizeSchoolSetupStatus, SCHOOL_SETUP_STEP_LABELS,
  brandingUpload, runSingleBrandingUpload,
  canViewBranding, canManageBranding, canManageBrandingOperation, resolveTenantBranding,
  getBrandingPermissionSet,
} from "../middleware/auth.js";


export function registerBookRoutes(app: Express): void {
  app.post("/api/books", requireRole(...ADMIN_UI_ROLES), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      const book = await storage.createBook({ ...req.body, schoolId: sid });
      res.status(201).json(book);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.patch("/api/books/:id", requireRole(...ADMIN_UI_ROLES), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      const book = await storage.updateBook(routeParam(req.params.id), req.body, sid);
      if (!book) return res.status(404).json({ message: "Book not found" });
      res.json(book);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.delete("/api/books/:id", requireRole(...ADMIN_UI_ROLES), async (req, res) => {
    const sid = sessionSchoolId(req);
    await storage.deleteBook(routeParam(req.params.id), sid);
    res.status(204).send();
  });

  app.get("/api/books/low-stock", requireRole(...ADMIN_UI_ROLES), async (req, res) => {
    const sid = sessionSchoolId(req);
    const books = await storage.getLowStockBooks(sid);
    res.json(books);
  });

  app.get("/api/books/by-isbn/:isbn", requireAuth, async (req, res) => {
    const sid = sessionSchoolId(req);
    const book = await storage.getBookByIsbn(routeParam(req.params.isbn), sid);
    if (!book) return res.status(404).json({ message: "Book not found" });
    res.json(book);
  });

  // Scan book by barcode/bookCode
  app.get("/api/books/scan/:code", requireRole(...ADMIN_UI_ROLES, "teacher"), async (req, res) => {
    const sid = sessionSchoolId(req);
    const book = await storage.getBookByCode(routeParam(req.params.code), sid);
    if (!book) return res.status(404).json({ message: "Book not found for this code" });
    res.json(book);
  });

  // === INVENTORY (school-scoped) ===
  app.post("/api/books/:id/stock", requireRole(...ADMIN_UI_ROLES), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      const { quantity, type, reason } = req.body;
      const book = await storage.adjustStock(routeParam(req.params.id), quantity, type, reason, sid);
      res.json(book);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.get("/api/inventory-transactions", requireRole(...ADMIN_UI_ROLES), async (req, res) => {
    const sid = sessionSchoolId(req);
    const txns = await storage.getInventoryTransactions(sid);
    res.json(txns);
  });

  async function getTeacherAssignedClasses(teacherUserId: string, schoolId?: string | null) {
    if (!schoolId) return [];

    const scopedClasses = await storage.getClasses(schoolId);
    const assignedById = new Map(
      scopedClasses
        .filter((cls) => cls.teacherId === teacherUserId)
        .map((cls) => [cls.id, cls]),
    );

    // Fallback for legacy data where class rows may have mismatched school IDs.
    // We only allow classes that are actually referenced by students in this school.
    const schoolStudents = await storage.getStudents(schoolId);
    const schoolStudentClassIds = new Set(
      schoolStudents
        .map((student) => student.classId)
        .filter((classId): classId is string => !!classId),
    );

    const missingClassIds = Array.from(schoolStudentClassIds).filter((classId) => !assignedById.has(classId));
    if (missingClassIds.length > 0) {
      const allClasses = await storage.getClasses();
      for (const cls of allClasses) {
        if (!schoolStudentClassIds.has(cls.id)) continue;
        if (cls.teacherId !== teacherUserId) continue;
        assignedById.set(cls.id, cls);
      }
    }

    return Array.from(assignedById.values());
  }

  // === CLASSES (school-scoped) ===
  app.get("/api/classes", requireRole(...ADMIN_UI_ROLES, "teacher"), async (req, res) => {
    const sid = sessionSchoolId(req);
    if (getActiveRequestContext(req) === "teacher") {
      const classes = await getTeacherAssignedClasses(req.session.userId!, sid);
      return res.json(classes);
    }
    const classes = await storage.getClasses(sid);
    res.json(classes);
  });

  app.post("/api/classes", requireRole(...ADMIN_UI_ROLES), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      const cls = await storage.createClass({ ...req.body, schoolId: sid });
      res.status(201).json(cls);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.patch("/api/classes/:id", requireRole(...ADMIN_UI_ROLES), async (req, res) => {
    const sid = sessionSchoolId(req);
    const cls = await storage.updateClass(routeParam(req.params.id), req.body, sid);
    if (!cls) return res.status(404).json({ message: "Class not found" });
    res.json(cls);
  });

  app.delete("/api/classes/:id", requireRole(...ADMIN_UI_ROLES), async (req, res) => {
    const sid = sessionSchoolId(req);
    await storage.deleteClass(routeParam(req.params.id), sid);
    res.status(204).send();
  });

  // === STUDENTS (school-scoped) ===
  app.get("/api/students", requireRole(...ADMIN_UI_ROLES, "teacher"), async (req, res) => {
    const sid = sessionSchoolId(req);
    const includeArchived = req.query.includeArchived === "true";
    const students = await storage.getStudents(sid, includeArchived);
    if (getActiveRequestContext(req) === "teacher") {
      const classes = await getTeacherAssignedClasses(req.session.userId!, sid);
      const assignedClassIds = new Set(classes.filter((cls) => cls.teacherId === req.session.userId).map((cls) => cls.id));
      return res.json(students.filter((student) => student.classId && assignedClassIds.has(student.classId)));
    }
    res.json(students);
  });

  app.post("/api/students", requireRole(...ADMIN_UI_ROLES), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);

      if (sid) {
        const classes = await storage.getClasses(sid);
        if (classes.length === 0) {
          return res.status(409).json({ message: "Create at least one class before adding students." });
        }
      }

      const student = await storage.createStudent({ ...req.body, schoolId: sid });
      res.status(201).json(student);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.patch("/api/students/:id", requireRole(...ADMIN_UI_ROLES), async (req, res) => {
    const sid = sessionSchoolId(req);
    const student = await storage.updateStudent(routeParam(req.params.id), req.body, sid);
    if (!student) return res.status(404).json({ message: "Student not found" });
    res.json(student);
  });

  // Soft-delete (archive) a student — preserves allocation/payment history
  app.delete("/api/students/:id", requireRole(...ADMIN_UI_ROLES), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      const user = await storage.getUserById(req.session.userId!);
      await storage.archiveStudent(routeParam(req.params.id), user?.id ?? "system", sid);
      await auditLog(req, "student_archived", `student:${req.params.id}`);
      res.status(204).send();
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  // Restore an archived student
  app.post("/api/students/:id/unarchive", requireRole(...ADMIN_UI_ROLES), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      await storage.unarchiveStudent(routeParam(req.params.id), sid);
      await auditLog(req, "student_unarchived", `student:${req.params.id}`);
      res.status(204).send();
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  // === BOOK LEVELS (school-scoped) ===
  app.get("/api/book-levels", requireRole(...ADMIN_UI_ROLES), async (req, res) => {
    const sid = sessionSchoolId(req);
    const levels = await storage.getBookLevels(sid);
    res.json(levels);
  });

  app.post("/api/book-levels", requireRole(...ADMIN_UI_ROLES), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);

      if (sid) {
        const books = await storage.getBooks(sid);
        if (books.length === 0) {
          return res.status(409).json({ message: "Add books before creating book levels." });
        }
      }

      const level = await storage.createBookLevel({ ...req.body, schoolId: sid });
      res.status(201).json(level);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.patch("/api/book-levels/:id", requireRole(...ADMIN_UI_ROLES), async (req, res) => {
    const sid = sessionSchoolId(req);
    const level = await storage.updateBookLevel(routeParam(req.params.id), req.body, sid);
    if (!level) return res.status(404).json({ message: "Book level not found" });
    res.json(level);
  });

  app.delete("/api/book-levels/:id", requireRole(...ADMIN_UI_ROLES), async (req, res) => {
    const sid = sessionSchoolId(req);
    await storage.deleteBookLevel(routeParam(req.params.id), sid);
    res.status(204).send();
  });

  app.get("/api/book-levels/:id/items", requireRole(...ADMIN_UI_ROLES), async (req, res) => {
    const items = await storage.getBookLevelItems(routeParam(req.params.id));
    res.json(items);
  });

  app.post("/api/book-levels/:id/items", requireRole(...ADMIN_UI_ROLES), async (req, res) => {
    try {
      const item = await storage.addBookLevelItem({ ...req.body, bookLevelId: routeParam(req.params.id) });
      res.status(201).json(item);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.delete("/api/book-level-items/:id", requireRole(...ADMIN_UI_ROLES), async (req, res) => {
    await storage.removeBookLevelItem(routeParam(req.params.id));
    res.status(204).send();
  });

  // === CLASS BOOK LEVELS (school-scoped) ===
  app.get("/api/class-book-levels", requireRole(...ADMIN_UI_ROLES), async (req, res) => {
    const sid = sessionSchoolId(req);
    const cbls = await storage.getClassBookLevels(sid);
    res.json(cbls);
  });

  app.post("/api/class-book-levels", requireRole(...ADMIN_UI_ROLES), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      if (sid) {
        const setupState = await getSchoolSetupState(sid);
        if (!setupState) {
          return res.status(404).json({ message: "School not found" });
        }
        if (!setupState.checklist.bookLevelsCreated) {
          return res.status(409).json({ message: "Create book levels before assigning them to classes." });
        }
      }

      const cbl = await storage.assignClassBookLevel(req.body);
      res.status(201).json(cbl);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.delete("/api/class-book-levels/:id", requireRole(...ADMIN_UI_ROLES), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      await storage.removeClassBookLevel(routeParam(req.params.id), sid);
      res.json({ ok: true });
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  // === LINKING CODES (school-scoped) ===
}
