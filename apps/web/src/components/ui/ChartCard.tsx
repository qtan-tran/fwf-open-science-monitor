import { Download } from "lucide-react";

interface ChartCardProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  onExport?: () => void;
}

export function ChartCard({ title, subtitle, children, onExport }: ChartCardProps) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 px-5 pt-5 pb-0">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 leading-tight">
            {title}
          </h3>
          {subtitle && (
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
              {subtitle}
            </p>
          )}
        </div>
        {onExport && (
          <button
            onClick={onExport}
            aria-label="Export chart data"
            className="flex-shrink-0 rounded-md p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-600 dark:hover:text-gray-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
          >
            <Download className="h-4 w-4" aria-hidden />
          </button>
        )}
      </div>
      {/* Chart area */}
      <div className="px-5 pb-5 pt-4">{children}</div>
    </div>
  );
}
