import type {
  MetricSummary,
  YearlyMetric,
  YearlyMetricParam,
  InstitutionRanking,
  PaginatedResponse,
  ProjectListItem,
  ProjectDetail,
  OutputListItem,
  ExploreResult,
  ExploreMode,
  ExportType,
  ExportFormat,
} from "./types";

// ---------------------------------------------------------------------------
// Base URL resolution
// When called from the browser, relative paths work fine.
// When called server-side (e.g. from a Server Component), provide an absolute
// URL via the NEXT_PUBLIC_API_BASE env variable or fall back to localhost.
// ---------------------------------------------------------------------------
function getBase(): string {
  if (typeof window !== "undefined") return "";
  return process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:3000";
}

function buildUrl(path: string, params?: Record<string, string | number | boolean | undefined>): string {
  const url = new URL(`${getBase()}${path}`, "http://placeholder");
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }
  }
  // Return just path + search for relative, full URL for absolute
  const base = getBase();
  return base ? url.toString().replace("http://placeholder", base) : `${url.pathname}${url.search}`;
}

async function apiFetch<T>(path: string, params?: Record<string, string | number | boolean | undefined>): Promise<T> {
  const url = buildUrl(path, params);
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((error as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Metrics
// ---------------------------------------------------------------------------

export function getMetricsSummary(): Promise<MetricSummary> {
  return apiFetch("/api/metrics/summary");
}

export function getYearlyMetrics(
  metric: YearlyMetricParam,
  options?: { startYear?: number; endYear?: number }
): Promise<YearlyMetric[]> {
  return apiFetch("/api/metrics/yearly", {
    metric,
    startYear: options?.startYear,
    endYear: options?.endYear,
  });
}

export function getInstitutionRankings(options?: {
  sortBy?: "project_count" | "output_count" | "oa_rate";
  limit?: number;
  country?: string;
}): Promise<InstitutionRanking[]> {
  return apiFetch("/api/metrics/institutions", {
    sortBy: options?.sortBy,
    limit: options?.limit,
    country: options?.country,
  });
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export function getProjects(options?: {
  page?: number;
  limit?: number;
  year?: number;
  institution?: string;
  status?: string;
  search?: string;
  hasOutputs?: boolean;
}): Promise<PaginatedResponse<ProjectListItem>> {
  return apiFetch("/api/projects", {
    page: options?.page,
    limit: options?.limit,
    year: options?.year,
    institution: options?.institution,
    status: options?.status,
    search: options?.search,
    hasOutputs: options?.hasOutputs,
  });
}

export function getProject(id: string): Promise<ProjectDetail> {
  return apiFetch(`/api/projects/${encodeURIComponent(id)}`);
}

// ---------------------------------------------------------------------------
// Outputs
// ---------------------------------------------------------------------------

export function getOutputs(options?: {
  page?: number;
  limit?: number;
  category?: string;
  hasDoi?: boolean;
  year?: number;
  projectId?: string;
}): Promise<PaginatedResponse<OutputListItem>> {
  return apiFetch("/api/outputs", {
    page: options?.page,
    limit: options?.limit,
    category: options?.category,
    hasDoi: options?.hasDoi,
    year: options?.year,
    projectId: options?.projectId,
  });
}

// ---------------------------------------------------------------------------
// Explore
// ---------------------------------------------------------------------------

export function exploreMode(mode: ExploreMode): Promise<ExploreResult> {
  return apiFetch("/api/explore", { mode });
}

// ---------------------------------------------------------------------------
// Export (opens download — only for client-side use)
// ---------------------------------------------------------------------------

export function getExportUrl(options: {
  type: ExportType;
  format: ExportFormat;
  year?: number;
  institution?: string;
  status?: string;
  category?: string;
  hasDoi?: boolean;
  metricKey?: string;
}): string {
  return buildUrl("/api/export", {
    type: options.type,
    format: options.format,
    year: options.year,
    institution: options.institution,
    status: options.status,
    category: options.category,
    hasDoi: options.hasDoi,
    metricKey: options.metricKey,
  });
}
