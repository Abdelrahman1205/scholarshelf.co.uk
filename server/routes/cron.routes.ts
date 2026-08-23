/**
 * server/routes/cron.routes.ts
 *
 * Scheduled jobs, invoked by Vercel Cron (see vercel.json "crons").
 *
 * WHAT CHANGED AND WHY
 *
 * The previous version did all of this in ONE 30-second function:
 *   - storage.getUsers() — every user across every tenant, into memory
 *   - for each school, getPayments() with no date filter — every payment ever
 *   - allUsers.find(...) per unpaid payment — an O(n·m) linear scan
 *   - emails in a tight await loop with no batching or backoff
 *   - and no record that any of it had happened
 *
 * It worked because there is one demo school. At five schools with a year of
 * history it times out — and with no idempotency record, a timeout partway
 * through meant some schools got their digest and some did not, with no way to
 * tell which. A retry re-emailed parents about money they owe.
 *
 * Now: one school per invocation, claimed atomically, aggregated in SQL, with a
 * throttle between sends. `?school=<id>` runs a single school; without it the
 * handler claims the next unprocessed school and reports whether more remain,
 * so the schedule drains the queue across successive ticks.
 *
 * ALSO FIXED: the digest counted `status === "ready_for_collection"`, a value
 * that appears in neither PAYMENT_STATUSES nor ORDER_STATUSES — so "collections
 * ready" reported zero every day since it was written. The real value lives on
 * order_status as "pending_student_collection".
 */
