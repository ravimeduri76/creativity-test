import { NextRequest, NextResponse } from "next/server";
import { getExperiment } from "@/lib/experiments";
import { judgeAnswer } from "@/lib/groq";
import { insertSubmission, countSubmissionsLast24h, type AnswerRecord } from "@/lib/db";
import { detectDuplicates } from "@/lib/similarity";

export const runtime = "nodejs";
export const maxDuration = 60;

interface SubmitBody {
  experimentId: string;
  answers: Array<{ text: string; skipped: boolean }>;
  displayName?: string;
  optInShare?: boolean;
  // Honeypot — should always be empty. Bots fill it because it's a
  // visible <input> in the DOM (CSS-hidden but not aria-hidden).
  website?: string;
}

const MAX_SUBMISSIONS_PER_24H = parseInt(
  process.env.MAX_SUBMISSIONS_PER_24H || "500", 10,
);

export async function POST(req: NextRequest) {
  let body: SubmitBody;
  try {
    body = (await req.json()) as SubmitBody;
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  // ── Honeypot ──────────────────────────────────────────────────────────
  // Real users never see the 'website' field (CSS-hidden). If it's filled,
  // it's a bot. Pretend success so they don't retry intelligently.
  if (typeof body.website === "string" && body.website.trim().length > 0) {
    return NextResponse.json({ id: "honeypot", totalScore: 0, meanCreativity: 0 });
  }

  const exp = getExperiment(body.experimentId);
  if (!exp) return NextResponse.json({ error: "unknown experiment" }, { status: 400 });
  if (!Array.isArray(body.answers) || body.answers.length !== 10) {
    return NextResponse.json({ error: "expected exactly 10 answers" }, { status: 400 });
  }

  // ── Daily cap (cost / abuse protection) ───────────────────────────────
  try {
    const recent = await countSubmissionsLast24h();
    if (recent >= MAX_SUBMISSIONS_PER_24H) {
      return NextResponse.json(
        { error: "Daily submission cap reached. Try again tomorrow." },
        { status: 429 },
      );
    }
  } catch (_err) {
    // If the cap check itself fails, proceed — better to occasionally
    // miss the cap than to outright fail every submission.
  }

  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) return NextResponse.json({ error: "judge not configured" }, { status: 500 });

  // Normalize input
  const normalized = body.answers.map((a) => {
    const text = (a?.text ?? "").trim();
    const skipped = !!a?.skipped || text.length === 0;
    return { text, skipped };
  });

  // ── Diversity check (server-side, before Groq calls) ──────────────────
  // Mark answers that are >= 50% Jaccard-similar to an earlier non-skipped
  // non-duplicate answer. Duplicates SKIP the Groq call (saves cost) and
  // score 0/10. This prevents the gaming pattern where users repeat the
  // same idea with different nouns (crocodile→alligator gastrolith etc.).
  const dupResults = detectDuplicates(normalized, 0.5);

  const judgings = await Promise.all(
    normalized.map(async (a, i): Promise<AnswerRecord> => {
      if (a.skipped) {
        return { text: a.text || null, skipped: true, judge: null };
      }
      const dup = dupResults[i];
      if (dup.isDuplicate) {
        return {
          text: a.text,
          skipped: false,
          judge: {
            creativity: 0, novelty: 0,
            constraint_violation: "duplicate",
            reasoning: `Near-duplicate of answer ${dup.duplicateOf! + 1} (similarity ${dup.similarity.toFixed(2)}). Counts as 0.`,
          },
          isDuplicate: true,
          duplicateOf: dup.duplicateOf,
        };
      }
      const judge = await judgeAnswer(exp.id, a.text, groqKey);
      return { text: a.text, skipped: false, judge };
    })
  );

  const skipCount = judgings.filter((a) => a.skipped).length;
  const answered = judgings.filter((a) => !a.skipped);
  const totalScore = judgings.reduce((acc, a) => acc + (a.judge?.creativity ?? 0), 0);
  const meanCreativity = answered.length
    ? Number(
        (answered.reduce((s, a) => s + (a.judge?.creativity ?? 0), 0) / answered.length).toFixed(2)
      )
    : 0;

  // Privacy by design: no IP, no user-agent, no fingerprint persisted.
  const id = await insertSubmission({
    experimentId: exp.id,
    answers: judgings,
    totalScore,
    meanCreativity,
    skipCount,
    displayName: body.displayName?.trim() || null,
    optInShare: !!body.optInShare,
  });

  return NextResponse.json({
    id,
    totalScore,
    meanCreativity,
    skipCount,
    duplicateCount: judgings.filter((a) => a.isDuplicate).length,
    answers: judgings,
    baselines: exp.baselines,
  });
}
