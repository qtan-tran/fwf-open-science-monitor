import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cache } from "@/lib/cache";
import type { InstitutionRanking } from "@/lib/types";

const TTL_MS = 5 * 60 * 1000; // 5 minutes
const VALID_SORT = ["project_count", "output_count", "oa_rate"] as const;
type SortBy = (typeof VALID_SORT)[number];

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const sortBy = (searchParams.get("sortBy") ?? "project_count") as SortBy;
  if (!VALID_SORT.includes(sortBy)) {
    return NextResponse.json(
      { error: `sortBy must be one of: ${VALID_SORT.join(", ")}` },
      { status: 400 }
    );
  }

  const limitRaw = parseInt(searchParams.get("limit") ?? "20", 10);
  const limit = isNaN(limitRaw) || limitRaw < 1 ? 20 : Math.min(limitRaw, 200);
  const country = searchParams.get("country") ?? undefined;

  const cacheKey = `metrics:institutions:${sortBy}:${limit}:${country ?? ""}`;
  const cached = cache.get<InstitutionRanking[]>(cacheKey);
  if (cached) {
    return NextResponse.json(cached);
  }

  // Fetch MetricSnapshot rows for institution metrics (includes OA rate in metadata)
  const snapshots = await prisma.metricSnapshot.findMany({
    where: { metricKey: "institution_project_count" },
  });

  // Fetch all institutions (filtered by country if provided)
  const institutions = await prisma.institution.findMany({
    where: country ? { country } : {},
  });

  const institutionMap = new Map(institutions.map((i) => [i.rorId, i]));
  const snapshotMap = new Map(
    snapshots.map((s) => [s.rorId, s])
  );

  // Merge: only include institutions that have both a snapshot and institution record
  // (or all institutions when country filter applies)
  const rankings: InstitutionRanking[] = [];

  for (const inst of institutions) {
    const snap = snapshotMap.get(inst.rorId);
    const meta = snap
      ? (snap.metadata as Record<string, unknown> | null)
      : null;

    rankings.push({
      rorId: inst.rorId,
      name: inst.name,
      country: inst.country,
      projectCount: snap ? Math.round(snap.value) : inst.projectCount,
      outputCount: (meta?.output_count as number) ?? inst.outputCount,
      publicationCount: (meta?.publication_count as number) ?? 0,
      oaPublicationRate: (meta?.oa_publication_rate as number) ?? 0,
    });
  }

  // For institutions in snapshots but not in the filtered institution list,
  // add them only when there's no country filter
  if (!country) {
    for (const snap of snapshots) {
      if (snap.rorId && !institutionMap.has(snap.rorId)) {
        const meta = snap.metadata as Record<string, unknown> | null;
        rankings.push({
          rorId: snap.rorId,
          name: snap.rorId, // fallback to ROR ID if not in Institution table
          country: "",
          projectCount: Math.round(snap.value),
          outputCount: (meta?.output_count as number) ?? 0,
          publicationCount: (meta?.publication_count as number) ?? 0,
          oaPublicationRate: (meta?.oa_publication_rate as number) ?? 0,
        });
      }
    }
  }

  // Sort
  rankings.sort((a, b) => {
    if (sortBy === "output_count") return b.outputCount - a.outputCount;
    if (sortBy === "oa_rate") return b.oaPublicationRate - a.oaPublicationRate;
    return b.projectCount - a.projectCount; // default: project_count
  });

  const result = rankings.slice(0, limit);
  cache.set(cacheKey, result, TTL_MS);
  return NextResponse.json(result);
}