import type { Express, Request, Response } from "express";
import { randomUUID } from "crypto";
import { and, eq, gte, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { storage } from "../storage.js";
import { getDb } from "../config/database.js";
import {
  users, bookPayments, notificationPreferences, cronJobRuns,
} from "../../shared/schema.js";
import { resolveRole } from "../middleware/auth.js";
import {
  sendAdminDailyDigestEmail, sendUnpaidReminderEmail, type DailyDigestData,
} from "../email.js";

const JOB = "daily_digest";
const STAFF_DIGEST_ROLES = new Set(["admin", "school_admin", "finance"]);

/** Payment statuses that represent money still owed. */
const OUTSTANDING_STATUSES = ["awaiting_reference", "reference_submitted", "needs_review"];
const UNPAID_STATUSES = ["awaiting_reference"];

/** Resend permits a couple of sends per second; stay well under it. */
const SEND_GAP_MS = 300;

/**
 * Wall-clock budget for one cron invocation. vercel.json gives this function a
 * 30s ceiling; stop starting new schools at 24s so the one in flight can finish
 * and the response can be written.
 */
const DRAIN_BUDGET_MS = 24_000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Prefs = { dailyDigest: boolean; lowStockAlerts: boolean; paymentReminders: boolean };
const DEFAULT_PREFS: Prefs = { dailyDigest: true, lowStockAlerts: true, paymentReminders: true };

function timingSafeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function toNum(v: unknown): number {
  const n = parseFloat(String(v ?? "0"));
  return Number.isFinite(n) ? n : 0;
}

async function brandingForSchool(schoolId: string) {
  const [school, branding] = await Promise.all([
    storage.getSchoolById(schoolId),
    storage.getSchoolBranding(schoolId),
  ]);
  return {
    schoolName: school?.name || null,
    logoUrl: branding?.emailHeaderLogoUrl || branding?.logoUrl || null,
    primaryColour: branding?.primaryColour || null,
    secondaryColour: branding?.secondaryColour || null,
  };
}

/**
 * Claim today's run for a school. Returns false if someone already has it.
 * The unique index on (job, school_id, run_date) makes this atomic — two
 * concurrent invocations cannot both win.
 */
async function claimRun(schoolId: string, runDate: string): Promise<boolean> {
  const { rowCount } = await getDb().execute(sql`
    INSERT INTO cron_job_runs (id, job, school_id, run_date, status)
    VALUES (${randomUUID()}, ${JOB}, ${schoolId}, ${runDate}, 'running')
    ON CONFLICT (job, school_id, run_date) DO NOTHING
  `) as any;
  return (rowCount ?? 0) > 0;
}

async function finishRun(schoolId: string, runDate: string, status: string, sent: number, detail?: string) {
  await getDb().update(cronJobRuns)
    .set({ status, sentCount: sent, detail: detail ?? null, completedAt: new Date() })
    .where(and(
      eq(cronJobRuns.job, JOB),
      eq(cronJobRuns.schoolId, schoolId),
      eq(cronJobRuns.runDate, runDate),
    ));
}

async function processSchool(schoolId: string, runDate: string) {
  const summary = { schoolId, digestsSent: 0, remindersSent: 0, skipped: false, error: null as string | null };

  if (!(await claimRun(schoolId, runDate))) {
    summary.skipped = true;
    return summary;
  }

  try {
    const startOfToday = new Date();
    startOfToday.setUTCHours(0, 0, 0, 0);
    const threeDaysAgo = new Date(Date.now() - 3 * 86_400_000);
    const fourDaysAgo = new Date(Date.now() - 4 * 86_400_000);

    // ── Aggregate in SQL. The old version pulled every payment ever into
    //    memory and filtered in JavaScript.
    const [counts] = await getDb().select({
      newOrders: sql<number>`count(*) FILTER (WHERE ${bookPayments.paidAt} >= ${startOfToday})`,
      pendingReview: sql<number>`count(*) FILTER (WHERE ${bookPayments.status} = 'reference_submitted')`,
      collectionsReady: sql<number>`count(*) FILTER (WHERE ${bookPayments.orderStatus} = 'pending_student_collection')`,
      outstandingCount: sql<number>`count(*) FILTER (WHERE ${bookPayments.status} = ANY(${OUTSTANDING_STATUSES}))`,
      // Summed in Postgres as numeric — the old code parseFloat'd and added in
      // JS, so the total emailed to admins could drift by pennies.
      outstandingTotal: sql<string>`COALESCE(sum(${bookPayments.totalAmount}) FILTER (WHERE ${bookPayments.status} = ANY(${OUTSTANDING_STATUSES})), 0)::text`,
    }).from(bookPayments).where(eq(bookPayments.schoolId, schoolId));

    const lowStockBooks = await storage.getLowStockBooks(schoolId);
    const lowStock = lowStockBooks.map((b: any) => ({
      title: b.title, stock: b.stockQuantity ?? 0, threshold: b.lowStockThreshold ?? 10,
    }));

    // ── Staff for THIS school only.
    const staff = (await storage.getUsers(schoolId)).filter(
      (u) => u.email && STAFF_DIGEST_ROLES.has(resolveRole(u.role)),
    );

    const prefRows = staff.length
      ? await getDb().select().from(notificationPreferences)
          .where(inArray(notificationPreferences.userId, staff.map((u) => u.id)))
      : [];
    const prefById = new Map<string, Prefs>(prefRows.map((r) => [r.userId, {
      dailyDigest: r.dailyDigest, lowStockAlerts: r.lowStockAlerts, paymentReminders: r.paymentReminders,
    }]));

    const branding = await brandingForSchool(schoolId);
    const dateStr = startOfToday.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

    for (const u of staff) {
      const prefs = prefById.get(u.id) ?? DEFAULT_PREFS;
      if (!prefs.dailyDigest) continue;
      const data: DailyDigestData = {
        dateStr,
        newOrders: Number(counts?.newOrders ?? 0),
        outstandingCount: Number(counts?.outstandingCount ?? 0),
        outstandingTotal: toNum(counts?.outstandingTotal).toFixed(2),
        pendingReview: Number(counts?.pendingReview ?? 0),
        collectionsReady: Number(counts?.collectionsReady ?? 0),
        lowStock: prefs.lowStockAlerts ? lowStock : [],
      };
      if (await sendAdminDailyDigestEmail(u.email!, data, branding)) summary.digestsSent++;
      await sleep(SEND_GAP_MS);
    }

    // ── Unpaid reminders: the ~day-3 window, filtered in SQL.
    const unpaid = await getDb().select().from(bookPayments).where(and(
      eq(bookPayments.schoolId, schoolId),
      inArray(bookPayments.status, UNPAID_STATUSES as any),
      lt(bookPayments.paidAt, threeDaysAgo),
      gte(bookPayments.paidAt, fourDaysAgo),
    ));

    if (unpaid.length) {
      const emails = [...new Set(unpaid.map((p) => p.parentIdentifier).filter(Boolean) as string[])];
      const parents = emails.length
        ? await getDb().select().from(users).where(inArray(sql`lower(${users.email})`, emails.map((e) => e.toLowerCase()) as any))
        : [];
      const parentPrefRows = parents.length
        ? await getDb().select().from(notificationPreferences)
            .where(inArray(notificationPreferences.userId, parents.map((u) => u.id)))
        : [];
      const prefByEmail = new Map<string, Prefs>();
      for (const u of parents) {
        const pr = parentPrefRows.find((r) => r.userId === u.id);
        prefByEmail.set((u.email || "").toLowerCase(), pr
          ? { dailyDigest: pr.dailyDigest, lowStockAlerts: pr.lowStockAlerts, paymentReminders: pr.paymentReminders }
          : DEFAULT_PREFS);
      }

      const school = await storage.getSchoolById(schoolId);
      for (const p of unpaid) {
        if (!p.parentIdentifier) continue;
        const prefs = prefByEmail.get(p.parentIdentifier.toLowerCase()) ?? DEFAULT_PREFS;
        if (!prefs.paymentReminders) continue;
        const ok = await sendUnpaidReminderEmail(
          p.parentIdentifier,
          p.paymentReference || p.id,
          toNum(p.totalAmount).toFixed(2),
          school?.paymentAppName ?? null,
          branding,
        );
        if (ok) summary.remindersSent++;
        await sleep(SEND_GAP_MS);
      }
    }

    await finishRun(schoolId, runDate, "completed", summary.digestsSent + summary.remindersSent);
  } catch (e: any) {
    summary.error = e?.message ?? "unknown error";
    // Mark failed rather than deleting the claim: a same-day retry should NOT
    // re-send to a school that may already have had half its emails.
    await finishRun(schoolId, runDate, "failed", summary.digestsSent + summary.remindersSent, summary.error ?? undefined)
      .catch(() => {});
  }
  return summary;
}

export function registerCronRoutes(app: Express): void {
  const handler = async (req: Request, res: Response) => {
    const secret = process.env.CRON_SECRET;
    const authHeader = req.headers["authorization"];
    const bearer = typeof authHeader === "string" && authHeader.startsWith("Bearer ")
      ? authHeader.slice(7) : "";
    const provided = bearer || (req.headers["x-cron-secret"] as string) || "";
    if (!secret || !timingSafeEquals(provided, secret)) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const runDate = new Date().toISOString().slice(0, 10);
    const only = typeof req.query.school === "string" ? req.query.school : null;

    try {
      const schools = only
        ? [await storage.getSchoolById(only)].filter(Boolean) as any[]
        : await storage.getSchools();

      const active = schools.filter((s: any) => s.status === "active");

      // Which schools still need today's run.
      const doneRows = await getDb().select({ schoolId: cronJobRuns.schoolId })
        .from(cronJobRuns)
        .where(and(eq(cronJobRuns.job, JOB), eq(cronJobRuns.runDate, runDate)));
      const done = new Set(doneRows.map((r) => r.schoolId));
      const pending = active.filter((s: any) => !done.has(s.id));

      if (!pending.length) {
        return res.json({ ok: true, runDate, done: true, message: "All schools processed for today.", remaining: 0 });
      }

      // Drain as many schools as fit inside the function's wall clock, rather
      // than one per invocation. The old behaviour assumed "successive ticks"
      // that a once-a-day schedule never produces: from school #2 onward nobody
      // got a digest or an unpaid reminder, ever, and the response still said
      // 200 OK. Idempotency is guaranteed by the unique index on
      // (job, school_id, run_date), so a partial drain is safe to resume.
      const startedAt = Date.now();
      type SchoolRun = Awaited<ReturnType<typeof processSchool>> & { schoolName: string | null };
      const processed: SchoolRun[] = [];

      for (const school of pending) {
        // Stop *before* starting a school we cannot finish. Each school is a
        // send loop, so an aborted one leaves half a mailing list done.
        if (Date.now() - startedAt > DRAIN_BUDGET_MS) break;
        const result = await processSchool(school.id, runDate);
        processed.push({ ...result, schoolName: school.name ?? null });
      }

      const remaining = pending.length - processed.length;
      if (remaining > 0) {
        console.warn(`[cron] ran out of budget with ${remaining} school(s) left for ${runDate}`);
      }

      res.json({
        ok: processed.every((p) => !p.error),
        runDate,
        done: remaining === 0,
        processedCount: processed.length,
        processed,
        remaining,
      });
    } catch (e: any) {
      console.error("[cron] failed:", e?.message);
      res.status(500).json({ ok: false, message: "Cron failed" });
    }
  };

  // POST is the mutating verb; GET is kept because Vercel Cron issues GET.
  app.get("/api/cron/run", handler);
  app.post("/api/cron/run", handler);
}
