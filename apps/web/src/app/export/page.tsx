import type { Metadata } from "next";
import { ExportView } from "@/components/export/ExportView";

export const metadata: Metadata = { title: "Export" };

export default function ExportPage() {
  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">Export Data</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Download FWF dataset snapshots as CSV or JSON for offline analysis.
        </p>
      </div>
      <ExportView />
    </div>
  );
}
