-- =============================================================================
-- 006 — webhook replay protection + payment integrity
-- =============================================================================
-- Written 2 September 2026 against the Legal & Compliance directive, domain 3
-- (Financial & Payments, CRITICAL):
--
--   · "Webhooks lack replay and event-ID protection."
--   · "Reusable Stripe transaction IDs across orders."
--   · "Cross-school basket mixing permitted."
--
-- RUN 002a AND 002b FIRST. This migration assumes the school_id indexes and
-- foreign keys are in place.
--
-- Every step is idempotent: run it twice and the second run does nothing.
-- =============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 1 — preflight. RUN THIS FIRST AND READ THE OUTPUT.
--
-- Steps 3 and 4 create UNIQUE indexes. If the data already violates them the
-- CREATE fails and you are left mid-migration. Look at the counts, decide what
-- the duplicates mean, and resolve them deliberately.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT 'book_payments with a duplicate external_payment_id' AS check_name,
       count(*) AS offending_groups
FROM (
  SELECT external_payment_id
  FROM book_payments
  WHERE external_payment_id IS NOT NULL AND btrim(external_payment_id) <> ''
  GROUP BY external_payment_id
  HAVING count(*) > 1
) d
UNION ALL
SELECT 'basket_payments linking a basket to a payment in another school',
       count(*)
FROM basket_payments bp
JOIN child_book_baskets b ON b.id = bp.basket_id
JOIN book_payments p      ON p.id = bp.payment_id
WHERE b.school_id IS DISTINCT FROM p.school_id
UNION ALL
SELECT 'basket_items pointing at a book from another school',
       count(*)
FROM basket_items bi
JOIN child_book_baskets b ON b.id = bi.basket_id
JOIN books bk             ON bk.id = bi.book_id
WHERE b.school_id IS DISTINCT FROM bk.school_id;

-- A non-zero count on either of the last two is a live cross-tenant data defect.
-- Do not "fix" it by relaxing the constraint. Find out how those rows were
-- created before you delete or repoint anything.


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 2 — webhook deliveries
--
-- One row per (source, event_id). The handler inserts BEFORE doing any work,
-- with ON CONFLICT DO NOTHING; winning the insert means you own the delivery.
-- Same shape and same reasoning as cron_job_runs in 004.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS webhook_events (
  id           varchar(36) PRIMARY KEY,
  source       text NOT NULL,
  event_id     text NOT NULL,
  status       text NOT NULL DEFAULT 'processing',
  detail       text,
  received_at  timestamp DEFAULT now(),
  completed_at timestamp
);

CREATE UNIQUE INDEX IF NOT EXISTS webhook_events_source_event_unique
  ON webhook_events (source, event_id);

CREATE INDEX IF NOT EXISTS webhook_events_received_at_idx
  ON webhook_events (received_at DESC);

-- Housekeeping: a delivery older than the provider's retry window can go.
--   DELETE FROM webhook_events WHERE received_at < now() - interval '90 days';


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 3 — one provider transaction settles one order
--
-- `external_payment_id` is the provider's own transaction id. Nothing stopped
-- the same id being written against several orders, which is how one real
-- payment ends up marked as settling three families' books.
--
-- Partial index: rows with no external id (the bank-transfer path, which is most
-- of them today) are unaffected.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS book_payments_external_payment_id_unique
  ON book_payments (external_payment_id)
  WHERE external_payment_id IS NOT NULL AND btrim(external_payment_id) <> '';


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 4 — a basket and its payment belong to the same school
--
-- basket_payments joins one payment to several baskets. Both sides carry a
-- school_id and nothing compared them, so a payment in school A could be linked
-- to a basket in school B — the "cross-school basket mixing" finding.
--
-- The fix is a composite foreign key: instead of referencing the parent's id
-- alone, reference (id, school_id) together. The child then cannot name a parent
-- in a different tenant, because the pair would not exist. This is what the
-- directive means by "strict composite school_id foreign keys", and unlike RLS
-- it needs no application change.
--
-- 4a. The parents need a unique key on (id, school_id) for the composite FK to
--     reference. `id` is already unique, so this adds no real constraint — it
--     only gives the FK something to point at.
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'child_book_baskets_id_school_id_key') THEN
    ALTER TABLE child_book_baskets ADD CONSTRAINT child_book_baskets_id_school_id_key UNIQUE (id, school_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'book_payments_id_school_id_key') THEN
    ALTER TABLE book_payments ADD CONSTRAINT book_payments_id_school_id_key UNIQUE (id, school_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'books_id_school_id_key') THEN
    ALTER TABLE books ADD CONSTRAINT books_id_school_id_key UNIQUE (id, school_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'students_id_school_id_key') THEN
    ALTER TABLE students ADD CONSTRAINT students_id_school_id_key UNIQUE (id, school_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'classes_id_school_id_key') THEN
    ALTER TABLE classes ADD CONSTRAINT classes_id_school_id_key UNIQUE (id, school_id);
  END IF;
