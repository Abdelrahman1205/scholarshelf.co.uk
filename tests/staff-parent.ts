/**
 * tests/staff-parent.ts — Slice 3: staff-parent unified identity
 *
 * Verifies (against a running dev server, admin session):
 *   1. Creating a user with an email that already exists → 409 asking the admin
 *      to link or create separately (choose_link_or_create).
 *   2. linkToExisting:true adds the role to the existing account (no duplicate).
 *   3. Inviting an email that already exists → 409 add_role_to_existing.
 *   4. Deleting a staff member who is also a parent → 409 offboard_staff (guard).
 *   5. offboard-staff removes the staff role but KEEPS the account (parent access
 *      preserved) and downgrades a staff primary role to parent.
 *
 * Self-cleaning: deletes the user it creates. One sign-in (rate-limit friendly).
 *
 * Run: npm run test:staff   (dev server must be listening)
 */
const BASE = process.env.APP_BASE_URL || "http://localhost:5000";
const TAG = Math.random().toString(36).slice(2, 8);

let adminCookie = "";
const results: { name: string; passed: boolean; detail: string }[] = [];
const pass = (name: string, detail = "") => { results.push({ name, passed: true, detail }); console.log(`  ✓ ${name}${detail ? " — " + detail : ""}`); };
const fail = (name: string, detail: string) => { results.push({ name, passed: false, detail }); console.log(`  ✗ ${name} — ${detail}`); };

async function signIn(username: string, password: string, schoolCode?: string): Promise<string | null> {
  const payload: any = { username, password };
  if (schoolCode) payload.schoolCode = schoolCode;
  const res = await fetch(`${BASE}/api/auth/sign-in`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload), redirect: "manual",
  });
  if (res.status !== 200) return null;
  return (res.headers.getSetCookie?.() ?? []).join("; ") || null;
}

async function req(method: string, path: string, body?: unknown): Promise<{ status: number; body: any }> {
  const hasBody = body !== undefined && method !== "GET";
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { ...(hasBody ? { "Content-Type": "application/json" } : {}), ...(adminCookie ? { Cookie: adminCookie } : {}) },
    ...(hasBody ? { body: JSON.stringify(body) } : {}),
    redirect: "manual",
  });
  let parsed: any = null;
  try { parsed = await res.json(); } catch { /* no body */ }
  return { status: res.status, body: parsed };
}

async function run() {
  console.log("═══════════════════════════════════════════════");
  console.log("  Staff-Parent Identity — Slice 3 Tests");
  console.log(`  TAG: ${TAG} | BASE: ${BASE}`);
  console.log("═══════════════════════════════════════════════");

  adminCookie = (await signIn("admin", "admin123", "TEST-001")) || "";
  if (!adminCookie) { console.error("\n✗ Could not sign in as admin — aborting."); process.exit(1); }
  console.log("\n  ✓ Signed in as admin");

  const email = `sp.${TAG}@test.com`;
  let userId: string | undefined;

  // 1. Create a base STAFF account (primary role = teacher)
  console.log("\n─── 1. Create base staff (teacher) account ───");
  {
    const { status, body } = await req("POST", "/api/users", {
      username: `sp_${TAG}`, password: "Passw0rd!", name: `Staff Parent ${TAG}`, role: "teacher", email,
    });
    if (status === 201 && body?.id) { userId = body.id; pass("Base teacher created", email); }
    else { fail("Base teacher create", `Status ${status}: ${JSON.stringify(body)}`); }
  }

  // 2. Same email, different role, NO choice → 409 choose_link_or_create
  console.log("\n─── 2. Email clash on create → ask admin ───");
  {
    const { status, body } = await req("POST", "/api/users", {
      username: `sp2_${TAG}`, password: "Passw0rd!", name: `Dup ${TAG}`, role: "parent", email,
    });
    if (status === 409 && body?.suggestedAction === "choose_link_or_create" && body?.existingUserId === userId) {
      pass("Clash → 409 choose_link_or_create", `existingRole=${body.existingRole}`);
    } else fail("Create clash prompt", `Status ${status}, action=${body?.suggestedAction}`);
  }

  // 3. linkToExisting:true → adds parent role to the existing account
  console.log("\n─── 3. Link role to existing account ───");
  {
    const { status, body } = await req("POST", "/api/users", {
      username: `sp3_${TAG}`, password: "Passw0rd!", name: `Dup ${TAG}`, role: "parent", email, linkToExisting: true,
    });
    if (status === 200 && body?.linked && body?.addedRole === "parent") pass("Linked parent role to existing account", "");
    else fail("Link to existing", `Status ${status}: ${JSON.stringify(body)}`);
  }

  // 4. Invite the same email → 409 add_role_to_existing
  console.log("\n─── 4. Email clash on invite → ask admin ───");
  {
    const { status, body } = await req("POST", "/api/invites", { email, role: "finance" });
    if (status === 409 && body?.suggestedAction === "add_role_to_existing" && body?.existingUserId === userId) {
      pass("Invite clash → 409 add_role_to_existing", "");
    } else fail("Invite clash prompt", `Status ${status}, action=${body?.suggestedAction}`);
  }

  // 5. Deleting a staff member who is also a parent → 409 offboard_staff
  console.log("\n─── 5. Delete guard preserves parent access ───");
  if (userId) {
    const { status, body } = await req("DELETE", `/api/admin/users/${userId}`);
    if (status === 409 && body?.suggestedAction === "offboard_staff") pass("Delete blocked → offboard_staff", "");
    else fail("Delete guard", `Expected 409 offboard_staff, got ${status} (${body?.suggestedAction})`);
  }

  // 6. Offboard staff → removes staff role, keeps account, downgrades to parent
  console.log("\n─── 6. Offboard staff, keep parent ───");
  if (userId) {
    const { status, body } = await req("POST", `/api/admin/users/${userId}/offboard-staff`);
    if (status === 200 && body?.offboarded && Array.isArray(body?.removedStaffRoles) && body.removedStaffRoles.includes("teacher")) {
      pass("Offboarded, parent preserved", `removed=${body.removedStaffRoles.join(",")}, role=${body.role}`);
      if (body.role !== "parent") fail("Primary downgraded to parent", `role=${body.role}`);
      else pass("Primary role downgraded to parent", "");
    } else fail("Offboard staff", `Status ${status}: ${JSON.stringify(body)}`);
  }

  // 7. Cleanup — now a pure parent account, delete should succeed
  console.log("\n─── 7. Cleanup ───");
  if (userId) {
    const { status } = await req("DELETE", `/api/admin/users/${userId}`);
    if (status === 204 || status === 200) pass("Cleanup delete (pure parent) → ok", "");
    else fail("Cleanup delete", `Status ${status}`);
  }

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed);
  console.log("\n═══════════════════════════════════════════════");
  console.log(`  Results: ${passed}/${results.length} passed`);
  if (failed.length) { console.log("\n  Failures:"); failed.forEach((r) => console.log(`    ✗ ${r.name} — ${r.detail}`)); }
  console.log("═══════════════════════════════════════════════\n");
  process.exit(failed.length > 0 ? 1 : 0);
}

run().catch((err) => { console.error("Unexpected error:", err); process.exit(1); });
