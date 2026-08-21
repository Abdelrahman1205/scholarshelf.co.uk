-- 005_payment_verification.sql
--
-- Automatic Stripe payment verification at the finance stage.
--
-- Two new tables and one new column. Nothing existing is altered or dropped, so
-- this is safe to run on a live database and safe to run more than once.
--
--   provider_payments            — the payment-data layer. One row per payment
--                                  as the provider sees it, normalised. Written
--                                  today by the Stripe spreadsheet importer and
--                                  later by the Stripe API; read by the
--                                  verification service, which never opens a
--                                  spreadsheet.
--
--   payment_verification_attempts — append-only audit. One row per verification
--                                  decision, automatic or manual. Never updated
--                                  or deleted, so the history of how an order
--                                  was settled always survives.
--
--   book_payments.verification_method — the latest answer, denormalised so the
--                                  finance list does not need a join.
--
-- Equivalent to `npm run db:push` against shared/schema.ts; provided explicitly
-- because this touches finance data on a production database.

BEGIN;

-- ── The payment-data layer ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS provider_payments (
  id                  VARCHAR(36) PRIMARY KEY,
  school_id           VARCHAR(36) REFERENCES schools(id) ON DELETE CASCADE,
  provider            TEXT NOT NULL DEFAULT 'stripe',
  provider_payment_id TEXT NOT NULL,
  provider_charge_id  TEXT,
  status              TEXT NOT NULL,
  raw_status          TEXT,
  amount              NUMERIC(10,2) NOT NULL,
  amount_refunded     NUMERIC(10,2) DEFAULT '0',
  currency            VARCHAR(3) NOT NULL,
  reference           TEXT,
  customer_email      TEXT,
  customer_name       TEXT,
  description         TEXT,
  disputed            BOOLEAN NOT NULL DEFAULT FALSE,
  paid_at             TIMESTAMP,
  source              TEXT NOT NULL DEFAULT 'spreadsheet_import',
  source_filename     TEXT,
  imported_at         TIMESTAMP DEFAULT NOW(),
  imported_by         VARCHAR(36),
  raw                 TEXT
);

CREATE INDEX IF NOT EXISTS provider_payments_school_id_idx
  ON provider_payments (school_id);
CREATE INDEX IF NOT EXISTS provider_payments_reference_idx
  ON provider_payments (school_id, reference);

-- Identity: the provider's own id, scoped per school. This is what makes
-- re-uploading the same Stripe export idempotent.
CREATE UNIQUE INDEX IF NOT EXISTS provider_payments_identity_idx
  ON provider_payments (school_id, provider, provider_payment_id);

-- ── Append-only verification audit ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payment_verification_attempts (
  id                          VARCHAR(36) PRIMARY KEY,
  school_id                   VARCHAR(36) REFERENCES schools(id) ON DELETE CASCADE,
  payment_id                  VARCHAR(36) NOT NULL REFERENCES book_payments(id) ON DELETE CASCADE,
  outcome                     TEXT NOT NULL,   -- verified | investigation | rejected
  method                      TEXT NOT NULL,   -- automatic_stripe | manual_finance_override | manual_finance_rejection
  reason_code                 TEXT,
  reason_detail               TEXT,
  matched_provider_payment_id VARCHAR(36),
  candidate_count             INTEGER DEFAULT 0,
  evidence                    TEXT,
  actor_user_id               VARCHAR(36),     -- NULL for automatic decisions
  created_at                  TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS payment_verification_attempts_payment_idx
  ON payment_verification_attempts (payment_id);
CREATE INDEX IF NOT EXISTS payment_verification_attempts_school_id_idx
  ON payment_verification_attempts (school_id);

-- ── How an order's finance stage was settled ────────────────────────────────
-- Nullable: existing orders predate automatic verification and keep NULL, which
-- the UI renders as "—" rather than claiming they were verified some way.
ALTER TABLE book_payments
  ADD COLUMN IF NOT EXISTS verification_method TEXT;

COMMIT;
