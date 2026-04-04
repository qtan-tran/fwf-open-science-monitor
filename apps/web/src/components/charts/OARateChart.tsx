"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { YearlyMetric } from "@/lib/types";
import { EmptyState } from "@/components/ui/EmptyState";
import { useChartTheme } from "./useChartTheme";

interface OARateChartProps {
  data: YearlyMetric[];
}

interface Datum {
  year: number;
  oaRate: number;
  total: number;
  oaCount: number;
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
      style={{
        background: tooltipBg,
        border: `1px solid ${tooltipBorder}`,
        color: tooltipText,
      }}
      className="rounded-lg px-3 py-2 shadow-lg text-xs"
    >
      <p className="font-semibold mb-1">{d.year}</p>
      <p style={{ color: "#1e40af" }}>
        OA rate: <strong>{d.oaRate.toFixed(1)}%</strong>
      </p>
      {d.total > 0 && (
        <>
          <p className="mt-0.5 text-gray-500">
            OA publications: {d.oaCount.toLocaleString()}
          </p>
          <p className="text-gray-500">
            Total publications: {d.total.toLocaleString()}
          </p>
        </>
      )}
    </div>
  );
}

export function OARateChart({ data }: OARateChartProps) {
  const { gridColor, textColor } = useChartTheme();

  if (!data.length) {
    return (
      <EmptyState
        title="No OA rate data yet"
        description="Run the ETL pipeline to populate this chart."
      />
    );
  }

  const chartData: Datum[] = data.map((d) => ({
    year: d.year,
    oaRate: +d.value.toFixed(2),
    total: (d.metadata?.total_publications as number) ?? 0,
    oaCount: (d.metadata?.oa_publications as number) ?? 0,
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart
        data={chartData}
        margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
      >
        <defs>
          <linearGradient id="oaGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#1e40af" stopOpacity={0.2} />
            <stop offset="95%" stopColor="#1e40af" stopOpacity={0.01} />
          </linearGradient>
        </defs>
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
        <Tooltip content={<CustomTooltip />} cursor={{ stroke: gridColor }} />
        <Area
          type="monotone"
          dataKey="oaRate"
          stroke="#1e40af"
          strokeWidth={2.5}
          fill="url(#oaGradient)"
          dot={false}
          activeDot={{ r: 4, fill: "#1e40af", strokeWidth: 0 }}
          name="OA Rate"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
