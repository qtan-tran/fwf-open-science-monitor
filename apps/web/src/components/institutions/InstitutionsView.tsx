"use client";

import { useState, useMemo, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Search,
  ChevronRight,
  GitCompare,
  X,
  BarChart3,
  AlertTriangle,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import type { InstitutionRanking } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";
import { useChartTheme, CHART_COLORS } from "@/components/charts/useChartTheme";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MOCK_COUNTRIES = new Set(["DE", "UK", "FR", "IT", "ES", "PL", "NL", "BE"]);

function isMock(inst: InstitutionRanking) {
  return MOCK_COUNTRIES.has(inst.country);
}

function oaVariant(rate: number): "success" | "warning" | "info" | "neutral" {
  if (rate >= 80) return "success";
  if (rate >= 50) return "info";
  if (rate >= 20) return "warning";
  return "neutral";
}

// ---------------------------------------------------------------------------
// Comparison modal
// ---------------------------------------------------------------------------

interface ComparisonModalProps {
  selected: InstitutionRanking[];
  onClose: () => void;
}

function ComparisonTooltip({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }> }) {
  const { tooltipBg, tooltipBorder, tooltipText } = useChartTheme();
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: tooltipBg, border: `1px solid ${tooltipBorder}`, color: tooltipText }}
      className="rounded-lg px-3 py-2 shadow-lg text-xs max-w-[200px]">
      {payload.map(p => (
        <p key={p.name} style={{ color: p.color }}>{p.name}: <strong>{p.value.toLocaleString()}</strong></p>
      ))}
    </div>
  );
}

