"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { EmptyState } from "@/components/ui/EmptyState";
import { useChartTheme } from "@/components/charts/useChartTheme";

export interface YearCount { year: number; count: number; }

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ payload: YearCount }>;
}

function CustomTooltip({ active, payload }: TooltipProps) {
  const { tooltipBg, tooltipBorder, tooltipText } = useChartTheme();
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div
      style={{ background: tooltipBg, border: `1px solid ${tooltipBorder}`, color: tooltipText }}
      className="rounded-lg px-3 py-2 shadow-lg text-xs"
    >
      <p className="font-semibold">{d.year}</p>
      <p style={{ color: "#0d9488" }}>Projects approved: <strong>{d.count}</strong></p>
    </div>
  );
}

export function InstitutionTrendChart({ data }: { data: YearCount[] }) {
  const { gridColor, textColor } = useChartTheme();

  if (!data.length) {
    return (
      <EmptyState
        title="No yearly data"
        description="No projects found for this institution."
      />
    );
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }} barCategoryGap="35%">
        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
        <XAxis
          dataKey="year"
          tick={{ fontSize: 10, fill: textColor }}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fontSize: 10, fill: textColor }}
          tickLine={false}
          axisLine={false}
          width={28}
          allowDecimals={false}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: gridColor }} />
        <Bar dataKey="count" fill="#0d9488" fillOpacity={0.8} radius={[3, 3, 0, 0]} name="Projects" />
      </BarChart>
    </ResponsiveContainer>
  );
}
