/**
 * script/apply-slice4.ts
 *
 * Safe, idempotent application of the Slice-4 custody schema WITHOUT drizzle-kit
 * push (which still wants to add families_family_code_unique and prompts). Adds
 * only what Slice 4 needs:
 *   1. finance_book_allocations.custody_status  (text NOT NULL DEFAULT 'reserved')
 *   2. custody_events table (+ FK to finance_book_allocations ON DELETE CASCADE)
 *
 * The per-school backfill that derives real custody state from legacy fields runs
 * automatically on the first GET /api/allocations (guarded), so no data step here.
 *
 * Run:  npx tsx script/apply-slice4.ts     (idempotent, re-runnable)
 */
import "dotenv/config";
import { Pool } from "pg";

async function main() {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) { console.error("✗ DATABASE_URL is not set. Aborting."); process.exit(1); }

  const pool = new Pool({ connectionString });
  const client = await pool.connect();
  try {
    console.log("── Slice 4 safe apply ──────────────────────────────\n");
    await client.query("BEGIN");

    await client.query(
      `ALTER TABLE finance_book_allocations
         ADD COLUMN IF NOT EXISTS custody_status text NOT NULL DEFAULT 'reserved'`,
    );
    console.log("✓ Ensured finance_book_allocations.custody_status (default 'reserved')");

    await client.query(`
      CREATE TABLE IF NOT EXISTS custody_events (
        id            varchar(36) PRIMARY KEY,
        allocation_id varchar(36) NOT NULL REFERENCES finance_book_allocations(id) ON DELETE CASCADE,
        school_id     varchar(36),
        from_status   text,
        to_status     text NOT NULL,
        actor_user_id varchar(36),
        actor_role    text,
        note          text,
        created_at    timestamp DEFAULT now()
      )
    `);
    console.log("✓ Ensured table custody_events (+ FK ON DELETE CASCADE)");

    await client.query(
      `CREATE INDEX IF NOT EXISTS custody_events_allocation_idx ON custody_events(allocation_id)`,
    );
    console.log("✓ Ensured index custody_events_allocation_idx");

    await client.query("COMMIT");

    const cnt = await client.query(`SELECT COUNT(*) AS n FROM finance_book_allocations`);
    console.log(`\n  finance_book_allocations rows: ${cnt.rows[0].n} (custody backfills lazily on first /api/allocations read)`);
    console.log("\n✓ Done. Slice 4 custody schema applied. No families table was touched.\n");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("\n✗ Failed, rolled back:", err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
