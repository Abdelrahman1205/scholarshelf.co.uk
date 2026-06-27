/**
 * server/routes/index.ts
 *
 * Registers all API route domains onto the Express app.
 * Each domain is isolated in its own file under server/routes/.
 *
 * Routes are registered in the same order as the original routes.ts
 * to preserve Express route-matching precedence.
 */
import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage, getStorageMode } from "../storage.js";
import { registerAuthRoutes } from "./auth.routes.js";
import { registerSetupRoutes } from "./setup.routes.js";
import { registerBookRoutes } from "./book.routes.js";
import { registerStudentRoutes } from "./student.routes.js";
import { registerParentRoutes } from "./parent.routes.js";
import { registerPaymentRoutes } from "./payment.routes.js";
import { registerAllocationRoutes } from "./allocation.routes.js";
import { registerUserRoutes } from "./user.routes.js";
import { registerMessageRoutes } from "./message.routes.js";
import { registerNotificationRoutes } from "./notification.routes.js";
import { registerOwnerRoutes } from "./owner.routes.js";
import { registerDashboardRoutes } from "./dashboard.routes.js";
import bcrypt from "bcryptjs";

export async function registerRoutes(
  httpServer: Server,
  app: Express,
): Promise<Server> {
  // Auth — login, register, invite acceptance, password reset, /me
  registerAuthRoutes(app);

  // Admin setup checklist + school branding (public + admin + owner)
  registerSetupRoutes(app);

  // Books, classes, students, book levels, class-book-level assignments
  registerBookRoutes(app);

  // Linking codes + student bulk import
  registerStudentRoutes(app);

  // Parent portal: link children, baskets, payments, messages
  registerParentRoutes(app);

  // Finance: payment confirmation, rejection, review
  registerPaymentRoutes(app);

  // Allocations + teacher book distribution + extra-copy requests
  registerAllocationRoutes(app);

  // Users, admin user management, invites
  registerUserRoutes(app);

  // Messaging (parent ↔ teacher) + payment webhook
  registerMessageRoutes(app);

  // Notifications summary + admin communications view
  registerNotificationRoutes(app);

  // === SEED DATA (development only) ===
  if (process.env.NODE_ENV !== "production") {
  app.post("/api/seed-users", async (_req, res) => {
    try {
      // ── 1. Create demo school ──────────────────────────────────
      let demoSchool = (await storage.getSchools()).find((s) => s.code === "DEMO-001");
      if (!demoSchool) {
        demoSchool = await storage.createSchool({
          name: "Al-Noor International School",
          code: "DEMO-001",
          status: "active",
          setupStatus: "complete",
          contactEmail: "admin@alnoor.edu.ly",
          contactPhone: "+218-21-555-0100",
          address: "Tripoli, Libya",
          notes: "Demo school for EduCore platform demonstration",
        });
      }
      const schoolId = demoSchool.id;

      // ── 2. Create demo users ───────────────────────────────────
      const defaults = [
        { username: "bythub", password: "bythub123", name: "BytHub Platform Owner", role: "owner", email: "owner@bythub.co", status: "active" as const, schoolId: null as string | null },
        { username: "admin", password: "admin123", name: "School Administrator", role: "school_admin", email: "admin@alnoor.edu.ly", status: "active" as const, schoolId },
        { username: "teacher", password: "teacher123", name: "Ms. Fatima Johnson", role: "teacher", email: "teacher@alnoor.edu.ly", status: "active" as const, schoolId },
        { username: "teacher2", password: "teacher123", name: "Mr. Ali Hassan", role: "teacher", email: "ali.hassan@alnoor.edu.ly", status: "active" as const, schoolId },
        { username: "parent", password: "parent123", name: "Ahmed Al-Mansouri", role: "parent", email: "parent@example.com", status: "active" as const, schoolId },
        { username: "it_admin", password: "it123", name: "IT Support", role: "it_personnel", email: "it@alnoor.edu.ly", status: "active" as const, schoolId },
        { username: "finance", password: "finance123", name: "Youssef Al-Baruni", role: "finance", email: "finance@alnoor.edu.ly", status: "active" as const, schoolId },
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
        const studentNames = ["Amelia Carter", "Noah Khan", "Sara Al-Farsi", "Omar Benali", "Layla Hassan"];
        for (const name of studentNames) {
          await storage.createStudent({ name, classId: classItem.id, schoolId });
        }
        students = await storage.getStudents(schoolId);
      }

      // ── 7. Create allocations (with absent demo) ───────────────
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

      const refreshedRequests = teacherUser
        ? await storage.getExtraCopyRequests({ teacherId: teacherUser.id, schoolId })
        : [];
      const refreshedAllocations = await storage.getAllocations(classItem?.id, schoolId);

      res.json({
        message: "Seed completed",
        createdUsers: created,
        demoSchool: { id: demoSchool.id, name: demoSchool.name, code: demoSchool.code },
        summary: {
          hasAbsentAllocation: refreshedAllocations.some((a: any) => a.status === "absent"),
          pendingExtraRequests: refreshedRequests.filter((r: any) => r.status === "pending").length,
          resolvedExtraRequests: refreshedRequests.filter((r: any) => r.status !== "pending").length,
          totalStudents: students.length,
          totalBooks: books.length,
        },
      });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });
  }


  // Owner: support mode, school lifecycle, owner invites, pending setups
  registerOwnerRoutes(app);

  // Admin dashboards, reports, and API catch-all
  registerDashboardRoutes(app);

  return httpServer;
}
