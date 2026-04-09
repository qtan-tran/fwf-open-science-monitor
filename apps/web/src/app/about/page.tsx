import type { Metadata } from "next";
import Link from "next/link";
import {
  ExternalLink,
  Database,
  FlaskConical,
  BarChart2,
  Globe,
  Code2,
  AlertTriangle,
  Scale,
  BookOpen,
  GitFork,
  Info,
  CheckCircle,
} from "lucide-react";

export const metadata: Metadata = { title: "About" };

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm overflow-hidden">
      <div className="flex items-center gap-2.5 px-6 py-4 border-b border-gray-100 dark:border-gray-800">
        {Icon && <Icon className="h-4 w-4 text-gray-400 dark:text-gray-500 flex-shrink-0" aria-hidden />}
        <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">{title}</h2>
      </div>
      <div className="px-6 py-5">{children}</div>
    </section>
  );
}

function ExtLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-primary-600 dark:text-primary-400 hover:underline"
    >
      {children}
      <ExternalLink className="h-3 w-3 flex-shrink-0" aria-hidden />
    </a>
  );
}

function InlineCode({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 text-xs font-mono text-gray-700 dark:text-gray-300">
      {children}
    </code>
  );
}

function Caveat({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5 text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
      <AlertTriangle className="h-4 w-4 text-amber-500 dark:text-amber-400 flex-shrink-0 mt-0.5" aria-hidden />
      <span>{children}</span>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

const STACK = [
  { name: "Next.js 16",           role: "Full-stack React framework (App Router, server components)" },
  { name: "Prisma + PostgreSQL",  role: "Database ORM with type-safe queries"                        },
  { name: "Tailwind CSS v4",      role: "Utility-first styling with native dark-mode support"        },
  { name: "Recharts 2",           role: "Composable SVG chart library built on D3"                   },
  { name: "Python ETL pipeline",  role: "Data ingestion, normalisation, and metric computation"      },
  { name: "FWF Open API",         role: "Primary source for all project, output, and funding data"   },
];

const METRICS = [
  {
    name:    "OA Publication Rate",
    what:    "Share of publication outputs associated with an open-access identifier.",
    how:     "publications where hasDoi = true OR hasPmid = true, divided by total publications × 100",
    caveat:  "DOI or PubMed ID presence is used as a proxy. A DOI does not guarantee the full text is freely accessible.",
  },
  {
    name:    "Open Data Rate",
    what:    "Share of research-data outputs that were explicitly shared with others.",
    how:     "data outputs where providedToOthers = true, divided by total data outputs × 100",
    caveat:  "Self-reported by PIs via Researchfish. Outputs without a response are treated as not open.",
  },
  {
    name:    "Open Software Rate",
    what:    "Share of software outputs that have a persistent identifier (DOI).",
    how:     "software outputs where hasDoi = true, divided by total software outputs × 100",
    caveat:  "DOI presence is a proxy for public availability. Software hosted only on GitHub without a Zenodo DOI will not be counted.",
  },
  {
    name:    "Funding Efficiency",
    what:    "Average approved grant amount per project and average output count per project, tracked by year.",
    how:     "SUM(approvedAmount) / COUNT(projects) per approval year; AVG(outputCount) per project",
    caveat:  "Funding amounts are only available for projects approved from 2012 onwards. Projects without amounts are excluded.",
  },
  {
    name:    "Institutional Rankings",
    what:    "Institutions ranked by project count, output count, or OA publication rate.",
    how:     "Aggregated from the piInstitutionRor field on each project. Counts include all historical projects.",
    caveat:  "Institutions without a ROR identifier are excluded from rankings. A single institution may appear under multiple ROR IDs if its name changed.",
  },
] as const;

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AboutPage() {
  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8 max-w-3xl mx-auto space-y-6">

      {/* ------------------------------------------------------------------ */}
      {/* Header                                                               */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 rounded-xl bg-primary-50 dark:bg-primary-900/30 p-3">
          <FlaskConical className="h-8 w-8 text-primary-700 dark:text-primary-400" aria-hidden />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">
            FWF Open Science Monitor
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            An open-source platform making open-science metrics for Austrian-funded research
            transparent and accessible.
          </p>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* 1. About This Project                                                */}
      {/* ------------------------------------------------------------------ */}
      <Section icon={Info} title="About This Project">
        <div className="space-y-3 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
          <p>
            The FWF Open Science Monitor is a monitoring platform that tracks open-science
            compliance across research projects funded by the{" "}
            <ExtLink href="https://www.fwf.ac.at/en">Austrian Science Fund (FWF)</ExtLink>.
            It measures and visualises key indicators – open-access publication rates, open data
            adoption, open software practices, and funding trends – across institutions, disciplines,
            and years.
          </p>
          <p>
            The goal is to make these metrics freely available in one place, helping funders,
            researchers, and the public understand how Austrian science is progressing towards
            open-science principles.
          </p>
          <p>            Instead of digging through reports or complex datasets, you can explore clear,
            interactive visuals to see how open science is evolving over time.
          </p>
          <p>            The project is fully open source.{" "}
            <ExtLink href="https://github.com/qtan-tran/fwf-open-science-monitor">
              View the source on GitHub
            </ExtLink>
            .
          </p>
          <p>
            The FWF Open Science Monitor platform was developed and is maintained by{" "}
            <ExtLink href="https://www.linkedin.com/in/qtantran/">Quoc-Tan Tran</ExtLink>,
            Open Science researcher at the Faculty of Sociology,{" "}
            <ExtLink href="https://www.uni-bielefeld.de/">Bielefeld University</ExtLink>,
            with technical support provided by Claude AI.
          </p>
        </div>
      </Section>

      {/* ------------------------------------------------------------------ */}
      {/* 2. Data Sources                                                      */}
      {/* ------------------------------------------------------------------ */}
      <Section icon={Database} title="Data Sources">
        <dl className="space-y-5 text-sm">

          <div className="flex gap-3">
            <Globe className="h-4 w-4 text-primary-500 flex-shrink-0 mt-0.5" aria-hidden />
            <div>
              <dt className="font-semibold text-gray-700 dark:text-gray-300">
                FWF Open API
              </dt>
              <dd className="text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">
                <ExtLink href="https://openapi.fwf.ac.at">openapi.fwf.ac.at</ExtLink>
                {" – "}the primary source for all project, output, institution, and funding
                data. The API is maintained by FWF and updated daily. Coverage spans
                FWF-funded projects from <strong className="text-gray-700 dark:text-gray-300">1995 onwards</strong>.
              </dd>
            </div>
          </div>

          <div className="flex gap-3">
            <CheckCircle className="h-4 w-4 text-emerald-500 flex-shrink-0 mt-0.5" aria-hidden />
            <div>
              <dt className="font-semibold text-gray-700 dark:text-gray-300">
                Licence
              </dt>
              <dd className="text-gray-500 dark:text-gray-400 mt-0.5">
                All data served by the FWF Open API is published under the{" "}
                <ExtLink href="https://creativecommons.org/publicdomain/zero/1.0/">
                  Creative Commons CC0 1.0
                </ExtLink>{" "}
                (public domain) licence – it may be freely used, copied, and redistributed
                without restriction.
              </dd>
            </div>
          </div>

          <div className="flex gap-3">
            <BookOpen className="h-4 w-4 text-violet-500 flex-shrink-0 mt-0.5" aria-hidden />
            <div>
              <dt className="font-semibold text-gray-700 dark:text-gray-300">
                Upstream sources behind the API
              </dt>
              <dd className="text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">
                The FWF Open API aggregates from two underlying sources:
              </dd>
              <ul className="mt-2 space-y-1.5 text-gray-500 dark:text-gray-400">
                <li className="flex gap-2">
                  <span className="font-medium text-gray-600 dark:text-gray-300 flex-shrink-0">Researchfish</span>
                  – PI-reported outputs submitted annually by grant holders. Includes
                  publications, research data, software, science-communication activities,
                  and further funding.
                </li>
                <li className="flex gap-2">
                  <span className="font-medium text-gray-600 dark:text-gray-300 flex-shrink-0">Dimensions</span>
                  – Automated bibliometric matching that enriches outputs with DOIs, PubMed
                  IDs, citation counts, and journal metadata.
                </li>
              </ul>
            </div>
          </div>

          <div className="flex gap-3">
            <BarChart2 className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" aria-hidden />
            <div>
              <dt className="font-semibold text-gray-700 dark:text-gray-300">
                Mock / benchmark data
              </dt>
              <dd className="text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">
                Comparisons involving non-Austrian institutions (e.g. Germany) are based on
                <strong className="text-gray-700 dark:text-gray-300"> simulated benchmark data</strong>.
                Germany&rsquo;s equivalent funder (DFG) does not publish a comparable open API.
                Mock values were generated using statistical distributions similar to the FWF
                dataset solely for illustrative purposes. These comparisons are labelled
                clearly wherever they appear.
              </dd>
            </div>
          </div>
        </dl>
      </Section>

      {/* ------------------------------------------------------------------ */}
      {/* 3. Metric Definitions                                                */}
      {/* ------------------------------------------------------------------ */}
      <Section icon={BarChart2} title="Metric Definitions">
        <div className="overflow-x-auto rounded-lg border border-gray-100 dark:border-gray-800 -mx-1">
          <table className="min-w-full text-sm divide-y divide-gray-100 dark:divide-gray-800">
            <thead className="bg-gray-50 dark:bg-gray-800/60">
              <tr>
                {["Metric", "What it measures", "How it is calculated", "Key caveat"].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800 bg-white dark:bg-gray-900">
              {METRICS.map((m) => (
                <tr key={m.name} className="align-top">
                  <td className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">
                    {m.name}
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400 leading-relaxed max-w-[180px]">
                    {m.what}
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400 font-mono text-xs leading-relaxed max-w-[200px]">
                    {m.how}
                  </td>
                  <td className="px-4 py-3 text-amber-700 dark:text-amber-400 leading-relaxed max-w-[180px] text-xs">
                    {m.caveat}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* ------------------------------------------------------------------ */}
      {/* 4. Limitations and Caveats                                           */}
      {/* ------------------------------------------------------------------ */}
      <Section icon={AlertTriangle} title="Limitations and Caveats">
        <ul className="space-y-3.5">
          <Caveat>
            <strong>OA status is a proxy, not a verified check.</strong> A DOI or PubMed ID
            indicates that an output has a persistent identifier, but does not confirm whether
            the full text is freely accessible. Version-of-record paywalls are not detected.
          </Caveat>
          <Caveat>
            <strong>Funding amounts are only available from 2012 onwards.</strong> Pre-2012
            projects exist in the dataset but have <InlineCode>approvedAmount = null</InlineCode>.
            Any metric involving funding is computed only over projects with a non-null amount.
          </Caveat>
          <Caveat>
            <strong>ORCID has been mandatory for FWF grantees only since 2016.</strong> Older
            projects frequently have no ORCID recorded for the principal investigator. Researcher
            Explorer results for pre-2016 grants may therefore be incomplete.
          </Caveat>
          <Caveat>
            <strong>Output data depends on PI self-reporting via Researchfish.</strong> PIs
            submit outputs annually; completeness varies by grant and by how diligently the
            reporting obligation is fulfilled. Under-reporting is likely, particularly for
            older grants.
          </Caveat>
          <Caveat>
            <strong>Austrian–German comparison figures are mock data.</strong> No equivalent
            open API exists for Germany&rsquo;s DFG. The benchmark values shown in the Researcher
            Explorer and any cross-national comparisons are statistically generated and labelled
            clearly. They should not be used for policy conclusions.
          </Caveat>
          <Caveat>
            <strong>Not all outputs carry persistent identifiers.</strong> Conference papers,
            book chapters, and non-traditional outputs often lack a DOI or PMID, which causes
            them to be counted as &ldquo;not open access&rdquo; even if they are freely available elsewhere.
          </Caveat>
          <Caveat>
            <strong>Output and project IDs change daily in the upstream API.</strong> The ETL
            pipeline uses FWF&rsquo;s own identifiers, which may be reassigned during nightly
            updates. Bookmarked project URLs may break after a resync.
          </Caveat>
        </ul>
      </Section>

      {/* ------------------------------------------------------------------ */}
      {/* 5. Technical Architecture                                            */}
      {/* ------------------------------------------------------------------ */}
      <Section icon={Code2} title="Technical Architecture">
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {STACK.map(({ name, role }) => (
              <div
                key={name}
                className="flex gap-2.5 rounded-lg border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/30 px-3.5 py-3"
              >
                <Code2 className="h-4 w-4 text-gray-400 flex-shrink-0 mt-0.5" aria-hidden />
                <div>
                  <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">{name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 leading-snug mt-0.5">{role}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
            The ETL pipeline fetches paginated data from the FWF Open API, normalises it
            into a PostgreSQL schema, and pre-computes metric snapshots stored in the{" "}
            <InlineCode>MetricSnapshot</InlineCode> table for fast dashboard queries.
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Full system design:{" "}
            <ExtLink href="https://github.com/qtan-tran/fwf-open-science-monitor/blob/main/docs/architecture.md">
              docs/architecture.md
            </ExtLink>
          </p>
        </div>
      </Section>

      {/* ------------------------------------------------------------------ */}
      {/* 6. License and Attribution                                           */}
      {/* ------------------------------------------------------------------ */}
      <Section icon={Scale} title="License and Attribution">
        <div className="space-y-4 text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-lg border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/30 px-4 py-3">
              <p className="font-semibold text-gray-700 dark:text-gray-300 mb-1">Application code</p>
              <p>
                Released under the{" "}
                <ExtLink href="https://opensource.org/licenses/MIT">MIT License</ExtLink>.
                Free to use, modify, and distribute with attribution.
              </p>
            </div>
            <div className="rounded-lg border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/30 px-4 py-3">
              <p className="font-semibold text-gray-700 dark:text-gray-300 mb-1">Data</p>
              <p>
                All FWF data is published under{" "}
                <ExtLink href="https://creativecommons.org/publicdomain/zero/1.0/">
                  CC0 1.0
                </ExtLink>{" "}
                – no rights reserved. No attribution is required, but citing the source
                is appreciated.
              </p>
            </div>
          </div>
          <div>
            <p className="font-semibold text-gray-700 dark:text-gray-300 mb-1">How to cite</p>
            <div className="rounded-lg border-l-4 border-primary-300 dark:border-primary-700 border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/30 px-4 py-3 font-mono text-xs text-gray-600 dark:text-gray-400 leading-relaxed space-y-2">
              <p>
                Tran, Q.-T. (2025). Open-science metrics for FWF-funded research. GitHub.{" "}
                <ExtLink href="https://github.com/qtan-tran/fwf-open-science-monitor">
                  https://github.com/qtan-tran/fwf-open-science-monitor
                </ExtLink>
              </p>
              <p className="text-gray-500 dark:text-gray-500 border-t border-gray-200 dark:border-gray-700 pt-2">
                Data source: FWF Open API (CC0).{" "}
                <ExtLink href="https://openapi.fwf.ac.at">https://openapi.fwf.ac.at</ExtLink>
              </p>
            </div>
          </div>
        </div>
      </Section>

      {/* ------------------------------------------------------------------ */}
      {/* 7. Contributing                                                      */}
      {/* ------------------------------------------------------------------ */}
      <Section icon={GitFork} title="Contributing">
        <div className="space-y-3 text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
          <p>
            Contributions are welcome – whether that is a bug fix, a new metric, improved
            documentation, or a question.
          </p>
          <ul className="space-y-2">
            <li className="flex gap-2">
              <span className="font-semibold text-gray-700 dark:text-gray-300 flex-shrink-0">Guidelines:</span>
              <ExtLink href="https://github.com/qtan-tran/fwf-open-science-monitor/blob/main/CONTRIBUTING.md">
                CONTRIBUTING.md
              </ExtLink>
            </li>
            <li className="flex gap-2">
              <span className="font-semibold text-gray-700 dark:text-gray-300 flex-shrink-0">Report an issue:</span>
              <ExtLink href="https://github.com/qtan-tran/fwf-open-science-monitor/issues">
                GitHub Issues
              </ExtLink>
            </li>
            <li className="flex gap-2">
              <span className="font-semibold text-gray-700 dark:text-gray-300 flex-shrink-0">Source:</span>
              <ExtLink href="https://github.com/qtan-tran/fwf-open-science-monitor">
                github.com/qtan-tran/fwf-open-science-monitor
              </ExtLink>
            </li>
          </ul>
        </div>
      </Section>

      {/* ------------------------------------------------------------------ */}
      {/* Quick nav                                                            */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { href: "/dashboard",    label: "Dashboard"    },
          { href: "/projects",     label: "Projects"     },
          { href: "/institutions", label: "Institutions" },
          { href: "/explore",      label: "Explore"      },
        ].map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/30 px-3 py-2 text-center text-sm font-medium text-gray-600 dark:text-gray-400 hover:border-primary-300 dark:hover:border-primary-700 hover:text-primary-700 dark:hover:text-primary-400 transition-colors"
          >
            {label}
          </Link>
        ))}
      </div>

    </div>
  );
}
