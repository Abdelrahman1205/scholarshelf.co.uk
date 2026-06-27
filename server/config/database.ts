/**
 * server/config/database.ts
 *
 * Drizzle ORM + pg Pool setup — imported by repositories, NOT by routes.
 * Follows the Dependency Inversion Principle: routes depend on the
 * repository interface, not on this concrete infrastructure module.
 */
import { Pool } from "pg";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { env, IS_PRODUCTION } from "./env.js";
import * as schema from "../../shared/schema.js";

// ── SSL configuration ─────────────────────────────────────────────────────

export function buildSslConfig(): object | undefined {
  if (!env.DATABASE_URL) return undefined;

  const ca = env.DATABASE_SSL_CA;
  if (ca) return { rejectUnauthorized: true, ca };

  if (IS_PRODUCTION) {
    console.warn(
      "[DB] DATABASE_SSL_CA is not set. SSL certificate verification is " +
      "disabled. Set DATABASE_SSL_CA to the Neon CA cert for full MitM protection.",
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
