"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar,
  ScatterChart, Scatter, XAxis, YAxis, ZAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell,
} from "recharts";
import {
  Search, Download, ExternalLink, FlaskConical, AlertTriangle,
} from "lucide-react";
import {
  getMetricsSummary,
  getYearlyMetrics,
  getInstitutionRankings,
  getProjects,
} from "@/lib/api-client";
import type {
  MetricSummary,
  YearlyMetric,
  InstitutionRanking,
  ProjectListItem,
} from "@/lib/types";
import { useChartTheme, CHART_COLORS } from "@/components/charts/useChartTheme";
import { LoadingState } from "@/components/ui/LoadingState";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Badge } from "@/components/ui/Badge";
import { ExportView } from "@/components/export/ExportView";

// ---------------------------------------------------------------------------
// Shared utilities
// ---------------------------------------------------------------------------

function csvDownload(rows: (string | number)[][], filename: string) {
  const csv = rows
    .map((r) => r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement("a"), { href: url, download: filename });
  a.click();
  URL.revokeObjectURL(url);
}

function fmtEur(n: number | null): string {
  if (n == null) return "—";
  return n >= 1_000_000
    ? `€${(n / 1_000_000).toFixed(1)} M`
    : `€${(n / 1_000).toFixed(0)} K`;
}

function pearsonCorr(data: Array<{ x: number; y: number }>): number {
  const n = data.length;
  if (n < 2) return 0;
  const sumX  = data.reduce((s, d) => s + d.x, 0);
  const sumY  = data.reduce((s, d) => s + d.y, 0);
  const sumXY = data.reduce((s, d) => s + d.x * d.y, 0);
  const sumX2 = data.reduce((s, d) => s + d.x * d.x, 0);
  const sumY2 = data.reduce((s, d) => s + d.y * d.y, 0);
  const num   = n * sumXY - sumX * sumY;
  const den   = Math.sqrt((n * sumX2 - sumX ** 2) * (n * sumY2 - sumY ** 2));
  return den === 0 ? 0 : num / den;
}

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: CURRENT_YEAR - 1998 }, (_, i) => CURRENT_YEAR - i);

function SelectField({
  label, value, onChange, children,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  const id = `select-${label.replace(/\s+/g, "-").toLowerCase()}`;
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
      >
        {children}
      </select>
    </div>
  );
}

function Section({ title, children, action }: { title?: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm overflow-hidden">
      {title && (
        <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
          {action}
        </div>
      )}
      <div className="px-5 py-5">{children}</div>
    </div>
  );
}

