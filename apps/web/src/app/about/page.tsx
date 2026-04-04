import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink, Database, FlaskConical, BarChart2, Globe, Code2 } from "lucide-react";

export const metadata: Metadata = { title: "About" };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm p-6">
      <h2 className="text-base font-bold text-gray-900 dark:text-gray-100 mb-4">{title}</h2>
      {children}
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

const STACK = [
  { name: "Next.js 16",          role: "Full-stack React framework (App Router)"   },
  { name: "Prisma + PostgreSQL", role: "Database ORM and relational storage"        },
  { name: "Tailwind CSS v4",     role: "Utility-first styling with dark mode"       },
  { name: "Recharts",            role: "Composable SVG chart library"                },
  { name: "Python ETL pipeline", role: "Data ingestion and metric computation"       },
  { name: "FWF Open API",        role: "Source of all project and output data"       },
];

export default function AboutPage() {
  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 rounded-xl bg-primary-50 dark:bg-primary-900/30 p-3">
          <FlaskConical className="h-8 w-8 text-primary-700 dark:text-primary-400" aria-hidden />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">
            FWF Open Science Monitor
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            An open-source dashboard tracking open-science metrics for Austrian-funded research.
          </p>
        </div>
      </div>

      {/* About */}
      <Section title="About">
        <div className="space-y-3 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
          <p>
            The FWF Open Science Monitor visualises open-science trends in research funded by the{" "}
            <ExtLink href="https://www.fwf.ac.at/en">Austrian Science Fund (FWF)</ExtLink>.
            It tracks key indicators such as open-access publication rates, open data and open
            software uptake, and funding trends across institutions and years.
          </p>
          <p>
            All data is retrieved from the public{" "}
            <ExtLink href="https://openapi.fwf.ac.at">FWF Open API</ExtLink> and stored in a
            local PostgreSQL database via an automated ETL pipeline. Metrics are pre-computed and
            cached for fast query performance.
          </p>
        </div>
      </Section>

      {/* Data source */}
      <Section title="Data Source">
        <dl className="space-y-4 text-sm">
          <div className="flex gap-3">
            <Globe className="h-4 w-4 text-gray-400 flex-shrink-0 mt-0.5" aria-hidden />
            <div>
              <dt className="font-semibold text-gray-700 dark:text-gray-300">FWF Open API</dt>
              <dd className="text-gray-500 dark:text-gray-400 mt-0.5">
                <ExtLink href="https://openapi.fwf.ac.at">openapi.fwf.ac.at</ExtLink>
                {" — "}comprehensive dataset of all FWF-funded projects, outputs, and institutions.
              </dd>
            </div>
          </div>
          <div className="flex gap-3">
            <Database className="h-4 w-4 text-gray-400 flex-shrink-0 mt-0.5" aria-hidden />
            <div>
              <dt className="font-semibold text-gray-700 dark:text-gray-300">Licence</dt>
              <dd className="text-gray-500 dark:text-gray-400 mt-0.5">
                FWF data is published under the{" "}
                <ExtLink href="https://creativecommons.org/publicdomain/zero/1.0/">
                  Creative Commons CC0 1.0
                </ExtLink>{" "}
                (public domain) licence.
              </dd>
            </div>
          </div>
          <div className="flex gap-3">
            <BarChart2 className="h-4 w-4 text-gray-400 flex-shrink-0 mt-0.5" aria-hidden />
            <div>
              <dt className="font-semibold text-gray-700 dark:text-gray-300">Mock / Benchmark Data</dt>
              <dd className="text-gray-500 dark:text-gray-400 mt-0.5">
                Non-Austrian institutions (Germany, UK, France, etc.) are included as illustrative
                benchmarks only. FWF exclusively funds Austrian research.
              </dd>
            </div>
          </div>
        </dl>
      </Section>

      {/* Tech stack */}
      <Section title="Technology Stack">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {STACK.map(({ name, role }) => (
            <div
              key={name}
              className="flex gap-2 rounded-lg border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/30 px-3 py-2.5"
            >
              <Code2 className="h-4 w-4 text-gray-400 flex-shrink-0 mt-0.5" aria-hidden />
              <div>
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">{name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{role}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Navigation */}
      <Section title="Explore the Dashboard">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { href: "/dashboard",    label: "Dashboard"    },
            { href: "/projects",     label: "Projects"     },
            { href: "/institutions", label: "Institutions" },
            { href: "/explore",      label: "Explore Data" },
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
      </Section>
    </div>
  );
}
