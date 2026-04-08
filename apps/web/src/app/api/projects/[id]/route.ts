import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cache } from "@/lib/cache";
import type { ProjectDetail, OutputListItem, FurtherFundingItem } from "@/lib/types";

const TTL_MS = 5 * 60 * 1000; // 5 minutes

function bigintToNumber(v: bigint | null | undefined): number | null {
  if (v == null) return null;
  return Number(v);
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const cacheKey = `project:${id}`;
  const cached = cache.get<ProjectDetail>(cacheKey);
  if (cached) {
    return NextResponse.json(cached);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let project: any;
  try {
    project = await prisma.project.findUnique({
      where: { id },
      include: {
        outputs: {
          select: {
            id: true,
            doi: true,
            title: true,
            category: true,
            type: true,
            years: true,
            url: true,
            hasDoi: true,
            hasPmid: true,
            pmid: true,
            journal: true,
            publisher: true,
            providedToOthers: true,
          },
          orderBy: { category: "asc" },
        },
        furtherFunding: {
          select: {
            id: true,
            funder: true,
            fundingId: true,
            country: true,
            sector: true,
            title: true,
            type: true,
            startYear: true,
            endYear: true,
            funderProjectUrl: true,
          },
          orderBy: { startYear: "desc" },
        },
      },
    });
  } catch (error: unknown) {
    const e = error as { code?: string; meta?: { table?: string } };
    if (e?.code === "P2021") {
      console.warn(`Table ${e?.meta?.table ?? "Project"} does not exist yet.`);
      return NextResponse.json({ error: `Project '${id}' not found` }, { status: 404 });
    }
    console.error("Database error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  if (!project) {
    return NextResponse.json({ error: `Project '${id}' not found` }, { status: 404 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const outputs: OutputListItem[] = project.outputs.map((o: any) => ({
    id: o.id,
    doi: o.doi,
    title: o.title,
    category: o.category,
    type: o.type,
    years: o.years,
    url: o.url,
    hasDoi: o.hasDoi,
    hasPmid: o.hasPmid,
    pmid: o.pmid,
    journal: o.journal,
    publisher: o.publisher,
    providedToOthers: o.providedToOthers,
  }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const furtherFunding: FurtherFundingItem[] = project.furtherFunding.map((f: any) => ({
    id: f.id,
    funder: f.funder,
    fundingId: f.fundingId,
    country: f.country,
    sector: f.sector,
    title: f.title,
    type: f.type,
    startYear: f.startYear,
    endYear: f.endYear,
    funderProjectUrl: f.funderProjectUrl,
  }));

  const detail: ProjectDetail = {
    id: project.id,
    grantDoi: project.grantDoi,
    titleEn: project.titleEn,
    titleDe: project.titleDe,
    summaryEn: project.summaryEn,
    programEn: project.programEn,
    statusEn: project.statusEn,
    approvalDate: project.approvalDate?.toISOString() ?? null,
    startDate: project.startDate?.toISOString() ?? null,
    endDate: project.endDate?.toISOString() ?? null,
    approvedAmount: bigintToNumber(project.approvedAmount),
    approvalYear: project.approvalYear,
    piFirstName: project.piFirstName,
    piLastName: project.piLastName,
    piOrcid: project.piOrcid,
    piRole: project.piRole,
    piInstitutionName: project.piInstitutionName,
    piInstitutionRor: project.piInstitutionRor,
    researchRadarUrl: project.researchRadarUrl,
    keywords: project.keywords,
    disciplinesEn: project.disciplinesEn,
    fieldsEn: project.fieldsEn,
    outputs,
    furtherFunding,
  };

  cache.set(cacheKey, detail, TTL_MS);
  return NextResponse.json(detail, {
    headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=60" },
  });
}
