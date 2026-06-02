import fs from "fs";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { Client } from "pg";

type Entry = {
  name: string;
  className: string;
  subject: string;
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

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").replace(/[\u0640]/g, "").trim();
}

function usernameBase(index: number): string {
  return `mss_teacher_${String(index).padStart(3, "0")}`;
}

function classLabel(className: string, subject: string, teacherName: string, duplicateScoped: boolean): string {
  const c = normalizeText(className || "غير محدد");
  const s = normalizeText(subject || "غير محدد");
  if (duplicateScoped) {
    return `${c} | ${s} | ${normalizeText(teacherName)}`;
  }
  return `${c} | ${s}`;
}

const rawEntries: Entry[] = [
  { name: "عزة مكي", className: "الGCSE", subject: "لغة عربية" },
  { name: "إيمان سليم", className: "PRE-", subject: "لغة عربية" },
  { name: "نهلة سليمان", className: "السادس", subject: "لغة عربية – تربية اسلامية" },
  { name: "هند الشريف", className: "الخامس", subject: "لغة عربية – تربية اسلامية" },
  { name: "عزة قيلي", className: "الرابع", subject: "لغة عربية – تربية اسلامية" },
  { name: "زينب شروفة", className: "الثالث ( أ )", subject: "لغة عربية – تربية اسلامية" },
  { name: "مي محمد أحمد", className: "الثالث (ب )", subject: "لغة عربية – تربية اسلامية" },
  { name: "سوزان علي", className: "الثاني", subject: "لغة عربية" },
  { name: "فيروز علي", className: "م َ- الثاني", subject: "تربية اسلامية" },
  { name: "تسنيم إبراهيم", className: "الاول", subject: "لغة عربية" },
  { name: "تهاني إبراهيم", className: "م-الاول", subject: "تربية اسلامية" },
  { name: "صفاء بدري", className: "تمهيدي (أ )", subject: "لغة عربية – تربية اسلامية" },
  { name: "ياسمين ياسين", className: "م- نمهيدي (أ )", subject: "لغة عربية – تربية اسلامية" },
  { name: "زينب المذياتي", className: "تمهيدي( ب )", subject: "لغة عربية – تربية اسلامية" },
  { name: "هند حسن", className: "تمهيدي (ب )", subject: "لغة عربية – تربية اسلامية" },
  { name: "منى خالد", className: "تمهيدي اول", subject: "لغة عربية – تربية اسلامية" },
  { name: "ريم محمد", className: "تمهيدي اول", subject: "لغة عربية – تربية اسلامية" },
  { name: "اية المزياتي", className: "م- براعم", subject: "لغة عربية – تربية اسلامية" },
  { name: "هدى زهير", className: "براعم", subject: "لغة عربية – تربية اسلامية" },
  { name: "هديل محمود", className: "براعم", subject: "لغة عربية – تربية اسلامية" },
  { name: "أمل أبو سن", className: "The Proud People", subject: "لغة عربية – تربية اسلامية" },
  { name: "ست البنات سليم", className: "القران الكريم", subject: "الصف الأول -الثالث-سادس pre" },
  { name: "هناد محمود", className: "القران الكريم", subject: "الثاني -الرابع- الخامس gcse" },
  { name: "ميساء حيدوب", className: "القران الكريم", subject: "براعم -تمهيدي -proud" },
  { name: "سماح سيف الدين", className: "الاعلام والتكنلوجيا", subject: "" },
  { name: "أسماء حسن", className: "الاعلام والتكنلوجيا", subject: "" },
  { name: "نهلة محمد", className: "معلمة pre+gse", subject: "اللغة العربية – التربية" },
  { name: "خديجة عبد الرحمن", className: "م. تمهيدي اول", subject: "اللغة العربية – التربية الاسلامية" },
  { name: "نهلة فاروق", className: "الصف الخاص", subject: "الخاص" },
  { name: "نجلاء عبد الغني", className: "الرابع +الخامس", subject: "اللغة العربية – التربية الاسلامية" },
  { name: "لمياء الحاردلو", className: "3+4+5+pre", subject: "القران الكريم" },
  { name: "أماني عبد الشفيع", className: "مديرة المدرسة", subject: "" },
  { name: "رانيا عبد الله", className: "المراقب العام", subject: "" },
];

const dedupedEntries = Array.from(
  new Map(
    rawEntries.map((entry) => {
      const key = `${normalizeText(entry.name)}|${normalizeText(entry.className)}|${normalizeText(entry.subject)}`;
      return [key, {
        name: normalizeText(entry.name),
        className: normalizeText(entry.className),
        subject: normalizeText(entry.subject),
      } satisfies Entry];
    }),
  ).values(),
);

const classSubjectCounts = new Map<string, number>();
for (const entry of dedupedEntries) {
  const key = `${normalizeText(entry.className)}|${normalizeText(entry.subject || "عام")}`;
  classSubjectCounts.set(key, (classSubjectCounts.get(key) || 0) + 1);
}

