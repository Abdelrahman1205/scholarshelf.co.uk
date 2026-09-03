/**
 * tests/payment-idempotency.ts — Slice 5: payment lifecycle idempotency.
 *
 * Uses a minimal single-row fixture (one book_payments row, inserted via pg) and
 * calls the storage transitions twice each to prove they are idempotent:
 *   - confirmPayment twice → second is a no-op (confirmedAt unchanged, no error).
 *   - markPaymentReadyForCollection twice → idempotent.
 *   - markPaymentCollected twice → idempotent (no "already collected" error).
 *
 * (The allocation/stock side effects of confirm are covered structurally by the
 *  per-basket guard + tests/stock-idempotency.ts.)
 *
 * Needs DATABASE_URL. Self-cleaning. Run: npm run test:payments
 */
import "dotenv/config";
import { Pool } from "pg";
import { storage } from "../server/storage.js";
import { randomUUID } from "crypto";

const TAG = Math.random().toString(36).slice(2, 8);
const results: { name: string; passed: boolean; detail: string }[] = [];
const ok = (n: string, d = "") => { results.push({ name: n, passed: true, detail: d }); console.log(`  ✓ ${n}${d ? " — " + d : ""}`); };
const no = (n: string, d: string) => { results.push({ name: n, passed: false, detail: d }); console.log(`  ✗ ${n} — ${d}`); };
const expect = (c: boolean, n: string, d = "") => c ? ok(n, d) : no(n, d || "assertion failed");

async function run() {
  console.log("═══════════════════════════════════════════════");
  console.log("  Payment Lifecycle Idempotency — Slice 5");
  console.log(`  TAG: ${TAG}`);
  console.log("═══════════════════════════════════════════════\n");

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const schools = await storage.getSchools();
  const fixtureSchool = schools.find((s: any) => s.code === "TEST-001") || schools[0];
  const schoolId = fixtureSchool?.id ?? null;

  const paymentId = randomUUID();
  const ref = `PAY-IDEMPO-${TAG}`;
  await pool.query(
    `INSERT INTO book_payments (id, parent_identifier, total_amount, payment_reference, status, order_status, school_id)
     VALUES ($1, $2, $3, $4, 'reference_submitted', 'awaiting_payment_reference', $5)`,
    [paymentId, `idempo.${TAG}@test.com`, "0.00", ref, schoolId],
  );
  console.log(`  Fixture payment ${paymentId} (status reference_submitted)\n`);

  try {
    // 1. Double confirm — second call must be a no-op (confirmedAt unchanged)
    console.log("─── 1. confirmPayment is idempotent ───");
    const c1 = await storage.confirmPayment(paymentId, "tester", "first", schoolId);
    const t1 = c1.confirmedAt ? new Date(c1.confirmedAt).getTime() : 0;
    expect(c1.status === "confirmed", "First confirm → confirmed");
    await new Promise((r) => setTimeout(r, 25));
    const c2 = await storage.confirmPayment(paymentId, "tester", "second", schoolId);
    const t2 = c2.confirmedAt ? new Date(c2.confirmedAt).getTime() : 0;
    expect(c2.status === "confirmed", "Second confirm → still confirmed (no error)");
    expect(t1 === t2 && t1 !== 0, "confirmedAt unchanged (not re-processed)", `t1=${t1} t2=${t2}`);

    // 2. Double ready-for-collection
    console.log("\n─── 2. ready-for-collection is idempotent ───");
    const r1 = await storage.markPaymentReadyForCollection(paymentId, "tester", undefined, schoolId);
    expect(r1.status === "ready_for_collection", "First → ready_for_collection");
    const r2 = await storage.markPaymentReadyForCollection(paymentId, "tester", undefined, schoolId);
    expect(r2.status === "ready_for_collection", "Second → still ready_for_collection (no error)");

    // 3. Double collected
    console.log("\n─── 3. collected is idempotent ───");
    const k1 = await storage.markPaymentCollected(paymentId, "tester", undefined, schoolId);
    expect(k1.status === "collected", "First → collected");
    const k2 = await storage.markPaymentCollected(paymentId, "tester", undefined, schoolId);
    expect(k2.status === "collected", "Second → still collected (no 'already collected' error)");
  } catch (e: any) {
    no("Unexpected throw during idempotency flow", e?.message || String(e));
  } finally {
    await pool.query(`DELETE FROM book_payments WHERE id = $1`, [paymentId]).catch(() => {});
    await pool.end();
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
