"use client";

import {
  ComposedChart,
  Bar,
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
import type { FundingDatum } from "@/lib/transforms";

export type { FundingDatum };

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
          {p.name}:{" "}
          <strong>
            {p.name === "Avg Grant (€)"
              ? `€${Math.round(p.value).toLocaleString()}`
              : p.value.toFixed(2)}
          </strong>
        </p>
      ))}
    </div>
  );
}

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
            className="inline-block h-2 w-5 rounded-full"
            style={{ background: p.color }}
          />
          {p.value}
        </span>
      ))}
    </div>
  );
}

export const FundingImpactChart = memo(function FundingImpactChart({ data }: { data: FundingDatum[] }) {
  const { gridColor, textColor } = useChartTheme();

  if (!data.length) {
    return (
      <EmptyState
        title="No funding data yet"
        description="Funding efficiency data is available for projects approved from 2012 onwards."
      />
    );
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <ComposedChart
        data={data}
        margin={{ top: 8, right: 40, left: 8, bottom: 0 }}
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
        />
        {/* Left Y axis: average grant amount */}
        <YAxis
          yAxisId="amount"
          orientation="left"
          tickFormatter={(v: number) =>
            v >= 1_000_000
              ? `€${(v / 1_000_000).toFixed(1)}M`
              : `€${(v / 1000).toFixed(0)}k`
          }
          tick={{ fontSize: 10, fill: textColor }}
          tickLine={false}
          axisLine={false}
          width={52}
        />
        {/* Right Y axis: avg outputs per project */}
        <YAxis
          yAxisId="outputs"
          orientation="right"
          tick={{ fontSize: 10, fill: textColor }}
          tickLine={false}
          axisLine={false}
          width={30}
          label={{
            value: "avg outputs",
            position: "insideTopRight",
            offset: 10,
            fontSize: 9,
            fill: textColor,
          }}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend content={<CustomLegend />} verticalAlign="top" />
        <Bar
          yAxisId="amount"
          dataKey="avgAmount"
          fill="#7c3aed"
          fillOpacity={0.75}
          radius={[3, 3, 0, 0]}
          name="Avg Grant (€)"
          barSize={18}
        />
        <Line
          yAxisId="outputs"
          type="monotone"
          dataKey="avgOutputs"
          stroke="#d97706"
          strokeWidth={2.5}
          dot={false}
          activeDot={{ r: 4, fill: "#d97706", strokeWidth: 0 }}
          name="Avg Outputs / Project"
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
});

export { toFundingData } from "@/lib/transforms";
