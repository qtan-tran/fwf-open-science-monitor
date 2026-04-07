# Exploration Modes

The **Explore** section (`/explore`) provides ten guided analysis views, each
answering a specific question about FWF open-science data. Each mode lives at
`/explore/[slug]` and is backed by a `ExploreModeView` client component that
fetches data from the app's own API routes.

---

## Mode Index

| Slug | Title | Badge | Primary question |
|---|---|---|---|
| `totals` | Total Projects & Outputs | Overview | How has the FWF portfolio grown over time? |
| `recent` | Recent Open Projects | Projects | Which recent projects have open outputs? |
| `oa-rates` | OA Rates Over Time | Metrics | Is open access improving year on year? |
| `rankings` | Institutional Rankings | Institutions | Which institutions lead on openness? |
| `publication-trends` | Yearly Publication Trends | Outputs | How do output categories change over time? |
| `topics` | Topic Search | Search | Which projects cover a specific research topic? |
| `export` | CSV Export Builder | Export | How do I download the underlying data? |
| `researchers` | Researcher Explorer | People | What has a given researcher published openly? |
| `funding-impact` | Funding vs. Outputs | Analysis | Do larger grants produce more outputs? |
| `system` | System Health | Admin | Is the data up to date? |

---

## Mode Descriptions

### `totals` — Total Projects & Outputs

**Question answered:** How has the total number of FWF-funded projects and
research outputs grown from the earliest available year to today?

**What you see:**
- Four stat cards: total projects, total outputs, total institutions, overall OA rate
- Stacked area chart of cumulative project and output counts by year

**Data used:**
- `GET /api/metrics/summary` — headline totals
- `GET /api/metrics/yearly?metric=project_count` — yearly project counts
- `GET /api/metrics/yearly?metric=output_by_category` — yearly output counts by category

**Extend:** Add new summary fields to the ETL's `compute_summary_stats()` method
and the `MetricSummary` TypeScript interface.

---

### `recent` — Recent Open Projects

**Question answered:** Among recently approved projects, which ones already have
open research outputs (a DOI or a "provided to others" research data flag)?

**What you see:**
- Filter controls: approval year, research discipline
- Card grid of projects matching the filter, showing title, PI, institution, and linked output count
- Each card links to the full project detail page

**Data used:**
- `GET /api/projects?hasOutputs=true&year=...&fieldsEn=...` — filtered project list

**Extend:** Add new filter dimensions by extending the `where` clause in
`apps/web/src/app/api/projects/route.ts` and adding a `<SelectField>` in the
mode component.

---

### `oa-rates` — OA Rates Over Time

**Question answered:** What percentage of FWF-funded publications are openly
accessible, and how has that changed year by year?

**What you see:**
- Area chart of OA publication rate (%) over time
- Secondary line: DOI presence rate
- Selectable year-range filter (start/end year)
- Export button: downloads the visible data as CSV

**Data used:**
- `GET /api/metrics/yearly?metric=oa_rate&startYear=...&endYear=...`

**How the metric is calculated:**
`oa_rate = (publications with DOI) / (total publications) × 100`

Computed in `MetricComputer.compute_yearly_oa_rates()`.

**Extend:** Add additional OA-status sources (e.g. Unpaywall) in the ETL and
store them as separate `metric_key` values (e.g. `unpaywall_oa_rate_by_year`).

---

### `rankings` — Institutional Rankings

**Question answered:** Which research institutions are the most prolific, the
most open, or produce the most outputs per project?

**What you see:**
- Horizontal bar chart of top N institutions
- Configurable: sort by project count, output count, or OA rate; show top 10/25/50
- Country filter select (based on ROR country codes)
- Sortable data table below the chart

**Data used:**
- `GET /api/metrics/institutions?sortBy=...&limit=...&country=...`

**How rankings are built:**
Institution metrics are pre-computed by the ETL (`compute_institutional_rankings()`)
and stored in `metric_snapshots` with `metric_key = "institution_project_count"`.
The OA rate per institution is stored in the `metadata` JSON column.

**Extend:** Add new ranking dimensions (e.g. open data rate per institution) by
computing them in the ETL and including them in the `metadata` blob.

---

### `publication-trends` — Yearly Publication Trends

**Question answered:** How do the different types of research outputs
(publications, research data, software, tools, etc.) change over time?

