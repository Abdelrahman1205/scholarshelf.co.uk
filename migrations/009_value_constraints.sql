-- =============================================================================
-- 009 — non-negative money and stock
-- =============================================================================
-- Audit findings 3.6 and 3.7, both Critical:
--
--   3.6  "Prices, payment amounts, and related numeric columns lack non-negative
--         constraints." Negative values corrupt revenue, outstanding balances,
--         reconciliation and reporting.
--   3.7  "Stock quantity fields lack database constraints preventing invalid
--         negative values." Inventory below zero drives over-allocation and
--         false availability.
--
-- The application already refuses both: `deductStockTx` guards with
-- `WHERE stock_quantity >= qty`, and `insertBookSchema` rejects negative prices
-- at both ends of the book routes. This migration says the same thing where it
-- cannot be bypassed — by an import path, a future route, a support operation,
-- or a hand-written statement.
--
-- Before 009 the schema carried ZERO check constraints. That is the actual
-- finding: every rule about what counts as a valid number lived in TypeScript.
--
-- HOW THIS MIGRATION BEHAVES
--
--   · Step 1 FAILS THE MIGRATION if any existing row already violates a
--     constraint. It does not report and continue. The runner wraps each file in
--     one transaction, so a failure here leaves the database exactly as it was
--     and 009 is not recorded as applied.
--   · Steps 2 and 3 add every constraint NOT VALID, so the catalog change does
--     not scan the tables while holding its lock.
--   · Step 4 VALIDATEs all of them, as executable SQL. 009 therefore cannot be
--     recorded as applied while any of its constraints is still unvalidated —
--     an unvalidated constraint is a promise about future rows only, and a
--     migration that claimed to enforce a rule it had not checked would be
--     worse than no migration.
--
-- One honest note on the NOT VALID / VALIDATE split: its usual benefit is that
-- VALIDATE takes only SHARE UPDATE EXCLUSIVE, so writes continue during the
-- scan. Inside a single transaction the earlier ADD CONSTRAINT lock is held to
-- commit anyway, so that benefit is reduced here. The ordering is kept because
-- the correctness property — validated before recorded — is the one that
-- matters, and because it is the shape the rest of this migration set uses.
-- =============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 1 — preflight. Fails the migration on any pre-existing violation.
--
-- A violation is not a reason to skip the constraint. It is a bug that has
-- already written bad data, and you want to know which one, and what it wrote,
-- before you stop it happening again.
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  rec        record;
  violations text := '';
  total      bigint := 0;
BEGIN
  FOR rec IN
    SELECT 'books.price < 0'                          AS check_name, count(*) AS n FROM books                       WHERE price < 0
    UNION ALL SELECT 'books.stock_quantity < 0',                     count(*) FROM books                            WHERE stock_quantity < 0
    UNION ALL SELECT 'books.reorder_quantity < 0',                   count(*) FROM books                            WHERE reorder_quantity < 0
    UNION ALL SELECT 'books.low_stock_threshold < 0',                count(*) FROM books                            WHERE low_stock_threshold < 0
    UNION ALL SELECT 'book_level_items.quantity < 1',                count(*) FROM book_level_items                 WHERE quantity < 1
    UNION ALL SELECT 'child_book_baskets.total_amount < 0',          count(*) FROM child_book_baskets               WHERE total_amount < 0
    UNION ALL SELECT 'basket_items.quantity < 1',                    count(*) FROM basket_items                     WHERE quantity < 1
    UNION ALL SELECT 'basket_items.unit_price < 0',                  count(*) FROM basket_items                     WHERE unit_price < 0
    UNION ALL SELECT 'basket_items.total_price < 0',                 count(*) FROM basket_items                     WHERE total_price < 0
    UNION ALL SELECT 'book_payments.total_amount < 0',               count(*) FROM book_payments                    WHERE total_amount < 0
    UNION ALL SELECT 'provider_payments.amount < 0',                 count(*) FROM provider_payments                WHERE amount < 0
    UNION ALL SELECT 'provider_payments.amount_refunded < 0',        count(*) FROM provider_payments                WHERE amount_refunded < 0
    UNION ALL SELECT 'book_inventory_transactions.new_quantity < 0', count(*) FROM book_inventory_transactions      WHERE new_quantity < 0
    UNION ALL SELECT 'extra_copy_requests.quantity < 1',             count(*) FROM extra_copy_requests              WHERE quantity < 1
  LOOP
    IF rec.n > 0 THEN
      violations := violations || format('%s  →  %s row(s)%s', rec.check_name, rec.n, chr(10));
      total := total + rec.n;
    END IF;
  END LOOP;

  IF total > 0 THEN
    RAISE EXCEPTION
      E'Migration 009 refused: % existing row(s) already violate the constraints it adds.\n\n%\nNothing has been changed. Find how these rows were written before repairing them — a negative price or a negative stock figure is a symptom, and the constraint alone will not tell you which code path produced it. The queries above, run individually, will show you the rows.',
      total, violations
      USING ERRCODE = 'check_violation';
  END IF;

  RAISE NOTICE 'Migration 009 preflight: no existing violations.';
