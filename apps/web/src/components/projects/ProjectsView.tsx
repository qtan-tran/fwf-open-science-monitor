"use client";

import { useRouter } from "next/navigation";
import { useCallback, useRef } from "react";
import Link from "next/link";
import {
  Download,
  Search,
  ChevronRight,
  ChevronLeft,
  ExternalLink,
} from "lucide-react";
import type { PaginatedResponse, ProjectListItem, InstitutionRanking } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";
import { FilterBar } from "@/components/ui/FilterBar";
import { EmptyState } from "@/components/ui/EmptyState";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Filters {
  search: string;
  year: string;
  status: string;
  hasOutputs: string;
}

interface ProjectsViewProps {
  projects:     PaginatedResponse<ProjectListItem>;
  institutions: InstitutionRanking[];
  exportUrl:    string;
  filters:      Filters;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATUS_VARIANTS: Record<string, "success" | "warning" | "neutral"> = {
  Ongoing: "success",
  Ended:   "neutral",
};

function statusVariant(s: string | null): "success" | "warning" | "neutral" {
  return STATUS_VARIANTS[s ?? ""] ?? "neutral";
}

function formatAmount(n: number | null): string {
  if (n == null) return "—";
  return `€${n.toLocaleString("de-AT")}`;
}

// Year options 1995 → current year
const THIS_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: THIS_YEAR - 1994 }, (_, i) => ({
  value: String(THIS_YEAR - i),
  label: String(THIS_YEAR - i),
}));

// ---------------------------------------------------------------------------
// Custom clickable table (same visual style as DataTable)
// ---------------------------------------------------------------------------

