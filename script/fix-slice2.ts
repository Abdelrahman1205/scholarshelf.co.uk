/**
 * script/fix-slice2.ts
 *
 * Safe, idempotent application of the Slice-2 schema change WITHOUT running
 * `drizzle-kit push` (which wanted to TRUNCATE the families table to add a
 * unique constraint, and aborted on pre-existing orphaned student data).
 *
 * What it does — all inside one transaction, and nothing else:
 *   1. Reports + repairs orphaned students whose family_id points at a family
 *      that no longer exists (sets those family_id back to NULL — the same
 *      self-healing the app already does). This is what blocked db:push.
 *   2. Adds guardians.user_id (nullable) + the ON DELETE SET NULL FK to users,
 *      only if they don't already exist.
 *   3. Prints a read-only report of NULL / duplicate family_code values so we
 *      can later decide how to add families_family_code_unique safely — it does
 *      NOT add that constraint and NEVER truncates families.
 *
 * Run:  npx tsx script/fix-slice2.ts
 * Re-runnable: yes (idempotent).
 */
import "dotenv/config";
import { Pool } from "pg";

async function main() {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) {
    console.error("✗ DATABASE_URL is not set. Aborting.");
    process.exit(1);
  }

  const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });
  const client = await pool.connect();

  try {
    console.log("── Slice 2 safe apply ──────────────────────────────\n");

    // 1. Inspect orphaned students (family_id -> missing family)
    const orphans = await client.query(
      `SELECT s.id, s.family_id
         FROM students s
    LEFT JOIN families f ON f.id = s.family_id
        WHERE s.family_id IS NOT NULL AND f.id IS NULL`,
    );
    console.log(`Orphaned students (dangling family_id): ${orphans.rowCount}`);
    for (const r of orphans.rows) console.log(`   student ${r.id} -> missing family ${r.family_id}`);

    await client.query("BEGIN");

    // Repair the orphans first, so the FK stays valid.
    const repaired = await client.query(
      `UPDATE students AS s
          SET family_id = NULL
         FROM (SELECT s2.id
                 FROM students s2
            LEFT JOIN families f ON f.id = s2.family_id
                WHERE s2.family_id IS NOT NULL AND f.id IS NULL) AS bad
        WHERE s.id = bad.id`,
    );
    console.log(`\n✓ Repaired ${repaired.rowCount} orphaned student(s) (family_id -> NULL)`);

    // 2. Add guardians.user_id column (idempotent)
    await client.query(
      `ALTER TABLE guardians ADD COLUMN IF NOT EXISTS user_id varchar(36)`,
    );
    console.log("✓ Ensured column guardians.user_id");

    // Add the FK (ON DELETE SET NULL) only if it isn't already present.
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'guardians_user_id_users_id_fk'
        ) THEN
          ALTER TABLE guardians
            ADD CONSTRAINT guardians_user_id_users_id_fk
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
        END IF;
      END $$;
    `);
    console.log("✓ Ensured FK guardians.user_id -> users.id (ON DELETE SET NULL)");

    await client.query("COMMIT");

    // 3. Read-only report on family_code (for a future unique constraint)
    const dupes = await client.query(
      `SELECT family_code, COUNT(*) AS n
         FROM families
        WHERE family_code IS NOT NULL
     GROUP BY family_code
       HAVING COUNT(*) > 1`,
    );
    const nulls = await client.query(
      `SELECT COUNT(*) AS n FROM families WHERE family_code IS NULL`,
    );
    console.log("\n── family_code hygiene (informational only) ──");
    console.log(`   families with NULL family_code : ${nulls.rows[0].n}`);
    console.log(`   duplicate family_code values    : ${dupes.rowCount}`);
    for (const r of dupes.rows) console.log(`      "${r.family_code}" x${r.n}`);
    if (Number(nulls.rows[0].n) === 0 && dupes.rowCount === 0) {
      console.log("   → family_code is clean; the unique constraint could be added later safely.");
    } else {
      console.log("   → resolve NULL/duplicate family_code before adding families_family_code_unique.");
    }

    console.log("\n✓ Done. guardians.user_id is applied. You did NOT truncate families.\n");
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
