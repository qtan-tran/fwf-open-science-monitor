// ---------------------------------------------------------------------------
// Metric types
// ---------------------------------------------------------------------------

export interface MetricSummary {
  totalProjects: number;
  totalOutputs: number;
  totalInstitutions: number;
  overallOaRate: number;
  yearRange: [number | null, number | null];
}

export interface YearlyMetric {
  year: number;
  value: number;
  metadata?: Record<string, unknown>;
}

export type YearlyMetricParam =
  | "project_count"
  | "oa_rate"
  | "output_by_category"
  | "funding_efficiency"
  | "open_data_rate"
  | "open_software_rate";

export interface InstitutionRanking {
  rorId: string;
  name: string;
  country: string;
  projectCount: number;
  outputCount: number;
  publicationCount: number;
  oaPublicationRate: number;
}

// ---------------------------------------------------------------------------
// Project types
// ---------------------------------------------------------------------------

export interface ProjectListItem {
  id: string;
  grantDoi: string;
  titleEn: string;
  programEn: string | null;
  statusEn: string | null;
  approvalYear: number | null;
  approvedAmount: number | null;
  piFirstName: string | null;
  piLastName: string | null;
  piInstitutionName: string | null;
  piInstitutionRor: string | null;
  keywords: string[];
  fieldsEn: string[];
  outputCount: number;
}

export interface FurtherFundingItem {
  id: string;
  funder: string | null;
  fundingId: string | null;
  country: string | null;
  sector: string | null;
  title: string | null;
  type: string | null;
  startYear: number | null;
  endYear: number | null;
  funderProjectUrl: string | null;
}

export interface ProjectDetail {
  id: string;
  grantDoi: string;
  titleEn: string;
  titleDe: string | null;
  summaryEn: string | null;
  programEn: string | null;
  statusEn: string | null;
  approvalDate: string | null;
  startDate: string | null;
  endDate: string | null;
  approvedAmount: number | null;
  approvalYear: number | null;
  piFirstName: string | null;
  piLastName: string | null;
  piOrcid: string | null;
  piRole: string | null;
  piInstitutionName: string | null;
  piInstitutionRor: string | null;
  researchRadarUrl: string | null;
  keywords: string[];
  disciplinesEn: string[];
  fieldsEn: string[];
  outputs: OutputListItem[];
  furtherFunding: FurtherFundingItem[];
}

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

export interface OutputListItem {
  id: string;
  doi: string | null;
  title: string | null;
  category: string;
  type: string | null;
  years: number[];
  url: string | null;
  hasDoi: boolean;
  hasPmid: boolean;
  pmid: string | null;
  journal: string | null;
  publisher: string | null;
  providedToOthers: boolean | null;
}

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export type ExportType = "projects" | "outputs" | "metrics" | "institutions";
export type ExportFormat = "csv" | "json";

export interface ExportParams {
  type: ExportType;
  format: ExportFormat;
  year?: number;
  institution?: string;
  status?: string;
  category?: string;
  hasDoi?: boolean;
  metricKey?: string;
}

// ---------------------------------------------------------------------------
// Explore
// ---------------------------------------------------------------------------

export type ExploreMode = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export interface ExploreResult {
  mode: ExploreMode;
  label: string;
  description: string;
  data: unknown;
}
