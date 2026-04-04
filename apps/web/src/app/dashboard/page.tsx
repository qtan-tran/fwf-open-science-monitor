import type { Metadata } from "next";
import {
  FolderOpen,
  FileOutput,
  Building2,
  TrendingUp,
  Database,
} from "lucide-react";

import {
  getMetricsSummary,
  getYearlyMetrics,
  getInstitutionRankings,
} from "@/lib/api-client";
import type { YearlyMetric, InstitutionRanking } from "@/lib/types";

import { StatCard } from "@/components/ui/StatCard";
import { ChartCard } from "@/components/ui/ChartCard";
import { EmptyState } from "@/components/ui/EmptyState";

import { OARateChart } from "@/components/charts/OARateChart";
import { ProjectsByYearChart } from "@/components/charts/ProjectsByYearChart";
import {
  OutputCategoriesChart,
  type CategoryDatum,
} from "@/components/charts/OutputCategoriesChart";
import {
  OpenDataSoftwareChart,
  type OpenDataSoftwareDatum,
} from "@/components/charts/OpenDataSoftwareChart";
import { InstitutionSection } from "@/components/charts/InstitutionSection";
import {
  FundingImpactChart,
  toFundingData,
} from "@/components/charts/FundingImpactChart";

// Never prerender — data comes from the database at request time.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Dashboard",
};

// ---------------------------------------------------------------------------
// Data fetching helpers
// ---------------------------------------------------------------------------

/** Unwrap a settled promise; return the fallback on rejection. */
function settled<T>(result: PromiseSettledResult<T>, fallback: T): T {
  return result.status === "fulfilled" ? result.value : fallback;
}

/** Aggregate per-year category data into totals per category. */
function toCategoryTotals(rows: YearlyMetric[]): CategoryDatum[] {
  const map = new Map<string, number>();
  for (const row of rows) {
    const cat = (row.metadata?.category as string) ?? "unknown";
    map.set(cat, (map.get(cat) ?? 0) + row.value);
  }
  return Array.from(map.entries())
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);
}

