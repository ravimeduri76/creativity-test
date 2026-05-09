-- Submissions for the creativity-test web app.
-- Stores anonymous user attempts at the thought experiments, with the
-- judge's per-answer scores attached. opt_in_share governs whether the
-- submission can be used in future research/analysis.
--
-- This table lives in the same Neon DB as concept-bridge but with a
-- distinct prefix to avoid collisions.

-- Privacy by design: this table has NO columns for IP address,
-- user-agent, session ID, or any other fingerprint. Only the
-- answer text, the judge's scores, an optional self-typed
-- display name, and the opt-in-to-share flag are persisted.
CREATE TABLE IF NOT EXISTS creativity_submissions (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id   TEXT         NOT NULL,
  answers         JSONB        NOT NULL,
  -- answers shape:
  --   [ { "text": str|null, "skipped": bool, "judge": {creativity, novelty, constraint_violation, reasoning} | null }, ... ]
  total_score     NUMERIC(6,2) NOT NULL,           -- sum of per-answer creativity (skips = 0). 0..100.
  mean_creativity NUMERIC(4,2) NOT NULL,           -- mean over answered (excludes skips). 0..10.
  skip_count      INTEGER      NOT NULL,
  display_name    TEXT,                             -- optional self-id, only what the user typed
  opt_in_share    BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_creativity_submissions_experiment ON creativity_submissions(experiment_id, created_at DESC);