interface TooltipPayload { name: string; value: number; color?: string }
function ChartTip({
  active, payload, label, fmt,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string | number;
  fmt?: (v: number) => string;
}) {
  const { tooltipBg, tooltipBorder, tooltipText } = useChartTheme();
  if (!active || !payload?.length) return null;
  const f = fmt ?? ((v: number) => v.toLocaleString());
  return (
    <div style={{ background: tooltipBg, border: `1px solid ${tooltipBorder}`, color: tooltipText }}
      className="rounded-lg px-3 py-2 shadow-lg text-xs">
      {label != null && <p className="font-semibold mb-1">{label}</p>}
      {payload.map((p) => (
        <p key={p.name} style={p.color ? { color: p.color } : undefined}>
          {p.name}: <strong>{f(p.value)}</strong>
        </p>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mode 1 — Totals
// ---------------------------------------------------------------------------

function TotalsMode() {
  const [summary,     setSummary]     = useState<MetricSummary | null>(null);
  const [projects,    setProjects]    = useState<YearlyMetric[]>([]);
  const [categories,  setCategories]  = useState<YearlyMetric[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);
  const { gridColor, textColor } = useChartTheme();

  useEffect(() => {
    setLoading(true);
    Promise.allSettled([
      getMetricsSummary(),
      getYearlyMetrics("project_count"),
      getYearlyMetrics("output_by_category"),
    ]).then(([s, p, c]) => {
      setSummary(s.status === "fulfilled" ? s.value : null);
      setProjects(p.status === "fulfilled" ? p.value : []);
      setCategories(c.status === "fulfilled" ? c.value : []);
      setLoading(false);
    }).catch((e: Error) => { setError(e.message); setLoading(false); });
  }, []);

  if (loading) return <LoadingState variant="cards" />;
  if (error)   return <ErrorState message={error} onRetry={() => { setError(null); setLoading(true); }} />;

  // Sum outputs per year across categories
  const outputsByYear = new Map<number, number>();
  for (const row of categories) {
    outputsByYear.set(row.year, (outputsByYear.get(row.year) ?? 0) + row.value);
  }
  const projectMap = new Map(projects.map((r) => [r.year, r.value]));
  const years = [...new Set([...outputsByYear.keys(), ...projectMap.keys()])].sort((a, b) => a - b);
  const chartData = years.map((y) => ({
    year:     y,
    outputs:  outputsByYear.get(y) ?? 0,
    projects: projectMap.get(y) ?? 0,
  }));

  const stats = [
    { label: "Total Projects",    value: summary?.totalProjects?.toLocaleString() ?? "—" },
    { label: "Total Outputs",     value: summary?.totalOutputs?.toLocaleString() ?? "—" },
    { label: "Institutions",      value: summary?.totalInstitutions?.toLocaleString() ?? "—" },
    { label: "Overall OA Rate",   value: summary ? `${summary.overallOaRate.toFixed(1)} %` : "—" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {stats.map(({ label, value }) => (
          <div key={label} className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm p-4">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{label}</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-50">{value}</p>
          </div>
        ))}
      </div>

      <Section title="Projects & Outputs by Year">
        {chartData.length === 0 ? (
          <EmptyState title="No data yet" description="Run the ETL pipeline to populate this chart." />
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="totOutputGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={CHART_COLORS[1]} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={CHART_COLORS[1]} stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="totProjGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={CHART_COLORS[0]} stopOpacity={0.5} />
                  <stop offset="95%" stopColor={CHART_COLORS[0]} stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
              <XAxis dataKey="year" tick={{ fontSize: 11, fill: textColor }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 11, fill: textColor }} tickLine={false} axisLine={false} width={42} />
              <Tooltip content={<ChartTip />} />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
              <Area stackId="a" type="monotone" dataKey="projects" name="Projects" stroke={CHART_COLORS[0]} fill="url(#totProjGrad)" strokeWidth={2} dot={false} />
              <Area stackId="a" type="monotone" dataKey="outputs"  name="Outputs"  stroke={CHART_COLORS[1]} fill="url(#totOutputGrad)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </Section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mode 2 — Recent Open Projects
// ---------------------------------------------------------------------------

function RecentMode() {
  const [yearFilter,       setYearFilter]       = useState("");
  const [disciplineFilter, setDisciplineFilter] = useState("");
  const [allProjects,      setAllProjects]      = useState<ProjectListItem[]>([]);
  const [loading,          setLoading]          = useState(false);
  const [error,            setError]            = useState<string | null>(null);

  const fetchData = useCallback(() => {
    setLoading(true);
    setError(null);
    getProjects({
      hasOutputs: true,
      limit:      40,
      year:       yearFilter ? parseInt(yearFilter, 10) : undefined,
    })
      .then((res) => { setAllProjects(res.data); setLoading(false); })
      .catch((e: Error) => { setError(e.message); setLoading(false); });
  }, [yearFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Extract unique disciplines for the filter dropdown
  const allDisciplines = [...new Set(allProjects.flatMap((p) => p.fieldsEn))].sort();

  const filtered = disciplineFilter
    ? allProjects.filter((p) => p.fieldsEn.includes(disciplineFilter))
    : allProjects;

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <SelectField label="Approval Year" value={yearFilter} onChange={(v) => setYearFilter(v)}>
          <option value="">All years</option>
          {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
        </SelectField>
        <SelectField label="Research Field" value={disciplineFilter} onChange={setDisciplineFilter}>
          <option value="">All fields</option>
          {allDisciplines.map((d) => <option key={d} value={d}>{d}</option>)}
        </SelectField>
      </div>

      {loading && <LoadingState variant="table" rows={6} />}
      {!loading && error && <ErrorState message={error} onRetry={fetchData} />}
      {!loading && !error && filtered.length === 0 && (
        <EmptyState title="No projects found" description="Try adjusting your filters." />
      )}
      {!loading && !error && filtered.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs text-gray-500 dark:text-gray-400">{filtered.length} projects</p>
          {filtered.map((p) => (
            <div key={p.id} className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm p-4 hover:border-gray-300 dark:hover:border-gray-700 transition-colors">
              <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                <div className="flex flex-wrap gap-1.5">
                  {p.statusEn && (
                    <Badge label={p.statusEn} variant={p.statusEn === "Ongoing" ? "success" : "neutral"} />
                  )}
                  {p.approvalYear && <Badge label={String(p.approvalYear)} variant="info" />}
                  {p.fieldsEn.slice(0, 2).map((f) => <Badge key={f} label={f} variant="neutral" />)}
                </div>
                <span className="text-xs text-gray-400 dark:text-gray-600 tabular-nums">
                  {p.outputCount} output{p.outputCount !== 1 ? "s" : ""}
                </span>
              </div>
              <Link
                href={`/projects/${p.id}`}
                className="text-sm font-semibold text-gray-900 dark:text-gray-100 hover:text-primary-600 dark:hover:text-primary-400 transition-colors line-clamp-2 leading-snug"
              >
                {p.titleEn}
              </Link>
              {(p.piFirstName || p.piLastName) && (
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  PI: {[p.piFirstName, p.piLastName].filter(Boolean).join(" ")}
                  {p.piInstitutionName && ` · ${p.piInstitutionName}`}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mode 3 — OA Rates Over Time
// ---------------------------------------------------------------------------

interface OADatum { year: number; oaRate: number; total: number; oaCount: number; doiRate: number; pmidRate: number }

function OARatesMode() {
  const [rawData,    setRawData]    = useState<YearlyMetric[]>([]);
  const [startYear,  setStartYear]  = useState("");
  const [endYear,    setEndYear]    = useState("");
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);
  const { gridColor, textColor } = useChartTheme();

  useEffect(() => {
    setLoading(true);
    getYearlyMetrics("oa_rate")
      .then((d) => { setRawData(d); setLoading(false); })
      .catch((e: Error) => { setError(e.message); setLoading(false); });
  }, []);

  const chartData: OADatum[] = rawData
    .filter((r) => {
      if (startYear && r.year < parseInt(startYear, 10)) return false;
      if (endYear   && r.year > parseInt(endYear, 10))   return false;
      return true;
    })
    .map((r) => {
      const total   = (r.metadata?.total_publications as number) ?? 0;
      const oaCount = (r.metadata?.oa_publications    as number) ?? 0;
      const doiRate = (r.metadata?.doi_rate            as number) ?? r.value;
      const pmidRate = (r.metadata?.pmid_rate          as number) ?? 0;
      return { year: r.year, oaRate: +r.value.toFixed(2), total, oaCount, doiRate: +doiRate.toFixed(2), pmidRate: +pmidRate.toFixed(2) };
    });

  function handleExport() {
    csvDownload(
      [
        ["Year", "OA Rate (%)", "DOI Rate (%)", "PMID Rate (%)", "OA Publications", "Total Publications"],
        ...chartData.map((d) => [d.year, d.oaRate, d.doiRate, d.pmidRate, d.oaCount, d.total]),
      ],
      "fwf-oa-rates.csv",
    );
  }

  const allYears = rawData.map((r) => r.year);
  const minYear  = allYears.length ? Math.min(...allYears) : CURRENT_YEAR - 20;
  const maxYear  = allYears.length ? Math.max(...allYears) : CURRENT_YEAR;

  if (loading) return <LoadingState variant="chart" />;
  if (error)   return <ErrorState message={error} onRetry={() => { setError(null); setLoading(true); }} />;

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm p-4 flex flex-wrap items-end gap-4">
        <div className="flex gap-4 flex-1">
          <SelectField label={`Start Year (min ${minYear})`} value={startYear} onChange={setStartYear}>
            <option value="">All</option>
            {YEARS.filter((y) => y >= minYear && y <= maxYear).reverse().map((y) => <option key={y} value={y}>{y}</option>)}
          </SelectField>
          <SelectField label={`End Year (max ${maxYear})`} value={endYear} onChange={setEndYear}>
            <option value="">All</option>
            {YEARS.filter((y) => y >= minYear && y <= maxYear).reverse().map((y) => <option key={y} value={y}>{y}</option>)}
          </SelectField>
        </div>
        <button
          onClick={handleExport}
          disabled={chartData.length === 0}
          className="inline-flex items-center gap-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 text-sm font-medium transition-colors disabled:opacity-40"
        >
          <Download className="h-4 w-4" aria-hidden />
          Export CSV
        </button>
      </div>

      {chartData.length === 0 ? (
        <EmptyState title="No data in range" description="Adjust the year range or run the ETL pipeline." />
      ) : (
        <Section title="OA Rate Breakdown">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
              <XAxis dataKey="year" tick={{ fontSize: 11, fill: textColor }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 11, fill: textColor }} tickLine={false} axisLine={false} width={42} domain={[0, 100]} tickFormatter={(v: number) => `${v}%`} />
              <Tooltip content={<ChartTip fmt={(v) => `${v.toFixed(1)}%`} />} />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
              <Line type="monotone" dataKey="oaRate"  name="OA Rate (combined)" stroke={CHART_COLORS[0]} strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
              <Line type="monotone" dataKey="doiRate"  name="DOI Rate"           stroke={CHART_COLORS[1]} strokeWidth={1.5} dot={false} strokeDasharray="5 3" />
              <Line type="monotone" dataKey="pmidRate" name="PMID Rate"          stroke={CHART_COLORS[2]} strokeWidth={1.5} dot={false} strokeDasharray="3 3" />
            </LineChart>
          </ResponsiveContainer>
        </Section>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mode 4 — Institutional Rankings
// ---------------------------------------------------------------------------

type RankSortBy = "project_count" | "output_count" | "oa_rate";

function RankingsMode() {
  const [sortBy,   setSortBy]   = useState<RankSortBy>("output_count");
  const [limit,    setLimit]    = useState(25);
  const [data,     setData]     = useState<InstitutionRanking[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const { gridColor, textColor } = useChartTheme();

  const fetchData = useCallback(() => {
    setLoading(true);
    setError(null);
    getInstitutionRankings({ sortBy, limit })
      .then((d) => { setData(d); setLoading(false); })
      .catch((e: Error) => { setError(e.message); setLoading(false); });
  }, [sortBy, limit]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const sortedForChart = [...data].sort((a, b) => {
    if (sortBy === "project_count") return a.projectCount - b.projectCount;
    if (sortBy === "oa_rate")       return a.oaPublicationRate - b.oaPublicationRate;
    return a.outputCount - b.outputCount;
  }).slice(-15);

  const dataKey = sortBy === "project_count" ? "projectCount"
    : sortBy === "oa_rate" ? "oaPublicationRate"
    : "outputCount";

  const fmt = sortBy === "oa_rate"
    ? (v: number) => `${v.toFixed(1)}%`
    : (v: number) => v.toLocaleString();

  const barHeight = 32;
  const chartHeight = sortedForChart.length * barHeight + 40;

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <SelectField label="Sort By" value={sortBy} onChange={(v) => setSortBy(v as RankSortBy)}>
          <option value="output_count">Output Count</option>
          <option value="project_count">Project Count</option>
          <option value="oa_rate">OA Rate</option>
        </SelectField>
        <SelectField label="Top N" value={String(limit)} onChange={(v) => setLimit(parseInt(v, 10))}>
          <option value="10">Top 10</option>
          <option value="25">Top 25</option>
          <option value="50">Top 50</option>
        </SelectField>
      </div>

      {loading && <LoadingState variant="chart" />}
      {!loading && error && <ErrorState message={error} onRetry={fetchData} />}
      {!loading && !error && data.length === 0 && (
        <EmptyState title="No institution data" description="Run the ETL pipeline to populate rankings." />
      )}
      {!loading && !error && data.length > 0 && (
        <div className="space-y-4">
          {/* Chart */}
          <Section title={`Top ${Math.min(15, sortedForChart.length)} — bar chart`}>
            <ResponsiveContainer width="100%" height={chartHeight}>
              <BarChart layout="vertical" data={sortedForChart} margin={{ top: 4, right: 24, left: 4, bottom: 4 }} barCategoryGap="20%">
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: textColor }} tickLine={false} axisLine={false} tickFormatter={fmt} />
                <YAxis type="category" dataKey="name" width={160}
                  tick={({ x, y, payload }: { x?: number; y?: number; payload?: { value: string } }) => {
                    const name = payload?.value ?? "";
                    const short = name.length > 26 ? name.slice(0, 24) + "…" : name;
                    return <text x={(x ?? 0) - 4} y={y ?? 0} dy={4} textAnchor="end" fontSize={11} fill={textColor}>{short}</text>;
                  }}
                  tickLine={false} axisLine={false}
                />
                <Tooltip content={<ChartTip fmt={fmt} />} cursor={{ fill: gridColor }} />
                <Bar dataKey={dataKey} name={sortBy.replace(/_/g, " ")} radius={[0, 3, 3, 0]}>
                  {sortedForChart.map((d, i) => (
                    <Cell key={d.rorId} fill={CHART_COLORS[0]} fillOpacity={0.5 + (i / sortedForChart.length) * 0.5} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Section>

          {/* Table */}
          <Section title="Full table">
            <div className="overflow-x-auto rounded-lg border border-gray-100 dark:border-gray-800">
              <table className="min-w-full text-sm divide-y divide-gray-100 dark:divide-gray-800">
                <thead className="bg-gray-50 dark:bg-gray-800/60">
                  <tr>
                    {["#", "Institution", "Country", "Projects", "Outputs", "OA Rate"].map((h) => (
                      <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800 bg-white dark:bg-gray-900">
                  {data.map((r, i) => (
                    <tr key={r.rorId} className="hover:bg-gray-50 dark:hover:bg-gray-800/30">
                      <td className="px-3 py-2 text-xs text-gray-400 dark:text-gray-600">{i + 1}</td>
                      <td className="px-3 py-2 font-medium text-gray-900 dark:text-gray-100 max-w-xs">
                        <Link href={`/institutions/${encodeURIComponent(r.rorId)}`} className="hover:text-primary-600 dark:hover:text-primary-400 hover:underline">
                          {r.name}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-gray-500 dark:text-gray-400 whitespace-nowrap">{r.country}</td>
                      <td className="px-3 py-2 tabular-nums text-right">{r.projectCount.toLocaleString()}</td>
                      <td className="px-3 py-2 tabular-nums text-right">{r.outputCount.toLocaleString()}</td>
                      <td className="px-3 py-2 tabular-nums text-right">{r.oaPublicationRate.toFixed(1)} %</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mode 5 — Yearly Publication Trends
// ---------------------------------------------------------------------------

const CATEGORY_SHORT: Record<string, string> = {
  "publications":                          "Publications",
  "software and technical products":       "Software",
  "research data and analysis techniques": "Research Data",
  "research tools and methods":            "Tools & Methods",
  "science communication":                 "Sci. Comm.",
  "creative and artistic works":           "Creative Works",
  "awards":                                "Awards",
  "medical products and interventions":    "Medical",
  "patents and licenses":                  "Patents",
  "societal impact":                       "Societal Impact",
  "start-ups":                             "Start-ups",
};

function PublicationTrendsMode() {
  const [rawData,   setRawData]   = useState<YearlyMetric[]>([]);
  const [startYear, setStartYear] = useState("");
  const [endYear,   setEndYear]   = useState("");
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const { gridColor, textColor } = useChartTheme();

  useEffect(() => {
    setLoading(true);
    getYearlyMetrics("output_by_category")
      .then((d) => { setRawData(d); setLoading(false); })
      .catch((e: Error) => { setError(e.message); setLoading(false); });
  }, []);

  // Pivot into multi-series format: [{ year, publications: N, software: M, ... }]
  const categories = [...new Set(rawData.map((r) => (r.metadata?.category as string) ?? "unknown"))].sort();
  const years      = [...new Set(rawData.map((r) => r.year))].sort((a, b) => a - b)
    .filter((y) => {
      if (startYear && y < parseInt(startYear, 10)) return false;
      if (endYear   && y > parseInt(endYear, 10))   return false;
      return true;
    });

  type MultiRow = Record<string, number | string>;
  const lookup = new Map(rawData.map((r) => [`${(r.metadata?.category as string)}:${r.year}`, r.value]));
  const chartData: MultiRow[] = years.map((y) => {
    const row: MultiRow = { year: y };
    for (const cat of categories) {
      row[CATEGORY_SHORT[cat] ?? cat] = lookup.get(`${cat}:${y}`) ?? 0;
    }
    return row;
  });

  const allYears = rawData.map((r) => r.year);
  const minYear  = allYears.length ? Math.min(...allYears) : CURRENT_YEAR - 20;
  const maxYear  = allYears.length ? Math.max(...allYears) : CURRENT_YEAR;

  if (loading) return <LoadingState variant="chart" />;
  if (error)   return <ErrorState message={error} />;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm p-4 flex gap-4">
        <SelectField label={`Start Year`} value={startYear} onChange={setStartYear}>
          <option value="">All</option>
          {YEARS.filter((y) => y >= minYear && y <= maxYear).reverse().map((y) => <option key={y} value={y}>{y}</option>)}
        </SelectField>
        <SelectField label={`End Year`} value={endYear} onChange={setEndYear}>
          <option value="">All</option>
          {YEARS.filter((y) => y >= minYear && y <= maxYear).reverse().map((y) => <option key={y} value={y}>{y}</option>)}
        </SelectField>
      </div>

      {chartData.length === 0 ? (
        <EmptyState title="No data in range" description="Adjust the year range or run the ETL pipeline." />
      ) : (
        <Section title="Outputs by Category Over Time">
          <ResponsiveContainer width="100%" height={340}>
            <LineChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
              <XAxis dataKey="year" tick={{ fontSize: 11, fill: textColor }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 11, fill: textColor }} tickLine={false} axisLine={false} width={38} />
              <Tooltip content={<ChartTip />} />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
              {categories.map((cat, i) => {
                const key = CATEGORY_SHORT[cat] ?? cat;
                return (
                  <Line key={cat} type="monotone" dataKey={key} name={key}
                    stroke={CHART_COLORS[i % CHART_COLORS.length]} strokeWidth={1.5}
                    dot={false} activeDot={{ r: 3 }} />
                );
              })}
            </LineChart>
          </ResponsiveContainer>
        </Section>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mode 6 — Topic Search
// ---------------------------------------------------------------------------

function TopicsMode() {
  const [query,       setQuery]       = useState("");
  const [inputVal,    setInputVal]    = useState("");
  const [results,     setResults]     = useState<ProjectListItem[] | null>(null);
  const [total,       setTotal]       = useState(0);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [fieldFilter, setFieldFilter] = useState("");
  const [progFilter,  setProgFilter]  = useState("");

  useEffect(() => {
    if (!query) return;
    setLoading(true);
    setError(null);
    getProjects({ search: query, limit: 30 })
      .then((res) => { setResults(res.data); setTotal(res.total); setLoading(false); })
      .catch((e: Error) => { setError(e.message); setLoading(false); });
  }, [query]);

  const allFields    = [...new Set((results ?? []).flatMap((p) => p.fieldsEn))].sort();
  const allPrograms  = [...new Set((results ?? []).map((p) => p.programEn).filter(Boolean))].sort() as string[];

  const filtered = (results ?? []).filter((p) => {
    if (fieldFilter && !p.fieldsEn.includes(fieldFilter)) return false;
    if (progFilter  && p.programEn !== progFilter)         return false;
    return true;
  });

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (inputVal.trim()) setQuery(inputVal.trim());
  }

  return (
    <div className="space-y-4">
      {/* Search box */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" aria-hidden />
          <input
            type="search"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            placeholder="Search project titles and summaries…"
            aria-label="Search topics"
            className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 pl-9 pr-3 py-2.5 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <button type="submit" className="rounded-lg bg-primary-600 hover:bg-primary-700 text-white px-5 py-2.5 text-sm font-semibold transition-colors">
          Search
        </button>
      </form>

      {/* Quick filters (shown after results load) */}
      {results && results.length > 0 && (
        <div className="flex flex-wrap gap-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm p-4">
          <div className="flex-1 min-w-[140px]">
            <SelectField label="Research Field" value={fieldFilter} onChange={setFieldFilter}>
              <option value="">All fields</option>
              {allFields.map((f) => <option key={f} value={f}>{f}</option>)}
            </SelectField>
          </div>
          <div className="flex-1 min-w-[140px]">
            <SelectField label="Program" value={progFilter} onChange={setProgFilter}>
              <option value="">All programs</option>
              {allPrograms.map((p) => <option key={p} value={p}>{p}</option>)}
            </SelectField>
          </div>
        </div>
      )}

      {loading && <LoadingState variant="table" rows={4} />}
      {!loading && error && <ErrorState message={error} />}
      {!loading && !error && results === null && (
        <div className="rounded-xl border border-dashed border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/50 px-6 py-16 text-center">
          <Search className="mx-auto h-8 w-8 text-gray-300 dark:text-gray-700 mb-3" aria-hidden />
          <p className="text-sm text-gray-500 dark:text-gray-400">Enter a topic to search across project titles and summaries.</p>
        </div>
      )}
      {!loading && !error && results !== null && filtered.length === 0 && (
        <EmptyState title="No results" description={`No projects matched "${query}" with current filters.`} />
      )}
      {!loading && !error && filtered.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {filtered.length} of {total} total results for <strong>&ldquo;{query}&rdquo;</strong>
          </p>
          {filtered.map((p) => (
            <div key={p.id} className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm p-4">
              <div className="flex flex-wrap gap-1.5 mb-2">
                {p.approvalYear && <Badge label={String(p.approvalYear)} variant="info" />}
                {p.programEn    && <Badge label={p.programEn} variant="neutral" />}
                {p.fieldsEn.slice(0, 2).map((f) => <Badge key={f} label={f} variant="neutral" />)}
              </div>
              <Link
                href={`/projects/${p.id}`}
                className="text-sm font-semibold text-gray-900 dark:text-gray-100 hover:text-primary-600 dark:hover:text-primary-400 transition-colors leading-snug"
              >
                {p.titleEn}
              </Link>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {[p.piFirstName, p.piLastName].filter(Boolean).join(" ")}
                {p.piInstitutionName ? ` · ${p.piInstitutionName}` : ""}
                {" · "}
                {p.outputCount} output{p.outputCount !== 1 ? "s" : ""}
              </p>
              {p.keywords.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {p.keywords.slice(0, 5).map((k) => (
                    <span key={k} className="inline-block rounded bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 text-xs text-gray-600 dark:text-gray-400">{k}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mode 7 — Export (reuse existing ExportView)
// ---------------------------------------------------------------------------

function ExportMode() {
  return <ExportView />;
}

// ---------------------------------------------------------------------------
// Mode 8 — Researcher Explorer
// ---------------------------------------------------------------------------

function ResearchersMode() {
  const [inputVal, setInputVal] = useState("");
  const [query,    setQuery]    = useState("");
  const [results,  setResults]  = useState<ProjectListItem[] | null>(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  useEffect(() => {
    if (!query) return;
    setLoading(true);
    setError(null);
    getProjects({ search: query, limit: 40 })
      .then((res) => { setResults(res.data); setLoading(false); })
      .catch((e: Error) => { setError(e.message); setLoading(false); });
  }, [query]);

  // Group by PI (last + first name)
  const piMap = new Map<string, { name: string; orcid: string | null; institutions: Set<string>; projects: ProjectListItem[] }>();
  for (const p of results ?? []) {
    const piName = [p.piFirstName, p.piLastName].filter(Boolean).join(" ") || "Unknown PI";
    if (!piMap.has(piName)) {
      piMap.set(piName, { name: piName, orcid: null, institutions: new Set(), projects: [] });
    }
    const entry = piMap.get(piName)!;
    if (p.piInstitutionName) entry.institutions.add(p.piInstitutionName);
    entry.projects.push(p);
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (inputVal.trim()) setQuery(inputVal.trim());
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" aria-hidden />
          <input
            type="search"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            placeholder="Search PI name or ORCID…"
            aria-label="Search researchers"
            className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 pl-9 pr-3 py-2.5 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <button type="submit" className="rounded-lg bg-primary-600 hover:bg-primary-700 text-white px-5 py-2.5 text-sm font-semibold transition-colors">
          Search
        </button>
      </form>

      {loading && <LoadingState variant="table" rows={4} />}
      {!loading && error && <ErrorState message={error} />}
      {!loading && !error && results === null && (
        <div className="rounded-xl border border-dashed border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/50 px-6 py-16 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">Enter a researcher name or ORCID to explore their FWF project history.</p>
        </div>
      )}
      {!loading && !error && results !== null && piMap.size === 0 && (
        <EmptyState title="No researchers found" description={`No PI records matched "${query}".`} />
      )}
      {!loading && !error && piMap.size > 0 && (
        <div className="space-y-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {piMap.size} researcher{piMap.size !== 1 ? "s" : ""} · {results!.length} project{results!.length !== 1 ? "s" : ""}
          </p>
          {Array.from(piMap.values()).map((pi) => {
            const instList = Array.from(pi.institutions);
            const isMultiInstitution = instList.length > 1;
            return (
              <div key={pi.name} className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{pi.name}</h3>
                    {pi.orcid && (
                      <a href={`https://orcid.org/${pi.orcid}`} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary-600 dark:text-primary-400 hover:underline font-mono">
                        {pi.orcid} <ExternalLink className="h-3 w-3" aria-hidden />
                      </a>
                    )}
                    {isMultiInstitution && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400 ring-1 ring-amber-200 dark:ring-amber-800">
                        <AlertTriangle className="h-3 w-3" aria-hidden />
                        Multi-institution
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {instList.join(" → ")}
                  </p>
                </div>
                <div className="divide-y divide-gray-100 dark:divide-gray-800">
                  {pi.projects.map((p) => (
                    <div key={p.id} className="px-5 py-3 flex items-start justify-between gap-3 hover:bg-gray-50 dark:hover:bg-gray-800/30">
                      <div className="min-w-0">
                        <Link href={`/projects/${p.id}`} className="text-sm text-gray-800 dark:text-gray-200 hover:text-primary-600 dark:hover:text-primary-400 hover:underline line-clamp-1">
                          {p.titleEn}
                        </Link>
                        <p className="text-xs text-gray-400 dark:text-gray-600 mt-0.5">
                          {p.approvalYear ?? "—"} · {p.piInstitutionName ?? "—"}
                        </p>
                      </div>
                      <div className="flex-shrink-0 flex items-center gap-2">
                        {p.statusEn && <Badge label={p.statusEn} variant={p.statusEn === "Ongoing" ? "success" : "neutral"} />}
                        <span className="text-xs text-gray-400 tabular-nums">{p.outputCount} outputs</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mode 9 — Funding vs. Outputs (Scatter)
// ---------------------------------------------------------------------------

type ScatterDatum = { x: number; y: number; label: string; field: string; year: number };

function FundingImpactMode() {
  const [allProjects, setAllProjects]  = useState<ProjectListItem[]>([]);
  const [loading,     setLoading]      = useState(true);
  const [error,       setError]        = useState<string | null>(null);
  const [progFilter,  setProgFilter]   = useState("");
  const [startYear,   setStartYear]    = useState("2012");
  const [endYear,     setEndYear]      = useState("");
  const { gridColor, textColor } = useChartTheme();

  useEffect(() => {
    setLoading(true);
    // Fetch two pages of projects to get a good sample
    Promise.all([
      getProjects({ limit: 100, page: 1 }),
      getProjects({ limit: 100, page: 2 }),
    ]).then(([r1, r2]) => {
      setAllProjects([...r1.data, ...r2.data]);
      setLoading(false);
    }).catch((e: Error) => { setError(e.message); setLoading(false); });
  }, []);

  const allPrograms = [...new Set(allProjects.map((p) => p.programEn).filter(Boolean))] as string[];

  const scatterData: ScatterDatum[] = allProjects.filter((p) => {
    if (p.approvedAmount == null) return false;
    const yr = p.approvalYear ?? 0;
    if (startYear && yr < parseInt(startYear, 10)) return false;
    if (endYear   && yr > parseInt(endYear, 10))   return false;
    if (progFilter && p.programEn !== progFilter)   return false;
    return true;
  }).map((p) => ({
    x:     p.approvedAmount!,
    y:     p.outputCount,
    label: p.titleEn,
    field: p.fieldsEn[0] ?? "Other",
    year:  p.approvalYear ?? 0,
  }));

  // Group by top fields for coloring
  const fieldCounts = new Map<string, number>();
  for (const d of scatterData) fieldCounts.set(d.field, (fieldCounts.get(d.field) ?? 0) + 1);
  const topFields = [...fieldCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([f]) => f);
  const fieldColorMap = new Map<string, string>(topFields.map((f, i) => [f, CHART_COLORS[i % CHART_COLORS.length] as string]));
  const grouped = new Map<string, ScatterDatum[]>();
  for (const d of scatterData) {
    const key = topFields.includes(d.field) ? d.field : "Other";
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(d);
  }
  if (!fieldColorMap.has("Other")) fieldColorMap.set("Other", "#94a3b8");

  // Stats
  const corr   = pearsonCorr(scatterData);
  const avgFunding = scatterData.length
    ? scatterData.reduce((s, d) => s + d.x, 0) / scatterData.length
    : 0;
  const totalOutputs = scatterData.reduce((s, d) => s + d.y, 0);
  const avgFundingPerOutput = totalOutputs > 0
    ? scatterData.reduce((s, d) => s + d.x, 0) / totalOutputs
    : 0;

  if (loading) return <LoadingState variant="chart" />;
  if (error)   return <ErrorState message={error} />;

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm p-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SelectField label="Program" value={progFilter} onChange={setProgFilter}>
          <option value="">All programs</option>
          {allPrograms.map((p) => <option key={p} value={p}>{p}</option>)}
        </SelectField>
        <SelectField label="From Year" value={startYear} onChange={setStartYear}>
          {YEARS.filter((y) => y >= 2012).map((y) => <option key={y} value={y}>{y}</option>)}
        </SelectField>
        <SelectField label="To Year" value={endYear} onChange={setEndYear}>
          <option value="">Latest</option>
          {YEARS.filter((y) => y >= 2012).map((y) => <option key={y} value={y}>{y}</option>)}
        </SelectField>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Projects",             value: scatterData.length.toLocaleString() },
          { label: "Correlation (r)",      value: corr.toFixed(3) },
          { label: "Avg Funding",          value: fmtEur(avgFunding) },
          { label: "Avg Funding / Output", value: totalOutputs > 0 ? fmtEur(avgFundingPerOutput) : "—" },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm p-4">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{label}</p>
            <p className="text-lg font-bold text-gray-900 dark:text-gray-50">{value}</p>
          </div>
        ))}
      </div>

      {/* Note */}
      <p className="text-xs text-gray-400 dark:text-gray-600 italic">
        Showing up to 200 sampled projects from 2012 onwards (funding data available from 2012). Austria–Germany comparisons use mock data and are clearly labeled.
      </p>

      {scatterData.length === 0 ? (
        <EmptyState title="No data" description="No projects with funding data match the current filters." />
      ) : (
        <Section title="Approved Funding vs. Output Count">
          <ResponsiveContainer width="100%" height={340}>
            <ScatterChart margin={{ top: 8, right: 24, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis type="number" dataKey="x" name="Approved Amount" tick={{ fontSize: 10, fill: textColor }} tickLine={false} axisLine={false}
                tickFormatter={(v: number) => v >= 1_000_000 ? `€${(v / 1_000_000).toFixed(1)}M` : `€${(v / 1_000).toFixed(0)}K`} />
              <YAxis type="number" dataKey="y" name="Outputs" tick={{ fontSize: 10, fill: textColor }} tickLine={false} axisLine={false} width={30} />
              <ZAxis range={[30, 30]} />
              <Tooltip
                cursor={{ strokeDasharray: "3 3" }}
                content={({ active, payload }) => {
                  const { tooltipBg, tooltipBorder, tooltipText } = { tooltipBg: "#fff", tooltipBorder: "#e2e8f0", tooltipText: "#111827" };
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload as ScatterDatum;
                  return (
                    <div style={{ background: tooltipBg, border: `1px solid ${tooltipBorder}`, color: tooltipText }}
                      className="rounded-lg px-3 py-2 shadow-lg text-xs max-w-[220px]">
                      <p className="font-semibold mb-1 line-clamp-2 leading-snug">{d.label}</p>
                      <p>Funding: <strong>{fmtEur(d.x)}</strong></p>
                      <p>Outputs: <strong>{d.y}</strong></p>
                      <p className="text-gray-400">{d.field} · {d.year}</p>
                    </div>
                  );
                }}
              />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
              {Array.from(grouped.entries()).map(([field, pts]) => (
                <Scatter key={field} name={field} data={pts} fill={fieldColorMap.get(field) ?? "#94a3b8"} fillOpacity={0.7} />
              ))}
            </ScatterChart>
          </ResponsiveContainer>
        </Section>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mode 10 — System Health
// ---------------------------------------------------------------------------

function SystemMode() {
  const [summary, setSummary] = useState<MetricSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [sample,  setSample]  = useState<ProjectListItem[]>([]);

  useEffect(() => {
    setLoading(true);
    Promise.allSettled([
      getMetricsSummary(),
      getProjects({ limit: 100 }),
    ]).then(([s, p]) => {
      setSummary(s.status === "fulfilled" ? s.value : null);
      setSample(p.status === "fulfilled" ? p.value.data : []);
      setLoading(false);
    }).catch((e: Error) => { setError(e.message); setLoading(false); });
  }, []);

  if (loading) return <LoadingState variant="cards" />;
  if (error)   return <ErrorState message={error} />;

  const withRor      = sample.filter((p) => p.piInstitutionRor).length;
  const withOutputs  = sample.filter((p) => p.outputCount > 0).length;
  const withFunding  = sample.filter((p) => p.approvedAmount != null).length;
  const pct = (n: number) => sample.length > 0 ? `${((n / sample.length) * 100).toFixed(1)} %` : "—";

  const completeness = [
    { label: "ROR Identifier",    value: pct(withRor),     note: `${withRor} / ${sample.length} sampled`,   status: withRor / (sample.length || 1) > 0.7 ? "good" : "warn" },
    { label: "Has Outputs",       value: pct(withOutputs), note: `${withOutputs} / ${sample.length} sampled`, status: withOutputs / (sample.length || 1) > 0.5 ? "good" : "warn" },
    { label: "Funding Amount",    value: pct(withFunding), note: "Funding available from 2012",              status: "info" },
    { label: "ORCID (PI)",        value: "—",              note: "Requires project detail fetch",            status: "info" },
  ];

  const statusClass = {
    good: "text-emerald-600 dark:text-emerald-400",
    warn: "text-amber-600 dark:text-amber-400",
    info: "text-gray-500 dark:text-gray-400",
  };

  return (
    <div className="space-y-6">
      {/* Sync status */}
      <Section title="Data Status">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-lg border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/30 p-4">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Last Data Year</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-50">
              {summary?.yearRange[1] ?? "—"}
            </p>
          </div>
          <div className="rounded-lg border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/30 p-4">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">First Data Year</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-50">
              {summary?.yearRange[0] ?? "—"}
            </p>
          </div>
          <div className="rounded-lg border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/30 p-4">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Total Records</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-50">
              {summary
                ? (summary.totalProjects + summary.totalOutputs).toLocaleString()
                : "—"}
            </p>
          </div>
        </div>
      </Section>

      {/* Data completeness */}
      <Section title="Data Completeness (sample of 100 projects)">
        <div className="space-y-1">
          <p className="text-xs text-amber-600 dark:text-amber-400 mb-4 flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" aria-hidden />
            Completeness estimates are based on a 100-project sample. Full pipeline audit requires direct database access.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {completeness.map(({ label, value, note, status }) => (
              <div key={label} className="flex items-center justify-between rounded-lg border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/30 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-600 mt-0.5">{note}</p>
                </div>
                <p className={`text-lg font-bold tabular-nums ${statusClass[status as keyof typeof statusClass]}`}>{value}</p>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* ETL info */}
      <Section title="ETL Pipeline">
        <div className="rounded-lg border border-dashed border-gray-200 dark:border-gray-700 p-5 text-center space-y-2">
          <FlaskConical className="mx-auto h-8 w-8 text-gray-300 dark:text-gray-700" aria-hidden />
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Detailed sync logs (timestamps, record counts, error rates) are stored in the{" "}
            <code className="rounded bg-gray-100 dark:bg-gray-800 px-1 py-0.5 text-xs font-mono">SyncLog</code>{" "}
            table and require direct database access.
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-600">
            Run <code className="font-mono">docker compose run etl</code> to trigger a fresh sync.
          </p>
        </div>
      </Section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main export — routes to the correct mode component
// ---------------------------------------------------------------------------

export function ExploreModeView({ mode }: { mode: string }) {
  switch (mode) {
    case "totals":               return <TotalsMode />;
    case "recent":               return <RecentMode />;
    case "oa-rates":             return <OARatesMode />;
    case "rankings":             return <RankingsMode />;
    case "publication-trends":   return <PublicationTrendsMode />;
    case "topics":               return <TopicsMode />;
    case "export":               return <ExportMode />;
    case "researchers":          return <ResearchersMode />;
    case "funding-impact":       return <FundingImpactMode />;
    case "system":               return <SystemMode />;
    default:                     return null;
  }
}
