-- Submissions for the creativity-test web app.
-- Stores anonymous user attempts at the thought experiments, with the
-- judge's per-answer scores attached. opt_in_share governs whether the
-- submission can be used in future research/analysis.
--
-- This table lives in the same Neon DB as concept-bridge but with a
-- distinct prefix to avoid collisions.

CREATE TABLE IF NOT EXISTS creativity_submissions (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id   TEXT         NOT NULL,
  answers         JSONB        NOT NULL,
  -- answers shape:
  --   [ { "text": str|null, "skipped": bool, "judge": {creativity, novelty, constraint_violation, reasoning} | null }, ... ]
  total_score     NUMERIC(6,2) NOT NULL,           -- sum of per-answer creativity (skips = 0). 0..100.
  mean_creativity NUMERIC(4,2) NOT NULL,           -- mean over answered (excludes skips). 0..10.
  skip_count      INTEGER      NOT NULL,
  display_name    TEXT,                             -- optional self-id
  opt_in_share    BOOLEAN      NOT NULL DEFAULT FALSE,
  ip_hash         TEXT,                             -- sha256(ip + secret salt) for de-dup, never raw IP
  user_agent      TEXT,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_creativity_submissions_experiment ON creativity_submissions(experiment_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_creativity_submissions_ip_hash    ON creativity_submissions(ip_hash, created_at DESC);
