"use client";

import { useState } from "react";
import { ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight } from "lucide-react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RowData = Record<string, any>;

interface Column<T extends RowData = RowData> {
  key: string;
  label: string;
  sortable?: boolean;
  render?: (value: unknown, row: T) => React.ReactNode;
}

interface DataTableProps<T extends RowData = RowData> {
  columns: Column<T>[];
  data: T[];
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onSort?: (key: string, dir: "asc" | "desc") => void;
}

function SortIcon({ state }: { state: "asc" | "desc" | null }) {
  if (state === "asc")  return <ChevronUp   className="h-3.5 w-3.5 text-primary-600 dark:text-primary-400" aria-hidden />;
  if (state === "desc") return <ChevronDown  className="h-3.5 w-3.5 text-primary-600 dark:text-primary-400" aria-hidden />;
  return <ChevronsUpDown className="h-3.5 w-3.5 text-gray-300 dark:text-gray-600" aria-hidden />;
}

export function DataTable<T extends RowData = RowData>({
  columns,
  data,
  page,
  totalPages,
  onPageChange,
  onSort,
}: DataTableProps<T>) {
  const [sortKey, setSortKey]   = useState<string | null>(null);
  const [sortDir, setSortDir]   = useState<"asc" | "desc">("asc");

  function handleSort(key: string) {
    if (!onSort) return;
    const nextDir = sortKey === key && sortDir === "asc" ? "desc" : "asc";
    setSortKey(key);
    setSortDir(nextDir);
    onSort(key, nextDir);
  }

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm">
      {/* Scrollable table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
          <thead className="bg-gray-50 dark:bg-gray-800/60">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  className={[
                    "px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 whitespace-nowrap",
                    col.sortable && onSort ? "cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200" : "",
                  ].join(" ")}
                  onClick={col.sortable ? () => handleSort(col.key) : undefined}
                  aria-sort={
                    sortKey === col.key
                      ? sortDir === "asc" ? "ascending" : "descending"
                      : col.sortable ? "none" : undefined
                  }
                >
                  <span className="flex items-center gap-1">
                    {col.label}
                    {col.sortable && onSort && (
                      <SortIcon state={sortKey === col.key ? sortDir : null} />
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {data.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-10 text-center text-sm text-gray-400 dark:text-gray-600"
                >
                  No data available.
                </td>
              </tr>
            ) : (
              data.map((row, rowIdx) => (
                <tr
                  key={rowIdx}
                  className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors"
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap"
                    >
                      {col.render
                        ? col.render(row[col.key], row)
                        : (row[col.key] ?? "—")}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-gray-100 dark:border-gray-800 px-4 py-3">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Page {page} of {totalPages}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
              aria-label="Previous page"
              className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:pointer-events-none disabled:opacity-40 transition-colors"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden />
            </button>
            <button
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
              aria-label="Next page"
              className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:pointer-events-none disabled:opacity-40 transition-colors"
            >
              <ChevronRight className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
