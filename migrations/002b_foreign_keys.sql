-- =============================================================================
-- 002b — foreign keys on school_id
-- =============================================================================
-- PROJECT_MASTER.md states: "Every tenant table carries schoolId (FK -> schools,
-- cascade on delete)." That was true of 3 tables out of 26.
--
-- Two consequences of the other 23:
--   1. Nothing in the database stops a row pointing at a school that does not
--      exist, or at ANOTHER tenant's school. Tenant isolation had no backstop
--      below the application layer.
--   2. Without ON DELETE CASCADE, deleting a school cannot rely on the database.
--      deleteSchoolAndRelatedData has to hand-delete 23 tables in the right
--      order, and anything it misses leaves children's personal data behind
--      after the school is gone — a UK GDPR Art. 17 erasure failure that nobody
--      would notice.
--
-- RUN 002a FIRST. Adding a FK without an index on the child column makes every
-- cascade check a sequential scan.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 1 — orphan check. RUN THIS FIRST AND READ THE OUTPUT.
-- Any table reporting orphans > 0 will REJECT its constraint in step 2.
-- Decide deliberately: repoint those rows at the right school, or delete them.
-- Do not skip this and let step 2 fail halfway.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT 'users' AS table_name, count(*) AS orphans FROM users t WHERE t.school_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM schools s WHERE s.id = t.school_id)
UNION ALL
SELECT 'invites' AS table_name, count(*) AS orphans FROM invites t WHERE t.school_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM schools s WHERE s.id = t.school_id)
UNION ALL
SELECT 'classes' AS table_name, count(*) AS orphans FROM classes t WHERE t.school_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM schools s WHERE s.id = t.school_id)
UNION ALL
SELECT 'subjects' AS table_name, count(*) AS orphans FROM subjects t WHERE t.school_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM schools s WHERE s.id = t.school_id)
UNION ALL
SELECT 'class_teacher_assignments' AS table_name, count(*) AS orphans FROM class_teacher_assignments t WHERE t.school_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM schools s WHERE s.id = t.school_id)
UNION ALL
SELECT 'students' AS table_name, count(*) AS orphans FROM students t WHERE t.school_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM schools s WHERE s.id = t.school_id)
UNION ALL
SELECT 'books' AS table_name, count(*) AS orphans FROM books t WHERE t.school_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM schools s WHERE s.id = t.school_id)
UNION ALL
SELECT 'book_copies' AS table_name, count(*) AS orphans FROM book_copies t WHERE t.school_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM schools s WHERE s.id = t.school_id)
UNION ALL
SELECT 'book_levels' AS table_name, count(*) AS orphans FROM book_levels t WHERE t.school_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM schools s WHERE s.id = t.school_id)
UNION ALL
SELECT 'student_book_levels' AS table_name, count(*) AS orphans FROM student_book_levels t WHERE t.school_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM schools s WHERE s.id = t.school_id)
UNION ALL
SELECT 'families' AS table_name, count(*) AS orphans FROM families t WHERE t.school_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM schools s WHERE s.id = t.school_id)
UNION ALL
SELECT 'guardians' AS table_name, count(*) AS orphans FROM guardians t WHERE t.school_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM schools s WHERE s.id = t.school_id)
UNION ALL
SELECT 'child_linking_codes' AS table_name, count(*) AS orphans FROM child_linking_codes t WHERE t.school_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM schools s WHERE s.id = t.school_id)
UNION ALL
SELECT 'parent_children' AS table_name, count(*) AS orphans FROM parent_children t WHERE t.school_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM schools s WHERE s.id = t.school_id)
UNION ALL
SELECT 'teacher_profiles' AS table_name, count(*) AS orphans FROM teacher_profiles t WHERE t.school_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM schools s WHERE s.id = t.school_id)
UNION ALL
SELECT 'child_book_baskets' AS table_name, count(*) AS orphans FROM child_book_baskets t WHERE t.school_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM schools s WHERE s.id = t.school_id)
UNION ALL
SELECT 'book_payments' AS table_name, count(*) AS orphans FROM book_payments t WHERE t.school_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM schools s WHERE s.id = t.school_id)
UNION ALL
SELECT 'finance_book_allocations' AS table_name, count(*) AS orphans FROM finance_book_allocations t WHERE t.school_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM schools s WHERE s.id = t.school_id)
UNION ALL
SELECT 'custody_events' AS table_name, count(*) AS orphans FROM custody_events t WHERE t.school_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM schools s WHERE s.id = t.school_id)
UNION ALL
SELECT 'extra_copy_requests' AS table_name, count(*) AS orphans FROM extra_copy_requests t WHERE t.school_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM schools s WHERE s.id = t.school_id)
UNION ALL
SELECT 'message_threads' AS table_name, count(*) AS orphans FROM message_threads t WHERE t.school_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM schools s WHERE s.id = t.school_id)
UNION ALL
SELECT 'messages' AS table_name, count(*) AS orphans FROM messages t WHERE t.school_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM schools s WHERE s.id = t.school_id)
UNION ALL
SELECT 'message_audit_logs' AS table_name, count(*) AS orphans FROM message_audit_logs t WHERE t.school_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM schools s WHERE s.id = t.school_id)
ORDER BY orphans DESC, table_name;


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 2 — add the constraints as NOT VALID.
-- NOT VALID takes only a brief lock and does not scan existing rows, so this is
-- safe on a live table. New and updated rows are enforced immediately.
-- ─────────────────────────────────────────────────────────────────────────────
BEGIN;

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_school_id_fkey;
ALTER TABLE users ADD CONSTRAINT users_school_id_fkey
  FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE invites DROP CONSTRAINT IF EXISTS invites_school_id_fkey;