async function main() {
  const env = parseEnv(".env.mss.prod");
  const databaseUrl = env.DATABASE_URL?.trim() ? env.DATABASE_URL : env.storage_DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL/storage_DATABASE_URL not found in .env.mss.prod");
  }

  const client = new Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const schoolResult = await client.query(
    `select id, name, code from schools where lower(name) like '%manchester sudanese supplementary school%' or lower(code) like 'mss%' order by created_at desc limit 1`,
  );
  if (schoolResult.rowCount === 0) {
    throw new Error("MSS school was not found in production database");
  }

  const school = schoolResult.rows[0] as { id: string; name: string; code: string };
  const schoolId = school.id;

  const roleForClass = (className: string): string => {
    const normalized = normalizeText(className);
    if (normalized.includes("مديرة") || normalized.includes("المراقب")) return "school_admin";
    if (normalized.includes("الاعلام") || normalized.includes("التكنلوجيا")) return "it_personnel";
    return "teacher";
  };

  const existingUsersResult = await client.query(
    `select id, name, role, username from users where school_id = $1`,
    [schoolId],
  );

  const usersByName = new Map<string, { id: string; role: string; username: string }>();
  for (const row of existingUsersResult.rows as Array<{ id: string; name: string; role: string; username: string }>) {
    usersByName.set(normalizeText(row.name), { id: row.id, role: row.role, username: row.username });
  }

  const existingUsernames = new Set((existingUsersResult.rows as Array<{ username: string }>).map((row) => row.username));

  let createdUsers = 0;
  let updatedUserRoles = 0;

  for (let i = 0; i < dedupedEntries.length; i += 1) {
    const entry = dedupedEntries[i];
    const desiredRole = roleForClass(entry.className);
    const existing = usersByName.get(entry.name);

    if (existing) {
      if (existing.role !== desiredRole) {
        await client.query(`update users set role = $1, updated_at = now() where id = $2`, [desiredRole, existing.id]);
        updatedUserRoles += 1;
      }
      continue;
    }

    let username = usernameBase(i + 1);
    let bump = 1;
    while (existingUsernames.has(username)) {
      bump += 1;
      username = `${usernameBase(i + 1)}_${bump}`;
    }

    const passwordHash = await bcrypt.hash(randomUUID(), 10);
    const inserted = await client.query(
      `insert into users (id, username, password_hash, name, role, status, school_id, created_at, updated_at)
       values ($1, $2, $3, $4, $5, 'active', $6, now(), now())
       returning id, role, username`,
      [randomUUID(), username, passwordHash, entry.name, desiredRole, schoolId],
    );

    const created = inserted.rows[0] as { id: string; role: string; username: string };
    usersByName.set(entry.name, created);
    existingUsernames.add(created.username);
    createdUsers += 1;
  }

  const existingClassesResult = await client.query(
    `select id, name, teacher_id from classes where school_id = $1`,
    [schoolId],
  );
  const classByName = new Map<string, { id: string; teacherId: string | null }>();
  for (const row of existingClassesResult.rows as Array<{ id: string; name: string; teacher_id: string | null }>) {
    classByName.set(normalizeText(row.name), { id: row.id, teacherId: row.teacher_id });
  }

  let createdClasses = 0;
  let updatedClassTeachers = 0;

  for (const entry of dedupedEntries) {
    const teacher = usersByName.get(entry.name);
    if (!teacher) continue;

    const comboKey = `${normalizeText(entry.className)}|${normalizeText(entry.subject || "عام")}`;
    const label = classLabel(entry.className, entry.subject || "عام", entry.name, (classSubjectCounts.get(comboKey) || 0) > 1);
    const existingClass = classByName.get(label);

    if (!existingClass) {
      const inserted = await client.query(
        `insert into classes (id, name, academic_year, teacher_id, school_id)
         values ($1, $2, $3, $4, $5)
         returning id, teacher_id`,
        [randomUUID(), label, "2025-2026", teacher.id, schoolId],
      );
      const createdClass = inserted.rows[0] as { id: string; teacher_id: string | null };
      classByName.set(label, { id: createdClass.id, teacherId: createdClass.teacher_id });
      createdClasses += 1;
    } else if (existingClass.teacherId !== teacher.id) {
      await client.query(`update classes set teacher_id = $1 where id = $2`, [teacher.id, existingClass.id]);
      updatedClassTeachers += 1;
    }
  }

  console.log(
    JSON.stringify(
      {
        school,
        processedEntries: dedupedEntries.length,
        users: {
          created: createdUsers,
          updatedRoles: updatedUserRoles,
          totalInSchoolAfter: usersByName.size,
        },
        classes: {
          created: createdClasses,
          updatedTeacherAssignments: updatedClassTeachers,
          totalManagedLabels: classByName.size,
        },
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
