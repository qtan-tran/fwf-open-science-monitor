"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { EmptyState } from "@/components/ui/EmptyState";
import { memo } from "react";
import { useChartTheme } from "./useChartTheme";

export interface OpenDataSoftwareDatum {
  year: number;
  openData: number;
  openSoftware: number;
}

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: number;
}

function CustomTooltip({ active, payload, label }: TooltipProps) {
  const { tooltipBg, tooltipBorder, tooltipText } = useChartTheme();
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{ background: tooltipBg, border: `1px solid ${tooltipBorder}`, color: tooltipText }}
      className="rounded-lg px-3 py-2 shadow-lg text-xs"
    >
      <p className="font-semibold mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: <strong>{p.value.toFixed(1)}%</strong>
        </p>
      ))}
    </div>
  );
}

// Compact legend renderer to avoid Recharts' default styling
function CustomLegend({
  payload,
}: {
  payload?: Array<{ value: string; color: string }>;
}) {
  if (!payload?.length) return null;
  return (
    <div className="flex gap-4 justify-end pr-2 pb-1">
      {payload.map((p) => (
        <span key={p.value} className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
          <span
            className="inline-block h-2 w-6 rounded-full"
            style={{ background: p.color }}
          />
          {p.value}
        </span>
      ))}
    </div>
  );
}

export const OpenDataSoftwareChart = memo(function OpenDataSoftwareChart({
  data,
}: {
  data: OpenDataSoftwareDatum[];
}) {
  const { gridColor, textColor } = useChartTheme();

  if (!data.length) {
    return (
      <EmptyState
        title="No open data / software metrics yet"
        description="Run the ETL pipeline to populate this chart."
      />
    );
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart
        data={data}
        margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          stroke={gridColor}
          vertical={false}
        />
        <XAxis
          dataKey="year"
          tick={{ fontSize: 11, fill: textColor }}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tickFormatter={(v: number) => `${v}%`}
          domain={[0, 100]}
          tick={{ fontSize: 11, fill: textColor }}
          tickLine={false}
          axisLine={false}
          width={40}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend content={<CustomLegend />} verticalAlign="top" />
        <Line
          type="monotone"
          dataKey="openData"
          stroke="#0d9488"
          strokeWidth={2.5}
          dot={false}
          activeDot={{ r: 4, fill: "#0d9488", strokeWidth: 0 }}
          name="Open Data Rate"
        />
        <Line
          type="monotone"
          dataKey="openSoftware"
          stroke="#d97706"
          strokeWidth={2.5}
          dot={false}
          activeDot={{ r: 4, fill: "#d97706", strokeWidth: 0 }}
          name="Open Software Rate"
          strokeDasharray="5 3"
        />
      </LineChart>
    </ResponsiveContainer>
  );
});
