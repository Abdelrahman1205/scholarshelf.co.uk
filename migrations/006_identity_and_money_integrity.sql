-- ============================================================================
-- 006 — identity and money-path integrity
--
-- Closes the database half of four findings from the 22 August restructuring
-- report. The application half of each lives in server/; both are needed. Every
-- statement is idempotent, so re-running this file is safe.
--
--   S3  users.email is neither unique nor verified, and parent identity is that
--       email string. Two accounts on one address means the second inherits the
--       first one's children.
--   D5  An order can be paid twice: basket_payments has no unique constraint on
--       basket_id, and a parent-typed payment reference has none either.
--   D6  Every status column is bare TEXT and the values have already drifted —
--       the code writes three statuses that PAYMENT_STATUSES does not declare.
--
-- BEFORE YOU RUN THIS, on production:
--   The pre-flight block below aborts with a clear message if the data cannot
--   satisfy a constraint, rather than half-applying. If it raises, resolve the
--   duplicates it names and run it again.
-- ============================================================================

BEGIN;

-- ── Pre-flight: refuse to run against data that cannot satisfy the constraints
DO $$
DECLARE
  dup_emails   INTEGER;
  dup_baskets  INTEGER;
BEGIN
  SELECT COUNT(*) INTO dup_emails FROM (
    SELECT lower(btrim(email)) AS e
    FROM users
    WHERE email IS NOT NULL AND btrim(email) <> ''
    GROUP BY 1 HAVING COUNT(*) > 1
  ) d;
  IF dup_emails > 0 THEN
    RAISE EXCEPTION
      'Cannot add the unique email index: % email address(es) are used by more than one account. '
      'Run:  SELECT lower(btrim(email)), count(*), array_agg(id) FROM users WHERE email IS NOT NULL '
      'GROUP BY 1 HAVING count(*) > 1;  and merge or remove the duplicates first.', dup_emails;
  END IF;

  SELECT COUNT(*) INTO dup_baskets FROM (
    SELECT basket_id FROM basket_payments GROUP BY 1 HAVING COUNT(*) > 1
  ) d;
  IF dup_baskets > 0 THEN
    RAISE EXCEPTION
      'Cannot add the unique basket_payments index: % basket(s) have more than one payment row — '
      'i.e. they were charged twice. Reconcile those before adding the constraint.', dup_baskets;
  END IF;

END $$;

-- ── S3 · one email, one account ─────────────────────────────────────────────
-- Case- and whitespace-insensitive, because "A@x.com " and "a@x.com" are the
-- same person to everyone except a naive string comparison. Partial, so the
-- many accounts with no email at all do not collide with each other.
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_unique_idx
  ON users (lower(btrim(email)))
  WHERE email IS NOT NULL AND btrim(email) <> '';

-- Parent links are matched on this column; without an index every parent portal
-- load is a sequential scan, and it is the column S3 turns on.
CREATE INDEX IF NOT EXISTS parent_children_identifier_lower_idx
  ON parent_children (lower(btrim(parent_identifier)));

-- ── D5 · an order cannot be paid twice ──────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS basket_payments_basket_id_unique_idx
  ON basket_payments (basket_id);

-- A parent types their bank reference by hand. Two orders quoting the same
-- reference cannot both be reconciled against one bank line, so the duplicate
-- must be refused at write time rather than discovered at settlement.
CREATE UNIQUE INDEX IF NOT EXISTS book_payments_school_reference_unique_idx
  ON book_payments (school_id, upper(btrim(payment_reference_number)))
  WHERE payment_reference_number IS NOT NULL AND btrim(payment_reference_number) <> '';

-- ── D6 · statuses that Postgres will actually enforce ───────────────────────
-- Every status column is bare TEXT, and the declared constants and the written
-- values drifted apart long ago: PAYMENT_STATUSES names five values while the
-- code writes 'ready_for_collection', 'collected' and 'cancelled'; the
-- distribution constants and the written values share almost nothing.
--
-- Rather than guess a set and risk rejecting rows production writes today, each
-- constraint below is built from the DECLARED set UNION the values actually
-- present in the table. That stops all FURTHER drift — a typo at a new call site
-- now fails loudly instead of producing a row every filter silently misses —
-- without breaking a single existing write path.
--
-- Any observed value that was not declared is raised as a NOTICE. Those are the
-- ones worth reconciling in shared/schema.ts; once the constants and the data
-- agree, the constraint can be tightened by hand.
DO $$
DECLARE
  spec        RECORD;
  observed    TEXT[];
  undeclared  TEXT[];
  allowed     TEXT[];
BEGIN
  FOR spec IN
    SELECT * FROM (VALUES
      -- Sets below are what the CODE ACTUALLY WRITES, verified against the
      -- source, not what the constants claimed. finance_book_allocations has
      -- TWO status columns and they mean different things: `status` is the
      -- allocation lifecycle, `distribution_status` is the teacher's hand-over.
      ('book_payments',            'status',              ARRAY['awaiting_reference','reference_submitted','needs_review','confirmed','rejected','ready_for_collection','collected','cancelled']),
      ('finance_book_allocations', 'status',              ARRAY['allocated','received','absent','cancelled']),
      ('finance_book_allocations', 'distribution_status', ARRAY['pending_distribution','received_by_student','student_absent','issue_reported','out_of_stock']),
      ('finance_book_allocations', 'custody_status',      ARRAY['reserved','prepared','handed_to_teacher','issued','collected','absent','returned','damaged','lost']),
      ('schools',                  'status',              ARRAY['active','pending_setup','suspended','archived','pending_deletion','deleted']),
      ('users',                    'status',              ARRAY['active','invited','disabled','locked','pending','inactive','suspended'])
    ) AS t(tbl, col, declared)
  LOOP
    CONTINUE WHEN NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = spec.tbl AND column_name = spec.col
    );
    CONTINUE WHEN EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = spec.tbl || '_' || spec.col || '_check'
    );

    EXECUTE format(
      'SELECT coalesce(array_agg(DISTINCT %I), ARRAY[]::text[]) FROM %I WHERE %I IS NOT NULL',
      spec.col, spec.tbl, spec.col
    ) INTO observed;

    SELECT coalesce(array_agg(v), ARRAY[]::text[]) INTO undeclared
      FROM unnest(observed) AS v WHERE NOT (v = ANY(spec.declared));

    IF array_length(undeclared, 1) > 0 THEN
      RAISE NOTICE
        '% .%: allowing % undeclared value(s) already in the data: %. Reconcile these in shared/schema.ts, then tighten the constraint.',
        spec.tbl, spec.col, array_length(undeclared, 1), undeclared;
    END IF;

    SELECT array_agg(DISTINCT v) INTO allowed
      FROM unnest(spec.declared || observed) AS v;

    EXECUTE format(
      'ALTER TABLE %I ADD CONSTRAINT %I CHECK (%I = ANY (%L::text[]))',
      spec.tbl, spec.tbl || '_' || spec.col || '_check', spec.col, allowed
    );
    RAISE NOTICE 'constrained % .% to % value(s)', spec.tbl, spec.col, array_length(allowed, 1);
  END LOOP;
END $$;

COMMIT;
