import { NextRequest, NextResponse } from "next/server";
import { getExperiment } from "@/lib/experiments";
import { judgeAnswer } from "@/lib/groq";
import { insertSubmission, type AnswerRecord } from "@/lib/db";

export const runtime = "nodejs";
export const maxDuration = 60;

interface SubmitBody {
  experimentId: string;
  answers: Array<{ text: string; skipped: boolean }>;
  displayName?: string;
  optInShare?: boolean;
}

export async function POST(req: NextRequest) {
  let body: SubmitBody;
  try {
    body = (await req.json()) as SubmitBody;
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const exp = getExperiment(body.experimentId);
  if (!exp) return NextResponse.json({ error: "unknown experiment" }, { status: 400 });
  if (!Array.isArray(body.answers) || body.answers.length !== 10) {
    return NextResponse.json({ error: "expected exactly 10 answers" }, { status: 400 });
  }

  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) return NextResponse.json({ error: "judge not configured" }, { status: 500 });

  // Judge each non-skipped answer in parallel.
  const judgings = await Promise.all(
    body.answers.map(async (a): Promise<AnswerRecord> => {
      const text = (a?.text ?? "").trim();
      const skipped = !!a?.skipped || text.length === 0;
      if (skipped) return { text: text || null, skipped: true, judge: null };
      const judge = await judgeAnswer(exp.id, text, groqKey);
      return { text, skipped: false, judge };
    })
  );

  const skipCount = judgings.filter((a) => a.skipped).length;
  const answered = judgings.filter((a) => !a.skipped);
  const totalScore = judgings.reduce((acc, a) => acc + (a.judge?.creativity ?? 0), 0);
  const meanCreativity = answered.length
    ? Number((answered.reduce((s, a) => s + (a.judge?.creativity ?? 0), 0) / answered.length).toFixed(2))
    : 0;

  // Privacy by design: we deliberately do NOT capture IP, user-agent,
  // session, or any fingerprint. The DB schema doesn't even have columns
  // for them. The only things stored: the answers, the judge's scores,
  // an optional display name, and the opt-in flag.
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
    answers: judgings,
    baselines: exp.baselines,
  });
}
