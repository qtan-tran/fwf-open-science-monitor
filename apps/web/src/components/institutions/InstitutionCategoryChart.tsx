"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ResponsiveContainer,
} from "recharts";
import { useChartTheme, CHART_COLORS } from "@/components/charts/useChartTheme";

export interface CategoryCount { category: string; count: number; }

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ payload: CategoryCount }>;
}

function CustomTooltip({ active, payload }: TooltipProps) {
  const { tooltipBg, tooltipBorder, tooltipText } = useChartTheme();
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div
      style={{ background: tooltipBg, border: `1px solid ${tooltipBorder}`, color: tooltipText }}
      className="rounded-lg px-3 py-2 shadow-lg text-xs max-w-[200px]"
    >
      <p className="font-semibold leading-snug mb-1">{d.category}</p>
      <p>Count: <strong>{d.count.toLocaleString()}</strong></p>
    </div>
  );
}

export function InstitutionCategoryChart({ data }: { data: CategoryCount[] }) {
  const { gridColor, textColor } = useChartTheme();
  if (!data.length) return null;

  return (
    <ResponsiveContainer width="100%" height={Math.max(160, data.length * 28 + 32)}>
      <BarChart
        layout="vertical"
        data={data}
        margin={{ top: 4, right: 16, left: 4, bottom: 4 }}
        barCategoryGap="25%"
      >
        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 10, fill: textColor }} tickLine={false} axisLine={false} />
        <YAxis
          type="category"
          dataKey="category"
          width={120}
          tick={{ fontSize: 11, fill: textColor }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: string) => v.length > 16 ? v.slice(0, 14) + "…" : v}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: gridColor }} />
        <Bar dataKey="count" radius={[0, 3, 3, 0]} name="Outputs">
          {data.map((d, i) => (
            <Cell key={d.category} fill={CHART_COLORS[i % CHART_COLORS.length]} fillOpacity={0.8} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
