"use client";

interface FilterOption {
  value: string;
  label: string;
}

interface Filter {
  key: string;
  label: string;
  options: FilterOption[];
}

interface FilterBarProps {
  filters: Filter[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
}

export function FilterBar({ filters, values, onChange }: FilterBarProps) {
  return (
    <div
      role="search"
      aria-label="Filter controls"
      className="flex flex-wrap items-center gap-3"
    >
      {filters.map((filter) => (
        <div key={filter.key} className="flex flex-col gap-1 min-w-0">
          <label
            htmlFor={`filter-${filter.key}`}
            className="text-xs font-medium text-gray-500 dark:text-gray-400"
          >
            {filter.label}
          </label>
          <select
            id={`filter-${filter.key}`}
            value={values[filter.key] ?? ""}
            onChange={(e) => onChange(filter.key, e.target.value)}
            className={[
              "rounded-md border border-gray-200 dark:border-gray-700",
              "bg-white dark:bg-gray-800",
              "px-3 py-1.5 text-sm text-gray-700 dark:text-gray-200",
              "shadow-sm",
              "focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500",
              "min-w-[140px]",
            ].join(" ")}
          >
            <option value="">All</option>
            {filter.options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      ))}
    </div>
  );
}