function ComparisonModal({ selected, onClose }: ComparisonModalProps) {
  const { gridColor, textColor } = useChartTheme();

  const projectData = selected.map((s, i) => ({
    name: s.name.length > 20 ? s.name.slice(0, 18) + "…" : s.name,
    value: s.projectCount,
    fill: CHART_COLORS[i],
  }));

  const oaData = selected.map((s, i) => ({
    name: s.name.length > 20 ? s.name.slice(0, 18) + "…" : s.name,
    value: +s.oaPublicationRate.toFixed(1),
    fill: CHART_COLORS[i],
  }));

  return (
    <div
      role="dialog"
      aria-modal
      aria-label="Institution comparison"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" aria-hidden />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary-600 dark:text-primary-400" aria-hidden />
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              Comparing {selected.length} Institutions
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close comparison"
            className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Mock data warning */}
          {selected.some(isMock) && (
            <div className="flex gap-2 rounded-lg border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/20 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" aria-hidden />
              <span>
                <strong>Mock / Benchmark Data:</strong> Non-Austrian institutions (
                {selected.filter(isMock).map(s => s.country).join(", ")}
                ) are illustrative benchmark entries, not real FWF-funded institutions.
              </span>
            </div>
          )}

          {/* Key metrics table */}
          <div className="overflow-x-auto rounded-lg border border-gray-100 dark:border-gray-800">
            <table className="min-w-full divide-y divide-gray-100 dark:divide-gray-800 text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800/60">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Institution</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Projects</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Outputs</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Publications</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">OA Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {selected.map((inst, i) => (
                  <tr key={inst.rorId}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span
                          className="inline-block h-3 w-3 rounded-full flex-shrink-0"
                          style={{ background: CHART_COLORS[i] }}
                          aria-hidden
                        />
                        <span className="font-medium text-gray-900 dark:text-gray-100 leading-snug">
                          {inst.name}
                        </span>
                        {isMock(inst) && (
                          <Badge label="Mock" variant="warning" />
                        )}
                      </div>
                      <span className="ml-5 text-xs text-gray-400 dark:text-gray-600">{inst.country}</span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">
                      {inst.projectCount.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">
                      {inst.outputCount.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">
                      {inst.publicationCount.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Badge
                        label={`${inst.oaPublicationRate.toFixed(1)}%`}
                        variant={oaVariant(inst.oaPublicationRate)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Project counts */}
            <div className="rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/30 p-4">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
                Project Count
              </p>
              <ResponsiveContainer width="100%" height={140}>
                <BarChart data={projectData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 9, fill: textColor }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: textColor }} tickLine={false} axisLine={false} width={28} />
                  <Tooltip content={<ComparisonTooltip />} cursor={{ fill: gridColor }} />
                  <Bar dataKey="value" radius={[3, 3, 0, 0]} name="Projects">
                    {projectData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            {/* OA rates */}
            <div className="rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/30 p-4">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
                OA Publication Rate
              </p>
              <ResponsiveContainer width="100%" height={140}>
                <BarChart data={oaData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 9, fill: textColor }} tickLine={false} axisLine={false} />
                  <YAxis tickFormatter={(v: number) => `${v}%`} domain={[0, 100]} tick={{ fontSize: 9, fill: textColor }} tickLine={false} axisLine={false} width={32} />
                  <Tooltip content={<ComparisonTooltip />} cursor={{ fill: gridColor }} />
                  <Bar dataKey="value" radius={[3, 3, 0, 0]} name="OA Rate (%)">
                    {oaData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main view
// ---------------------------------------------------------------------------

interface InstitutionsViewProps {
  institutions: InstitutionRanking[];
  currentSearch: string;
  currentCountry: string;
}

export function InstitutionsView({
  institutions,
  currentSearch,
  currentCountry,
}: InstitutionsViewProps) {
  const router = useRouter();
  const searchRef = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showComparison, setShowComparison] = useState(false);
  const [sortKey, setSortKey] = useState<keyof InstitutionRanking>("projectCount");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const filtered = useMemo(() => {
    let list = [...institutions];
    if (currentCountry) {
      list = list.filter((i) => i.country === currentCountry);
    }
    if (currentSearch) {
      const q = currentSearch.toLowerCase();
      list = list.filter(
        (i) => i.name.toLowerCase().includes(q) || i.rorId.toLowerCase().includes(q)
      );
    }
    return list.sort((a, b) => {
      const aVal = a[sortKey] as number;
      const bVal = b[sortKey] as number;
      return sortDir === "desc" ? bVal - aVal : aVal - bVal;
    });
  }, [institutions, currentSearch, currentCountry, sortKey, sortDir]);

  const selectedInstitutions = useMemo(
    () => institutions.filter((i) => selected.has(i.rorId)),
    [institutions, selected]
  );

  const toggleSelect = useCallback((rorId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(rorId)) {
        next.delete(rorId);
      } else if (next.size < 3) {
        next.add(rorId);
      }
      return next;
    });
  }, []);

  function pushSearch(search: string, country: string) {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (country) params.set("country", country);
    router.push(`/institutions?${params.toString()}`);
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    pushSearch(searchRef.current?.value ?? "", currentCountry);
  }

  function handleSort(key: keyof InstitutionRanking) {
    if (key === sortKey) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else { setSortKey(key); setSortDir("desc"); }
  }

  const availableCountries = useMemo(() => {
    const set = new Set(institutions.map((i) => i.country).filter(Boolean));
    return Array.from(set).sort();
  }, [institutions]);

  return (
    <>
      {showComparison && selectedInstitutions.length >= 2 && (
        <ComparisonModal
          selected={selectedInstitutions}
          onClose={() => setShowComparison(false)}
        />
      )}

      <div className="px-4 py-6 sm:px-6 lg:px-8 max-w-screen-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">Institutions</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {filtered.length.toLocaleString()} institutions
              {currentCountry ? ` in ${currentCountry}` : ""}
              {currentSearch ? ` matching "${currentSearch}"` : ""}
            </p>
          </div>
          {selected.size >= 2 && (
            <button
              onClick={() => setShowComparison(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-primary-700 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-800 transition-colors"
            >
              <GitCompare className="h-4 w-4" aria-hidden />
              Compare ({selected.size})
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm p-4">
          {/* Text search */}
          <form onSubmit={handleSearchSubmit} className="flex gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" aria-hidden />
              <input
                ref={searchRef}
                type="search"
                defaultValue={currentSearch}
                placeholder="Search by name or ROR…"
                aria-label="Search institutions"
                className="w-64 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 pl-9 pr-3 py-1.5 text-sm text-gray-700 dark:text-gray-200 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>
            <button type="submit" className="rounded-md bg-primary-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-800 transition-colors">
              Search
            </button>
          </form>

          {/* Country filter */}
          <div className="flex flex-col gap-1">
            <label htmlFor="country-filter" className="text-xs font-medium text-gray-500 dark:text-gray-400">Country</label>
            <select
              id="country-filter"
              value={currentCountry}
              onChange={(e) => pushSearch(currentSearch, e.target.value)}
              className="rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-200 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 min-w-[100px]"
            >
              <option value="">All</option>
              {availableCountries.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Comparison hint */}
          <p className="ml-auto text-xs text-gray-400 dark:text-gray-600">
            {selected.size === 0
              ? "Select 2–3 institutions to compare"
              : selected.size < 2
              ? "Select one more to compare"
              : `${selected.size} selected · click Compare`}
          </p>
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
              <thead className="bg-gray-50 dark:bg-gray-800/60">
                <tr>
                  <th scope="col" className="px-4 py-3 w-10">
                    <span className="sr-only">Select</span>
                  </th>
                  {(
                    [
                      { key: "name" as const,              label: "Institution" },
                      { key: "country" as const,           label: "Country"     },
                      { key: "projectCount" as const,      label: "Projects",   sortable: true },
                      { key: "outputCount" as const,       label: "Outputs",    sortable: true },
                      { key: "oaPublicationRate" as const, label: "OA Rate",    sortable: true },
                    ] as Array<{ key: keyof InstitutionRanking; label: string; sortable?: boolean }>
                  ).map((col) => (
                    <th
                      key={col.key}
                      scope="col"
                      onClick={col.sortable ? () => handleSort(col.key) : undefined}
                      className={[
                        "px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 whitespace-nowrap",
                        col.sortable ? "cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200" : "",
                      ].join(" ")}
                      aria-sort={
                        sortKey === col.key
                          ? sortDir === "asc" ? "ascending" : "descending"
                          : col.sortable ? "none" : undefined
                      }
                    >
                      {col.label}
                      {col.sortable && sortKey === col.key && (
                        <span className="ml-1">{sortDir === "asc" ? "↑" : "↓"}</span>
                      )}
                    </th>
                  ))}
                  <th scope="col" className="px-4 py-3" aria-label="View institution" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-sm text-gray-400 dark:text-gray-600">
                      No institutions match the current filters.
                    </td>
                  </tr>
                ) : (
                  filtered.map((inst) => {
                    const isSelected = selected.has(inst.rorId);
                    const mock = isMock(inst);
                    return (
                      <tr
                        key={inst.rorId}
                        className={[
                          "transition-colors",
                          isSelected
                            ? "bg-primary-50 dark:bg-primary-900/15"
                            : "hover:bg-gray-50 dark:hover:bg-gray-800/40",
                        ].join(" ")}
                      >
                        {/* Checkbox */}
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelect(inst.rorId)}
                            disabled={!isSelected && selected.size >= 3}
                            aria-label={`Select ${inst.name} for comparison`}
                            className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 disabled:opacity-40 cursor-pointer"
                          />
                        </td>
                        {/* Name */}
                        <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100 max-w-xs">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Link
                              href={`/institutions/${encodeURIComponent(inst.rorId)}`}
                              className="text-primary-700 dark:text-primary-400 hover:underline leading-snug"
                            >
                              {inst.name}
                            </Link>
                            {mock && <Badge label="Mock" variant="warning" />}
                          </div>
                          <p className="text-xs text-gray-400 dark:text-gray-600 font-mono mt-0.5">
                            {inst.rorId}
                          </p>
                        </td>
                        {/* Country */}
                        <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                          {inst.country || "—"}
                        </td>
                        {/* Project count */}
                        <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300 text-right whitespace-nowrap">
                          {inst.projectCount.toLocaleString()}
                        </td>
                        {/* Output count */}
                        <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300 text-right whitespace-nowrap">
                          {inst.outputCount.toLocaleString()}
                        </td>
                        {/* OA rate */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <Badge
                            label={`${inst.oaPublicationRate.toFixed(1)}%`}
                            variant={oaVariant(inst.oaPublicationRate)}
                          />
                        </td>
                        {/* Chevron */}
                        <td className="px-4 py-3">
                          <Link
                            href={`/institutions/${encodeURIComponent(inst.rorId)}`}
                            aria-label={`View ${inst.name}`}
                            className="text-gray-300 dark:text-gray-700 hover:text-primary-500 transition-colors"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
