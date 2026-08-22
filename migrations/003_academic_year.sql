-- =============================================================================
-- 003 — academic year + class snapshot on history rows
-- =============================================================================
-- Additive only. No column is dropped, no row is deleted.
--
-- THE PROBLEM
--   There is no academic year or term in the data model. `academic_year` is free
--   text on `classes`, and a student has one mutable `class_id`. Allocations
--   reach a class ONLY by joining through the student — so when children move up
--   in September and class_id is overwritten, every historical distribution and
--   revenue report silently re-attributes to the class the child is in now.
--   Last year's numbers change and nothing errors.
--
-- THE FIX HERE
--   Stop treating history as a join; record it as a fact. New rows are stamped
--   at write time (server/storage.ts snapshotStudentContext). This migration adds
--   the columns and backfills what can be honestly reconstructed.
--
--   This is NOT the full fix. That is a student_class_enrolments table keyed on
--   (student_id, class_id, academic_year, start, end), with history referencing
--   the enrolment. This buys most of the value for a fraction of the work, and
--   should land before the first customer's second September.
-- =============================================================================

BEGIN;

ALTER TABLE finance_book_allocations
  ADD COLUMN IF NOT EXISTS academic_year            text,
  ADD COLUMN IF NOT EXISTS class_id_at_allocation   varchar(36),
  ADD COLUMN IF NOT EXISTS class_name_at_allocation text,
  ADD COLUMN IF NOT EXISTS year_group_at_allocation text;

ALTER TABLE child_book_baskets ADD COLUMN IF NOT EXISTS academic_year text;
ALTER TABLE book_payments      ADD COLUMN IF NOT EXISTS academic_year text;

COMMIT;

-- ─────────────────────────────────────────────────────────────────────────────
-- BACKFILL
--
-- Read this before running it. For rows written before today there is no record
-- of which class the child was in, so this RECONSTRUCTS from their CURRENT class.
-- That is exactly the flaw the columns exist to fix — but it is the best guess
-- available, and it is strictly better than a NULL because from this point on the
-- value stops moving.
--
-- If your data has already been through a September roll-up, the reconstruction
-- for pre-roll-up rows will be WRONG. In that case leave them NULL (skip this
-- section) rather than recording a confident falsehood, and treat the earlier
-- reports as unattributable.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- Academic year derived from when the allocation actually happened, using the
-- English convention: 1 September starts the new year.
UPDATE finance_book_allocations a
SET academic_year = CASE
      WHEN EXTRACT(MONTH FROM COALESCE(a.allocated_at, now())) >= 9
        THEN EXTRACT(YEAR FROM COALESCE(a.allocated_at, now()))::int
        ELSE EXTRACT(YEAR FROM COALESCE(a.allocated_at, now()))::int - 1
    END || '/' || RIGHT((CASE
      WHEN EXTRACT(MONTH FROM COALESCE(a.allocated_at, now())) >= 9
        THEN EXTRACT(YEAR FROM COALESCE(a.allocated_at, now()))::int + 1
        ELSE EXTRACT(YEAR FROM COALESCE(a.allocated_at, now()))::int
    END)::text, 2)
WHERE a.academic_year IS NULL;

-- Class snapshot reconstructed from the student's CURRENT class. See the caveat
-- above: only sound if no roll-up has happened yet.
UPDATE finance_book_allocations a
SET class_id_at_allocation   = s.class_id,
    class_name_at_allocation = c.name,
    year_group_at_allocation = COALESCE(c.year_group, s.grade_level)
FROM students s
LEFT JOIN classes c ON c.id = s.class_id
WHERE a.student_id = s.id
  AND a.class_id_at_allocation IS NULL;

UPDATE book_payments p
SET academic_year = CASE
      WHEN EXTRACT(MONTH FROM COALESCE(p.paid_at, now())) >= 9
        THEN EXTRACT(YEAR FROM COALESCE(p.paid_at, now()))::int
        ELSE EXTRACT(YEAR FROM COALESCE(p.paid_at, now()))::int - 1
    END || '/' || RIGHT((CASE
      WHEN EXTRACT(MONTH FROM COALESCE(p.paid_at, now())) >= 9
        THEN EXTRACT(YEAR FROM COALESCE(p.paid_at, now()))::int + 1
        ELSE EXTRACT(YEAR FROM COALESCE(p.paid_at, now()))::int
    END)::text, 2)
WHERE p.academic_year IS NULL;

COMMIT;

-- ─────────────────────────────────────────────────────────────────────────────
-- Indexes for year-scoped reporting, which is the whole point of the columns.
-- CONCURRENTLY — run these one at a time, outside a transaction.
-- ─────────────────────────────────────────────────────────────────────────────
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS fba_school_year_idx
--   ON finance_book_allocations (school_id, academic_year);
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS book_payments_school_year_idx
--   ON book_payments (school_id, academic_year);

-- Verify:
--   SELECT academic_year, count(*) FROM finance_book_allocations GROUP BY 1 ORDER BY 1;
--   SELECT count(*) FROM finance_book_allocations WHERE class_name_at_allocation IS NULL;
