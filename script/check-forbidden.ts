/**
 * script/check-forbidden.ts
 *
 * A release gate for the removals made under the Legal & Compliance directive
 * of 2 September 2026 (Phase A). Each pattern below is something that was taken
 * out of the codebase for a specific, documented reason; this script fails the
 * build if any of it comes back.
 *
 * It is deliberately dumb — a text scan, no AST, no config. A rule you can read
 * in ten seconds is a rule people keep.
 *
 *   npm run check:forbidden
 *
 * If a match is legitimate (a comment explaining the removal, this file itself),
 * add the file to ALLOWED_FILES with a note saying why.
 */
import { readdirSync, readFileSync, statSync } from "fs";
import { join, relative, sep } from "path";

const ROOT = process.cwd();

const SKIP_DIRS = new Set([
  "node_modules", ".git", "dist", "build", ".localpg", ".vercel",
  "attached_assets", ".agents",
]);

const SCAN_EXTENSIONS = [".ts", ".tsx", ".js", ".cjs", ".mjs"];

/** Files permitted to mention a forbidden pattern, and why. */
const ALLOWED_FILES = new Set<string>([
  "script/check-forbidden.ts",            // this file states the patterns
  "server/routes/db-console.routes.ts",   // header documents what was removed
  "client/src/pages/admin/db-console.tsx",// header documents what was removed
]);

interface Rule {
  name: string;
  pattern: RegExp;
  why: string;
}

const RULES: Rule[] = [
  {
    name: "seed endpoint",
    pattern: /["'`]\/api\/seed-users["'`]|app\.(post|get)\(\s*["'`]\/api\/seed-users/,
    why: "An unauthenticated route that created owner accounts with published passwords.",
  },
  {
    name: "test superuser",
    pattern: /TEST_SUPERUSER|ALLOW_TEST_SUPERUSER|sessionIsTestSuperuser|ALL_ACCESS_CONTEXT/,
    why: "A flag that satisfied every role check. Removed; role simulation is secondary-role grants only.",
  },
  {
    name: "arbitrary SQL over HTTP",
    pattern: /["'`]\/api\/owner\/db\/query["'`]|["'`]\/api\/owner\/sql["'`]/,
    why: "A SQL runner on the production database guarded only by first-word regexes.",
  },
  {
    name: "direct row write over HTTP",
    pattern: /["'`]\/api\/owner\/db\/tables\/[^"'`]*["'`]\s*,\s*ownerOnly\s*,\s*async[\s\S]{0,80}(UPDATE|DELETE)\s+/,
    why: "Unaudited row edits and deletes on any allow-listed table.",
  },
  {
    name: "tenant wipe over HTTP",
    pattern: /danger\/wipe-school/,
    why: "A non-transactional wipe of a whole tenant behind one boolean flag.",
  },
  {
    name: "credential in a log line",
    pattern: /console\.(log|info|warn)\([^)]*\$\{\s*(resetLink|inviteLink|rawToken|newCode\.code)\s*\}/,
    why: "A reset link, invite link or linking code in a log is a live credential.",
  },
];

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    let s;
    try { s = statSync(full); } catch { continue; }
    if (s.isDirectory()) walk(full, out);
    else if (SCAN_EXTENSIONS.some((e) => entry.endsWith(e))) out.push(full);
  }
  return out;
}

const violations: string[] = [];

for (const file of walk(ROOT)) {
  const rel = relative(ROOT, file).split(sep).join("/");
  if (ALLOWED_FILES.has(rel)) continue;

  const lines = readFileSync(file, "utf8").split("\n");
  lines.forEach((line, i) => {
    for (const rule of RULES) {
      if (rule.pattern.test(line)) {
        violations.push(`${rel}:${i + 1}  [${rule.name}]  ${rule.why}\n      ${line.trim().slice(0, 140)}`);
      }
    }
  });
}

if (violations.length) {
  console.error("\n✗ Forbidden patterns found — these were removed deliberately.\n");
  for (const v of violations) console.error("  " + v + "\n");
  console.error(`${violations.length} violation(s). See script/check-forbidden.ts for the reasoning.\n`);
  process.exit(1);
}

console.log("✓ No forbidden patterns. The Phase A removals are still removed.");
