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

  let snapshot;
  try {
    snapshot = await prisma.metricSnapshot.findFirst({
      where: { metricKey: "summary" },
    });
  } catch (error: unknown) {
    const e = error as { code?: string; meta?: { table?: string } };
    if (e?.code === "P2021") {
      console.warn(`Table ${e?.meta?.table ?? "MetricSnapshot"} does not exist yet. Returning empty data.`);
      return NextResponse.json(
        { error: "Summary metrics not yet computed. Run the ETL pipeline first." },
        { status: 404 }
      );
    }
    console.error("Database error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

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
