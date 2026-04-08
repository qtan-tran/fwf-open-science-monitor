import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { cache } from "@/lib/cache";
import type { PaginatedResponse, ProjectListItem } from "@/lib/types";

const TTL_MS = 5 * 60 * 1000; // 5 minutes

function bigintToNumber(v: bigint | null | undefined): number | null {
  if (v == null) return null;
  return Number(v);
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const limit = Math.min(
    100,
    Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10) || 20)
  );
  const year = searchParams.get("year")
    ? parseInt(searchParams.get("year")!, 10)
    : undefined;
  const institution = searchParams.get("institution") ?? undefined;
  const status = searchParams.get("status") ?? undefined;
  const search = searchParams.get("search") ?? undefined;
  const hasOutputsParam = searchParams.get("hasOutputs");
  const hasOutputs =
    hasOutputsParam === "true" ? true : hasOutputsParam === "false" ? false : undefined;

  const cacheKey = `projects:${page}:${limit}:${year ?? ""}:${institution ?? ""}:${status ?? ""}:${search ?? ""}:${hasOutputs ?? ""}`;
  const cached = cache.get<PaginatedResponse<ProjectListItem>>(cacheKey);
  if (cached) {
    return NextResponse.json(cached);
  }

  const where: Prisma.ProjectWhereInput = {
    ...(year !== undefined ? { approvalYear: year } : {}),
    ...(institution ? { piInstitutionRor: institution } : {}),
    ...(status ? { statusEn: { equals: status, mode: "insensitive" } } : {}),
    ...(search
      ? {
          OR: [
            { titleEn: { contains: search, mode: "insensitive" } },
            { titleDe: { contains: search, mode: "insensitive" } },
            { summaryEn: { contains: search, mode: "insensitive" } },
            { piFirstName: { contains: search, mode: "insensitive" } },
            { piLastName: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(hasOutputs === true
      ? { outputs: { some: {} } }
      : hasOutputs === false
        ? { outputs: { none: {} } }
        : {}),
  };

  const selectFields = {
    id: true,
    grantDoi: true,
    titleEn: true,
    programEn: true,
    statusEn: true,
    approvalYear: true,
    approvedAmount: true,
    piFirstName: true,
    piLastName: true,
    piInstitutionName: true,
    piInstitutionRor: true,
    keywords: true,
    fieldsEn: true,
    _count: { select: { outputs: true } },
  } as const;

  let total: number;
  let projects: Prisma.ProjectGetPayload<{ select: typeof selectFields }>[];

  try {
    [total, projects] = await prisma.$transaction([
      prisma.project.count({ where }),
      prisma.project.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ approvalYear: "desc" }, { id: "asc" }],
        select: selectFields,
      }),
    ]) as [number, Prisma.ProjectGetPayload<{ select: typeof selectFields }>[]];
  } catch (error: unknown) {
    const e = error as { code?: string; meta?: { table?: string } };
    if (e?.code === "P2021") {
      console.warn(`Table ${e?.meta?.table ?? "Project"} does not exist yet. Returning empty data.`);
      return NextResponse.json(
        { data: [], total: 0, page, limit, totalPages: 0 },
        { status: 200 }
      );
    }
    console.error("Database error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  const data: ProjectListItem[] = projects.map((p) => ({
    id: p.id,
    grantDoi: p.grantDoi,
    titleEn: p.titleEn,
    programEn: p.programEn,
    statusEn: p.statusEn,
    approvalYear: p.approvalYear,
    approvedAmount: bigintToNumber(p.approvedAmount),
    piFirstName: p.piFirstName,
    piLastName: p.piLastName,
    piInstitutionName: p.piInstitutionName,
    piInstitutionRor: p.piInstitutionRor,
    keywords: p.keywords,
    fieldsEn: p.fieldsEn,
    outputCount: p._count.outputs,
  }));

  const response: PaginatedResponse<ProjectListItem> = {
    data,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };

  cache.set(cacheKey, response, TTL_MS);
  return NextResponse.json(response, {
    headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=60" },
  });
}
