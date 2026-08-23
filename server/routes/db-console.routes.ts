/**
 * server/routes/db-console.routes.ts
 *
 * BytHub console — owner-only, and deliberately three-tiered.
 *
 *   Tier 1  typed operations      ~90% of support work. No SQL is typed.
 *   Tier 2  read-only queries     enforced by Postgres, not by regex.
 *   Tier 3  break-glass writes    TOTP + reason + 15 minutes + alerts.
 *
 * WHAT CHANGED AND WHY
 *
 * The previous version policed SQL with `/\b(drop|truncate|alter|create)\b/i`
 * and `/^\s*(insert|update|delete)\b/i`. Both lost to:
 *   - `WITH x AS (DELETE FROM users RETURNING *) SELECT * FROM x`  (starts WITH)
 *   - `SELECT 1; DELETE FROM book_payments`                        (only word 1 checked)
 *   - `/*x*\/DELETE FROM students`                                 (defeats the anchor)
 *
 * You cannot win a regex war against a query language. So enforcement moved into
 * the database, where five independent controls each kill a whole class of bypass:
 *
 *   1. console_ro has SELECT grants only, on a schema of views.  → all writes
 *   2. default_transaction_read_only + explicit BEGIN READ ONLY  → CTE writes
 *   3. every query passes a values array (extended protocol)     → multi-statement
 *   4. views exclude password_hash / mfa_secret / token_hash     → credential leak
 *   5. always ROLLBACK, never COMMIT, on the read tier           → last resort
 *
 * Also gone: the PATCH and DELETE row endpoints. PATCH interpolated JSON object
 * keys straight into SQL (`"${k}" = $n`), which was an injection with no column
 * allowlist behind it. Tier 1 covers the real use cases; nothing typed replaces it.
 *
 * And everything here writes to console_audit. The old console logged nothing at
 * all, while routine logins were audited.
 *
 * See migrations/001_console_hardening.sql.
 */
