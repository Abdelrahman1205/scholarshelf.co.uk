/**
 * Security Regression Tests for EduCore / ScholarShelf
 *
 * Run against a live server:
 *   npx tsx tests/security-regression.ts
 *
 * Prerequisites:
 *   - Server running on APP_BASE_URL (default http://localhost:5000)
 *   - Demo seed data loaded
 *
 * Tests cover:
 *   1. Authentication enforcement (unauthenticated access blocked)
 *   2. RBAC — role-gated endpoints reject wrong roles
 *   3. Tenant isolation — school-scoped data doesn't leak
 *   4. Auth session integrity
 */

const BASE = process.env.APP_BASE_URL || "http://localhost:5000";

interface TestResult {
  name: string;
  passed: boolean;
  detail: string;
}

const results: TestResult[] = [];

function pass(name: string, detail = "") {
  results.push({ name, passed: true, detail });
  console.log(`  ✓ ${name}`);
}

function fail(name: string, detail: string) {
  results.push({ name, passed: false, detail });
  console.error(`  ✗ ${name} — ${detail}`);
}

// ── Helpers ──

async function fetchJson(path: string, opts: RequestInit = {}): Promise<{ status: number; body: any }> {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", ...opts.headers },
    redirect: "manual",
  });
  let body: any;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { status: res.status, body };
}

/** Sign in and return the cookie header for subsequent requests */
async function signIn(username: string, password: string, schoolCode?: string): Promise<string | null> {
  const payload: any = { username, password };
  if (schoolCode) payload.schoolCode = schoolCode;
  const res = await fetch(`${BASE}/api/auth/sign-in`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    redirect: "manual",
  });
  if (res.status !== 200) return null;
  const cookies = res.headers.getSetCookie?.() ?? [];
  return cookies.join("; ") || null;
}

// ── Test Suites ──

async function testUnauthenticatedAccess() {
  console.log("\n─── 1. Unauthenticated Access ───");

  const protectedPaths = [
     "/api/books",
     "/api/students",
     "/api/classes",
    "/api/admin/payments",
    "/api/admin/users",
    "/api/admin/dashboard-summary",
    "/api/admin/reports",
    "/api/admin/recent-activity",
     "/api/allocations",
    "/api/parent/children",
     "/api/owner/schools",
     "/api/admin/communications",
  ];

  for (const path of protectedPaths) {
    const { status } = await fetchJson(path);
    if (status === 401 || status === 403) {
      pass(`GET ${path} → ${status} (blocked)`);
    } else {
      fail(`GET ${path} → ${status}`, `Expected 401/403, got ${status}`);
    }
  }

  // POST endpoints
  const postPaths = [
    { path: "/api/books", body: { title: "Hacked Book" } },
    { path: "/api/students", body: { name: "Hacked Student" } },
    { path: "/api/classes", body: { name: "Hacked Class" } },
  ];

  for (const { path, body } of postPaths) {
    const { status } = await fetchJson(path, { method: "POST", body: JSON.stringify(body) });
    if (status === 401 || status === 403) {
      pass(`POST ${path} → ${status} (blocked)`);
    } else {
      fail(`POST ${path} → ${status}`, `Expected 401/403, got ${status}`);
    }
  }
}

async function testRBACEnforcement() {
  console.log("\n─── 2. RBAC Enforcement ───");

  // Sign in as different roles
  const teacherCookie = await signIn("teacher", "teacher123", "DEMO-001");
  const parentCookie = await signIn("parent", "parent123", "DEMO-001");

  if (!teacherCookie) {
    fail("Teacher sign-in", "Could not sign in as teacher");
    return;
  }
  if (!parentCookie) {
    fail("Parent sign-in", "Could not sign in as parent");
    return;
  }

  pass("Teacher sign-in", "Authenticated successfully");
  pass("Parent sign-in", "Authenticated successfully");

  // Teacher should NOT access admin endpoints
  const teacherBlocked = [
    "/api/admin/users",
    "/api/owner/schools",
    "/api/admin/reports",
    "/api/admin/dashboard-summary",
  ];

  for (const path of teacherBlocked) {
    const { status } = await fetchJson(path, { headers: { Cookie: teacherCookie } });
    if (status === 401 || status === 403) {
      pass(`Teacher GET ${path} → ${status} (blocked)`);
    } else {
      fail(`Teacher GET ${path} → ${status}`, `Expected 401/403, teacher should not access admin routes`);
    }
  }

  // Parent should NOT access admin or teacher endpoints
  const parentBlocked = [
    "/api/admin/users",
    "/api/books",
    "/api/students",
    "/api/admin/reports",
    "/api/allocations",
  ];

  for (const path of parentBlocked) {
    const { status } = await fetchJson(path, { headers: { Cookie: parentCookie } });
    if (status === 401 || status === 403) {
      pass(`Parent GET ${path} → ${status} (blocked)`);
    } else {
      fail(`Parent GET ${path} → ${status}`, `Expected 401/403, parent should not access admin/teacher routes`);
    }
  }
}

