import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cache } from "@/lib/cache";
import type { YearlyMetric, YearlyMetricParam } from "@/lib/types";

const TTL_MS = 5 * 60 * 1000; // 5 minutes

const METRIC_KEY_MAP: Record<YearlyMetricParam, string | null> = {
  project_count: "project_count_by_year",
  oa_rate: "oa_publication_rate_by_year",
  output_by_category: null, // special: multiple keys prefixed output_count_by_category_year:*
  funding_efficiency: "funding_efficiency_by_year",
  open_data_rate: "open_data_rate_by_year",
  open_software_rate: "open_software_rate_by_year",
};

const VALID_METRICS = Object.keys(METRIC_KEY_MAP) as YearlyMetricParam[];

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const metric = searchParams.get("metric") as YearlyMetricParam | null;
  if (!metric || !VALID_METRICS.includes(metric)) {
    return NextResponse.json(
      {
        error: `Query param 'metric' is required. Must be one of: ${VALID_METRICS.join(", ")}`,
      },
      { status: 400 }
    );
  }

  const startYear = searchParams.get("startYear")
    ? parseInt(searchParams.get("startYear")!, 10)
    : undefined;
  const endYear = searchParams.get("endYear")
    ? parseInt(searchParams.get("endYear")!, 10)
    : undefined;

  const cacheKey = `metrics:yearly:${metric}:${startYear ?? ""}:${endYear ?? ""}`;
  const cached = cache.get<YearlyMetric[]>(cacheKey);
  if (cached) {
    return NextResponse.json(cached);
  }

  const yearFilter =
    startYear !== undefined || endYear !== undefined
      ? {
          year: {
            ...(startYear !== undefined ? { gte: startYear } : {}),
            ...(endYear !== undefined ? { lte: endYear } : {}),
          },
        }
      : { year: { not: null } };

  let rows: YearlyMetric[];

  if (metric === "output_by_category") {
    const snapshots = await prisma.metricSnapshot.findMany({
      where: {
        metricKey: { startsWith: "output_count_by_category_year:" },
        ...yearFilter,
      },
      orderBy: [{ metricKey: "asc" }, { year: "asc" }],
    });

    rows = snapshots
      .filter((s) => s.year !== null)
      .map((s) => ({
        year: s.year as number,
        value: s.value,
        metadata: {
          ...(s.metadata as Record<string, unknown> | null),
          metricKey: s.metricKey,
          category: s.metricKey.replace("output_count_by_category_year:", ""),
        },
      }));
  } else {
    const metricKey = METRIC_KEY_MAP[metric]!;
    const snapshots = await prisma.metricSnapshot.findMany({
      where: { metricKey, ...yearFilter },
      orderBy: { year: "asc" },
    });

    rows = snapshots
      .filter((s) => s.year !== null)
      .map((s) => ({
        year: s.year as number,
        value: s.value,
        metadata: (s.metadata as Record<string, unknown> | null) ?? undefined,
      }));
  }

  cache.set(cacheKey, rows, TTL_MS);
  return NextResponse.json(rows, {
    headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=60" },
  });
}
