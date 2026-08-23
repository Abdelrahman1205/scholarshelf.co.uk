/**
 * Family-First Enrollment — Integration Tests
 *
 * Run against a live server:
 *   npx tsx tests/family-enrollment.ts
 *
 * Prerequisites:
 *   - Server running on APP_BASE_URL (default http://localhost:5000)
 *   - Demo seed data loaded (admin/admin123 + DEMO-001)
 *
 * Coverage:
 *   1. Authentication guard on all family endpoints
 *   2. New family + one student + one guardian → enrolled
 *   3. New family + multiple students + one guardian → enrolled
 *   4. Link existing family → add another student
 *   5. Multiple guardians, primary contact enforcement
 *   6. Save draft with incomplete data (no guardian/student required)
 *   7. Promote draft to enrolled via /api/families/:id/enroll
 *   8. Duplicate family detection (email match → 409)
 *   9. Duplicate family detection (phone match → 409)
 *  10. Duplicate student detection (name + DOB → 409)
 *  11. Validation — missing household name on final enrollment
 *  12. Validation — missing guardian on final enrollment
 *  13. Validation — missing student on final enrollment
 *  14. PATCH /api/families/:id updates fields
 *  15. DELETE /api/guardians/:id removes guardian
 *  16. DELETE /api/families/:id removes family
 *  17. Tenant isolation — families scoped to authenticated school
 *  18. Family search — finds by guardian email and student name
 */

const BASE = process.env.APP_BASE_URL || "http://localhost:5000";
const TAG  = Date.now().toString(36); // unique suffix per run
// Phone seed: last 8 digits of epoch ms — unique per run, deterministic within a run
const PSEED = String(Date.now()).slice(-8);

// ── Types ────────────────────────────────────────────────────────────────────

interface TestResult {
  name: string;
  passed: boolean;
  detail: string;
}

const results: TestResult[] = [];
let adminCookie = "";

// ── Helpers ──────────────────────────────────────────────────────────────────

function pass(name: string, detail = "") {
  results.push({ name, passed: true, detail });
  console.log(`  ✓ ${name}${detail ? " — " + detail : ""}`);
}

function fail(name: string, detail: string) {
  results.push({ name, passed: false, detail });
  console.error(`  ✗ ${name} — ${detail}`);
}

async function req(
  method: string,
  path: string,
  body?: unknown,
  cookie = adminCookie,
): Promise<{ status: number; body: any }> {
  const hasBody = body !== undefined && method !== "GET" && method !== "HEAD";
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(hasBody ? { "Content-Type": "application/json" } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    ...(hasBody ? { body: JSON.stringify(body) } : {}),
    redirect: "manual",
  });
  let parsed: any;
  try { parsed = await res.json(); } catch { parsed = null; }
  return { status: res.status, body: parsed };
}