END $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 2 — money is never negative
--
-- A refund is not a negative price. It is a separate, recorded event against a
-- positive amount — `provider_payments.amount_refunded`, itself non-negative.
-- Allowing a negative figure anywhere in this set would let a refund be modelled
-- as arithmetic instead of as a fact, which is how revenue reports start
-- disagreeing with the bank.
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'books_price_non_negative') THEN
    ALTER TABLE books ADD CONSTRAINT books_price_non_negative CHECK (price >= 0) NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'child_book_baskets_total_non_negative') THEN
    ALTER TABLE child_book_baskets ADD CONSTRAINT child_book_baskets_total_non_negative
      CHECK (total_amount IS NULL OR total_amount >= 0) NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'basket_items_unit_price_non_negative') THEN
    ALTER TABLE basket_items ADD CONSTRAINT basket_items_unit_price_non_negative CHECK (unit_price >= 0) NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'basket_items_total_price_non_negative') THEN
    ALTER TABLE basket_items ADD CONSTRAINT basket_items_total_price_non_negative CHECK (total_price >= 0) NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'book_payments_total_non_negative') THEN
    ALTER TABLE book_payments ADD CONSTRAINT book_payments_total_non_negative CHECK (total_amount >= 0) NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'provider_payments_amount_non_negative') THEN
    ALTER TABLE provider_payments ADD CONSTRAINT provider_payments_amount_non_negative CHECK (amount >= 0) NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'provider_payments_refund_non_negative') THEN
    ALTER TABLE provider_payments ADD CONSTRAINT provider_payments_refund_non_negative
      CHECK (amount_refunded IS NULL OR amount_refunded >= 0) NOT VALID;
  END IF;
END $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 3 — stock is never negative, and a line is never for zero books
--
-- `book_inventory_transactions.quantity` is deliberately NOT constrained. It is
-- a SIGNED LEDGER DELTA: a deduction is legitimately negative, and forcing it
-- non-negative would either break stock deduction or push the sign into a
-- separate column and make the ledger ambiguous. What must never go below zero
-- is the RESULTING quantity, which is constrained below.
--
-- `low_stock_threshold` is included: it is the figure the low-stock report and
-- the reorder alerts compare against, so a negative value silently disables the
-- warning for that book rather than producing a visible error.
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'books_stock_non_negative') THEN
    ALTER TABLE books ADD CONSTRAINT books_stock_non_negative
      CHECK (stock_quantity IS NULL OR stock_quantity >= 0) NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'books_reorder_qty_non_negative') THEN
    ALTER TABLE books ADD CONSTRAINT books_reorder_qty_non_negative
      CHECK (reorder_quantity IS NULL OR reorder_quantity >= 0) NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'books_low_stock_threshold_non_negative') THEN
    ALTER TABLE books ADD CONSTRAINT books_low_stock_threshold_non_negative
      CHECK (low_stock_threshold IS NULL OR low_stock_threshold >= 0) NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'book_inventory_transactions_new_qty_non_negative') THEN
    ALTER TABLE book_inventory_transactions ADD CONSTRAINT book_inventory_transactions_new_qty_non_negative
      CHECK (new_quantity >= 0) NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'basket_items_quantity_positive') THEN
    ALTER TABLE basket_items ADD CONSTRAINT basket_items_quantity_positive
      CHECK (quantity IS NULL OR quantity >= 1) NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'book_level_items_quantity_positive') THEN
    ALTER TABLE book_level_items ADD CONSTRAINT book_level_items_quantity_positive
      CHECK (quantity IS NULL OR quantity >= 1) NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'extra_copy_requests_quantity_positive') THEN
    ALTER TABLE extra_copy_requests ADD CONSTRAINT extra_copy_requests_quantity_positive
      CHECK (quantity >= 1) NOT VALID;
  END IF;
