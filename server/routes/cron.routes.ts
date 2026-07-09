/**
 * server/routes/cron.routes.ts
 *
 * Scheduled jobs, invoked by Vercel Cron (see vercel.json "crons").
 * Vercel sends `Authorization: Bearer <CRON_SECRET>` on each scheduled request;
 * we reject anything without the matching secret, so the endpoint is not
 * publicly runnable. POST is also allowed for manual/admin triggering.
 *
 * Jobs (run once per invocation):
 *   1. Admin daily digest  — per-school activity summary to staff.
 *   2. Unpaid-order reminder — to parents whose order is ~3 days unpaid.
 */
import type { Express, Request, Response } from "express";
import { inArray } from "drizzle-orm";
import { storage } from "../storage.js";
import { getDb } from "../config/database.js";
import { users, notificationPreferences } from "../../shared/schema.js";
import { resolveRole } from "../middleware/auth.js";
import {
  sendAdminDailyDigestEmail, sendUnpaidReminderEmail, type DailyDigestData,
} from "../email.js";

const STAFF_DIGEST_ROLES = new Set(["admin", "school_admin", "finance"]);
const OUTSTANDING_STATUSES = new Set(["awaiting_reference", "pending", "reference_submitted", "needs_review"]);
const UNPAID_STATUSES = new Set(["awaiting_reference", "pending"]);

type Prefs = { dailyDigest: boolean; lowStockAlerts: boolean; paymentReminders: boolean };
const DEFAULT_PREFS: Prefs = { dailyDigest: true, lowStockAlerts: true, paymentReminders: true };

async function brandingForSchool(schoolId: string | null | undefined) {
  if (!schoolId) return undefined;
  const [school, branding] = await Promise.all([
    storage.getSchoolById(schoolId),
    storage.getSchoolBranding(schoolId),
  ]);
  return {
    schoolName: school?.name || null,
    // Branding logos are stored as self-contained data URIs, so they render in email as-is.
    logoUrl: branding?.emailHeaderLogoUrl || branding?.logoUrl || null,
    primaryColour: branding?.primaryColour || null,
    secondaryColour: branding?.secondaryColour || null,
  };
}

function toNum(v: unknown): number {
  const n = parseFloat(String(v ?? "0"));
  return Number.isFinite(n) ? n : 0;
}

export function registerCronRoutes(app: Express): void {
  const handler = async (req: Request, res: Response) => {
    // ── Auth: require the shared secret (fail closed if unset) ──
    const secret = process.env.CRON_SECRET;
    const authHeader = req.headers["authorization"];
    const bearer = typeof authHeader === "string" && authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : "";
    const provided = bearer || (req.headers["x-cron-secret"] as string) || "";
    if (!secret || provided !== secret) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const summary = { digestsSent: 0, remindersSent: 0, schools: 0, errors: [] as string[] };

    try {
      const schools = await storage.getSchools();
      summary.schools = schools.length;

      // Preference map (email → prefs) and (userId → prefs), loaded once.
      const allUsers = await storage.getUsers();
      const prefRows = allUsers.length
        ? await getDb().select().from(notificationPreferences)
            .where(inArray(notificationPreferences.userId, allUsers.map((u) => u.id)))
        : [];
      const prefByUserId = new Map<string, Prefs>();
      for (const r of prefRows) {
        prefByUserId.set(r.userId, {
          dailyDigest: r.dailyDigest, lowStockAlerts: r.lowStockAlerts, paymentReminders: r.paymentReminders,
        });
      }
      const prefsFor = (userId?: string | null): Prefs =>
        (userId && prefByUserId.get(userId)) || DEFAULT_PREFS;
      const prefsForEmail = (email?: string | null): Prefs => {
        const u = email ? allUsers.find((x) => (x.email || "").toLowerCase() === email.toLowerCase()) : undefined;
        return prefsFor(u?.id);
      };

      const now = Date.now();
      const startOfToday = new Date();
      startOfToday.setUTCHours(0, 0, 0, 0);
      const threeDaysAgo = now - 3 * 86400000;
      const fourDaysAgo = now - 4 * 86400000;

      for (const school of schools) {
        try {
          const payments = await storage.getPayments(undefined, school.id);
          const at = (p: any) => (p.paidAt ? new Date(p.paidAt).getTime() : 0);

          // ── Job 1: daily digest ──
          const newOrders = payments.filter((p) => at(p) >= startOfToday.getTime()).length;
          const pendingReview = payments.filter((p) => p.status === "reference_submitted").length;
          const collectionsReady = payments.filter((p) => p.status === "ready_for_collection").length;
          const outstanding = payments.filter((p) => OUTSTANDING_STATUSES.has(p.status));
          const outstandingTotal = outstanding.reduce((s, p) => s + toNum(p.totalAmount), 0);

          const lowStockBooks = await storage.getLowStockBooks(school.id);
          const lowStock = lowStockBooks.map((b: any) => ({
            title: b.title, stock: b.stockQuantity ?? 0, threshold: b.lowStockThreshold ?? 10,
          }));

          const staff = allUsers.filter(
            (u) => u.schoolId === school.id && u.email && STAFF_DIGEST_ROLES.has(resolveRole(u.role)),
          );
          if (staff.length) {
            const branding = await brandingForSchool(school.id);
            const dateStr = startOfToday.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
            for (const u of staff) {
              const prefs = prefsFor(u.id);
              if (!prefs.dailyDigest) continue;
              const data: DailyDigestData = {
                dateStr,
                newOrders,
                outstandingCount: outstanding.length,
                outstandingTotal: outstandingTotal.toFixed(2),
                pendingReview,
                collectionsReady,
                lowStock: prefs.lowStockAlerts ? lowStock : [],
              };
              const ok = await sendAdminDailyDigestEmail(u.email!, data, branding);
              if (ok) summary.digestsSent++;
            }
          }

          // ── Job 2: unpaid-order reminders (one reminder around day 3) ──
          const unpaid = payments.filter(
            (p) => UNPAID_STATUSES.has(p.status) && at(p) <= threeDaysAgo && at(p) > fourDaysAgo,
          );
          if (unpaid.length) {
            const branding = await brandingForSchool(school.id);
            for (const p of unpaid) {
              if (!p.parentIdentifier) continue;
              if (!prefsForEmail(p.parentIdentifier).paymentReminders) continue;
              const ok = await sendUnpaidReminderEmail(
                p.parentIdentifier,
                p.paymentReference || p.id,
                toNum(p.totalAmount).toFixed(2),
                school.paymentAppName ?? null,
                branding,
              );
              if (ok) summary.remindersSent++;
            }
          }
        } catch (e: any) {
          summary.errors.push(`school ${school.id}: ${e?.message || "error"}`);
        }
      }

      res.json({ ok: true, ranAt: new Date().toISOString(), ...summary });
    } catch (e: any) {
      res.status(500).json({ ok: false, message: e?.message || "Cron failed", ...summary });
    }
  };

  app.get("/api/cron/run", handler);
  app.post("/api/cron/run", handler);
}