import type { Express, Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";
import { z } from "zod";
import { requireRole, rateLimit, isPlatformOwnerRole } from "../middleware/auth.js";
import { PLATFORM_OWNER_ROLES } from "../core/constants.js";
import { getPool } from "../config/database.js";
import {
  getConsoleReadPool, getConsoleWritePool,
  isConsoleConfigured, isBreakGlassConfigured,
} from "../config/consoleDb.js";
import { storage } from "../storage.js";
import { verifyTOTP } from "../mfa.js";
import { consoleAudit } from "../console/audit.js";
import { OPERATIONS, operationCatalogue, type OperationName } from "../console/operations.js";

const MAX_ROWS = 1_000;
const ELEVATION_MS = 15 * 60 * 1000;
/** A school must sit in pending_deletion this long before it can be purged. */
const PURGE_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

/** Identifier safe for interpolation — the view name still comes from an allowlist. */
const IDENT = /^[a-z_][a-z0-9_]*$/;

function consoleUnavailable(res: Response) {
  return res.status(503).json({
    message:
      "The console is not configured. Run migrations/001_console_hardening.sql and set " +
      "CONSOLE_RO_DATABASE_URL.",
  });
}

/** Live view names, read from the database rather than a hand-maintained array. */
async function listConsoleViews(): Promise<string[]> {
  const { rows } = await getConsoleReadPool().query({
    text: `SELECT table_name FROM information_schema.views
           WHERE table_schema = 'console' ORDER BY table_name`,
    values: [],
  });
  return rows.map((r: any) => r.table_name).filter((n: string) => IDENT.test(n));
}

export function registerDbConsoleRoutes(app: Express): void {
  const ownerOnly = requireRole(...PLATFORM_OWNER_ROLES);

  // ═══════════════════════════════════════════════════════════════════════════
  // TIER 2 — read-only
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * The table list is derived, not declared. The old hard-coded array offered six
   * tables that did not exist and omitted eighteen that did.
   */
  app.get("/api/owner/db/tables", ownerOnly, async (_req, res) => {
    if (!isConsoleConfigured()) return consoleUnavailable(res);
    try {
      res.json({ tables: await listConsoleViews() });
    } catch (e: any) {
      console.error("[console] tables", e.message);
      res.status(500).json({ message: "Could not list tables." });
    }
  });

  app.get("/api/owner/db/tables/:table", ownerOnly, async (req, res) => {
    if (!isConsoleConfigured()) return consoleUnavailable(res);
    const table = String(req.params.table);
    const started = Date.now();

    if (!IDENT.test(table)) {
      return res.status(400).json({ message: "Invalid table name." });
    }
    const allowed = await listConsoleViews().catch(() => [] as string[]);
    if (!allowed.includes(table)) {
      return res.status(404).json({ message: `No console view named '${table}'.` });
    }

    const page = Math.max(1, parseInt(String(req.query.page || "1"), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || "50"), 10) || 50));
    const offset = (page - 1) * limit;
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
    const schoolId = typeof req.query.schoolId === "string" ? req.query.schoolId.trim() : "";

    const client = await getConsoleReadPool().connect();
    try {
      await client.query("BEGIN READ ONLY");
      await client.query("SET LOCAL statement_timeout = 5000");

      // Which of the optional filter columns this view actually has. The old
      // console assumed every table had `created_at` and `name`, so browsing one
      // that didn't returned a raw Postgres error to the browser.
      const colsRes = await client.query({
        text: `SELECT column_name FROM information_schema.columns
               WHERE table_schema = 'console' AND table_name = $1`,
        values: [table],
      });
      const cols = new Set(colsRes.rows.map((r: any) => r.column_name));

      const where: string[] = [];
      const params: unknown[] = [];
      if (schoolId && cols.has("school_id")) {
        params.push(schoolId);
        where.push(`school_id = $${params.length}`);
      }
      if (search) {
        const searchable = ["id", "name", "email", "username", "code", "title"].filter((c) => cols.has(c));
        if (searchable.length) {
          params.push(`%${search}%`);
          const idx = params.length;
          where.push("(" + searchable.map((c) => `COALESCE(${c}::text, '') ILIKE $${idx}`).join(" OR ") + ")");
        }
      }
      const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
      const orderSql = cols.has("created_at") ? `ORDER BY created_at DESC NULLS LAST` : `ORDER BY 1`;

      const countRes = await client.query({
        text: `SELECT COUNT(*)::int AS count FROM console.${table} ${whereSql}`,
        values: params,
      });
      const total = countRes.rows[0]?.count ?? 0;

      const rowsRes = await client.query({
        text: `SELECT * FROM console.${table} ${whereSql} ${orderSql} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        values: [...params, limit, offset],
      });

      await client.query("ROLLBACK");

      await consoleAudit(req, {
        tier: "query",
        action: "table.browse",
        schoolId: schoolId || null,
        statement: `browse ${table}`,
        params: { table, page, limit, search: search || null },
        rowCount: rowsRes.rows.length,
        durationMs: Date.now() - started,
      });

      res.json({
        table, page, limit, total,
        pages: Math.max(1, Math.ceil(total / limit)),
        rows: rowsRes.rows,
        columns: rowsRes.fields.map((f) => f.name),
      });
    } catch (e: any) {
      await client.query("ROLLBACK").catch(() => {});
      console.error("[console] browse", e.message);
      res.status(400).json({ message: e.message });
    } finally {
      client.release();
    }
  });

  app.post("/api/owner/db/query", ownerOnly, async (req, res) => {
    if (!isConsoleConfigured()) return consoleUnavailable(res);
    const parsed = z.object({ query: z.string().min(1).max(20_000) }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "A query is required." });
    const sql = parsed.data.query;
    const started = Date.now();

    const client = await getConsoleReadPool().connect();
    try {
      // (2) Postgres refuses every write in here, CTEs included.
      await client.query("BEGIN READ ONLY");
      await client.query("SET LOCAL statement_timeout = 5000");

      // (3) A values array forces the extended protocol, which accepts exactly
      //     one statement. "SELECT 1; DELETE ..." is rejected by the server.
      const result = await client.query({ text: sql, values: [] });

      // (5) Nothing is ever committed.
      await client.query("ROLLBACK");

      const truncated = result.rows.length > MAX_ROWS;
      const rows = truncated ? result.rows.slice(0, MAX_ROWS) : result.rows;

      await consoleAudit(req, {
        tier: "query", action: "sql.read", statement: sql,
        rowCount: result.rowCount ?? rows.length, durationMs: Date.now() - started,
      });

      res.json({
        rows,
        columns: result.fields?.map((f) => f.name) ?? [],
        rowCount: result.rowCount ?? rows.length,
        truncated, durationMs: Date.now() - started,
      });
    } catch (e: any) {
      await client.query("ROLLBACK").catch(() => {});
      await consoleAudit(req, {
        tier: "query", action: "sql.read.failed", statement: sql,
        durationMs: Date.now() - started,
      });
      // Safe to surface here: the audience is BytHub, not a tenant.
      res.status(400).json({ message: e.message });
    } finally {
      client.release();
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // TIER 1 — typed operations
  // ═══════════════════════════════════════════════════════════════════════════

  app.get("/api/owner/console/operations", ownerOnly, (_req, res) => {
    res.json({ operations: operationCatalogue() });
  });

  app.post("/api/owner/console/op/:name", ownerOnly, async (req, res) => {
    const name = String(req.params.name) as OperationName;
    const op = (OPERATIONS as Record<string, any>)[name];
    if (!op) return res.status(404).json({ message: `Unknown operation '${name}'.` });

    const parsed = op.input.safeParse(req.body?.input);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid input.", issues: parsed.error.issues });
    }
    const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
    if (op.destructive && reason.length < 10) {
      return res.status(400).json({ message: "A reason of at least 10 characters is required." });
    }

    const started = Date.now();
    const before = op.before ? await op.before(parsed.data).catch(() => null) : null;

    try {
      const after = await op.run(parsed.data, {
        req,
        actorUserId: req.session.userId!,
        reason: reason || null,
      });

      await consoleAudit(req, {
        tier: "operation",
        action: name,
        schoolId: (parsed.data as any).schoolId ?? null,
        statement: op.describe(parsed.data),
        params: parsed.data,
        beforeSnapshot: before,
        afterSnapshot: after,
        reason: reason || null,
        durationMs: Date.now() - started,
      });

      res.json({ success: true, description: op.describe(parsed.data), before, after });
    } catch (e: any) {
      await consoleAudit(req, {
        tier: "operation", action: `${name}.failed`,
        params: parsed.data, reason: reason || null,
        statement: e?.message ?? null, durationMs: Date.now() - started,
      });
      res.status(500).json({ message: e.message || "Operation failed." });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // TIER 3 — break-glass
  // ═══════════════════════════════════════════════════════════════════════════

  app.post("/api/owner/console/elevate", ownerOnly, async (req, res) => {
    if (!isBreakGlassConfigured()) {
      return res.status(503).json({ message: "Break-glass write access is not configured." });
    }
    const parsed = z.object({
      totp: z.string().regex(/^\d{6}$/, "Enter the 6-digit code from your authenticator."),
      reason: z.string().min(20, "Describe what you need to change and why (20+ characters)."),
    }).safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Invalid request." });
    }

    if (await rateLimit(`console-elevate:${req.session.userId}`, 5, 15 * 60 * 1000)) {
      await consoleAudit(req, { tier: "breakglass", action: "elevate.rate_limited" });
      return res.status(429).json({ message: "Too many elevation attempts. Try again later." });
    }

    const user = await storage.getUserById(req.session.userId!);
    if (!user?.mfaEnabled || !user.mfaSecret) {
      return res.status(403).json({ message: "Enrol in two-factor authentication before requesting write access." });
    }
    if (!verifyTOTP(user.mfaSecret, parsed.data.totp)) {
      await consoleAudit(req, { tier: "breakglass", action: "elevate.denied", reason: parsed.data.reason });
      return res.status(401).json({ message: "That code didn't match." });
    }

    const elevationId = randomUUID();
    req.session.consoleElevation = {
      id: elevationId,
      expiresAt: Date.now() + ELEVATION_MS,
      reason: parsed.data.reason,
    };

    await consoleAudit(req, {
      tier: "breakglass", action: "elevate.granted",
      reason: parsed.data.reason, elevationId,
    });

    // An elevation nobody notices is not a control. Fire-and-forget so a mail
    // failure never blocks legitimate emergency access.
    void notifyOtherOwners(req, user, parsed.data.reason, elevationId);

    res.json({ elevated: true, expiresAt: req.session.consoleElevation.expiresAt });
  });

  app.post("/api/owner/console/elevate/end", ownerOnly, async (req, res) => {
    const id = req.session.consoleElevation?.id ?? null;
    req.session.consoleElevation = null;
    if (id) await consoleAudit(req, { tier: "breakglass", action: "elevate.ended", elevationId: id });
    res.json({ elevated: false });
  });

  function requireElevation(req: Request, res: Response, next: NextFunction) {
    const e = req.session.consoleElevation;
    if (!e || e.expiresAt < Date.now()) {
      req.session.consoleElevation = null;
      return res.status(403).json({
        message: "Write access has expired. Re-authenticate to continue.",
        needsElevation: true,
      });
    }
    next();
  }

  app.post("/api/owner/console/write", ownerOnly, requireElevation, async (req, res) => {
    if (!isBreakGlassConfigured()) {
      return res.status(503).json({ message: "Break-glass write access is not configured." });
    }
    const parsed = z.object({
      sql: z.string().min(1).max(20_000),
      expectRows: z.number().int().min(0).max(100_000),
    }).safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: "Provide the statement and the number of rows you expect it to affect.",
      });
    }
    const { sql, expectRows } = parsed.data;
    const elevation = req.session.consoleElevation!;
    const started = Date.now();

    // A typo control, NOT a security boundary — the security is the role grants.
    // It catches the mistake that actually happens at midnight.
    if (/^\s*(update|delete)\b/i.test(sql) && !/\bwhere\b/i.test(sql)) {
      return res.status(400).json({ message: "Refusing an UPDATE or DELETE with no WHERE clause." });
    }

    const client = await getConsoleWritePool().connect();
    try {
      await client.query("BEGIN");
      await client.query("SET LOCAL statement_timeout = 15000");
      const result = await client.query({ text: sql, values: [] });

      // You stated the blast radius up front. If reality disagrees, nothing happens.
      if (result.rowCount !== expectRows) {
        await client.query("ROLLBACK");
        await consoleAudit(req, {
          tier: "breakglass", action: "sql.write.rolled_back", statement: sql,
          rowCount: result.rowCount, reason: elevation.reason, elevationId: elevation.id,
          durationMs: Date.now() - started,
        });
        return res.status(409).json({
          message: `You expected ${expectRows} row(s); the statement affected ${result.rowCount}. Rolled back, nothing changed.`,
          rowCount: result.rowCount,
        });
      }

      await client.query("COMMIT");
      await consoleAudit(req, {
        tier: "breakglass", action: "sql.write", statement: sql,
        rowCount: result.rowCount, reason: elevation.reason, elevationId: elevation.id,
        durationMs: Date.now() - started,
      });
      res.json({ success: true, rowCount: result.rowCount });
    } catch (e: any) {
      await client.query("ROLLBACK").catch(() => {});
      await consoleAudit(req, {
        tier: "breakglass", action: "sql.write.failed", statement: sql,
        reason: elevation.reason, elevationId: elevation.id, durationMs: Date.now() - started,
      });
      res.status(400).json({ message: e.message });
    } finally {
      client.release();
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // School deletion — now a reversible, two-stage process
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Stage 1: soft-delete. Reversible with school.reactivate.
   * Previously this endpoint destroyed a school's entire year of records behind
   * a single JSON boolean, with no audit entry and no undo.
   */
  app.post("/api/owner/db/danger/wipe-school/:schoolId", ownerOnly, async (req, res) => {
    const schoolId = String(req.params.schoolId);
    const parsed = z.object({
      confirmCode: z.string().min(1, "Type the school's code to confirm."),
      reason: z.string().min(20, "Record why this school is being deleted."),
    }).safeParse(req.body);

    const school = await storage.getSchoolById(schoolId);
    if (!school) return res.status(404).json({ message: "School not found." });

    if (!parsed.success) {
      return res.status(400).json({
        message: `To delete "${school.name}", type its school code and give a reason.`,
        requiresConfirm: true,
        expectedCodeHint: `${String(school.code ?? "").slice(0, 2)}…`,
      });
    }
    // Typing the code proves intent in a way a checkbox cannot.
    if (parsed.data.confirmCode.trim().toUpperCase() !== String(school.code ?? "").trim().toUpperCase()) {
      await consoleAudit(req, {
        tier: "operation", action: "school.soft_delete.code_mismatch",
        schoolId, reason: parsed.data.reason,
      });
      return res.status(400).json({ message: "That school code doesn't match. Nothing was changed." });
    }

    await storage.updateSchool(schoolId, { status: "pending_deletion" } as any);
    await consoleAudit(req, {
      tier: "operation", action: "school.soft_delete",
      schoolId, statement: `Soft-delete ${school.name} (${school.code})`,
      beforeSnapshot: { status: school.status },
      afterSnapshot: { status: "pending_deletion" },
      reason: parsed.data.reason,
    });

    void notifyOtherOwners(req, null, `School "${school.name}" marked for deletion: ${parsed.data.reason}`, null);

    res.json({
      success: true,
      softDeleted: true,
      message: `"${school.name}" is marked for deletion. No data has been removed. ` +
               `It can be restored with "Reactivate school" for the next 7 days, after which it can be purged.`,
      purgeAvailableAfter: new Date(Date.now() + PURGE_COOLDOWN_MS).toISOString(),
    });
  });

  /**
   * Stage 2: the irreversible purge. Requires the school to have been soft-deleted
   * at least PURGE_COOLDOWN_MS ago — enforced by reading console_audit, so the
   * waiting period is backed by the append-only trail rather than a mutable column.
   */
  app.post("/api/owner/db/danger/purge-school/:schoolId", ownerOnly, requireElevation, async (req, res) => {
    const schoolId = String(req.params.schoolId);
    const parsed = z.object({
      confirmCode: z.string().min(1),
      totp: z.string().regex(/^\d{6}$/),
    }).safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "The school code and a fresh 6-digit code are both required." });
    }

    const school = await storage.getSchoolById(schoolId);
    if (!school) return res.status(404).json({ message: "School not found." });
    if (school.status !== "pending_deletion") {
      return res.status(409).json({ message: "Soft-delete the school first. Purge is only available afterwards." });
    }
    if (parsed.data.confirmCode.trim().toUpperCase() !== String(school.code ?? "").trim().toUpperCase()) {
      return res.status(400).json({ message: "That school code doesn't match." });
    }

    // A fresh factor, even inside an active elevation. This is the one action
    // that gets its own gate.
    const user = await storage.getUserById(req.session.userId!);
    if (!user?.mfaSecret || !verifyTOTP(user.mfaSecret, parsed.data.totp)) {
      await consoleAudit(req, { tier: "breakglass", action: "school.purge.denied", schoolId });
      return res.status(401).json({ message: "That code didn't match." });
    }

    const { rows } = await getPool().query(
      `SELECT created_at FROM console_audit
       WHERE action = 'school.soft_delete' AND school_id = $1
       ORDER BY created_at DESC LIMIT 1`,
      [schoolId],
    );
    const softDeletedAt = rows[0]?.created_at ? new Date(rows[0].created_at).getTime() : null;
    if (!softDeletedAt) {
      return res.status(409).json({ message: "No soft-delete on record for this school. Purge refused." });
    }
    const waited = Date.now() - softDeletedAt;
    if (waited < PURGE_COOLDOWN_MS) {
      const daysLeft = Math.ceil((PURGE_COOLDOWN_MS - waited) / 86_400_000);
      return res.status(409).json({
        message: `This school was marked for deletion ${Math.floor(waited / 86_400_000)} day(s) ago. ` +
                 `Purge becomes available in ${daysLeft} day(s).`,
      });
    }

    await consoleAudit(req, {
      tier: "breakglass", action: "school.purge.started", schoolId,
      statement: `PURGE ${school.name} (${school.code})`,
      beforeSnapshot: { name: school.name, code: school.code, status: school.status },
      reason: req.session.consoleElevation?.reason ?? null,
      elevationId: req.session.consoleElevation?.id ?? null,
    });

    await storage.deleteSchoolAndRelatedData(schoolId);

    await consoleAudit(req, {
      tier: "breakglass", action: "school.purge.completed", schoolId,
      elevationId: req.session.consoleElevation?.id ?? null,
    });

    res.json({ success: true, message: `All data for "${school.name}" has been permanently removed.` });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // The audit trail itself
  // ═══════════════════════════════════════════════════════════════════════════

  app.get("/api/owner/console/audit", ownerOnly, async (req, res) => {
    const limit = Math.min(200, Math.max(1, parseInt(String(req.query.limit || "50"), 10) || 50));
    const schoolId = typeof req.query.schoolId === "string" ? req.query.schoolId.trim() : "";
    try {
      const { rows } = schoolId
        ? await getPool().query(
            `SELECT * FROM console_audit WHERE school_id = $1 ORDER BY created_at DESC LIMIT $2`,
            [schoolId, limit])
        : await getPool().query(
            `SELECT * FROM console_audit ORDER BY created_at DESC LIMIT $1`, [limit]);
      res.json({ entries: rows });
    } catch (e: any) {
      console.error("[console] audit read", e.message);
      res.status(500).json({ message: "Could not read the audit trail." });
    }
  });
}

/**
 * Tell the OTHER platform owners that write access was opened, or that a school
 * was marked for deletion. With a single shared master account this notifies
 * nobody — which is one of several reasons each operator needs their own login.
 */
async function notifyOtherOwners(
  req: Request,
  actor: { id: string; email?: string | null; username?: string } | null,
  reason: string,
  elevationId: string | null,
): Promise<void> {
  try {
    const { sendConsoleAlertEmail } = await import("../email.js");

    const all = await storage.getUsers();
    const owners = all.filter(
      (u: any) => isPlatformOwnerRole(u.role) && u.email && u.id !== req.session.userId,
    );
    if (!owners.length) return;

    const who = actor?.username ?? req.session.username ?? "a platform administrator";
    const lines = [
      `${who} opened break-glass write access on the BytHub console.`,
      `Reason given: ${reason}`,
      ...(elevationId ? [`Elevation id: ${elevationId}`] : []),
      `Time: ${new Date().toISOString()}`,
    ];
    await Promise.allSettled(
      owners.map((o: any) =>
        sendConsoleAlertEmail(o.email!, "ScholarShelf: console write access opened", lines),
      ),
    );
  } catch (e: any) {
    console.error("[console] owner notification failed:", e?.message);
  }
}
