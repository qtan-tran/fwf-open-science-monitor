# FWF Open Science Monitor

A full-stack dashboard that tracks open-science compliance across thousands of
[FWF](https://www.fwf.ac.at/en/)-funded research projects — visualising open
access rates, output trends, institutional rankings, and funding efficiency in
one place.

```
┌──────────────────────────────────────────────────────────────────────┐
│  Dashboard  │  Projects  │  Institutions  │  Explore  │  Export      │
├──────────────────────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐            │
│  │ 1,500    │  │ 12,000   │  │ 80       │  │ 67.5%    │            │
│  │ Projects │  │ Outputs  │  │ Instits  │  │ OA Rate  │            │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘            │
│                                                                      │
│  OA Rate Over Time          Projects by Year                        │
│  ┌──────────────────────┐   ┌──────────────────────┐               │
│  │  ▁▂▃▄▅▆▇█           │   │  ▂▃▄▅▄▆▇█▇▆          │               │
│  └──────────────────────┘   └──────────────────────┘               │
└──────────────────────────────────────────────────────────────────────┘
```

## Features

- **Dashboard** — headline metrics (projects, outputs, institutions, OA rate) with six interactive charts
- **Projects browser** — paginated, searchable, and filterable project list with detail pages
- **Institutions** — sortable rankings by project count, output count, or OA rate
- **10 Explore modes** — guided analysis views: OA trends, publication breakdowns, researcher search, funding vs. outputs scatter, system health, and more
- **CSV / JSON export** — filtered bulk downloads of all four data types
- **ETL pipeline** — daily sync from the FWF Open Research API into PostgreSQL, with computed metrics
- **In-memory LRU cache** — 5-minute TTL on all API routes, zero infrastructure required
- **Dark mode** — system-preference aware via Tailwind CSS
- **Type-safe** — TypeScript throughout; Prisma for the data layer

---

## Quick Start

> **Requirements:** Docker Desktop (or Docker Engine + Compose v2).  
> A FWF API key is only needed to run the ETL pipeline, not to browse the app.

```bash
# 1. Clone
git clone https://github.com/qtan-tran/fwf-open-science-monitor.git
cd fwf-open-science-monitor

# 2. Configure environment
cp .env.example .env
# Open .env and add your FWF_API_KEY (optional for browsing; required for ETL)

# 3. Start the database and web app
docker compose up

# 4. Apply the database schema (first run only)
docker compose exec web npx prisma migrate deploy

# 5. Open the dashboard
open http://localhost:3000
```

The database starts empty — you will see zeroes until you run the ETL (see [Running the ETL](#running-the-etl)).

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend framework | Next.js 16 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 4 |
| Charts | Recharts 2 |
| Icons | Lucide React |
| Database ORM | Prisma 5 |
| Database | PostgreSQL 16 |
| ETL language | Python 3.12 |
| ETL data source | FWF Open Research API (Meilisearch) |
| Container runtime | Docker / Docker Compose v2 |
| Frontend tests | Vitest 4 + Testing Library |
| ETL tests | pytest 9 |
| CI | GitHub Actions |
| Frontend hosting | Vercel (recommended) |

---

## Project Structure

```
fwf-open-science-monitor/
├── apps/web/                  # Next.js 16 frontend
│   ├── prisma/                #   Schema and migrations
│   ├── src/
│   │   ├── app/               #   App Router: pages + API routes
│   │   │   ├── api/           #     8 REST endpoints
│   │   │   ├── dashboard/     #     Dashboard page
│   │   │   ├── projects/      #     Project list + detail pages
│   │   │   ├── institutions/  #     Institution list + detail
│   │   │   ├── explore/       #     Hub + 10 mode pages
│   │   │   ├── export/        #     Export builder
│   │   │   └── about/         #     About page
│   │   ├── components/        #   Reusable React components
│   │   │   ├── ui/            #     StatCard, DataTable, FilterBar, …
│   │   │   └── charts/        #     Recharts wrappers
│   │   └── lib/               #   Prisma client, LRU cache, API client, types
│   ├── Dockerfile
│   └── vercel.json
├── etl/                       # Python ETL pipeline
│   ├── src/
│   │   ├── pipeline.py        #   Orchestrator (6 steps)
│   │   ├── fetcher.py         #   FWF API client with retries
│   │   ├── cleaner.py         #   Data normalisation + validation
│   │   ├── loader.py          #   Postgres upsert logic
│   │   └── metrics.py         #   Metric computation
│   ├── tests/                 #   pytest suite (245 tests)
│   └── Dockerfile
├── docs/                      # Architecture and guides
├── .github/workflows/         # CI + ETL schedule
├── docker-compose.yml
└── .env.example
```

---

## Development

### Prerequisites

- Docker Desktop (for the database) — or PostgreSQL 16 installed locally
- Node.js 20+
- Python 3.12+

### Setup

```bash
# 1. Copy environment variables
cp .env.example .env

# 2. Start the database only
docker compose up db

# 3. Install web dependencies and set up Prisma
cd apps/web
npm install
npx prisma migrate dev   # creates the schema
npx prisma generate      # generates the TypeScript client

# 4. Start the dev server
npm run dev              # → http://localhost:3000

# 5. (Optional) Set up the ETL for local development
cd ../../etl
pip install -r requirements.txt
```

### Running Tests

```bash
# Web (Vitest — runs in ~10 s, no database needed)
cd apps/web
npm test                   # run once
npm run test:watch         # watch mode
npm run test:coverage      # with coverage report

# ETL (pytest)
cd etl
python -m pytest           # all 245 tests
python -m pytest -v        # verbose
```

---

## Running the ETL

The ETL pipeline fetches data from the FWF Open Research API, cleans it, loads it into PostgreSQL, and computes all metrics. You need a **FWF API key** (free, self-service at <https://openapi.fwf.ac.at/fwfkey>).

### Via Docker (recommended)

```bash
# Full sync: fetch → load → compute metrics  (~5–15 min on first run)
docker compose run --rm etl

# Metrics only (no API call — useful after schema changes)
docker compose run --rm etl python -m src.pipeline --metrics-only
```

### Directly (local development)

```bash
cd etl
python -m src.pipeline
python -m src.pipeline --metrics-only
```

### ETL Pipeline Stages

| Step | What it does |
|---|---|
| 1. Init | Creates `FWFClient` and `DatabaseLoader`; writes `running` to `SyncLog` |
| 2. Projects | Fetches all projects from FWF API → cleans → upserts to `projects` table |
| 3. Outputs | Fetches all outputs → cleans → upserts → links to projects |
| 4. Further Funding | Fetches co-funding records → assigns stable hash IDs → upserts → links |
| 5. Institutions | Extracts unique ROR IDs from projects → upserts → refreshes counts |
| 6. Metrics | Runs `MetricComputer.compute_all()` — writes all `MetricSnapshot` rows |
| 7. Log | Writes `completed` (or `failed`) to `SyncLog` |

Step failures are isolated — a failure in step 3 does not stop steps 4–7.

### Scheduling

See `.github/workflows/etl-schedule.yml` — the pipeline runs daily at 03:00 UTC via GitHub Actions and reads `DATABASE_URL`, `FWF_API_KEY`, and `FWF_API_URL` from repository secrets.

---

## API Endpoints

All endpoints are under `/api/`. Responses are JSON. All read endpoints are cached in-process for 5 minutes.

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/metrics/summary` | Overall totals: projects, outputs, institutions, OA rate, year range |
| `GET` | `/api/metrics/yearly` | Yearly time-series for a given metric (see `?metric=` below) |
| `GET` | `/api/metrics/institutions` | Institution rankings with sorting and country filter |
| `GET` | `/api/projects` | Paginated, searchable project list |
| `GET` | `/api/projects/[id]` | Full project detail with outputs and further-funding |
| `GET` | `/api/outputs` | Paginated output list with category/year/DOI filters |
| `GET` | `/api/export` | Bulk export of projects/outputs/metrics/institutions as CSV or JSON |
| `GET` | `/api/explore` | Raw data for one of the 10 numbered explore modes |

**`/api/metrics/yearly` — `?metric=` values:**

| Value | Description |
|---|---|
| `project_count` | Number of approved projects per year |
| `oa_rate` | OA publication rate (%) per year |
| `output_by_category` | Output counts per category per year |
| `funding_efficiency` | Average approved grant amount per year |
| `open_data_rate` | Share of data outputs with provided-to-others flag (%) |
| `open_software_rate` | Share of software outputs with a DOI (%) |

Optional filters: `?startYear=2010&endYear=2023`

---

## Deployment

### Vercel (frontend)

1. Import the repo into Vercel. Set the **Root Directory** to `apps/web`.
2. Add `DATABASE_URL` as an environment variable (e.g. [Neon](https://neon.tech), [Supabase](https://supabase.com), [Railway](https://railway.app)).
3. Vercel reads `apps/web/vercel.json` — the build command (`npx prisma generate && next build`) is pre-configured.

### Docker (full stack)

```bash
docker compose up          # starts db + web
docker compose run etl     # runs ETL once
```

For production, replace the docker-compose `web.environment.DATABASE_URL` with your production connection string and use a secrets manager instead of `.env`.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for branch conventions, PR checklist, and code style guidelines.

---

## License

MIT — see [LICENSE](LICENSE).

## Data Attribution

- **FWF Open Research API** — data is made available by the Austrian Science Fund (FWF) under CC0. API documentation: <https://openapi.fwf.ac.at>
- **ROR** — Research Organization Registry identifiers under CC0: <https://ror.org>
- **ORCID** — researcher identifiers: <https://orcid.org>

## Acknowledgments

Built to support open-science monitoring and to demonstrate reproducible research infrastructure. Not an official FWF product.
