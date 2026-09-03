-- =============================================================================
-- 002a — index every school_id column
-- =============================================================================
-- school_id is the filter on essentially every query in a multi-tenant app, and
-- it was indexed on almost none of them (7 index declarations across 38 tables).
-- Every tenant-scoped list was a sequential scan across EVERY tenant's rows.
-- Invisible with a single school; at 30 schools x 1,200 pupils it is a full scan
-- of 36,000 rows for each student list, dashboard tile and report — inside a
-- function with a 30-second ceiling.
--
-- Postgres does NOT auto-index foreign key columns, so this is needed whether or
-- not 002b has run.
--
-- HOW TO RUN
--   CREATE INDEX CONCURRENTLY cannot run inside a transaction block. Run these
--   statements ONE AT A TIME, or via psql (which does not wrap them by default).
--   Do NOT paste the whole file into a tool that opens an explicit transaction.
--
--   CONCURRENTLY means no write lock: the table stays fully usable while the
--   index builds. It is slower, and that is the correct trade on a live system.
--
-- If a statement fails, the index is left INVALID. Drop it and re-run just that
-- one:  DROP INDEX CONCURRENTLY IF EXISTS <name>;
-- =============================================================================

CREATE INDEX CONCURRENTLY IF NOT EXISTS users_school_id_idx ON users (school_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS invites_school_id_idx ON invites (school_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS classes_school_id_idx ON classes (school_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS subjects_school_id_idx ON subjects (school_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS class_teacher_assignments_school_id_idx ON class_teacher_assignments (school_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS students_school_id_idx ON students (school_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS books_school_id_idx ON books (school_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS book_copies_school_id_idx ON book_copies (school_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS book_levels_school_id_idx ON book_levels (school_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS student_book_levels_school_id_idx ON student_book_levels (school_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS families_school_id_idx ON families (school_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS guardians_school_id_idx ON guardians (school_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS child_linking_codes_school_id_idx ON child_linking_codes (school_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS parent_children_school_id_idx ON parent_children (school_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS teacher_profiles_school_id_idx ON teacher_profiles (school_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS child_book_baskets_school_id_idx ON child_book_baskets (school_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS book_payments_school_id_idx ON book_payments (school_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS finance_book_allocations_school_id_idx ON finance_book_allocations (school_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS custody_events_school_id_idx ON custody_events (school_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS extra_copy_requests_school_id_idx ON extra_copy_requests (school_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS message_threads_school_id_idx ON message_threads (school_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS messages_school_id_idx ON messages (school_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS message_audit_logs_school_id_idx ON message_audit_logs (school_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS school_branding_school_id_idx ON school_branding (school_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS school_website_sections_school_id_idx ON school_website_sections (school_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS media_assets_school_id_idx ON media_assets (school_id);

-- Composite indexes for the hottest tenant-scoped lookups. A plain school_id
-- index still leaves these sorting or filtering a large slice.
CREATE INDEX CONCURRENTLY IF NOT EXISTS students_school_class_idx ON students (school_id, class_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS book_payments_school_status_idx ON book_payments (school_id, status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS messages_thread_idx ON messages (thread_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS audit_logs_created_idx ON audit_logs (created_at DESC);

-- Verify: every index below should report valid = true
--   SELECT c.relname, i.indisvalid
--   FROM pg_class c JOIN pg_index i ON i.indexrelid = c.oid
--   WHERE c.relname LIKE '%_school_id_idx';
