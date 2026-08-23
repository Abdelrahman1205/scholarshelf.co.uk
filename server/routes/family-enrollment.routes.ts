/**
 * server/routes/family-enrollment.routes.ts
 *
 * Family-first enrollment: the FAMILY record is the central enrollment object.
 * A family has many guardians and many students; a student belongs to one family.
 *
 * Security: schoolId is ALWAYS taken from the authenticated session (sessionSchoolId),
 * never from the request body. Every query is scoped to that school (tenant isolation).
 * Platform owners operate cross-school only via support mode, which sets the session
 * schoolId — so the same guard covers them.
 */
import type { Express, Request, Response } from "express";
import { and, eq, or, ilike, inArray, desc, sql } from "drizzle-orm";
import { getDb, getTxDb } from "../config/database.js";
import { storage } from "../storage.js";
import { families, guardians, students, familyStudents, childLinkingCodes } from "../../shared/schema.js";
import {
  requireRole, sessionSchoolId, auditLog, routeParam, ADMIN_UI_ROLES, rateLimit,
  generateLinkingCode, getEmailBrandingForSchool,
} from "../middleware/auth.js";
import { sendParentCodeEmail } from "../email.js";
import multer from "multer";
import {
  analyzeImport, commitImport, SpreadsheetParseError,
} from "../services/enrollment-import/import-service.js";
import { buildTemplateWorkbook } from "../services/enrollment-import/template.js";
import {
  IMPORT_MAX_FILE_BYTES, IMPORT_ALLOWED_EXTENSIONS, IMPORT_FIELDS,
} from "../../shared/enrollment-import.js";

const genFamilyCode = () => `FAM-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
const genStudentCode = () => `STU-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

// Self-healing backfill: legacy students are linked to families only via the
// family_students join and have a NULL students.family_id. Populate it from the
// join so every family/count read (which uses students.family_id) is correct.
// Guarded per-school so it runs at most once per school per process.
const _backfilledSchools = new Set<string>();
async function backfillFamilyIds(sid: string): Promise<void> {
  if (_backfilledSchools.has(sid)) return;
  _backfilledSchools.add(sid);
  try {
    await getDb().execute(sql`
      UPDATE students AS s SET family_id = fs.family_id
      FROM family_students AS fs
      WHERE fs.student_id = s.id AND s.family_id IS NULL AND s.school_id = ${sid}
    `);
    // Slice 2: one-time link of existing guardians to their portal users
    // (unambiguous email match only). Same per-school guard as above.
    await storage.backfillGuardianUserIds(sid);
  } catch {
    _backfilledSchools.delete(sid); // allow a retry on the next request
  }
}

type GuardianInput = { fullName?: string; relationship?: string; email?: string; phone?: string; isPrimaryContact?: boolean };
type StudentInput = { fullName?: string; dateOfBirth?: string; gender?: string; gradeLevel?: string; classId?: string; preferredReadingLevel?: string; photoUrl?: string };

function str(v: unknown, max = 300): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
}

// Only accept image data URIs or http(s) links for a student photo — reject
// data:text/html and other active-content schemes (stored-XSS defence).
function safePhotoUrl(v: unknown): string | null {
  const s = str(v, 800000);
  if (!s) return null;
  if (/^data:image\/(png|jpe?g|webp|gif|svg\+xml);base64,/i.test(s)) return s;
  if (/^https?:\/\//i.test(s)) return s.slice(0, 2000);
  return null;
}

// A real, past date of birth (rejects future dates and garbage strings).
function isValidDob(v: string | null): boolean {
  if (!v) return false;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return false;
  return d <= new Date() && d.getUTCFullYear() >= 1900;
}

// Basic email shape check (used only when an email is actually provided).
function isEmailish(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

// Reject any classId that doesn't belong to the caller's school (tenant isolation).
// Returns the offending id, or null if all are valid / none supplied.
async function firstForeignClassId(sid: string, ids: (string | null | undefined)[]): Promise<string | null> {
  const wanted = ids.map((c) => (typeof c === "string" ? c.trim() : "")).filter(Boolean);
  if (wanted.length === 0) return null;
  const schoolClasses = await storage.getClasses(sid);
  const valid = new Set(schoolClasses.map((c: any) => c.id));
  return wanted.find((c) => !valid.has(c)) || null;
}

async function findDuplicateStudentsByNameDob(
  db: any,
  sid: string,
  studentInputs: StudentInput[],
  excludeFamilyId?: string,
) {
  const duplicates: Array<{ inputName: string; inputDob: string; existing: { id: string; name: string; dateOfBirth: string | null; familyId: string | null; studentCode: string | null } }> = [];
  for (const s of studentInputs) {
    const name = str(s.fullName) || str((s as any).name);
    const dob = str(s.dateOfBirth);
    if (!name || !dob) continue;
    const rows = await db
      .select({
        id: students.id,
        name: students.name,
        dateOfBirth: students.dateOfBirth,
        familyId: students.familyId,
        studentCode: students.studentCode,
      })
      .from(students)
      .where(and(eq(students.schoolId, sid), eq(students.name, name), eq(students.dateOfBirth, dob)));
    for (const row of rows) {
      if (excludeFamilyId && row.familyId === excludeFamilyId) continue;
      duplicates.push({ inputName: name, inputDob: dob, existing: row });
    }
  }
  return duplicates;
}

async function findGuardianContactMatches(
  db: any,
  sid: string,
  guardianInputs: GuardianInput[],
  excludeFamilyId?: string,
) {
  const seen = new Set<string>();
  const matches: Array<{ familyId: string; fullName: string; email: string | null; phone: string | null }> = [];
  for (const g of guardianInputs) {
    const email = str(g.email, 255);
    const phone = str(g.phone, 40);
    const conds: any[] = [];
    if (email) conds.push(eq(guardians.email, email));
    if (phone) conds.push(eq(guardians.phone, phone));
    if (!conds.length) continue;
    const rows = await db
      .select({ familyId: guardians.familyId, fullName: guardians.fullName, email: guardians.email, phone: guardians.phone })
      .from(guardians)
      .where(and(eq(guardians.schoolId, sid), or(...conds)));
    for (const row of rows) {
      if (!row.familyId) continue;
      if (excludeFamilyId && row.familyId === excludeFamilyId) continue;
      const key = `${row.familyId}:${row.email || ""}:${row.phone || ""}`;
      if (seen.has(key)) continue;
      seen.add(key);
      matches.push(row);
    }
  }
  return matches;
}

// ── Spreadsheet import (inside New Enrollment) ────────────────────────────────
// The uploaded sheet contains children's personal data, so it is buffered in
// MEMORY ONLY and never written to disk — there is no uploads path a student
// sheet could later be served from. Extension and declared MIME are a first
// pass; the parser re-checks the actual magic bytes before reading anything.
const IMPORT_ALLOWED_MIME = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
  "application/vnd.ms-excel",                                          // .xls (and some .csv)
  "text/csv", "application/csv", "text/plain",
  "application/octet-stream",                                          // some browsers send this
]);

const sheetUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: IMPORT_MAX_FILE_BYTES, files: 1, fields: 10 },
  fileFilter: (_req, file, cb) => {
    const name = (file.originalname || "").toLowerCase();
    const ext = name.slice(name.lastIndexOf("."));
    if (!(IMPORT_ALLOWED_EXTENSIONS as readonly string[]).includes(ext)) {
      cb(new Error("Only .xlsx, .xls and .csv files can be imported."));
      return;
    }
    if (file.mimetype && !IMPORT_ALLOWED_MIME.has(file.mimetype)) {
      cb(new Error(`Unsupported file type "${file.mimetype}". Upload an .xlsx, .xls or .csv file.`));
      return;
    }
    cb(null, true);
  },
});

/** Run multer for one field and surface its errors as clean 400s. */
function runSheetUpload(req: Request, res: Response): Promise<void> {
  return new Promise((resolve, reject) => {
    sheetUpload.single("file")(req as any, res as any, (err: unknown) => {
      if (!err) return resolve();
      const message = err instanceof Error ? err.message : "Upload failed";
      reject(Object.assign(
        new Error(
          message.includes("File too large")
            ? `That file is larger than ${Math.round(IMPORT_MAX_FILE_BYTES / (1024 * 1024))} MB.`
            : message,
        ),
        { httpStatus: 400 },
      ));
    });
  });
}

/** Parse the optional `mapping` form field (column index → field key). */
function parseMappingField(raw: unknown): Record<string, string | null> | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { throw Object.assign(new Error("Column mapping was not valid JSON."), { httpStatus: 400 }); }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw Object.assign(new Error("Column mapping must be an object."), { httpStatus: 400 });
  }
  const out: Record<string, string | null> = {};
  for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
    if (!/^\d{1,3}$/.test(k)) continue;                       // column indices only
    out[k] = v === null || v === "" || v === "ignore" ? null : String(v).slice(0, 60);
  }
  return out;
}

/**
 * Resend permits a couple of sends per second. A 300-family import that ignores
 * that gets rate-limited into silent failure, so every bulk send paces itself.
 */
const INVITE_SEND_GAP_MS = 300;

/** "a****z@example.com" — enough for an admin to recognise, not enough to harvest. */
function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "***";
  const head = local.slice(0, 1);
  const tail = local.length > 1 ? local.slice(-1) : "";
  return `${head}${"*".repeat(Math.max(1, local.length - 2))}${tail}@${domain}`;
}

interface InviteCandidate {
  familyId: string;
  familyName: string;
  guardianId: string;
  email: string;
}

/**
 * Guardians who still cannot log in: they have an email address, no portal
 * account, and their family holds no live unredeemed linking code.
 *
 * One candidate per family — a linking code covers the whole household, so
 * inviting both parents separately would issue two credentials for one family.
 * The primary contact wins where there is one.
 */
async function findUninvitedGuardians(schoolId: string): Promise<InviteCandidate[]> {
  const rows = await getDb().select({
    guardianId: guardians.id,
    familyId: guardians.familyId,
    fullName: guardians.fullName,
    email: guardians.email,
    isPrimaryContact: guardians.isPrimaryContact,
    portalAccessStatus: guardians.portalAccessStatus,
    userId: guardians.userId,
    familyName: families.householdName,
    familyFallbackName: families.name,
  })
    .from(guardians)
    .leftJoin(families, eq(guardians.familyId, families.id))
    .where(eq(guardians.schoolId, schoolId));

  const now = new Date();
  const liveCodes = await getDb().select({
    familyId: childLinkingCodes.familyId,
    isUsed: childLinkingCodes.isUsed,
    expiresAt: childLinkingCodes.expiresAt,
  }).from(childLinkingCodes).where(eq(childLinkingCodes.schoolId, schoolId));

  const familiesWithLiveCode = new Set(
    liveCodes
      .filter((c) => !c.isUsed && (!c.expiresAt || new Date(c.expiresAt) > now))
      .map((c) => c.familyId)
      .filter(Boolean) as string[],
  );

  const emailish = (v: string | null) => !!v && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
  const byFamily = new Map<string, typeof rows>();
  for (const r of rows) {
    if (!r.familyId) continue;
    byFamily.set(r.familyId, [...(byFamily.get(r.familyId) || []), r] as typeof rows);
  }

  const candidates: InviteCandidate[] = [];
  for (const [familyId, guardianRows] of byFamily) {
    if (familiesWithLiveCode.has(familyId)) continue;
    // Someone in this household already has portal access.
    if (guardianRows.some((g) => g.userId || g.portalAccessStatus === "active")) continue;
    const withEmail = guardianRows.filter((g) => emailish(g.email));
    const chosen = withEmail.find((g) => g.isPrimaryContact) || withEmail[0];
    if (!chosen) continue;
    candidates.push({
      familyId,
      familyName: chosen.familyName || chosen.familyFallbackName || "your family",
      guardianId: chosen.guardianId,
      email: String(chosen.email).trim().toLowerCase(),
    });
  }
  return candidates;
}