ALTER TABLE invites ADD CONSTRAINT invites_school_id_fkey
  FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE classes DROP CONSTRAINT IF EXISTS classes_school_id_fkey;
ALTER TABLE classes ADD CONSTRAINT classes_school_id_fkey
  FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE subjects DROP CONSTRAINT IF EXISTS subjects_school_id_fkey;
ALTER TABLE subjects ADD CONSTRAINT subjects_school_id_fkey
  FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE class_teacher_assignments DROP CONSTRAINT IF EXISTS class_teacher_assignments_school_id_fkey;
ALTER TABLE class_teacher_assignments ADD CONSTRAINT class_teacher_assignments_school_id_fkey
  FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE students DROP CONSTRAINT IF EXISTS students_school_id_fkey;
ALTER TABLE students ADD CONSTRAINT students_school_id_fkey
  FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE books DROP CONSTRAINT IF EXISTS books_school_id_fkey;
ALTER TABLE books ADD CONSTRAINT books_school_id_fkey
  FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE book_copies DROP CONSTRAINT IF EXISTS book_copies_school_id_fkey;
ALTER TABLE book_copies ADD CONSTRAINT book_copies_school_id_fkey
  FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE book_levels DROP CONSTRAINT IF EXISTS book_levels_school_id_fkey;
ALTER TABLE book_levels ADD CONSTRAINT book_levels_school_id_fkey
  FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE student_book_levels DROP CONSTRAINT IF EXISTS student_book_levels_school_id_fkey;
ALTER TABLE student_book_levels ADD CONSTRAINT student_book_levels_school_id_fkey
  FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE families DROP CONSTRAINT IF EXISTS families_school_id_fkey;
ALTER TABLE families ADD CONSTRAINT families_school_id_fkey
  FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE guardians DROP CONSTRAINT IF EXISTS guardians_school_id_fkey;
ALTER TABLE guardians ADD CONSTRAINT guardians_school_id_fkey
  FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE child_linking_codes DROP CONSTRAINT IF EXISTS child_linking_codes_school_id_fkey;
ALTER TABLE child_linking_codes ADD CONSTRAINT child_linking_codes_school_id_fkey
  FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE parent_children DROP CONSTRAINT IF EXISTS parent_children_school_id_fkey;
ALTER TABLE parent_children ADD CONSTRAINT parent_children_school_id_fkey
  FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE teacher_profiles DROP CONSTRAINT IF EXISTS teacher_profiles_school_id_fkey;
ALTER TABLE teacher_profiles ADD CONSTRAINT teacher_profiles_school_id_fkey
  FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE child_book_baskets DROP CONSTRAINT IF EXISTS child_book_baskets_school_id_fkey;
