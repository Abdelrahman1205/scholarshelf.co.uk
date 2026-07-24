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
import { sendClassBookListUpdatedEmail } from "../email.js";


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

  // ── Book copies (per-physical-copy tracking) ──
  // Generate a batch of individually-coded copies for a title (e.g. on annual intake).
  app.post("/api/books/:id/copies", requireRole(...ADMIN_UI_ROLES), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      if (!sid) return res.status(400).json({ message: "School context required" });
      const bookId = routeParam(req.params.id);
      const book = await storage.getBook(bookId, sid);
      if (!book) return res.status(404).json({ message: "Book not found" });
      const qty = parseInt(req.body?.quantity, 10);
      if (!qty || qty < 1 || qty > 2000) return res.status(400).json({ message: "Enter a quantity between 1 and 2000." });
      const academicYear = typeof req.body?.academicYear === "string" ? req.body.academicYear.slice(0, 20) : null;
      const copies = await storage.generateBookCopies({ bookId, schoolId: sid, quantity: qty, academicYear });
      await auditLog(req, "book_copies_generated", `book:${bookId}`, { quantity: copies.length, academicYear });
      res.status(201).json({ generated: copies.length, copies });
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  // List all copies for a title, plus a status breakdown (in_stock/allocated/sold/…).
  app.get("/api/books/:id/copies", requireRole(...ADMIN_UI_ROLES), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      if (!sid) return res.status(400).json({ message: "School context required" });
      const bookId = routeParam(req.params.id);
      const [copies, counts] = await Promise.all([
        storage.getBookCopies(bookId, sid),
        storage.getBookCopyCounts(bookId, sid),
      ]);
      res.json({ copies, counts });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // Resolve a scanned copy code to its copy + book (used at distribution/sale).
  app.get("/api/book-copies/lookup/:code", requireRole(...ADMIN_UI_ROLES, "teacher"), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      if (!sid) return res.status(400).json({ message: "School context required" });
      const copy = await storage.getBookCopyByCode(routeParam(req.params.code), sid);
      if (!copy) return res.status(404).json({ message: "No book copy found for that code." });
      const book = await storage.getBook(copy.bookId, sid);
      res.json({ copy, book });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // Update a copy's status/condition (mark sold, damaged, lost, …).
  app.patch("/api/book-copies/:id", requireRole(...ADMIN_UI_ROLES), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      if (!sid) return res.status(400).json({ message: "School context required" });
      const allowed = ["status", "condition", "studentId", "paymentId", "notes"] as const;
      const patch: any = {};
      for (const k of allowed) if (k in (req.body || {})) patch[k] = req.body[k];
      if (patch.status === "sold") patch.soldAt = new Date();
      const updated = await storage.updateBookCopy(routeParam(req.params.id), patch, sid);
      if (!updated) return res.status(404).json({ message: "Book copy not found" });
      await auditLog(req, "book_copy_updated", `book-copy:${updated.id}`, { status: updated.status });
      res.json(updated);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  // Confirm-scan at intake: scan a printed label to verify the copy exists and mark it checked.
  app.post("/api/book-copies/verify", requireRole(...ADMIN_UI_ROLES), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      if (!sid) return res.status(400).json({ message: "School context required" });
      const code = typeof req.body?.code === "string" ? req.body.code.trim() : "";
      if (!code) return res.status(400).json({ message: "No code provided." });
      const copy = await storage.getBookCopyByCode(code, sid);
      if (!copy) return res.status(404).json({ result: "unknown", message: "No copy with that code — check the label." });
      if (copy.verifiedAt) return res.json({ result: "already", copy });
      const updated = await storage.updateBookCopy(copy.id, { verifiedAt: new Date() } as any, sid);
      await auditLog(req, "book_copy_verified", `book-copy:${copy.id}`, {});
      res.json({ result: "confirmed", copy: updated });
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

    // New model: also include classes the teacher is ACTIVELY assigned to by
    // subject (class_teacher_assignments), on top of the legacy single teacherId.
    try {
      const assignedIds = await storage.getAssignedClassIdsForTeacher(teacherUserId, schoolId);
      if (assignedIds.length) {
        const byId = new Map(scopedClasses.map((c) => [c.id, c]));
        const need = assignedIds.filter((cid) => !assignedById.has(cid));
        const fallback = need.some((cid) => !byId.has(cid)) ? await storage.getClasses() : [];
        for (const cid of need) {
          const cls = byId.get(cid) || fallback.find((c) => c.id === cid);
          if (cls) assignedById.set(cid, cls);
        }
      }
    } catch { /* assignments are additive — never block legacy access */ }

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

  // === SUBJECTS (school-scoped) ===
  app.get("/api/subjects", requireRole(...ADMIN_UI_ROLES, "teacher"), async (req, res) => {
    const sid = sessionSchoolId(req);
    res.json(await storage.getSubjects(sid));
  });
  app.post("/api/subjects", requireRole(...ADMIN_UI_ROLES), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      const name = typeof req.body?.name === "string" ? req.body.name.trim().slice(0, 80) : "";
      if (!name) return res.status(400).json({ message: "Subject name is required." });
      const existingSubs = await storage.getSubjects(sid);
      if (existingSubs.some((x: any) => (x.name || "").trim().toLowerCase() === name.toLowerCase())) {
        return res.status(409).json({ message: "That subject already exists." });
      }
      const s = await storage.createSubject({ name, schoolId: sid } as any);
      await auditLog(req, "subject_created", `subject:${s.id}`, { name });
      res.status(201).json(s);
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  });
  app.delete("/api/subjects/:id", requireRole(...ADMIN_UI_ROLES), async (req, res) => {
    const sid = sessionSchoolId(req);
    await storage.deleteSubject(routeParam(req.params.id), sid);
    res.status(204).send();
  });

  // === CLASS ↔ TEACHER ASSIGNMENTS (many-to-many, subject-based) ===
  app.get("/api/classes/:id/teacher-assignments", requireRole(...ADMIN_UI_ROLES), async (req, res) => {
    const sid = sessionSchoolId(req);
    if (!sid) return res.status(400).json({ message: "School context required" });
    res.json(await storage.getClassTeacherAssignments(sid, { classId: routeParam(req.params.id) }));
  });
  app.post("/api/classes/:id/teacher-assignments", requireRole(...ADMIN_UI_ROLES), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      if (!sid) return res.status(400).json({ message: "School context required" });
      const classId = routeParam(req.params.id);
      const b = req.body || {};
      if (!b.teacherId) return res.status(400).json({ message: "A teacher is required." });
      // Validate the target is a teacher in THIS school (client dropdown alone isn't trusted).
      const target = await storage.getUserById(b.teacherId);
      if (!target || (target.schoolId && sid && target.schoolId !== sid)) {
        return res.status(400).json({ message: "Teacher not found in this school." });
      }
      const targetRoles = [resolveRole(target.role), ...(await storage.getSecondaryRoles(target.id))];
      if (!targetRoles.includes("teacher")) {
        return res.status(400).json({ message: "That user is not a teacher." });
      }
      // No duplicate active assignment for the same class + subject + teacher.
      const dupes = await storage.getClassTeacherAssignments(sid, { classId, teacherId: b.teacherId, activeOnly: true });
      if (dupes.some((a: any) => (a.subjectId || null) === (b.subjectId || null))) {
        return res.status(409).json({ message: "That teacher is already assigned to this class for this subject." });
      }
      const a = await storage.createClassTeacherAssignment({
        schoolId: sid,
        classId,
        teacherId: b.teacherId,
        subjectId: b.subjectId || null,
        assignmentRole: b.assignmentRole || "Subject Teacher",
        academicYear: b.academicYear || null,
        startDate: b.startDate || null,
        endDate: b.endDate || null,
        isActive: true,
      } as any);
      await auditLog(req, "class_teacher_assigned", `class:${classId}`, { teacherId: b.teacherId, subjectId: b.subjectId });
      res.status(201).json(a);
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  });
  app.patch("/api/class-teacher-assignments/:id", requireRole(...ADMIN_UI_ROLES), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      const allowed = ["subjectId", "teacherId", "assignmentRole", "academicYear", "startDate", "endDate", "isActive"];
      const patch: any = {};
      for (const k of allowed) if (k in (req.body || {})) patch[k] = req.body[k];
      const updated = await storage.updateClassTeacherAssignment(routeParam(req.params.id), patch, sid);
      if (!updated) return res.status(404).json({ message: "Assignment not found" });
      await auditLog(req, "class_teacher_assignment_updated", `assignment:${updated.id}`, { isActive: updated.isActive });
      res.json(updated);
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  });
  app.delete("/api/class-teacher-assignments/:id", requireRole(...ADMIN_UI_ROLES), async (req, res) => {
    const sid = sessionSchoolId(req);
    await storage.deleteClassTeacherAssignment(routeParam(req.params.id), sid);
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

      // Notify the class's assigned teacher that their book list changed (fire-and-forget).
      try {
        const [classes, bookLevels] = await Promise.all([
          storage.getClasses(sid),
          storage.getBookLevels(sid),
        ]);
        const cls = classes.find((c) => c.id === cbl.classId);
        const bundle = bookLevels.find((b) => b.id === cbl.bookLevelId);
        if (cls?.teacherId) {
          const teacher = await storage.getUserById(cls.teacherId);
          if (teacher?.email) {
            sendClassBookListUpdatedEmail(
              teacher.email,
              teacher.name,
              cls.name,
              bundle?.name || "a book bundle",
              await getEmailBrandingForSchool(req, sid),
            ).catch(() => {});
          }
        }
      } catch { /* never block assignment on email */ }

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
