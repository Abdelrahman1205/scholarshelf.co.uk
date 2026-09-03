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
 *   - Ordinary migrations run inside one runner-owned transaction. The exact
 *     historical 002a_indexes.sql migration is the sole non-transactional
 *     exception because PostgreSQL requires CREATE INDEX CONCURRENTLY to run
 *     outside a transaction. Legacy 001/002b wrappers are verified and stripped
 *     in memory so their bodies still run atomically with migration tracking.
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
const LEGACY_NON_TRANSACTIONAL_MIGRATION = "002a_indexes.sql";
const LEGACY_TRANSACTION_WRAPPED_MIGRATIONS = new Set([
  "001_console_hardening.sql",
  "002b_foreign_keys.sql",
]);

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


/** Detect transaction wrappers that belong to the runner, not the SQL file. */
const TOP_LEVEL_TX_CONTROL_RE =
  /^\s*(?:BEGIN|START\s+TRANSACTION|COMMIT|END\s+TRANSACTION|ROLLBACK)\s*;\s*(?:--.*)?$/gim;

const CONCURRENT_INDEX_RE =
  /^(?!\s*--)\s*CREATE\s+(?:UNIQUE\s+)?INDEX\s+CONCURRENTLY\b/gim;

interface LegacyConcurrentStatement {
  sql: string;
  indexName: string;
}

/**
 * 002a is the only historical non-transactional migration. Every executable
 * statement must be CREATE INDEX CONCURRENTLY IF NOT EXISTS, and each one is
 * sent separately so PostgreSQL does not place them in an implicit transaction.
 */
function legacyConcurrentStatements(sql: string): LegacyConcurrentStatement[] {
  const withoutBlockComments = sql.replace(/\/\*[\s\S]*?\*\//g, "");
  const withoutLineComments = withoutBlockComments.replace(/^\s*--.*$/gm, "");
  const statements = withoutLineComments
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean);

  if (!statements.length) {
    throw new Error(LEGACY_NON_TRANSACTIONAL_MIGRATION + " contains no executable statements.");
  }

  return statements.map((statement) => {
    const match = statement.match(
      /^CREATE\s+(?:UNIQUE\s+)?INDEX\s+CONCURRENTLY\s+IF\s+NOT\s+EXISTS\s+("?)([A-Za-z_][A-Za-z0-9_$]*)\1\s+ON\b[\s\S]*$/i,
    );

    if (!match) {
      throw new Error(
        LEGACY_NON_TRANSACTIONAL_MIGRATION +
          " contains an unexpected executable statement: " +
          statement.slice(0, 120),
      );
    }

    return { sql: statement, indexName: match[2] };
  });
}

/**
 * 001 and 002b were historically committed with one outer BEGIN/COMMIT pair.
 * Their checksums are immutable, so never rewrite those migration files.
 * On a fresh database, remove only that verified outer wrapper in memory and
 * let the runner own the transaction together with schema_migrations tracking.
 */
function legacyTransactionalBody(file: MigrationFile): string {
  if (!LEGACY_TRANSACTION_WRAPPED_MIGRATIONS.has(file.name)) {
    return file.sql;
  }

  const txControls = file.sql.match(TOP_LEVEL_TX_CONTROL_RE) || [];
  const beginMatch =
    /^[ \t]*BEGIN[ \t]*;[ \t]*(?:--.*)?$/im.exec(file.sql);
  const commitMatch =
    /^[ \t]*COMMIT[ \t]*;[ \t]*(?:--.*)?$/im.exec(file.sql);

  if (
    txControls.length !== 2 ||
    !beginMatch ||
    !commitMatch ||
    commitMatch.index <= beginMatch.index
  ) {
    throw new Error(
      file.name +
        " must contain exactly one outer BEGIN; and one outer COMMIT; legacy wrapper."
    );
  }

  const before = file.sql.slice(0, beginMatch.index);
  const after = file.sql.slice(commitMatch.index + commitMatch[0].length);

  const executableOutsideWrapper = (sql: string) =>
    sql
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^[ \t]*--.*$/gm, "")
      .trim();

  if (
    executableOutsideWrapper(before) ||
    executableOutsideWrapper(after)
  ) {
    throw new Error(
      file.name +
        " has executable SQL outside its verified legacy BEGIN/COMMIT wrapper."
    );
  }

  const body = file.sql.slice(
    beginMatch.index + beginMatch[0].length,
    commitMatch.index,
  );

  if (!body.trim()) {
    throw new Error(file.name + " has an empty legacy transaction body.");
  }

  if ((body.match(TOP_LEVEL_TX_CONTROL_RE) || []).length) {
    throw new Error(
      file.name + " contains nested or additional transaction control."
    );
  }

  return body;
}

