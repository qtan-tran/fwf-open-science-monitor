"use client";

import { useState, useEffect } from "react";
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import {
  BarChart2, TrendingUp, Layers, DollarSign, Database,
  Code2, Activity, Building2, PieChart, Globe,
} from "lucide-react";
import { useChartTheme, CHART_COLORS } from "@/components/charts/useChartTheme";
import { LoadingState } from "@/components/ui/LoadingState";
import { ErrorState } from "@/components/ui/ErrorState";
import type { ExploreMode } from "@/lib/types";

// ---------------------------------------------------------------------------
// Mode metadata
// ---------------------------------------------------------------------------

interface ModeInfo {
  id: ExploreMode;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const MODES: ModeInfo[] = [
  { id: 1,  label: "Projects by Year",        description: "Number of funded projects per approval year",               icon: BarChart2  },
  { id: 2,  label: "OA Rate Trend",            description: "Open-access publication rate over time",                   icon: TrendingUp },
  { id: 3,  label: "Output Categories",        description: "Output counts by category and year",                       icon: Layers     },
  { id: 4,  label: "Funding Efficiency",       description: "Average approved amount per project by year",              icon: DollarSign },
  { id: 5,  label: "Open Data Rate",           description: "Share of research data outputs provided to others",        icon: Database   },
  { id: 6,  label: "Open Software Rate",       description: "Share of software outputs with a DOI",                    icon: Code2      },
  { id: 7,  label: "Summary Statistics",       description: "Overall totals and year range",                            icon: Activity   },
  { id: 8,  label: "Institution Rankings",     description: "Top 20 institutions by project count",                    icon: Building2  },
  { id: 9,  label: "Output Type Distribution", description: "Total output counts per category across all time",         icon: PieChart   },
  { id: 10, label: "Further Funding",          description: "Cross-funder landscape by country and sector",             icon: Globe      },
];

// ---------------------------------------------------------------------------
// Data type aliases
// ---------------------------------------------------------------------------

type YearCountRow    = { year: number; count: number };
type YearRateRow     = { year: number } & Record<string, number | null | undefined>;
type CategoryYearRow = { category: string; year: number; count: number };
type SummaryData     = {
  totalProjects: number;
  computedAt: string;
  totalOutputs?: number;
  totalInstitutions?: number;
  overallOaRate?: number;
  yearRange?: [number | null, number | null];
};
type InstRow     = { rorId: string | null; name: string; country: string | null; projectCount: number };
type CatCountRow = { category: string; count: number };
type FurtherData = {
  byCountry: Array<{ country: string | null; count: number }>;
  bySector:  Array<{ sector:  string | null; count: number }>;
};

// ---------------------------------------------------------------------------
// Shared tooltip
// ---------------------------------------------------------------------------

interface TipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color?: string }>;
  label?: string | number;
  formatter?: (v: number) => string;
}

