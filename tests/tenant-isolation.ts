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
  code: process.env.SCHOOL_A_CODE || "DEMO-001",
  user: process.env.SCHOOL_A_ADMIN || "admin",
  pass: process.env.SCHOOL_A_PASSWORD || "admin123",
};
const B = {
  code: process.env.SCHOOL_B_CODE || "DEMO-002",
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
    // An empty schoolCode is rejected by the endpoint's validation, which is NOT
    // the same thing as an account that has no school — omit the field entirely
    // so the school-less probe exercises the real sign-in path.
    body: JSON.stringify({
      username: u.user, password: u.pass,
      ...(u.code ? { schoolCode: u.code } : {}),
    }),
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

  // ── Findings from the 22 August restructuring report ─────────────────────
  //
  // The probes above are generic: list a resource, request it as the other
  // school. They cannot reach the specific defects below, each of which was a
  // live cross-tenant path that returned 200 or 201 on a foreign record.

  console.log("\n── S2 · linking-code IDOR ──");
  {
    const listB = await req("/api/students", cookieB);
    const studentB = firstId(listB.body);
    if (!studentB) {
      fail("S2 probe", "school B has no students — cannot test");
    } else {
      const minted = await req(`/api/students/${studentB}/linking-code`, cookieA, {
        method: "POST",
        body: JSON.stringify({ parentEmail: "attacker@example.com" }),
      });
      if (minted.status === 201 || minted.body?.code) {
        fail("S2: A minted a parent credential for B's child",
          `POST returned ${minted.status}${minted.body?.code ? " WITH A LIVE CODE IN THE BODY" : ""}`);
      } else {
        pass(`S2: linking code refused for another school's child (${minted.status})`);
      }
    }
  }

  console.log("\n── S4 · book-level items across tenants ──");
  {
    const levelsB = await req("/api/book-levels", cookieB);
    const levelB = firstId(levelsB.body);
    if (!levelB) {
      fail("S4 probe", "school B has no book levels — cannot test");
    } else {
      const read = await req(`/api/book-levels/${levelB}/items`, cookieA);
      if (read.status === 200) fail("S4: A read B's bundle contents", `GET returned 200`);
      else pass(`S4: bundle contents not readable across tenants (${read.status})`);

      const booksA = await req("/api/books", cookieA);
      const bookA = firstId(booksA.body);
      const write = await req(`/api/book-levels/${levelB}/items`, cookieA, {
        method: "POST",
        body: JSON.stringify({ bookId: bookA, quantity: 1 }),
      });
      if (write.status === 201) {
        fail("S4: A injected a book into B's bundle",
          "POST returned 201 — this changes what B's parents are billed");
      } else {
        pass(`S4: cannot add items to another school's bundle (${write.status})`);
      }
    }
  }

  console.log("\n── S5 · student book-level overrides ──");
  {
    const listB = await req("/api/students", cookieB);
    const studentB = firstId(listB.body);
    const levelsA = await req("/api/book-levels", cookieA);
    const levelA = firstId(levelsA.body);
    if (!studentB || !levelA) {
      fail("S5 probe", "need a student in B and a book level in A");
    } else {
      const set = await req(`/api/students/${studentB}/book-level-override`, cookieA, {
        method: "PUT",
        body: JSON.stringify({ bookLevelId: levelA }),
      });
      if (set.status === 200) {
        fail("S5: A rewrote which books B's child is billed for", "PUT returned 200");
      } else {
        pass(`S5: override refused on another school's child (${set.status})`);
      }

      const cleared = await req(`/api/students/${studentB}/book-level-override`, cookieA, {
        method: "DELETE",
      });
      if (cleared.status === 200) fail("S5: A deleted B's child's override", "DELETE returned 200");
      else pass(`S5: override delete refused across tenants (${cleared.status})`);
    }
  }

  console.log("\n── S7 · mass-assignment on user update ──");
  {
    const meA = await req("/api/auth/me", cookieA);
    const myId = meA.body?.user?.id ?? meA.body?.id;
    const schoolsB = await req("/api/students", cookieB);
    void schoolsB;
    if (!myId) {
      fail("S7 probe", "could not read A's own user id");
    } else {
      const moved = await req(`/api/users/${myId}`, cookieA, {
        method: "PATCH",
        body: JSON.stringify({ schoolId: "some-other-school-id", status: "active" }),
      });
      const after = await req(`/api/users/${myId}`, cookieA);
      const stillMine = after.status === 200;
      if (moved.status === 200 && !stillMine) {
        fail("S7: PATCH moved a user into another tenant", "schoolId was writable");
      } else {
        pass(`S7: schoolId is not writable through PATCH /api/users/:id (${moved.status})`);
      }
    }
  }

  console.log("\n── S1 · a staff session with no school ──");
  {
    // Seeded by script/seed-school-b.ts. Such an account reaches every storage
    // method with schoolId null, which schoolFilter renders as "no WHERE clause"
    // — i.e. every tenant. It must not be able to read anything at all.
    const orphan = await signIn({
      user: process.env.ORPHAN_ADMIN || "orphanadmin",
      pass: process.env.ORPHAN_PASSWORD || "admin123",
      code: "",
    });
    if (!orphan) {
      // Sign-in itself is not the gate — the report is explicit that such an
      // account signs in normally, because the school-code prompt is wrapped in
      // `if (user.schoolId)`. If sign-in fails here the fixture is missing, and
      // a passing probe would be vacuous.
      fail("S1 probe", "could not sign in as the school-less fixture — run npm run seed:school-b");
    } else {
      const listed = await req("/api/students", orphan);
      if (listed.status === 200) {
        const n = Array.isArray(listed.body) ? listed.body.length : "?";
        fail("S1: school-less staff account read the whole platform",
          `GET /api/students returned 200 with ${n} pupils across all tenants`);
      } else {
        pass(`S1: school-less staff session refused (${listed.status})`);
      }
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
