/**
 * script/diagnose-test-account.ts
 *
 * Read-only. Answers one question: why does signing in as the Universal Test
 * Account fail?
 *
 *   npx tsx script/diagnose-test-account.ts
 *   npx tsx script/diagnose-test-account.ts --username "Testing 1" --password "testingDemo"
 *
 * It checks, in order, the things that each produce the SAME
 * "Incorrect username or password" on the login screen:
 *
 *   1. Is .env pointing at the database production actually reads?
 *      Production's /api/public/schools/DEMO-001 reports school id
 *      f4edc78e-1c9a-4ee9-8613-be5dff712ef7. If this database reports a
 *      different id — or no DEMO-001 at all — then the seed has been writing
 *      to the wrong place and everything downstream is a red herring.
 *   2. Does the user row exist, and under exactly what spelling? The username
 *      is matched case-sensitively, so "testing 1" and "Testing 1" are two
 *      different accounts and only one of them exists.
 *   3. Does the stored bcrypt hash actually verify the password?
 *   4. Is the account status one that sign-in accepts? disabled / locked /
 *      invited are all rejected with the same generic message.
 *   5. Is the TEST_SUPERUSER permission row present?
 *   6. Have the payment-verification tables been created yet?
 *
 * Prints no secrets: the connection string is reported as host + database only.
 */
import "dotenv/config";
import { Client } from "pg";
import bcrypt from "bcryptjs";

const PRODUCTION_DEMO_SCHOOL_ID = "f4edc78e-1c9a-4ee9-8613-be5dff712ef7";

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  if (i !== -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--")) return process.argv[i + 1];
  return fallback;
}

const ok = (s: string) => console.log(`  ✓ ${s}`);
const bad = (s: string) => console.log(`  ✗ ${s}`);
const info = (s: string) => console.log(`    ${s}`);

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("✗ DATABASE_URL is not set (expected in .env).");
    process.exit(1);
  }

  const username = arg("username", "Testing 1");
  const password = arg("password", "testingDemo");
  const schoolCode = arg("school", "DEMO-001");

  const parsed = new URL(url);
  console.log("\nDatabase");
  info(`host ${parsed.hostname}`);
  info(`name ${parsed.pathname.replace(/^\//, "")}`);
  info(`user ${parsed.username}`);
  info(parsed.hostname.includes("-pooler") ? "endpoint: POOLED (pgbouncer)" : "endpoint: direct");

  const db = new Client({
    connectionString: url,
    ssl: /localhost|127\.0\.0\.1/.test(url) ? false : { rejectUnauthorized: false },
    connectionTimeoutMillis: 20000,
  });

  try {
    await db.connect();
  } catch (e: any) {
    console.log("");
    bad(`Could not connect: ${e.message}`);
    if (e.code === "28P01") {
      info("28P01 = wrong password. The Neon password has been rotated and .env is stale.");
      info("Pull the current one:  npx vercel env pull .env.vercel --environment production");
    }
    process.exit(1);
  }
  ok("connected");

  try {
    // ── 1. Same database as production? ────────────────────────────────
    console.log("\n1. Is this the database production reads?");
    const school = await db.query(`select id, name, code, status from schools where code = $1`, [schoolCode]);
    if (!school.rows[0]) {
      bad(`No school with code ${schoolCode} in THIS database.`);
      info("Production has one, so .env points at a different database or branch.");
      const all = await db.query(`select code, name from schools order by code limit 10`);
      info(`Schools here: ${all.rows.map((r) => r.code).join(", ") || "(none)"}`);
      return;
    }
    const s = school.rows[0];
    info(`${s.code} — ${s.name} (status ${s.status})`);
    if (s.id === PRODUCTION_DEMO_SCHOOL_ID) {
      ok("Same school id as production. This IS the production database.");
    } else {
      bad("DIFFERENT school id from production.");
      info(`here:       ${s.id}`);
      info(`production: ${PRODUCTION_DEMO_SCHOOL_ID}`);
      info("Seeding here will never affect the deployed site.");
    }

    // ── 2. Does the account exist, and spelled how? ────────────────────
    console.log("\n2. Does the account exist?");
    const exact = await db.query(
      `select id, username, name, email, role, status, school_id from users where username = $1`,
      [username],
    );
    if (exact.rows[0]) {
      const u = exact.rows[0];
      ok(`Found exactly "${username}"`);
      info(`role ${u.role} · status ${u.status} · email ${u.email}`);
      if (u.school_id !== s.id) {
        bad("Account belongs to a DIFFERENT school than " + schoolCode);
        info("Sign-in requires the school code that matches the account's own school.");
      } else {
        ok(`Belongs to ${s.code}, so sign in with school code ${s.code}`);
      }

      // ── 3. Password ────────────────────────────────────────────────
      console.log("\n3. Does the password verify?");
      const row = await db.query(`select password_hash from users where id = $1`, [u.id]);
      const hash = row.rows[0]?.password_hash;
      if (!hash) bad("No password hash stored.");
      else if (bcrypt.compareSync(password, hash)) ok(`"${password}" verifies against the stored hash.`);
      else {
        bad(`"${password}" does NOT match the stored hash.`);
        info("Re-run the seed with --force to reset it.");
      }

      // ── 4. Status gate ─────────────────────────────────────────────
      console.log("\n4. Is the status one sign-in accepts?");
      if (["disabled", "locked", "invited"].includes(u.status)) {
        bad(`status "${u.status}" is rejected by /api/auth/sign-in (same generic message).`);
      } else ok(`status "${u.status}" is fine.`);

      // ── 5. The flag ────────────────────────────────────────────────
      console.log("\n5. Is the TEST_SUPERUSER flag set?");
      const perms = await db.query(`select permission from user_permissions where user_id = $1`, [u.id]);
      const list = perms.rows.map((r) => r.permission);
      if (list.includes("TEST_SUPERUSER")) ok("TEST_SUPERUSER present.");
      else {
        bad("TEST_SUPERUSER missing — the role switcher will not appear.");
        info(`Permissions on this account: ${list.join(", ") || "(none)"}`);
      }
    } else {
      bad(`No user with username exactly "${username}".`);
      const like = await db.query(
        `select username, role, status from users where lower(username) like lower($1) limit 10`,
        [`%${username.trim().split(/\s+/)[0]}%`],
      );
      if (like.rows.length) {
        info("Similar usernames that DO exist (matching is case-sensitive):");
        for (const r of like.rows) info(`  "${r.username}"  role=${r.role} status=${r.status}`);
      } else {
        info("Nothing similar either — the seed has not run against this database.");
        info(`Run:  npx tsx script/seed-test-account.ts --username "${username}" --password "${password}" --force`);
      }
    }

    // ── 6. Migration state ─────────────────────────────────────────────
    console.log("\n6. Payment-verification tables");
    const t = await db.query(
      `select to_regclass('public.provider_payments') as pp,
              to_regclass('public.payment_verification_attempts') as pva`,
    );
    const { pp, pva } = t.rows[0];
    if (pp && pva) ok("both present.");
    else {
      bad(`missing (provider_payments=${pp ?? "no"}, payment_verification_attempts=${pva ?? "no"}).`);
      info("Run:  npm run db:push");
    }
  } finally {
    console.log("");
    await db.end().catch(() => {});
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