function ProjectsTable({
  data,
  onRowClick,
}: {
  data: ProjectListItem[];
  onRowClick: (id: string) => void;
}) {
  if (!data.length) {
    return (
      <EmptyState
        title="No projects found"
        description="Try adjusting the filters or clearing the search."
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
          <thead className="bg-gray-50 dark:bg-gray-800/60">
            <tr>
              {["Grant DOI", "Title", "PI", "Institution", "Year", "Status", "Outputs"].map((h) => (
                <th
                  key={h}
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
              <th scope="col" className="px-4 py-3" aria-label="Open project" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {data.map((p) => (
              <tr
                key={p.id}
                onClick={() => onRowClick(p.id)}
                className="cursor-pointer hover:bg-primary-50/40 dark:hover:bg-primary-900/10 transition-colors"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onRowClick(p.id); }}
                aria-label={`View project: ${p.titleEn}`}
              >
                {/* Grant DOI */}
                <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 font-mono whitespace-nowrap">
                  {p.grantDoi
                    ? <a
                        href={`https://doi.org/${p.grantDoi}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="hover:text-primary-600 dark:hover:text-primary-400 underline"
                      >
                        {p.grantDoi}
                      </a>
                    : "—"}
                </td>
                {/* Title */}
                <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100 max-w-xs">
                  <span className="line-clamp-2 leading-snug">{p.titleEn}</span>
                </td>
                {/* PI */}
                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
                  {p.piFirstName || p.piLastName
                    ? `${p.piFirstName ?? ""} ${p.piLastName ?? ""}`.trim()
                    : "—"}
                </td>
                {/* Institution */}
                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 max-w-[180px]">
                  {p.piInstitutionRor
                    ? <Link
                        href={`/institutions/${encodeURIComponent(p.piInstitutionRor)}`}
                        onClick={(e) => e.stopPropagation()}
                        className="hover:text-primary-600 dark:hover:text-primary-400 hover:underline truncate block"
                      >
                        {p.piInstitutionName ?? p.piInstitutionRor}
                      </Link>
                    : (p.piInstitutionName ?? "—")}
                </td>
                {/* Year */}
                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
                  {p.approvalYear ?? "—"}
                </td>
                {/* Status */}
                <td className="px-4 py-3 whitespace-nowrap">
                  {p.statusEn
                    ? <Badge label={p.statusEn} variant={statusVariant(p.statusEn)} />
                    : <span className="text-gray-400">—</span>}
                </td>
                {/* Output count */}
                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap text-right">
                  {p.outputCount.toLocaleString()}
                </td>
                {/* Chevron */}
                <td className="px-4 py-3 text-gray-300 dark:text-gray-700">
                  <ChevronRight className="h-4 w-4" aria-hidden />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pagination strip
// ---------------------------------------------------------------------------

function Pagination({
  page,
  totalPages,
  total,
  onPage,
}: {
  page: number;
  totalPages: number;
  total: number;
  onPage: (p: number) => void;
}) {
  if (totalPages <= 1) {
    return (
      <p className="text-xs text-gray-400 dark:text-gray-600">
        {total.toLocaleString()} project{total !== 1 ? "s" : ""}
      </p>
    );
  }
  return (
    <div className="flex items-center gap-3">
      <p className="text-xs text-gray-500 dark:text-gray-400">
        {total.toLocaleString()} projects · page {page} of {totalPages}
      </p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPage(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
          className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40 disabled:pointer-events-none transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          onClick={() => onPage(page + 1)}
          disabled={page >= totalPages}
          aria-label="Next page"
          className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40 disabled:pointer-events-none transition-colors"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main view
// ---------------------------------------------------------------------------

export function ProjectsView({
  projects,
  institutions,
  exportUrl,
  filters,
}: ProjectsViewProps) {
  const router = useRouter();
  const searchRef = useRef<HTMLInputElement>(null);

  // Build URL with updated params and navigate
  const pushFilters = useCallback(
    (patch: Partial<Filters & { page: string }>) => {
      const next = { ...filters, page: "1", ...patch };
      const params = new URLSearchParams();
      for (const [k, v] of Object.entries(next)) {
        if (v) params.set(k, v);
      }
      router.push(`/projects?${params.toString()}`);
    },
    [router, filters]
  );

  const institutionOptions = institutions.map((i) => ({
    value: i.rorId,
    label: i.name.length > 40 ? i.name.slice(0, 38) + "…" : i.name,
  }));

  const dropdownFilters = [
    {
      key:     "year",
      label:   "Year",
      options: YEAR_OPTIONS,
    },
    {
      key:     "status",
      label:   "Status",
      options: [
        { value: "Ongoing", label: "Ongoing" },
        { value: "Ended",   label: "Ended"   },
      ],
    },
    {
      key:     "hasOutputs",
      label:   "Has Outputs",
      options: [
        { value: "true",  label: "Yes" },
        { value: "false", label: "No"  },
      ],
    },
  ];

  const dropdownValues: Record<string, string> = {
    year:       filters.year,
    status:     filters.status,
    hasOutputs: filters.hasOutputs,
  };

  function handleDropdownChange(key: string, value: string) {
    pushFilters({ [key]: value });
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    pushFilters({ search: searchRef.current?.value ?? "" });
  }

  function handleRowClick(id: string) {
    router.push(`/projects/${id}`);
  }

  function handlePageChange(p: number) {
    pushFilters({ page: String(p) });
  }

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8 max-w-screen-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">Projects</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {projects.total.toLocaleString()} FWF-funded research projects
          </p>
        </div>
        <a
          href={exportUrl}
          download
          className="inline-flex items-center gap-2 rounded-lg bg-primary-700 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 transition-colors self-start sm:self-auto"
        >
          <Download className="h-4 w-4" aria-hidden />
          Export CSV
        </a>
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm p-4 space-y-3">
        {/* Text search */}
        <form onSubmit={handleSearchSubmit} className="flex gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" aria-hidden />
            <input
              ref={searchRef}
              type="search"
              defaultValue={filters.search}
              placeholder="Search title, PI name, summary…"
              aria-label="Search projects"
              className="w-full rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 pl-9 pr-3 py-1.5 text-sm text-gray-700 dark:text-gray-200 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>
          <button
            type="submit"
            className="rounded-md bg-primary-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-800 transition-colors"
          >
            Search
          </button>
          {filters.search && (
            <button
              type="button"
              onClick={() => pushFilters({ search: "" })}
              className="rounded-md px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              Clear
            </button>
          )}
        </form>

        {/* Dropdown filters */}
        <FilterBar
          filters={dropdownFilters}
          values={dropdownValues}
          onChange={handleDropdownChange}
        />

        {/* Active filter chips */}
        {(filters.search || filters.year || filters.status || filters.hasOutputs) && (
          <div className="flex flex-wrap gap-2 pt-1">
            {filters.search && (
              <Chip label={`Search: "${filters.search}"`} onRemove={() => pushFilters({ search: "" })} />
            )}
            {filters.year && (
              <Chip label={`Year: ${filters.year}`} onRemove={() => pushFilters({ year: "" })} />
            )}
            {filters.status && (
              <Chip label={`Status: ${filters.status}`} onRemove={() => pushFilters({ status: "" })} />
            )}
            {filters.hasOutputs && (
              <Chip
                label={`Outputs: ${filters.hasOutputs === "true" ? "yes" : "no"}`}
                onRemove={() => pushFilters({ hasOutputs: "" })}
              />
            )}
            <button
              onClick={() => pushFilters({ search: "", year: "", status: "", hasOutputs: "" })}
              className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 underline"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      <ProjectsTable data={projects.data} onRowClick={handleRowClick} />

      {/* Pagination */}
      <div className="flex justify-end">
        <Pagination
          page={projects.page}
          totalPages={projects.totalPages}
          total={projects.total}
          onPage={handlePageChange}
        />
      </div>
    </div>
  );
}

function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-primary-50 dark:bg-primary-900/30 px-2.5 py-0.5 text-xs font-medium text-primary-700 dark:text-primary-400 ring-1 ring-inset ring-primary-200 dark:ring-primary-800">
      {label}
      <button
        onClick={onRemove}
        aria-label={`Remove filter: ${label}`}
        className="hover:text-primary-900 dark:hover:text-primary-200"
      >
        ×
      </button>
    </span>
  );
}