function ChartTooltip({ active, payload, label, formatter }: TipProps) {
  const { tooltipBg, tooltipBorder, tooltipText } = useChartTheme();
  if (!active || !payload?.length) return null;
  const fmt = formatter ?? ((v: number) => v.toLocaleString());
  return (
    <div
      style={{ background: tooltipBg, border: `1px solid ${tooltipBorder}`, color: tooltipText }}
      className="rounded-lg px-3 py-2 shadow-lg text-xs"
    >
      {label != null && <p className="font-semibold mb-1">{label}</p>}
      {payload.map((p) => (
        <p key={p.name} style={p.color ? { color: p.color } : undefined}>
          {p.name}: <strong>{fmt(p.value)}</strong>
        </p>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Category label helpers (shared with OutputCategoriesChart)
// ---------------------------------------------------------------------------

const CATEGORY_LABELS: Record<string, string> = {
  "publications":                              "Publications",
  "software and technical products":           "Software",
  "research data and analysis techniques":     "Research Data",
  "research tools and methods":                "Tools & Methods",
  "science communication":                     "Sci. Communication",
  "creative and artistic works":               "Creative Works",
  "awards":                                    "Awards",
  "medical products and interventions":        "Medical Products",
  "patents and licenses":                      "Patents & Licenses",
  "societal impact":                           "Societal Impact",
  "start-ups":                                 "Start-ups",
};

function shortCat(cat: string): string {
  return CATEGORY_LABELS[cat] ?? (cat.length > 22 ? cat.slice(0, 20) + "…" : cat);
}

// ---------------------------------------------------------------------------
// Mode-specific renderers
// ---------------------------------------------------------------------------

function Mode1Chart({ data }: { data: YearCountRow[] }) {
  const { gridColor, textColor } = useChartTheme();
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }} barCategoryGap="35%">
        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
        <XAxis dataKey="year" tick={{ fontSize: 10, fill: textColor }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
        <YAxis tick={{ fontSize: 10, fill: textColor }} tickLine={false} axisLine={false} width={32} allowDecimals={false} />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: gridColor }} />
        <Bar dataKey="count" fill={CHART_COLORS[0]} fillOpacity={0.85} radius={[3, 3, 0, 0]} name="Projects" />
      </BarChart>
    </ResponsiveContainer>
  );
}

function Mode2Chart({ data }: { data: YearRateRow[] }) {
  const { gridColor, textColor } = useChartTheme();
  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="exploreOaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor={CHART_COLORS[1]} stopOpacity={0.3} />
            <stop offset="95%" stopColor={CHART_COLORS[1]} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
        <XAxis dataKey="year" tick={{ fontSize: 10, fill: textColor }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
        <YAxis tick={{ fontSize: 10, fill: textColor }} tickLine={false} axisLine={false} width={38} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
        <Tooltip content={<ChartTooltip formatter={(v) => `${v.toFixed(1)}%`} />} cursor={{ fill: gridColor }} />
        <Area type="monotone" dataKey="oaRate" stroke={CHART_COLORS[1]} fill="url(#exploreOaGrad)" strokeWidth={2} name="OA Rate" dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function Mode3Table({ data }: { data: CategoryYearRow[] }) {
  const years      = [...new Set(data.map((d) => d.year))].sort((a, b) => a - b);
  const categories = [...new Set(data.map((d) => d.category))].sort();
  const lookup     = new Map(data.map((d) => [`${d.category}:${d.year}`, d.count]));

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-100 dark:border-gray-800">
      <table className="min-w-full text-xs divide-y divide-gray-100 dark:divide-gray-800">
        <thead className="bg-gray-50 dark:bg-gray-800/60">
          <tr>
            <th className="px-3 py-2 text-left font-semibold text-gray-500 dark:text-gray-400 sticky left-0 bg-gray-50 dark:bg-gray-800/60">
              Category
            </th>
            {years.map((y) => (
              <th key={y} className="px-3 py-2 text-right font-semibold text-gray-500 dark:text-gray-400 whitespace-nowrap">
                {y}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800 bg-white dark:bg-gray-900">
          {categories.map((cat) => (
            <tr key={cat} className="hover:bg-gray-50 dark:hover:bg-gray-800/30">
              <td className="px-3 py-2 text-gray-700 dark:text-gray-300 whitespace-nowrap font-medium sticky left-0 bg-white dark:bg-gray-900">
                {shortCat(cat)}
              </td>
              {years.map((y) => {
                const v = lookup.get(`${cat}:${y}`) ?? 0;
                return (
                  <td key={y} className="px-3 py-2 text-right text-gray-500 dark:text-gray-400 tabular-nums">
                    {v > 0 ? v.toLocaleString() : <span className="text-gray-300 dark:text-gray-700">—</span>}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Mode4Chart({ data }: { data: YearRateRow[] }) {
  const { gridColor, textColor } = useChartTheme();
  const fmtEur = (v: number) =>
    v >= 1_000_000 ? `€${(v / 1_000_000).toFixed(1)}M` : `€${(v / 1_000).toFixed(0)}K`;
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }} barCategoryGap="35%">
        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
        <XAxis dataKey="year" tick={{ fontSize: 10, fill: textColor }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
        <YAxis tick={{ fontSize: 10, fill: textColor }} tickLine={false} axisLine={false} width={52} tickFormatter={fmtEur} />
        <Tooltip content={<ChartTooltip formatter={fmtEur} />} cursor={{ fill: gridColor }} />
        <Bar dataKey="avgApprovedAmount" fill={CHART_COLORS[2]} fillOpacity={0.85} radius={[3, 3, 0, 0]} name="Avg. Approved" />
      </BarChart>
    </ResponsiveContainer>
  );
}

function RateLineChart({
  data, dataKey, color, name,
}: {
  data: YearRateRow[];
  dataKey: string;
  color: string;
  name: string;
}) {
  const { gridColor, textColor } = useChartTheme();
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
        <XAxis dataKey="year" tick={{ fontSize: 10, fill: textColor }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
        <YAxis tick={{ fontSize: 10, fill: textColor }} tickLine={false} axisLine={false} width={38} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
        <Tooltip content={<ChartTooltip formatter={(v) => `${v.toFixed(1)}%`} />} cursor={{ fill: gridColor }} />
        <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} name={name} dot={{ r: 3, fill: color }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function Mode7Stats({ data }: { data: SummaryData }) {
  const items = [
    { label: "Total Projects",    value: data.totalProjects?.toLocaleString() ?? "—"                                           },
    { label: "Total Outputs",     value: data.totalOutputs?.toLocaleString() ?? "—"                                            },
    { label: "Institutions",      value: data.totalInstitutions?.toLocaleString() ?? "—"                                       },
    { label: "Overall OA Rate",   value: data.overallOaRate != null ? `${data.overallOaRate.toFixed(1)}%` : "—"                },
    { label: "Year Range",        value: data.yearRange ? `${data.yearRange[0] ?? "?"} – ${data.yearRange[1] ?? "?"}` : "—"   },
    { label: "Snapshot Computed", value: data.computedAt ? new Date(data.computedAt).toLocaleDateString() : "—"                },
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
      {items.map(({ label, value }) => (
        <div
          key={label}
          className="rounded-lg border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/30 p-4"
        >
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{label}</p>
          <p className="text-xl font-bold text-gray-900 dark:text-gray-50">{value}</p>
        </div>
      ))}
    </div>
  );
}

function Mode8Table({ data }: { data: InstRow[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-100 dark:border-gray-800">
      <table className="min-w-full text-sm divide-y divide-gray-100 dark:divide-gray-800">
        <thead className="bg-gray-50 dark:bg-gray-800/60">
          <tr>
            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide w-8">#</th>
            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Institution</th>
            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Country</th>
            <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap">Projects</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800 bg-white dark:bg-gray-900">
          {data.map((r, i) => (
            <tr key={r.rorId ?? i} className="hover:bg-gray-50 dark:hover:bg-gray-800/30">
              <td className="px-4 py-2 text-gray-400 dark:text-gray-600 text-xs">{i + 1}</td>
              <td className="px-4 py-2 text-gray-700 dark:text-gray-300 font-medium">{r.name}</td>
              <td className="px-4 py-2 text-gray-500 dark:text-gray-400">{r.country ?? "—"}</td>
              <td className="px-4 py-2 text-right tabular-nums text-gray-700 dark:text-gray-300 font-medium">
                {r.projectCount.toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Mode9Chart({ data }: { data: CatCountRow[] }) {
  const { gridColor, textColor } = useChartTheme();
  const chartData = data.map((d) => ({ ...d, label: shortCat(d.category) }));
  const height = Math.max(180, chartData.length * 28 + 40);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        layout="vertical"
        data={chartData}
        margin={{ top: 4, right: 16, left: 4, bottom: 4 }}
        barCategoryGap="25%"
      >
        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 10, fill: textColor }} tickLine={false} axisLine={false} />
        <YAxis type="category" dataKey="label" width={130} tick={{ fontSize: 11, fill: textColor }} tickLine={false} axisLine={false} />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: gridColor }} />
        <Bar dataKey="count" radius={[0, 3, 3, 0]} name="Outputs">
          {chartData.map((d, i) => (
            <Cell key={d.category} fill={CHART_COLORS[i % CHART_COLORS.length]} fillOpacity={0.85} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function SimpleTable({
  rows,
  labelKey,
  labelHeader,
}: {
  rows: Array<Record<string, string | number | null>>;
  labelKey: string;
  labelHeader: string;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-100 dark:border-gray-800">
      <table className="min-w-full text-sm divide-y divide-gray-100 dark:divide-gray-800">
        <thead className="bg-gray-50 dark:bg-gray-800/60">
          <tr>
            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              {labelHeader}
            </th>
            <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              Count
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800 bg-white dark:bg-gray-900">
          {rows.map((r, i) => (
            <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800/30">
              <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{(r[labelKey] as string) ?? "Unknown"}</td>
              <td className="px-3 py-2 text-right tabular-nums text-gray-500 dark:text-gray-400">
                {(r.count as number).toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Mode10Tables({ data }: { data: FurtherData }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
      <div>
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">By Country</h3>
        <SimpleTable
          rows={data.byCountry as Array<Record<string, string | number | null>>}
          labelKey="country"
          labelHeader="Country"
        />
      </div>
      <div>
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">By Sector</h3>
        <SimpleTable
          rows={data.bySector as Array<Record<string, string | number | null>>}
          labelKey="sector"
          labelHeader="Sector"
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ExploreView() {
  const [mode, setMode]       = useState<ExploreMode>(1);
  const [data, setData]       = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setData(null);

    fetch(`/api/explore?mode=${mode}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<{ data: unknown }>;
      })
      .then(({ data: d }) => {
        if (!cancelled) { setData(d); setLoading(false); }
      })
      .catch((e: Error) => {
        if (!cancelled) { setError(e.message); setLoading(false); }
      });

    return () => { cancelled = true; };
  }, [mode]);

  const currentMode = MODES.find((m) => m.id === mode)!;

  function renderContent() {
    if (loading)    return <div className="py-8"><LoadingState variant="chart" /></div>;
    if (error)      return <ErrorState message={error} onRetry={() => setError(null)} />;
    if (data == null) return null;

    switch (mode) {
      case 1:  return <Mode1Chart data={data as YearCountRow[]} />;
      case 2:  return <Mode2Chart data={data as YearRateRow[]} />;
      case 3:  return <Mode3Table data={data as CategoryYearRow[]} />;
      case 4:  return <Mode4Chart data={data as YearRateRow[]} />;
      case 5:  return <RateLineChart data={data as YearRateRow[]} dataKey="openDataRate"     color={CHART_COLORS[3]} name="Open Data Rate"     />;
      case 6:  return <RateLineChart data={data as YearRateRow[]} dataKey="openSoftwareRate" color={CHART_COLORS[4]} name="Open Software Rate" />;
      case 7:  return <Mode7Stats  data={data as SummaryData} />;
      case 8:  return <Mode8Table  data={data as InstRow[]} />;
      case 9:  return <Mode9Chart  data={data as CatCountRow[]} />;
      case 10: return <Mode10Tables data={data as FurtherData} />;
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm overflow-hidden">
      {/* Tab bar */}
      <div className="overflow-x-auto border-b border-gray-100 dark:border-gray-800">
        <div role="tablist" aria-label="Explore modes" className="flex min-w-max">
          {MODES.map((m) => {
            const isActive = m.id === mode;
            return (
              <button
                key={m.id}
                role="tab"
                aria-selected={isActive}
                aria-controls={`tabpanel-mode-${m.id}`}
                id={`tab-mode-${m.id}`}
                onClick={() => setMode(m.id)}
                className={[
                  "flex items-center gap-1.5 px-4 py-3 text-xs font-medium whitespace-nowrap transition-colors border-b-2 -mb-px",
                  isActive
                    ? "border-primary-600 text-primary-700 dark:text-primary-400"
                    : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-600",
                ].join(" ")}
              >
                <m.icon className="h-3.5 w-3.5 flex-shrink-0" aria-hidden />
                {m.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div
        role="tabpanel"
        id={`tabpanel-mode-${mode}`}
        aria-labelledby={`tab-mode-${mode}`}
        className="px-5 py-5"
      >
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-5">{currentMode.description}</p>
        {renderContent()}
      </div>
    </div>
  );
}