**What you see:**
- Multi-series line chart, one line per output category
- Year-range selector
- Toggle to show/hide individual categories

**Data used:**
- `GET /api/metrics/yearly?metric=output_by_category&startYear=...&endYear=...`

**Categories in the data:**
`publication`, `research_data`, `software`, `other`, and any other categories
present in the FWF API. Categories are extracted at ETL time from the raw output
documents.

**Extend:** The categories are dynamic — new ones in the FWF API will appear
automatically after the next ETL run.

---

### `topics` — Topic Search

**Question answered:** Which FWF projects are related to a specific research
topic, keyword, or researcher name?

**What you see:**
- Free-text search box (searches title, summary, PI name)
- Discipline filter
- Results as project cards with output counts
- Pagination

**Data used:**
- `GET /api/projects?search=...&page=...`

**Search scope:** The `search` parameter performs a case-insensitive
`ILIKE` match against `title_en`, `title_de`, `summary_en`, `pi_first_name`,
and `pi_last_name`.

**Extend:** For full-text search ranking, replace the `contains` Prisma filter
with a PostgreSQL `tsvector` index and `ts_rank` ordering. The API interface
does not need to change.

---

### `export` — CSV Export Builder

**Question answered:** How do I download the underlying data for my own analysis?

**What you see:**
- Data type selector: Projects, Outputs, Metrics, Institutions
- Filter controls appropriate to the selected type
- Live preview of the first 10 rows
- Download buttons for CSV and JSON

**Data used:**
- `GET /api/export?type=...&format=...&...filters...`

**Export types and their filters:**

| Type | Filters |
|---|---|
| `projects` | `year`, `institution` (ROR URL), `status` |
| `outputs` | `category`, `hasDoi`, `year` |
| `metrics` | `metricKey` |
| `institutions` | (none — all institutions exported) |

**Extend:** Add new export types by adding a case to the switch in
`apps/web/src/app/api/export/route.ts` and adding an `ExportType` value to
`src/lib/types.ts`.

---

### `researchers` — Researcher Explorer

**Question answered:** What open research has a given FWF principal investigator
published, and where have they worked?

**What you see:**
- Search by PI first/last name or ORCID
- Result list: all projects by the matched PI, with institution, year, and output count
- ORCID profile link (opens orcid.org in a new tab)
- Career history: list of institutions where the PI has led projects

**Data used:**
- `GET /api/projects?search=<name>` — name search
- Project detail pages — for output lists

**Note:** Researcher data is purely what is present in the FWF project records.
An "ORCID lookup" is a link to the public ORCID profile; no ORCID API call is
made from the app.

**Extend:** Integrate the ORCID public API to enrich researcher profiles with
works not in the FWF dataset.

---

### `funding-impact` — Funding vs. Outputs

**Question answered:** Is there a correlation between how much a project was
funded and how many research outputs it produced?

**What you see:**
- Scatter plot: x = approved grant amount (EUR), y = output count
- Points colored by research field (top 6 fields; others grey)
- Trend line (linear regression)
- Pearson correlation coefficient
- Average funding per output (EUR/output)
- Data from 2012 onwards (earlier records have sparse output coverage)

**Data used:**
- `GET /api/projects?limit=100&...` — fetched in batches, filtered client-side

**How the chart is built:** Data is loaded incrementally (up to 500 projects);
the Pearson r and regression line are computed client-side in pure JavaScript.

**Extend:** Add discipline-level regression lines, or replace the client-side
regression with a pre-computed metric from the ETL.

---

### `system` — System Health

**Question answered:** When was the data last updated, were there any errors,
and how complete is the dataset?

**What you see:**
- Last sync status (from `sync_log` table): time, duration, projects/outputs loaded
- Error messages from the last failed sync (if any)
- Data completeness cards:
  - ORCID coverage (% of PIs with ORCID)
  - ROR coverage (% of projects with institution ROR)
  - Output coverage (% of projects with at least one output)
  - Further-funding coverage (% of projects with co-funding)

**Data used:**
- `GET /api/metrics/summary` — totals for denominator
- `GET /api/projects?limit=1` — total project count check
- Direct `MetricSnapshot` queries for completeness percentages

**Extend:** Add new completeness checks by computing them in the ETL and storing
them as `metric_key = "completeness_..."` snapshots.

---

## Adding a New Mode

See [docs/extending.md](extending.md#adding-a-new-exploration-mode) for a
step-by-step guide.
