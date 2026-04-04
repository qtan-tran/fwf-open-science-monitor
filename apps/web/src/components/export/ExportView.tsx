"use client";

import { useState } from "react";
import {
  Download, FileSpreadsheet, FileJson,
  FolderOpen, FileOutput, BarChart2, Building2,
} from "lucide-react";
import { getExportUrl } from "@/lib/api-client";
import type { ExportType, ExportFormat } from "@/lib/types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TYPE_OPTIONS: Array<{
  value: ExportType;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { value: "projects",     label: "Projects",     icon: FolderOpen,  description: "All FWF-funded research projects with PI and funding details" },
  { value: "outputs",      label: "Outputs",       icon: FileOutput,  description: "Research outputs: publications, data, software, and more"     },
  { value: "metrics",      label: "Metrics",       icon: BarChart2,   description: "Pre-computed metric snapshots from the ETL pipeline"          },
  { value: "institutions", label: "Institutions",  icon: Building2,   description: "Institution-level project counts and output statistics"       },
];

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: CURRENT_YEAR - 1999 }, (_, i) => CURRENT_YEAR - i);

const PROJECT_STATUSES = ["Ongoing", "Completed", "Cancelled"];

const OUTPUT_CATEGORIES = [
  "publications",
  "software and technical products",
  "research data and analysis techniques",
  "research tools and methods",
  "science communication",
  "creative and artistic works",
  "awards",
  "medical products and interventions",
  "patents and licenses",
  "societal impact",
  "start-ups",
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ExportView() {
  const [type, setType]               = useState<ExportType>("projects");
  const [format, setFormat]           = useState<ExportFormat>("csv");
  const [year, setYear]               = useState("");
  const [status, setStatus]           = useState("");
  const [institution, setInstitution] = useState("");
  const [category, setCategory]       = useState("");
  const [hasDoi, setHasDoi]           = useState("");
  const [metricKey, setMetricKey]     = useState("");

  function handleDownload() {
    const url = getExportUrl({
      type,
      format,
      year:        year ? parseInt(year, 10) : undefined,
      status:      status || undefined,
      institution: institution || undefined,
      category:    category || undefined,
      hasDoi:      hasDoi === "true" ? true : hasDoi === "false" ? false : undefined,
      metricKey:   metricKey || undefined,
    });
    window.open(url, "_blank", "noopener,noreferrer");
  }

  const selectClass =
    "w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 " +
    "text-gray-700 dark:text-gray-200 text-sm px-3 py-2 focus:outline-none focus:ring-2 " +
    "focus:ring-primary-500 dark:focus:ring-primary-400";

  const inputClass =
    selectClass + " placeholder:text-gray-400 dark:placeholder:text-gray-600";

  return (
    <div className="space-y-6">
      {/* Dataset type */}
      <section className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Dataset</h2>
        </div>
        <div className="px-5 py-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {TYPE_OPTIONS.map((opt) => {
            const isActive = opt.value === type;
            return (
              <button
                key={opt.value}
                onClick={() => setType(opt.value)}
                className={[
                  "text-left rounded-lg border-2 px-4 py-3 transition-colors",
                  isActive
                    ? "border-primary-500 bg-primary-50 dark:bg-primary-900/20"
                    : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600",
                ].join(" ")}
              >
                <opt.icon
                  className={`h-5 w-5 mb-2 ${isActive ? "text-primary-600 dark:text-primary-400" : "text-gray-400 dark:text-gray-500"}`}
                  aria-hidden
                />
                <p className={`text-sm font-semibold ${isActive ? "text-primary-700 dark:text-primary-400" : "text-gray-700 dark:text-gray-300"}`}>
                  {opt.label}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-snug">
                  {opt.description}
                </p>
              </button>
            );
          })}
        </div>
      </section>

      {/* Format + filters */}
      <section className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Format &amp; Filters</h2>
        </div>
        <div className="px-5 py-4 space-y-5">

          {/* Format */}
          <div>
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
              Format
            </p>
            <div className="flex gap-2">
              {(["csv", "json"] as ExportFormat[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFormat(f)}
                  className={[
                    "flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors",
                    format === f
                      ? "border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400"
                      : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600",
                  ].join(" ")}
                >
                  {f === "csv"
                    ? <FileSpreadsheet className="h-4 w-4" aria-hidden />
                    : <FileJson       className="h-4 w-4" aria-hidden />
                  }
                  {f.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

            {/* Year — projects and outputs only */}
            {(type === "projects" || type === "outputs") && (
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">
                  Year
                </label>
                <select value={year} onChange={(e) => setYear(e.target.value)} className={selectClass}>
                  <option value="">All years</option>
                  {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            )}

            {/* Status — projects only */}
            {type === "projects" && (
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">
                  Status
                </label>
                <select value={status} onChange={(e) => setStatus(e.target.value)} className={selectClass}>
                  <option value="">All statuses</option>
                  {PROJECT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            )}

            {/* Institution ROR — projects only */}
            {type === "projects" && (
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">
                  Institution ROR
                </label>
                <input
                  type="text"
                  value={institution}
                  onChange={(e) => setInstitution(e.target.value)}
                  placeholder="e.g. https://ror.org/04d836q62"
                  className={inputClass}
                />
              </div>
            )}

            {/* Category — outputs only */}
            {type === "outputs" && (
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">
                  Category
                </label>
                <select value={category} onChange={(e) => setCategory(e.target.value)} className={selectClass}>
                  <option value="">All categories</option>
                  {OUTPUT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            )}

            {/* Has DOI — outputs only */}
            {type === "outputs" && (
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">
                  Has DOI
                </label>
                <select value={hasDoi} onChange={(e) => setHasDoi(e.target.value)} className={selectClass}>
                  <option value="">Any</option>
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              </div>
            )}

            {/* Metric key — metrics only */}
            {type === "metrics" && (
              <div className="sm:col-span-2 lg:col-span-3">
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">
                  Metric Key <span className="font-normal normal-case">(optional — leave blank for all metrics)</span>
                </label>
                <input
                  type="text"
                  value={metricKey}
                  onChange={(e) => setMetricKey(e.target.value)}
                  placeholder="e.g. project_count_by_year"
                  className={inputClass}
                />
              </div>
            )}

            {/* Institutions — no filters */}
            {type === "institutions" && (
              <p className="sm:col-span-2 lg:col-span-3 text-sm text-gray-400 dark:text-gray-600 italic">
                No additional filters available for the institutions dataset.
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Download */}
      <div className="flex justify-end">
        <button
          onClick={handleDownload}
          className="inline-flex items-center gap-2 rounded-lg bg-primary-600 hover:bg-primary-700 dark:bg-primary-700 dark:hover:bg-primary-600 text-white px-5 py-2.5 text-sm font-semibold shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
        >
          <Download className="h-4 w-4" aria-hidden />
          Download {format.toUpperCase()}
        </button>
      </div>
    </div>
  );
}
