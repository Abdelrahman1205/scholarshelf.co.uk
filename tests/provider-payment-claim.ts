/**
 * One provider payment settles one order — Regression Test
 *
 * Run against a live server:
 *   npx tsx tests/provider-payment-claim.ts
 *
 * Prerequisites:
 *   - Server running on APP_BASE_URL (default http://localhost:5000)
 *   - Test fixtures loaded (npm run test:fixtures → TEST-001)
 *   - DATABASE_URL pointing at the SAME database the server uses
 *   - migrations 006 and 009 applied (006 creates the unique index this proves)
 *
 * WHAT THIS GUARDS
 *
 * Audit finding 4.5, Critical: "Successful verification does not uniquely
 * reserve `matched_provider_payment_id` against one ScholarShelf order — the
 * same real-world Stripe transaction can be reused to settle multiple orders and
 * release multiple sets of books."
 *
 * The fix does NOT constrain `payment_verification_attempts`. That table is
 * append-only audit history: one order may legitimately be attempted many times
 * — a failed import, a re-run after a corrected export, a finance override — and
 * every attempt records the provider payment it considered. A unique constraint
 * there would forbid the history rather than the double-settlement.
 *
 * The claim lives on `book_payments.external_payment_id`, which carries a
 * partial unique index (migrations/006). Writing the provider's transaction id
 * onto an order IS the claim, and the database is the arbiter.
 *
 * HOW THE SECOND ORDER IS MADE TO WANT THE SAME TRANSACTION
 *
 * Payment references are unique within a school, so two orders cannot honestly
 * carry the same reference and be matched to one Stripe row that way. So the
 * arrangement is the one the finding actually describes: order A already holds
 * the transaction, and order B then legitimately matches it — order B's
 * reference is the one in the Stripe row's description. Whether A acquired it by
 * an earlier settlement, a corrected import or the original bug does not matter;
 * what is under test is that B cannot take it.
 *
 * THE MANUAL OVERRIDE IS COVERED TOO
 *
 * A Finance Officer pressing approve is a second route to the same
 * double-settlement, so it goes through the same invariant. `manuallyVerify()`
 * no longer inherits `matchedProviderPaymentId` from the last automatic attempt
 * — an override on a bank statement used to silently adopt whatever Stripe
 * transaction the failed automatic run had considered, including one another
 * order owned. Now: an override citing a provider transaction claims it and is
 * REFUSED if another order holds it; an override on independent evidence
 * records no provider ownership at all.
 *
 * Assertions:
 *   1. The unique index exists (this test is meaningless without it)
 *   2. Order A holds the provider transaction
 *   3. The database itself rejects giving it to order B (SQLSTATE 23505)
 *   4. Automatic verification of order B routes it to needs_review
 *   5. …with reason code `provider_payment_already_claimed`
 *   6. Order B is NOT confirmed
 *   7. No allocations were created for order B
 *   8. Book stock did not move
 *   9. Order A's claim is untouched by B's attempt
 *  10. Attempt history is append-only — a second run records a second attempt
 *  11. A manual override CITING the claimed transaction is refused (409)
 *  12. …and the refusal settles nothing: no confirm, no allocation, no stock
 *  13. A manual override on INDEPENDENT evidence still works
 *  14. …and records matchedProviderPaymentId = NULL, asserting no false ownership
 *  15. An override citing an unclaimed transaction claims it properly
 *  16. A signed webhook citing a claimed transaction returns 409, not 500
 *  17. …and settles nothing: no confirm, no allocation, no stock, no ownership
 *  18. The webhook event is recorded failed, not left unexplained
 *  19. A webhook citing an unclaimed transaction succeeds and takes ownership
 *  20. Re-delivering the same transaction for the same order stays idempotent
 *
 * The webhook cases need PAYMENT_WEBHOOK_SECRET to match the running server's.
 * Without it they are reported as skipped rather than passing vacuously.
 */

import "dotenv/config";
import { Client } from "pg";
import crypto from "crypto";

const BASE = process.env.APP_BASE_URL || "http://localhost:5000";
const TAG = Date.now().toString(36).slice(-6).toUpperCase();
const DATABASE_URL = process.env.DATABASE_URL;

