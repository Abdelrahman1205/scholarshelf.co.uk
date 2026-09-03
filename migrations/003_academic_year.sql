-- =============================================================================
-- 003 - academic year + class snapshot columns
-- =============================================================================
--
-- PURPOSE
--   Add immutable history fields so allocations, baskets and payments can record
--   their academic-year context at WRITE TIME rather than reconstructing history
--   later from a student's mutable current class.
--
-- IMPORTANT
--   This migration is intentionally SCHEMA-ONLY.
--
--   Historical academic-year/class values are NOT reconstructed here because:
--
--   1. A student's current class may not be the class they belonged to when an
--      historical allocation was created.
--
--   2. Allocation runtime logic deliberately prefers classes.academic_year over
--      the wall-clock date. A timestamp-only backfill can therefore write a
--      confidently incorrect academic year.
--
--   3. Test/integration suites may seed book_payments directly and legitimately
--      leave academic_year NULL because they bypass the production creation path.
--
--   Unknown historical facts must remain NULL rather than being guessed.
--
--   New production rows are responsible for stamping their history context in
--   application code.
-- =============================================================================

ALTER TABLE finance_book_allocations
  ADD COLUMN IF NOT EXISTS academic_year            text,
  ADD COLUMN IF NOT EXISTS class_id_at_allocation   varchar(36),
  ADD COLUMN IF NOT EXISTS class_name_at_allocation text,
  ADD COLUMN IF NOT EXISTS year_group_at_allocation text;

ALTER TABLE child_book_baskets
  ADD COLUMN IF NOT EXISTS academic_year text;

ALTER TABLE book_payments
  ADD COLUMN IF NOT EXISTS academic_year text;

-- Reporting indexes may be added later as a separate migration after query
-- patterns and production table sizes justify them.
--
-- Do not reconstruct historical class/year values from mutable current records.