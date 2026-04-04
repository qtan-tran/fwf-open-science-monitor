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
import { EmptyState } from "@/components/ui/EmptyState";
import { CHART_COLORS, useChartTheme } from "./useChartTheme";

export interface CategoryDatum {
  category: string;
  count: number;
}

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ payload: CategoryDatum }>;
}

// Short display labels for long category names
const CATEGORY_LABELS: Record<string, string> = {
  "publications":                              "Publications",
  "software and technical products":           "Software",
  "research data and analysis techniques":     "Research Data",
  "research tools and methods":                "Tools & Methods",
  "science communication":                     "Sci. Communication",
  "creative and artistic works":               "Creative Works",
  "awards":                                    "Awards",
  "medical products and interventions":        "Medical Products",
  "patents and licenses":                      "Patents & Licenses",
  "societal impact":                           "Societal Impact",
  "start-ups":                                 "Start-ups",
};

function shortLabel(cat: string): string {
  return CATEGORY_LABELS[cat] ?? (cat.length > 22 ? cat.slice(0, 20) + "…" : cat);
}

function CustomTooltip({ active, payload }: TooltipProps) {
  const { tooltipBg, tooltipBorder, tooltipText } = useChartTheme();
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div
      style={{ background: tooltipBg, border: `1px solid ${tooltipBorder}`, color: tooltipText }}
      className="rounded-lg px-3 py-2 shadow-lg text-xs max-w-[220px]"
    >
      <p className="font-semibold mb-1 leading-snug">{d.category}</p>
      <p>Count: <strong>{d.count.toLocaleString()}</strong></p>
    </div>
  );
}

export function OutputCategoriesChart({ data }: { data: CategoryDatum[] }) {
  const { gridColor, textColor } = useChartTheme();

  if (!data.length) {
    return (
      <EmptyState
        title="No output data yet"
        description="Run the ETL pipeline to populate this chart."
      />
    );
  }

  const chartData = data.map((d) => ({
    ...d,
    label: shortLabel(d.category),
  }));

  const barHeight = 28;
  const chartHeight = Math.max(180, chartData.length * barHeight + 40);

  return (
    <ResponsiveContainer width="100%" height={chartHeight}>
      <BarChart
        layout="vertical"
        data={chartData}
        margin={{ top: 4, right: 16, left: 4, bottom: 4 }}
        barCategoryGap="25%"
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
          dataKey="label"
          width={130}
          tick={{ fontSize: 11, fill: textColor }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: gridColor }} />
        <Bar dataKey="count" radius={[0, 3, 3, 0]} name="Outputs">
          {chartData.map((d, i) => (
            <Cell
              key={d.category}
              fill={CHART_COLORS[i % CHART_COLORS.length]}
              fillOpacity={0.85}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