END $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 4 — validate every constraint this migration added.
--
-- Executable, not commented out. Step 1 has already proved there is nothing to
-- find, so these scans confirm rather than discover — but they are what turns
-- each constraint from "applies to future rows" into "is true of this table".
--
-- VALIDATE is idempotent: validating an already-validated constraint is a no-op.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE books                       VALIDATE CONSTRAINT books_price_non_negative;
ALTER TABLE books                       VALIDATE CONSTRAINT books_stock_non_negative;
ALTER TABLE books                       VALIDATE CONSTRAINT books_reorder_qty_non_negative;
ALTER TABLE books                       VALIDATE CONSTRAINT books_low_stock_threshold_non_negative;
ALTER TABLE child_book_baskets          VALIDATE CONSTRAINT child_book_baskets_total_non_negative;
ALTER TABLE basket_items                VALIDATE CONSTRAINT basket_items_unit_price_non_negative;
ALTER TABLE basket_items                VALIDATE CONSTRAINT basket_items_total_price_non_negative;
ALTER TABLE basket_items                VALIDATE CONSTRAINT basket_items_quantity_positive;
ALTER TABLE book_payments               VALIDATE CONSTRAINT book_payments_total_non_negative;
ALTER TABLE provider_payments           VALIDATE CONSTRAINT provider_payments_amount_non_negative;
ALTER TABLE provider_payments           VALIDATE CONSTRAINT provider_payments_refund_non_negative;
ALTER TABLE book_inventory_transactions VALIDATE CONSTRAINT book_inventory_transactions_new_qty_non_negative;
ALTER TABLE book_level_items            VALIDATE CONSTRAINT book_level_items_quantity_positive;
ALTER TABLE extra_copy_requests         VALIDATE CONSTRAINT extra_copy_requests_quantity_positive;


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 5 — prove it. Fails the migration if any constraint is missing or
-- unvalidated, so 009 cannot be recorded as applied on a half-done job.
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  expected text[] := ARRAY[
    'books_price_non_negative',
    'books_stock_non_negative',
    'books_reorder_qty_non_negative',
    'books_low_stock_threshold_non_negative',
    'child_book_baskets_total_non_negative',
    'basket_items_unit_price_non_negative',
    'basket_items_total_price_non_negative',
    'basket_items_quantity_positive',
    'book_payments_total_non_negative',
    'provider_payments_amount_non_negative',
    'provider_payments_refund_non_negative',
    'book_inventory_transactions_new_qty_non_negative',
    'book_level_items_quantity_positive',
    'extra_copy_requests_quantity_positive'
  ];
  cname   text;
  missing text := '';
BEGIN
  FOREACH cname IN ARRAY expected LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = cname AND contype = 'c' AND convalidated
    ) THEN
      missing := missing || cname || chr(10);
    END IF;
  END LOOP;

  IF missing <> '' THEN
    RAISE EXCEPTION E'Migration 009 refused: constraint(s) missing or unvalidated:\n%', missing;
  END IF;

  RAISE NOTICE 'Migration 009: 14 check constraints present and validated.';
END $$;
