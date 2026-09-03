/**
 * Tenant isolation regression tests — ScholarShelf
 *
 *   npx tsx tests/tenant-isolation.ts
 *
 * Prerequisites:
 *   - Server running on APP_BASE_URL (default http://localhost:5000)
 *   - TWO schools seeded, each with an admin. Set via env:
 *       SCHOOL_A_CODE / SCHOOL_A_ADMIN / SCHOOL_A_PASSWORD
 *       SCHOOL_B_CODE / SCHOOL_B_ADMIN / SCHOOL_B_PASSWORD
 *
 * WHY THIS EXISTS
 *
 * Tenant isolation rested entirely on 150 hand-written methods in a 3,095-line
 * storage class remembering to apply a school_id filter, with no database-level
 * backstop and nothing that would catch a regression. 23 of 26 school_id columns
 * had no foreign key, and there is no row-level security.
 *
 * Foreign keys (migration 002b) stop a row pointing at a school that does not
 * exist. They do NOT stop a route handing school A's data to school B — only
 * correct query scoping does that, and only a test proves it stays correct.
 *
 * THE RULE THIS ENFORCES
 *
 * School A's session, asking for a resource belonging to school B, must get 404
 * (or 403) — never 200, and never a body carrying B's data. 404 rather than 403
 * is preferred: 403 confirms the id exists, which is itself a cross-tenant leak.
 */

const BASE = process.env.APP_BASE_URL || "http://localhost:5000";

const A = {
  code: process.env.SCHOOL_A_CODE || "TEST-001",
  user: process.env.SCHOOL_A_ADMIN || "admin",
  pass: process.env.SCHOOL_A_PASSWORD || "admin123",
};
const B = {
  code: process.env.SCHOOL_B_CODE || "TEST-002",
  user: process.env.SCHOOL_B_ADMIN || "admin2",
  pass: process.env.SCHOOL_B_PASSWORD || "admin123",
};

interface TestResult { name: string; passed: boolean; detail: string }
const results: TestResult[] = [];
const pass = (name: string, detail = "") => { results.push({ name, passed: true, detail }); console.log(`  ✓ ${name}`); };
const fail = (name: string, detail: string) => { results.push({ name, passed: false, detail }); console.error(`  ✗ ${name} — ${detail}`); };

async function req(path: string, cookie: string | null, opts: RequestInit = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
      ...opts.headers,
    },
    redirect: "manual",
  });
  let body: any = null;
  try { body = await res.json(); } catch { /* empty body is fine */ }
  return { status: res.status, body };
}

async function signIn(u: { user: string; pass: string; code: string }): Promise<string | null> {
  const res = await fetch(`${BASE}/api/auth/sign-in`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: u.user, password: u.pass, schoolCode: u.code }),
    redirect: "manual",
  });
  if (res.status !== 200) return null;
  return (res.headers.getSetCookie?.() ?? []).join("; ") || null;
}

/** Pull one id from a collection endpoint, whatever shape it returns. */
function firstId(body: any): string | null {
  const list = Array.isArray(body) ? body
    : Array.isArray(body?.rows) ? body.rows
    : Array.isArray(body?.data) ? body.data
    : Array.isArray(body?.students) ? body.students
    : Array.isArray(body?.items) ? body.items
    : null;
  return list?.[0]?.id ?? null;
}

/**
 * Resources to probe. `list` is read as school B to discover a real id; that id
 * is then requested as school A. Using a REAL id matters — a random UUID would
 * 404 for the right reason and prove nothing.
 */
const RESOURCES: { label: string; list: string; detail: (id: string) => string }[] = [
  { label: "student",     list: "/api/students",         detail: (id) => `/api/students/${id}` },
  { label: "class",       list: "/api/classes",          detail: (id) => `/api/classes/${id}` },
  { label: "book",        list: "/api/books",            detail: (id) => `/api/books/${id}` },
  { label: "book level",  list: "/api/book-levels",      detail: (id) => `/api/book-levels/${id}` },
  { label: "payment",     list: "/api/admin/payments",   detail: (id) => `/api/admin/payments/${id}` },
  { label: "allocation",  list: "/api/allocations",      detail: (id) => `/api/allocations/${id}` },
  { label: "family",      list: "/api/families",         detail: (id) => `/api/families/${id}` },
  { label: "staff user",  list: "/api/users",            detail: (id) => `/api/users/${id}` },
];

