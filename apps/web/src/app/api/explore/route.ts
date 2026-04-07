import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cache } from "@/lib/cache";
import type { ExploreMode, ExploreResult } from "@/lib/types";

const TTL_MS = 5 * 60 * 1000; // 5 minutes

const MODE_META: Record<ExploreMode, { label: string; description: string }> = {
  1: { label: "Projects by Year", description: "Number of funded projects per approval year" },
  2: { label: "OA Rate Trend", description: "Open access publication rate over time" },
  3: { label: "Output Categories", description: "Output counts by category and year" },
  4: { label: "Funding Efficiency", description: "Average approved amount and outputs per project by year" },
  5: { label: "Open Data Rate", description: "Share of research data outputs provided to others" },
  6: { label: "Open Software Rate", description: "Share of software outputs with a DOI" },
  7: { label: "Summary Statistics", description: "Overall totals and year range" },
  8: { label: "Institution Rankings", description: "Top 20 institutions by project count" },
  9: { label: "Output Type Distribution", description: "Counts of each output category across all time" },
  10: { label: "Further Funding Overview", description: "Cross-funder landscape by country and sector" },
};

async function fetchMode(mode: ExploreMode): Promise<unknown> {
  switch (mode) {
    case 1: {
      const rows = await prisma.metricSnapshot.findMany({
        where: { metricKey: "project_count_by_year", year: { not: null } },
        orderBy: { year: "asc" },
        select: { year: true, value: true },
      });
      return rows.map((r) => ({ year: r.year, count: r.value }));
    }

    case 2: {
      const rows = await prisma.metricSnapshot.findMany({
        where: { metricKey: "oa_publication_rate_by_year", year: { not: null } },
        orderBy: { year: "asc" },
        select: { year: true, value: true, metadata: true },
      });
      return rows.map((r) => ({
        year: r.year,
        oaRate: r.value,
        ...(r.metadata as object | null),
      }));
    }

    case 3: {
      const rows = await prisma.metricSnapshot.findMany({
        where: { metricKey: { startsWith: "output_count_by_category_year:" }, year: { not: null } },
        orderBy: [{ metricKey: "asc" }, { year: "asc" }],
        select: { metricKey: true, year: true, value: true },
      });
      return rows.map((r) => ({
        category: r.metricKey.replace("output_count_by_category_year:", ""),
        year: r.year,
        count: r.value,
      }));
    }

    case 4: {
      const rows = await prisma.metricSnapshot.findMany({
        where: { metricKey: "funding_efficiency_by_year", year: { not: null } },
        orderBy: { year: "asc" },
        select: { year: true, value: true, metadata: true },
      });
      return rows.map((r) => ({
        year: r.year,
        avgApprovedAmount: r.value,
        ...(r.metadata as object | null),
      }));
    }

    case 5: {
      const rows = await prisma.metricSnapshot.findMany({
        where: { metricKey: "open_data_rate_by_year", year: { not: null } },
        orderBy: { year: "asc" },
        select: { year: true, value: true, metadata: true },
      });
      return rows.map((r) => ({
        year: r.year,
        openDataRate: r.value,
        ...(r.metadata as object | null),
      }));
    }

    case 6: {
      const rows = await prisma.metricSnapshot.findMany({
        where: { metricKey: "open_software_rate_by_year", year: { not: null } },
        orderBy: { year: "asc" },
        select: { year: true, value: true, metadata: true },
      });
      return rows.map((r) => ({
        year: r.year,
        openSoftwareRate: r.value,
        ...(r.metadata as object | null),
      }));
    }

    case 7: {
      const snap = await prisma.metricSnapshot.findFirst({
        where: { metricKey: "summary" },
        select: { value: true, metadata: true, computedAt: true },
      });
      return snap
        ? { totalProjects: snap.value, computedAt: snap.computedAt, ...(snap.metadata as object | null) }
        : null;
    }

    case 8: {
      const snaps = await prisma.metricSnapshot.findMany({
        where: { metricKey: "institution_project_count" },
        orderBy: { value: "desc" },
        take: 20,
        select: { rorId: true, value: true, metadata: true },
      });

      const rorIds = snaps.map((s) => s.rorId).filter(Boolean) as string[];
      const institutions = await prisma.institution.findMany({
        where: { rorId: { in: rorIds } },
        select: { rorId: true, name: true, country: true },
      });
      const instMap = new Map(institutions.map((i) => [i.rorId, i]));

      return snaps.map((s) => {
        const inst = s.rorId ? instMap.get(s.rorId) : undefined;
        return {
          rorId: s.rorId,
          name: inst?.name ?? s.rorId,
          country: inst?.country ?? null,
          projectCount: s.value,
          ...(s.metadata as object | null),
        };
      });
    }

    case 9: {
      // Aggregate latest output counts by category across all years
      const rows = await prisma.metricSnapshot.findMany({
        where: { metricKey: { startsWith: "output_count_by_category_year:" } },
        select: { metricKey: true, value: true },
      });

      const totals: Record<string, number> = {};
      for (const row of rows) {
        const cat = row.metricKey.replace("output_count_by_category_year:", "");
        totals[cat] = (totals[cat] ?? 0) + row.value;
      }

      return Object.entries(totals)
        .map(([category, count]) => ({ category, count }))
        .sort((a, b) => b.count - a.count);
    }

    case 10: {
      // Country and sector breakdown from FurtherFunding table
      const [byCountry, bySector] = await prisma.$transaction([
        prisma.furtherFunding.groupBy({
          by: ["country"],
          _count: { id: true },
          where: { country: { not: null } },
          orderBy: { _count: { id: "desc" } },
          take: 20,
        }),
        prisma.furtherFunding.groupBy({
          by: ["sector"],
          _count: { id: true },
          where: { sector: { not: null } },
          orderBy: { _count: { id: "desc" } },
          take: 20,
        }),
      ]);

      return {
        byCountry: byCountry.map((r) => ({ country: r.country, count: (r._count as { id: number }).id })),
        bySector: bySector.map((r) => ({ sector: r.sector, count: (r._count as { id: number }).id })),
      };
    }
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const modeRaw = parseInt(searchParams.get("mode") ?? "", 10);

  if (isNaN(modeRaw) || modeRaw < 1 || modeRaw > 10) {
    return NextResponse.json(
      { error: "Query param 'mode' is required and must be an integer between 1 and 10" },
      { status: 400 }
    );
  }

  const mode = modeRaw as ExploreMode;
  const cacheKey = `explore:${mode}`;
  const cached = cache.get<ExploreResult>(cacheKey);
  if (cached) {
    return NextResponse.json(cached);
  }

  const data = await fetchMode(mode);
  const result: ExploreResult = {
    mode,
    label: MODE_META[mode].label,
    description: MODE_META[mode].description,
    data,
  };

  cache.set(cacheKey, result, TTL_MS);
  return NextResponse.json(result, {
    headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=60" },
  });
}
