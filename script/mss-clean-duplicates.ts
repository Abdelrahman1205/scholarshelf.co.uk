import fs from "fs";
import { Client } from "pg";

function assertVerifiedDatabaseUrl(databaseUrl: string): void {
  let parsed: URL;

  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new Error("Database URL is invalid.");
  }

  const host = parsed.hostname.toLowerCase();
  const isLocal =
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host === "[::1]";

  if (isLocal) return;

  const sslmode = parsed.searchParams.get("sslmode")?.toLowerCase();

  if (sslmode !== "verify-full") {
    throw new Error(
      "Refusing remote MSS database connection unless sslmode=verify-full.",
    );
  }
}

type ClassRow = {
  id: string;
  name: string;
  teacher_id: string | null;
};

function parseEnv(filePath: string): Record<string, string> {
  const envRaw = fs.readFileSync(filePath, "utf8");
  const pairs = envRaw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => {
      const idx = line.indexOf("=");
      if (idx === -1) return [line, ""] as const;
      const key = line.slice(0, idx).trim();
      const rawValue = line.slice(idx + 1).trim();
      const value = rawValue.replace(/^"(.*)"$/, "$1");
      return [key, value] as const;
    });
  return Object.fromEntries(pairs);
}

function compact(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function parts(name: string): string[] {
  return name.split("|").map((p) => compact(p)).filter(Boolean);
}

function baseKey(name: string): string {
  const p = parts(name);
  if (p.length >= 2) return `${p[0]} | ${p[1]}`;
  return compact(name);
}

function hasTeacherSuffix(name: string): boolean {
  return parts(name).length >= 3;
}

async function classUsage(client: Client, classId: string): Promise<number> {
  const students = await client.query(`select count(*)::int as c from students where class_id = $1`, [classId]);
  const cbl = await client.query(`select count(*)::int as c from class_book_levels where class_id = $1`, [classId]);
  const reqs = await client.query(`select count(*)::int as c from extra_copy_requests where class_id = $1`, [classId]);
  return (students.rows[0]?.c || 0) + (cbl.rows[0]?.c || 0) + (reqs.rows[0]?.c || 0);
}

async function main() {
  const env = parseEnv(".env.mss.prod");
  const databaseUrl = env.DATABASE_URL?.trim() ? env.DATABASE_URL : env.storage_DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL/storage_DATABASE_URL not found");

  assertVerifiedDatabaseUrl(databaseUrl);

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  const schoolResult = await client.query(
    `select id, name, code from schools where code = 'MSS' or lower(name) like '%manchester sudanese supplimentary school%' order by created_at desc limit 1`,
  );
  if (schoolResult.rowCount === 0) throw new Error("MSS school not found");

  const school = schoolResult.rows[0] as { id: string; name: string; code: string };
  const classesResult = await client.query(`select id, name, teacher_id from classes where school_id = $1`, [school.id]);
  const classes = classesResult.rows as ClassRow[];

  const grouped = new Map<string, ClassRow[]>();
  for (const cls of classes) {
    const key = baseKey(cls.name);
    const list = grouped.get(key) || [];
    list.push(cls);
    grouped.set(key, list);
  }

  const candidates: ClassRow[] = [];
  for (const [, list] of grouped.entries()) {
    if (list.length < 2) continue;
    const hasSuffixed = list.some((item) => hasTeacherSuffix(item.name));
    if (!hasSuffixed) continue;

    for (const item of list) {
      if (!hasTeacherSuffix(item.name)) {
        candidates.push(item);
      }
    }
  }

  const deleted: Array<{ id: string; name: string }> = [];
  const skippedInUse: Array<{ id: string; name: string; usage: number }> = [];

  for (const candidate of candidates) {
    const usage = await classUsage(client, candidate.id);
    if (usage > 0) {
      skippedInUse.push({ id: candidate.id, name: candidate.name, usage });
      continue;
    }

    await client.query(`delete from classes where id = $1`, [candidate.id]);
    deleted.push({ id: candidate.id, name: candidate.name });
  }

  const afterCount = await client.query(`select count(*)::int as c from classes where school_id = $1`, [school.id]);

  console.log(
    JSON.stringify(
      {
        school,
        beforeClasses: classes.length,
        candidateDuplicates: candidates.length,
        deletedCount: deleted.length,
        skippedInUseCount: skippedInUse.length,
        afterClasses: afterCount.rows[0]?.c || 0,
        deletedSample: deleted.slice(0, 10),
        skippedSample: skippedInUse.slice(0, 10),
      },
      null,
      2,
    ),
  );

  await client.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
