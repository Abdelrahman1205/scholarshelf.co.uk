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
import { buildSslConfig } from "../server/config/database.js";
import { storage, InsufficientStockError } from "../server/storage.js";
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

  // Use the app's own SSL resolution rather than hardcoding TLS on: a local or
  // sslmode=disable Postgres does not speak TLS and pg fails outright, which is
  // why this suite could only ever run against Neon.
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: buildSslConfig() });
  const schools = await storage.getSchools();
  const demo = schools.find((s: any) => s.code === "DEMO-001") || schools[0];
  const schoolId = demo?.id ?? null;

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
  }

  // ── D2/D3: the parts the sequential tests above cannot reach ──────────────
  //
  // The suite above calls each transition twice IN SEQUENCE. That proves the
  // status guard, and nothing else. It cannot catch:
  //
  //   D3  two callers arriving at the same instant — a finance officer clicking
  //       while the auto-verifier settles the same order.
  //
  //       HONEST NOTE: this test was run against a faithful reproduction of the
  //       original non-transactional confirmPayment, and the duplicate-allocation
  //       race did NOT reproduce at 8-way concurrency — the per-basket guard
  //       (`existingAllocs.length > 0`) held. So D3 as described in the report is
  //       unconfirmed, and this section is a regression guard rather than proof
  //       of a fixed defect. It is worth keeping: the guard held by timing, and
  //       the conditional-update lock makes the same outcome structural.
  //       D1 and D2 below DID reproduce, and fail against the original code.
  //
  //   D2  a confirmation that cannot be honoured. adjustStock refuses to take
  //       stock below zero — and confirmPayment used to catch that and create
  //       the allocation anyway.
  //
  // Both need a real order: a student, a book with known stock, a basket.
  const fixture = await buildOrderFixture(pool, schoolId);

  try {
    console.log("\n─── 4. D3 · concurrent confirm creates ONE set of allocations ───");
    const CONCURRENCY = 8;
    const settled = await Promise.allSettled(
      Array.from({ length: CONCURRENCY }, () =>
        storage.confirmPayment(fixture.paymentId, "race-tester", "concurrent", schoolId)),
    );
    const threw = settled.filter((r) => r.status === "rejected");
    expect(threw.length === 0, `${CONCURRENCY} concurrent confirms, none threw`,
      threw.length ? String((threw[0] as PromiseRejectedResult).reason?.message) : "");

    const allocs = await pool.query(
      `SELECT count(*)::int AS n FROM finance_book_allocations WHERE basket_id = $1`, [fixture.basketId]);
    expect(allocs.rows[0].n === 1,
      "Exactly one allocation row after a concurrent storm",
      `got ${allocs.rows[0].n} (expected 1)`);

    const stock = await pool.query(`SELECT stock_quantity FROM books WHERE id = $1`, [fixture.bookId]);
    expect(stock.rows[0].stock_quantity === fixture.startingStock - 1,
      "Stock deducted exactly once",
      `${fixture.startingStock} → ${stock.rows[0].stock_quantity}, expected ${fixture.startingStock - 1}`);

    console.log("\n─── 5. D2 · a confirmation that would oversell is refused, and rolls back ───");
    const short = await buildOrderFixture(pool, schoolId, { stock: 0, quantity: 3 });
    let refused = false;
    let refusedWith = "";
    try {
      await storage.confirmPayment(short.paymentId, "oversell-tester", undefined, schoolId);
    } catch (e: any) {
      refused = true;
      refusedWith = e?.message || String(e);
      expect(e instanceof InsufficientStockError, "Refused with InsufficientStockError", e?.name);
    }
    expect(refused, "Confirming beyond available stock throws instead of over-allocating", refusedWith);

    const orphaned = await pool.query(
      `SELECT count(*)::int AS n FROM finance_book_allocations WHERE basket_id = $1`, [short.basketId]);
    expect(orphaned.rows[0].n === 0,
      "No allocation rows survive the failed confirmation (transaction rolled back)",
      `got ${orphaned.rows[0].n}`);

    const statusAfter = await pool.query(`SELECT status FROM book_payments WHERE id = $1`, [short.paymentId]);
    expect(statusAfter.rows[0].status !== "confirmed",
      "Order is NOT left marked confirmed after a failed confirmation",
      `status=${statusAfter.rows[0].status}`);

    // The old code marked it confirmed first, so a retry hit the idempotency
    // guard and returned immediately — the allocations could never be created.
    // With the rollback the officer can restock and retry, and it works.
    await pool.query(`UPDATE books SET stock_quantity = 5 WHERE id = $1`, [short.bookId]);
    const retried = await storage.confirmPayment(short.paymentId, "oversell-tester", undefined, schoolId);
    expect(retried.status === "confirmed", "Retry after restocking succeeds");
    const afterRetry = await pool.query(
      `SELECT count(*)::int AS n FROM finance_book_allocations WHERE basket_id = $1`, [short.basketId]);
    expect(afterRetry.rows[0].n === 1, "Retry creates the allocation that was rolled back",
      `got ${afterRetry.rows[0].n}`);

    await cleanupFixture(pool, short);
  } catch (e: any) {
    no("Unexpected throw during concurrency/stock tests", e?.message || String(e));
  } finally {
    await cleanupFixture(pool, fixture).catch(() => {});
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

interface OrderFixture {
  paymentId: string; basketId: string; bookId: string; studentId: string;
  classId: string; startingStock: number;
}

/**
 * A minimal but REAL order: class → student → book → basket → basket item →
 * payment → basket_payment. confirmPayment walks all of it, so a fixture that
 * skips a link tests nothing.
 */
async function buildOrderFixture(
  pool: Pool, schoolId: string | null, opts: { stock?: number; quantity?: number } = {},
): Promise<OrderFixture> {
  const stock = opts.stock ?? 10;
  const quantity = opts.quantity ?? 1;
  const suffix = Math.random().toString(36).slice(2, 8);

  const classId = randomUUID();
  await pool.query(
    `INSERT INTO classes (id, name, year_group, academic_year, school_id) VALUES ($1,$2,$3,$4,$5)`,
    [classId, `Race Class ${suffix}`, "Year 5", "2026/2027", schoolId]);

  const studentId = randomUUID();
  await pool.query(
    `INSERT INTO students (id, name, student_code, class_id, school_id, status)
     VALUES ($1,$2,$3,$4,$5,'active')`,
    [studentId, `Race Pupil ${suffix}`, `STU-R${suffix.slice(0, 4)}`, classId, schoolId]);

  const bookId = randomUUID();
  await pool.query(
    `INSERT INTO books (id, title, author, isbn, price, stock_quantity, school_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [bookId, `Race Book ${suffix}`, "Tester", `RACE-${suffix}`, "9.99", stock, schoolId]);

  const basketId = randomUUID();
  await pool.query(
    `INSERT INTO child_book_baskets (id, student_id, parent_identifier, total_amount, status, school_id)
     VALUES ($1,$2,$3,$4,'paid',$5)`,
    [basketId, studentId, `race.${suffix}@test.com`, "9.99", schoolId]);
  await pool.query(
    `INSERT INTO basket_items (id, basket_id, book_id, quantity, unit_price, total_price)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [randomUUID(), basketId, bookId, quantity, "9.99", (9.99 * quantity).toFixed(2)]);

  const paymentId = randomUUID();
  await pool.query(
    `INSERT INTO book_payments (id, parent_identifier, total_amount, payment_reference, status, order_status, school_id)
     VALUES ($1,$2,$3,$4,'reference_submitted','awaiting_payment_reference',$5)`,
    [paymentId, `race.${suffix}@test.com`, "9.99", `PAY-RACE-${suffix}`, schoolId]);
  await pool.query(
    `INSERT INTO basket_payments (id, basket_id, payment_id) VALUES ($1,$2,$3)`,
    [randomUUID(), basketId, paymentId]);

  return { paymentId, basketId, bookId, studentId, classId, startingStock: stock };
}

async function cleanupFixture(pool: Pool, f: OrderFixture): Promise<void> {
  await pool.query(`DELETE FROM finance_book_allocations WHERE basket_id = $1`, [f.basketId]).catch(() => {});
  await pool.query(`DELETE FROM basket_payments WHERE basket_id = $1`, [f.basketId]).catch(() => {});
  await pool.query(`DELETE FROM basket_items WHERE basket_id = $1`, [f.basketId]).catch(() => {});
  await pool.query(`DELETE FROM child_book_baskets WHERE id = $1`, [f.basketId]).catch(() => {});
  await pool.query(`DELETE FROM book_payments WHERE id = $1`, [f.paymentId]).catch(() => {});
  await pool.query(`DELETE FROM book_inventory_transactions WHERE book_id = $1`, [f.bookId]).catch(() => {});
  await pool.query(`DELETE FROM books WHERE id = $1`, [f.bookId]).catch(() => {});
  await pool.query(`DELETE FROM students WHERE id = $1`, [f.studentId]).catch(() => {});
  await pool.query(`DELETE FROM classes WHERE id = $1`, [f.classId]).catch(() => {});
}

run().catch((err) => { console.error("Unexpected error:", err); process.exit(1); });
