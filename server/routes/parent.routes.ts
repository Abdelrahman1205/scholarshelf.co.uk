/**
 * server/routes/parent.routes.ts
 *
 * Route handlers: parent domain.
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
  sendPaymentSubmittedEmail, isResendConfigured,
} from "../email.js";

export function registerParentRoutes(app: Express): void {
  app.post("/api/parent/link-code/preview", requireRole("parent"), async (req, res) => {
    try {
      const { code } = req.body;
      if (!code?.trim()) return res.status(400).json({ message: "Link code is required" });
      const user = await storage.getUserById(req.session.userId!);
      if (!user?.email) return res.status(400).json({ message: "No email set for your account" });
      // Look up without consuming the code
      const linkingCode = await storage.getLinkingCodeByCode(code.trim().toUpperCase());
      if (!linkingCode) return res.status(404).json({ message: "Invalid linking code" });
      if (linkingCode.isUsed) return res.status(400).json({ message: "This linking code has already been used." });
      if (linkingCode.expiresAt && new Date(linkingCode.expiresAt) < new Date()) {
        return res.status(400).json({ message: "This linking code has expired. Please ask the school to generate a new one." });
      }
      if (linkingCode.parentEmail && linkingCode.parentEmail.trim().toLowerCase() !== user.email.trim().toLowerCase()) {
        return res.status(403).json({ message: "This linking code is not assigned to your email address." });
      }
      // Family code: return all children in the family
      if (linkingCode.familyId && (linkingCode as any).family) {
        const family = (linkingCode as any).family;
        return res.json({
          code: linkingCode.code,
          isFamily: true,
          familyId: linkingCode.familyId,
          familyName: family.name,
          students: (family.students || []).map((s: any) => ({
            studentId: s.id,
            studentName: s.name ?? "Unknown Student",
            studentCode: s.studentCode ?? null,
            className: s.class?.name ?? null,
          })),
        });
      }

      // Single-child code: return safe preview — no PII beyond name
      const student = linkingCode.student;
      res.json({
        code: linkingCode.code,
        isFamily: false,
        studentId: linkingCode.studentId,
        studentName: student?.name ?? "Unknown Student",
        studentCode: student?.studentCode ?? null,
        className: (linkingCode as any).class?.name ?? null,
      });
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  // Confirm a link code — creates the parent-student link
  // Spec §6.4: POST /api/parent/link-code/confirm
  app.post("/api/parent/link-code/confirm", requireRole("parent"), async (req, res) => {
    try {
      const { code } = req.body;
      const user = await storage.getUserById(req.session.userId!);
      if (!user?.email) return res.status(400).json({ message: "No email set for your account" });
      const result = await storage.useLinkingCode(code, user.email);
      if (!result) return res.status(404).json({ message: "Invalid linking code" });
      if (result.isFamily && result.students) {
        const ids = result.students.map((s) => s.id).join(",");
        await auditLog(req, "parent_family_linked", `students:${ids}`);
      } else if (result.student) {
        await auditLog(req, "parent_child_linked", `student:${result.student.id}`);
      }
      res.json(result);
    } catch (e: any) {
      const msg = e.message || "Unknown error";
      if (msg.includes("not assigned to your email")) return res.status(403).json({ message: msg });
      res.status(400).json({ message: msg });
    }
  });

  // Legacy single-step link (kept for backward compat)
  app.post("/api/parent/link-child", requireRole("parent"), async (req, res) => {
    try {
      const { code } = req.body;
      const user = await storage.getUserById(req.session.userId!);
      if (!user?.email) return res.status(400).json({ message: "No email set for your account" });
      const result = await storage.useLinkingCode(code, user.email);
      if (!result) return res.status(404).json({ message: "Invalid linking code" });
      res.json(result);
    } catch (e: any) {
      // Map specific security errors to appropriate HTTP status codes
      const msg = e.message || "Unknown error";
      if (msg.includes("not assigned to your email")) {
        return res.status(403).json({ message: msg });
      }
      res.status(400).json({ message: msg });
    }
  });

  app.get("/api/parent/children", requireRole("parent"), async (req, res) => {
    const user = await storage.getUserById(req.session.userId!);
    if (!user?.email) return res.status(400).json({ message: "No email set for your account" });
    const children = await storage.getParentChildren(user.email);
    res.json(children);
  });

  // GET /api/parent/children/:id/books — Spec §7: book allocations for a linked child
  app.get("/api/parent/children/:id/books", requireRole("parent"), async (req, res) => {
    try {
      const user = await storage.getUserById(req.session.userId!);
      if (!user?.email) return res.status(400).json({ message: "No email set for your account" });

      const studentId = routeParam(req.params.id);

      // SECURITY: Verify the parent is linked to this student
      const children = await storage.getParentChildren(user.email);
      const isLinked = children.some((c) => c.studentId === studentId);
      if (!isLinked) {
        return res.status(403).json({ message: "You are not authorised to view books for this student" });
      }

      // Pull all allocations for this student (no schoolId filter — parent can see across any school they're linked to)
      const allocs = await storage.getAllocations(undefined, undefined);
      const studentAllocs = allocs.filter((a: any) => a.student?.id === studentId || a.studentId === studentId);

      const books = studentAllocs.map((a: any) => ({
        allocationId: a.id,
        bookTitle: a.book?.title ?? "Unknown",
        bookIsbn: a.book?.isbn ?? null,
        quantity: a.quantity ?? 1,
        unitPrice: a.book?.price ?? null,
        status: a.status ?? "allocated",
        paymentStatus: a.paymentStatus ?? null,
        allocatedAt: a.createdAt ?? null,
      }));

      res.json(books);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/parent/children/:id/basket", requireRole("parent"), async (req, res) => {
    try {
      const user = await storage.getUserById(req.session.userId!);
      if (!user?.email) return res.status(400).json({ message: "No email set for your account" });

      // SECURITY: Verify parent is linked to this student
      const studentId = routeParam(req.params.id);
      const children = await storage.getParentChildren(user.email);
      const isLinked = children.some(c => c.studentId === studentId);
      if (!isLinked) {
        return res.status(403).json({ message: "You are not authorised to create a basket for this student" });
      }

      const basket = await storage.generateBasket(studentId, user.email);
      res.status(201).json(basket);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.get("/api/parent/baskets", requireRole("parent"), async (req, res) => {
    const user = await storage.getUserById(req.session.userId!);
    if (!user?.email) return res.status(400).json({ message: "No email set for your account" });
    const baskets = await storage.getBaskets(user.email);
    res.json(baskets);
  });

  // POST /api/parent/payments — create order (awaiting external payment reference)
  app.post("/api/parent/payments", requireRole("parent"), async (req, res) => {
    try {
      const user = await storage.getUserById(req.session.userId!);
      if (!user?.email) return res.status(400).json({ message: "No email set for your account" });
      const { basketIds } = req.body;
      if (!basketIds || !Array.isArray(basketIds) || basketIds.length === 0) {
        return res.status(400).json({ message: "basketIds is required" });
      }
      const loadedBaskets = [];
      let total = 0;
      for (const id of basketIds) {
        const basket = await storage.getBasket(id);
        if (!basket) return res.status(404).json({ message: `Basket ${id} not found` });
        if (basket.parentIdentifier !== user.email) {
          return res.status(403).json({ message: "Access denied" });
        }
        loadedBaskets.push(basket);
        total += parseFloat(basket.totalAmount);
      }

      const reference = generatePaymentReference();

      // Derive schoolId from the first basket's student
      const firstStudent = loadedBaskets[0]?.student;
      const paymentSchoolId = firstStudent?.schoolId || loadedBaskets[0]?.schoolId || null;

      const payment = await storage.createPayment({
        parentIdentifier: user.email,
        totalAmount: total.toFixed(2),
        paymentMethod: "external_reference",
        paymentReference: reference,
        status: "awaiting_reference",
        schoolId: paymentSchoolId,
      }, basketIds);

      await storage.createAuditLog({
        action: "payment_order_created",
        userId: req.session.userId!,
        metadata: `Order created: ref=${reference}, amount=£${total.toFixed(2)}, baskets=${basketIds.length}`,
      });

      res.status(201).json(payment);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  // POST /api/parent/payments/:id/submit-reference — submit external payment reference
  app.post("/api/parent/payments/:id/submit-reference", requireRole("parent"), async (req, res) => {
    try {
      const user = await storage.getUserById(req.session.userId!);
      if (!user?.email) return res.status(400).json({ message: "No email set for your account" });

      const paymentId = routeParam(req.params.id);
      const { referenceNumber, confirmed, notes } = req.body;

      // Validate required fields
      if (!referenceNumber || typeof referenceNumber !== "string" || referenceNumber.trim().length < 3) {
        return res.status(400).json({ message: "A valid payment reference number is required (minimum 3 characters)." });
      }
      if (confirmed !== true) {
        return res.status(400).json({ message: "You must confirm that you have completed the payment." });
      }

      // Sanitise
      const cleanRef = referenceNumber.trim().toUpperCase();

      // Verify this payment belongs to the parent
      const existing = await storage.getPaymentById(paymentId);
      if (!existing) return res.status(404).json({ message: "Payment not found" });
      if (existing.parentIdentifier !== user.email) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Check for duplicate reference within the same school
      if (existing.schoolId) {
        const isDuplicate = await storage.isPaymentReferenceDuplicate(cleanRef, existing.schoolId, paymentId);
        if (isDuplicate) {
          return res.status(409).json({ message: "This payment reference has already been submitted for another order in this school." });
        }
      }

      const payment = await storage.submitPaymentReference(
        paymentId,
        cleanRef,
        req.session.userId!,
        notes?.trim() || undefined,
      );

      await storage.createAuditLog({
        action: "payment_reference_submitted",
        userId: req.session.userId!,
        metadata: `Reference submitted: ref=${cleanRef}, paymentId=${paymentId}`,
      });

      // Notify parent
      const submittedSent = await sendPaymentSubmittedEmail(
        user.email,
        payment.paymentReference || paymentId,
        payment.totalAmount || "0.00",
        "external_reference",
        await getEmailBrandingForSchool(req, payment.schoolId)
      );
      if (!submittedSent) {
        console.log(`[PAYMENT REF SUBMITTED] Parent: ${user.email}, Ref: ${cleanRef}, OrderRef: ${payment.paymentReference}`);
      }

      res.json(payment);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  // GET /api/parent/payments — list parent's payments
  app.get("/api/parent/payments", requireRole("parent"), async (req, res) => {
    const user = await storage.getUserById(req.session.userId!);
    if (!user?.email) return res.status(400).json({ message: "No email set for your account" });
    const payments = await storage.getPayments(user.email);
    res.json(payments);
  });

  // === FINANCE SUMMARY ===
}
