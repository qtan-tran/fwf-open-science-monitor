import type { Metadata } from "next";
import { getProjects, getExportUrl } from "@/lib/api-client";
import { ProjectsView } from "@/components/projects/ProjectsView";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Projects" };

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function sp(v: string | string[] | undefined): string {
  return typeof v === "string" ? v : "";
}

export default async function ProjectsPage({ searchParams }: PageProps) {
  const params = await searchParams;

  const page    = Math.max(1, parseInt(sp(params.page) || "1", 10));
  const search  = sp(params.search);
  const year    = sp(params.year);
  const status  = sp(params.status);
  const hasOuts = sp(params.hasOutputs);

  const projectsResult = await getProjects({
    page,
    limit: 20,
    search:     search  || undefined,
    year:       year    ? parseInt(year, 10) : undefined,
    status:     status  || undefined,
    hasOutputs: hasOuts === "true" ? true : hasOuts === "false" ? false : undefined,
  }).catch(() => ({ data: [], total: 0, page: 1, limit: 20, totalPages: 0 }));

  const projects = projectsResult;

  const exportUrl = getExportUrl({
    type:   "projects",
    format: "csv",
    year:   year   ? parseInt(year,   10) : undefined,
    status: status || undefined,
  });

  return (
    <ProjectsView
      projects={projects}
      exportUrl={exportUrl}
      filters={{ search, year, status, hasOutputs: hasOuts }}
    />
  );
}
