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
import type { InstitutionRanking } from "@/lib/types";
import { EmptyState } from "@/components/ui/EmptyState";
import { memo } from "react";
import { useChartTheme } from "./useChartTheme";

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ payload: InstitutionRanking }>;
}

function CustomTooltip({ active, payload }: TooltipProps) {
  const { tooltipBg, tooltipBorder, tooltipText } = useChartTheme();
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div
      style={{ background: tooltipBg, border: `1px solid ${tooltipBorder}`, color: tooltipText }}
      className="rounded-lg px-3 py-2 shadow-lg text-xs max-w-[240px]"
    >
      <p className="font-semibold mb-1 leading-snug">{d.name}</p>
      <p>Outputs: <strong>{d.outputCount.toLocaleString()}</strong></p>
      <p>Projects: <strong>{d.projectCount.toLocaleString()}</strong></p>
      <p>OA rate: <strong>{d.oaPublicationRate.toFixed(1)}%</strong></p>
    </div>
  );
}

function ShortNameTick({
  x,
  y,
  payload,
  textColor,
}: {
  x?: number;
  y?: number;
  payload?: { value: string };
  textColor: string;
}) {
  const name = payload?.value ?? "";
  const short = name.length > 28 ? name.slice(0, 26) + "…" : name;
  return (
    <text
      x={(x ?? 0) - 4}
      y={y ?? 0}
      dy={4}
      textAnchor="end"
      fontSize={11}
      fill={textColor}
    >
      {short}
    </text>
  );
}

export const InstitutionBarChart = memo(function InstitutionBarChart({
  data,
}: {
  data: InstitutionRanking[];
}) {
  const { gridColor, textColor } = useChartTheme();

  if (!data.length) {
    return (
      <EmptyState
        title="No institution data yet"
        description="Run the ETL pipeline to populate this chart."
      />
    );
  }

  // Top 10 by outputCount, sorted ascending for horizontal chart readability
  const chartData = [...data]
    .sort((a, b) => a.outputCount - b.outputCount)
    .slice(-10);

  const barHeight = 32;
  const chartHeight = chartData.length * barHeight + 40;

  return (
    <ResponsiveContainer width="100%" height={chartHeight}>
      <BarChart
        layout="vertical"
        data={chartData}
        margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
        barCategoryGap="20%"
      >
        <CartesianGrid
          strokeDasharray="3 3"
          stroke={gridColor}
          horizontal={false}
        />
        <XAxis
          type="number"
          tick={{ fontSize: 10, fill: textColor }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          type="category"
          dataKey="name"
          width={160}
          tick={(props) => (
            <ShortNameTick {...props} textColor={textColor} />
          )}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: gridColor }} />
        <Bar dataKey="outputCount" radius={[0, 3, 3, 0]} name="Outputs">
          {chartData.map((d, i) => (
            <Cell
              key={d.rorId}
              fill="#0d9488"
              fillOpacity={0.6 + (i / chartData.length) * 0.4}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
});
