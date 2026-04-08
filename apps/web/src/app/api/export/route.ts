import { NextRequest, NextResponse } from "next/server";
import Papa from "papaparse";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { ExportFormat, ExportType } from "@/lib/types";

function bigintToNumber(v: bigint | null | undefined): number | null {
  if (v == null) return null;
  return Number(v);
}

function buildResponse(
  data: object[],
  format: ExportFormat,
  filename: string
): NextResponse {
  if (format === "csv") {
    const csv = Papa.unparse(data);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}.csv"`,
      },
    });
  }

  return new NextResponse(JSON.stringify(data, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}.json"`,
    },
  });
}

async function exportProjects(params: {
  year?: number;
  institution?: string;
  status?: string;
}): Promise<object[]> {
  const where: Prisma.ProjectWhereInput = {
    ...(params.year ? { approvalYear: params.year } : {}),
    ...(params.institution ? { piInstitutionRor: params.institution } : {}),
    ...(params.status ? { statusEn: { equals: params.status, mode: "insensitive" } } : {}),
  };

  const rows = await prisma.project.findMany({
    where,
    orderBy: [{ approvalYear: "desc" }, { id: "asc" }],
    select: {
      id: true,
      grantDoi: true,
      titleEn: true,
      programEn: true,
      statusEn: true,
      approvalYear: true,
      approvedAmount: true,
      piFirstName: true,
      piLastName: true,
      piOrcid: true,
      piRole: true,
      piInstitutionName: true,
      piInstitutionRor: true,
      researchRadarUrl: true,
      keywords: true,
      disciplinesEn: true,
      fieldsEn: true,
      _count: { select: { outputs: true } },
    },
  });

  return rows.map((p) => ({
    id: p.id,
    grantDoi: p.grantDoi,
    titleEn: p.titleEn,
    programEn: p.programEn,
    statusEn: p.statusEn,
    approvalYear: p.approvalYear,
    approvedAmountEur: bigintToNumber(p.approvedAmount),
    piFirstName: p.piFirstName,
    piLastName: p.piLastName,
    piOrcid: p.piOrcid,
    piRole: p.piRole,
    piInstitutionName: p.piInstitutionName,
    piInstitutionRor: p.piInstitutionRor,
    researchRadarUrl: p.researchRadarUrl,
    keywords: p.keywords.join("; "),
    disciplinesEn: p.disciplinesEn.join("; "),
    fieldsEn: p.fieldsEn.join("; "),
    outputCount: p._count.outputs,
  }));
}

async function exportOutputs(params: {
  category?: string;
  hasDoi?: boolean;
  year?: number;
}): Promise<object[]> {
  const where: Prisma.OutputWhereInput = {
    ...(params.category ? { category: { equals: params.category, mode: "insensitive" } } : {}),
    ...(params.hasDoi !== undefined ? { hasDoi: params.hasDoi } : {}),
    ...(params.year !== undefined ? { years: { has: params.year } } : {}),
  };

  const rows = await prisma.output.findMany({
    where,
    orderBy: [{ category: "asc" }, { id: "asc" }],
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
  });

  return rows.map((o) => ({
    ...o,
    years: o.years.join("; "),
  }));
}

async function exportMetrics(params: { metricKey?: string }): Promise<object[]> {
  const where: Prisma.MetricSnapshotWhereInput = params.metricKey
    ? { metricKey: params.metricKey }
    : {};

  const rows = await prisma.metricSnapshot.findMany({
    where,
    orderBy: [{ metricKey: "asc" }, { year: "asc" }],
    select: {
      metricKey: true,
      year: true,
      rorId: true,
      value: true,
      computedAt: true,
    },
  });

  return rows.map((r) => ({
    metricKey: r.metricKey,
    year: r.year,
    rorId: r.rorId,
    value: r.value,
    computedAt: r.computedAt.toISOString(),
  }));
}

async function exportInstitutions(): Promise<object[]> {
  const rows = await prisma.institution.findMany({
    orderBy: { projectCount: "desc" },
  });

  return rows.map((i) => ({
    rorId: i.rorId,
    name: i.name,
    country: i.country,
    projectCount: i.projectCount,
    outputCount: i.outputCount,
  }));
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const type = (searchParams.get("type") ?? "") as ExportType;
  const format = (searchParams.get("format") ?? "json") as ExportFormat;

  const VALID_TYPES: ExportType[] = ["projects", "outputs", "metrics", "institutions"];
  const VALID_FORMATS: ExportFormat[] = ["csv", "json"];

  if (!VALID_TYPES.includes(type)) {
    return NextResponse.json(
      { error: `Query param 'type' is required. Must be one of: ${VALID_TYPES.join(", ")}` },
      { status: 400 }
    );
  }
  if (!VALID_FORMATS.includes(format)) {
    return NextResponse.json(
      { error: `Query param 'format' must be 'csv' or 'json'` },
      { status: 400 }
    );
  }

  const year = searchParams.get("year")
    ? parseInt(searchParams.get("year")!, 10)
    : undefined;
  const institution = searchParams.get("institution") ?? undefined;
  const status = searchParams.get("status") ?? undefined;
  const category = searchParams.get("category") ?? undefined;
  const hasDoiParam = searchParams.get("hasDoi");
  const hasDoi =
    hasDoiParam === "true" ? true : hasDoiParam === "false" ? false : undefined;
  const metricKey = searchParams.get("metricKey") ?? undefined;

  let data: object[];
  try {
    switch (type) {
      case "projects":
        data = await exportProjects({ year, institution, status });
        break;
      case "outputs":
        data = await exportOutputs({ category, hasDoi, year });
        break;
      case "metrics":
        data = await exportMetrics({ metricKey });
        break;
      case "institutions":
        data = await exportInstitutions();
        break;
    }
  } catch (err: unknown) {
    const e = err as { code?: string; meta?: { table?: string } };
    if (e?.code === "P2021") {
      console.warn(`Table ${e?.meta?.table ?? "unknown"} does not exist yet. Returning empty export.`);
      data = [];
    } else {
      console.error("Export error:", err);
      return NextResponse.json({ error: "Export failed" }, { status: 500 });
    }
  }

  const timestamp = new Date().toISOString().split("T")[0];
  const filename = `fwf-${type}-${timestamp}`;

  return buildResponse(data, format, filename);
}
