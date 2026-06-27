/**
 * server/routes/payment.routes.ts
 *
 * Route handlers: payment domain.
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

import {
  sendPaymentSubmittedEmail, sendPaymentVerifiedEmail, sendPaymentRejectedEmail,
  isResendConfigured,
} from "../email.js";

export function registerPaymentRoutes(app: Express): void {
  app.get("/api/finance/summary", requireRole(...FINANCE_ROLES), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      const payments = await storage.getPayments(undefined, sid);
      const totalRevenue = payments
        .filter((p) => p.status === "confirmed" || p.status === "completed")
        .reduce((sum, p) => sum + parseFloat(p.totalAmount || "0"), 0);
      const pendingReview = payments.filter((p) => p.status === "reference_submitted").length;
      const awaitingRef = payments.filter((p) => p.status === "awaiting_reference" || p.status === "pending").length;
      const confirmed = payments.filter((p) => p.status === "confirmed" || p.status === "completed").length;
      const rejected = payments.filter((p) => p.status === "rejected" || p.status === "failed").length;
      const needsReview = payments.filter((p) => p.status === "needs_review").length;
      const cancelled = payments.filter((p) => p.status === "cancelled").length;
      const totalOutstanding = payments
        .filter((p) => !["confirmed", "completed", "cancelled", "rejected", "failed"].includes(p.status))
        .reduce((sum, p) => sum + parseFloat(p.totalAmount || "0"), 0);
      res.json({
        totalPayments: payments.length,
        totalRevenue: totalRevenue.toFixed(2),
        totalOutstanding: totalOutstanding.toFixed(2),
        pendingReview,
        awaitingRef,
        confirmed,
        rejected,
        needsReview,
        cancelled,
      });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // === ADMIN PAYMENTS (school-scoped) ===
  app.get("/api/admin/payments", requireRole(...FINANCE_ROLES), async (req, res) => {
    const sid = sessionSchoolId(req);
    const payments = await storage.getPayments(undefined, sid);
    res.json(payments);
  });

  app.post("/api/admin/payments/:id/confirm", requireRole(...FINANCE_ROLES), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      if (sid) {
        const setupState = await getSchoolSetupState(sid);
        if (!setupState) return res.status(404).json({ message: "School not found" });
        if (!setupState.operationalSetupComplete) {
          return res.status(409).json({ message: "Complete school setup before confirming payments.", missingSteps: setupState.missingSteps });
        }
      }
      const { reviewNote } = req.body || {};
      const payment = await storage.confirmPayment(routeParam(req.params.id), req.session.userId!, reviewNote, sid);

      // Update order status to ready_for_teacher_distribution
      try { await storage.updateOrderStatus(payment.id, "ready_for_teacher_distribution", sid); } catch (_) {}

      await storage.createAuditLog({
        action: "payment_confirmed",
        userId: req.session.userId!,
        metadata: `Payment confirmed: id=${payment.id}, ref=${payment.paymentReference}, extRef=${payment.paymentReferenceNumber || "N/A"}`,
      });

      if (payment?.parentIdentifier) {
        const sent = await sendPaymentVerifiedEmail(
          payment.parentIdentifier,
          payment.paymentReference || payment.id,
          payment.totalAmount || "0.00",
          await getEmailBrandingForSchool(req, payment.schoolId),
        );
        if (!sent) {
          console.log(`[PAYMENT CONFIRMED] Parent: ${payment.parentIdentifier}, Ref: ${payment.paymentReference}`);
        }
      }

      res.json(payment);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.post("/api/admin/payments/:id/reject", requireRole(...FINANCE_ROLES), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      if (sid) {
        const setupState = await getSchoolSetupState(sid);
        if (!setupState) return res.status(404).json({ message: "School not found" });
        if (!setupState.operationalSetupComplete) {
          return res.status(409).json({ message: "Complete school setup before processing payments.", missingSteps: setupState.missingSteps });
        }
      }
      const { reviewNote } = req.body || {};
      const payment = await storage.rejectPayment(routeParam(req.params.id), req.session.userId!, reviewNote, sid);

      await storage.createAuditLog({
        action: "payment_rejected",
        userId: req.session.userId!,
        metadata: `Payment rejected: id=${payment.id}, ref=${payment.paymentReference}, reason=${reviewNote || "none"}`,
      });

      if (payment?.parentIdentifier) {
        const sent = await sendPaymentRejectedEmail(
          payment.parentIdentifier,
          payment.paymentReference || payment.id,
          payment.totalAmount || "0.00",
          await getEmailBrandingForSchool(req, payment.schoolId),
        );
        if (!sent) {
          console.log(`[PAYMENT REJECTED] Parent: ${payment.parentIdentifier}, Ref: ${payment.paymentReference}`);
        }
      }

      res.json(payment);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.post("/api/admin/payments/:id/needs-review", requireRole(...FINANCE_ROLES), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      const { reviewNote } = req.body || {};
      const payment = await storage.markPaymentNeedsReview(routeParam(req.params.id), req.session.userId!, reviewNote, sid);

      await storage.createAuditLog({
        action: "payment_needs_review",
        userId: req.session.userId!,
        metadata: `Payment flagged for review: id=${payment.id}, ref=${payment.paymentReference}, note=${reviewNote || "none"}`,
      });

      res.json(payment);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  // === ORDER FULFILMENT STATUS ===
  app.post("/api/admin/payments/:id/ready-for-collection", requireRole(...FINANCE_ROLES), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      const { reviewNote } = req.body || {};
      const payment = await storage.markPaymentReadyForCollection(routeParam(req.params.id), req.session.userId!, reviewNote, sid);

      await storage.createAuditLog({
        action: "payment_ready_for_collection",
        userId: req.session.userId!,
        metadata: `Order marked ready for collection: id=${payment.id}, ref=${payment.paymentReference}`,
      });

      res.json(payment);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.post("/api/admin/payments/:id/collected", requireRole(...FINANCE_ROLES), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      const { reviewNote } = req.body || {};
      const payment = await storage.markPaymentCollected(routeParam(req.params.id), req.session.userId!, reviewNote, sid);

      await storage.createAuditLog({
        action: "payment_collected",
        userId: req.session.userId!,
        metadata: `Order collected: id=${payment.id}, ref=${payment.paymentReference}`,
      });

      res.json(payment);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.post("/api/admin/payments/:id/cancel", requireRole(...FINANCE_ROLES), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      const { reviewNote } = req.body || {};
      const payment = await storage.cancelPayment(routeParam(req.params.id), req.session.userId!, reviewNote, sid);

      await storage.createAuditLog({
        action: "payment_cancelled",
        userId: req.session.userId!,
        metadata: `Order cancelled: id=${payment.id}, ref=${payment.paymentReference}, reason=${reviewNote || "none"}`,
      });

      res.json(payment);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  // === ALLOCATIONS (school-scoped) ===
}
