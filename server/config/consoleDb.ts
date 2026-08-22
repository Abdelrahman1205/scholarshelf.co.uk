/**
 * server/config/consoleDb.ts
 *
 * Connection pools for the BytHub console.
 *
 * These are deliberately SEPARATE from getPool() in database.ts, which backs the
 * session store. Sharing it meant one runaway console query could exhaust the
 * pool and sign every user out. Both pools here are tiny on purpose: the console
 * is one or two operators, and it must never be able to starve authentication.
 *
 * The privilege split lives in the DATABASE, not in this file:
 *   console_ro  SELECT on the `console` schema of redacted views. No write grants.
 *               default_transaction_read_only = on.
 *   console_rw  DML on public. No DDL. Reachable only via break-glass elevation.
 *
 * See migrations/001_console_hardening.sql.
 */
import { Pool } from "pg";
import { buildSslConfig } from "./database.js";
import { env } from "./env.js";

let _ro: Pool | null = null;
let _rw: Pool | null = null;

export function isConsoleConfigured(): boolean {
  return !!env.CONSOLE_RO_DATABASE_URL;
}

export function isBreakGlassConfigured(): boolean {
  return !!env.CONSOLE_RW_DATABASE_URL;
}

/** Read-only pool. Every console browse and query goes through this. */
export function getConsoleReadPool(): Pool {
  if (_ro) return _ro;
  if (!env.CONSOLE_RO_DATABASE_URL) {
    throw new Error(
      "[console] CONSOLE_RO_DATABASE_URL is not configured. Run " +
      "migrations/001_console_hardening.sql and set the console_ro connection string.",
    );
  }
  _ro = new Pool({
    connectionString: env.CONSOLE_RO_DATABASE_URL,
    ssl: buildSslConfig(),
    max: 2,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 5_000,
  });
  _ro.on("error", (err) => console.error("[console:ro] idle client error", err.message));
  return _ro;
}

/** Write pool. Only ever reached through an active break-glass elevation. */
export function getConsoleWritePool(): Pool {
  if (_rw) return _rw;
  if (!env.CONSOLE_RW_DATABASE_URL) {
    throw new Error(
      "[console] CONSOLE_RW_DATABASE_URL is not configured. Break-glass write " +
      "access is unavailable until the console_rw connection string is set.",
    );
  }
  _rw = new Pool({
    connectionString: env.CONSOLE_RW_DATABASE_URL,
    ssl: buildSslConfig(),
    max: 1,
    idleTimeoutMillis: 5_000,
    connectionTimeoutMillis: 5_000,
  });
  _rw.on("error", (err) => console.error("[console:rw] idle client error", err.message));
  return _rw;
}
