import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cache } from "@/lib/cache";
import type { MetricSummary } from "@/lib/types";

const CACHE_KEY = "metrics:summary";
const TTL_MS = 10 * 60 * 1000; // 10 minutes

export async function GET() {
  const cached = cache.get<MetricSummary>(CACHE_KEY);
  if (cached) {
    return NextResponse.json(cached);
  }

  const snapshot = await prisma.metricSnapshot.findFirst({
    where: { metricKey: "summary" },
  });

  if (!snapshot) {
    return NextResponse.json(
      { error: "Summary metrics not yet computed. Run the ETL pipeline first." },
      { status: 404 }
    );
  }

  const meta = snapshot.metadata as Record<string, unknown> | null;

  const summary: MetricSummary = {
    totalProjects: (meta?.total_projects as number) ?? 0,
    totalOutputs: (meta?.total_outputs as number) ?? 0,
    totalInstitutions: (meta?.total_institutions as number) ?? 0,
    overallOaRate: (meta?.overall_oa_rate as number) ?? 0,
    yearRange: ((meta?.year_range as [number | null, number | null]) ?? [null, null]),
  };

  cache.set(CACHE_KEY, summary, TTL_MS);
  return NextResponse.json(summary, {
    headers: { "Cache-Control": "public, max-age=600, stale-while-revalidate=60" },
  });
}
