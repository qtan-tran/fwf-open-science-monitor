import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, AlertTriangle, Users, FolderOpen, FileOutput, TrendingUp } from "lucide-react";
import { getInstitutionRankings, getProjects } from "@/lib/api-client";
import type { InstitutionRanking, ProjectListItem } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";
import { StatCard } from "@/components/ui/StatCard";
import { ChartCard } from "@/components/ui/ChartCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { InstitutionTrendChart, type YearCount } from "@/components/institutions/InstitutionTrendChart";
import { InstitutionCategoryChart, type CategoryCount } from "@/components/institutions/InstitutionCategoryChart";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ rorId: string }>;
}

// Countries that are mock/benchmark data
const MOCK_COUNTRIES = new Set(["DE", "UK", "FR", "IT", "ES", "PL", "NL", "BE"]);

const COUNTRY_FLAGS: Record<string, string> = {
  AT: "🇦🇹", DE: "🇩🇪", UK: "🇬🇧", FR: "🇫🇷", IT: "🇮🇹",
  ES: "🇪🇸", PL: "🇵🇱", NL: "🇳🇱", BE: "🇧🇪", CH: "🇨🇭",
  US: "🇺🇸", GB: "🇬🇧",
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  try {
    const { rorId } = await params;
    const rorIdDecoded = decodeURIComponent(rorId);
    const institutions = await getInstitutionRankings({ sortBy: "project_count", limit: 300 });
    const inst = institutions.find((i) => i.rorId === rorIdDecoded);
    return { title: inst?.name ?? "Institution" };
  } catch {
    return { title: "Institution" };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function groupByYear(projects: ProjectListItem[]): YearCount[] {
  const map = new Map<number, number>();
  for (const p of projects) {
    if (p.approvalYear) map.set(p.approvalYear, (map.get(p.approvalYear) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .map(([year, count]) => ({ year, count }))
    .sort((a, b) => a.year - b.year);
}

function topPIs(
  projects: ProjectListItem[]
): Array<{ name: string; count: number; orcid: string | null }> {
  const map = new Map<string, { count: number; orcid: string | null }>();
  for (const p of projects) {
    const name = [p.piFirstName, p.piLastName].filter(Boolean).join(" ");
    if (!name) continue;
    const existing = map.get(name);
    map.set(name, {
      count: (existing?.count ?? 0) + 1,
      orcid: existing?.orcid ?? null,
    });
  }
  return Array.from(map.entries())
    .map(([name, { count, orcid }]) => ({ name, count, orcid }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}

function buildCategoryData(inst: InstitutionRanking): CategoryCount[] {
  // We have publication_count and total output_count from the ranking.
  // Show a minimal breakdown: publications vs. other outputs.
  const publications = inst.publicationCount;
  const other = Math.max(0, inst.outputCount - publications);
  const data: CategoryCount[] = [];
  if (publications > 0) data.push({ category: "Publications", count: publications });
  if (other > 0) data.push({ category: "Other outputs", count: other });
  return data;
}

// ---------------------------------------------------------------------------
// Section wrapper
// ---------------------------------------------------------------------------

function Section({
  icon: Icon,
  title,
  children,
  className = "",
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm overflow-hidden ${className}`}>
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-gray-100 dark:border-gray-800">
        <Icon className="h-4 w-4 text-gray-400 dark:text-gray-500 flex-shrink-0" aria-hidden />
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
      </div>
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function InstitutionDetailPage({ params }: PageProps) {
  const { rorId } = await params;
  const rorIdDecoded = decodeURIComponent(rorId);

  const [institutionsResult, projectsResult] = await Promise.allSettled([
    getInstitutionRankings({ sortBy: "project_count", limit: 300 }),
    getProjects({ institution: rorIdDecoded, limit: 200 }),
  ]);

  const allInstitutions = institutionsResult.status === "fulfilled" ? institutionsResult.value : [];
  const projectsData    = projectsResult.status    === "fulfilled" ? projectsResult.value    : null;

  const inst = allInstitutions.find((i) => i.rorId === rorIdDecoded);
  if (!inst) notFound();

  const projects   = projectsData?.data ?? [];
  const yearCounts = groupByYear(projects);
  const piList     = topPIs(projects);
  const catData    = buildCategoryData(inst);
  const isMock     = MOCK_COUNTRIES.has(inst.country);
  const flag       = COUNTRY_FLAGS[inst.country] ?? "";

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8 max-w-4xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb">
        <Link
          href="/institutions"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Institutions
        </Link>
      </nav>

      {/* Mock data warning */}
      {isMock && (
        <div className="flex gap-2 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/20 px-5 py-4 text-sm text-amber-700 dark:text-amber-400">
          <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" aria-hidden />
          <span>
            <strong>Mock / Benchmark Data —</strong> This is an illustrative entry for a non-Austrian
            institution. FWF only funds Austrian research; this institution is included as a
            benchmark reference only.
          </span>
        </div>
      )}

      {/* Header card */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm p-5">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          {flag && <span className="text-2xl" aria-label={`Country: ${inst.country}`}>{flag}</span>}
          <Badge label={inst.country || "Unknown"} variant="neutral" />
          {isMock && <Badge label="Mock / Benchmark" variant="warning" />}
        </div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-50 leading-snug mb-2">
          {inst.name}
        </h1>
        <div className="flex flex-wrap items-center gap-3">
          <a
            href={inst.rorId.startsWith("http") ? inst.rorId : `https://ror.org/${inst.rorId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-600 hover:text-primary-600 dark:hover:text-primary-400 font-mono transition-colors"
          >
            {inst.rorId}
            <ExternalLink className="h-3 w-3" aria-hidden />
          </a>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          title="Projects"
          value={inst.projectCount}
          icon={FolderOpen}
        />
        <StatCard
          title="Outputs"
          value={inst.outputCount}
          icon={FileOutput}
        />
        <StatCard
          title="Publications"
          value={inst.publicationCount}
          icon={FileOutput}
        />
        <StatCard
          title="OA Rate"
          value={`${inst.oaPublicationRate.toFixed(1)}`}
          unit="%"
          icon={TrendingUp}
          trend={inst.oaPublicationRate >= 60 ? "up" : inst.oaPublicationRate >= 30 ? "neutral" : "down"}
          trendLabel="publications open access"
        />
      </div>

      {/* Yearly trend chart */}
      <ChartCard
        title="Project Approvals per Year"
        subtitle="Number of FWF projects approved by year at this institution"
      >
        {yearCounts.length > 0 ? (
          <InstitutionTrendChart data={yearCounts} />
        ) : (
          <EmptyState
            title="No yearly data"
            description="No projects found for this institution."
            icon={FolderOpen}
          />
        )}
      </ChartCard>

      {/* Output category chart */}
      {catData.length > 0 && (
        <ChartCard
          title="Output Breakdown"
          subtitle="Publications vs. other research outputs (pre-computed)"
        >
          <InstitutionCategoryChart data={catData} />
        </ChartCard>
      )}

      {/* Top PIs */}
      <Section icon={Users} title={`Top Researchers (${piList.length})`}>
        {piList.length > 0 ? (
          <div className="overflow-x-auto rounded-lg border border-gray-100 dark:border-gray-800">
            <table className="min-w-full divide-y divide-gray-100 dark:divide-gray-800 text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800/60">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">PI Name</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap">Projects</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800 bg-white dark:bg-gray-900">
                {piList.map(({ name, count }) => (
                  <tr key={name} className="hover:bg-gray-50 dark:hover:bg-gray-800/30">
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300 font-medium">{name}</td>
                    <td className="px-4 py-3 text-right text-gray-500 dark:text-gray-400">{count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-gray-400 dark:text-gray-600 italic">No researcher data available.</p>
        )}
      </Section>

      {/* Recent projects */}
      <Section icon={FolderOpen} title={`Projects (${projectsData?.total ?? 0})`}>
        {projects.length > 0 ? (
          <>
            <div className="overflow-x-auto rounded-lg border border-gray-100 dark:border-gray-800">
              <table className="min-w-full divide-y divide-gray-100 dark:divide-gray-800 text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800/60">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Title</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap">Year</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Status</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap">Outputs</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800 bg-white dark:bg-gray-900">
                  {projects.slice(0, 30).map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30">
                      <td className="px-3 py-2 max-w-xs">
                        <Link
                          href={`/projects/${p.id}`}
                          className="text-primary-600 dark:text-primary-400 hover:underline line-clamp-2 leading-snug"
                        >
                          {p.titleEn}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                        {p.approvalYear ?? "—"}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {p.statusEn
                          ? <Badge label={p.statusEn} variant={p.statusEn === "Ongoing" ? "success" : "neutral"} />
                          : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-3 py-2 text-right text-gray-500 dark:text-gray-400">
                        {p.outputCount}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {(projectsData?.total ?? 0) > 30 && (
              <p className="mt-2 text-xs text-gray-400 dark:text-gray-600">
                Showing 30 of {projectsData?.total} projects.{" "}
                <Link
                  href={`/projects?institution=${encodeURIComponent(rorIdDecoded)}`}
                  className="text-primary-600 dark:text-primary-400 hover:underline"
                >
                  View all →
                </Link>
              </p>
            )}
          </>
        ) : (
          <p className="text-sm text-gray-400 dark:text-gray-600 italic">No projects found.</p>
        )}
      </Section>
    </div>
  );
}
