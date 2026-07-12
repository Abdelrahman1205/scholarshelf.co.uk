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
import { env, IS_PRODUCTION } from "./env.js";
import * as schema from "../../shared/schema.js";

// ── SSL configuration ─────────────────────────────────────────────────────

export function buildSslConfig(): object | undefined {
  if (!env.DATABASE_URL) return undefined;

  const ca = env.DATABASE_SSL_CA;
  if (ca) return { rejectUnauthorized: true, ca };

  if (IS_PRODUCTION) {
    // Slice 6: validate the production TLS posture. Running without a pinned CA
    // disables certificate verification, leaving the DB connection open to a
    // man-in-the-middle. To avoid a surprise outage on a LIVE app we don't hard-fail
    // by default — we warn loudly. Set DATABASE_SSL_STRICT=true to turn the warning
    // into a hard startup failure once DATABASE_SSL_CA is in place.
    if (process.env.DATABASE_SSL_STRICT === "true") {
      throw new Error(
        "[DB] Refusing to start: DATABASE_SSL_STRICT=true but DATABASE_SSL_CA is not " +
        "set, so TLS certificate verification would be disabled. Provide the Neon CA " +
        "cert in DATABASE_SSL_CA, or unset DATABASE_SSL_STRICT to fall back to a warning.",
      );
    }
    console.warn(
      "[DB] SECURITY: DATABASE_SSL_CA is not set — SSL certificate verification is " +
      "DISABLED (MitM risk). Set DATABASE_SSL_CA to the Neon CA cert, then set " +
      "DATABASE_SSL_STRICT=true to enforce it.",
    );
  }
  return { rejectUnauthorized: false };
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
    ssl: buildSslConfig(),
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
