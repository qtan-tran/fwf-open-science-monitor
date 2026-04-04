"use client";

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
import type { YearlyMetric } from "@/lib/types";
import { EmptyState } from "@/components/ui/EmptyState";
import { useChartTheme } from "./useChartTheme";

interface Datum {
  year: number;
  count: number;
}

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ payload: Datum }>;
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
      <p className="font-semibold mb-1">{d.year}</p>
      <p style={{ color: "#1e40af" }}>
        Projects approved: <strong>{d.count.toLocaleString()}</strong>
      </p>
    </div>
  );
}

export function ProjectsByYearChart({ data }: { data: YearlyMetric[] }) {
  const { gridColor, textColor } = useChartTheme();

  if (!data.length) {
    return (
      <EmptyState
        title="No project data yet"
        description="Run the ETL pipeline to populate this chart."
      />
    );
  }

  const chartData: Datum[] = data.map((d) => ({
    year: d.year,
    count: Math.round(d.value),
  }));

  // Highlight the most recent bar
  const maxYear = Math.max(...chartData.map((d) => d.year));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart
        data={chartData}
        margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
        barCategoryGap="30%"
      >
        <CartesianGrid
          strokeDasharray="3 3"
          stroke={gridColor}
          vertical={false}
        />
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
          width={36}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: gridColor }} />
        <Bar dataKey="count" radius={[3, 3, 0, 0]} name="Projects">
          {chartData.map((d) => (
            <Cell
              key={d.year}
              fill={d.year === maxYear ? "#1d4ed8" : "#1e40af"}
              fillOpacity={d.year === maxYear ? 1 : 0.75}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