export function registerFamilyEnrollmentRoutes(app: Express): void {
  // ── Import: the field registry, so the dialog renders the same fields the
  //    server accepts (single source of truth: shared/enrollment-import.ts) ──
  app.get("/api/families/enroll/import/fields", requireRole(...ADMIN_UI_ROLES), (_req, res) => {
    res.json({
      fields: IMPORT_FIELDS.map((f) => ({
        key: f.key, label: f.label, group: f.group, required: f.required, hint: f.hint || null,
      })),
      maxFileBytes: IMPORT_MAX_FILE_BYTES,
      allowedExtensions: IMPORT_ALLOWED_EXTENSIONS,
    });
  });

  // ── Import: downloadable template, built from the same field registry ──
  app.get("/api/families/enroll/import/template", requireRole(...ADMIN_UI_ROLES), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      if (!sid) return res.status(400).json({ message: "School context required" });
      const buf = buildTemplateWorkbook();
      await auditLog(req, "student_import_template_downloaded", `school:${sid}`);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", 'attachment; filename="scholarshelf-student-import-template.xlsx"');
      res.setHeader("Cache-Control", "no-store");
      res.send(buf);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // ── Import step 1: ANALYSE. Read-only — nothing is written to the database.
  //    Returns detected columns, the proposed mapping, per-row validation, the
  //    existing/new student split and the classes that would be created. ──
  app.post("/api/families/enroll/import/analyze", requireRole(...ADMIN_UI_ROLES), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      if (!sid) return res.status(400).json({ message: "School context required" });
      if (await rateLimit(`student-import-analyze:${sid}:${req.session.userId}`, 30, 60 * 1000)) {
        return res.status(429).json({ message: "Too many import previews. Please slow down." });
      }
      await runSheetUpload(req, res);
      const file = (req as any).file as Express.Multer.File | undefined;
      if (!file?.buffer?.length) return res.status(400).json({ message: "Choose a spreadsheet to import." });

      const result = await analyzeImport({
        db: getDb(),
        schoolId: sid,
        buffer: file.buffer,
        filename: file.originalname || "import.xlsx",
        mappingOverrides: parseMappingField((req as any).body?.mapping),
      });

      // Record that a student sheet was opened — the file itself is never stored.
      await auditLog(req, "student_import_previewed", `school:${sid}`, {
        filename: file.originalname,
        rows: result.summary.studentsDetected,
        newStudents: result.summary.newStudents,
        existingStudents: result.summary.existingStudents,
        invalidRows: result.summary.invalidRows,
        newClasses: result.summary.newClasses,
      });

      res.json(result);
    } catch (e: any) {
      const status = e instanceof SpreadsheetParseError ? 400 : (e?.httpStatus || 400);
      res.status(status).json({ message: e?.message || "The spreadsheet could not be analysed." });
    }
  });

  // ── Import step 2: COMMIT. The only endpoint that writes. Re-parses and
  //    re-validates the ORIGINAL file (the browser's preview is never trusted)
  //    and applies everything inside one transaction. ──
  app.post("/api/families/enroll/import/commit", requireRole(...ADMIN_UI_ROLES), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      if (!sid) return res.status(400).json({ message: "School context required" });
      if (await rateLimit(`student-import-commit:${sid}:${req.session.userId}`, 10, 60 * 1000)) {
        return res.status(429).json({ message: "Too many imports. Please slow down and try again shortly." });
      }
      await runSheetUpload(req, res);
      const file = (req as any).file as Express.Multer.File | undefined;
      if (!file?.buffer?.length) return res.status(400).json({ message: "Choose a spreadsheet to import." });

      const result = await commitImport({
        txDb: getTxDb(),
        schoolId: sid,
        buffer: file.buffer,
        filename: file.originalname || "import.xlsx",
        mappingOverrides: parseMappingField((req as any).body?.mapping),
      });

      // ── Audit (after commit) ──
      await auditLog(req, "students_spreadsheet_imported", `school:${sid}`, {
        filename: file.originalname,
        processed: result.processed,
        created: result.created,
        updated: result.updated,
        skipped: result.skipped,
        classesCreated: result.classesCreated,
        familiesCreated: result.familiesCreated,
        guardiansCreated: result.guardiansCreated,
        failedRows: result.errorCount,
      });
      // Auto-created classes are tagged with their origin so it is always clear
      // a class came from a spreadsheet enrollment import rather than by hand.
      for (const name of result.createdClassNames) {
        await auditLog(req, "class_created", `school:${sid}`, {
          name, source: "enrollment_spreadsheet_import", filename: file.originalname,
        }).catch(() => {});
      }

      // ── Send the parent invitations the commit wrote ──────────────────────
      //
      // The codes are already in the database, inside the same transaction as
      // the import. Sending happens here, after commit, because a send cannot be
      // rolled back — and because a mail outage must not lose an import of 300
      // families. Anything that fails to send stays valid and is picked up by
      // POST /api/families/invitations/send-pending.
      let invitationsSent = 0;
      const invitationsFailed: string[] = [];
      if (result.pendingInvitations.length > 0) {
        const branding = await getEmailBrandingForSchool(req, sid);
        for (const invite of result.pendingInvitations) {
          const sent = await sendParentCodeEmail(
            invite.email, invite.familyName, invite.code, invite.expiresAt, branding,
          ).catch(() => false);
          if (sent) invitationsSent++;
          else invitationsFailed.push(invite.email);
          // Resend allows a couple of sends per second; a 300-family import
          // would otherwise be rate-limited into silent failure.
          await new Promise((r) => setTimeout(r, INVITE_SEND_GAP_MS));
        }
        await auditLog(req, "import_parent_invitations_sent", `school:${sid}`, {
          created: result.pendingInvitations.length,
          sent: invitationsSent,
          failed: invitationsFailed.length,
        }).catch(() => {});
      }

      res.status(201).json({
        ...result,
        // Do not hand the codes themselves back to the browser — they are live
        // credentials for a household. The counts are what the admin needs.
        pendingInvitations: undefined,
        invitationsCreated: result.pendingInvitations.length,
        invitationsSent,
        invitationsFailed: invitationsFailed.length,
      });
    } catch (e: any) {
      const status = e instanceof SpreadsheetParseError ? 400 : (e?.httpStatus || 400);
      res.status(status).json({ message: e?.message || "The import failed and nothing was changed." });
    }
  });

  // ── Bulk invite: every guardian who still cannot log in ──────────────────
  //
  // The safety net for the import path. Covers guardians whose email arrived
  // after the import, whose invitation email bounced, or who were created before
  // the importer issued codes at all. Idempotent: a family that already holds a
  // live unredeemed code is skipped, so pressing the button twice does not
  // invalidate the code already sitting in a parent's inbox.
  app.post("/api/families/invitations/send-pending", requireRole(...ADMIN_UI_ROLES), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      if (!sid) return res.status(400).json({ message: "School context required" });
      if (await rateLimit(`bulk-invite:${sid}`, 4, 60 * 60 * 1000)) {
        return res.status(429).json({
          message: "Bulk invitations were sent recently. Please wait before sending another round.",
        });
      }

      const dryRun = req.body?.dryRun === true;
      const pending = await findUninvitedGuardians(sid);

      if (dryRun) {
        return res.json({
          dryRun: true,
          candidates: pending.length,
          families: pending.map((p) => ({ familyName: p.familyName, email: maskEmail(p.email) })),
        });
      }

      let sent = 0;
      const failed: string[] = [];
      const branding = await getEmailBrandingForSchool(req, sid);

      for (const candidate of pending) {
        const code = generateLinkingCode();
        const expiresAt = new Date(Date.now() + 30 * 86400000);
        await storage.createLinkingCode({
          studentId: null as any, familyId: candidate.familyId, code,
          parentEmail: candidate.email, expiresAt, schoolId: sid,
        });
        await getDb().update(guardians)
          .set({ portalAccessStatus: "invited", updatedAt: new Date() })
          .where(eq(guardians.id, candidate.guardianId));

        const ok = await sendParentCodeEmail(
          candidate.email, candidate.familyName, code, expiresAt, branding,
        ).catch(() => false);
        if (ok) sent++; else failed.push(candidate.email);
        await new Promise((r) => setTimeout(r, INVITE_SEND_GAP_MS));
      }

      await auditLog(req, "bulk_parent_invitations_sent", `school:${sid}`, {
        candidates: pending.length, sent, failed: failed.length,
      });

      res.json({ candidates: pending.length, sent, failed: failed.length });
    } catch (e: any) {
      res.status(e?.httpStatus || 400).json({ message: e?.message || "Could not send invitations." });
    }
  });

  // ── Search families by guardian name/email/phone or student name (with dup hints) ──
  app.get("/api/families/search", requireRole(...ADMIN_UI_ROLES), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      if (!sid) return res.status(400).json({ message: "School context required" });
      if (await rateLimit(`family-search:${req.session.userId}`, 90, 60 * 1000)) {
        return res.status(429).json({ message: "Too many searches. Please slow down." });
      }
      const q = str(req.query.q, 120);
      if (!q) return res.json([]);
      const like = `%${q}%`;
      const db = getDb();

      const [famMatches, guardianMatches, studentMatches] = await Promise.all([
        db.select({ id: families.id }).from(families).where(and(
          eq(families.schoolId, sid),
          or(ilike(families.householdName, like), ilike(families.name, like), ilike(families.primaryEmail, like), ilike(families.primaryPhone, like), ilike(families.familyCode, like)),
        )),
        db.select({ familyId: guardians.familyId }).from(guardians).where(and(
          eq(guardians.schoolId, sid),
          or(ilike(guardians.fullName, like), ilike(guardians.email, like), ilike(guardians.phone, like)),
        )),
        db.select({ familyId: students.familyId }).from(students).where(and(
          eq(students.schoolId, sid), ilike(students.name, like),
        )),
      ]);

      const ids = Array.from(new Set<string>([
        ...famMatches.map((f) => f.id),
        ...guardianMatches.map((g) => g.familyId).filter(Boolean) as string[],
        ...studentMatches.map((s) => s.familyId).filter(Boolean) as string[],
      ]));
      if (ids.length === 0) return res.json([]);

      const rows = await db.select().from(families).where(and(eq(families.schoolId, sid), inArray(families.id, ids)));
      const [gs, ss] = await Promise.all([
        db.select().from(guardians).where(inArray(guardians.familyId, ids)),
        db.select().from(students).where(and(eq(students.schoolId, sid), inArray(students.familyId, ids))),
      ]);
      const result = rows.map((f) => ({
        ...f,
        guardians: gs.filter((g) => g.familyId === f.id),
        students: ss.filter((s) => s.familyId === f.id),
      }));
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // ── List families (school-scoped) with counts ──
  app.get("/api/families", requireRole(...ADMIN_UI_ROLES), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      if (!sid) return res.status(400).json({ message: "School context required" });
      const db = getDb();
      await backfillFamilyIds(sid);
      const rows = await db.select().from(families).where(eq(families.schoolId, sid)).orderBy(desc(families.createdAt));
      const ids = rows.map((r) => r.id);
      const [gs, ss] = ids.length
        ? await Promise.all([
            db.select().from(guardians).where(inArray(guardians.familyId, ids)),
            db.select().from(students).where(and(eq(students.schoolId, sid), inArray(students.familyId, ids))),
          ])
        : [[], []];
      res.json(rows.map((f) => ({
        ...f,
        guardianCount: gs.filter((g) => g.familyId === f.id).length,
        studentCount: ss.filter((s) => s.familyId === f.id).length,
      })));
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // ── Family profile (family + guardians + students) ──
  app.get("/api/families/:id", requireRole(...ADMIN_UI_ROLES), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      if (!sid) return res.status(400).json({ message: "School context required" });
      const db = getDb();
      await backfillFamilyIds(sid);
      const [family] = await db.select().from(families).where(and(eq(families.id, routeParam(req.params.id)), eq(families.schoolId, sid)));
      if (!family) return res.status(404).json({ message: "Family not found" });
      const [gs, ss] = await Promise.all([
        db.select().from(guardians).where(eq(guardians.familyId, family.id)),
        db.select().from(students).where(and(eq(students.schoolId, sid), eq(students.familyId, family.id))),
      ]);
      res.json({ ...family, guardians: gs, students: ss });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // ── Create a family shell ──
  app.post("/api/families", requireRole(...ADMIN_UI_ROLES), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      if (!sid) return res.status(400).json({ message: "School context required" });
      const householdName = str(req.body?.householdName) || str(req.body?.name);
      if (!householdName) return res.status(400).json({ message: "Family / household name is required" });
      const db = getDb();
      const [family] = await db.insert(families).values({
        name: householdName, householdName, schoolId: sid,
        familyCode: genFamilyCode(),
        primaryPhone: str(req.body?.primaryPhone, 40),
        primaryEmail: str(req.body?.primaryEmail, 255),
        address: str(req.body?.address, 500),
        status: "draft",
      }).returning();
      await auditLog(req, "family_created", `family:${family.id}`, { familyCode: family.familyCode });
      res.status(201).json(family);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  // ── Update family details ──
  app.patch("/api/families/:id", requireRole(...ADMIN_UI_ROLES), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      if (!sid) return res.status(400).json({ message: "School context required" });
      const db = getDb();
      const id = routeParam(req.params.id);
      const [existing] = await db.select().from(families).where(and(eq(families.id, id), eq(families.schoolId, sid)));
      if (!existing) return res.status(404).json({ message: "Family not found" });
      const patch: Record<string, any> = { updatedAt: new Date() };
      const hn = str(req.body?.householdName);
      if (hn) { patch.householdName = hn; patch.name = hn; }
      if ("primaryPhone" in (req.body || {})) patch.primaryPhone = str(req.body.primaryPhone, 40);
      if ("primaryEmail" in (req.body || {})) patch.primaryEmail = str(req.body.primaryEmail, 255);
      if ("address" in (req.body || {})) patch.address = str(req.body.address, 500);
      if (typeof req.body?.status === "string" && ["draft", "ready", "enrolled"].includes(req.body.status)) patch.status = req.body.status;
      const [family] = await db.update(families).set(patch).where(and(eq(families.id, id), eq(families.schoolId, sid))).returning();
      await auditLog(req, "family_updated", `family:${id}`);
      res.json(family);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  // ── Delete a family (unlinks students but keeps their records/history) ──
  // NOTE: a second, naive DELETE handler for this same path was removed — it
  // deleted the family without detaching students first, which orphaned them.
  // Express uses the first matching route, so that naive one was silently the
  // live handler. This is the single, correct implementation.
  app.delete("/api/families/:id", requireRole(...ADMIN_UI_ROLES), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      if (!sid) return res.status(400).json({ message: "School context required" });
      const db = getDb();
      const id = routeParam(req.params.id);
      const [existing] = await db.select().from(families).where(and(eq(families.id, id), eq(families.schoolId, sid)));
      if (!existing) return res.status(404).json({ message: "Family not found" });
      // Detach students (preserve the student rows + their allocation/payment history),
      // drop the join rows, then delete the family. Guardians cascade via their FK.
      await db.update(students).set({ familyId: null }).where(and(eq(students.familyId, id), eq(students.schoolId, sid)));
      await db.delete(familyStudents).where(eq(familyStudents.familyId, id));
      await db.delete(families).where(and(eq(families.id, id), eq(families.schoolId, sid)));
      await auditLog(req, "family_deleted", `family:${id}`, { familyCode: existing.familyCode });
      res.status(204).send();
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  // ── Guardians ──
  app.post("/api/families/:id/guardians", requireRole(...ADMIN_UI_ROLES), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      if (!sid) return res.status(400).json({ message: "School context required" });
      const db = getDb();
      const familyId = routeParam(req.params.id);
      const [family] = await db.select().from(families).where(and(eq(families.id, familyId), eq(families.schoolId, sid)));
      if (!family) return res.status(404).json({ message: "Family not found" });
      const fullName = str(req.body?.fullName);
      if (!fullName) return res.status(400).json({ message: "Guardian full name is required" });
      if (!str(req.body?.email) && !str(req.body?.phone)) return res.status(400).json({ message: "Provide at least one contact method (email or phone)" });
      { const gEmail = str(req.body?.email, 255); if (gEmail && !isEmailish(gEmail)) return res.status(400).json({ message: "Enter a valid email address." }); }
      const makePrimary = req.body?.isPrimaryContact === true;
      if (makePrimary) await db.update(guardians).set({ isPrimaryContact: false }).where(eq(guardians.familyId, familyId));
      const [g] = await db.insert(guardians).values({
        schoolId: sid, familyId, fullName,
        relationship: str(req.body?.relationship, 40),
        email: str(req.body?.email, 255), phone: str(req.body?.phone, 40),
        isPrimaryContact: makePrimary,
      }).returning();
      if (makePrimary) await db.update(families).set({ primaryContactGuardianId: g.id, updatedAt: new Date() }).where(eq(families.id, familyId));
      await auditLog(req, "guardian_added", `guardian:${g.id}`, { familyId });
      res.status(201).json(g);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.patch("/api/guardians/:id", requireRole(...ADMIN_UI_ROLES), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      if (!sid) return res.status(400).json({ message: "School context required" });
      const db = getDb();
      const id = routeParam(req.params.id);
      const [existing] = await db.select().from(guardians).where(and(eq(guardians.id, id), eq(guardians.schoolId, sid)));
      if (!existing) return res.status(404).json({ message: "Guardian not found" });
      const patch: Record<string, any> = { updatedAt: new Date() };
      if (str(req.body?.fullName)) patch.fullName = str(req.body.fullName);
      if ("relationship" in (req.body || {})) patch.relationship = str(req.body.relationship, 40);
      if ("email" in (req.body || {})) patch.email = str(req.body.email, 255);
      if ("phone" in (req.body || {})) patch.phone = str(req.body.phone, 40);
      if (req.body?.isPrimaryContact === true) {
        await db.update(guardians).set({ isPrimaryContact: false }).where(eq(guardians.familyId, existing.familyId));
        patch.isPrimaryContact = true;
        await db.update(families).set({ primaryContactGuardianId: id, updatedAt: new Date() }).where(eq(families.id, existing.familyId));
      }
      const [g] = await db.update(guardians).set(patch).where(and(eq(guardians.id, id), eq(guardians.schoolId, sid))).returning();
      await auditLog(req, "guardian_updated", `guardian:${id}`);
      res.json(g);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.delete("/api/guardians/:id", requireRole(...ADMIN_UI_ROLES), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      if (!sid) return res.status(400).json({ message: "School context required" });
      const db = getDb();
      const id = routeParam(req.params.id);
      const [g] = await db.delete(guardians).where(and(eq(guardians.id, id), eq(guardians.schoolId, sid))).returning();
      if (!g) return res.status(404).json({ message: "Guardian not found" });
      await auditLog(req, "guardian_removed", `guardian:${id}`, { familyId: g.familyId });
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  // ── Invite a guardian to the parent portal ──
  // Reuses the family link-code + parent-invite email: the guardian receives a
  // code that links their new/existing parent account to ALL students in the family.
  app.post("/api/guardians/:id/invite", requireRole(...ADMIN_UI_ROLES), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      if (!sid) return res.status(400).json({ message: "School context required" });
      const db = getDb();
      const id = routeParam(req.params.id);
      const [guardian] = await db.select().from(guardians).where(and(eq(guardians.id, id), eq(guardians.schoolId, sid)));
      if (!guardian) return res.status(404).json({ message: "Guardian not found" });
      const email = str(guardian.email, 255);
      if (!email || !isEmailish(email)) return res.status(400).json({ message: "Add a valid email for this guardian before inviting them." });

      const [family] = await db.select().from(families).where(and(eq(families.id, guardian.familyId), eq(families.schoolId, sid)));
      if (!family) return res.status(404).json({ message: "Family not found" });

      await backfillFamilyIds(sid);
      const kids = await db.select().from(students).where(and(eq(students.schoolId, sid), eq(students.familyId, guardian.familyId)));
      if (kids.length === 0) return res.status(400).json({ message: "Add at least one student to this family before inviting a guardian." });

      const code = generateLinkingCode();
      const expiresAt = new Date(Date.now() + 30 * 86400000);
      await storage.createLinkingCode({
        studentId: null as any, familyId: guardian.familyId, code,
        parentEmail: email.toLowerCase(), expiresAt, schoolId: sid,
      });

      sendParentCodeEmail(email, family.householdName || family.name, code, expiresAt, await getEmailBrandingForSchool(req, sid)).catch(() => {});
      const [updated] = await db.update(guardians).set({ portalAccessStatus: "invited", updatedAt: new Date() }).where(eq(guardians.id, id)).returning();
      await auditLog(req, "guardian_invited", `guardian:${id}`, { familyId: guardian.familyId, students: kids.length });
      res.json({ success: true, portalAccessStatus: "invited", expiresAt, guardian: updated });
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  // ── Add a student to a family ──
  app.post("/api/families/:id/students", requireRole(...ADMIN_UI_ROLES), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      if (!sid) return res.status(400).json({ message: "School context required" });
      const db = getDb();
      const familyId = routeParam(req.params.id);
      const [family] = await db.select().from(families).where(and(eq(families.id, familyId), eq(families.schoolId, sid)));
      if (!family) return res.status(404).json({ message: "Family not found" });
      const possibleDupes = await findDuplicateStudentsByNameDob(db, sid, [req.body || {}], familyId);
      if (possibleDupes.length > 0) {
        return res.status(409).json({
          message: "Possible duplicate student found with the same name and date of birth.",
          duplicate: true,
          studentMatches: possibleDupes.map((d) => ({
            studentId: d.existing.id,
            studentCode: d.existing.studentCode,
            fullName: d.existing.name,
            dateOfBirth: d.existing.dateOfBirth,
            familyId: d.existing.familyId,
          })),
        });
      }
      const badClass = await firstForeignClassId(sid, [req.body?.classId]);
      if (badClass) return res.status(400).json({ message: "That class is not in your school." });
      const created = await addStudentToFamily(db, sid, familyId, req.body || {}, false);
      if ("error" in created) return res.status(400).json({ message: created.error });
      await auditLog(req, "student_added", `student:${created.student.id}`, { familyId });
      res.status(201).json(created.student);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  // NOTE: PATCH/DELETE /api/students/:id are owned by book.routes.ts
  // (update passes new columns through storage.updateStudent; delete does a
  // safe soft-archive that preserves allocation/payment history). We reuse those.

  // ── Student profile (aggregated: family, guardians, class, book list, allocations) ──
  app.get("/api/students/:id/profile", requireRole(...ADMIN_UI_ROLES), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      if (!sid) return res.status(400).json({ message: "School context required" });
      const db = getDb();
      const [student] = await db.select().from(students).where(and(eq(students.id, routeParam(req.params.id)), eq(students.schoolId, sid)));
      if (!student) return res.status(404).json({ message: "Student not found" });

      let family: any = null;
      let guardianRows: any[] = [];
      if (student.familyId) {
        [family] = await db.select().from(families).where(and(eq(families.id, student.familyId), eq(families.schoolId, sid)));
        guardianRows = await db.select().from(guardians).where(eq(guardians.familyId, student.familyId));
      }

      const classes = await storage.getClasses(sid);
      const cls: any = classes.find((c: any) => c.id === student.classId) || null;

      // Book list = the bundle(s) assigned to the student's class
      const bookList: any[] = [];
      let bundleName: string | null = null;
      if (student.classId) {
        const cbls = await storage.getClassBookLevels(sid);
        for (const a of cbls.filter((c: any) => c.classId === student.classId)) {
          bundleName = (a as any).bookLevel?.name || bundleName;
          const items = await storage.getBookLevelItems((a as any).bookLevelId);
          for (const it of items) bookList.push({ title: it.book?.title || "Book", quantity: it.quantity ?? 1, price: it.book?.price ?? null });
        }
      }

      // This student's allocations
      const allAllocs = await storage.getAllocations(undefined, sid);
      const allocations = allAllocs
        .filter((a: any) => (a.studentId || a.student?.id) === student.id)
        .map((a: any) => ({ book: a.book?.title || "Book", status: a.status, distributionStatus: a.distributionStatus, allocatedAt: a.allocatedAt, receivedAt: a.receivedAt }));
      const received = allocations.filter((a: any) => a.status === "received" || a.distributionStatus === "received").length;

      res.json({
        student,
        family: family ? { id: family.id, familyCode: family.familyCode, householdName: family.householdName || family.name } : null,
        guardians: guardianRows,
        class: cls ? { id: cls.id, name: cls.name, yearGroup: cls.yearGroup } : null,
        bundleName,
        bookList,
        allocations,
        allocationSummary: { total: allocations.length, received, pending: allocations.length - received },
      });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // ── Enroll a family atomically (create/link family + guardians + students) ──
  app.post("/api/families/enroll", requireRole(...ADMIN_UI_ROLES), async (req, res) => {
    return enrollHandler(req, res, false);
  });
  app.post("/api/families/:id/enroll", requireRole(...ADMIN_UI_ROLES), async (req, res) => {
    return enrollHandler(req, res, false);
  });
  app.post("/api/families/save-draft", requireRole(...ADMIN_UI_ROLES), async (req, res) => {
    return enrollHandler(req, res, true);
  });
  app.post("/api/families/:id/save-draft", requireRole(...ADMIN_UI_ROLES), async (req, res) => {
    return enrollHandler(req, res, true);
  });
}

// Shared helper: create a student row + family_students join.
async function addStudentToFamily(db: any, sid: string, familyId: string, input: StudentInput, draft: boolean) {
  const name = str(input.fullName) || str((input as any).name);
  if (!draft) {
    if (!name) return { error: "Student full name is required" };
    if (!str(input.dateOfBirth)) return { error: "Student date of birth is required" };
    if (!str(input.gradeLevel)) return { error: "Student grade level is required" };
  }
  const [student] = await db.insert(students).values({
    name: name || "Unnamed student",
    schoolId: sid,
    familyId,
    studentCode: genStudentCode(),
    classId: str(input.classId) || null,
    dateOfBirth: str(input.dateOfBirth),
    gender: str(input.gender, 20),
    gradeLevel: str(input.gradeLevel, 40),
    preferredReadingLevel: str(input.preferredReadingLevel, 40),
    photoUrl: safePhotoUrl(input.photoUrl),
    status: "active",
  }).returning();
  await db.insert(familyStudents).values({ familyId, studentId: student.id });
  return { student };
}

async function enrollHandler(req: Request, res: Response, draft: boolean) {
  try {
    const sid = sessionSchoolId(req);
    if (!sid) return res.status(400).json({ message: "School context required" });
    if (await rateLimit(`family-enroll:${sid}:${req.session.userId}`, 30, 60 * 1000)) {
      return res.status(429).json({ message: "Too many enrollment attempts. Please slow down and try again shortly." });
    }
    const db = getDb();
    const body = req.body || {};
    const guardianInputs: GuardianInput[] = Array.isArray(body.guardians) ? body.guardians : [];
    const studentInputs: StudentInput[] = Array.isArray(body.students) ? body.students : [];
    const override = body.duplicateOverride === true;
    const householdName = str(body.family?.householdName) || str(body.householdName);
    let familyId: string | null = str(body.familyId);
    let duplicateMatched = false;

    // Tenant isolation: no student may be attached to another school's class.
    const foreignClass = await firstForeignClassId(sid, studentInputs.map((s) => s.classId));
    if (foreignClass) return res.status(400).json({ message: "One or more selected classes are not in your school." });

    // ── Validation (final enrollment only; drafts may be incomplete) ──
    if (!draft) {
      if (!familyId && !householdName) return res.status(400).json({ message: "Family / household name is required" });
      // Only require guardians in the request when creating a NEW family.
      // When linking an existing family (familyId provided), guardians already
      // exist in the database — the admin does not need to re-enter them.
      if (!familyId) {
        const validGuardians = guardianInputs.filter((g) => str(g.fullName) && (str(g.email) || str(g.phone)));
        if (validGuardians.length === 0) return res.status(400).json({ message: "A family must have at least one guardian with a name and contact method." });
      }
      const validStudents = studentInputs.filter((s) => str(s.fullName) && str(s.dateOfBirth) && str(s.gradeLevel));
      if (validStudents.length === 0) return res.status(400).json({ message: "A family must have at least one student with a name, date of birth and grade level." });
      // Format checks
      for (const s of validStudents) {
        if (!isValidDob(str(s.dateOfBirth))) return res.status(400).json({ message: `Enter a valid past date of birth for ${str(s.fullName) || "a student"}.` });
      }
      for (const g of guardianInputs) {
        const email = str(g.email, 255);
        if (email && !isEmailish(email)) return res.status(400).json({ message: `"${email}" doesn't look like a valid email address.` });
      }
    }

    // ── Duplicate protection (only when creating a brand-new family) ──
    if (!familyId) {
      const primaryEmail = str(body.family?.primaryEmail) || guardianInputs.map((g) => str(g.email)).find(Boolean) || null;
      const primaryPhone = str(body.family?.primaryPhone) || guardianInputs.map((g) => str(g.phone)).find(Boolean) || null;
      const dupConds = [] as any[];
      if (primaryEmail) dupConds.push(eq(families.primaryEmail, primaryEmail));
      if (primaryPhone) dupConds.push(eq(families.primaryPhone, primaryPhone));
      const guardianContactMatches = await findGuardianContactMatches(db, sid, guardianInputs);
      const famDup = dupConds.length ? await db.select().from(families).where(and(eq(families.schoolId, sid), or(...dupConds))) : [];
      duplicateMatched = famDup.length > 0 || guardianContactMatches.length > 0;
      if (duplicateMatched && !override) {
        return res.status(409).json({
          message: "A family with this email or phone may already exist.",
          duplicate: true,
          matches: famDup.map((f: any) => ({ id: f.id, familyCode: f.familyCode, householdName: f.householdName || f.name })),
          guardianMatches: guardianContactMatches,
        });
      }
    }

    // Duplicate student protection: same school + same full name + same DOB.
    const duplicateStudents = await findDuplicateStudentsByNameDob(db, sid, studentInputs, familyId || undefined);
    if (duplicateStudents.length > 0) {
      duplicateMatched = true;
      if (!override && !draft) {
        return res.status(409).json({
          message: "Possible duplicate student records found for the same name and date of birth.",
          duplicate: true,
          studentMatches: duplicateStudents.map((d) => ({
            studentId: d.existing.id,
            studentCode: d.existing.studentCode,
            fullName: d.existing.name,
            dateOfBirth: d.existing.dateOfBirth,
            familyId: d.existing.familyId,
          })),
        });
      }
    }

    // ── Create/link family + guardians + students — ATOMIC (all-or-nothing) ──
    // Runs over the pg Pool driver (getTxDb) because the Neon HTTP driver used
    // for reads does not support interactive transactions. Any failure rolls the
    // whole enrollment back, so we never leave a half-created family behind.
    const outcome = await getTxDb().transaction(async (trx) => {
      let family: any;
      if (familyId) {
        [family] = await trx.select().from(families).where(and(eq(families.id, familyId), eq(families.schoolId, sid)));
        if (!family) throw Object.assign(new Error("Family not found"), { httpStatus: 404 });
        const patch: Record<string, any> = { updatedAt: new Date(), status: draft ? "draft" : "enrolled" };
        if (householdName) { patch.householdName = householdName; patch.name = householdName; }
        if (str(body.family?.primaryEmail)) patch.primaryEmail = str(body.family.primaryEmail, 255);
        if (str(body.family?.primaryPhone)) patch.primaryPhone = str(body.family.primaryPhone, 40);
        if (str(body.family?.address)) patch.address = str(body.family.address, 500);
        [family] = await trx.update(families).set(patch).where(eq(families.id, familyId)).returning();
      } else {
        [family] = await trx.insert(families).values({
          name: householdName || "New Family", householdName: householdName || "New Family", schoolId: sid,
          familyCode: genFamilyCode(),
          primaryEmail: str(body.family?.primaryEmail, 255) || guardianInputs.map((g) => str(g.email)).find(Boolean) || null,
          primaryPhone: str(body.family?.primaryPhone, 40) || guardianInputs.map((g) => str(g.phone)).find(Boolean) || null,
          address: str(body.family?.address, 500),
          status: draft ? "draft" : "enrolled",
        }).returning();
      }

      // Guardians (only the ones with a name)
      const createdGuardians: any[] = [];
      let primarySet = false;
      for (const g of guardianInputs) {
        const fullName = str(g.fullName);
        if (!fullName) continue;
        const isPrimary = g.isPrimaryContact === true && !primarySet;
        if (isPrimary) primarySet = true;
        const [row] = await trx.insert(guardians).values({
          schoolId: sid, familyId: family.id, fullName,
          relationship: str(g.relationship, 40), email: str(g.email, 255), phone: str(g.phone, 40),
          isPrimaryContact: isPrimary,
        }).returning();
        createdGuardians.push(row);
      }
      if (!primarySet && createdGuardians.length) {
        await trx.update(guardians).set({ isPrimaryContact: true }).where(eq(guardians.id, createdGuardians[0].id));
        createdGuardians[0].isPrimaryContact = true;
      }
      const primaryGuardian = createdGuardians.find((g) => g.isPrimaryContact) || createdGuardians[0];
      if (primaryGuardian) {
        await trx.update(families).set({ primaryContactGuardianId: primaryGuardian.id, updatedAt: new Date() }).where(eq(families.id, family.id));
      }

      // Students (only the ones with a name)
      const createdStudents: any[] = [];
      for (const s of studentInputs) {
        if (!str(s.fullName) && !str((s as any).name)) continue;
        const r = await addStudentToFamily(trx, sid, family.id, s, true);
        if ("error" in r) throw Object.assign(new Error(r.error), { httpStatus: 400 });
        createdStudents.push(r.student);
      }

      return { family, createdGuardians, createdStudents };
    });

    const { family, createdGuardians, createdStudents } = outcome;

    // ── Audit (after commit) ──
    await auditLog(req, draft ? "family_draft_saved" : "family_enrolled", `family:${family.id}`, { familyCode: family.familyCode, guardians: createdGuardians.length, students: createdStudents.length, override });
    if (override && duplicateMatched) {
      await auditLog(req, "duplicate_warning_overridden", `family:${family.id}`, { familyCode: family.familyCode });
    }
    for (const g of createdGuardians) await auditLog(req, "guardian_added", `guardian:${g.id}`, { familyId: family.id }).catch(() => {});
    for (const s of createdStudents) await auditLog(req, "student_added", `student:${s.id}`, { familyId: family.id }).catch(() => {});

    // ── Auto-send parent linking-code email on final enrollment ──
    // Mirrors POST /api/guardians/:id/invite: the primary guardian (or the first
    // guardian with a valid email) receives a code linking their parent account to
    // the whole family. Only fires for a real enrollment (not a draft) that created
    // at least one student. Fire-and-forget so an email issue never fails or rolls
    // back the enrollment that already committed above.
    let invitedGuardianEmail: string | null = null;
    if (!draft && createdStudents.length > 0) {
      try {
        const guardianRows: any[] = createdGuardians.length
          ? createdGuardians
          : await getDb().select().from(guardians).where(and(eq(guardians.familyId, family.id), eq(guardians.schoolId, sid)));
        const hasEmail = (g: any) => isEmailish(str(g.email, 255) || "");
        const emailable = guardianRows.find((g: any) => g.isPrimaryContact && hasEmail(g))
          || guardianRows.find(hasEmail);
        if (emailable) {
          const inviteEmail = (str(emailable.email, 255) || "").toLowerCase();
          const code = generateLinkingCode();
          const expiresAt = new Date(Date.now() + 30 * 86400000);
          await storage.createLinkingCode({
            studentId: null as any, familyId: family.id, code,
            parentEmail: inviteEmail, expiresAt, schoolId: sid,
          });
          sendParentCodeEmail(inviteEmail, family.householdName || family.name, code, expiresAt, await getEmailBrandingForSchool(req, sid)).catch(() => {});
          await getDb().update(guardians).set({ portalAccessStatus: "invited", updatedAt: new Date() }).where(eq(guardians.id, emailable.id));
          await auditLog(req, "guardian_invited", `guardian:${emailable.id}`, { familyId: family.id, auto: true }).catch(() => {});
          invitedGuardianEmail = inviteEmail;
        }
      } catch { /* never fail a committed enrollment because of email */ }
    }

    res.status(201).json({
      family: { ...family, status: draft ? "draft" : "enrolled" },
      guardians: createdGuardians,
      students: createdStudents,
      invitedGuardianEmail,
    });
  } catch (e: any) {
    res.status(e?.httpStatus || 400).json({ message: e?.message || "Enrollment failed" });
  }
}
