import type { LucideIcon } from "lucide-react";
import { SearchX } from "lucide-react";

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: LucideIcon;
}

export function EmptyState({
  title,
  description,
  icon: Icon = SearchX,
}: EmptyStateProps) {
  return (
    <div
      role="status"
      className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/50 px-6 py-16 text-center"
    >
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 mb-4">
        <Icon className="h-6 w-6 text-gray-400 dark:text-gray-500" aria-hidden />
      </div>
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
        {title}
      </h3>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 max-w-sm">
        {description}
      </p>
    </div>
  );
}