ALTER TABLE child_book_baskets ADD CONSTRAINT child_book_baskets_school_id_fkey
  FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE book_payments DROP CONSTRAINT IF EXISTS book_payments_school_id_fkey;
ALTER TABLE book_payments ADD CONSTRAINT book_payments_school_id_fkey
  FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE finance_book_allocations DROP CONSTRAINT IF EXISTS finance_book_allocations_school_id_fkey;
ALTER TABLE finance_book_allocations ADD CONSTRAINT finance_book_allocations_school_id_fkey
  FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE custody_events DROP CONSTRAINT IF EXISTS custody_events_school_id_fkey;
ALTER TABLE custody_events ADD CONSTRAINT custody_events_school_id_fkey
  FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE extra_copy_requests DROP CONSTRAINT IF EXISTS extra_copy_requests_school_id_fkey;
ALTER TABLE extra_copy_requests ADD CONSTRAINT extra_copy_requests_school_id_fkey
  FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE message_threads DROP CONSTRAINT IF EXISTS message_threads_school_id_fkey;
ALTER TABLE message_threads ADD CONSTRAINT message_threads_school_id_fkey
  FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_school_id_fkey;
ALTER TABLE messages ADD CONSTRAINT messages_school_id_fkey
  FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE message_audit_logs DROP CONSTRAINT IF EXISTS message_audit_logs_school_id_fkey;
ALTER TABLE message_audit_logs ADD CONSTRAINT message_audit_logs_school_id_fkey
  FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE NOT VALID;
COMMIT;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 3 — validate. Scans existing rows under a SHARE UPDATE EXCLUSIVE lock,
-- which still allows reads and writes. Run these one at a time; if one fails,
-- that table has orphans step 1 should have caught.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE users VALIDATE CONSTRAINT users_school_id_fkey;
ALTER TABLE invites VALIDATE CONSTRAINT invites_school_id_fkey;
ALTER TABLE classes VALIDATE CONSTRAINT classes_school_id_fkey;
ALTER TABLE subjects VALIDATE CONSTRAINT subjects_school_id_fkey;
ALTER TABLE class_teacher_assignments VALIDATE CONSTRAINT class_teacher_assignments_school_id_fkey;
ALTER TABLE students VALIDATE CONSTRAINT students_school_id_fkey;
ALTER TABLE books VALIDATE CONSTRAINT books_school_id_fkey;
ALTER TABLE book_copies VALIDATE CONSTRAINT book_copies_school_id_fkey;
ALTER TABLE book_levels VALIDATE CONSTRAINT book_levels_school_id_fkey;
ALTER TABLE student_book_levels VALIDATE CONSTRAINT student_book_levels_school_id_fkey;
ALTER TABLE families VALIDATE CONSTRAINT families_school_id_fkey;
ALTER TABLE guardians VALIDATE CONSTRAINT guardians_school_id_fkey;
ALTER TABLE child_linking_codes VALIDATE CONSTRAINT child_linking_codes_school_id_fkey;
ALTER TABLE parent_children VALIDATE CONSTRAINT parent_children_school_id_fkey;
ALTER TABLE teacher_profiles VALIDATE CONSTRAINT teacher_profiles_school_id_fkey;
ALTER TABLE child_book_baskets VALIDATE CONSTRAINT child_book_baskets_school_id_fkey;
ALTER TABLE book_payments VALIDATE CONSTRAINT book_payments_school_id_fkey;
ALTER TABLE finance_book_allocations VALIDATE CONSTRAINT finance_book_allocations_school_id_fkey;
ALTER TABLE custody_events VALIDATE CONSTRAINT custody_events_school_id_fkey;
ALTER TABLE extra_copy_requests VALIDATE CONSTRAINT extra_copy_requests_school_id_fkey;
ALTER TABLE message_threads VALIDATE CONSTRAINT message_threads_school_id_fkey;
ALTER TABLE messages VALIDATE CONSTRAINT messages_school_id_fkey;
ALTER TABLE message_audit_logs VALIDATE CONSTRAINT message_audit_logs_school_id_fkey;

-- Verify: all 26 should now be present and convalidated = true
--   SELECT conrelid::regclass AS table_name, convalidated
--   FROM pg_constraint
--   WHERE conname LIKE '%_school_id_fkey'
--   ORDER BY 1;
