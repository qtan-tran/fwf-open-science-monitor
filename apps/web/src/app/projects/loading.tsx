export default function ProjectsLoading() {
  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8 max-w-6xl mx-auto space-y-4">
      <div className="h-8 w-48 rounded-lg bg-gray-200 dark:bg-gray-800 animate-pulse" />
      <div className="h-10 w-full rounded-lg bg-gray-200 dark:bg-gray-800 animate-pulse" />
      <div className="space-y-2">
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            className="h-16 rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse"
          />
        ))}
      </div>
    </div>
  );
}
