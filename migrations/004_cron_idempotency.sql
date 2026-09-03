-- =============================================================================
-- 004 — cron idempotency
-- =============================================================================
-- The daily job had no record that it had run. A timeout partway through the
-- school loop meant some schools got their digest and some did not, with no way
-- to tell which — and a retry re-emailed parents about money they owe.
--
-- One row per (job, school, day). The cron inserts BEFORE doing work, with
-- ON CONFLICT DO NOTHING. Winning the insert means you own the run.
-- =============================================================================

CREATE TABLE IF NOT EXISTS cron_job_runs (
  id           varchar(36) PRIMARY KEY,
  job          text NOT NULL,
  school_id    varchar(36) REFERENCES schools(id) ON DELETE CASCADE,
  run_date     text NOT NULL,
  status       text NOT NULL DEFAULT 'running',
  sent_count   integer DEFAULT 0,
  detail       text,
  created_at   timestamp DEFAULT now(),
  completed_at timestamp
);

CREATE UNIQUE INDEX IF NOT EXISTS cron_job_runs_job_school_day_unique
  ON cron_job_runs (job, school_id, run_date);
CREATE INDEX IF NOT EXISTS cron_job_runs_school_id_idx ON cron_job_runs (school_id);

-- Housekeeping: these rows are only interesting for a few weeks.
--   DELETE FROM cron_job_runs WHERE created_at < now() - interval '90 days';
