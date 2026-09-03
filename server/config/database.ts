/**
 * server/config/database.ts
 *
 * Drizzle ORM + pg Pool setup — imported by repositories, NOT by routes.
 * Follows the Dependency Inversion Principle: routes depend on the
 * repository interface, not on this concrete infrastructure module.
 */
import { Pool } from "pg";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import { drizzle as drizzlePg, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { neon } from "@neondatabase/serverless";
import { env } from "./env.js";
import * as schema from "../../shared/schema.js";

// ── SSL configuration ─────────────────────────────────────────────────────

function isLocalDatabaseUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "::1" ||
      host === "[::1]"
    );
  } catch {
    return false;
  }
}

export function buildSslConfig(
  url: string | undefined = env.DATABASE_URL,
): object | false | undefined {
  if (!url) return undefined;

  // Local PostgreSQL commonly runs without TLS.
  if (isLocalDatabaseUrl(url)) return false;

  // Remote PostgreSQL must verify the server certificate.
  // Node's platform trust store is used unless an explicit CA is supplied.
  const ca = env.DATABASE_SSL_CA;

  return ca
    ? { rejectUnauthorized: true, ca }
    : { rejectUnauthorized: true };
}

// ── Drizzle (Neon serverless HTTP) ────────────────────────────────────────

let _db: NeonHttpDatabase<typeof schema> | null = null;

export function getDb(): NeonHttpDatabase<typeof schema> {
  if (_db) return _db;
  if (!env.DATABASE_URL) {
    throw new Error("[DB] DATABASE_URL is not configured.");
  }
  const sql = neon(env.DATABASE_URL);
  _db = drizzle(sql, { schema });
  return _db;
}

// ── pg Pool (for connect-pg-simple session store) ─────────────────────────

let _pool: Pool | null = null;

export function getPool(): Pool {
  if (_pool) return _pool;
  if (!env.DATABASE_URL) {
    throw new Error("[DB] DATABASE_URL is not configured.");
  }
  _pool = new Pool({
    connectionString: env.DATABASE_URL,
    ssl: buildSslConfig(env.DATABASE_URL),
  });
  return _pool;
}

// ── Transaction-capable Drizzle (node-postgres over the pool) ─────────────
// The Neon HTTP driver (getDb) does NOT support interactive transactions.
// For atomic multi-statement work (e.g. family enrollment) use getTxDb(),
// which runs over the pg Pool and supports db.transaction().
let _txDb: NodePgDatabase<typeof schema> | null = null;

export function getTxDb(): NodePgDatabase<typeof schema> {
  if (_txDb) return _txDb;
  _txDb = drizzlePg(getPool(), { schema });
  return _txDb;
}
