/**
 * script/migrate.ts
 *
 * The migration runner. Before this existed, `migrations/*.sql` were applied by
 * hand — which is a polite way of saying nobody could tell which of them
 * production had actually seen. The Legal & Compliance directive lists
 * "database migrations completely omitted from deploy pipeline" as a Critical
 * finding under Deployment & CI/CD, and this is the missing half of it.
 *
 *   npm run db:migrate:status   what is applied, what is pending
 *   npm run db:migrate          apply everything pending, oldest first
 *
 * DESIGN NOTES
 *
 *   · Each file runs inside ONE transaction. Postgres does transactional DDL, so
 *     a migration that fails halfway leaves nothing behind — no half-applied
 *     constraint set to reason about at 2am.
 *   · Applied files are recorded in `schema_migrations` with a SHA-256 of their
 *     contents. Editing a file that has already run is caught and refused: the
 *     database no longer matches what the repository says was applied, and
 *     silently ignoring that is how environments drift apart.
 *   · Files are ordered by filename. `002a` before `002b` is deliberate and the
 *     ordering must stay lexicographic.
 *   · `status` exits non-zero when anything is pending, so a deploy can refuse
 *     to ship code that needs schema the database does not have.
 *
 * WHAT IT DOES NOT DO
 *
 * It does not roll back. Down-migrations against live children's data are a
 * worse risk than the thing they undo; recovery is Neon PITR plus a forward fix.
 */
import "dotenv/config";
import { Client } from "pg";
import { createHash } from "crypto";
import { readdirSync, readFileSync } from "fs";
import { join } from "path";

const MIGRATIONS_DIR = join(process.cwd(), "migrations");

interface MigrationFile {
  name: string;
  sql: string;
  checksum: string;
}

function loadMigrations(): MigrationFile[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((name) => {
      const sql = readFileSync(join(MIGRATIONS_DIR, name), "utf8");
      return { name, sql, checksum: createHash("sha256").update(sql).digest("hex") };
    });
}

function connectionString(): string {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    console.error("DATABASE_URL is not set. Point it at the database you mean to migrate.");
    process.exit(1);
  }
  return url;
}

function isLocal(url: string): boolean {
  return /localhost|127\.0\.0\.1/.test(url);
}

async function connect(): Promise<Client> {
  const url = connectionString();
  const client = new Client({
    connectionString: url,
    ssl: isLocal(url) ? undefined : { rejectUnauthorized: false },
  });
  await client.connect();
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name        text PRIMARY KEY,
      checksum    text NOT NULL,
      applied_at  timestamptz NOT NULL DEFAULT now(),
      applied_by  text
    )
  `);
  return client;
}

async function readApplied(client: Client): Promise<Map<string, string>> {
  const { rows } = await client.query<{ name: string; checksum: string }>(
    "SELECT name, checksum FROM schema_migrations",
  );
  return new Map(rows.map((r) => [r.name, r.checksum]));
}

/** Returns the files that still need applying, and shouts about edited ones. */
function classify(files: MigrationFile[], applied: Map<string, string>) {
  const pending: MigrationFile[] = [];
  const changed: string[] = [];
  for (const file of files) {
    const seen = applied.get(file.name);
    if (!seen) pending.push(file);
    else if (seen !== file.checksum) changed.push(file.name);
  }
  return { pending, changed };
}

async function status(): Promise<number> {
  const client = await connect();
  try {
    const files = loadMigrations();
    const applied = await readApplied(client);
    const { pending, changed } = classify(files, applied);

    for (const file of files) {
      const mark = applied.has(file.name)
        ? (applied.get(file.name) === file.checksum ? "applied" : "CHANGED SINCE APPLIED")
        : "pending";
      console.log(`  ${mark.padEnd(22)} ${file.name}`);
    }

    if (changed.length) {
      console.error(
        `\n✗ ${changed.length} migration(s) were edited after being applied. The database ` +
        `no longer matches this repository. Write a new migration instead of editing an old one.`,
      );
      return 1;
    }
    if (pending.length) {
      console.error(`\n✗ ${pending.length} migration(s) pending. Run: npm run db:migrate`);
      return 1;
    }
    console.log("\n✓ Database schema is up to date.");
    return 0;
  } finally {
    await client.end();
  }
}

async function apply(): Promise<number> {
  const client = await connect();
  try {
    const files = loadMigrations();
    const applied = await readApplied(client);
    const { pending, changed } = classify(files, applied);

    if (changed.length) {
      console.error(`✗ Refusing to run: ${changed.join(", ")} changed after being applied.`);
      return 1;
    }
    if (!pending.length) {
      console.log("✓ Nothing to do — schema is up to date.");
      return 0;
    }

    for (const file of pending) {
      process.stdout.write(`  applying ${file.name} … `);
      try {
        await client.query("BEGIN");
        await client.query(file.sql);
        await client.query(
          "INSERT INTO schema_migrations (name, checksum, applied_by) VALUES ($1, $2, $3)",
          [file.name, file.checksum, process.env.USER || process.env.USERNAME || "unknown"],
        );
        await client.query("COMMIT");
        console.log("done");
      } catch (e: any) {
        await client.query("ROLLBACK").catch(() => {});
        console.log("FAILED");
        console.error(`\n✗ ${file.name} failed and was rolled back:\n  ${e.message}\n`);
        console.error("Nothing after it was attempted. Fix the cause, then run again.");
        return 1;
      }
    }
    console.log(`\n✓ Applied ${pending.length} migration(s).`);
    return 0;
  } finally {
    await client.end();
  }
}

const command = process.argv[2] || "status";
const run = command === "apply" ? apply : status;
run().then((code) => process.exit(code), (e) => {
  console.error(e.message);
  process.exit(1);
});