END $$;

-- 4b. basket_payments carries no school_id of its own, so it cannot hold a
--     composite FK directly. Give it one, backfill it from the payment, and then
--     constrain BOTH sides against it — which is exactly the statement "this
--     link, this basket and this payment are all one school".
ALTER TABLE basket_payments ADD COLUMN IF NOT EXISTS school_id varchar(36);

UPDATE basket_payments bp
SET school_id = p.school_id
FROM book_payments p
WHERE p.id = bp.payment_id
  AND bp.school_id IS DISTINCT FROM p.school_id;

CREATE INDEX IF NOT EXISTS basket_payments_school_id_idx ON basket_payments (school_id);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'basket_payments_payment_school_fkey') THEN
    ALTER TABLE basket_payments
      ADD CONSTRAINT basket_payments_payment_school_fkey
      FOREIGN KEY (payment_id, school_id) REFERENCES book_payments (id, school_id)
      ON DELETE CASCADE NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'basket_payments_basket_school_fkey') THEN
    ALTER TABLE basket_payments
      ADD CONSTRAINT basket_payments_basket_school_fkey
      FOREIGN KEY (basket_id, school_id) REFERENCES child_book_baskets (id, school_id)
      ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

-- NOT VALID above means the constraint applies to new and updated rows
-- immediately without a blocking full-table scan. Validate once the preflight in
-- step 1 reports zero cross-school links:
ALTER TABLE basket_payments VALIDATE CONSTRAINT basket_payments_payment_school_fkey;
ALTER TABLE basket_payments VALIDATE CONSTRAINT basket_payments_basket_school_fkey;


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 5 — an allocation belongs to the same school as its student and its book
--
-- finance_book_allocations already carries school_id (002b gave it a FK to
-- schools). These pin the student and the book to that same school.
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'finance_book_allocations_student_school_fkey') THEN
    ALTER TABLE finance_book_allocations
      ADD CONSTRAINT finance_book_allocations_student_school_fkey
      FOREIGN KEY (student_id, school_id) REFERENCES students (id, school_id)
      NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'finance_book_allocations_book_school_fkey') THEN
    ALTER TABLE finance_book_allocations
      ADD CONSTRAINT finance_book_allocations_book_school_fkey
      FOREIGN KEY (book_id, school_id) REFERENCES books (id, school_id)
      NOT VALID;
  END IF;
END $$;

ALTER TABLE finance_book_allocations VALIDATE CONSTRAINT finance_book_allocations_student_school_fkey;
ALTER TABLE finance_book_allocations VALIDATE CONSTRAINT finance_book_allocations_book_school_fkey;


-- ─────────────────────────────────────────────────────────────────────────────
-- Verify
--   SELECT conname, convalidated FROM pg_constraint
--   WHERE conname LIKE '%_school_fkey' ORDER BY 1;
--   SELECT indexname FROM pg_indexes WHERE indexname IN (
--     'webhook_events_source_event_unique',
--     'book_payments_external_payment_id_unique');
-- ─────────────────────────────────────────────────────────────────────────────
