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

/**
 * True when the target Postgres is local or has TLS explicitly disabled.
 * Hosted databases (Neon, RDS, Supabase) never match, so production posture is
 * untouched.
 */
function isPlaintextDatabase(url: string): boolean {
  try {
    const parsed = new URL(url);
    const sslmode = parsed.searchParams.get("sslmode");
    if (sslmode === "disable") return true;
    if (sslmode && sslmode !== "disable") return false;
    const host = parsed.hostname.toLowerCase();
    return host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "[::1]";
  } catch {
    return false;
  }
}

export function buildSslConfig(): object | false | undefined {
  if (!env.DATABASE_URL) return undefined;

  // A local or explicitly plaintext server does not speak TLS, and pg fails
  // with "The server does not support SSL connections" rather than falling
  // back. This is why the app could not run against a local Postgres — and
  // therefore why the database-backed suites could not run in CI.
  if (isPlaintextDatabase(env.DATABASE_URL)) return false;

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

// ── The read/write handle ─────────────────────────────────────────────────
//
// Two drivers, chosen by the connection string:
//
//   Neon host  → neon-http. One HTTPS round trip per statement, no connection
//                to keep alive. This is what makes the app viable on Vercel,
//                where every request may be a cold start.
//   Anything   → node-postgres over the pool. The Neon HTTP driver builds its
//   else         endpoint by rewriting the hostname, so a plain Postgres URL
//                becomes nonsense like https://api.0.0.1/sql and every query
//                fails. That single fact made local Postgres and CI unusable
//                for anything that touched storage, which is why the database-
//                backed test suites have never run anywhere but Neon.
//
// Both drivers expose the same Drizzle query builder, so callers do not care
// which one they got.

/**
 * One type for both drivers.
 *
 * A union would be more literally true, but TypeScript resolves a union of two
 * generic query builders to the intersection of their call signatures, which
 * rejects ordinary calls like `.returning({ id: users.id })` at ~150 call sites.
 * The two drivers implement the same Drizzle query-builder surface at runtime,
 * so the pg type is used as the shared shape and the Neon handle is asserted
 * into it in exactly one place — here.
 */
export type AppDatabase = NodePgDatabase<typeof schema>;

/** Neon's HTTP driver only understands Neon hostnames. */
export function isNeonUrl(url: string): boolean {
  try {
    return /(^|\.)neon\.(tech|build)$/i.test(new URL(url).hostname);
  } catch {
    return false;
  }
}

let _db: AppDatabase | null = null;

export function getDb(): AppDatabase {
  if (_db) return _db;
  if (!env.DATABASE_URL) {
    throw new Error("[DB] DATABASE_URL is not configured.");
  }
  if (isNeonUrl(env.DATABASE_URL)) {
    _db = drizzle(neon(env.DATABASE_URL), { schema }) as unknown as AppDatabase;
  } else {
    _db = drizzlePg(getPool(), { schema });
  }
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
