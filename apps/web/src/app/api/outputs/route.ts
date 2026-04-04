import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { cache } from "@/lib/cache";
import type { PaginatedResponse, OutputListItem } from "@/lib/types";

const TTL_MS = 5 * 60 * 1000; // 5 minutes

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const limit = Math.min(
    100,
    Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10) || 20)
  );
  const category = searchParams.get("category") ?? undefined;
  const hasDoiParam = searchParams.get("hasDoi");
  const hasDoi =
    hasDoiParam === "true" ? true : hasDoiParam === "false" ? false : undefined;
  const year = searchParams.get("year")
    ? parseInt(searchParams.get("year")!, 10)
    : undefined;
  const projectId = searchParams.get("projectId") ?? undefined;

  const cacheKey = `outputs:${page}:${limit}:${category ?? ""}:${hasDoi ?? ""}:${year ?? ""}:${projectId ?? ""}`;
  const cached = cache.get<PaginatedResponse<OutputListItem>>(cacheKey);
  if (cached) {
    return NextResponse.json(cached);
  }

  const where: Prisma.OutputWhereInput = {
    ...(category ? { category: { equals: category, mode: "insensitive" } } : {}),
    ...(hasDoi !== undefined ? { hasDoi } : {}),
    ...(year !== undefined ? { years: { has: year } } : {}),
    ...(projectId ? { projects: { some: { id: projectId } } } : {}),
  };

  const [total, outputs] = await prisma.$transaction([
    prisma.output.count({ where }),
    prisma.output.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { category: "asc" },
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
    }),
  ]);

  const data: OutputListItem[] = outputs.map((o) => ({
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

  const response: PaginatedResponse<OutputListItem> = {
    data,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };

  cache.set(cacheKey, response, TTL_MS);
  return NextResponse.json(response);
}
