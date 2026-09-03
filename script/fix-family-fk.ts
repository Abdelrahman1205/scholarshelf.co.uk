/**
 * script/fix-family-fk.ts
 *
 * Guarantees students.family_id → families(id) is ON DELETE SET NULL, so deleting
 * a family can never leave orphaned students (family_id pointing at a row that no
 * longer exists). This is the root-cause fix behind the recurring orphans that
 * fix-slice2.ts has been repairing.
 *
 * Steps (idempotent, one transaction):
 *   1. Null any current orphans (so recreating the FK can't fail on violations).
 *   2. Inspect the existing FK's ON DELETE rule.
 *   3. If it isn't SET NULL (or is missing), drop + recreate it as ON DELETE SET NULL.
 *
 * Run:  npx tsx script/fix-family-fk.ts    (re-runnable; safe)
 */
import "dotenv/config";
import { Pool } from "pg";

// pg_constraint.confdeltype codes
const DEL = { a: "NO ACTION", r: "RESTRICT", c: "CASCADE", n: "SET NULL", d: "SET DEFAULT" } as const;

async function main() {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) { console.error("✗ DATABASE_URL is not set. Aborting."); process.exit(1); }

  const pool = new Pool({ connectionString });
  const client = await pool.connect();
  try {
    console.log("── Fix students.family_id FK (ON DELETE SET NULL) ──\n");
    await client.query("BEGIN");

    // 1. Clean current orphans so a fresh FK can be validated.
    const repaired = await client.query(
      `UPDATE students SET family_id = NULL
        WHERE family_id IS NOT NULL
          AND family_id NOT IN (SELECT id FROM families)`,
    );
    console.log(`✓ Nulled ${repaired.rowCount} current orphaned student(s)`);

    // 2. Find the existing FK on students(family_id) -> families.
    const found = await client.query(
      `SELECT con.conname AS name, con.confdeltype AS del
         FROM pg_constraint con
         JOIN pg_class rel  ON rel.oid  = con.conrelid  AND rel.relname  = 'students'
         JOIN pg_class fref ON fref.oid = con.confrelid AND fref.relname = 'families'
        WHERE con.contype = 'f'
          AND (SELECT attname FROM pg_attribute
                WHERE attrelid = con.conrelid AND attnum = con.conkey[1]) = 'family_id'`,
    );

    if (found.rowCount === 0) {
      console.log("• No FK found on students(family_id) → creating one as SET NULL");
      await client.query(
        `ALTER TABLE students
           ADD CONSTRAINT students_family_id_families_id_fk
           FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE SET NULL`,
      );
      console.log("✓ Created students_family_id_families_id_fk (ON DELETE SET NULL)");
    } else {
      for (const row of found.rows) {
        const rule = DEL[row.del as keyof typeof DEL] ?? row.del;
        console.log(`• Existing FK "${row.name}" has ON DELETE ${rule}`);
        if (row.del === "n") {
          console.log("  → already correct; nothing to change.");
          continue;
        }
        console.log("  → rebuilding as ON DELETE SET NULL");
        await client.query(`ALTER TABLE students DROP CONSTRAINT "${row.name}"`);
        await client.query(
          `ALTER TABLE students
             ADD CONSTRAINT students_family_id_families_id_fk
             FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE SET NULL`,
        );
        console.log("  ✓ rebuilt.");
      }
    }

    await client.query("COMMIT");

    // 3. Verify final state.
    const verify = await client.query(
      `SELECT con.conname AS name, con.confdeltype AS del
         FROM pg_constraint con
         JOIN pg_class rel ON rel.oid = con.conrelid AND rel.relname = 'students'
        WHERE con.contype = 'f'
          AND (SELECT attname FROM pg_attribute
                WHERE attrelid = con.conrelid AND attnum = con.conkey[1]) = 'family_id'`,
    );
    for (const r of verify.rows) console.log(`\n  Final: ${r.name} → ON DELETE ${DEL[r.del as keyof typeof DEL] ?? r.del}`);
    console.log("\n✓ Done. Deleting a family will now null its students' family_id (no more orphans).\n");
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