let db: Client;
let schoolId = "";
let financeCookie = "";

const makeReference = () =>
  `EDU-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;

interface TestResult { name: string; passed: boolean; detail: string }
const results: TestResult[] = [];
function pass(name: string, detail = "") { results.push({ name, passed: true, detail }); console.log(`  ✓ ${name}${detail ? " — " + detail : ""}`); }
function fail(name: string, detail: string) { results.push({ name, passed: false, detail }); console.error(`  ✗ ${name} — ${detail}`); }
function check(name: string, cond: boolean, detail = "") { cond ? pass(name, detail) : fail(name, detail || "assertion failed"); }

async function req(method: string, path: string, body?: unknown, cookie = financeCookie) {
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

async function login(username: string, password: string, schoolCode: string): Promise<string> {
  const res = await fetch(`${BASE}/api/auth/sign-in`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password, schoolCode }),
    redirect: "manual",
  });
  return (res.headers.get("set-cookie") || "").split(";")[0] || "";
}

/** An order at the finance stage, with a basket holding one copy of `bookId`. */
async function seedOrderWithBasket(bookId: string, studentId: string, amount: string) {
  const reference = makeReference();
  const payer = `claim-${TAG}-${crypto.randomBytes(3).toString("hex")}@example.com`;

  const order = await db.query(
    `insert into book_payments
       (id, parent_identifier, total_amount, payment_method, payment_reference, status, school_id, order_status,
        payment_reference_number, payment_reference_submitted_at)
     values (gen_random_uuid()::text, $1, $2, 'external_reference', $3, 'reference_submitted', $4,
             'awaiting_payment_reference', $5, now())
     returning id`,
    [payer, amount, reference, schoolId, `REF-${TAG}-${crypto.randomBytes(2).toString("hex").toUpperCase()}`],
  );
  const paymentId: string = order.rows[0].id;

  const basket = await db.query(
    `insert into child_book_baskets (id, student_id, parent_identifier, status, total_amount, school_id)
     values (gen_random_uuid()::text, $1, $2, 'paid', $3, $4) returning id`,
    [studentId, payer, amount, schoolId],
  );
  const basketId: string = basket.rows[0].id;

  await db.query(
    `insert into basket_items (id, basket_id, book_id, quantity, unit_price, total_price)
     values (gen_random_uuid()::text, $1, $2, 1, $3, $3)`,
    [basketId, bookId, amount],
  );

  // school_id on the link row is what the composite foreign keys in 006 key off.
  await db.query(
    `insert into basket_payments (id, basket_id, payment_id, school_id)
     values (gen_random_uuid()::text, $1, $2, $3)`,
    [basketId, paymentId, schoolId],
  );

  return { paymentId, basketId, reference, payer };
}

async function stockOf(bookId: string): Promise<number> {
  const r = await db.query(`select stock_quantity from books where id = $1`, [bookId]);
  return Number(r.rows[0]?.stock_quantity ?? -1);
}

async function allocationCount(basketId: string): Promise<number> {
  const r = await db.query(`select count(*)::int as n from finance_book_allocations where basket_id = $1`, [basketId]);
  return Number(r.rows[0]?.n ?? -1);
}

const WEBHOOK_SECRET = process.env.PAYMENT_WEBHOOK_SECRET || "";

/**
 * Post a signed payment-update webhook, exactly as the provider would.
 *
 * The signed value is `<timestamp>.<raw body>` over HMAC-SHA256 — the same
 * construction `verifyWebhookRequest()` checks — and every delivery carries its
 * own event id so replay protection does not swallow the second call.
 */
async function postWebhook(body: Record<string, unknown>, eventId: string) {
  const raw = JSON.stringify(body);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = crypto
    .createHmac("sha256", WEBHOOK_SECRET)
    .update(`${timestamp}.${raw}`)
    .digest("hex");

  const res = await fetch(`${BASE}/api/webhooks/payment-update`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Signature": signature,
      "X-Timestamp": timestamp,
      "X-Event-Id": eventId,
    },
    body: raw,
    redirect: "manual",
  });
  let parsed: any = null;
  try { parsed = await res.json(); } catch { /* non-JSON */ }
  return { status: res.status, body: parsed };
}

async function webhookEvent(eventId: string) {
  const r = await db.query(
    `select status, detail from webhook_events where source = 'payment-update' and event_id = $1`,
    [eventId],
  );
  return r.rows[0];
}

async function orderRow(paymentId: string) {
  const r = await db.query(
    `select status, confirmed_at, external_payment_id from book_payments where id = $1`, [paymentId],
  );
  return r.rows[0];
}

async function latestAttempt(paymentId: string) {
  const r = await db.query(
    `select outcome, reason_code, matched_provider_payment_id
       from payment_verification_attempts
      where payment_id = $1
      order by created_at desc
      limit 1`,
    [paymentId],
  );
  return r.rows[0];
}

async function run() {
  console.log(`\n▶ Provider-payment claim regression against ${BASE}  (tag ${TAG})\n`);

  if (!DATABASE_URL) { console.error("DATABASE_URL is required — aborting."); process.exit(1); }
  db = new Client({ connectionString: DATABASE_URL });
  await db.connect();

  const school = await db.query(`select id from schools where code = 'TEST-001' limit 1`);
  schoolId = school.rows[0]?.id;
  if (!schoolId) { console.error("Fixture school TEST-001 not found — run npm run test:fixtures first."); process.exit(1); }
  await db.query(`update schools set setup_status = 'complete', status = 'active' where id = $1`, [schoolId]);

  financeCookie = await login("finance", "finance123", "TEST-001");
  if (!financeCookie) { console.error("Could not sign in as finance — aborting."); process.exit(1); }

  // ── 1. The invariant this test rests on ──────────────────────────────────
  const idx = await db.query(
    `select 1 from pg_indexes where indexname = 'book_payments_external_payment_id_unique'`,
  );
  check("Unique index on book_payments.external_payment_id exists (migration 006)",
    idx.rowCount === 1,
    idx.rowCount === 1 ? "" : "MISSING — apply migration 006; without it this test proves nothing");
  if (idx.rowCount !== 1) { await finish(); return; }

  // ── Arrange ──────────────────────────────────────────────────────────────
  const student = await db.query(`select id from students where school_id = $1 limit 1`, [schoolId]);
  const studentId: string = student.rows[0]?.id;
  if (!studentId) { console.error("No student in TEST-001 — run npm run test:fixtures first."); process.exit(1); }

  const OPENING_STOCK = 10;
  const book = await db.query(
    `insert into books (id, title, author, book_code, price, stock_quantity, low_stock_threshold, is_active, school_id)
     values (gen_random_uuid()::text, $1, 'Claim Test', $2, '25.00', $3, 2, true, $4)
     returning id`,
    [`Claim Regression ${TAG}`, `CLAIM-${TAG}`, OPENING_STOCK, schoolId],
  );
  const bookId: string = book.rows[0].id;

  const orderA = await seedOrderWithBasket(bookId, studentId, "25.00");
  const orderB = await seedOrderWithBasket(bookId, studentId, "25.00");

  // One provider transaction. Its description carries ORDER B's reference, so
  // order B is the one automatic verification will legitimately match to it.
  const providerTxnId = `pi_claim_${TAG}`;
  await db.query(
    `insert into provider_payments
       (id, school_id, provider, provider_payment_id, status, raw_status, amount, amount_refunded,
        currency, reference, customer_email, description, disputed, paid_at, source)
     values (gen_random_uuid()::text, $1, 'stripe', $2, 'succeeded', 'Paid', '25.00', '0',
             'GBP', $3, $4, $5, false, now(), 'spreadsheet_import')`,
    [schoolId, providerTxnId, orderB.reference, orderB.payer, `ScholarShelf order ${orderB.reference}`],
  );

  // Order A already holds that transaction — the state the finding describes.
  await db.query(
    `update book_payments set external_payment_id = $2, external_payment_status = 'Paid' where id = $1`,
    [orderA.paymentId, providerTxnId],
  );

  const stockBefore = await stockOf(bookId);

  console.log("1. The claim is held by one order");
  const aRow = await orderRow(orderA.paymentId);
  check("Order A holds the provider transaction",
    aRow.external_payment_id === providerTxnId, `external_payment_id=${aRow.external_payment_id}`);

  // ── 2. The database, not the application, is what refuses ────────────────
  console.log("\n2. The database refuses a second claim");
  let sqlstate = "";
  try {
    await db.query(
      `update book_payments set external_payment_id = $2 where id = $1`,
      [orderB.paymentId, providerTxnId],
    );
  } catch (e: any) {
    sqlstate = e?.code ?? "";
  }
  check("A raw UPDATE giving the same transaction to order B is rejected by the unique index",
    sqlstate === "23505", sqlstate ? `SQLSTATE ${sqlstate}` : "the UPDATE SUCCEEDED — the invariant is not enforced");

  // ── 3. The application routes the loser to Finance Investigation ─────────
  console.log("\n3. Automatic verification of the second order");
  const verify = await req("POST", `/api/admin/payments/${orderB.paymentId}/verify`);
  check("Verification endpoint responded", [200, 201].includes(verify.status), `status=${verify.status}`);

  const bRow = await orderRow(orderB.paymentId);
  const attempt = await latestAttempt(orderB.paymentId);

  check("Order B is routed to needs_review",
    bRow.status === "needs_review", `status=${bRow.status}`);

  check("…with reason code provider_payment_already_claimed",
    attempt?.reason_code === "provider_payment_already_claimed",
    `outcome=${attempt?.outcome} reason_code=${attempt?.reason_code}`);

  // ── 4. And nothing was settled ───────────────────────────────────────────
  console.log("\n4. The second order has no financial or inventory effect");
  check("Order B is not confirmed",
    bRow.status !== "confirmed" && bRow.confirmed_at === null,
    `status=${bRow.status} confirmed_at=${bRow.confirmed_at}`);

  const allocsB = await allocationCount(orderB.basketId);
  check("No allocations were created for order B", allocsB === 0, `allocations=${allocsB}`);

  const stockAfter = await stockOf(bookId);
  check("Book stock did not move", stockAfter === stockBefore,
    `before=${stockBefore} after=${stockAfter}`);

  check("Order B did not take the provider transaction",
    bRow.external_payment_id !== providerTxnId,
    `external_payment_id=${bRow.external_payment_id}`);

  // ── 5. The winner is undisturbed ─────────────────────────────────────────
  console.log("\n5. The order that holds the claim is undisturbed");
  const aAfter = await orderRow(orderA.paymentId);
  check("Order A still holds the provider transaction",
    aAfter.external_payment_id === providerTxnId, `external_payment_id=${aAfter.external_payment_id}`);

  // ── 6. History is still allowed to repeat ────────────────────────────────
  console.log("\n6. Attempt history is append-only, not constrained");
  await req("POST", `/api/admin/payments/${orderB.paymentId}/verify`);
  const attempts = await db.query(
    `select count(*)::int as n from payment_verification_attempts where payment_id = $1`,
    [orderB.paymentId],
  );
  check("A second verification run records a second attempt for the same order",
    Number(attempts.rows[0].n) >= 2,
    `attempts=${attempts.rows[0].n} (a UNIQUE constraint on matched_provider_payment_id would have blocked this)`);


  // ── 7. The Finance Officer cannot reuse a claimed transaction ────────────
  console.log("\n7. Manual override citing an already-claimed transaction");
  const providerRow = await db.query(
    `select id from provider_payments where provider_payment_id = $1 and school_id = $2`,
    [providerTxnId, schoolId],
  );
  const providerRowId: string = providerRow.rows[0]?.id;

  const refused = await req("POST", `/api/admin/payments/${orderB.paymentId}/manual-verify`, {
    reason: "Officer says this is the Stripe payment for order B.",
    providerPaymentId: providerRowId,
  });
  check("Manual override citing a claimed transaction is refused with 409",
    refused.status === 409, `status=${refused.status} message=${refused.body?.message ?? ""}`);

  const bAfterRefusal = await orderRow(orderB.paymentId);
  check("The refused override did not confirm order B",
    bAfterRefusal.status !== "confirmed" && bAfterRefusal.confirmed_at === null,
    `status=${bAfterRefusal.status} confirmed_at=${bAfterRefusal.confirmed_at}`);
  check("The refused override created no allocations",
    (await allocationCount(orderB.basketId)) === 0);
  check("The refused override moved no stock",
    (await stockOf(bookId)) === stockBefore, `stock=${await stockOf(bookId)} expected=${stockBefore}`);
  check("The refused override did not take the transaction from order A",
    (await orderRow(orderA.paymentId)).external_payment_id === providerTxnId);

  // ── 8. An override on independent evidence still works ───────────────────
  console.log("\n8. Manual override on independent evidence");
  const stockBeforeIndependent = await stockOf(bookId);
  const independent = await req("POST", `/api/admin/payments/${orderB.paymentId}/manual-verify`, {
    reason: "Bank statement seen; transfer received on 2 September. No Stripe transaction involved.",
  });
  check("Manual override without a cited transaction succeeds",
    independent.status === 200, `status=${independent.status} message=${independent.body?.message ?? ""}`);

  const bIndependent = await orderRow(orderB.paymentId);
  check("Order B is now confirmed by the officer",
    bIndependent.status === "confirmed", `status=${bIndependent.status}`);

  const indepAttempt = await latestAttempt(orderB.paymentId);
  check("The override records NO provider ownership (matched_provider_payment_id is null)",
    indepAttempt?.matched_provider_payment_id === null,
    `matched_provider_payment_id=${indepAttempt?.matched_provider_payment_id}`);

  check("Order B still does not hold the provider transaction",
    bIndependent.external_payment_id !== providerTxnId,
    `external_payment_id=${bIndependent.external_payment_id}`);

  check("Settling order B on independent evidence did deduct its stock",
    (await stockOf(bookId)) === stockBeforeIndependent - 1,
    `before=${stockBeforeIndependent} after=${await stockOf(bookId)}`);

  // ── 9. Citing an UNCLAIMED transaction is the legitimate case ────────────
  console.log("\n9. Manual override citing an unclaimed transaction");
  const orderC = await seedOrderWithBasket(bookId, studentId, "25.00");
  const freeTxnId = `pi_free_${TAG}`;
  const freeRow = await db.query(
    `insert into provider_payments
       (id, school_id, provider, provider_payment_id, status, raw_status, amount, amount_refunded,
        currency, reference, customer_email, description, disputed, paid_at, source)
     values (gen_random_uuid()::text, $1, 'stripe', $2, 'succeeded', 'Paid', '25.00', '0',
             'GBP', $3, $4, $5, false, now(), 'spreadsheet_import')
     returning id`,
    [schoolId, freeTxnId, orderC.reference, orderC.payer, `ScholarShelf order ${orderC.reference}`],
  );

  const cited = await req("POST", `/api/admin/payments/${orderC.paymentId}/manual-verify`, {
    reason: "Confirmed against the Stripe dashboard; automatic matching missed the reference.",
    providerPaymentId: freeRow.rows[0].id,
  });
  check("Manual override citing an unclaimed transaction succeeds",
    cited.status === 200, `status=${cited.status} message=${cited.body?.message ?? ""}`);

  const cRow = await orderRow(orderC.paymentId);
  check("Order C now holds that transaction",
    cRow.external_payment_id === freeTxnId, `external_payment_id=${cRow.external_payment_id}`);

  const cAttempt = await latestAttempt(orderC.paymentId);
  check("…and the attempt records the provider ownership it actually claimed",
    cAttempt?.matched_provider_payment_id === freeRow.rows[0].id,
    `matched_provider_payment_id=${cAttempt?.matched_provider_payment_id}`);


  // ── 10. The payment webhook uses the same ownership invariant ────────────
  console.log("\n10. Payment webhook and provider ownership");

  if (!WEBHOOK_SECRET) {
    console.log("  ⊘ skipped — PAYMENT_WEBHOOK_SECRET is not set in this environment.");
    console.log("    Set it to the same value the server is running with to exercise these.");
  } else {
    // Order D is fresh, so a refusal here cannot be confused with earlier state.
    const orderD = await seedOrderWithBasket(bookId, studentId, "25.00");
    const stockBeforeWebhook = await stockOf(bookId);

    // 10a. Citing the transaction order A owns.
    const conflictEvent = `evt_conflict_${TAG}`;
    const conflict = await postWebhook({
      eduBookReference: orderD.reference,
      status: "paid",
      externalPaymentId: providerTxnId,   // order A holds this
    }, conflictEvent);

    check("Webhook citing a claimed transaction returns 409 (not 500)",
      conflict.status === 409, `status=${conflict.status} message=${conflict.body?.message ?? ""}`);
    check("…and the message does not leak SQL detail",
      !/23505|constraint|duplicate key|pg_|SQLSTATE/i.test(String(conflict.body?.message ?? "")),
      `message=${conflict.body?.message ?? ""}`);

    const dAfterConflict = await orderRow(orderD.paymentId);
    check("The refused webhook did not confirm order D",
      dAfterConflict.status !== "confirmed" && dAfterConflict.confirmed_at === null,
      `status=${dAfterConflict.status}`);
    check("The refused webhook created no allocations",
      (await allocationCount(orderD.basketId)) === 0);
    check("The refused webhook moved no stock",
      (await stockOf(bookId)) === stockBeforeWebhook,
      `before=${stockBeforeWebhook} after=${await stockOf(bookId)}`);
    check("Order D took no provider transaction",
      !dAfterConflict.external_payment_id, `external_payment_id=${dAfterConflict.external_payment_id}`);
    check("Order A still owns the transaction",
      (await orderRow(orderA.paymentId)).external_payment_id === providerTxnId);

    const conflictRow = await webhookEvent(conflictEvent);
    check("The webhook event is recorded as failed with a reason",
      conflictRow?.status === "failed" && !!conflictRow?.detail,
      `status=${conflictRow?.status} detail=${conflictRow?.detail ?? ""}`);

    // 10b. Citing an unclaimed transaction — the ordinary case.
    const freeWebhookTxn = `pi_hook_${TAG}`;
    const okEvent = `evt_ok_${TAG}`;
    const ok = await postWebhook({
      eduBookReference: orderD.reference,
      status: "paid",
      externalPaymentId: freeWebhookTxn,
    }, okEvent);

    check("Webhook citing an unclaimed transaction succeeds",
      ok.status === 200, `status=${ok.status} message=${ok.body?.message ?? ""}`);

    const dAfterOk = await orderRow(orderD.paymentId);
    check("Order D now owns that transaction",
      dAfterOk.external_payment_id === freeWebhookTxn,
      `external_payment_id=${dAfterOk.external_payment_id}`);

    // 10c. Re-delivery of the same transaction for the same order.
    const repeatEvent = `evt_repeat_${TAG}`;
    const repeat = await postWebhook({
      eduBookReference: orderD.reference,
      status: "paid",
      externalPaymentId: freeWebhookTxn,
    }, repeatEvent);

    check("Re-delivering the same transaction for the same order is not refused",
      repeat.status === 200, `status=${repeat.status} message=${repeat.body?.message ?? ""}`);
    check("…and ownership is unchanged",
      (await orderRow(orderD.paymentId)).external_payment_id === freeWebhookTxn);

    // 10d. Replay protection is untouched by any of the above.
    const replay = await postWebhook({
      eduBookReference: orderD.reference,
      status: "paid",
      externalPaymentId: freeWebhookTxn,
    }, okEvent);   // the SAME event id as 10b
    check("A duplicate event id is still acknowledged without re-processing",
      replay.status === 200 && /already processed/i.test(String(replay.body?.message ?? "")),
      `status=${replay.status} message=${replay.body?.message ?? ""}`);
  }

  await finish();
}

async function finish() {
  const failed = results.filter((r) => !r.passed);
  console.log(`\n${"─".repeat(64)}`);
  console.log(`  ${results.length - failed.length}/${results.length} passed`);
  if (failed.length) {
    console.log("\n  Failures:");
    for (const f of failed) console.log(`    ✗ ${f.name} — ${f.detail}`);
  }
  console.log("");
  try { await db?.end(); } catch { /* already closed */ }
  process.exit(failed.length ? 1 : 0);
}

run().catch(async (e) => { console.error(e); try { await db?.end(); } catch {} process.exit(1); });
