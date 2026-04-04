interface LoadingStateProps {
  /** Number of skeleton rows to render (for table variant) */
  rows?: number;
  /** "chart" renders a tall skeleton block; "table" renders rows; "card" renders a stat-card shape */
  variant?: "chart" | "table" | "card" | "cards";
}

function SkeletonBlock({ className }: { className?: string }) {
  return <div className={`skeleton rounded-md ${className ?? ""}`} aria-hidden />;
}

function ChartSkeleton() {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm p-5">
      <SkeletonBlock className="h-4 w-40 mb-1" />
      <SkeletonBlock className="h-3 w-64 mb-6" />
      <SkeletonBlock className="h-48 w-full" />
    </div>
  );
}

function TableSkeleton({ rows }: { rows: number }) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-gray-50 dark:bg-gray-800/60 px-4 py-3 flex gap-6">
        {[40, 100, 60, 80].map((w, i) => (
          <SkeletonBlock key={i} className={`h-3 w-${w}`} />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex gap-6 px-4 py-3 border-t border-gray-100 dark:border-gray-800"
        >
          {[60, 120, 40, 80].map((w, j) => (
            <SkeletonBlock key={j} className={`h-3 w-${w}`} />
          ))}
        </div>
      ))}
    </div>
  );
}

function CardSkeleton() {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm p-5">
      <SkeletonBlock className="h-3 w-24 mb-3" />
      <SkeletonBlock className="h-7 w-32 mb-2" />
      <SkeletonBlock className="h-3 w-20" />
    </div>
  );
}

export function LoadingState({ rows = 5, variant = "chart" }: LoadingStateProps) {
  return (
    <div role="status" aria-label="Loading…">
      {variant === "chart" && <ChartSkeleton />}
      {variant === "table" && <TableSkeleton rows={rows} />}
      {variant === "card"  && <CardSkeleton />}
      {variant === "cards" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      )}
      <span className="sr-only">Loading content…</span>
    </div>
  );
}
