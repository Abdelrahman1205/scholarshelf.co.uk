/**
 * server/routes/notification.routes.ts
 *
 * Route handlers: notification domain.
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
  PLATFORM_OWNER_ROLES, ADMIN_UI_ROLES, IT_WEBSITE_ROLES, FINANCE_ROLES,
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


export function registerNotificationRoutes(app: Express): void {
  app.get("/api/notifications/summary", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUserById(req.session.userId!);
      if (!user) return res.status(401).json({ message: "Not authenticated" });

      const context = getActiveRequestContext(req);
      const sid = sessionSchoolId(req) || user.schoolId || null;

      const items: Array<{
        key: string;
        label: string;
        count: number;
        href: string;
        severity: "info" | "warning" | "success";
      }> = [];

      const pushItem = (
        key: string,
        label: string,
        count: number,
        href: string,
        severity: "info" | "warning" | "success" = "info",
      ) => {
        const safeCount = Math.max(0, Number(count) || 0);
        if (safeCount > 0) {
          items.push({ key, label, count: safeCount, href, severity });
        }
      };

      if (context === "parent" && sid) {
        const unreadMessages = await storage.getUnreadCount(user.id, sid);
        pushItem("messages", "New messages", unreadMessages, "/parent/messages", "info");

        const baskets = await storage.getBaskets(user.email || user.id, sid);
        const pendingBaskets = baskets.filter((basket: any) => basket.status === "pending").length;
        pushItem("baskets", "Pending baskets", pendingBaskets, "/parent/baskets", "warning");

        const payments = await storage.getPayments(user.email || user.id, sid);
        const readyForCollection = payments.filter((payment: any) => payment.status === "ready_for_collection").length;
        pushItem("collection", "Ready for collection", readyForCollection, "/parent/payments", "success");
      }

      if (context === "teacher" && sid) {
        const unreadMessages = await storage.getUnreadCount(user.id, sid);
        pushItem("messages", "New messages", unreadMessages, "/teacher/messages", "info");

        const pendingDistribution = (await storage.getDistributionsByTeacher(user.id, sid, { status: "pending_distribution" })).length;
        pushItem("distribution_pending", "Books to distribute", pendingDistribution, "/teacher/distribution", "warning");

        const approvedExtraRequests = (await storage.getExtraCopyRequests({
          teacherId: user.id,
          status: "approved",
          schoolId: sid,
        })).length;
        pushItem("extra_requests", "Approved extra requests", approvedExtraRequests, "/teacher/requests", "success");
      }

      if ((context === "admin" || context === "school_admin" || context === "it_personnel") && sid) {
        const communicationThreads = await storage.getMessageThreads({ schoolId: sid, status: "open" });
        const unreadConversations = communicationThreads.filter((thread: any) =>
          (Number(thread.unreadByParent) || 0) + (Number(thread.unreadByTeacher) || 0) > 0
        ).length;
        pushItem("communications", "Unread conversations", unreadConversations, "/admin/communications", "info");

        const pendingRequests = (await storage.getExtraCopyRequests({ status: "pending", schoolId: sid })).length;
        pushItem("extra_requests", "Pending extra requests", pendingRequests, "/admin/requests", "warning");

        const payments = await storage.getPayments(undefined, sid);
        const paymentsToReview = payments.filter((payment: any) =>
          payment.status === "reference_submitted" || payment.status === "needs_review"
        ).length;
        pushItem("payments_review", "Payments to review", paymentsToReview, "/admin/payments", "warning");

        const distributionOverview = await storage.getDistributionOverview(sid);
        pushItem("distribution_issues", "Distribution issues", Number(distributionOverview?.issues) || 0, "/admin/allocations", "warning");
      }

      if (context === "finance" && sid) {
        const payments = await storage.getPayments(undefined, sid);
        const paymentsToReview = payments.filter((payment: any) =>
          payment.status === "reference_submitted" || payment.status === "needs_review"
        ).length;
        pushItem("payments_review", "Payments to review", paymentsToReview, "/finance/review", "warning");

        const awaitingReference = payments.filter((payment: any) =>
          payment.status === "awaiting_reference" || payment.status === "pending"
        ).length;
        pushItem("awaiting_reference", "Awaiting payment reference", awaitingReference, "/finance/payments", "info");
      }

      if ((context === "owner" || context === "platform_admin") && !sid) {
        const schools = await storage.getSchools();
        const pendingSetup = schools.filter((school: any) =>
          school.status === "pending_setup" || school.setupStatus === "pending_admin_invite" || school.setupStatus === "pending_admin_acceptance"
        ).length;
        pushItem("pending_setups", "Schools pending setup", pendingSetup, "/admin/pending-setups", "warning");
      }

      if ((context === "owner" || context === "platform_admin") && sid) {
        const communicationThreads = await storage.getMessageThreads({ schoolId: sid, status: "open" });
        const unreadConversations = communicationThreads.filter((thread: any) =>
          (Number(thread.unreadByParent) || 0) + (Number(thread.unreadByTeacher) || 0) > 0
        ).length;
        pushItem("communications", "Unread conversations", unreadConversations, "/admin/communications", "info");
      }

      items.sort((a, b) => b.count - a.count);
      const totalUnread = items.reduce((sum, item) => sum + item.count, 0);

      res.json({
        context,
        totalUnread,
        items,
        updatedAt: new Date().toISOString(),
      });
    } catch (e: any) {
      res.status(500).json({ message: e.message || "Failed to load notifications" });
    }
  });

  // ── School Admin communication oversight ────────────────────
  app.get("/api/admin/communications", requireRole(...ADMIN_UI_ROLES, ...IT_WEBSITE_ROLES), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      if (!sid) return res.json([]);
      const statusFilter = typeof req.query.status === "string" ? req.query.status : undefined;
      const threads = await storage.getMessageThreads({ schoolId: sid, status: statusFilter });
      res.json(threads);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/admin/communications/:threadId", requireRole(...ADMIN_UI_ROLES, ...IT_WEBSITE_ROLES), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      if (!sid) return res.status(400).json({ message: "No school context" });
      const thread = await storage.getMessageThread(routeParam(req.params.threadId), sid);
      if (!thread) return res.status(404).json({ message: "Thread not found" });
      const messages = await storage.getMessages(thread.id, sid);
      res.json({ thread, messages });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.patch("/api/admin/communications/:threadId/status", requireRole(...ADMIN_UI_ROLES, ...IT_WEBSITE_ROLES), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      if (!sid) return res.status(400).json({ message: "No school context" });
      const { status } = req.body;
      if (!status || !["open", "closed", "archived"].includes(status)) {
        return res.status(400).json({ message: "Status must be open, closed, or archived" });
      }
      const thread = await storage.updateThreadStatus(routeParam(req.params.threadId), status, req.session.userId, sid);
      if (!thread) return res.status(404).json({ message: "Thread not found" });

      await storage.createMessageAuditLog({
        schoolId: sid,
        threadId: thread.id,
        actorUserId: req.session.userId!,
        action: `thread_${status}`,
        reason: req.body.reason || null,
      });

      await auditLog(req, `communication_thread_${status}`, `thread:${thread.id}`);
      res.json(thread);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // ── Owner Support Mode — communications access ─────────────
  // Requires active support mode and creates audit log with reason
  app.get("/api/owner/support/schools/:schoolId/communications", requireRole(...PLATFORM_OWNER_ROLES), async (req, res) => {
    try {
      if (!req.session.supportSchoolId) {
        return res.status(403).json({ message: "Support mode must be active to view school communications" });
      }
      const schoolId = routeParam(req.params.schoolId);
      if (schoolId !== req.session.supportSchoolId) {
        return res.status(403).json({ message: "You can only view communications for the school you are currently supporting" });
      }
      const reason = typeof req.query.reason === "string" ? req.query.reason : "Support access — viewing communications";
      await storage.createMessageAuditLog({
        schoolId,
        threadId: null,
        actorUserId: req.session.userId!,
        action: "owner_support_view_threads",
        reason,
      });
      await auditLog(req, "support_view_communications", `school:${schoolId}`, { reason });

      const threads = await storage.getMessageThreads({ schoolId });
      res.json(threads);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/owner/support/communications/:threadId", requireRole(...PLATFORM_OWNER_ROLES), async (req, res) => {
    try {
      if (!req.session.supportSchoolId) {
        return res.status(403).json({ message: "Support mode must be active to view conversations" });
      }
      const threadId = routeParam(req.params.threadId);
      const thread = await storage.getMessageThread(threadId, req.session.supportSchoolId);
      if (!thread) return res.status(404).json({ message: "Thread not found" });

      const reason = typeof req.query.reason === "string" ? req.query.reason : "Support access — viewing thread";
      await storage.createMessageAuditLog({
        schoolId: req.session.supportSchoolId,
        threadId,
        actorUserId: req.session.userId!,
        action: "owner_support_view_thread",
        reason,
      });
      await auditLog(req, "support_view_thread", `thread:${threadId}`, { reason });

      const messages = await storage.getMessages(thread.id, req.session.supportSchoolId);
      res.json({ thread, messages });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

}
