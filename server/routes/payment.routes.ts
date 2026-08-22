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
  sendBooksReadyForCollectionEmail, sendCollectionCompletedEmail,
  isResendConfigured,
} from "../email.js";
import multer from "multer";
import { getDb } from "../config/database.js";
import {
  StripeSpreadsheetSource, StripeImportError,
  STRIPE_IMPORT_MAX_FILE_BYTES, STRIPE_IMPORT_ALLOWED_EXTENSIONS,
} from "../services/payment-verification/stripe-spreadsheet-importer.js";
import {
  upsertProviderPayments, providerPaymentStats,
} from "../services/payment-verification/provider-payment-repository.js";
import {
  verifyOrder, verifyPendingOrders, flagReversedPayments,
  manuallyVerify, manuallyReject, attemptHistory, latestAttemptsFor,
} from "../services/payment-verification/payment-verification-service.js";

/** Parse stored evidence JSON without ever throwing into a response. */
function safeJson(value: string): unknown {
  try { return JSON.parse(value); } catch { return null; }
}

// ── Stripe export upload ─────────────────────────────────────────────────────
// Financial data arriving as an untrusted file. Buffered in memory ONLY — a
// Stripe export is never written to disk, so there is no path it could later be
// served from. Extension and declared MIME are a first pass; the parser
// re-checks the magic bytes and never evaluates formulas or macros.
const STRIPE_ALLOWED_MIME = new Set([
  "text/csv", "application/csv", "text/plain", "application/octet-stream",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

const stripeUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: STRIPE_IMPORT_MAX_FILE_BYTES, files: 1, fields: 10 },
  fileFilter: (_req, file, cb) => {
    const name = (file.originalname || "").toLowerCase();
    const ext = name.slice(name.lastIndexOf("."));
    if (!(STRIPE_IMPORT_ALLOWED_EXTENSIONS as readonly string[]).includes(ext)) {
      cb(new Error("Only Stripe .csv, .xlsx and .xls exports can be imported."));
      return;
    }
    if (file.mimetype && !STRIPE_ALLOWED_MIME.has(file.mimetype)) {
      cb(new Error(`Unsupported file type "${file.mimetype}".`));
      return;
    }
    cb(null, true);
  },
});

function runStripeUpload(req: Request, res: Response): Promise<void> {
  return new Promise((resolve, reject) => {
    stripeUpload.single("file")(req as any, res as any, (err: unknown) => {
      if (!err) return resolve();
      const message = err instanceof Error ? err.message : "Upload failed";
      reject(Object.assign(new Error(
        message.includes("File too large")
          ? `That file is larger than ${Math.round(STRIPE_IMPORT_MAX_FILE_BYTES / (1024 * 1024))} MB.`
          : message,
      ), { httpStatus: 400 }));
    });
  });
}