async function testTenantIsolation() {
  console.log("\n─── 3. Tenant Isolation ───");

  const adminCookie = await signIn("admin", "admin123", "DEMO-001");
  if (!adminCookie) {
    fail("Admin sign-in", "Could not sign in as admin");
    return;
  }
  pass("Admin sign-in", "Authenticated successfully");

  // Verify school-scoped data comes back
  const { status: booksStatus, body: booksBody } = await fetchJson("/api/books", {
    headers: { Cookie: adminCookie },
  });

  if (booksStatus === 200 && Array.isArray(booksBody)) {
    pass("GET /api/books → 200", `Returned ${booksBody.length} books`);

    // If there are books, verify they all belong to the demo school
    // (schoolId should match the admin's session schoolId)
    const foreignBooks = booksBody.filter((b: any) => b.schoolId && b.schoolId !== "demo-school-00000001" && b.schoolId !== null);
    if (foreignBooks.length === 0) {
      pass("Books tenant isolation", "No books from other schools visible");
    } else {
      fail("Books tenant isolation", `Found ${foreignBooks.length} books from other schools`);
    }
  } else {
    fail("GET /api/books", `Status ${booksStatus}`);
  }

  // Check students
  const { status: studentsStatus, body: studentsBody } = await fetchJson("/api/students", {
    headers: { Cookie: adminCookie },
  });

  if (studentsStatus === 200 && Array.isArray(studentsBody)) {
    const foreignStudents = studentsBody.filter((s: any) => s.schoolId && s.schoolId !== "demo-school-00000001" && s.schoolId !== null);
    if (foreignStudents.length === 0) {
      pass("Students tenant isolation", "No students from other schools visible");
    } else {
      fail("Students tenant isolation", `Found ${foreignStudents.length} students from other schools`);
    }
  }

  // Check classes
  const { status: classesStatus, body: classesBody } = await fetchJson("/api/classes", {
    headers: { Cookie: adminCookie },
  });

  if (classesStatus === 200 && Array.isArray(classesBody)) {
    const foreignClasses = classesBody.filter((c: any) => c.schoolId && c.schoolId !== "demo-school-00000001" && c.schoolId !== null);
    if (foreignClasses.length === 0) {
      pass("Classes tenant isolation", "No classes from other schools visible");
    } else {
      fail("Classes tenant isolation", `Found ${foreignClasses.length} classes from other schools`);
    }
  }
}

async function testAuthSessionIntegrity() {
  console.log("\n─── 4. Auth Session Integrity ───");

  // Sign out should invalidate session
  const adminCookie = await signIn("admin", "admin123", "DEMO-001");
  if (!adminCookie) {
    fail("Admin sign-in for session test", "Could not sign in");
    return;
  }

  // Verify session is active
  const { status: preSignOut } = await fetchJson("/api/books", {
    headers: { Cookie: adminCookie },
  });
  if (preSignOut === 200) {
    pass("Session active before sign-out", "Books accessible");
  } else {
    fail("Session active before sign-out", `Status ${preSignOut}`);
  }

  // Sign out
  await fetchJson("/api/auth/sign-out", {
    method: "POST",
    headers: { Cookie: adminCookie },
  });

  // Verify session is invalidated
  const { status: postSignOut } = await fetchJson("/api/books", {
    headers: { Cookie: adminCookie },
  });
  if (postSignOut === 401 || postSignOut === 403) {
    pass("Session invalidated after sign-out", `Status ${postSignOut}`);
  } else {
    fail("Session invalidated after sign-out", `Expected 401/403 after sign-out, got ${postSignOut}`);
  }

  // Invalid credentials should fail
  const badCookie = await signIn("admin", "wrong-password", "DEMO-001");
  if (badCookie === null) {
    pass("Invalid credentials rejected", "Sign-in failed as expected");
  } else {
    fail("Invalid credentials rejected", "Sign-in succeeded with wrong password");
  }

  // Health endpoint should be public
  const { status: healthStatus, body: healthBody } = await fetchJson("/api/health");
  if (healthStatus === 200 && healthBody?.status) {
    pass("Health endpoint public", `status=${healthBody.status}, mode=${healthBody.storageMode}`);
  } else {
    fail("Health endpoint public", `Status ${healthStatus}`);
  }
}

async function testCriticalSecurityPatterns() {
  console.log("\n─── 5. Critical Security Patterns ───");

  // Test that health endpoint does not leak secrets
  const { body: healthBody } = await fetchJson("/api/health");
  const healthStr = JSON.stringify(healthBody || {});
  if (!healthStr.includes("DATABASE_URL") && !healthStr.includes("SESSION_SECRET") && !healthStr.includes("password")) {
    pass("Health endpoint no secret leaks", "No sensitive strings in response");
  } else {
    fail("Health endpoint no secret leaks", "Found sensitive strings in health response");
  }

  // Test that error responses don't leak stack traces
  const { body: errorBody } = await fetchJson("/api/auth/sign-in", {
    method: "POST",
    body: JSON.stringify({}),
  });
  const errorStr = JSON.stringify(errorBody || {});
  if (!errorStr.includes("node_modules") && !errorStr.includes("at Object.") && !errorStr.includes("stack")) {
    pass("Error responses no stack leak", "No stack trace in error response");
  } else {
    fail("Error responses no stack leak", "Stack trace found in error response");
  }
}

// ── Runner ──

async function main() {
  console.log(`\n╔══════════════════════════════════════════════╗`);
  console.log(`║   EduCore Security Regression Tests          ║`);
  console.log(`║   Target: ${BASE.padEnd(34)}║`);
  console.log(`╚══════════════════════════════════════════════╝`);

  try {
    await testUnauthenticatedAccess();
    await testRBACEnforcement();
    await testTenantIsolation();
    await testAuthSessionIntegrity();
    await testCriticalSecurityPatterns();
  } catch (e) {
    console.error("\nFATAL ERROR:", e);
  }

  // Summary
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const total = results.length;

  console.log(`\n${"═".repeat(50)}`);
  console.log(`  Results: ${passed}/${total} passed, ${failed} failed`);
  if (failed > 0) {
    console.log(`\n  Failed tests:`);
    for (const r of results.filter((r) => !r.passed)) {
      console.log(`    ✗ ${r.name}: ${r.detail}`);
    }
  }
  console.log(`${"═".repeat(50)}\n`);

  process.exit(failed > 0 ? 1 : 0);
}

main();
