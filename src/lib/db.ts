import { neon } from "@neondatabase/serverless";

let sqlClient: ReturnType<typeof neon> | null = null;
let schemaReady = false;

export function getSQL() {
  if (!sqlClient) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    sqlClient = neon(url);
  }
  return sqlClient;
}

export async function ensureSchema() {
  if (schemaReady) return;
  const sql = getSQL();
  await sql`
    CREATE TABLE IF NOT EXISTS creativity_submissions (
      id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
      experiment_id   TEXT         NOT NULL,
      answers         JSONB        NOT NULL,
      total_score     NUMERIC(6,2) NOT NULL,
      mean_creativity NUMERIC(4,2) NOT NULL,
      skip_count      INTEGER      NOT NULL,
      display_name    TEXT,
      opt_in_share    BOOLEAN      NOT NULL DEFAULT FALSE,
      ip_hash         TEXT,
      user_agent      TEXT,
      created_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_creativity_submissions_experiment
    ON creativity_submissions(experiment_id, created_at DESC)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_creativity_submissions_ip_hash
    ON creativity_submissions(ip_hash, created_at DESC)
  `;
  schemaReady = true;
}

export interface AnswerJudge {
  creativity: number;
  novelty: number;
  constraint_violation: string;
  reasoning: string;
}

export interface AnswerRecord {
  text: string | null;
  skipped: boolean;
  judge: AnswerJudge | null;
}

export interface InsertSubmissionInput {
  experimentId: string;
  answers: AnswerRecord[];
  totalScore: number;
  meanCreativity: number;
  skipCount: number;
  displayName: string | null;
  optInShare: boolean;
  ipHash: string | null;
  userAgent: string | null;
}

export async function insertSubmission(input: InsertSubmissionInput): Promise<string> {
  await ensureSchema();
  const sql = getSQL();
  const rows = (await sql`
    INSERT INTO creativity_submissions
      (experiment_id, answers, total_score, mean_creativity, skip_count,
       display_name, opt_in_share, ip_hash, user_agent)
    VALUES
      (${input.experimentId}, ${JSON.stringify(input.answers)}::jsonb,
       ${input.totalScore}, ${input.meanCreativity}, ${input.skipCount},
       ${input.displayName}, ${input.optInShare}, ${input.ipHash}, ${input.userAgent})
    RETURNING id
  `) as Array<{ id: string }>;
  return rows[0].id;
}

export async function getSubmission(id: string) {
  await ensureSchema();
  const sql = getSQL();
  const rows = (await sql`
    SELECT id, experiment_id, answers, total_score, mean_creativity, skip_count,
           display_name, opt_in_share, created_at
    FROM creativity_submissions
    WHERE id = ${id}
  `) as Array<Record<string, unknown>>;
  return rows[0] ?? null;
}
