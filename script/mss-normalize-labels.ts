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

function compactSpaces(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeClassPart(value: string): string {
  let v = compactSpaces(value);

  const exact: Record<string, string> = {
    "الGCSE": "GCSE",
    "PRE-": "PRE",
    "pre": "PRE",
    "م َ- الثاني": "م-الثاني",
    "م- الثاني": "م-الثاني",
    "م-الاول": "م-الأول",
    "م- الاول": "م-الأول",
    "م- نمهيدي (أ )": "م-تمهيدي (أ)",
    "تمهيدي( ب )": "تمهيدي (ب)",
    "تمهيدي (ب )": "تمهيدي (ب)",
    "تمهيدي (أ )": "تمهيدي (أ)",
    "الاعلام والتكنلوجيا": "الإعلام والتكنولوجيا",
    "معلمة pre+gse": "معلمة PRE+GCSE",
    "Pre-gcse+ سادس": "PRE+GCSE+سادس",
    "القران الكريم": "القرآن الكريم",
  };

  if (exact[v]) return exact[v];

  v = v.replace(/\s*\(\s*/g, " (").replace(/\s*\)\s*/g, ")");
  v = v.replace(/\s*-\s*/g, "-");

  return compactSpaces(v);
}

function normalizeSubjectPart(value: string): string {
  let v = compactSpaces(value || "");

  const exact: Record<string, string> = {
    "لغة عربية": "اللغة العربية",
    "تربية اسلامية": "التربية الإسلامية",
    "لغة عربية – تربية اسلامية": "اللغة العربية – التربية الإسلامية",
    "لغة عربية – تربية اسلامية": "اللغة العربية – التربية الإسلامية",
    "اللغة العربية – التربية": "اللغة العربية – التربية الإسلامية",
    "اللغة العربية – التربية الاسلامية": "اللغة العربية – التربية الإسلامية",
    "القران الكريم": "القرآن الكريم",
  };

  if (exact[v]) return exact[v];

  v = v.replace(/تربية اسلامية/g, "التربية الإسلامية");
  v = v.replace(/القران الكريم/g, "القرآن الكريم");
  v = v.replace(/\s*[-–]+\s*/g, " – ");

  return compactSpaces(v);
}

function normalizeFullLabel(name: string): string {
  const parts = name.split("|").map((part) => compactSpaces(part));
  if (parts.length === 1) return compactSpaces(name);

  const classPart = normalizeClassPart(parts[0]);
  const subjectPart = normalizeSubjectPart(parts[1]);
  const teacherPart = parts[2] ? compactSpaces(parts[2]) : "";

  const normalizedParts = [classPart, subjectPart].filter(Boolean);
  if (teacherPart) normalizedParts.push(teacherPart);

  return normalizedParts.join(" | ");
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

  const classesResult = await client.query(
    `select id, name from classes where school_id = $1`,
    [school.id],
  );

  let updated = 0;
  const changes: Array<{ id: string; oldName: string; newName: string }> = [];

  for (const row of classesResult.rows as Array<{ id: string; name: string }>) {
    const oldName = row.name;
    const newName = normalizeFullLabel(oldName);
    if (newName !== oldName) {
      await client.query(`update classes set name = $1 where id = $2`, [newName, row.id]);
      updated += 1;
      changes.push({ id: row.id, oldName, newName });
    }
  }

  console.log(
    JSON.stringify(
      {
        school,
        totalClasses: classesResult.rowCount,
        updatedClasses: updated,
        sampleChanges: changes.slice(0, 12),
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
