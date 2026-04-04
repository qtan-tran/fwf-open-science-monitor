import type { Metadata } from "next";
import Link from "next/link";
import {
  Activity,
  Clock,
  TrendingUp,
  Trophy,
  LineChart as LineChartIcon,
  Search,
  Download,
  User,
  DollarSign,
  Server,
  ArrowRight,
} from "lucide-react";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Explore" };

// ---------------------------------------------------------------------------
// Mode registry
// ---------------------------------------------------------------------------

const MODES = [
  {
    slug: "totals",
    icon: Activity,
    title: "Total Projects & Outputs",
    description:
      "Summary statistics with historical totals. Stacked area chart showing the cumulative growth of FWF-funded projects and research outputs over time.",
    badge: "Overview",
  },
  {
    slug: "recent",
    icon: Clock,
    title: "Recent Open Projects",
    description:
      "Most recently approved projects that have open outputs (DOI or provided-to-others). Filterable by approval year and research discipline.",
    badge: "Projects",
  },
  {
    slug: "oa-rates",
    icon: TrendingUp,
    title: "OA Rates Over Time",
    description:
      "Detailed open-access rate analysis with DOI presence rate, PMID presence rate, and combined identifier rate. Selectable year range with CSV export.",
    badge: "Metrics",
  },
  {
    slug: "rankings",
    icon: Trophy,
    title: "Institutional Rankings",
    description:
      "Configurable rankings by project count, output count, or OA rate. Select top 10, 25, or 50 institutions grouped by ROR ID. Horizontal bar chart and sortable table.",
    badge: "Institutions",
  },
  {
    slug: "publication-trends",
    icon: LineChartIcon,
    title: "Yearly Publication Trends",
    description:
      "Multi-series line chart breaking down outputs by category: publications, software, research data, tools, and more. Selectable year range.",
    badge: "Outputs",
  },
  {
    slug: "topics",
    icon: Search,
    title: "Topic Search",
    description:
      "Free-text search across project titles and summaries. Results displayed as cards with quick filters for discipline and research program.",
    badge: "Search",
  },
  {
    slug: "export",
    icon: Download,
    title: "CSV Export Builder",
    description:
      "Select data type (Projects, Outputs, Metrics, Institutions), apply filters, preview the first 10 rows, and download the full CSV or JSON.",
    badge: "Export",
  },
  {
    slug: "researchers",
    icon: User,
    title: "Researcher Explorer",
    description:
      "Search by PI name or ORCID to find projects linked to a researcher. View ORCID profiles and explore cross-institution career history.",
    badge: "People",
  },
  {
    slug: "funding-impact",
    icon: DollarSign,
    title: "Funding vs. Outputs",
    description:
      "Scatter plot of approved grant amount vs. output count, colored by research discipline. Includes trend line, Pearson correlation, and avg funding per output. Data from 2012 onwards.",
    badge: "Analysis",
  },
  {
    slug: "system",
    icon: Server,
    title: "System Health",
    description:
      "Last sync status from the ETL pipeline, data completeness metrics (ORCID, ROR, outputs, funding coverage), and error summaries from recent sync runs.",
    badge: "Admin",
  },
] as const;

// ---------------------------------------------------------------------------
// Styling maps
// ---------------------------------------------------------------------------

const BADGE_COLORS: Record<string, string> = {
  Overview:     "bg-blue-50    text-blue-700    dark:bg-blue-900/30    dark:text-blue-400",
  Projects:     "bg-teal-50    text-teal-700    dark:bg-teal-900/30    dark:text-teal-400",
  Metrics:      "bg-violet-50  text-violet-700  dark:bg-violet-900/30  dark:text-violet-400",
  Institutions: "bg-amber-50   text-amber-700   dark:bg-amber-900/30   dark:text-amber-400",
  Outputs:      "bg-pink-50    text-pink-700    dark:bg-pink-900/30    dark:text-pink-400",
  Search:       "bg-indigo-50  text-indigo-700  dark:bg-indigo-900/30  dark:text-indigo-400",
  Export:       "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  People:       "bg-orange-50  text-orange-700  dark:bg-orange-900/30  dark:text-orange-400",
  Analysis:     "bg-cyan-50    text-cyan-700    dark:bg-cyan-900/30    dark:text-cyan-400",
  Admin:        "bg-gray-100   text-gray-600    dark:bg-gray-800       dark:text-gray-400",
};

const ICON_COLORS: Record<string, string> = {
  Overview:     "text-blue-600    dark:text-blue-400",
  Projects:     "text-teal-600    dark:text-teal-400",
  Metrics:      "text-violet-600  dark:text-violet-400",
  Institutions: "text-amber-600   dark:text-amber-400",
  Outputs:      "text-pink-600    dark:text-pink-400",
  Search:       "text-indigo-600  dark:text-indigo-400",
  Export:       "text-emerald-600 dark:text-emerald-400",
  People:       "text-orange-600  dark:text-orange-400",
  Analysis:     "text-cyan-600    dark:text-cyan-400",
  Admin:        "text-gray-500    dark:text-gray-400",
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ExplorePage() {
  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">Explore</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          10 interactive exploration modes for deep-diving into the FWF open science dataset.
        </p>
      </div>

      {/* Mode grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {MODES.map((mode) => {
          const Icon = mode.icon;
          const badgeClass = BADGE_COLORS[mode.badge] ?? BADGE_COLORS.Admin;
          const iconClass  = ICON_COLORS[mode.badge]  ?? ICON_COLORS.Admin;
          return (
            <div
              key={mode.slug}
              className="flex flex-col rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm hover:shadow-md hover:border-gray-300 dark:hover:border-gray-700 transition-all"
            >
              <div className="flex-1 p-5">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-gray-50 dark:bg-gray-800 flex-shrink-0">
                    <Icon className={`h-5 w-5 ${iconClass}`} aria-hidden />
                  </div>
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${badgeClass}`}>
                    {mode.badge}
                  </span>
                </div>
                <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2 leading-snug">
                  {mode.title}
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                  {mode.description}
                </p>
              </div>
              <div className="px-5 pb-5">
                <Link
                  href={`/explore/${mode.slug}`}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 w-full justify-center"
                >
                  Launch
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
