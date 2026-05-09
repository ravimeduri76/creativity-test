import { notFound } from "next/navigation";
import { getSubmission } from "@/lib/db";
import { getExperiment, type LLMBaseline } from "@/lib/experiments";
import type { AnswerRecord } from "@/lib/db";

interface SubmissionRow {
  id: string;
  experiment_id: string;
  answers: AnswerRecord[];
  total_score: number | string;
  mean_creativity: number | string;
  skip_count: number;
  display_name: string | null;
  opt_in_share: boolean;
  created_at: string | Date;
}

function pctRank(my: number, baselines: LLMBaseline[]) {
  const beats = baselines.filter((b) => my > b.totalScore).length;
  const ties = baselines.filter((b) => my === b.totalScore).length;
  return { beats, ties, total: baselines.length };
}

export default async function ResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = (await getSubmission(id)) as unknown as SubmissionRow | null;
  if (!row) return notFound();

  const exp = getExperiment(row.experiment_id);
  if (!exp) return notFound();

  const total = Number(row.total_score);
  const mean = Number(row.mean_creativity);
  const ranking = pctRank(total, exp.baselines);

  return (
    <div className="space-y-8">
      {/* Headline */}
      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <p className="font-mono text-xs uppercase tracking-wider text-slate-500">
          Result · {exp.shortTitle}
        </p>
        <h1 className="mt-1 font-serif text-4xl font-bold text-ink">
          {total.toFixed(0)}<span className="text-slate-400 text-2xl">/100</span>
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Mean creativity per answered item: <strong className="text-ink">{mean.toFixed(2)}</strong>{" "}
          / 10. Skipped: {row.skip_count}/10.
        </p>
        <p className="mt-2 text-sm text-slate-700">
          You beat <strong>{ranking.beats}/{ranking.total}</strong> frontier-LLM baselines on this experiment.
        </p>
      </section>

      {/* Comparison strip */}
      <section>
        <h2 className="mb-2 font-mono text-xs uppercase tracking-wider text-slate-600">
          vs the LLMs on the same experiment
        </h2>
        <div className="grid gap-2 md:grid-cols-4">
          <ComparisonCard label={row.display_name || "You"} value={total} accent />
          {exp.baselines.map((b) => (
            <ComparisonCard key={b.model} label={b.model} value={b.totalScore} />
          ))}
        </div>
      </section>

      {/* Per-answer breakdown */}
      <section>
        <h2 className="mb-3 font-mono text-xs uppercase tracking-wider text-slate-600">
          Per-answer breakdown
        </h2>
        <div className="space-y-2">
          {row.answers.map((a, i) => (
            <AnswerCard key={i} index={i + 1} answer={a} />
          ))}
        </div>
      </section>

      <section className="flex flex-wrap gap-3">
        <a className="btn-primary" href="/">Try another experiment</a>
        <ShareButton total={total} title={exp.shortTitle} />
      </section>
    </div>
  );
}

function ComparisonCard({ label, value, accent = false }: { label: string; value: number; accent?: boolean }) {
  return (
    <div
      className={
        "rounded-md border p-3 " +
        (accent ? "border-ink bg-ink text-white" : "border-slate-200 bg-white")
      }
    >
      <p className={"text-xs " + (accent ? "text-slate-200" : "text-slate-500")}>{label}</p>
      <p className="font-serif text-2xl font-bold">{Number(value).toFixed(0)}</p>
    </div>
  );
}

function AnswerCard({ index, answer }: { index: number; answer: AnswerRecord }) {
  const cr = answer.judge?.creativity ?? 0;
  const violation = answer.judge?.constraint_violation;
  const isDup = answer.isDuplicate;
  const violationFlag = violation && violation !== "none" && violation !== "duplicate" ? violation : null;
  return (
    <div className={"rounded-md border p-3 " + (isDup ? "border-amber/40 bg-amber/5" : "border-slate-200 bg-white")}>
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span className="font-mono">Answer {index}</span>
        <span className="flex items-center gap-2">
          {answer.skipped ? (
            <span className="rounded bg-slate-100 px-2 py-0.5 text-slate-500">skipped (0/10)</span>
          ) : isDup ? (
            <span className="rounded bg-amber/20 px-2 py-0.5 text-xs text-amber">
              duplicate of #{(answer.duplicateOf ?? 0) + 1} · 0/10
            </span>
          ) : (
            <>
              <span
                className={
                  "rounded px-2 py-0.5 font-mono text-xs " +
                  (cr >= 8 ? "bg-good/15 text-good"
                  : cr >= 6 ? "bg-amber/15 text-amber"
                  : "bg-accent/15 text-accent")
                }
              >
                {cr}/10
              </span>
              {violationFlag && (
                <span className="rounded bg-accent/15 px-2 py-0.5 text-xs text-accent">
                  {violationFlag}
                </span>
              )}
            </>
          )}
        </span>
      </div>
      {!answer.skipped && (
        <>
          <p className="mt-2 text-sm text-slate-800">{answer.text}</p>
          {answer.judge?.reasoning && (
            <p className="mt-1 text-xs italic text-slate-500">{answer.judge.reasoning}</p>
          )}
        </>
      )}
    </div>
  );
}

function ShareButton({ total, title }: { total: number; title: string }) {
  const text = encodeURIComponent(
    `I scored ${total.toFixed(0)}/100 on the "${title}" creativity test against frontier LLMs. Try yours:`
  );
  const url = encodeURIComponent("https://github.com/ravimeduri76/creativity-test");
  const href = `https://www.linkedin.com/sharing/share-offsite/?url=${url}&summary=${text}`;
  return (
    <a className="btn-secondary" href={href} target="_blank" rel="noopener noreferrer">
      Share to LinkedIn
    </a>
  );
}
