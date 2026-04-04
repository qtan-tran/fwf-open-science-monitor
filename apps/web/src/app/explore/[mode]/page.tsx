import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ExploreModeView } from "@/components/explore/ExploreModeView";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Mode registry (slug → display metadata)
// ---------------------------------------------------------------------------

const MODE_META: Record<string, { title: string; description: string }> = {
  totals: {
    title:       "Total Projects & Outputs",
    description: "Summary statistics and cumulative growth trends over time.",
  },
  recent: {
    title:       "Recent Open Projects",
    description: "Recently approved projects that have open outputs (DOI or provided-to-others).",
  },
  "oa-rates": {
    title:       "OA Rates Over Time",
    description: "Open-access rate analysis with DOI presence, PMID presence, and combined identifier breakdowns.",
  },
  rankings: {
    title:       "Institutional Rankings",
    description: "Top institutions by project count, output count, or OA rate.",
  },
  "publication-trends": {
    title:       "Yearly Publication Trends",
    description: "Multi-series breakdown of research outputs by category and year.",
  },
  topics: {
    title:       "Topic Search",
    description: "Free-text search across FWF project titles and summaries.",
  },
  export: {
    title:       "CSV Export Builder",
    description: "Configure, preview, and download custom exports of the FWF dataset.",
  },
  researchers: {
    title:       "Researcher Explorer",
    description: "Search by PI name or ORCID to explore researcher profiles and projects.",
  },
  "funding-impact": {
    title:       "Funding vs. Outputs",
    description: "Scatter analysis of approved grant amount versus research output count (2012+ data).",
  },
  system: {
    title:       "System Health",
    description: "Data completeness and ETL pipeline sync status.",
  },
};

// ---------------------------------------------------------------------------
// Next.js page
// ---------------------------------------------------------------------------

interface PageProps {
  params: Promise<{ mode: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { mode } = await params;
  const meta = MODE_META[mode];
  if (!meta) return { title: "Explore" };
  return { title: `${meta.title} — Explore` };
}

export default async function ExploreModePageWrapper({ params }: PageProps) {
  const { mode } = await params;
  const meta = MODE_META[mode];
  if (!meta) notFound();

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8 max-w-6xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb">
        <Link
          href="/explore"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Explore
        </Link>
      </nav>

      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">{meta.title}</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{meta.description}</p>
      </div>

      {/* Mode-specific client content */}
      <ExploreModeView mode={mode} />
    </div>
  );
}
