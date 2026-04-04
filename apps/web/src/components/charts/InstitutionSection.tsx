"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import type { InstitutionRanking } from "@/lib/types";
import { ChartCard } from "@/components/ui/ChartCard";
import { DataTable } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Badge";
import { InstitutionBarChart } from "./InstitutionBarChart";

interface InstitutionSectionProps {
  data: InstitutionRanking[];
}

type SortKey = "projectCount" | "outputCount" | "oaPublicationRate";

export function InstitutionSection({ data }: InstitutionSectionProps) {
  const [sortKey, setSortKey] = useState<SortKey>("outputCount");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const sorted = useMemo(() => {
    return [...data].sort((a, b) => {
      const diff = a[sortKey] - b[sortKey];
      return sortDir === "desc" ? -diff : diff;
    });
  }, [data, sortKey, sortDir]);

  function handleSort(key: string, dir: "asc" | "desc") {
    if (["projectCount", "outputCount", "oaPublicationRate"].includes(key)) {
      setSortKey(key as SortKey);
    }
    setSortDir(dir);
  }

  const tableData = sorted.map((inst, i) => ({ ...inst, rank: i + 1 }));

  const columns = [
    {
      key: "rank",
      label: "#",
      render: (v: unknown) => (
        <span className="text-gray-400 dark:text-gray-600 font-mono text-xs">
          {v as number}
        </span>
      ),
    },
    {
      key: "name",
      label: "Institution",
      render: (v: unknown, row: typeof tableData[number]) => (
        <Link
          href={`/institutions/${encodeURIComponent(row.rorId)}`}
          className="text-primary-700 dark:text-primary-400 hover:underline font-medium leading-snug"
        >
          {v as string}
        </Link>
      ),
    },
    {
      key: "country",
      label: "Country",
      render: (v: unknown) => (
        <span className="text-xs">{(v as string) || "—"}</span>
      ),
    },
    {
      key: "projectCount",
      label: "Projects",
      sortable: true,
      render: (v: unknown) => (v as number).toLocaleString(),
    },
    {
      key: "outputCount",
      label: "Outputs",
      sortable: true,
      render: (v: unknown) => (v as number).toLocaleString(),
    },
    {
      key: "oaPublicationRate",
      label: "OA Rate",
      sortable: true,
      render: (v: unknown) => {
        const rate = v as number;
        const variant =
          rate >= 80 ? "success" : rate >= 50 ? "info" : rate >= 20 ? "warning" : "neutral";
        return <Badge label={`${rate.toFixed(1)}%`} variant={variant} />;
      },
    },
  ];

  return (
    <div className="space-y-4">
      <ChartCard
        title="Top 10 Institutions by Output Count"
        subtitle="Horizontal bars show total research outputs"
      >
        <InstitutionBarChart data={sorted.slice(0, 10)} />
      </ChartCard>

      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Institution Rankings
          </h3>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            Click column headers to sort. OA rate is for publications only.
          </p>
        </div>
        <DataTable
          columns={columns}
          data={tableData}
          page={1}
          totalPages={1}
          onPageChange={() => {}}
          onSort={handleSort}
        />
      </div>
    </div>
  );
}
