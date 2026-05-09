/**
 * Llama 3.3-70B judge via Groq. Same rubric used in the author's offline
 * thought-experiment runs; baselines in lib/experiments.ts were judged
 * by this exact wrapper, so live submissions are graded comparably.
 */

import type { AnswerJudge } from "./db";

interface GroqRubric {
  systemPrompt: string;
}

const RUBRIC_BY_EXPERIMENT: Record<string, GroqRubric> = {
  "diamond-uses-v1": {
    systemPrompt: `You are an impartial judge of creative novelty for a proposed use of a diamond.

Constraints the use must satisfy:
(A) NOT industrial (cutting, abrasives, optics for instruments, semiconductors, heat sinks, scientific tools)
(B) NOT jewelry / attraction (rings, necklaces, status, romance, fashion)
(C) NOT a commercialized or extensively-documented application (cremation diamonds, optical PUFs, NV-center qubits, diamond audio tweeters, etc.)

NOVELTY rubric (most important):
- 9-10: Genuinely new combination. Not encountered before.
- 7-8: Uncommon. Rarely discussed in mainstream sources.
- 5-6: Niche but documented somewhere.
- 3-4: Well-documented or commercialized.
- 1-2: Cliché / standard textbook.

CREATIVITY: novelty (heaviest weight) + plausibility + lateral thinking. Cap at 4 if industrial/jewelry; 5 if commercialized.

Output exactly one JSON object on a single line. No markdown, no preamble:
{"constraint_violation":"none|industrial|jewelry|commercialized","novelty":<1-10>,"creativity":<1-10>,"reasoning":"<one sentence>"}`,
  },
  "animal-diamond-v1": {
    systemPrompt: `You are an impartial judge of creative novelty for a proposed use of a diamond by a non-human animal.

Constraints:
(A) Must be a use BY THE ANIMAL — not by a human, not industrial, not for jewelry.
(B) Must reference a REAL DOCUMENTED ANIMAL BEHAVIOR.
(C) Must NOT require human-imposed meanings or human-made tools.

NOVELTY rubric (most important):
- 9-10: Genuinely new combination of animal behavior + diamond property. Surprising and apt.
- 7-8: Uncommon but well-grounded in real behavior.
- 5-6: Plausible and reasonable.
- 3-4: Predictable / clichéd, OR animal behavior doesn't quite fit.
- 1-2: Generic, anthropomorphic, or invented behavior.

CREATIVITY: novelty (heaviest) + plausibility-of-the-behavior. Cap at 4 for anthropomorphic projections; 3 for fabricated behaviors.

Output exactly one JSON object on a single line:
{"constraint_violation":"none|anthropomorphic|fabricated|jewelry-or-industrial","novelty":<1-10>,"creativity":<1-10>,"reasoning":"<one sentence>"}`,
  },
};

function extractJson(raw: string): Record<string, unknown> | null {
  if (!raw) return null;
  const stripped = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  try {
    return JSON.parse(stripped);
  } catch {
    const m = stripped.match(/\{[\s\S]*?\}/);
    if (m) {
      try { return JSON.parse(m[0]); } catch { /* fallthrough */ }
    }
  }
  return null;
}

function clamp(n: number) { return Math.max(1, Math.min(10, Math.round(n))); }

function normalize(v: Record<string, unknown> | null): AnswerJudge | null {
  if (!v) return null;
  const novelty = Number(v.novelty);
  const creativity = Number(v.creativity);
  if (!Number.isFinite(novelty) || !Number.isFinite(creativity)) return null;
  let cv = (v.constraint_violation as string) || "none";
  if (!["none", "industrial", "jewelry", "commercialized", "anthropomorphic", "fabricated", "jewelry-or-industrial"].includes(cv)) {
    cv = "none";
  }
  return {
    creativity: clamp(creativity),
    novelty: clamp(novelty),
    constraint_violation: cv,
    reasoning: (v.reasoning as string || "").slice(0, 240),
  };
}

export async function judgeAnswer(
  experimentId: string,
  answer: string,
  apiKey: string,
  maxRetries = 3,
): Promise<AnswerJudge | null> {
  const rubric = RUBRIC_BY_EXPERIMENT[experimentId];
  if (!rubric) throw new Error(`Unknown experiment ${experimentId}`);

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [
            { role: "system", content: rubric.systemPrompt },
            { role: "user",   content: `Proposed use:\n\n${answer}\n\nOutput JSON only on one line. No markdown.` },
          ],
          temperature: 0.1 * (attempt + 1),
          max_tokens: 350,
        }),
      });
      const body = await r.json() as { choices?: Array<{ message?: { content?: string } }> };
      const content = body.choices?.[0]?.message?.content ?? "";
      const v = normalize(extractJson(content));
      if (v) return v;
    } catch (_err) {
      // retry
    }
    await new Promise((res) => setTimeout(res, 400 * (attempt + 1)));
  }
  return null;
}