export function registerPaymentRoutes(app: Express): void {
  // ── Stripe payment data: import ──
  // FINANCE_ROLES only — the same set that may confirm a payment. Ordinary
  // staff cannot supply the data that drives automatic verification.
  app.post("/api/finance/stripe/import", requireRole(...FINANCE_ROLES), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      if (!sid) return res.status(400).json({ message: "School context required" });
      if (await rateLimit(`stripe-import:${sid}:${req.session.userId}`, 60, 60 * 1000)) {
        return res.status(429).json({ message: "Too many imports. Please slow down." });
      }
      await runStripeUpload(req, res);
      const file = (req as any).file as Express.Multer.File | undefined;
      if (!file?.buffer?.length) return res.status(400).json({ message: "Choose a Stripe export to import." });

      // Stripe amounts are in major units in dashboard exports and in minor
      // units (pence) in some API-generated reports. The uploader states which.
      const minorUnits = String((req as any).body?.minorUnits ?? "") === "true";

      const { source, result } = StripeSpreadsheetSource.fromFile(
        file.buffer, file.originalname || "stripe.csv", { minorUnits },
      );
      const payments = await source.fetchPayments({ schoolId: sid });
      const upsert = await upsertProviderPayments(getDb(), sid, payments, req.session.userId || null);

      // A newly imported payment is usually exactly what a waiting order needed,
      // so re-run the finance stage for everything sitting there. Same
      // verification path as the automatic check on reference submission.
      const sweep = await verifyPendingOrders(sid, { actorUserId: req.session.userId || null });
      // And catch money that has since gone back out.
      const reversals = await flagReversedPayments(sid);

      await auditLog(req, "stripe_payments_imported", `school:${sid}`, {
        filename: file.originalname,
        rowsRead: result.totalRows,
        parsed: payments.length,
        rowErrors: result.errors.length,
        imported: upsert.imported,
        updated: upsert.updated,
        unchanged: upsert.unchanged,
        duplicatesInFile: upsert.duplicatesInFile,
        ordersAutoVerified: sweep.verified,
        ordersToInvestigate: sweep.investigation,
        reversalsFlagged: reversals.flagged,
      });

      res.status(201).json({
        file: { name: file.originalname, rowsRead: result.totalRows },
        transactions: upsert,
        rowErrors: result.errors.slice(0, 50),
        rowErrorCount: result.errors.length,
        verification: {
          ordersExamined: sweep.examined,
          ordersAutoVerified: sweep.verified,
          ordersNeedingInvestigation: sweep.investigation,
        },
        reversalsFlagged: reversals.flagged,
      });
    } catch (e: any) {
      const status = e instanceof StripeImportError ? 400 : (e?.httpStatus || 400);
      res.status(status).json({ message: e?.message || "The Stripe export could not be imported." });
    }
  });

  /** What Stripe data this school currently holds — shown above the import. */
  app.get("/api/finance/stripe/status", requireRole(...FINANCE_ROLES), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      if (!sid) return res.status(400).json({ message: "School context required" });
      res.json(await providerPaymentStats(getDb(), sid));
    } catch (e: any) {
      // Before the migration runs there is no provider table — report "none
      // held" rather than an error, so the finance screen still renders and
      // tells the user to import.
      if (e?.code === "42P01" || /relation "provider_payments" does not exist/i.test(String(e?.message))) {
        return res.json({ total: 0, byStatus: {}, tablesMissing: true });
      }
      res.status(500).json({ message: e.message });
    }
  });

  /** Re-run automatic verification for every order waiting at finance. */
  app.post("/api/finance/verification/run", requireRole(...FINANCE_ROLES), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      if (!sid) return res.status(400).json({ message: "School context required" });
      if (await rateLimit(`verify-sweep:${sid}:${req.session.userId}`, 20, 60 * 1000)) {
        return res.status(429).json({ message: "Too many verification runs. Please slow down." });
      }
      const sweep = await verifyPendingOrders(sid, { actorUserId: req.session.userId || null });
      await auditLog(req, "payment_verification_sweep", `school:${sid}`, {
        examined: sweep.examined, verified: sweep.verified, investigation: sweep.investigation,
      });
      res.json({ examined: sweep.examined, verified: sweep.verified, investigation: sweep.investigation });
    } catch (e: any) {
      res.status(e?.httpStatus || 400).json({ message: e.message });
    }
  });

  /** Re-run automatic verification for ONE order. */
  app.post("/api/admin/payments/:id/verify", requireRole(...FINANCE_ROLES), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      if (!sid) return res.status(400).json({ message: "School context required" });
      const result = await verifyOrder(routeParam(req.params.id), sid, { actorUserId: req.session.userId || null });
      await auditLog(req, "payment_verification_attempted", `payment:${result.paymentId}`, {
        outcome: result.outcome, reasonCode: result.reasonCode, method: result.method,
      });
      res.json(result);
    } catch (e: any) {
      res.status(e?.httpStatus || 400).json({ message: e.message });
    }
  });

  /** The verification story for one order — every attempt, oldest first. */
  app.get("/api/admin/payments/:id/verification", requireRole(...FINANCE_ROLES), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      if (!sid) return res.status(400).json({ message: "School context required" });
      const paymentId = routeParam(req.params.id);
      const payment = await storage.getPaymentById(paymentId, sid);
      if (!payment) return res.status(404).json({ message: "Payment not found" });
      const attempts = await attemptHistory(sid, paymentId);
      res.json({
        paymentId,
        verificationMethod: (payment as any).verificationMethod ?? null,
        attempts: attempts.map((a) => ({ ...a, evidence: a.evidence ? safeJson(a.evidence) : null })),
      });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  /**
   * Finance Officer manual override, for orders automatic verification could
   * not settle. A reason is REQUIRED and lands on the append-only trail.
   */
  app.post("/api/admin/payments/:id/manual-verify", requireRole(...FINANCE_ROLES), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      if (!sid) return res.status(400).json({ message: "School context required" });
      const setupState = await getSchoolSetupState(sid);
      if (setupState && !setupState.operationalSetupComplete) {
        return res.status(409).json({ message: "School setup is incomplete. Finish the setup checklist before confirming payments.", missingSteps: setupState.missingSteps });
      }
      const reason = typeof req.body?.reason === "string" ? req.body.reason : "";
      const result = await manuallyVerify({
        paymentId: routeParam(req.params.id), schoolId: sid,
        actorUserId: req.session.userId!, reason,
      });
      await auditLog(req, "payment_manually_verified", `payment:${result.paymentId}`, { reason: result.reason });

      const payment = result.payment;
      if (payment?.parentIdentifier) {
        sendPaymentVerifiedEmail(
          payment.parentIdentifier,
          payment.paymentReference || payment.id,
          payment.totalAmount || "0.00",
          await getEmailBrandingForSchool(req, payment.schoolId),
        ).catch(() => {});
      }
      res.json(result);
    } catch (e: any) {
      res.status(e?.httpStatus || 400).json({ message: e.message });
    }
  });

  /** Finance Officer decision that the payment was genuinely not received. */
  app.post("/api/admin/payments/:id/manual-reject", requireRole(...FINANCE_ROLES), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      if (!sid) return res.status(400).json({ message: "School context required" });
      const reason = typeof req.body?.reason === "string" ? req.body.reason : "";
      const result = await manuallyReject({
        paymentId: routeParam(req.params.id), schoolId: sid,
        actorUserId: req.session.userId!, reason,
      });
      await auditLog(req, "payment_manually_rejected", `payment:${result.paymentId}`, { reason: result.reason });

      const payment = result.payment;
      if (payment?.parentIdentifier) {
        sendPaymentRejectedEmail(
          payment.parentIdentifier,
          payment.paymentReference || payment.id,
          payment.totalAmount || "0.00",
          await getEmailBrandingForSchool(req, payment.schoolId),
        ).catch(() => {});
      }
      res.json(result);
    } catch (e: any) {
      res.status(e?.httpStatus || 400).json({ message: e.message });
    }
  });

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
    try {
      const sid = sessionSchoolId(req);
      const payments = await storage.getPaymentsEnriched(sid);
      if (!sid) return res.json(payments);

      // Attach the latest verification decision so the finance list can say WHY
      // an order is where it is — "verified automatically from Stripe" or
      // "investigation: no matching transaction" — without a request per row.
      const attempts = await latestAttemptsFor(sid, payments.map((p: any) => p.id));
      res.json(payments.map((p: any) => {
        const a = attempts.get(p.id);
        return {
          ...p,
          verification: a
            ? {
                outcome: a.outcome,
                method: a.method,
                reasonCode: a.reasonCode,
                reasonDetail: a.reasonDetail,
                candidateCount: a.candidateCount,
                at: a.createdAt,
                evidence: a.evidence ? safeJson(a.evidence) : null,
              }
            : null,
        };
      }));
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/admin/payments/:id/confirm", requireRole(...FINANCE_ROLES), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      if (sid) {
        const setupState = await getSchoolSetupState(sid);
        if (!setupState) return res.status(404).json({ message: "School not found" });
        if (!setupState.operationalSetupComplete) {
          return res.status(409).json({ message: "School setup is incomplete. Please finish the setup checklist before confirming payments.", missingSteps: setupState.missingSteps });
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

      if (payment?.parentIdentifier) {
        sendBooksReadyForCollectionEmail(
          payment.parentIdentifier,
          payment.paymentReference || payment.id,
          await getEmailBrandingForSchool(req, payment.schoolId),
        ).catch(() => {});
      }

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

      if (payment?.parentIdentifier) {
        sendCollectionCompletedEmail(
          payment.parentIdentifier,
          payment.paymentReference || payment.id,
          payment.totalAmount || "0.00",
          await getEmailBrandingForSchool(req, payment.schoolId),
        ).catch(() => {});
      }

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
