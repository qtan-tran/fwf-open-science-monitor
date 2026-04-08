import type { YearlyMetric } from "@/lib/types";

export interface FundingDatum {
  year: number;
  avgAmount: number;
  avgOutputs: number;
  projectCount: number;
}

export function toFundingData(metrics: YearlyMetric[]): FundingDatum[] {
  return metrics.map((m) => ({
    year: m.year,
    avgAmount: m.value,
    avgOutputs: (m.metadata?.avg_outputs_per_project as number) ?? 0,
    projectCount: (m.metadata?.project_count as number) ?? 0,
  }));
}
