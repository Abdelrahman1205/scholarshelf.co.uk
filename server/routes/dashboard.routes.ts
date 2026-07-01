/**
 * server/routes/dashboard.routes.ts
 *
 * Route handlers: dashboard domain.
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
  isDbUnavailableError,
} from "../middleware/auth.js";


export function registerDashboardRoutes(app: Express): void {

  app.get("/api/admin/book-management-summary", requireRole(...ADMIN_UI_ROLES), async (req, res) => {
    try {
      const requestedSchoolId = typeof req.query.schoolId === "string" ? req.query.schoolId : null;
      const ownerMode = isPlatformOwnerRequest(req);
      const sid = ownerMode ? requestedSchoolId : sessionSchoolId(req);

      const [books, levels, classes, students, payments, allocations] = await Promise.all([
        storage.getBooks(sid),
        storage.getBookLevels(sid),
        storage.getClasses(sid),
        storage.getStudents(sid),
        storage.getPayments(undefined, sid),
        storage.getAllocations(undefined, sid),
      ]);

      const lowStock = books.filter((b) => b.isActive && (b.stockQuantity ?? 0) <= (b.lowStockThreshold ?? 10)).length;
      const pendingPayments = payments.filter((p) => ["pending", "awaiting_reference", "reference_submitted", "needs_review"].includes(p.status!)).length;
      const paidOrders = payments.filter((p) => p.status === "completed" || p.status === "confirmed").length;
      const awaitingCollection = allocations.filter((a: any) => a.status === "allocated").length;
      const completedHandovers = allocations.filter((a: any) => a.status === "received").length;

      res.json({
        schoolId: sid || null,
        books: books.length,
        lowStockBooks: lowStock,
        bookLevels: levels.length,
        classes: classes.length,
        students: students.length,
        orders: payments.length,
        pendingPayments,
        paidOrders,
        awaitingCollection,
        completedHandovers,
      });
    } catch (e: any) {
      res.status(500).json({ message: e.message || "Failed to load book management summary" });
    }
  });

  app.get("/api/owner/dashboard", requireRole(...PLATFORM_OWNER_ROLES), async (req, res) => {
    try {
      const requestedSchoolId = typeof req.query.schoolId === "string" ? req.query.schoolId : null;

      const [schools, users, allStudents, allBaskets, allPayments] = await Promise.all([
        storage.getSchools(),
        storage.getUsers(),
        storage.getStudents(),
        storage.getBaskets(),
        storage.getPayments(),
      ]);

      const scopedSchools = requestedSchoolId ? schools.filter((s) => s.id === requestedSchoolId) : schools;
      const scopedSchoolIds = new Set(scopedSchools.map((s) => s.id));
      const scopedUsers = users.filter((u) => u.schoolId && scopedSchoolIds.has(u.schoolId));

      const invitesBySchool: Record<string, any[]> = {};
      await Promise.all(
        scopedSchools.map(async (school) => {
          invitesBySchool[school.id] = await storage.getInvitesBySchool(school.id);
        }),
      );

      const recentActivityLogs = await storage.getAuditLogs(60);

      let pendingAdminInviteSchools = 0;
      let pendingAdminAcceptanceSchools = 0;
      let setupInProgressSchools = 0;
      let activeSchools = 0;
      let suspendedSchools = 0;
      let pendingInvites = 0;
      let expiredInvites = 0;
      let schoolsNeedingAttention = 0;

      for (const school of scopedSchools) {
        const schoolInvites = (invitesBySchool[school.id] || []).filter((invite) => resolveRole(invite.role) === "school_admin");
        const latestInvite = schoolInvites[0] || null;
        const inviteStatus = deriveInviteStatus(latestInvite);
        const setupStatus = normalizeSchoolSetupStatus(school.setupStatus as string | null | undefined, school.status);
        const hasActiveSchoolAdmin = scopedUsers.some((u) => u.schoolId === school.id && resolveRole(u.role) === "school_admin" && u.status === "active");
        const milestones = setupMilestonesFromState({
          schoolStatus: school.status,
          setupStatus,
          firstAdminInviteStatus: inviteStatus,
          hasActiveSchoolAdmin,
        });

        if (school.status === "active") activeSchools += 1;
        if (school.status === "suspended") suspendedSchools += 1;

        if (setupStatus === "pending_admin_invite" || setupStatus === "school_created" || inviteStatus === "not_invited") {
          pendingAdminInviteSchools += 1;
        }
        if (setupStatus === "pending_admin_acceptance" || inviteStatus === "pending" || inviteStatus === "expired") {
          pendingAdminAcceptanceSchools += 1;
        }
        if (setupStatus === "admin_accepted" || setupStatus === "operational_setup_in_progress") {
          setupInProgressSchools += 1;
        }

        if (inviteStatus === "pending") pendingInvites += 1;
        if (inviteStatus === "expired") expiredInvites += 1;

        if (!milestones.operationalSetupCompleted || school.status !== "active" || inviteStatus === "expired") {
          schoolsNeedingAttention += 1;
        }
      }

      const pendingSetupSchools = scopedSchools.filter((s) => s.status !== "active").length;

      // Platform usage stats (all schools, not scoped)
      const confirmedPayments = allPayments.filter((p) => p.status === "confirmed" || p.status === "completed");
      const totalRevenue = confirmedPayments.reduce((sum, p) => sum + parseFloat(p.totalAmount || "0"), 0);

      res.json({
        totalSchools: scopedSchools.length,
        pendingSetupSchools,
        pendingAdminInviteSchools,
        pendingAdminAcceptanceSchools,
        setupInProgressSchools,
        activeSchools,
        suspendedSchools,
        pendingInvites,
        expiredInvites,
        schoolsNeedingAttention,
        // Platform-wide usage metrics
        totalStudents: allStudents.filter((s) => !s.isArchived).length,
        totalBaskets: allBaskets.length,
        totalConfirmedPayments: confirmedPayments.length,
        totalRevenue: totalRevenue.toFixed(2),
        totalParents: users.filter((u) => u.role === "parent" && u.status === "active").length,
        totalTeachers: users.filter((u) => u.role === "teacher" && u.status === "active").length,
        totalActiveUsers: users.filter((u) => u.status === "active").length,
        recentActivity: recentActivityLogs
          .filter((log) => ["school_created", "school_updated", "school_setup_invite_sent", "school_setup_invite_resent", "support_mode_enter", "support_mode_exit", "invite_accepted", "school_setup_completed"].includes(log.action))
          .slice(0, 12)
          .map((log) => {
            const target = log.target || null;
            let targetLabel = target || "Platform";
            if (target && target.startsWith("school:")) {
              const school = schools.find((item) => item.id === target.slice("school:".length));
              if (school) {
                targetLabel = `${school.name} (${school.code})`;
              }
            }

            return {
              id: log.id,
              action: log.action,
              target,
              targetLabel,
              createdAt: log.createdAt,
              metadata: log.metadata ? JSON.parse(log.metadata) : null,
            };
          }),
      });
    } catch (e: any) {
      res.status(500).json({ message: e.message || "Failed to load owner dashboard" });
    }
  });

  // === ADMIN DASHBOARD SUMMARY (school-scoped) ===
  app.get("/api/admin/dashboard-summary", requireRole(...ADMIN_UI_ROLES), async (req, res) => {
    try {
      const ownerMode = isPlatformOwnerRequest(req);
      const sid = sessionSchoolId(req);

      const [
        books,
        students,
        classes,
        bookLevels,
        classBookLevels,
        linkingCodes,
        payments,
        allocations,
        extraRequests,
      ] = await Promise.all([
        storage.getBooks(sid),
        storage.getStudents(sid),
        storage.getClasses(sid),
        storage.getBookLevels(sid),
        storage.getClassBookLevels(sid),
        storage.getLinkingCodes(sid),
        storage.getPayments(undefined, sid),
        storage.getAllocations(undefined, sid),
        storage.getExtraCopyRequests({ schoolId: sid }),
      ]);

      const scopedBooks = !ownerMode && !sid ? books.filter((b) => !b.schoolId) : books;
      const scopedStudents = !ownerMode && !sid ? students.filter((s) => !s.schoolId) : students;
      const scopedClasses = !ownerMode && !sid ? classes.filter((c) => !c.schoolId) : classes;
      const scopedBookLevels = !ownerMode && !sid ? bookLevels.filter((b) => !b.schoolId) : bookLevels;
      const scopedClassBookLevels = !ownerMode && !sid ? classBookLevels.filter((c: any) => !c.class?.schoolId) : classBookLevels;
      const scopedLinkingCodes = !ownerMode && !sid ? linkingCodes.filter((c) => !c.schoolId) : linkingCodes;
      const scopedPayments = !ownerMode && !sid ? payments.filter((p) => !p.schoolId) : payments;
      const scopedAllocations = !ownerMode && !sid ? allocations.filter((a: any) => !a.schoolId) : allocations;
      const scopedExtraRequests = !ownerMode && !sid ? extraRequests.filter((r: any) => !r.schoolId) : extraRequests;
      const setupState = sid ? await getSchoolSetupState(sid) : null;

      const lowStockBooks = scopedBooks.filter(
        (b) => b.isActive && (b.stockQuantity ?? 0) < (b.lowStockThreshold ?? 10)
      ).length;

      const parentCodesGenerated = scopedLinkingCodes.length;
      const parentCodesUsed = scopedLinkingCodes.filter((c) => c.isUsed).length;
      const parentCodesNotSent = scopedLinkingCodes.filter((c) => !c.isUsed).length;
      // Approximate parents linked via used linking codes
      const parentsLinked = parentCodesUsed;

      const pendingPayments = scopedPayments.filter((p) => ["pending", "awaiting_reference", "reference_submitted", "needs_review"].includes(p.status!)).length;
      const paymentsSubmitted = scopedPayments.length;
      const paymentsVerified = scopedPayments.filter((p) => p.status === "completed" || p.status === "confirmed").length;

      const allocatedItems = scopedAllocations.filter((a: any) => a.status === "allocated");
      const readyForDistribution = allocatedItems.length;
      const teacherConfirmationsPending = allocatedItems.length;

      const extraCopyRequestsPending = scopedExtraRequests.filter((r: any) => r.status === "pending").length;

      const setupChecklist = setupState
        ? {
            schoolProfileComplete: setupState.checklist.schoolProfileComplete,
            brandingDesignConfigured: setupState.checklist.brandingDesignConfigured,
            classesCreated: setupState.checklist.classesCreated,
            booksAdded: setupState.checklist.booksAdded,
            bookLevelsCreated: setupState.checklist.bookLevelsCreated,
            bookLevelsAssignedToClasses: setupState.checklist.bookLevelsAssignedToClasses,
            studentsAdded: setupState.checklist.studentsAdded,
            parentCodesGenerated: setupState.checklist.parentCodesGenerated,
            parentsLinked: setupState.checklist.parentsLinked,
            paymentSetupReviewed: setupState.checklist.paymentSetupReviewed,
            operationalSetupComplete: setupState.checklist.operationalSetupComplete,
          }
        : {
            schoolProfileComplete: true,
            brandingDesignConfigured: false,
            classesCreated: scopedClasses.length > 0,
            booksAdded: scopedBooks.length > 0,
            bookLevelsCreated: scopedBookLevels.length > 0,
            bookLevelsAssignedToClasses: scopedClassBookLevels.length > 0,
            studentsAdded: scopedStudents.length > 0,
            parentCodesGenerated: parentCodesGenerated > 0,
            parentsLinked: parentCodesUsed > 0,
            paymentSetupReviewed: scopedClasses.length > 0 && scopedBooks.length > 0 && scopedClassBookLevels.length > 0 && scopedStudents.length > 0 && parentCodesGenerated > 0,
            operationalSetupComplete: false,
          };

      const setupDoneCount = Object.values(setupChecklist).filter(Boolean).length;
      const setupTotalCount = 11;
      const setupPercent = Math.round((setupDoneCount / setupTotalCount) * 100);

      res.json({
        school: setupState
          ? {
              id: setupState.school.id,
              name: setupState.school.name,
              code: setupState.school.code,
              status: setupState.school.status,
              setupStatus: setupState.setupStatus,
            }
          : null,
        totalBooks: scopedBooks.length,
        lowStockBooks,
        totalStudents: scopedStudents.length,
        parentsLinked,
        parentCodesNotSent,
        pendingPayments,
        paymentsSubmitted,
        paymentsVerified,
        readyForDistribution,
        teacherConfirmationsPending,
        extraCopyRequestsPending,
        totalClasses: scopedClasses.length,
        totalBookLevels: scopedBookLevels.length,
        totalLinkingCodes: parentCodesGenerated,
        setupMissingSteps: setupState?.missingSteps || [],
        setupNextAction: setupState?.nextRecommendedAction || null,
        setupProgress: {
          done: setupDoneCount,
          total: setupTotalCount,
          percent: setupPercent,
        },
        setupChecklist,
      });
    } catch (e: any) {
      console.error("Dashboard summary error:", e);
      // Return safe fallback data for any error so the dashboard still renders
      return res.json({
        totalBooks: 0,
        lowStockBooks: 0,
        totalStudents: 0,
        parentsLinked: 0,
        parentCodesNotSent: 0,
        pendingPayments: 0,
        paymentsSubmitted: 0,
        paymentsVerified: 0,
        readyForDistribution: 0,
        teacherConfirmationsPending: 0,
        extraCopyRequestsPending: 0,
        totalClasses: 0,
        totalBookLevels: 0,
        totalLinkingCodes: 0,
        school: null,
        setupMissingSteps: [],
        setupNextAction: null,
        setupProgress: {
          done: 1,
          total: 10,
          percent: 10,
        },
        setupChecklist: {
          schoolProfileComplete: true,
          classesCreated: false,
          booksAdded: false,
          bookLevelsCreated: false,
          bookLevelsAssignedToClasses: false,
          studentsAdded: false,
          parentCodesGenerated: false,
          parentsLinked: false,
          paymentSetupReviewed: false,
          operationalSetupComplete: false,
          schoolProfileCompleted: true,
          bookBundlesCreated: false,
          bundlesAssignedToClasses: false,
        },
        _error: e.message || "Failed to load dashboard data",
      });
    }
  });

  // === RECENT ACTIVITY (school-scoped audit log) ===
  app.get("/api/admin/recent-activity", requireRole(...ADMIN_UI_ROLES), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      const logs = await storage.getAuditLogs(100);

      if (isPlatformOwnerRequest(req)) {
        return res.json(logs.slice(0, 20));
      }

      if (!sid) {
        const own = logs.filter((log) => log.userId === req.session.userId);
        return res.json(own.slice(0, 20));
      }

      const users = await storage.getUsers();
      const userIdsInTenant = new Set(
        users
          .filter((u) => u.schoolId === sid)
          .map((u) => u.id),
      );

      const filtered = logs.filter((log) => {
        if (!log.userId) return false;
        return userIdsInTenant.has(log.userId);
      });

      res.json(filtered.slice(0, 20));
    } catch (e: any) {
      console.error("Recent activity error:", e);
      if (isDbUnavailableError(e)) {
        return res.json([]);
      }
      res.status(500).json({ message: "Failed to load recent activity" });
    }
  });

  // === REPORTS (school-scoped operational reports) ===

  app.get("/api/admin/reports", requireRole(...ADMIN_UI_ROLES), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);

      const [
        books,
        students,
        classes,
        bookLevels,
        classBookLevels,
        linkingCodes,
        payments,
        allocations,
        extraRequests,
        users,
        inventoryTx,
      ] = await Promise.all([
        storage.getBooks(sid),
        storage.getStudents(sid),
        storage.getClasses(sid),
        storage.getBookLevels(sid),
        storage.getClassBookLevels(sid),
        storage.getLinkingCodes(sid),
        storage.getPayments(undefined, sid),
        storage.getAllocations(undefined, sid),
        storage.getExtraCopyRequests({ schoolId: sid }),
        storage.getUsers(),
        storage.getInventoryTransactions(sid),
      ]);

      // Scope users to this school
      const schoolUsers = sid ? users.filter((u) => u.schoolId === sid) : users;

      // ── Inventory report ──
      const activeBooks = books.filter((b) => b.isActive);
      const totalStockValue = activeBooks.reduce((sum, b) => sum + (b.stockQuantity ?? 0) * Number(b.price ?? 0), 0);
      const lowStockBooks = activeBooks.filter((b) => (b.stockQuantity ?? 0) < (b.lowStockThreshold ?? 10));
      const outOfStockBooks = activeBooks.filter((b) => (b.stockQuantity ?? 0) === 0);

      // ── Payment report ──
      const paymentsByStatus = {
        awaiting_reference: payments.filter((p) => p.status === "awaiting_reference" || p.status === "pending"),
        reference_submitted: payments.filter((p) => p.status === "reference_submitted"),
        confirmed: payments.filter((p) => p.status === "confirmed" || p.status === "completed"),
        rejected: payments.filter((p) => p.status === "rejected" || p.status === "failed"),
        needs_review: payments.filter((p) => p.status === "needs_review"),
      };
      const totalRevenue = paymentsByStatus.confirmed.reduce((sum, p) => sum + Number(p.totalAmount ?? 0), 0);
      const pendingRevenue = [...paymentsByStatus.awaiting_reference, ...paymentsByStatus.reference_submitted, ...paymentsByStatus.needs_review].reduce((sum, p) => sum + Number(p.totalAmount ?? 0), 0);

      // ── Allocation / distribution report ──
      const allocationsByStatus = {
        allocated: allocations.filter((a: any) => a.status === "allocated"),
        confirmed: allocations.filter((a: any) => a.status === "received"),
        absent: allocations.filter((a: any) => a.status === "absent"),
      };

      // ── Extra copy request report ──
      const requestsByStatus = {
        pending: extraRequests.filter((r: any) => r.status === "pending"),
        approved: extraRequests.filter((r: any) => r.status === "approved"),
           rejected: extraRequests.filter((r: any) => r.status === "rejected"),
      };
      const requestsByReason: Record<string, number> = {};
      for (const r of extraRequests) {
        const reason = (r as any).reason || "OTHER";
        requestsByReason[reason] = (requestsByReason[reason] || 0) + 1;
      }

      // ── Class distribution report ──
      const classReport = classes.map((cls) => {
        const clsStudents = students.filter((s) => s.classId === cls.id);
        const clsAllocations = allocations.filter((a: any) => a.student?.classId === cls.id);
        const clsConfirmed = clsAllocations.filter((a: any) => a.status === "received");
        return {
          id: cls.id,
          name: cls.name,
          grade: cls.academicYear,
          studentCount: clsStudents.length,
          totalAllocations: clsAllocations.length,
          confirmedAllocations: clsConfirmed.length,
          completionRate: clsAllocations.length > 0
            ? Math.round((clsConfirmed.length / clsAllocations.length) * 100)
            : 0,
        };
      });

      // ── User report ──
      const usersByRole: Record<string, number> = {};
      for (const u of schoolUsers) {
        const role = u.role || "unknown";
        usersByRole[role] = (usersByRole[role] || 0) + 1;
      }

      // ── Parent linking report ──
      const codesTotal = linkingCodes.length;
      const codesUsed = linkingCodes.filter((c) => c.isUsed).length;
      const codesUnused = codesTotal - codesUsed;

      res.json({
        generatedAt: new Date().toISOString(),
        inventory: {
          totalBooks: books.length,
          activeBooks: activeBooks.length,
          totalStockUnits: activeBooks.reduce((s, b) => s + (b.stockQuantity ?? 0), 0),
          totalStockValue: Math.round(totalStockValue * 100) / 100,
          lowStockBooks: lowStockBooks.map((b) => ({ id: b.id, title: b.title, stock: b.stockQuantity, threshold: b.lowStockThreshold })),
          outOfStockCount: outOfStockBooks.length,
          recentTransactions: inventoryTx.slice(0, 20).map((t) => ({ id: t.id, bookId: t.bookId, type: t.transactionType, quantity: t.quantity, reason: t.reason, createdAt: t.createdAt })),
        },
        payments: {
          total: payments.length,
          awaitingReference: paymentsByStatus.awaiting_reference.length,
          referenceSubmitted: paymentsByStatus.reference_submitted.length,
          confirmed: paymentsByStatus.confirmed.length,
          rejected: paymentsByStatus.rejected.length,
          needsReview: paymentsByStatus.needs_review.length,
          totalRevenue: Math.round(totalRevenue * 100) / 100,
          pendingRevenue: Math.round(pendingRevenue * 100) / 100,
        },
        allocations: {
          total: allocations.length,
          allocated: allocationsByStatus.allocated.length,
          confirmed: allocationsByStatus.confirmed.length,
          absent: allocationsByStatus.absent.length,
          confirmationRate: allocations.length > 0
            ? Math.round((allocationsByStatus.confirmed.length / allocations.length) * 100)
            : 0,
        },
        extraCopyRequests: {
          total: extraRequests.length,
          pending: requestsByStatus.pending.length,
          approved: requestsByStatus.approved.length,
          rejected: requestsByStatus.rejected.length,
          byReason: requestsByReason,
        },
        classes: {
          total: classes.length,
          details: classReport,
        },
        students: {
          total: students.length,
        },
        users: {
          total: schoolUsers.length,
          byRole: usersByRole,
        },
        parentLinking: {
          totalCodes: codesTotal,
          used: codesUsed,
          unused: codesUnused,
          linkRate: codesTotal > 0 ? Math.round((codesUsed / codesTotal) * 100) : 0,
        },
        bookLevels: {
          total: bookLevels.length,
          assignedToClasses: classBookLevels.length,
        },
      });
    } catch (e: any) {
      console.error("Reports endpoint error:", e);
      res.status(500).json({ message: "Failed to generate reports" });
    }
  });

  // ── API catch-all: return JSON 404 for unknown /api routes ──
  app.all("/api/*path", (_req: Request, res: Response) => {
    res.status(404).json({ message: "API endpoint not found" });
  });

}