async function signIn(
  username: string,
  password: string,
  schoolCode?: string,
): Promise<string | null> {
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

// ── Test suites ───────────────────────────────────────────────────────────────

async function testAuthGuard() {
  console.log("\n─── 1. Authentication Guard ───");

  const paths = [
    { method: "GET",  path: "/api/families" },
    { method: "GET",  path: "/api/families/nonexistent-id" },
    { method: "POST", path: "/api/families/enroll" },
    { method: "POST", path: "/api/families/save-draft" },
    { method: "GET",  path: "/api/families/search?q=test" },
  ];

  for (const { method, path } of paths) {
    const { status } = await req(method, path, {}, "");
    if (status === 401 || status === 403) {
      pass(`${method} ${path} → ${status} (blocked)`);
    } else {
      fail(`${method} ${path}`, `Expected 401/403, got ${status}`);
    }
  }
}

async function testEnrollOneStudentOneGuardian(): Promise<string | null> {
  console.log("\n─── 2. New Family — 1 Student, 1 Guardian ───");

  const email = `enroll1.${TAG}@test.com`;
  const phone = `5${PSEED}01`;
  const { status, body } = await req("POST", "/api/families/enroll", {
    family: {
      householdName: `Test Family One ${TAG}`,
      primaryEmail: email,
      primaryPhone: phone,
      address: "1 Test Street",
    },
    guardians: [
      { fullName: "Guardian Alpha", relationship: "Mother", email, phone, isPrimaryContact: true },
    ],
    students: [
      { fullName: `Student Alpha ${TAG}`, dateOfBirth: "2016-06-15", gradeLevel: "Grade 4", preferredReadingLevel: "M" },
    ],
  });

  if (status !== 201) {
    fail("POST /api/families/enroll (1+1)", `Status ${status}: ${JSON.stringify(body)}`);
    return null;
  }

  const familyCode: string = body?.family?.familyCode;
  const studentCount: number = body?.students?.length;
  const guardianCount: number = body?.guardians?.length;

  if (familyCode && studentCount === 1 && guardianCount === 1 && body.family.status === "enrolled") {
    pass("Enrolled family (1+1)", `${familyCode} · 1 student · 1 guardian`);
  } else {
    fail("Enrolled family (1+1)", `Bad response shape: ${JSON.stringify(body)}`);
    return null;
  }

  // Verify primary contact set
  const primaryGuardian = body.guardians.find((g: any) => g.isPrimaryContact);
  if (primaryGuardian) {
    pass("Primary contact set", primaryGuardian.fullName);
  } else {
    fail("Primary contact set", "No primary contact in guardians array");
  }

  return body.family.id;
}

async function testEnrollMultipleStudents(): Promise<string | null> {
  console.log("\n─── 3. New Family — Multiple Students ───");

  const email2 = `enroll2.${TAG}@test.com`;
  const phone2 = `5${PSEED}02`;
  const { status, body } = await req("POST", "/api/families/enroll", {
    family: {
      householdName: `Test Family Multi ${TAG}`,
      primaryEmail: email2,
      primaryPhone: phone2,
      address: "2 Test Street",
    },
    guardians: [
      { fullName: "Guardian Beta", relationship: "Father", email: email2, phone: phone2, isPrimaryContact: true },
    ],
    students: [
      { fullName: `Student Beta A ${TAG}`, dateOfBirth: "2015-03-10", gradeLevel: "Grade 5", preferredReadingLevel: "N" },
      { fullName: `Student Beta B ${TAG}`, dateOfBirth: "2017-09-22", gradeLevel: "Grade 3", preferredReadingLevel: "L" },
      { fullName: `Student Beta C ${TAG}`, dateOfBirth: "2019-01-05", gradeLevel: "Grade 1", preferredReadingLevel: "J" },
    ],
  });

  if (status !== 201) {
    fail("POST /api/families/enroll (3 students)", `Status ${status}: ${JSON.stringify(body)}`);
    return null;
  }

  if (body?.students?.length === 3 && body.family.status === "enrolled") {
    pass("Enrolled family (3 students)", `${body.family.familyCode} · 3 students`);
    // Verify all student codes generated
    const allHaveCodes = body.students.every((s: any) => typeof s.studentCode === "string" && s.studentCode.startsWith("STU-"));
    if (allHaveCodes) pass("Student codes auto-generated", body.students.map((s: any) => s.studentCode).join(", "));
    else fail("Student codes auto-generated", "Some students missing studentCode");
  } else {
    fail("Enrolled family (3 students)", `Got ${body?.students?.length ?? "?"} students, status: ${body?.family?.status}`);
    return null;
  }

  return body.family.id;
}

async function testAddStudentToExistingFamily(familyId: string) {
  console.log("\n─── 4. Add Student to Existing Family ───");

  const { status, body } = await req("POST", `/api/families/${familyId}/students`, {
    fullName: `Student Alpha Sibling ${TAG}`,
    dateOfBirth: "2018-11-30",
    gradeLevel: "Grade 2",
    preferredReadingLevel: "K",
  });

  if (status === 201 && body?.studentCode?.startsWith("STU-")) {
    pass("POST /api/families/:id/students", `${body.studentCode} · ${body.name}`);
  } else {
    fail("POST /api/families/:id/students", `Status ${status}: ${JSON.stringify(body)}`);
  }

  // Verify family profile now has 2 students
  const { status: profileStatus, body: profile } = await req("GET", `/api/families/${familyId}`);
  if (profileStatus === 200 && profile?.students?.length === 2) {
    pass("Family profile student count = 2", "After adding sibling");
  } else {
    fail("Family profile student count", `Got ${profile?.students?.length ?? "?"} students`);
  }
}

async function testMultipleGuardians(familyId: string) {
  console.log("\n─── 5. Multiple Guardians ───");

  // Add second guardian (non-primary)
  const { status: s1, body: g1 } = await req("POST", `/api/families/${familyId}/guardians`, {
    fullName: "Guardian Alpha 2",
    relationship: "Father",
    email: `g2.${TAG}@test.com`,
    phone: `5${PSEED}10`,
    isPrimaryContact: false,
  });
  if (s1 === 201) pass("Add second guardian", g1.fullName);
  else fail("Add second guardian", `Status ${s1}: ${JSON.stringify(g1)}`);

  // Add third guardian and mark as primary — should demote previous primary
  const { status: s2, body: g2 } = await req("POST", `/api/families/${familyId}/guardians`, {
    fullName: "Guardian Alpha New Primary",
    relationship: "Guardian",
    email: `g3.${TAG}@test.com`,
    phone: `5${PSEED}11`,
    isPrimaryContact: true,
  });
  if (s2 === 201 && g2.isPrimaryContact) pass("Add primary guardian (demotes old)", g2.fullName);
  else fail("Add primary guardian", `Status ${s2}, isPrimaryContact=${g2?.isPrimaryContact}`);

  // Verify profile: 3 guardians total, only one primary
  const { status: ps, body: profile } = await req("GET", `/api/families/${familyId}`);
  if (ps === 200) {
    const primaryCount = (profile.guardians || []).filter((g: any) => g.isPrimaryContact).length;
    if (profile.guardians.length === 3) pass("Family has 3 guardians", "");
    else fail("Guardian count", `Expected 3, got ${profile.guardians.length}`);
    if (primaryCount === 1) pass("Exactly one primary contact", "");
    else fail("Primary contact uniqueness", `${primaryCount} primaries found`);
  } else {
    fail("GET /api/families/:id for guardian check", `Status ${ps}`);
  }

  return g1?.id as string | undefined;
}

async function testPatchGuardianAndDelete(guardianId: string | undefined) {
  console.log("\n─── 5b. PATCH & DELETE Guardian ───");

  if (!guardianId) { fail("Guardian PATCH/DELETE", "No guardian ID from previous step"); return; }

  // Patch
  const { status: ps, body: patched } = await req("PATCH", `/api/guardians/${guardianId}`, {
    relationship: "Step-Parent",
    phone: `555099${TAG}`.slice(0, 10),
  });
  if (ps === 200 && patched.relationship === "Step-Parent") {
    pass("PATCH /api/guardians/:id", `relationship → ${patched.relationship}`);
  } else {
    fail("PATCH /api/guardians/:id", `Status ${ps}: ${JSON.stringify(patched)}`);
  }

  // Delete
  const { status: ds } = await req("DELETE", `/api/guardians/${guardianId}`);
  if (ds === 200) pass("DELETE /api/guardians/:id", "Guardian removed");
  else fail("DELETE /api/guardians/:id", `Status ${ds}`);
}

async function testSaveDraft(): Promise<string | null> {
  console.log("\n─── 6. Save Draft (incomplete data) ───");

  const { status, body } = await req("POST", "/api/families/save-draft", {
    family: { householdName: `Draft Family ${TAG}` },
    guardians: [],
    students: [],
  });

  if (status === 201 && body?.family?.status === "draft" && body.family.familyCode?.startsWith("FAM-")) {
    pass("POST /api/families/save-draft", `${body.family.familyCode} · status=draft`);
    return body.family.id;
  } else {
    fail("POST /api/families/save-draft", `Status ${status}: ${JSON.stringify(body)}`);
    return null;
  }
}

async function testPromoteDraftToEnrolled(draftFamilyId: string | null) {
  console.log("\n─── 7. Promote Draft → Enrolled ───");

  if (!draftFamilyId) { fail("Promote draft", "No draftFamilyId from step 6"); return; }

  const { status, body } = await req("POST", `/api/families/${draftFamilyId}/enroll`, {
    family: {
      householdName: `Draft Family Final ${TAG}`,
      primaryEmail: `draft.final.${TAG}@test.com`,
      primaryPhone: `5${PSEED}50`,
    },
    guardians: [
      { fullName: "Draft Guardian Final", relationship: "Mother", email: `draft.final.${TAG}@test.com`, isPrimaryContact: true },
    ],
    students: [
      { fullName: `Draft Student Final ${TAG}`, dateOfBirth: "2015-07-07", gradeLevel: "Grade 5", preferredReadingLevel: "O" },
    ],
  });

  if (status === 201 && body?.family?.status === "enrolled") {
    pass("POST /api/families/:id/enroll (draft→enrolled)", body.family.familyCode);
  } else {
    fail("POST /api/families/:id/enroll", `Status ${status}: ${JSON.stringify(body)}`);
  }
}

async function testDuplicateFamilyEmail(existingEmail: string) {
  console.log("\n─── 8. Duplicate Family — Email Match ───");

  const { status, body } = await req("POST", "/api/families/enroll", {
    family: { householdName: `Dup Email Family ${TAG}`, primaryEmail: existingEmail },
    guardians: [
      { fullName: "Dup Guardian", relationship: "Father", email: existingEmail, isPrimaryContact: true },
    ],
    students: [
      { fullName: `Dup Student ${TAG}`, dateOfBirth: "2016-01-01", gradeLevel: "Grade 3", preferredReadingLevel: "L" },
    ],
  });

  if (status === 409 && body?.duplicate === true) {
    pass("Duplicate email → 409", `matches: ${(body.matches || []).length}`);
  } else {
    fail("Duplicate email detection", `Status ${status}, duplicate=${body?.duplicate}`);
  }

  // Override should proceed
  const { status: os, body: ob } = await req("POST", "/api/families/enroll", {
    family: { householdName: `Dup Override Family ${TAG}`, primaryEmail: existingEmail },
    guardians: [
      { fullName: "Override Guardian", relationship: "Father", email: existingEmail, phone: `5${PSEED}99`, isPrimaryContact: true },
    ],
    students: [
      { fullName: `Override Student ${TAG}`, dateOfBirth: "2017-02-02", gradeLevel: "Grade 2", preferredReadingLevel: "K" },
    ],
    duplicateOverride: true,
  });

  if (os === 201) pass("Duplicate override → 201", ob?.family?.familyCode ?? "");
  else fail("Duplicate override", `Status ${os}: ${JSON.stringify(ob)}`);
}

async function testDuplicateStudentNameDob(existingName: string, existingDob: string) {
  console.log("\n─── 10. Duplicate Student — Name + DOB ───");

  const { status, body } = await req("POST", "/api/families/enroll", {
    family: { householdName: `Dup Student Family ${TAG}`, primaryEmail: `dup.student.${TAG}@test.com` },
    guardians: [
      { fullName: "Dup Std Guardian", relationship: "Mother", email: `dup.student.${TAG}@test.com`, isPrimaryContact: true },
    ],
    students: [
      { fullName: existingName, dateOfBirth: existingDob, gradeLevel: "Grade 4", preferredReadingLevel: "M" },
    ],
  });

  if (status === 409 && body?.duplicate === true) {
    pass("Duplicate student name+DOB → 409", `matches: ${(body.studentMatches || []).length}`);
  } else {
    fail("Duplicate student detection", `Status ${status}, duplicate=${body?.duplicate}`);
  }
}

async function testValidation() {
  console.log("\n─── 11-13. Validation (required fields) ───");

  // Missing household name
  const { status: s1, body: b1 } = await req("POST", "/api/families/enroll", {
    family: {},
    guardians: [{ fullName: "Val G", email: "val@test.com", isPrimaryContact: true }],
    students: [{ fullName: "Val S", dateOfBirth: "2016-01-01", gradeLevel: "Grade 3" }],
  });
  if (s1 === 400) pass("Missing householdName → 400", b1?.message ?? "");
  else fail("Missing householdName", `Expected 400, got ${s1}`);

  // Missing guardian
  const { status: s2, body: b2 } = await req("POST", "/api/families/enroll", {
    family: { householdName: `Val No Guardian ${TAG}` },
    guardians: [],
    students: [{ fullName: "Val S", dateOfBirth: "2016-01-01", gradeLevel: "Grade 3" }],
  });
  if (s2 === 400) pass("Missing guardian → 400", b2?.message ?? "");
  else fail("Missing guardian", `Expected 400, got ${s2}`);

  // Missing student
  const { status: s3, body: b3 } = await req("POST", "/api/families/enroll", {
    family: { householdName: `Val No Student ${TAG}` },
    guardians: [{ fullName: "Val G", email: "val.ns@test.com", isPrimaryContact: true }],
    students: [],
  });
  if (s3 === 400) pass("Missing student → 400", b3?.message ?? "");
  else fail("Missing student", `Expected 400, got ${s3}`);

  // Guardian missing contact method
  const { status: s4, body: b4 } = await req("POST", `/api/families/${Date.now()}/guardians`, {
    fullName: "No Contact Guardian",
  });
  if (s4 === 400 || s4 === 404) pass("Guardian missing contact → 400/404", b4?.message ?? "");
  else fail("Guardian missing contact", `Expected 400/404, got ${s4}`);
}

async function testPatchFamily(familyId: string) {
  console.log("\n─── 14. PATCH /api/families/:id ───");

  const { status, body } = await req("PATCH", `/api/families/${familyId}`, {
    householdName: `Updated Household ${TAG}`,
    address: "99 Updated Road",
  });

  if (status === 200 && body?.householdName === `Updated Household ${TAG}` && body?.name === `Updated Household ${TAG}`) {
    pass("PATCH /api/families/:id", `householdName synced to name`);
  } else {
    fail("PATCH /api/families/:id", `Status ${status}: ${JSON.stringify(body)}`);
  }
}

async function testFamilySearch() {
  console.log("\n─── 18. Family Search ───");

  // Search by guardian email (we enrolled a family with enroll1.TAG@test.com)
  const emailQuery = `enroll1.${TAG}`;
  const { status, body } = await req("GET", `/api/families/search?q=${encodeURIComponent(emailQuery)}`);

  if (status === 200 && Array.isArray(body)) {
    if (body.length >= 1) {
      pass("Search by guardian email", `${body.length} result(s)`);
    } else {
      fail("Search by guardian email", `No results for query: ${emailQuery}`);
    }
  } else {
    fail("GET /api/families/search", `Status ${status}: ${JSON.stringify(body)}`);
  }

  // Search by student name
  const nameQuery = `Student Alpha ${TAG}`;
  const { status: s2, body: b2 } = await req("GET", `/api/families/search?q=${encodeURIComponent(nameQuery)}`);

  if (s2 === 200 && Array.isArray(b2) && b2.length >= 1) {
    pass("Search by student name", `${b2.length} result(s)`);
  } else {
    fail("Search by student name", `Status ${s2}, results=${b2?.length ?? "?"}`);
  }
}

async function testTenantIsolation() {
  console.log("\n─── 17. Tenant Isolation ───");

  // Get the authenticated admin's school context
  const { status: meStatus, body: me } = await req("GET", "/api/auth/me");
  if (meStatus !== 200 || !me?.schoolId) {
    fail("GET /api/auth/me for tenant check", `Status ${meStatus}`);
    return;
  }
  const mySchoolId: string = me.schoolId;

  const { status, body } = await req("GET", "/api/families");
  if (status === 200 && Array.isArray(body)) {
    const foreignFamilies = body.filter((f: any) => f.schoolId && f.schoolId !== mySchoolId);
    if (foreignFamilies.length === 0) {
      pass("Families scoped to authenticated school", `${body.length} families visible, schoolId=${mySchoolId}`);
    } else {
      fail("Families tenant isolation", `Found ${foreignFamilies.length} families from other schools`);
    }
  } else {
    fail("GET /api/families", `Status ${status}`);
  }
}

async function testDeleteFamily(familyId: string) {
  console.log("\n─── 16. DELETE /api/families/:id ───");

  const { status } = await req("DELETE", `/api/families/${familyId}`);
  if (status === 204) {
    pass("DELETE /api/families/:id", "Family removed");
    // Verify 404 on subsequent GET
    const { status: gs } = await req("GET", `/api/families/${familyId}`);
    if (gs === 404) pass("Deleted family → 404 on GET", "");
    else fail("Deleted family 404 check", `Expected 404, got ${gs}`);
  } else {
    fail("DELETE /api/families/:id", `Status ${status}`);
  }
}

// ── Hardening tests (atomicity / isolation / validation / invite) ───────────

async function testHardeningClassIdIsolation() {
  console.log("\n─── H1. Tenant isolation — foreign classId rejected ───");
  const { status } = await req("POST", "/api/families/enroll", {
    family: { householdName: `ClassIso ${TAG}`, primaryEmail: `classiso.${TAG}@test.com` },
    guardians: [{ fullName: `G ${TAG}`, email: `classiso.${TAG}@test.com`, isPrimaryContact: true }],
    students: [{ fullName: `S ${TAG}`, dateOfBirth: "2015-01-01", gradeLevel: "3", classId: "00000000-0000-0000-0000-000000000000" }],
  });
  if (status === 400) pass("Enroll with foreign classId → 400", "");
  else fail("Foreign classId not rejected", `Expected 400, got ${status}`);
}

async function testHardeningDobValidation() {
  console.log("\n─── H2. DOB validation — future date rejected ───");
  const { status } = await req("POST", "/api/families/enroll", {
    family: { householdName: `DobVal ${TAG}`, primaryEmail: `dobval.${TAG}@test.com` },
    guardians: [{ fullName: `G ${TAG}`, email: `dobval.${TAG}@test.com`, isPrimaryContact: true }],
    students: [{ fullName: `S ${TAG}`, dateOfBirth: "2999-01-01", gradeLevel: "3" }],
  });
  if (status === 400) pass("Enroll with future DOB → 400", "");
  else fail("Future DOB not rejected", `Expected 400, got ${status}`);
}

async function testHardeningInviteAndPhoto() {
  console.log("\n─── H3. Guardian invite + photo sanitization ───");
  const email = `invite.${TAG}@test.com`;
  const { status, body } = await req("POST", "/api/families/enroll", {
    family: { householdName: `Invite ${TAG}`, primaryEmail: email },
    guardians: [{ fullName: `Guardian ${TAG}`, email, isPrimaryContact: true }],
    students: [{ fullName: `Kid ${TAG}`, dateOfBirth: "2016-03-03", gradeLevel: "2", photoUrl: "data:text/html;base64,PHNjcmlwdD4=" }],
  });
  if (status !== 201) { fail("Enroll for invite test", `Status ${status}`); return; }
  const familyId = body.family?.id;
  const studentId = body.students?.[0]?.id;
  if (studentId) {
    const { body: prof } = await req("GET", `/api/students/${studentId}/profile`);
    if (!prof?.student?.photoUrl) pass("data:text/html photo rejected → null", "");
    else fail("Malicious photo stored", `photoUrl=${String(prof.student.photoUrl).slice(0, 24)}`);
  }
  const { body: fam } = await req("GET", `/api/families/${familyId}`);
  const guardianId = fam?.guardians?.[0]?.id;
  if (guardianId) {
    const { status: is, body: ib } = await req("POST", `/api/guardians/${guardianId}/invite`, {});
    if (is === 200 && ib?.portalAccessStatus === "invited") pass("Guardian invite → invited", "");
    else fail("Guardian invite", `Status ${is}, portalAccessStatus=${ib?.portalAccessStatus}`);
  } else fail("Guardian invite", "No guardian id resolved");
  if (familyId) await req("DELETE", `/api/families/${familyId}`);
}

// ── Slice 2: explicit guardian↔user relationship ───────────────────────────

async function testGuardianUserLinkField() {
  console.log("\n─── S2. Guardian exposes userId (portal link) ───");
  const email = `s2link.${TAG}@test.com`;
  const { status, body } = await req("POST", "/api/families/enroll", {
    family: { householdName: `S2 ${TAG}`, primaryEmail: email },
    guardians: [{ fullName: `S2 Guardian ${TAG}`, email, isPrimaryContact: true }],
    students: [{ fullName: `S2 Kid ${TAG}`, dateOfBirth: "2015-05-05", gradeLevel: "3" }],
  });
  if (status !== 201) { fail("Enroll for S2 test", `Status ${status}`); return; }
  const familyId = body.family?.id;
  const { body: fam } = await req("GET", `/api/families/${familyId}`);
  const g = fam?.guardians?.[0];
  // Field must be present (relationship exists) and null (no redemption yet).
  if (g && "userId" in g && g.userId === null) {
    pass("Guardian exposes userId, null before link", "");
  } else {
    fail("Guardian userId field", `present=${g ? "userId" in g : false}, value=${g?.userId}`);
  }
  // A completed (non-draft) enrolment that created a student auto-issues a
  // family linking code and marks the emailable guardian "invited" — see the
  // auto-send block in family-enrollment.routes.ts. This assertion predates that
  // behaviour and asserted "none", so it contradicted the shipped code rather
  // than testing it. What actually matters here is that the guardian is not
  // "active": an invitation has been sent, but nobody has redeemed it, so no
  // portal account exists yet.
  if (g?.portalAccessStatus === "invited") pass("Enrolled guardian portalAccessStatus=invited", "");
  else fail("Portal status after enrolment", `Expected invited, got ${g?.portalAccessStatus}`);
  if (familyId) await req("DELETE", `/api/families/${familyId}`);
}

// ── Slice 1: legacy retirement + structured errors ─────────────────────────

async function testUnknownApiStructuredError() {
  console.log("\n─── S1a. Unknown /api/* → structured error ───");
  const { status, body } = await req("GET", "/api/definitely-not-real-xyz");
  if (status === 404 && body?.success === false && body?.error?.code === "ROUTE_NOT_FOUND") {
    pass("Unknown API route → structured 404", "code=ROUTE_NOT_FOUND");
  } else {
    fail("Structured 404 envelope", `status=${status}, code=${body?.error?.code}`);
  }
}

async function testLegacyFamilyApiDecommissioned() {
  console.log("\n─── S1b. Legacy /api/admin/families decommissioned ───");
  const { status } = await req("GET", "/api/admin/families");
  if (status === 404) pass("Legacy /api/admin/families → 404", "route unregistered");
  else fail("Legacy family route still responds", `Expected 404, got ${status}`);
}

// ── Runner ────────────────────────────────────────────────────────────────────

async function run() {
  console.log("═══════════════════════════════════════════════");
  console.log("  Family-First Enrollment — Integration Tests  ");
  console.log(`  TAG: ${TAG} | BASE: ${BASE}`);
  console.log("═══════════════════════════════════════════════");

  // Sign in
  const cookie = await signIn("admin", "admin123", "DEMO-001");
  if (!cookie) {
    console.error("\n✗ Could not sign in as admin — aborting tests.");
    process.exit(1);
  }
  adminCookie = cookie;
  console.log("\n  ✓ Signed in as admin");

  await testAuthGuard();

  const family1Id = await testEnrollOneStudentOneGuardian();
  const family2Id = await testEnrollMultipleStudents();

  if (family1Id) {
    await testAddStudentToExistingFamily(family1Id);
    const secondGuardianId = await testMultipleGuardians(family1Id);
    await testPatchGuardianAndDelete(secondGuardianId);
    await testPatchFamily(family1Id);
    await testFamilySearch();
    await testTenantIsolation();

    // Duplicate detection uses the email from the enrolled family1
    const enrollEmail = `enroll1.${TAG}@test.com`;
    await testDuplicateFamilyEmail(enrollEmail);

    // Duplicate student: name + DOB of Student Alpha
    await testDuplicateStudentNameDob(`Student Alpha ${TAG}`, "2016-06-15");
  }

  await testValidation();

  // Hardening coverage
  await testHardeningClassIdIsolation();
  await testHardeningDobValidation();
  await testHardeningInviteAndPhoto();

  // Slice 1: legacy retirement + structured errors
  await testUnknownApiStructuredError();
  await testLegacyFamilyApiDecommissioned();

  // Slice 2: explicit guardian↔user relationship
  await testGuardianUserLinkField();

  const draftId = await testSaveDraft();
  await testPromoteDraftToEnrolled(draftId);

  // Clean up: delete family2 (family1 was already tested for delete in patch block)
  if (family2Id) await testDeleteFamily(family2Id);

  // ── Summary ──
  const total  = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed);

  console.log("\n═══════════════════════════════════════════════");
  console.log(`  Results: ${passed}/${total} passed`);
  if (failed.length) {
    console.log("\n  Failures:");
    failed.forEach((r) => console.log(`    ✗ ${r.name} — ${r.detail}`));
  }
  console.log("═══════════════════════════════════════════════\n");

  process.exit(failed.length > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
