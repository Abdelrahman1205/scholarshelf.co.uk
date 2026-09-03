-- =============================================================================
-- 008 — non-nullable tenant columns
-- =============================================================================
-- Legal & Compliance directive, Phase B.1: "enforce non-nullable tenant fields
-- across all tables."
--
-- Why this is its own file: it is the one migration that can legitimately fail.
-- A NULL school_id on a tenant table is a row nobody owns — it belongs to no
-- school, it is filtered out of every school-scoped query, and it sits in the
-- database indefinitely holding a child's personal data that no erasure request
-- will ever find. Making the column NOT NULL is how you stop more being created;
-- the ones already there have to be dealt with first, by a person.
--
-- Each file runs in one transaction, so a failure here rolls back cleanly and
-- leaves 006 and 007 applied.
--
-- IF THIS MIGRATION FAILS: run the preflight below, look at what the orphaned
-- rows are, and repoint or delete them. Do not weaken the constraint.
-- =============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- PREFLIGHT — run this on its own first.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT 'students'                 AS table_name, count(*) AS null_school_id FROM students                 WHERE school_id IS NULL
UNION ALL SELECT 'classes',                      count(*) FROM classes                                    WHERE school_id IS NULL
UNION ALL SELECT 'books',                        count(*) FROM books                                      WHERE school_id IS NULL
UNION ALL SELECT 'book_levels',                  count(*) FROM book_levels                                WHERE school_id IS NULL
UNION ALL SELECT 'families',                     count(*) FROM families                                   WHERE school_id IS NULL
UNION ALL SELECT 'guardians',                    count(*) FROM guardians                                  WHERE school_id IS NULL
UNION ALL SELECT 'child_linking_codes',          count(*) FROM child_linking_codes                        WHERE school_id IS NULL
UNION ALL SELECT 'child_book_baskets',           count(*) FROM child_book_baskets                         WHERE school_id IS NULL
UNION ALL SELECT 'book_payments',                count(*) FROM book_payments                              WHERE school_id IS NULL
UNION ALL SELECT 'basket_payments',              count(*) FROM basket_payments                            WHERE school_id IS NULL
UNION ALL SELECT 'finance_book_allocations',     count(*) FROM finance_book_allocations                   WHERE school_id IS NULL
UNION ALL SELECT 'extra_copy_requests',          count(*) FROM extra_copy_requests                        WHERE school_id IS NULL;


-- ─────────────────────────────────────────────────────────────────────────────
-- Backfill the two that can be derived unambiguously from a parent row.
-- Everything else needs a human: there is no safe way to guess which school a
-- stray student belongs to.
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE basket_payments bp
SET school_id = p.school_id
FROM book_payments p
WHERE p.id = bp.payment_id AND bp.school_id IS NULL AND p.school_id IS NOT NULL;

UPDATE finance_book_allocations a
SET school_id = s.school_id
FROM students s
WHERE s.id = a.student_id AND a.school_id IS NULL AND s.school_id IS NOT NULL;


-- ─────────────────────────────────────────────────────────────────────────────
-- The constraints. These are the tables where a row without a school is
-- meaningless. Deliberately NOT included:
--
--   users     — platform-owner accounts have school_id IS NULL by design
--   invites   — an owner invite to a school admin exists before the school does
--   audit_logs, rate_limits, cron_job_runs, webhook_events — platform-level
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE students                 ALTER COLUMN school_id SET NOT NULL;
ALTER TABLE classes                  ALTER COLUMN school_id SET NOT NULL;
ALTER TABLE books                    ALTER COLUMN school_id SET NOT NULL;
ALTER TABLE book_levels              ALTER COLUMN school_id SET NOT NULL;
ALTER TABLE families                 ALTER COLUMN school_id SET NOT NULL;
ALTER TABLE guardians                ALTER COLUMN school_id SET NOT NULL;
ALTER TABLE child_linking_codes      ALTER COLUMN school_id SET NOT NULL;
ALTER TABLE child_book_baskets       ALTER COLUMN school_id SET NOT NULL;
ALTER TABLE book_payments            ALTER COLUMN school_id SET NOT NULL;
ALTER TABLE basket_payments          ALTER COLUMN school_id SET NOT NULL;
ALTER TABLE finance_book_allocations ALTER COLUMN school_id SET NOT NULL;
ALTER TABLE extra_copy_requests      ALTER COLUMN school_id SET NOT NULL;

-- With school_id NOT NULL on both sides, the composite foreign keys added in 006
-- are fully enforcing: MATCH SIMPLE skips the check when any column of the key is
-- NULL, so until now a NULL school_id on a link row quietly disabled it.

-- ─────────────────────────────────────────────────────────────────────────────
-- KNOWN DRIFT — read before running `drizzle-kit push`
--
-- `shared/schema.ts` still declares most of these columns as nullable. Tightening
-- them there changes their TypeScript type from `string | null` to `string`,
-- which ripples through the storage layer and the routes, and that is a separate
-- change with its own review. Until it is made, `drizzle-kit push` will see the
-- database as "ahead" of the schema and offer to drop these NOT NULLs.
--
-- Do not let it. `db:push` is for local scratch databases; production schema
-- comes from `npm run db:migrate` and this file.
-- ─────────────────────────────────────────────────────────────────────────────

-- Verify:
--   SELECT table_name, column_name, is_nullable
--   FROM information_schema.columns
--   WHERE column_name = 'school_id' AND table_schema = 'public'
--   ORDER BY is_nullable, table_name;
