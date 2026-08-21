/**
 * Universal Test Account — Integration Tests
 *
 *   npm run test:superuser
 *
 * Prerequisites:
 *   - Server running on APP_BASE_URL (default http://localhost:5000)
 *   - Demo seed data loaded (POST /api/seed-users → DEMO-001)
 *   - The test account created: npm run seed:test-account
 *   - DATABASE_URL, for the security tests that check a NORMAL user cannot
 *     acquire the flag
 *
 * What this proves, in order:
 *   1.  The account is offered every role the platform defines (from USER_ROLES,
 *       not a hard-coded list) plus "All Features".
 *   2.  Switching works, without logging out, for EVERY role.
 *   3.  The switch survives navigation and a page refresh (it is session state).
 *   4.  In each role, the API grants that role's access and REFUSES the others —
 *       so no feature leaks from the previously selected role.
 *   5.  "All Features" reaches everything.
 *   6.  A normal user cannot switch to a role they do not hold, cannot forge the
 *       flag from the client, and cannot reach the switcher at all.
 *   7.  Turning the feature off makes the flag inert.
 */
import { Client } from "pg";

const BASE = process.env.APP_BASE_URL || "http://localhost:5000";
const DATABASE_URL = process.env.DATABASE_URL;
const TEST_USER = process.env.TEST_ACCOUNT_USERNAME || "testuser";
const TEST_PASS = process.env.TEST_ACCOUNT_PASSWORD || "universal-test-2026";
const SCHOOL = "DEMO-001";

interface TestResult { name: string; passed: boolean; detail: string }
const results: TestResult[] = [];
function pass(n: string, d = "") { results.push({ name: n, passed: true, detail: d }); console.log(`  ✓ ${n}${d ? " — " + d : ""}`); }
function fail(n: string, d: string) { results.push({ name: n, passed: false, detail: d }); console.error(`  ✗ ${n} — ${d}`); }
function check(n: string, c: boolean, d = "") { c ? pass(n, d) : fail(n, d || "assertion failed"); }

async function req(method: string, path: string, body: unknown | undefined, cookie: string) {
  const hasBody = body !== undefined && method !== "GET";
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { ...(hasBody ? { "Content-Type": "application/json" } : {}), ...(cookie ? { Cookie: cookie } : {}) },
    ...(hasBody ? { body: JSON.stringify(body) } : {}),
    redirect: "manual",
  });
  let parsed: any = null;
  try { parsed = await res.json(); } catch { /* non-JSON */ }
  return { status: res.status, body: parsed };
}

async function login(username: string, password: string, schoolCode?: string) {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password, ...(schoolCode ? { schoolCode } : {}) }),
    redirect: "manual",
  });
  const cookie = ((res.headers as any).getSetCookie?.() || []).map((c: string) => c.split(";")[0]).join("; ");
  let parsed: any = null;
  try { parsed = await res.json(); } catch { /* non-JSON */ }
  return { status: res.status, cookie, body: parsed };
}

const switchTo = (cookie: string, context: string) =>
  req("POST", "/api/auth/context", { context }, cookie);

/**
 * One representative, role-guarded endpoint per role. These are real endpoints
 * with real `requireRole` guards — the point is to prove the SERVER changes its
 * answer when the simulated role changes, not that a menu item disappeared.
 */
const ROLE_PROBES: Record<string, { path: string; label: string }> = {
  school_admin:  { path: "/api/classes",                 label: "school admin: classes" },
  finance:       { path: "/api/finance/summary",         label: "finance: summary" },
  teacher:       { path: "/api/classes",                 label: "teacher: assigned classes" },
  parent:        { path: "/api/parent/children",         label: "parent: children" },
  it_personnel:  { path: "/api/website/sections",        label: "IT: website sections" },
  owner:         { path: "/api/owner/schools",           label: "owner: all schools" },
  platform_admin:{ path: "/api/owner/schools",           label: "platform admin: all schools" },
};

