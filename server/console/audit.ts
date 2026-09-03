/**
 * server/console/audit.ts
 *
 * The console's audit trail.
 *
 * Every console browse, read-only query, and typed support operation is
 * recorded here. The console previously had no equivalent audit trail even
 * though it can expose data across tenants.
 *
 * This is what answers a school's data protection officer when they ask
 * "who at your company looked at my pupils' records, and can you show me?"
 * It also supports incident and UK GDPR breach assessment.
 *
 * Audit writes go through the APPLICATION pool. The dedicated console_ro
 * connection is intentionally incapable of writing.
 */
import type { Request } from "express";
import { getPool } from "../config/database.js";
import { clientIp } from "../middleware/auth.js";

export type ConsoleTier = "operation" | "query";

export type ConsoleAuditEntry = {
  tier: ConsoleTier;
  action: string;
  schoolId?: string | null;
  statement?: string | null;
  params?: unknown;
  beforeSnapshot?: unknown;
  afterSnapshot?: unknown;
  rowCount?: number | null;
  durationMs?: number | null;
  reason?: string | null;
};

/** Cap any single snapshot so one `SELECT *` on a big table can't bloat the trail. */
const MAX_SNAPSHOT_BYTES = 64 * 1024;

function toJson(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  try {
    const s = JSON.stringify(value);
    if (s.length > MAX_SNAPSHOT_BYTES) {
      return JSON.stringify({
        truncated: true,
        bytes: s.length,
        note: "Snapshot exceeded the audit size cap and was not stored in full.",
      });
    }
    return s;
  } catch {
    return JSON.stringify({ error: "value was not serialisable" });
  }
}

/**
 * Record a console action.
 *
 * Deliberately best-effort: an audit failure must never block the operator from
 * finishing a support task. But unlike the application's auditLog, a failure here
 * is logged at ERROR with a marker, because a silent gap in THIS trail is a
 * compliance problem rather than a missing convenience.
 */
export async function consoleAudit(req: Request, entry: ConsoleAuditEntry): Promise<void> {
  try {
    const actorId = req.session?.userId ?? "unknown";
    const actorUsername = req.session?.username ?? actorId;
    const actorRole = req.session?.role ?? null;

    await getPool().query(
      `INSERT INTO console_audit (
         actor_user_id, actor_username, actor_role, tier, action, school_id,
         statement, params, before_snapshot, after_snapshot,
         row_count, duration_ms, reason, ip, user_agent
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10::jsonb,$11,$12,$13,$14,$15)`,
      [
        actorId,
        actorUsername,
        actorRole,
        entry.tier,
        entry.action,
        entry.schoolId ?? null,
        entry.statement ?? null,
        toJson(entry.params),
        toJson(entry.beforeSnapshot),
        toJson(entry.afterSnapshot),
        entry.rowCount ?? null,
        entry.durationMs ?? null,
        entry.reason ?? null,
        clientIp(req),
        (req.headers["user-agent"] as string) || null,
      ],
    );
  } catch (e: any) {
    // Loud on purpose. A gap in the console audit trail is not routine.
    console.error(
      `[console:audit] FAILED TO RECORD "${entry.action}" (${entry.tier}) — ${e?.message}`,
    );
  }
}
