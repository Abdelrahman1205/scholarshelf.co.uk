/**
 * script/seed-test-account.ts
 *
 * Creates (or refreshes) the Universal Test Account — the development login that
 * can view ScholarShelf as any role without logging out.
 *
 *   npm run seed:test-account
 *   npm run seed:test-account -- --school DEMO-001 --username qa --password '…'
 *
 * The account is an ordinary user row plus ONE row in `user_permissions`
 * (`TEST_SUPERUSER`). There is no new table and no migration: the flag reuses
 * the permission table that already carries branding grants and secondary roles.
 *
 * SAFETY
 *   · Refuses to run against a production environment unless
 *     ALLOW_TEST_SUPERUSER=true is set deliberately.
 *   · Refuses to create the account with a weak or default password unless
 *     --force is passed, so a test superuser can never be stood up on a shared
 *     database with a guessable login.
 *   · Prints the password only when it generated one.
 */
import { Client } from "pg";
import bcrypt from "bcryptjs";
import crypto from "crypto";

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  if (i !== -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--")) return process.argv[i + 1];
  return fallback;
}
const has = (name: string) => process.argv.includes(`--${name}`);

const IS_PRODUCTION = process.env.NODE_ENV === "production";
const ALLOWED = process.env.ALLOW_TEST_SUPERUSER === "true" || !IS_PRODUCTION;

async function main() {
  if (!ALLOWED) {
    console.error(
      "\n✗ Refusing to create a test superuser in production.\n" +
      "  The role switcher is a development tool and is inert when NODE_ENV=production.\n" +
      "  If this really is a staging deployment, set ALLOW_TEST_SUPERUSER=true and re-run.\n",
    );
    process.exit(1);
  }

  const url = process.env.DATABASE_URL;
  if (!url) { console.error("✗ DATABASE_URL is not set."); process.exit(1); }

  const username = arg("username", "testuser")!;

  // The derived email must be a VALID address. Deriving it straight from the
  // username produced "Testing 1@scholarshelf.test" — a space in an email —
  // which is stored happily but fails every email check downstream (parent
  // invites, linking codes, password reset). Slugify instead.
  const emailSlug = username.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "testuser";
  const email = arg("email", `${emailSlug}@scholarshelf.test`)!;

  // ScholarShelf's own signup rule for usernames is /^[a-zA-Z0-9_.-]+$/ (see
  // signUpParentSchema). Sign-IN does not enforce it, so a username with a space
  // works — but it is matched EXACTLY and case-sensitively, so "testing 1" or a
  // pasted trailing space will be rejected as a wrong password. Warn, don't block:
  // it is your account to name.
  if (!/^[a-zA-Z0-9_.-]+$/.test(username)) {
    console.warn(
      `\n⚠ "${username}" contains characters ScholarShelf's own signup rules reject ` +
      `(letters, numbers, dot, hyphen, underscore).\n` +
      `  Sign-in still works, but the username is matched exactly and is case-sensitive:\n` +
      `  you must type it as "${username}" every time — a trailing space or different\n` +
      `  capitalisation will look like a wrong password.\n`,
    );
  }
  const name = arg("name", "Universal Test Account")!;
  const schoolCode = arg("school", "DEMO-001")!;

  // A generated password is long and random; a supplied one must not be trivial.
  const generated = !arg("password");
  const password = arg("password") || `test-${crypto.randomBytes(9).toString("base64url")}`;
  if (!generated && password.length < 12 && !has("force")) {
    console.error("✗ That password is short. Use at least 12 characters, or pass --force.");
    process.exit(1);
  }

  const db = new Client({
    connectionString: url,
    ssl: /localhost|127\.0\.0\.1/.test(url) ? false : { rejectUnauthorized: false },
  });
  await db.connect();

  try {
    const school = await db.query(`select id, name from schools where code = $1 limit 1`, [schoolCode]);
    if (!school.rows[0]) {
      console.error(`✗ No school with code "${schoolCode}". Pass --school <CODE>, or seed demo data first.`);
      process.exit(1);
    }
    const schoolId = school.rows[0].id as string;
    const passwordHash = bcrypt.hashSync(password, 10);

    // The account's STORED role is school_admin — a school-scoped role, so every
    // simulated role that needs a school has one. The roles it can SIMULATE come
    // from the TEST_SUPERUSER flag, not from this value.
    const existing = await db.query(`select id from users where username = $1`, [username]);
    let userId: string;
    if (existing.rows[0]) {
      userId = existing.rows[0].id;
      await db.query(
        `update users set password_hash = $2, name = $3, email = $4, role = 'school_admin',
                          status = 'active', school_id = $5
          where id = $1`,
        [userId, passwordHash, name, email, schoolId],
      );
      console.log(`· Updated existing account "${username}"`);
    } else {
      const created = await db.query(
        `insert into users (id, username, password_hash, name, email, role, status, school_id)
         values (gen_random_uuid()::text, $1, $2, $3, $4, 'school_admin', 'active', $5)
         returning id`,
        [username, passwordHash, name, email, schoolId],
      );
      userId = created.rows[0].id;
      console.log(`· Created account "${username}"`);
    }

    // The flag. Idempotent — the table has a unique index on (user_id, permission).
    await db.query(
      `insert into user_permissions (id, user_id, permission)
       values (gen_random_uuid()::text, $1, 'TEST_SUPERUSER')
       on conflict (user_id, permission) do nothing`,
      [userId],
    );

    console.log(`
✓ Universal Test Account ready

    School code   ${schoolCode}  (${school.rows[0].name})
    Username      ${username}
    Password      ${generated ? password : "(the one you supplied)"}
    Email         ${email}

  Sign in, then use the purple "Testing as" dropdown at the top of the sidebar
  to switch role. The banner across the top always says which role is active.
${generated ? "\n  ⚠ This password is shown once. Save it now.\n" : ""}`);
  } finally {
    await db.end().catch(() => {});
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
