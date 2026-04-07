export default function DashboardLoading() {
  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-6">
      {/* Stat cards skeleton */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-28 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-100 dark:bg-gray-800 animate-pulse"
          />
        ))}
      </div>
      {/* Chart skeletons */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-72 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-100 dark:bg-gray-800 animate-pulse"
          />
        ))}
      </div>
    </div>
  );
}
