/**
 * tests/stock-idempotency.ts — Slice 5: stock atomicity / idempotency.
 *
 * Exercises storage.adjustStock directly (no HTTP, no rate limiter) to prove:
 *   1. Concurrent deductions don't lose updates (atomic decrement).
 *   2. Deducting below zero is rejected and leaves stock unchanged (no oversell).
 *   3. Increments (purchase/return) add correctly.
 *   4. One inventory transaction is logged per successful adjustment.
 *
 * Needs DATABASE_URL (loaded via dotenv). Self-cleaning: deletes its test book.
 * Run: npm run test:stock
 */
import "dotenv/config";
import { storage } from "../server/storage.js";

const TAG = Math.random().toString(36).slice(2, 8);
const results: { name: string; passed: boolean; detail: string }[] = [];
const ok = (n: string, d = "") => { results.push({ name: n, passed: true, detail: d }); console.log(`  ✓ ${n}${d ? " — " + d : ""}`); };
const no = (n: string, d: string) => { results.push({ name: n, passed: false, detail: d }); console.log(`  ✗ ${n} — ${d}`); };
const expect = (c: boolean, n: string, d = "") => c ? ok(n, d) : no(n, d || "assertion failed");

async function run() {
  console.log("═══════════════════════════════════════════════");
  console.log("  Stock Atomicity / Idempotency — Slice 5");
  console.log(`  TAG: ${TAG}`);
  console.log("═══════════════════════════════════════════════\n");

  const schools = await storage.getSchools();
  const demo = schools.find((s: any) => s.code === "DEMO-001") || schools[0];
  if (!demo) { console.error("✗ No school found — aborting."); process.exit(1); }
  const schoolId = demo.id;

  const book = await storage.createBook({ title: `Stock Test ${TAG}`, stockQuantity: 20, schoolId } as any);
  console.log(`  Created test book ${book.id} with stock 20\n`);

  try {
    // 1. Concurrent deductions — 10 × 1 should leave exactly 10 (no lost updates)
    console.log("─── 1. Concurrent deductions are atomic ───");
    await Promise.all(Array.from({ length: 10 }, () =>
      storage.adjustStock(book.id, 1, "allocation", `concurrent ${TAG}`).catch(() => null)
    ));
    let fresh = await storage.getBook(book.id, schoolId);
    expect((fresh?.stockQuantity ?? -1) === 10, "10 concurrent deductions → stock 10", `got ${fresh?.stockQuantity}`);

    // 2. Oversell guard — deducting more than available must fail, stock unchanged
    console.log("\n─── 2. Oversell rejected ───");
    let threw = false;
    try { await storage.adjustStock(book.id, 1000, "allocation", `oversell ${TAG}`); }
    catch { threw = true; }
    fresh = await storage.getBook(book.id, schoolId);
    expect(threw, "Deduct 1000 from 10 → throws");
    expect((fresh?.stockQuantity ?? -1) === 10, "Stock unchanged after failed deduct", `got ${fresh?.stockQuantity}`);

    // 3. Increment
    console.log("\n─── 3. Increments add correctly ───");
    await storage.adjustStock(book.id, 5, "purchase", `restock ${TAG}`);
    fresh = await storage.getBook(book.id, schoolId);
    expect((fresh?.stockQuantity ?? -1) === 15, "Purchase +5 → stock 15", `got ${fresh?.stockQuantity}`);

    // 4. Transaction log — one row per successful adjustment (10 deducts + 1 purchase = 11;
    //    the failed oversell must NOT have logged)
    console.log("\n─── 4. Inventory transactions logged per success ───");
    const txns = (await storage.getInventoryTransactions(schoolId)).filter((t: any) => t.bookId === book.id);
    expect(txns.length === 11, "11 transactions logged (10 deduct + 1 purchase, 0 for failed)", `got ${txns.length}`);
  } finally {
    try { await (storage as any).deleteBook?.(book.id, schoolId); } catch { /* best-effort cleanup */ }
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
