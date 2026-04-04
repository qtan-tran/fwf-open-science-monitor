import type { LucideIcon } from "lucide-react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  unit?: string;
  trend?: "up" | "down" | "neutral";
  trendLabel?: string;
  icon?: LucideIcon;
}

const TREND_CONFIG = {
  up:      { Icon: TrendingUp,   color: "text-emerald-600 dark:text-emerald-400" },
  down:    { Icon: TrendingDown, color: "text-red-600     dark:text-red-400"     },
  neutral: { Icon: Minus,        color: "text-gray-400    dark:text-gray-500"    },
} as const;

export function StatCard({
  title,
  value,
  unit,
  trend,
  trendLabel,
  icon: Icon,
}: StatCardProps) {
  const trendCfg = trend ? TREND_CONFIG[trend] : null;

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
            {title}
          </p>
          <p className="mt-1 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-50">
              {typeof value === "number" ? value.toLocaleString() : value}
            </span>
            {unit && (
              <span className="text-sm text-gray-500 dark:text-gray-400">{unit}</span>
            )}
          </p>
        </div>
        {Icon && (
          <div className="flex-shrink-0 rounded-lg bg-primary-50 dark:bg-primary-900/30 p-2">
            <Icon
              className="h-5 w-5 text-primary-600 dark:text-primary-400"
              aria-hidden
            />
          </div>
        )}
      </div>
      {trendCfg && trendLabel && (
        <div className={`mt-3 flex items-center gap-1 text-xs font-medium ${trendCfg.color}`}>
          <trendCfg.Icon className="h-3.5 w-3.5 flex-shrink-0" aria-hidden />
          <span>{trendLabel}</span>
        </div>
      )}
    </div>
  );
}