/** Ordinary migrations are transactional; only the exact legacy 002a is not. */
function validateMigrationFiles(files: MigrationFile[]): void {
  for (const file of files) {
    const txControls = file.sql.match(TOP_LEVEL_TX_CONTROL_RE) || [];

    if (LEGACY_TRANSACTION_WRAPPED_MIGRATIONS.has(file.name)) {
      legacyTransactionalBody(file);
    } else if (txControls.length) {
      throw new Error(
        file.name +
          " contains explicit transaction control. The runner owns BEGIN/COMMIT."
      );
    }

    const concurrentIndexes = file.sql.match(CONCURRENT_INDEX_RE) || [];

    if (file.name === LEGACY_NON_TRANSACTIONAL_MIGRATION) {
      if (!concurrentIndexes.length) {
        throw new Error(file.name + " contains no CREATE INDEX CONCURRENTLY statements.");
      }

      legacyConcurrentStatements(file.sql);
      continue;
    }

    if (concurrentIndexes.length) {
      throw new Error(
        file.name +
          " contains CREATE INDEX CONCURRENTLY. Only " +
          LEGACY_NON_TRANSACTIONAL_MIGRATION +
          " may run outside a transaction."
      );
    }
  }
}

function connectionString(): string {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    console.error("DATABASE_URL is not set. Point it at the database you mean to migrate.");
    process.exit(1);
  }
  return url;
}

async function connect(): Promise<Client> {
  const url = connectionString();
  const client = new Client({
    connectionString: url,
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
  const files = loadMigrations();

  const client = await connect();
  try {
    const applied = await readApplied(client);
    const { pending, changed } = classify(files, applied);

    validateMigrationFiles(pending);

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
  const files = loadMigrations();

  const client = await connect();
  try {
    const applied = await readApplied(client);
    const { pending, changed } = classify(files, applied);

    validateMigrationFiles(pending);

    if (changed.length) {
      console.error("Refusing to run: " + changed.join(", ") + " changed after being applied.");
      return 1;
    }

    if (!pending.length) {
      console.log("Nothing to do - schema is up to date.");
      return 0;
    }

    for (const file of pending) {
      const appliedBy = process.env.USER || process.env.USERNAME || "unknown";

      if (file.name === LEGACY_NON_TRANSACTIONAL_MIGRATION) {
        process.stdout.write("  applying " + file.name + " [legacy non-transactional] ... ");

        try {
          const statements = legacyConcurrentStatements(file.sql);

          for (const statement of statements) {
            await client.query(statement.sql);

            const indexState = await client.query<{
              indisvalid: boolean;
              indisready: boolean;
            }>(
              `SELECT i.indisvalid, i.indisready
                 FROM pg_class c
                 JOIN pg_namespace n ON n.oid = c.relnamespace
                 JOIN pg_index i ON i.indexrelid = c.oid
                WHERE n.nspname = 'public'
                  AND c.relname = $1`,
              [statement.indexName],
            );

            if (
              indexState.rowCount !== 1 ||
              indexState.rows[0].indisvalid !== true ||
              indexState.rows[0].indisready !== true
            ) {
              throw new Error("index " + statement.indexName + " is missing or invalid after creation");
            }
          }

          // The indexes themselves cannot be transactional. Only tracking is.
          await client.query("BEGIN");

          try {
            await client.query(
              "INSERT INTO schema_migrations (name, checksum, applied_by) VALUES ($1, $2, $3)",
              [file.name, file.checksum, appliedBy],
            );
            await client.query("COMMIT");
          } catch (e) {
            await client.query("ROLLBACK").catch(() => {});
            throw e;
          }

          console.log("done");
        } catch (e: any) {
          console.log("FAILED");
          console.error("\n" + file.name + " failed: " + e.message);
          console.error(
            "This legacy migration is non-transactional; inspect any partially created index before rerunning.",
          );
          console.error("Nothing after it was attempted.");
          return 1;
        }

        continue;
      }

      process.stdout.write("  applying " + file.name + " ... ");

      try {
        await client.query("BEGIN");
        const sqlToApply = LEGACY_TRANSACTION_WRAPPED_MIGRATIONS.has(file.name)
          ? legacyTransactionalBody(file)
          : file.sql;
        await client.query(sqlToApply);
        await client.query(
          "INSERT INTO schema_migrations (name, checksum, applied_by) VALUES ($1, $2, $3)",
          [file.name, file.checksum, appliedBy],
        );
        await client.query("COMMIT");
        console.log("done");
      } catch (e: any) {
        await client.query("ROLLBACK").catch(() => {});
        console.log("FAILED");
        console.error("\n" + file.name + " failed and was rolled back:\n  " + e.message + "\n");
        console.error("Nothing after it was attempted. Fix the cause, then run again.");
        return 1;
      }
    }

    console.log("\nApplied " + pending.length + " migration(s).");
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
