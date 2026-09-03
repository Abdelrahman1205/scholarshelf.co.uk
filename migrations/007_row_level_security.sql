-- =============================================================================
-- 007 — row-level security (POLICIES ONLY — RLS IS NOT ENABLED BY THIS FILE)
-- =============================================================================
-- Legal & Compliance directive, Phase B.1: "Enable PostgreSQL Row-Level Security
-- policies, mandate strict composite `school_id` foreign keys, and enforce
-- non-nullable tenant fields across all tables."
--
-- The composite foreign keys are in 006. This file is the RLS half, and it stops
-- one step short on purpose.
--
--   RUNNING THIS FILE IS SAFE. It creates a role and a set of policies. A policy
--   on a table without RLS enabled does nothing at all.
--
--   THE LAST STEP — `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` — IS COMMENTED
--   OUT AND MUST NOT BE UNCOMMENTED YET. Turning it on before the application
--   sets `app.school_id` on every connection takes the whole platform down:
--   every policy evaluates against an unset setting, every row is invisible, and
--   ScholarShelf shows every school an empty database.
--
-- WHAT HAS TO HAPPEN FIRST — see docs/RLS_CUTOVER.md
--
--   1. The application must stop reaching Postgres over the Neon serverless HTTP
--      driver for tenant data. Each HTTP statement is its own connection, so
--      there is nowhere to put a session setting: `SET LOCAL app.school_id`
--      cannot survive to the next statement. RLS needs pooled connections and a
--      transaction per request.
--   2. Every request must open a transaction that sets `app.school_id` (or
--      `app.platform_owner`) from the SESSION — never from anything the client
--      sends — before it reads or writes anything.
--   3. The application must connect as `scholarshelf_app`, not as the database
--      owner. RLS does not apply to the owner or to any role with BYPASSRLS, so
--      connecting as owner leaves the policies inert while looking enabled — the
--      worst of both worlds.
--
-- Until then the policies sit here, reviewed and version-controlled, and tenant
-- isolation continues to rest on the application layer plus the composite keys
-- in 006.
-- =============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 1 — the application role
--
-- NOINHERIT and no BYPASSRLS. Give it a password out of band; do not put one in
-- this file or in the repository.
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'scholarshelf_app') THEN
    CREATE ROLE scholarshelf_app LOGIN NOINHERIT;
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO scholarshelf_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO scholarshelf_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO scholarshelf_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO scholarshelf_app;

-- No DDL. The application never migrates itself; script/migrate.ts connects as
-- the owner for that and nothing else does.
REVOKE CREATE ON SCHEMA public FROM scholarshelf_app;


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 2 — how a request says who it is
--
-- Two settings, both written by the server from the session, never from a
-- request body or header:
--
--   app.school_id       the tenant this transaction may see
--   app.platform_owner  'on' for BytHub owner/platform_admin work
--
-- current_setting(..., true) returns NULL rather than raising when the setting
-- is absent, so an un-set connection sees nothing instead of erroring — fail
-- closed, and legible in the logs.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION app_current_school_id() RETURNS text
  LANGUAGE sql STABLE AS
$$ SELECT nullif(current_setting('app.school_id', true), '') $$;

CREATE OR REPLACE FUNCTION app_is_platform_owner() RETURNS boolean
  LANGUAGE sql STABLE AS
$$ SELECT coalesce(current_setting('app.platform_owner', true), '') = 'on' $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 3 — one policy per tenant table
--
-- The rule is the same everywhere, which is the point: a row is visible when the
-- caller is the platform owner, or when the row's school_id matches the one the
-- transaction declared. USING governs what can be read and which rows an UPDATE
-- or DELETE can touch; WITH CHECK governs what may be written, so a tenant
-- cannot insert a row into another tenant.
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  t text;
  tenant_tables text[] := ARRAY[
    'invites', 'classes', 'subjects', 'class_teacher_assignments',
    'students', 'books', 'book_copies', 'book_levels', 'book_level_items',
    'class_book_levels', 'student_book_levels',
    'families', 'family_students', 'guardians',
    'child_linking_codes', 'parent_children', 'teacher_profiles',
    'child_book_baskets', 'basket_items', 'book_payments', 'basket_payments',
    'provider_payments', 'payment_verification_attempts',
    'finance_book_allocations', 'custody_events', 'extra_copy_requests',
    'message_threads', 'messages', 'message_audit_logs',
    'school_branding', 'school_website_sections', 'media_assets'
  ];
BEGIN
  FOREACH t IN ARRAY tenant_tables LOOP
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                   WHERE table_schema = 'public' AND table_name = t) THEN
      RAISE NOTICE 'skipping %, table does not exist', t;
      CONTINUE;
    END IF;

    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_tenant_isolation', t);
    EXECUTE format($f$
      CREATE POLICY %I ON %I
        FOR ALL
        TO scholarshelf_app
        USING (app_is_platform_owner() OR school_id = app_current_school_id())
        WITH CHECK (app_is_platform_owner() OR school_id = app_current_school_id())
    $f$, t || '_tenant_isolation', t);
  END LOOP;
END $$;

-- `users` is deliberately not in that list. A platform-owner account has
-- school_id IS NULL by design, and the sign-in path must be able to find an
-- account before any school is known. Its policy has to be written against the
-- authentication flow, not copied from the pattern above. Do that as part of the
-- cutover, not here.


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 4 — NOT ENABLED. Read the header before you touch this.
--
-- Preconditions, all three:
--   [ ] the application holds a pooled connection per request and sets
--       app.school_id / app.platform_owner inside the request transaction
--   [ ] DATABASE_URL for the application points at scholarshelf_app
--   [ ] tests/tenant-isolation.ts passes with RLS on in a scratch database
--
-- Then, one table at a time, verifying between each:
--
--   ALTER TABLE students ENABLE ROW LEVEL SECURITY;
--   ALTER TABLE students FORCE ROW LEVEL SECURITY;
--
-- FORCE matters: without it the table owner is exempt, so a migration or a
-- console connection would quietly bypass the policy.
--
-- To verify the policies do what they claim before enabling anything:
--
--   SET ROLE scholarshelf_app;
--   SET app.school_id = '<a real school id>';
--   SELECT count(*) FROM students;              -- expect that school only
--   SET app.school_id = '<a different school>';
--   SELECT count(*) FROM students;              -- expect that school only
--   RESET ROLE;
-- ─────────────────────────────────────────────────────────────────────────────
