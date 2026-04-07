import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ExternalLink,
  BookOpen,
  Users,
  Calendar,
  BadgeEuro,
  Globe,
  FileOutput,
  Tag,
} from "lucide-react";
import { getProject } from "@/lib/api-client";
import type { OutputListItem, FurtherFundingItem } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  try {
    const { id } = await params;
    const project = await getProject(id);
    return { title: project.titleEn };
  } catch {
    return { title: "Project" };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-AT", {
    year: "numeric", month: "short", day: "numeric",
  });
}

function formatEur(n: number | null): string {
  if (n == null) return "—";
  return n.toLocaleString("de-AT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
}

function groupByCategory(outputs: OutputListItem[]): Map<string, OutputListItem[]> {
  const map = new Map<string, OutputListItem[]>();
  for (const o of outputs) {
    const list = map.get(o.category) ?? [];
    list.push(o);
    map.set(o.category, list);
  }
  return map;
}

// ---------------------------------------------------------------------------
// Section wrapper
// ---------------------------------------------------------------------------

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm overflow-hidden">
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-gray-100 dark:border-gray-800">
        <Icon className="h-4 w-4 text-gray-400 dark:text-gray-500 flex-shrink-0" aria-hidden />
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
      </div>
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Output table (grouped by category)
// ---------------------------------------------------------------------------

function OutputsSection({ outputs }: { outputs: OutputListItem[] }) {
  if (!outputs.length) {
    return (
      <EmptyState
        title="No outputs linked"
        description="This project has no linked research outputs in the database."
        icon={FileOutput}
      />
    );
  }

  const grouped = groupByCategory(outputs);

  return (
    <div className="space-y-5">
      {Array.from(grouped.entries()).map(([category, items]) => (
        <div key={category}>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 capitalize">
            {category} ({items.length})
          </h3>
          <div className="overflow-x-auto rounded-lg border border-gray-100 dark:border-gray-800">
            <table className="min-w-full divide-y divide-gray-100 dark:divide-gray-800 text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800/60">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Title</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap">Year(s)</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">DOI / Link</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800 bg-white dark:bg-gray-900">
                {items.map((o) => (
                  <tr key={o.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30">
                    <td className="px-3 py-2 text-gray-700 dark:text-gray-300 max-w-sm">
                      <span className="line-clamp-2 leading-snug">{o.title ?? "—"}</span>
                      {o.journal && (
                        <span className="block text-xs text-gray-400 dark:text-gray-600 mt-0.5 italic">{o.journal}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-gray-500 dark:text-gray-400 whitespace-nowrap text-xs">
                      {o.years.join(", ") || "—"}
                    </td>
                    <td className="px-3 py-2 text-xs whitespace-nowrap">
                      {o.doi ? (
                        <a
                          href={`https://doi.org/${o.doi}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-primary-600 dark:text-primary-400 hover:underline font-mono"
                        >
                          {o.doi.length > 30 ? o.doi.slice(0, 28) + "…" : o.doi}
                          <ExternalLink className="h-3 w-3" aria-hidden />
                        </a>
                      ) : o.url ? (
                        <a
                          href={o.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-primary-600 dark:text-primary-400 hover:underline"
                        >
                          Link <ExternalLink className="h-3 w-3" aria-hidden />
                        </a>
                      ) : (
                        <span className="text-gray-400 dark:text-gray-600">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Further funding table
// ---------------------------------------------------------------------------

function FurtherFundingSection({ items }: { items: FurtherFundingItem[] }) {
  if (!items.length) {
    return (
      <p className="text-sm text-gray-400 dark:text-gray-600 italic py-2">
        No additional funding sources recorded.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-100 dark:border-gray-800">
      <table className="min-w-full divide-y divide-gray-100 dark:divide-gray-800 text-sm">
        <thead className="bg-gray-50 dark:bg-gray-800/60">
          <tr>
            {["Funder", "Country", "Sector", "Years", "Funding ID"].map((h) => (
              <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800 bg-white dark:bg-gray-900">
          {items.map((f) => (
            <tr key={f.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30">
              <td className="px-3 py-2 text-gray-700 dark:text-gray-300">
                {f.funderProjectUrl ? (
                  <a
                    href={f.funderProjectUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 hover:text-primary-600 dark:hover:text-primary-400 hover:underline"
                  >
                    {f.funder ?? "—"}
                    <ExternalLink className="h-3 w-3" aria-hidden />
                  </a>
                ) : (
                  f.funder ?? "—"
                )}
              </td>
              <td className="px-3 py-2 text-gray-500 dark:text-gray-400 whitespace-nowrap">{f.country ?? "—"}</td>
              <td className="px-3 py-2 text-gray-500 dark:text-gray-400 whitespace-nowrap">{f.sector ?? "—"}</td>
              <td className="px-3 py-2 text-gray-500 dark:text-gray-400 whitespace-nowrap text-xs">
                {f.startYear && f.endYear ? `${f.startYear}–${f.endYear}` : (f.startYear ?? f.endYear ?? "—")}
              </td>
              <td className="px-3 py-2 text-gray-500 dark:text-gray-400 font-mono text-xs whitespace-nowrap">
                {f.fundingId ?? "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Info row helper
// ---------------------------------------------------------------------------

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-3 py-2.5 border-b border-gray-50 dark:border-gray-800/60 last:border-0">
      <dt className="min-w-[140px] text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide flex-shrink-0">
        {label}
      </dt>
      <dd className="text-sm text-gray-700 dark:text-gray-300 flex-1">{value}</dd>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function ProjectDetailPage({ params }: PageProps) {
  const { id } = await params;

  let project;
  try {
    project = await getProject(id);
  } catch {
    notFound();
  }

  const outputsCount = project.outputs.length;
  const ffCount      = project.furtherFunding.length;

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8 max-w-4xl mx-auto space-y-6">

      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb">
        <Link
          href="/projects"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Projects
        </Link>
      </nav>

      {/* Header card */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm p-5">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
          <div className="flex flex-wrap items-center gap-2">
            {project.statusEn && (
              <Badge
                label={project.statusEn}
                variant={project.statusEn === "Ongoing" ? "success" : "neutral"}
              />
            )}
            {project.programEn && (
              <Badge label={project.programEn} variant="info" />
            )}
          </div>
          {project.grantDoi && (
            <a
              href={`https://doi.org/${project.grantDoi}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 font-mono transition-colors"
            >
              {project.grantDoi}
              <ExternalLink className="h-3 w-3" aria-hidden />
            </a>
          )}
        </div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-50 leading-snug">
          {project.titleEn}
        </h1>
        {project.titleDe && project.titleDe !== project.titleEn && (
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 italic">{project.titleDe}</p>
        )}
        {project.researchRadarUrl && (
          <a
            href={project.researchRadarUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 text-xs text-primary-600 dark:text-primary-400 hover:underline"
          >
            <Globe className="h-3.5 w-3.5" aria-hidden />
            View on FWF Research Radar
            <ExternalLink className="h-3 w-3" aria-hidden />
          </a>
        )}
      </div>

      {/* Two-column grid: PI + Metadata */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* PI card */}
        <Section icon={Users} title="Principal Investigator">
          <dl>
            <InfoRow
              label="Name"
              value={
                [project.piFirstName, project.piLastName].filter(Boolean).join(" ") || "—"
              }
            />
            {project.piRole && (
              <InfoRow label="Role" value={project.piRole} />
            )}
            {project.piOrcid && (
              <InfoRow
                label="ORCID"
                value={
                  <a
                    href={`https://orcid.org/${project.piOrcid}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-primary-600 dark:text-primary-400 hover:underline font-mono text-xs"
                  >
                    {project.piOrcid}
                    <ExternalLink className="h-3 w-3" aria-hidden />
                  </a>
                }
              />
            )}
            <InfoRow
              label="Institution"
              value={
                project.piInstitutionRor ? (
                  <Link
                    href={`/institutions/${encodeURIComponent(project.piInstitutionRor)}`}
                    className="text-primary-600 dark:text-primary-400 hover:underline"
                  >
                    {project.piInstitutionName ?? project.piInstitutionRor}
                  </Link>
                ) : (
                  project.piInstitutionName ?? "—"
                )
              }
            />
          </dl>
        </Section>

        {/* Metadata card */}
        <Section icon={Calendar} title="Grant Details">
          <dl>
            <InfoRow label="Approval Date" value={formatDate(project.approvalDate)} />
            <InfoRow label="Start Date"    value={formatDate(project.startDate)} />
            <InfoRow label="End Date"      value={formatDate(project.endDate)} />
            <InfoRow
              label="Approved Amount"
              value={
                project.approvedAmount ? (
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                    {formatEur(project.approvedAmount)}
                  </span>
                ) : (
                  <span className="text-gray-400 dark:text-gray-600 text-xs italic">
                    Not available (pre-2012 project)
                  </span>
                )
              }
            />
          </dl>
        </Section>
      </div>

      {/* Keywords & Classification */}
      {(project.keywords.length > 0 || project.disciplinesEn.length > 0 || project.fieldsEn.length > 0) && (
        <Section icon={Tag} title="Keywords & Classification">
          <div className="space-y-3">
            {project.keywords.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2">Keywords</p>
                <div className="flex flex-wrap gap-1.5">
                  {project.keywords.map((k) => (
                    <Badge key={k} label={k} variant="info" />
                  ))}
                </div>
              </div>
            )}
            {project.disciplinesEn.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2">Research Disciplines</p>
                <div className="flex flex-wrap gap-1.5">
                  {project.disciplinesEn.map((d) => (
                    <Badge key={d} label={d} variant="neutral" />
                  ))}
                </div>
              </div>
            )}
            {project.fieldsEn.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2">Research Fields</p>
                <div className="flex flex-wrap gap-1.5">
                  {project.fieldsEn.map((f) => (
                    <Badge key={f} label={f} variant="neutral" />
                  ))}
                </div>
              </div>
            )}
          </div>
        </Section>
      )}

      {/* Summary */}
      {project.summaryEn && (
        <Section icon={BookOpen} title="Project Summary">
          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-line">
            {project.summaryEn}
          </p>
        </Section>
      )}

      {/* Outputs */}
      <Section icon={FileOutput} title={`Research Outputs (${outputsCount})`}>
        <OutputsSection outputs={project.outputs} />
      </Section>

      {/* Further Funding */}
      <Section icon={BadgeEuro} title={`Further Funding (${ffCount})`}>
        <FurtherFundingSection items={project.furtherFunding} />
      </Section>

    </div>
  );
}