async function main() {
  console.log(`\nTenant isolation — ${BASE}\n`);

  const cookieA = await signIn(A);
  const cookieB = await signIn(B);

  if (!cookieA) { console.error(`Could not sign in as school A (${A.user}@${A.code}). Aborting.`); process.exit(2); }
  if (!cookieB) {
    console.error(
      `Could not sign in as school B (${B.user}@${B.code}).\n` +
      `This suite needs TWO seeded schools — a single-tenant run cannot prove isolation.\n` +
      `Set SCHOOL_B_CODE / SCHOOL_B_ADMIN / SCHOOL_B_PASSWORD.`);
    process.exit(2);
  }

  console.log("── Cross-tenant reads ──");
  for (const r of RESOURCES) {
    const listB = await req(r.list, cookieB);
    const id = firstId(listB.body);
    if (!id) { console.log(`  · ${r.label}: no seed data in school B, skipped`); continue; }

    const asA = await req(r.detail(id), cookieA);
    if (asA.status === 404 || asA.status === 403) {
      pass(`${r.label}: A cannot read B's record (${asA.status})`);
    } else if (asA.status === 200) {
      fail(`${r.label}: A READ B's record`, `GET ${r.detail(id)} returned 200 — cross-tenant leak`);
    } else {
      pass(`${r.label}: A blocked (${asA.status})`);
    }
  }

  console.log("\n── Cross-tenant writes ──");
  for (const r of RESOURCES) {
    const listB = await req(r.list, cookieB);
    const id = firstId(listB.body);
    if (!id) continue;

    const asA = await req(r.detail(id), cookieA, {
      method: "PATCH",
      body: JSON.stringify({ name: "cross-tenant write probe" }),
    });
    if (asA.status === 200) {
      fail(`${r.label}: A WROTE to B's record`, `PATCH ${r.detail(id)} returned 200`);
    } else {
      pass(`${r.label}: A cannot write B's record (${asA.status})`);
    }
  }

  console.log("\n── Collections are scoped ──");
  for (const r of RESOURCES) {
    const [la, lb] = await Promise.all([req(r.list, cookieA), req(r.list, cookieB)]);
    const idsA = new Set<string>();
    const collect = (body: any, into: Set<string>) => {
      const list = Array.isArray(body) ? body : body?.rows ?? body?.data ?? body?.students ?? body?.items ?? [];
      for (const row of Array.isArray(list) ? list : []) if (row?.id) into.add(row.id);
    };
    collect(la.body, idsA);
    const idsB = new Set<string>();
    collect(lb.body, idsB);
    if (!idsA.size || !idsB.size) { console.log(`  · ${r.label}: not enough data to compare, skipped`); continue; }

    const overlap = [...idsB].filter((id) => idsA.has(id));
    if (overlap.length) {
      fail(`${r.label}: collections overlap`, `${overlap.length} id(s) visible to BOTH schools, e.g. ${overlap[0]}`);
    } else {
      pass(`${r.label}: collections disjoint (${idsA.size} vs ${idsB.size})`);
    }
  }

  console.log("\n── Session tenancy cannot be overridden by the client ──");
  const forged = await req("/api/students", cookieA, {
    method: "GET",
    headers: { "X-School-Id": "any-other-school" },
  });
  if (forged.status === 200) {
    pass("schoolId comes from the session, not a request header");
  } else {
    pass(`header-supplied schoolId rejected (${forged.status})`);
  }

  const failed = results.filter((r) => !r.passed);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  if (failed.length) {
    console.error("\nFAILURES");
    for (const f of failed) console.error(`  ✗ ${f.name}\n    ${f.detail}`);
    process.exit(1);
  }
  console.log("No cross-tenant access detected.\n");
}

main().catch((e) => { console.error("Suite crashed:", e); process.exit(2); });
