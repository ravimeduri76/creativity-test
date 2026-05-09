"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { EXPERIMENTS, type Experiment } from "@/lib/experiments";

export default function Home() {
  const [exp, setExp] = useState<Experiment>(EXPERIMENTS[0]);
  const [answers, setAnswers] = useState<Array<{ text: string; skipped: boolean }>>(
    () => Array.from({ length: 10 }, () => ({ text: "", skipped: false }))
  );
  const [displayName, setDisplayName] = useState("");
  const [optInShare, setOptInShare] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const update = (i: number, patch: Partial<{ text: string; skipped: boolean }>) => {
    setAnswers((prev) => prev.map((a, j) => (j === i ? { ...a, ...patch } : a)));
  };

  const onSubmit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const r = await fetch("/api/judge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          experimentId: exp.id,
          answers,
          displayName,
          optInShare,
        }),
      });
      if (!r.ok) {
        const body = (await r.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? `HTTP ${r.status}`);
        setSubmitting(false);
        return;
      }
      const data = await r.json();
      router.push(`/results/${data.id}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "submission failed");
      setSubmitting(false);
    }
  };

  const filledOrSkipped = answers.filter((a) => a.skipped || a.text.trim()).length;

  return (
    <div className="space-y-8">
      {/* Experiment picker */}
      <section>
        <label className="mb-2 block text-xs font-mono uppercase tracking-wider text-slate-600">
          Pick a thought experiment
        </label>
        <div className="flex flex-wrap gap-2">
          {EXPERIMENTS.map((e) => (
            <button
              key={e.id}
              onClick={() => setExp(e)}
              className={
                "rounded-md border px-3 py-2 text-sm transition " +
                (exp.id === e.id
                  ? "border-ink bg-ink text-white"
                  : "border-slate-200 bg-white hover:bg-slate-50")
              }
            >
              {e.shortTitle}
            </button>
          ))}
        </div>
      </section>

      {/* Prompt */}
      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h1 className="font-serif text-2xl font-bold tracking-tight text-ink">{exp.longTitle}</h1>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
          {exp.prompt}
        </p>
        <p className="mt-3 text-xs text-slate-500">{exp.rubricNote}</p>
      </section>

      {/* 10 answer fields */}
      <section className="space-y-3">
        {answers.map((a, i) => (
          <div key={i} className="rounded-md border border-slate-200 bg-white p-3">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-slate-500">{`Answer ${i + 1}`}</span>
              <label className="flex items-center gap-2 text-xs text-slate-600">
                <input
                  type="checkbox"
                  checked={a.skipped}
                  onChange={(e) => update(i, { skipped: e.target.checked })}
                />
                skip (counts as 0)
              </label>
            </div>
            <textarea
              rows={2}
              maxLength={300}
              disabled={a.skipped}
              placeholder={`A use that satisfies the constraint…`}
              value={a.text}
              onChange={(e) => update(i, { text: e.target.value })}
              className="mt-2 disabled:bg-slate-50 disabled:text-slate-400"
            />
          </div>
        ))}
      </section>

      {/* Identification + share opt-in */}
      <section className="rounded-md border border-slate-200 bg-white p-4 text-sm">
        <label className="block">
          <span className="text-slate-600">Display name (optional, public on the share card)</span>
          <input
            type="text"
            maxLength={40}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="mt-1"
            placeholder="e.g. Anonymous"
          />
        </label>
        <label className="mt-3 flex items-start gap-2">
          <input
            type="checkbox"
            checked={optInShare}
            onChange={(e) => setOptInShare(e.target.checked)}
            className="mt-1"
          />
          <span className="text-slate-600">
            Allow my answers to be used in future analyses about LLM vs human creativity. Aggregate
            results may be shared publicly. Individual answers will only be referenced if anonymized.
          </span>
        </label>
      </section>

      {/* Submit */}
      <section className="flex items-center justify-between">
        <p className="text-xs text-slate-500">
          {filledOrSkipped}/10 entries (filled or explicitly skipped). Empty answers will be auto-skipped.
        </p>
        <button onClick={onSubmit} disabled={submitting} className="btn-primary">
          {submitting ? "Judging your answers…" : "Submit & get my score"}
        </button>
      </section>

      {error && (
        <div className="rounded-md border border-accent bg-accent/5 p-3 text-sm text-accent">
          {error}
        </div>
      )}
    </div>
  );
}
