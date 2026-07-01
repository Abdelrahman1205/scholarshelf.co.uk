/**
 * server/routes/allocation.routes.ts
 *
 * Route handlers: allocation domain.
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
  getTeacherAssignedClasses,
} from "../middleware/auth.js";


export function registerAllocationRoutes(app: Express): void {
  app.get("/api/allocations", requireRole(...ADMIN_UI_ROLES, "teacher"), async (req, res) => {
    const sid = sessionSchoolId(req);
    const classId = req.query.classId as string | undefined;
    let allocations = await storage.getAllocations(classId, sid);
    if (getActiveRequestContext(req) === "teacher") {
      const classes = await getTeacherAssignedClasses(req.session.userId!, sid);
      const assignedClassIds = new Set(classes.filter((cls) => cls.teacherId === req.session.userId).map((cls) => cls.id));
      allocations = allocations.filter((allocation: any) => allocation.student?.class?.id && assignedClassIds.has(allocation.student.class.id));
    }
    res.json(allocations);
  });

  app.post("/api/allocations", requireRole(...ADMIN_UI_ROLES), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      if (sid) {
        const setupState = await getSchoolSetupState(sid);
        if (!setupState) {
          return res.status(404).json({ message: "School not found" });
        }
        if (!setupState.operationalSetupComplete) {
          return res.status(409).json({
            message: "Complete school setup before managing allocations.",
            missingSteps: setupState.missingSteps,
          });
        }
      }
      const allocation = await storage.createAllocation({ ...req.body, schoolId: sid });
      res.status(201).json(allocation);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.post("/api/allocations/:id/confirm", requireRole(...ADMIN_UI_ROLES, "teacher"), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      if (sid) {
        const setupState = await getSchoolSetupState(sid);
        if (!setupState) {
          return res.status(404).json({ message: "School not found" });
        }
        if (!setupState.operationalSetupComplete) {
          return res.status(409).json({
            message: "Complete school setup before confirming allocations.",
            missingSteps: setupState.missingSteps,
          });
        }
      }

      if (getActiveRequestContext(req) === "teacher") {
        const classes = await getTeacherAssignedClasses(req.session.userId!, sid);
        const assignedClassIds = new Set(classes.filter((cls) => cls.teacherId === req.session.userId).map((cls) => cls.id));
        const allocations = await storage.getAllocations(undefined, sid);
        const targetAllocation = allocations.find((allocation: any) => allocation.id === routeParam(req.params.id));
        if (!targetAllocation || !targetAllocation.student?.class?.id || !assignedClassIds.has(targetAllocation.student.class.id)) {
          return res.status(403).json({ message: "Access denied" });
        }

        const user = await storage.getUserById(req.session.userId!);
        if (user?.email) {
          const parentLinks = await storage.getParentChildren(user.email);
          const linkedStudentIds = new Set(parentLinks.filter((link) => !sid || link.student?.schoolId === sid).map((link) => link.studentId));
          if (linkedStudentIds.has(targetAllocation.studentId)) {
            await auditLog(req, "teacher_self_child_allocation_blocked", `allocation:${targetAllocation.id}`, {
              studentId: targetAllocation.studentId,
              action: "confirm",
            });
            return res.status(403).json({ message: "A school admin or another authorised teacher must confirm handover for your own linked child." });
          }
        }
      }

      const allocation = await storage.confirmReceipt(routeParam(req.params.id), sid);
      res.json(allocation);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.post("/api/allocations/:id/absent", requireRole(...ADMIN_UI_ROLES, "teacher"), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      if (sid) {
        const setupState = await getSchoolSetupState(sid);
        if (!setupState) {
          return res.status(404).json({ message: "School not found" });
        }
        if (!setupState.operationalSetupComplete) {
          return res.status(409).json({
            message: "Complete school setup before managing allocations.",
            missingSteps: setupState.missingSteps,
          });
        }
      }

      if (getActiveRequestContext(req) === "teacher") {
        const classes = await getTeacherAssignedClasses(req.session.userId!, sid);
        const assignedClassIds = new Set(classes.filter((cls) => cls.teacherId === req.session.userId).map((cls) => cls.id));
        const allocations = await storage.getAllocations(undefined, sid);
        const targetAllocation = allocations.find((allocation: any) => allocation.id === routeParam(req.params.id));
        if (!targetAllocation || !targetAllocation.student?.class?.id || !assignedClassIds.has(targetAllocation.student.class.id)) {
          return res.status(403).json({ message: "Access denied" });
        }

        const user = await storage.getUserById(req.session.userId!);
        if (user?.email) {
          const parentLinks = await storage.getParentChildren(user.email);
          const linkedStudentIds = new Set(parentLinks.filter((link) => !sid || link.student?.schoolId === sid).map((link) => link.studentId));
          if (linkedStudentIds.has(targetAllocation.studentId)) {
            await auditLog(req, "teacher_self_child_allocation_blocked", `allocation:${targetAllocation.id}`, {
              studentId: targetAllocation.studentId,
              action: "absent",
            });
            return res.status(403).json({ message: "A school admin or another authorised teacher must update handover for your own linked child." });
          }
        }
      }

      const allocation = await storage.markAllocationAbsent(routeParam(req.params.id), sid);
      res.json(allocation);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  // === TEACHER-LED BOOK DISTRIBUTION ===

  // Teacher: get distribution list for their assigned classes
  app.get("/api/teacher/book-distribution", requireRole("teacher"), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      if (!sid) return res.status(400).json({ message: "School context required" });
      const filters: { classId?: string; status?: string } = {};
      if (req.query.classId) filters.classId = req.query.classId as string;
      if (req.query.status) filters.status = req.query.status as string;
      const distributions = await storage.getDistributionsByTeacher(req.session.userId!, sid, filters);
      res.json(distributions);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // Teacher: confirm student received book
  app.post("/api/teacher/book-distribution/:id/confirm-received", requireRole("teacher"), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      if (!sid) return res.status(400).json({ message: "School context required" });

      // Teacher-child protection: teachers cannot confirm for their own linked children
      const allocations = await storage.getDistributionsByTeacher(req.session.userId!, sid);
      const target = allocations.find((a: any) => a.id === routeParam(req.params.id));
      if (!target) return res.status(404).json({ message: "Allocation not found or not in your classes" });

      const user = await storage.getUserById(req.session.userId!);
      if (user?.email) {
        const parentLinks = await storage.getParentChildren(user.email);
        const linkedStudentIds = new Set(parentLinks.map((l) => l.studentId));
        if (linkedStudentIds.has(target.studentId)) {
          return res.status(403).json({ message: "Cannot confirm distribution for your own linked child. Another teacher or admin must do this." });
        }
      }

      const result = await storage.confirmDistribution(routeParam(req.params.id), req.session.userId!, sid);
      res.json(result);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  // Teacher: mark student absent
  app.post("/api/teacher/book-distribution/:id/mark-absent", requireRole("teacher"), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      if (!sid) return res.status(400).json({ message: "School context required" });
      const result = await storage.markDistributionAbsent(routeParam(req.params.id), req.session.userId!, sid);
      res.json(result);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  // Teacher: mark allocation out of stock at distribution (spec §8.2)
  app.post("/api/teacher/book-distribution/:id/mark-out-of-stock", requireRole("teacher"), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      if (!sid) return res.status(400).json({ message: "School context required" });
      const result = await storage.markDistributionOutOfStock(routeParam(req.params.id), req.session.userId!, sid);
      await auditLog(req, "distribution_out_of_stock", `allocation:${routeParam(req.params.id)}`);
      res.json(result);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  // Teacher: report issue with distribution
  app.post("/api/teacher/book-distribution/:id/report-issue", requireRole("teacher"), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      if (!sid) return res.status(400).json({ message: "School context required" });
      const { issueNote } = req.body;
      if (!issueNote) return res.status(400).json({ message: "Issue note is required" });
      const result = await storage.reportDistributionIssue(routeParam(req.params.id), req.session.userId!, issueNote, sid);
      res.json(result);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  // Admin: get distribution overview for school
  app.get("/api/admin/book-distribution", requireRole(...ADMIN_UI_ROLES), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      if (!sid) return res.status(400).json({ message: "School context required" });
      const overview = await storage.getDistributionOverview(sid);
      res.json(overview);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // Admin: confirm distribution on behalf
  app.post("/api/admin/book-distribution/:id/confirm", requireRole(...ADMIN_UI_ROLES), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      if (!sid) return res.status(400).json({ message: "School context required" });
      const result = await storage.adminConfirmDistribution(routeParam(req.params.id), sid);
      res.json(result);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  // Admin: update order status on a payment
  app.post("/api/admin/payments/:id/order-status", requireRole(...ADMIN_UI_ROLES), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      const { orderStatus } = req.body;
      if (!orderStatus) return res.status(400).json({ message: "orderStatus is required" });
      const result = await storage.updateOrderStatus(routeParam(req.params.id), orderStatus, sid);
      res.json(result);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  // === EXTRA COPY REQUESTS (school-scoped) ===
  app.get("/api/extra-requests", requireRole(...ADMIN_UI_ROLES, "teacher"), async (req, res) => {
    const sid = sessionSchoolId(req);
    const filters: { teacherId?: string; status?: string; schoolId?: string | null } = { schoolId: sid };
    if (req.query.teacherId) filters.teacherId = req.query.teacherId as string;
    if (req.query.status) filters.status = req.query.status as string;
    // If teacher role, restrict to their own requests
    if (getActiveRequestContext(req) === "teacher") {
      filters.teacherId = req.session.userId!;
    }
    const requests = await storage.getExtraCopyRequests(filters);
    res.json(requests);
  });

  app.post("/api/extra-requests", requireRole("teacher"), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      const request = await storage.createExtraCopyRequest({
        ...req.body,
        teacherId: req.session.userId!,
        schoolId: sid,
      });
      res.status(201).json(request);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.post("/api/extra-requests/:id/approve", requireRole(...ADMIN_UI_ROLES), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      const request = await storage.approveExtraCopyRequest(routeParam(req.params.id), req.body.adminNotes, sid);
      res.json(request);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.post("/api/extra-requests/:id/reject", requireRole(...ADMIN_UI_ROLES), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      const request = await storage.rejectExtraCopyRequest(routeParam(req.params.id), req.body.adminNotes, sid);
      res.json(request);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });
}
