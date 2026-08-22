-- =============================================================================
-- BytHub console hardening
-- =============================================================================
-- Run ONCE against production, as the Neon project owner (the role that owns the
-- public schema). Safe to re-run: everything is CREATE OR REPLACE / IF NOT EXISTS.
--
-- What this buys you: the console stops relying on regexes to decide what is
-- allowed. Postgres decides instead, and Postgres cannot be fooled by a
-- data-modifying CTE, a second statement after a semicolon, or a leading comment.
--
-- BEFORE RUNNING: replace both REPLACE_ME passwords with long random strings, e.g.
--   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
-- =============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. A schema of views. This is the ONLY surface the console can reach.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE SCHEMA IF NOT EXISTS console;

-- Mirror every public table as a view, so the console stays in step with the
-- schema automatically instead of drifting against a hand-maintained array
-- (the old ALLOWED_TABLES listed 6 tables that did not exist and missed 18 that did).
--
-- Excluded deliberately:
--   user_sessions  — holds live session payloads; reading it is session theft
--   rate_limits    — operational noise, and readable via the app anyway
DO $$
DECLARE t record;
BEGIN
  FOR t IN
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename NOT IN ('user_sessions', 'rate_limits')
  LOOP
    EXECUTE format('CREATE OR REPLACE VIEW console.%I AS SELECT * FROM public.%I',
                   t.tablename, t.tablename);
  END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Redact the two views that carry credentials.
--    These run AFTER the loop above, replacing the SELECT * versions.
--
--    This is the fix for "browsing the users table returns password hashes and
--    MFA secrets to the browser". It is enforced by the absence of the column,
--    not by application code remembering to strip it — so no query, however
--    it is written, can return one.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW console.users AS
SELECT
  id, username, email, name, role, school_id, status,
  mfa_enabled, mfa_enrolled_at,
  email_verified_at, last_login_at, created_at, updated_at
FROM public.users;
-- omitted on purpose: password_hash, mfa_secret, mfa_recovery_codes

CREATE OR REPLACE VIEW console.invites AS
SELECT
  id, email, invitee_name, role, school_id, status,
  invited_by, expires_at, created_at, accepted_at,
  family_id, relationship, guardian_permissions
FROM public.invites;
-- omitted on purpose: token_hash

CREATE OR REPLACE VIEW console.child_linking_codes AS
SELECT
  id, student_id, family_id, school_id, parent_email,
  is_used, linked_at, expires_at
FROM public.child_linking_codes;
-- omitted on purpose: code
--   A linking code is a live bearer token that attaches an adult to a child.
--   Support should REGENERATE one (a Tier-1 operation), never read one out.

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. The read-only role.
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'console_ro') THEN
    CREATE ROLE console_ro LOGIN PASSWORD 'REPLACE_ME_READ_ONLY_PASSWORD';
  END IF;
END $$;

REVOKE ALL ON SCHEMA public          FROM console_ro;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM console_ro;

GRANT USAGE  ON SCHEMA console            TO console_ro;
GRANT SELECT ON ALL TABLES IN SCHEMA console TO console_ro;
ALTER DEFAULT PRIVILEGES IN SCHEMA console GRANT SELECT ON TABLES TO console_ro;

-- Enforcement that does not depend on application code being correct.
-- default_transaction_read_only is what kills `WITH x AS (DELETE ...) SELECT`.
ALTER ROLE console_ro SET default_transaction_read_only = on;
ALTER ROLE console_ro SET statement_timeout = '5s';
ALTER ROLE console_ro SET idle_in_transaction_session_timeout = '10s';
ALTER ROLE console_ro SET search_path = console;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. The break-glass write role. Reaches real tables, but cannot change shape.
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'console_rw') THEN
    CREATE ROLE console_rw LOGIN PASSWORD 'REPLACE_ME_WRITE_PASSWORD';
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO console_rw;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO console_rw;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO console_rw;
-- No CREATE / ALTER / DROP / TRUNCATE: DDL is never reachable from the console.
ALTER ROLE console_rw SET statement_timeout = '15s';
ALTER ROLE console_rw SET idle_in_transaction_session_timeout = '30s';

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. The audit trail. Append-only, and loud about it.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS console_audit (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id   varchar(36) NOT NULL,
  actor_username  text        NOT NULL,
  actor_role      text,
  tier            text        NOT NULL,   -- 'operation' | 'query' | 'breakglass'
  action          text        NOT NULL,
  school_id       varchar(36),
  statement       text,
  params          jsonb,
  before_snapshot jsonb,
  after_snapshot  jsonb,
  row_count       integer,
  duration_ms     integer,
  reason          text,
  elevation_id    uuid,
  ip              text,
  user_agent      text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS console_audit_created_idx ON console_audit (created_at DESC);
CREATE INDEX IF NOT EXISTS console_audit_actor_idx   ON console_audit (actor_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS console_audit_school_idx  ON console_audit (school_id, created_at DESC);

CREATE OR REPLACE FUNCTION console_audit_immutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'console_audit is append-only (attempted %)', TG_OP;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS console_audit_no_change ON console_audit;
CREATE TRIGGER console_audit_no_change
  BEFORE UPDATE OR DELETE ON console_audit
  FOR EACH ROW EXECUTE FUNCTION console_audit_immutable();

-- The console may READ its own history, but the append-only trigger and the
-- read-only transaction mean it can never rewrite it.
CREATE OR REPLACE VIEW console.console_audit AS SELECT * FROM public.console_audit;
GRANT SELECT ON console.console_audit TO console_ro;

COMMIT;

-- =============================================================================
-- Verify (run these after committing; all three should hold)
-- =============================================================================
-- 1. The read role cannot see a password hash:
--      SET ROLE console_ro; SELECT password_hash FROM console.users LIMIT 1;
--      expected: ERROR  column "password_hash" does not exist
--
-- 2. The read role cannot write, even inside a CTE:
--      SET ROLE console_ro;
--      WITH x AS (DELETE FROM public.users RETURNING *) SELECT * FROM x;
--      expected: ERROR  cannot execute DELETE in a read-only transaction
--
-- 3. The audit trail cannot be rewritten:
--      DELETE FROM console_audit;
--      expected: ERROR  console_audit is append-only (attempted DELETE)
-- =============================================================================
