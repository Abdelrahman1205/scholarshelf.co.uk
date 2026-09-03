-- =============================================================================
-- BytHub support-console hardening
-- =============================================================================
--
-- Creates a database-enforced READ-ONLY surface for the BytHub support console.
--
-- Security model:
--   * console_ro has no direct privileges on public tables.
--   * console_ro can SELECT only from views in schema console.
--   * credential-bearing fields are absent from redacted views.
--   * default_transaction_read_only provides defence in depth.
--   * typed support operations continue through the normal application layer.
--   * no console write role or break-glass database credential is created.
--
-- IMPORTANT:
--   This migration does NOT contain a database password.
--   console_ro is initially created NOLOGIN.
--   Provision its LOGIN credential separately after migration.
--
-- Views are DROP + CREATE rather than CREATE OR REPLACE so this migration can
-- safely recreate a view when its underlying public table gained/reordered
-- columns.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Isolated console schema
-- -----------------------------------------------------------------------------

CREATE SCHEMA IF NOT EXISTS console;

REVOKE ALL ON SCHEMA console FROM PUBLIC;

-- -----------------------------------------------------------------------------
-- 2. Append-only console audit trail
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.console_audit (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id   varchar(36) NOT NULL,
  actor_username  text        NOT NULL,
  actor_role      text,
  tier            text        NOT NULL,
  action          text        NOT NULL,
  school_id       varchar(36),
  statement       text,
  params          jsonb,
  before_snapshot jsonb,
  after_snapshot  jsonb,
  row_count       integer,
  duration_ms     integer,
  reason          text,
  ip              text,
  user_agent      text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS console_audit_created_idx
  ON public.console_audit (created_at DESC);

CREATE INDEX IF NOT EXISTS console_audit_actor_idx
  ON public.console_audit (actor_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS console_audit_school_idx
  ON public.console_audit (school_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.console_audit_immutable()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'console_audit is append-only (attempted %)', TG_OP;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS console_audit_no_change
  ON public.console_audit;

CREATE TRIGGER console_audit_no_change
  BEFORE UPDATE OR DELETE ON public.console_audit
  FOR EACH ROW
  EXECUTE FUNCTION public.console_audit_immutable();

-- -----------------------------------------------------------------------------
-- 3. Explicit support-safe console views
-- -----------------------------------------------------------------------------
--
-- FAIL CLOSED:
--
-- The support console does NOT mirror the public schema.
--
-- Only the 20 views below are exposed, and every allowed column is named
-- explicitly. Adding a new public table or a new column to an existing table
-- therefore does not make that data readable by console_ro automatically.
--
-- Before recreating the approved surface, remove every existing console view.
-- This also cleans up views left by older versions of this migration which
-- mirrored public tables dynamically.
--
-- No CASCADE is used deliberately. If another database object unexpectedly
-- depends on a console view, migration 001 stops rather than removing that
-- dependency automatically.

DO $$
DECLARE
  v record;
BEGIN
  FOR v IN
    SELECT table_name
    FROM information_schema.views
    WHERE table_schema = 'console'
    ORDER BY table_name
  LOOP
    EXECUTE format(
      'DROP VIEW console.%I',
      v.table_name
    );
  END LOOP;
END $$;


CREATE VIEW console.schools AS
SELECT
  id,
  name,
  code,
  status,
  setup_status,
  contact_email,
  contact_phone,
  address,
  notes,
  payment_app_name,
  created_at,
  updated_at,
  is_deleted,
  suspended_at,
  suspended_by,
  suspension_reason,
  archived_at,
  archived_by,
  archive_reason,
  restored_at,
  restored_by,
  restore_reason,
  deletion_requested_at,
  deletion_requested_by,
  deletion_reason,
  deleted_at,
  deleted_by,
  delete_reason
FROM public.schools;

CREATE VIEW console.school_branding AS
SELECT
  id,
  school_id,
  logo_url,
  logo_file_id,
  favicon_url,
  favicon_file_id,
  banner_image_url,
  banner_file_id,
  email_header_logo_url,
  email_header_logo_file_id,
  pdf_logo_url,
  pdf_logo_file_id,
  primary_colour,
  secondary_colour,
  accent_colour,
  theme_name,
  font_preference,
  setup_status,
  created_at,
  updated_at,
  updated_by
FROM public.school_branding;

CREATE VIEW console.users AS
SELECT
  id,
  username,
  name,
  role,
  email,
  status,
  school_id,
  email_verified_at,
  last_login_at,
  mfa_enabled,
  mfa_enrolled_at,
  created_at,
  updated_at
FROM public.users;

CREATE VIEW console.classes AS
SELECT
  id,
  name,
  academic_year,
  year_group,
  teacher_id,
  school_id
FROM public.classes;

CREATE VIEW console.students AS
SELECT
  id,
  name,
  class_id,
  student_code,
  school_id,
  family_id,
  date_of_birth,
  gender,
  grade_level,
  preferred_reading_level,
  photo_url,
  status,
  is_archived,
  archived_at,
  archived_by
FROM public.students;

CREATE VIEW console.parent_children AS
SELECT
  id,
  parent_identifier,
  student_id,
  linked_at,
  relationship,
  added_by_admin_id,
  school_id
FROM public.parent_children;

CREATE VIEW console.child_linking_codes AS
SELECT
  id,
  student_id,
  family_id,
  parent_email,
  is_used,
  linked_at,
  expires_at,
  school_id
FROM public.child_linking_codes;

CREATE VIEW console.books AS
SELECT
  id,
  title,
  author,
  isbn,
  price,
  description,
  cover_image_url,
  is_active,
  stock_quantity,
  low_stock_threshold,
  reorder_quantity,
  school_id,
  book_code,
  barcode_generated_at
FROM public.books;

CREATE VIEW console.book_levels AS
SELECT
  id,
  name,
  description,
  school_id
FROM public.book_levels;

CREATE VIEW console.class_book_levels AS
SELECT
  id,
  class_id,
  book_level_id
FROM public.class_book_levels;

CREATE VIEW console.child_book_baskets AS
SELECT
  id,
  student_id,
  parent_identifier,
  status,
  total_amount,
  school_id,
  academic_year
FROM public.child_book_baskets;

CREATE VIEW console.basket_items AS
SELECT
  id,
  basket_id,
  book_id,
  quantity,
  unit_price,
  total_price
FROM public.basket_items;

CREATE VIEW console.basket_payments AS
SELECT
  id,
  basket_id,
  payment_id,
  school_id
FROM public.basket_payments;

CREATE VIEW console.book_payments AS
SELECT
  id,
  parent_identifier,
  total_amount,
  payment_method,
  payment_reference,
  status,
  paid_at,
  confirmed_at,
  payment_reference_number,
  payment_reference_submitted_at,
  payment_reference_submitted_by,
  payment_reviewed_at,
  payment_reviewed_by,
  payment_review_note,
  external_payment_id,
  external_payment_status,
  notes,
  school_id,
  order_status,
  verification_method,
  academic_year
FROM public.book_payments;

CREATE VIEW console.finance_book_allocations AS
SELECT
  id,
  student_id,
  book_id,
  basket_id,
  status,
  distribution_status,
  allocated_at,
  received_at,
  received_by_teacher_id,
  absent_marked_at,
  absent_marked_by_teacher_id,
  issue_note,
  custody_status,
  school_id,
  academic_year,
  class_id_at_allocation,
  class_name_at_allocation,
  year_group_at_allocation
FROM public.finance_book_allocations;

CREATE VIEW console.extra_copy_requests AS
SELECT
  id,
  teacher_id,
  class_id,
  book_id,
  quantity,
  reason,
  notes,
  status,
  admin_notes,
  created_at,
  resolved_at,
  school_id
FROM public.extra_copy_requests;

CREATE VIEW console.families AS
SELECT
  id,
  name,
  school_id,
  family_code,
  household_name,
  primary_contact_guardian_id,
  primary_phone,
  primary_email,
  address,
  status,
  created_at,
  updated_at
FROM public.families;

CREATE VIEW console.family_students AS
SELECT
  id,
  family_id,
  student_id
FROM public.family_students;

CREATE VIEW console.audit_logs AS
SELECT
  id,
  user_id,
  action,
  target,
  metadata,
  ip_address,
  user_agent,
  created_at
FROM public.audit_logs;

CREATE VIEW console.invites AS
SELECT
  id,
  email,
  invitee_name,
  role,
  school_id,
  invited_by,
  status,
  expires_at,
  accepted_at,
  created_at,
  family_id,
  relationship,
  guardian_permissions
FROM public.invites;


-- Credential exclusions enforced above:
--
-- console.users deliberately excludes:
--   password_hash
--   mfa_secret
--   mfa_recovery_codes
--
-- console.invites deliberately excludes:
--   token_hash
--
-- console.child_linking_codes deliberately excludes:
--   code
--
-- student_code, family_code, book_code and schools.code are intentionally
-- retained: they are ScholarShelf business identifiers, not bearer credentials.
--
-- Tables not named above are inaccessible to console_ro. This includes, among
-- others:
--
--   user_sessions
--   rate_limits
--   provider_payments
--   payment_verification_attempts
--   book_copies
--   guardians
--   media_assets
--   messages
--   public.console_audit
--
-- Adding support visibility for another table requires a reviewed migration
-- that explicitly creates its console view.


-- -----------------------------------------------------------------------------
-- 5. Read-only database role
-- -----------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_roles
    WHERE rolname = 'console_ro'
  ) THEN
    CREATE ROLE console_ro NOLOGIN;
  END IF;
END $$;

-- The console role must never reach public tables directly.

REVOKE ALL ON SCHEMA public
  FROM console_ro;

REVOKE ALL ON ALL TABLES IN SCHEMA public
  FROM console_ro;

REVOKE ALL ON SCHEMA console
  FROM console_ro;

REVOKE ALL ON ALL TABLES IN SCHEMA console
  FROM console_ro;

-- The controlled view layer is its only readable surface.

GRANT USAGE ON SCHEMA console
  TO console_ro;

GRANT SELECT ON
  console.schools,
  console.school_branding,
  console.users,
  console.classes,
  console.students,
  console.parent_children,
  console.child_linking_codes,
  console.books,
  console.book_levels,
  console.class_book_levels,
  console.child_book_baskets,
  console.basket_items,
  console.basket_payments,
  console.book_payments,
  console.finance_book_allocations,
  console.extra_copy_requests,
  console.families,
  console.family_students,
  console.audit_logs,
  console.invites
TO console_ro;

-- Do not use ALTER DEFAULT PRIVILEGES here.
-- Newly created console objects must be deliberately granted by a reviewed
-- migration rather than becoming readable automatically.

ALTER ROLE console_ro
  SET default_transaction_read_only = on;

ALTER ROLE console_ro
  SET statement_timeout = '5s';

ALTER ROLE console_ro
  SET idle_in_transaction_session_timeout = '10s';

ALTER ROLE console_ro
  SET search_path = console;

COMMIT;

-- =============================================================================
-- Credential provisioning
-- =============================================================================
--
-- No credential belongs in source control.
--
-- After this migration has been verified:
--
--   1. generate a unique high-entropy password outside this repository;
--   2. enable LOGIN for console_ro through the database administration channel;
--   3. store the resulting connection string only as CONSOLE_RO_DATABASE_URL.
--
-- =============================================================================
-- Verification expectations
-- =============================================================================
--
-- The console.users view must return zero rows for:
--
--   SELECT column_name
--   FROM information_schema.columns
--   WHERE table_schema = 'console'
--     AND table_name = 'users'
--     AND column_name IN (
--       'password_hash',
--       'mfa_secret',
--       'mfa_recovery_codes'
--     );
--
-- console_ro must:
--   * have no direct public-table grants;
--   * have SELECT access to console views;
--   * default to read-only transactions.
--
-- UPDATE/DELETE against public.console_audit must raise:
--   console_audit is append-only
--
-- NOTE:
-- This migration no longer creates the historical console_rw role.
-- If an older environment already contains console_rw, inspect its grants and
-- dependencies separately before revoking/dropping it. Do not DROP it blindly.
-- =============================================================================
