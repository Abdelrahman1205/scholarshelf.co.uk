/**
 * server/routes/db-console.routes.ts
 *
 * BytHub DB Console — owner-only database administration endpoints.
 * Uses getPool() (node-postgres) for raw parameterized SQL.
 * All routes require PLATFORM_OWNER_ROLES.
 */
import type { Express } from "express";
import { requireRole } from "../middleware/auth.js";
import { PLATFORM_OWNER_ROLES } from "../core/constants.js";
import { getPool } from "../config/database.js";
import { storage } from "../storage.js";

const ALLOWED_TABLES = [
  "schools",
  "school_branding",
  "users",
  "user_roles",
  "classes",
  "students",
  "parent_children",
  "child_linking_codes",
  "books",
  "book_levels",
  "class_book_levels",
  "student_book_overrides",
  "book_baskets",
  "basket_items",
  "book_payments",
  "payment_basket_links",
  "allocations",
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

function isMutatingQuery(q: string): boolean {
  return /^\s*(insert|update|delete)\b/i.test(q);
}

export function registerDbConsoleRoutes(app: Express): void {
  const ownerOnly = requireRole(...PLATFORM_OWNER_ROLES);

  // ── List tables ────────────────────────────────────────────────────────────
  app.get("/api/owner/db/tables", ownerOnly, (_req, res) => {
    res.json({ tables: ALLOWED_TABLES });
  });

  // ── Browse table rows ──────────────────────────────────────────────────────
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

      const pool = getPool();
      const conditions: string[] = [];
      const params: unknown[] = [];
      let idx = 1;

      if (schoolId) { conditions.push(`school_id = $${idx++}`); params.push(schoolId); }
      if (search)   { conditions.push(`(id::text ILIKE $${idx} OR COALESCE(name, '')::text ILIKE $${idx})`); params.push(`%${search}%`); idx++; }

      const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

      const countResult = await pool.query(
        `SELECT COUNT(*) AS count FROM "${table}" ${where}`,
        params
      );
      const total = parseInt(countResult.rows[0]?.count ?? "0", 10);

      const rowsResult = await pool.query(
        `SELECT * FROM "${table}" ${where} ORDER BY created_at DESC NULLS LAST, id LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, limit, offset]
      );

      const columns = rowsResult.fields.map((f) => f.name);

      res.json({ table, page, limit, total, pages: Math.ceil(total / limit), rows: rowsResult.rows, columns });
    } catch (e: any) {
      console.error("[db-console] browse", e.message);
      res.status(500).json({ message: e.message || "Query failed" });
    }
  });

  // ── Update a row ───────────────────────────────────────────────────────────
  app.patch("/api/owner/db/tables/:table/:id", ownerOnly, async (req, res) => {
    try {
      const table = String(req.params.table); const id = String(req.params.id);
      if (!isAllowedTable(table)) return res.status(400).json({ message: `Table '${table}' is not accessible.` });

      const updates = req.body as Record<string, unknown>;
      const READONLY = ["id", "created_at"];
      const fields = Object.keys(updates).filter((k) => !READONLY.includes(k));
      if (!fields.length) return res.status(400).json({ message: "No updatable fields." });

      const pool = getPool();
      const setClauses = fields.map((k, i) => `"${k}" = $${i + 2}`).join(", ");
      const values: unknown[] = [id, ...fields.map((k) => updates[k])];

      await pool.query(`UPDATE "${table}" SET ${setClauses} WHERE id = $1`, values);
      const result = await pool.query(`SELECT * FROM "${table}" WHERE id = $1`, [id]);
      res.json({ success: true, row: result.rows[0] ?? null });
    } catch (e: any) {
      console.error("[db-console] update", e.message);
      res.status(500).json({ message: e.message || "Update failed" });
    }
  });

  // ── Delete a row ───────────────────────────────────────────────────────────
  app.delete("/api/owner/db/tables/:table/:id", ownerOnly, async (req, res) => {
    try {
      const table = String(req.params.table); const id = String(req.params.id);
      if (!isAllowedTable(table)) return res.status(400).json({ message: `Table '${table}' is not accessible.` });

      const pool = getPool();
      await pool.query(`DELETE FROM "${table}" WHERE id = $1`, [id]);
      res.json({ success: true });
    } catch (e: any) {
      console.error("[db-console] delete", e.message);
      res.status(500).json({ message: e.message || "Delete failed" });
    }
  });

  // ── SQL Console ────────────────────────────────────────────────────────────
  app.post("/api/owner/db/query", ownerOnly, async (req, res) => {
    try {
      const { query, dangerConfirm } = req.body as { query: string; dangerConfirm?: boolean };
      if (!query || typeof query !== "string") return res.status(400).json({ message: "query is required." });

      // Block DDL always
      if (/\b(drop|truncate|alter|create)\b/i.test(query)) {
        return res.status(403).json({ message: "DDL statements (DROP, TRUNCATE, ALTER, CREATE) are blocked." });
      }

      if (isMutatingQuery(query) && !dangerConfirm) {
        return res.status(400).json({ message: "Mutating query — send dangerConfirm: true to execute.", requiresConfirm: true });
      }

      const pool = getPool();
      const start = Date.now();
      const result = await pool.query(query);
      const durationMs = Date.now() - start;

      res.json({
        rows: result.rows ?? [],
        rowCount: result.rowCount ?? result.rows?.length ?? 0,
        columns: result.fields?.map((f) => f.name) ?? [],
        durationMs,
      });
    } catch (e: any) {
      console.error("[db-console] SQL", e.message);
      res.status(500).json({ message: e.message || "Query failed" });
    }
  });

  // ── Danger: wipe all school data ──────────────────────────────────────────
  app.post("/api/owner/db/danger/wipe-school/:schoolId", ownerOnly, async (req, res) => {
    try {
      const schoolId = String(req.params.schoolId);
      const { dangerConfirm } = req.body as { dangerConfirm?: boolean };
      if (!dangerConfirm) return res.status(400).json({ message: "Send dangerConfirm: true to proceed.", requiresConfirm: true });

      const school = await storage.getSchoolById(schoolId);
      if (!school) return res.status(404).json({ message: "School not found." });

      await storage.deleteSchoolAndRelatedData(schoolId);
      res.json({ success: true, message: `All data for '${school.name}' (${school.code}) has been wiped.` });
    } catch (e: any) {
      console.error("[db-console] wipe", e.message);
      res.status(500).json({ message: e.message || "Wipe failed" });
    }
  });
}
