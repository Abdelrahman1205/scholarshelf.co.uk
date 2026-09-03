/**
 * server/routes/db-console.routes.ts
 *
 * BytHub DB Console — owner-only, READ-ONLY database browse.
 *
 * WHAT THIS FILE DELIBERATELY DOES NOT CONTAIN
 *
 * It used to expose three things that were removed on 2 September 2026 under
 * the Legal & Compliance directive (Phase A.3):
 *
 *   · POST /api/owner/db/query — an arbitrary SQL runner whose only guards were
 *     first-word regexes. A data-modifying CTE, a multi-statement body or a
 *     leading comment walked straight through it, against the production
 *     database, over HTTP.
 *   · PATCH/DELETE /api/owner/db/tables/:table/:id — unaudited direct row edits
 *     and deletes on any allow-listed table, interpolating client-supplied JSON
 *     keys into the SQL text.
 *   · POST /api/owner/db/danger/wipe-school/:id — a non-transactional wipe of a
 *     whole tenant behind a single `dangerConfirm: true` flag.
 *
 * None of them are coming back to the HTTP surface. Support work that needs to
 * change data belongs in the typed operations in `server/console/operations.ts`,
 * where each operation is a bounded, named, audited action; tenant deletion
 * belongs to the school lifecycle in `owner.routes.ts`, which carries the
 * cooldown and the audit trail.
 */
import type { Express } from "express";
import { requireRole } from "../middleware/auth.js";
import { PLATFORM_OWNER_ROLES } from "../core/constants.js";
import { getConsoleReadPool } from "../config/consoleDb.js";
import { consoleAudit } from "../console/audit.js";

const ALLOWED_TABLES = [
  "schools",
  "school_branding",
  "users",
  "classes",
  "students",
  "parent_children",
  "child_linking_codes",
  "books",
  "book_levels",
  "class_book_levels",
  "child_book_baskets",
  "basket_items",
  "basket_payments",
  "book_payments",
  "finance_book_allocations",
  "extra_copy_requests",
  "families",
  "family_students",
  "audit_logs",
  "invites",
] as const;

type AllowedTable = typeof ALLOWED_TABLES[number];

function isAllowedTable(t: string): t is AllowedTable {
  return (ALLOWED_TABLES as readonly string[]).includes(t);
}

/**
 * Verified against the current database schema.
 *
 * Do not assume every support-console table has the same columns. The previous
 * route blindly referenced name, school_id and created_at, which made valid
 * allow-listed tables fail at runtime.
 */
const NAME_SEARCH_TABLES = new Set<AllowedTable>([
  "schools",
  "users",
  "classes",
  "students",
  "book_levels",
  "families",
]);

const SCHOOL_SCOPED_TABLES = new Set<AllowedTable>([
  "school_branding",
  "users",
  "classes",
  "students",
  "parent_children",
  "child_linking_codes",
  "books",
  "book_levels",
  "child_book_baskets",
  "basket_payments",
  "book_payments",
  "finance_book_allocations",
  "extra_copy_requests",
  "families",
  "invites",
]);

/**
 * Columns that must never reach a browser, whichever table they appear on.
 *
 * `SELECT *` on `users` previously returned `password_hash` and `mfa_secret` to
 * the console UI. Matching on the column NAME rather than a per-table list means
 * a secret added to a new table tomorrow is redacted by default rather than
 * leaking until someone remembers to update this file.
 */
const SECRET_COLUMN = /(password|secret|token|hash|recovery|salt|otp)/i;

function redactRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    out[key] = SECRET_COLUMN.test(key) && value != null ? "[redacted]" : value;
  }
  return out;
}

export function registerDbConsoleRoutes(app: Express): void {
  const ownerOnly = requireRole(...PLATFORM_OWNER_ROLES);

  // ── List browsable tables ──────────────────────────────────────────────────
  app.get("/api/owner/db/tables", ownerOnly, (_req, res) => {
    res.json({ tables: ALLOWED_TABLES, readOnly: true });
  });

  // ── Browse table rows (read-only, redacted, audited) ───────────────────────
  app.get("/api/owner/db/tables/:table", ownerOnly, async (req, res) => {
    try {
      const table = String(req.params.table);
      if (!isAllowedTable(table)) {
        return res.status(400).json({ message: `Table '${table}' is not accessible.` });
      }

      const page = Math.max(1, parseInt(String(req.query.page || "1"), 10));
      const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || "50"), 10)));
      const offset = (page - 1) * limit;
      const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
      const schoolId = typeof req.query.schoolId === "string" ? req.query.schoolId.trim() : "";

      // SECURITY: database browsing must never fall back to the application's
      // privileged DATABASE_URL. The dedicated console_ro connection can read
      // only the reviewed console-schema views.
      const pool = getConsoleReadPool();
      const conditions: string[] = [];
      const params: unknown[] = [];
      let idx = 1;

      if (schoolId) {
        if (table === "schools") {
          conditions.push(`id = $${idx++}`);
          params.push(schoolId);
        } else if (SCHOOL_SCOPED_TABLES.has(table)) {
          conditions.push(`school_id = $${idx++}`);
          params.push(schoolId);
        } else {
          return res.status(400).json({
            message: `School filtering is not supported for table '${table}'.`,
          });
        }
      }

      if (search) {
        if (NAME_SEARCH_TABLES.has(table)) {
          conditions.push(
            `(id::text ILIKE $${idx} OR COALESCE(name, '')::text ILIKE $${idx})`,
          );
        } else {
          conditions.push(`id::text ILIKE $${idx}`);
        }
        params.push(`%${search}%`);
        idx++;
      }

      const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

      const countResult = await pool.query(
        `SELECT COUNT(*) AS count FROM console."${table}" ${where}`,
        params
      );
      const total = parseInt(countResult.rows[0]?.count ?? "0", 10);

      const rowsResult = await pool.query(
        `SELECT * FROM console."${table}" ${where} ORDER BY id LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, limit, offset]
      );

      const columns = rowsResult.fields.map((f) => f.name);
      const rows = rowsResult.rows.map(redactRow);

      // GDPR Art. 30/33: reading a tenant's records from the platform console is
      // a processing activity by BytHub staff, and it is attributable.
      await consoleAudit(req, {
        tier: "query",
        action: "console_table_browsed",
        schoolId: schoolId || null,
        rowCount: rows.length,
        params: {
          table,
          page,
          limit,
          total,
          searchApplied: Boolean(search),
        },
      });

      res.json({ table, page, limit, total, pages: Math.ceil(total / limit), rows, columns, readOnly: true });
    } catch (e: any) {
      console.error("[db-console] browse", e.message);
      res.status(500).json({ message: "Query failed" });
    }
  });
}
