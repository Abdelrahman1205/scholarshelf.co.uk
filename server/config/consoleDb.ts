/**
 * server/config/consoleDb.ts
 *
 * Dedicated least-privilege connection pool for the BytHub support console.
 *
 * This pool is deliberately separate from getPool() in database.ts, which also
 * backs authentication/session activity. A slow support query must never be able
 * to exhaust the application's main pool.
 *
 * Database enforcement:
 *   console_ro
 *     - SELECT only on the console schema of support-safe views
 *     - no privileges on public tables
 *     - default_transaction_read_only = on
 *
 * Typed support operations do not use this pool. They run through the normal
 * application authorization/storage layer and are independently audit logged.
 *
 * See migrations/001_console_hardening.sql.
 */
import { Pool } from "pg";
import { buildSslConfig } from "./database.js";
import { env } from "./env.js";

let _ro: Pool | null = null;

export function isConsoleConfigured(): boolean {
  return !!env.CONSOLE_RO_DATABASE_URL;
}

/** Read-only pool. Every console browse/query goes through this connection. */
export function getConsoleReadPool(): Pool {
  if (_ro) return _ro;

  if (!env.CONSOLE_RO_DATABASE_URL) {
    throw new Error(
      "[console] CONSOLE_RO_DATABASE_URL is not configured. Apply " +
      "migrations/001_console_hardening.sql, provision the console_ro login " +
      "credential securely, and set its connection string.",
    );
  }

  _ro = new Pool({
    connectionString: env.CONSOLE_RO_DATABASE_URL,
    ssl: buildSslConfig(env.CONSOLE_RO_DATABASE_URL),
    max: 2,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 5_000,
  });

  _ro.on("error", (err) =>
    console.error("[console:ro] idle client error", err.message),
  );

  return _ro;
}