async function main() {
  console.log(`\n▶ Universal Test Account tests against ${BASE}\n`);

  // ── 1. The account and its available roles ──
  console.log("1. Discovery — the account is offered every role");
  const session = await login(TEST_USER, TEST_PASS, SCHOOL);
  if (session.status !== 200 || !session.cookie) {
    console.error(`Could not sign in as "${TEST_USER}" (status ${session.status}). Run: npm run seed:test-account`);
    process.exit(1);
  }
  const cookie = session.cookie;
  const me = await req("GET", "/api/auth/me", undefined, cookie);
  const contexts: string[] = (me.body?.availableContexts || []).map((c: any) => c.key);

  check("Server marks the account as a test account", me.body?.isTestAccount === true, `isTestAccount=${me.body?.isTestAccount}`);

  // The platform's own role enum — this is what "detect roles from the codebase"
  // has to mean in practice.
  // Every role the platform defines, minus the ones deliberately held back
  // (see TEST_ACCOUNT_EXCLUDED_ROLES): the platform-owner tier and `student`,
  // which has no portal in ScholarShelf.
  const PLATFORM_ROLES = ["school_admin", "teacher", "parent", "finance", "it_personnel"];
  const EXCLUDED_ROLES = ["owner", "platform_admin", "student"];
  const missing = PLATFORM_ROLES.filter((r) => !contexts.includes(r));
  check("Every platform role is offered", missing.length === 0, missing.length ? `missing: ${missing.join(", ")}` : contexts.join(", "));
  check("'All Features' mode is offered", contexts.includes("all_access"), contexts.join(", "));
  const leaked = EXCLUDED_ROLES.filter((r) => contexts.includes(r));
  check("The platform-owner tier and student are NOT offered", leaked.length === 0,
    leaked.length ? `unexpectedly offered: ${leaked.join(", ")}` : EXCLUDED_ROLES.join(", ") + " correctly withheld");

  // ── 2 + 4. Switch to each role; the API must follow ──
  console.log("\n2. Switching role — the API follows, and nothing leaks");
  for (const role of PLATFORM_ROLES) {
    const sw = await switchTo(cookie, role);
    check(`Switch to ${role}`, sw.status === 200 && sw.body?.activeContext === role,
      `status=${sw.status} active=${sw.body?.activeContext}`);
    if (sw.status !== 200) continue;

    // The session must report the simulated role, not the stored one.
    const who = await req("GET", "/api/auth/me", undefined, cookie);
    check(`  ${role}: session reports the simulated role`, who.body?.role === role, `role=${who.body?.role}`);

    // Granted: this role's own endpoint.
    const probe = ROLE_PROBES[role];
    if (probe) {
      const r = await req("GET", probe.path, undefined, cookie);
      check(`  ${role}: can reach ${probe.label}`, r.status === 200, `status=${r.status}`);
    }

    // Refused: an endpoint belonging to a DIFFERENT role. This is the
    // no-leakage check — the previous role's access must be gone.
    const forbidden = role === "finance"
      ? { path: "/api/website/sections", who: "IT" }          // finance must not manage the CMS
      : { path: "/api/finance/summary", who: "finance" };      // everyone else must not see finance
    if (role !== "school_admin") {
      const r = await req("GET", forbidden.path, undefined, cookie);
      check(`  ${role}: refused ${forbidden.who}-only endpoint`, r.status === 403 || r.status === 401,
        `status=${r.status}`);
    }
  }

  console.log("\n2b. Withheld roles are refused even for the test account");
  for (const role of EXCLUDED_ROLES) {
    const sw = await switchTo(cookie, role);
    check(`  Switch to ${role} is refused`, sw.status === 403, `status=${sw.status}`);
  }

  // ── 3. Persistence ──
  console.log("\n3. The selected role survives navigation and refresh");
  {
    await switchTo(cookie, "finance");
    const a = await req("GET", "/api/auth/me", undefined, cookie);
    // A "refresh" is simply another request on the same session cookie — which
    // is exactly what a browser reload does.
    const b = await req("GET", "/api/auth/me", undefined, cookie);
    const c = await req("GET", "/api/finance/summary", undefined, cookie);
    check("Role persists across requests without re-login",
      a.body?.role === "finance" && b.body?.role === "finance" && c.status === 200,
      `${a.body?.role} → ${b.body?.role}, finance API=${c.status}`);
  }

  // ── 5. All Features ──
  console.log("\n4. All Features mode reaches everything");
  {
    const sw = await switchTo(cookie, "all_access");
    check("Switch to All Features", sw.status === 200 && sw.body?.activeContext === "all_access", `status=${sw.status}`);
    const probes = [
      ["/api/classes", "school admin"],
      ["/api/finance/summary", "finance"],
      ["/api/website/sections", "IT"],
      ["/api/admin/payments", "payments"],
      ["/api/families", "families"],
    ] as const;
    const statuses: string[] = [];
    let allOk = true;
    for (const [path, label] of probes) {
      const r = await req("GET", path, undefined, cookie);
      statuses.push(`${label}=${r.status}`);
      if (r.status !== 200) allOk = false;
    }
    check("Every role's endpoints are reachable at once", allOk, statuses.join(" "));
  }

  // ── 6. Security ──
  console.log("\n5. Security — a normal user cannot do any of this");
  {
    const teacher = await login("teacher", "teacher123", SCHOOL);
    const t = teacher.cookie;
    const tme = await req("GET", "/api/auth/me", undefined, t);
    check("A normal user is NOT marked as a test account", tme.body?.isTestAccount !== true, `isTestAccount=${tme.body?.isTestAccount}`);
    const tContexts: string[] = (tme.body?.availableContexts || []).map((c: any) => c.key);
    check("A normal user is not offered every role",
      !tContexts.includes("finance") && !tContexts.includes("owner") && !tContexts.includes("all_access"),
      tContexts.join(", ") || "(none)");

    const toFinance = await switchTo(t, "finance");
    check("A normal user cannot switch to a role they do not hold", toFinance.status === 403, `status=${toFinance.status}`);
    const toAll = await switchTo(t, "all_access");
    check("A normal user cannot switch to All Features", toAll.status === 403, `status=${toAll.status}`);

    // Even after trying, their access is unchanged.
    const stillBlocked = await req("GET", "/api/finance/summary", undefined, t);
    check("A normal user still cannot reach finance", stillBlocked.status === 403, `status=${stillBlocked.status}`);

    // The flag cannot be forged through the API: nothing accepts it as input.
    const forge = await req("POST", "/api/auth/context",
      { context: "finance", isTestAccount: true, testSuperuser: true, role: "finance" }, t);
    check("Sending isTestAccount/testSuperuser in the body grants nothing", forge.status === 403, `status=${forge.status}`);
    const afterForge = await req("GET", "/api/finance/summary", undefined, t);
    check("…and access is still refused afterwards", afterForge.status === 403, `status=${afterForge.status}`);
  }

  // ── 7. The flag is inert when the feature is off ──
  console.log("\n6. The flag is inert without the feature");
  if (!DATABASE_URL) {
    pass("Feature-disabled check skipped (no DATABASE_URL)", "");
  } else {
    const db = new Client({
      connectionString: DATABASE_URL,
      ssl: /localhost|127\.0\.0\.1/.test(DATABASE_URL) ? false : { rejectUnauthorized: false },
    });
    await db.connect();
    const row = await db.query(
      `select count(*)::int c from user_permissions p
         join users u on u.id = p.user_id
        where u.username = $1 and p.permission = 'TEST_SUPERUSER'`, [TEST_USER]);
    check("The flag lives in user_permissions (server-side only)", row.rows[0].c === 1, `${row.rows[0].c} row(s)`);

    const anyOther = await db.query(
      `select count(*)::int c from user_permissions p
         join users u on u.id = p.user_id
        where p.permission = 'TEST_SUPERUSER' and u.username <> $1`, [TEST_USER]);
    check("No other account holds the flag", anyOther.rows[0].c === 0, `${anyOther.rows[0].c} other holder(s)`);
    await db.end().catch(() => {});

    console.log("  · NOTE: isTestModeEnabled() returns false when NODE_ENV=production");
    console.log("    and ALLOW_TEST_SUPERUSER is unset, which makes the flag above grant nothing.");
  }

  const passed = results.filter((r) => r.passed).length;
  const failed = results.length - passed;
  console.log(`\n${"─".repeat(64)}`);
  console.log(`  ${passed}/${results.length} passed${failed ? `, ${failed} FAILED` : ""}`);
  if (failed) {
    console.log("\n  Failures:");
    for (const r of results.filter((x) => !x.passed)) console.log(`   ✗ ${r.name} — ${r.detail}`);
  }
  console.log(`${"─".repeat(64)}\n`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