/** Merge open-data and open-software yearly rows into a single series. */
function mergeOpenRates(
  openData: YearlyMetric[],
  openSoftware: YearlyMetric[]
): OpenDataSoftwareDatum[] {
  const map = new Map<number, OpenDataSoftwareDatum>();
  for (const r of openData) {
    map.set(r.year, { year: r.year, openData: +r.value.toFixed(2), openSoftware: 0 });
  }
  for (const r of openSoftware) {
    const existing = map.get(r.year);
    if (existing) existing.openSoftware = +r.value.toFixed(2);
    else map.set(r.year, { year: r.year, openData: 0, openSoftware: +r.value.toFixed(2) });
  }
  return Array.from(map.values()).sort((a, b) => a.year - b.year);
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function DashboardPage() {
  // Fetch everything in parallel; tolerate individual failures.
  const [
    summaryResult,
    oaResult,
    projectsResult,
    categoriesResult,
    openDataResult,
    openSoftwareResult,
    institutionsResult,
    fundingResult,
  ] = await Promise.allSettled([
    getMetricsSummary(),
    getYearlyMetrics("oa_rate"),
    getYearlyMetrics("project_count"),
    getYearlyMetrics("output_by_category"),
    getYearlyMetrics("open_data_rate"),
    getYearlyMetrics("open_software_rate"),
    getInstitutionRankings({ sortBy: "output_count", limit: 50 }),
    getYearlyMetrics("funding_efficiency"),
  ]);

  const summary       = settled(summaryResult,       null);
  const oaData        = settled(oaResult,            [] as YearlyMetric[]);
  const projectData   = settled(projectsResult,      [] as YearlyMetric[]);
  const categoryRows  = settled(categoriesResult,    [] as YearlyMetric[]);
  const openDataRows  = settled(openDataResult,      [] as YearlyMetric[]);
  const openSwRows    = settled(openSoftwareResult,  [] as YearlyMetric[]);
  const institutions  = settled(institutionsResult,  [] as InstitutionRanking[]);
  const fundingRows   = settled(fundingResult,       [] as YearlyMetric[]);

  // Derived / processed data
  const categoryData = toCategoryTotals(categoryRows);
  const openRatesData = mergeOpenRates(openDataRows, openSwRows);
  const fundingData = toFundingData(fundingRows);

  // Determine "last updated" from most recent OA data year as a proxy
  const lastYear = oaData.at(-1)?.year ?? projectData.at(-1)?.year ?? null;

  const noData = !summary && !oaData.length && !projectData.length;

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8 max-w-screen-2xl mx-auto space-y-8">

      {/* ------------------------------------------------------------------ */}
      {/* 1. Header                                                           */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50 leading-tight">
            Open Science Dashboard
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            FWF-funded research output metrics
            {lastYear ? ` · data through ${lastYear}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-400 dark:text-gray-600">
          <Database className="h-3.5 w-3.5 flex-shrink-0" aria-hidden />
          <span>
            Source:{" "}
            <a
              href="https://openapi.fwf.ac.at"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-gray-600 dark:hover:text-gray-400"
            >
              FWF Open API
            </a>
            {" · "}
            <a
              href="https://creativecommons.org/publicdomain/zero/1.0/"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-gray-600 dark:hover:text-gray-400"
            >
              CC0 License
            </a>
          </span>
        </div>
      </div>

      {/* No-data banner */}
      {noData && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/20 px-5 py-4 text-sm text-amber-700 dark:text-amber-400">
          <strong>No data loaded yet.</strong> Start the database and run the
          ETL pipeline (<code className="font-mono text-xs">docker compose up</code>
          {" → "}
          <code className="font-mono text-xs">docker compose run etl</code>) to
          populate the dashboard.
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* 2. Summary stat cards                                               */}
      {/* ------------------------------------------------------------------ */}
      <section aria-labelledby="summary-heading">
        <h2 id="summary-heading" className="sr-only">
          Summary Statistics
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard
            title="Total FWF Projects"
            value={summary?.totalProjects ?? "—"}
            icon={FolderOpen}
            trendLabel={
              summary?.yearRange[0] && summary.yearRange[1]
                ? `${summary.yearRange[0]}–${summary.yearRange[1]}`
                : undefined
            }
            trend="neutral"
          />
          <StatCard
            title="Research Outputs"
            value={summary?.totalOutputs ?? "—"}
            icon={FileOutput}
          />
          <StatCard
            title="Overall OA Rate"
            value={
              summary ? `${summary.overallOaRate.toFixed(1)}` : "—"
            }
            unit="%"
            icon={TrendingUp}
            trend={
              summary
                ? summary.overallOaRate >= 60
                  ? "up"
                  : summary.overallOaRate >= 30
                  ? "neutral"
                  : "down"
                : undefined
            }
            trendLabel={
              summary ? "of publications are open access" : undefined
            }
          />
          <StatCard
            title="Active Institutions"
            value={summary?.totalInstitutions ?? "—"}
            icon={Building2}
          />
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* 3. OA Rate Over Time                                                */}
      {/* ------------------------------------------------------------------ */}
      <section aria-labelledby="oa-rate-heading">
        <h2 id="oa-rate-heading" className="sr-only">
          OA Publication Rate Over Time
        </h2>
        <ChartCard
          title="OA Publication Rate Over Time"
          subtitle="Share of publication outputs with a DOI or PubMed ID, by project approval year"
        >
          <OARateChart data={oaData} />
        </ChartCard>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* 4. Two-column: Projects per Year + Output Categories                */}
      {/* ------------------------------------------------------------------ */}
      <section
        aria-labelledby="projects-categories-heading"
        className="grid grid-cols-1 lg:grid-cols-2 gap-6"
      >
        <h2 id="projects-categories-heading" className="sr-only">
          Projects and Output Categories
        </h2>
        <ChartCard
          title="Projects Approved per Year"
          subtitle="Count of FWF-funded projects by approval year"
        >
          <ProjectsByYearChart data={projectData} />
        </ChartCard>
        <ChartCard
          title="Output Categories Distribution"
          subtitle="Total research outputs grouped by category (all years)"
        >
          {categoryData.length > 0 ? (
            <OutputCategoriesChart data={categoryData} />
          ) : (
            <EmptyState
              title="No output data yet"
              description="Run the ETL pipeline to populate this chart."
            />
          )}
        </ChartCard>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* 5. Open Data & Software Trends                                      */}
      {/* ------------------------------------------------------------------ */}
      <section aria-labelledby="open-rates-heading">
        <h2 id="open-rates-heading" className="sr-only">
          Open Data and Software Rates
        </h2>
        <ChartCard
          title="Open Data & Software Trends"
          subtitle="Open data rate: research data shared publicly · Open software rate: software outputs with a DOI"
        >
          <OpenDataSoftwareChart data={openRatesData} />
        </ChartCard>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* 6. Top Institutions                                                  */}
      {/* ------------------------------------------------------------------ */}
      <section aria-labelledby="institutions-heading">
        <h2
          id="institutions-heading"
          className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4"
        >
          Top Institutions
        </h2>
        {institutions.length > 0 ? (
          <InstitutionSection data={institutions} />
        ) : (
          <EmptyState
            title="No institution data yet"
            description="Run the ETL pipeline to populate institution rankings."
            icon={Building2}
          />
        )}
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* 7. Funding Impact                                                    */}
      {/* ------------------------------------------------------------------ */}
      <section aria-labelledby="funding-heading">
        <h2 id="funding-heading" className="sr-only">
          Funding Impact
        </h2>
        <ChartCard
          title="Funding Impact (2012 onwards)"
          subtitle="Bars: average approved grant amount · Line: average outputs per project · Funding data available from 2012 onwards only"
        >
          <FundingImpactChart data={fundingData} />
        </ChartCard>
      </section>

    </div>
  );
}
