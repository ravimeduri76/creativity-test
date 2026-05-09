import { NextResponse } from "next/server";
import { getSQL, ensureSchema } from "@/lib/db";
import { EXPERIMENTS } from "@/lib/experiments";

export const runtime = "nodejs";
export const revalidate = 60; // cache 1 min — these are aggregates, not real-time

interface ExperimentInsight {
  id: string;
  shortTitle: string;
  submissions: number;
  meanTotalScore: number | null;
  medianTotalScore: number | null;
  topTotalScore: number | null;
  meanCreativity: number | null;
  meanSkipCount: number | null;
  beatLLMRate: Record<string, number>;
}

export async function GET() {
  try {
    await ensureSchema();
    const sql = getSQL();

    const all = (await sql`
      SELECT id, experiment_id, total_score::float8 AS total_score,
             mean_creativity::float8 AS mean_creativity, skip_count, created_at
      FROM creativity_submissions
      ORDER BY created_at ASC
    `) as Array<Record<string, unknown>>;

    const last24h = (await sql`
      SELECT COUNT(*)::int AS n
      FROM creativity_submissions
      WHERE created_at >= NOW() - INTERVAL '24 hours'
    `) as Array<{ n: number }>;

    const dailyCap = parseInt(process.env.MAX_SUBMISSIONS_PER_24H || "500", 10);

    function median(nums: number[]): number | null {
      if (!nums.length) return null;
      const sorted = [...nums].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    }
    function mean(nums: number[]): number | null {
      if (!nums.length) return null;
      return nums.reduce((s, n) => s + n, 0) / nums.length;
    }

    const experiments: ExperimentInsight[] = EXPERIMENTS.map((exp) => {
      const rows = all.filter((r) => r.experiment_id === exp.id);
      const totals = rows.map((r) => Number(r.total_score));
      const meanCrs = rows.map((r) => Number(r.mean_creativity));
      const skips = rows.map((r) => Number(r.skip_count));

      // beatLLMRate: % of submissions whose total_score > each baseline's totalScore
      const beatRate: Record<string, number> = {};
      for (const b of exp.baselines) {
        const beats = totals.filter((t) => t > b.totalScore).length;
        beatRate[b.model] = totals.length ? Math.round((100 * beats) / totals.length) : 0;
      }

      return {
        id: exp.id,
        shortTitle: exp.shortTitle,
        submissions: rows.length,
        meanTotalScore: rows.length ? Number(mean(totals)?.toFixed(2)) : null,
        medianTotalScore: rows.length ? Number(median(totals)?.toFixed(2)) : null,
        topTotalScore: rows.length ? Math.max(...totals) : null,
        meanCreativity: rows.length ? Number(mean(meanCrs)?.toFixed(2)) : null,
        meanSkipCount: rows.length ? Number(mean(skips)?.toFixed(2)) : null,
        beatLLMRate: beatRate,
      };
    });

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      totalSubmissions: all.length,
      submissionsLast24h: last24h[0]?.n ?? 0,
      dailyCap,
      earliestSubmission: all[0]?.created_at ?? null,
      latestSubmission: all[all.length - 1]?.created_at ?? null,
      experiments,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
