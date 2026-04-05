# fwf-open-science-monitor

A dashboard for monitoring open-science compliance across FWF-funded research projects.

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and Docker Compose v2
- Node.js 20+ (local dev only)
- Python 3.12+ (local ETL dev only)

---

## Quick start (Docker Compose)

```bash
# 1. Copy and fill in environment variables
cp .env.example .env
# Edit .env — set FWF_API_KEY (required for ETL)

# 2. Start the database and web app
docker compose up

# 3. Open http://localhost:3000
```

The `db` and `web` services start together.  
The `etl` service is gated behind the `etl` profile so it does not run automatically.

---

## Local development (without Docker)

### Web app

```bash
# Start only the database
docker compose up db

# In another terminal
cd apps/web
npm install
npx prisma generate
npm run dev          # http://localhost:3000
```

### ETL pipeline

```bash
cd etl
pip install -r requirements.txt
python -m src.pipeline                  # full sync
python -m src.pipeline --metrics-only   # recompute metrics only
```

### Tests

```bash
# Web (Vitest)
cd apps/web
npm test                  # run once
npm run test:watch        # watch mode
npm run test:coverage     # with coverage report

# ETL (pytest)
cd etl
python -m pytest          # all tests
python -m pytest -v       # verbose
```

---

## Running the ETL with Docker

The ETL container is excluded from the default `docker compose up` via
`profiles: ["etl"]`.  Run it explicitly:

```bash
# Full pipeline (fetch from FWF API → load → compute metrics)
docker compose run --rm etl

# Metrics only (no API fetch, useful after schema changes)
docker compose run --rm etl python -m src.pipeline --metrics-only

# Or start it as part of a named profile
docker compose --profile etl up etl
```

**Required secrets in `.env`:**

| Variable | Description |
|---|---|
| `FWF_API_KEY` | FWF Open Research API key — get one at https://openapi.fwf.ac.at/fwfkey |
| `FWF_API_URL` | Defaults to `https://openapi.fwf.ac.at` |
| `DATABASE_URL` | Set automatically to the Docker internal URL when running via Compose |

---

## Deploying the web app to Vercel

1. Import the repository into [Vercel](https://vercel.com).
2. Set the **Root Directory** to `apps/web`.
3. Vercel picks up `apps/web/vercel.json` automatically — the build command
   (`npx prisma generate && next build`) is already configured there.
4. Add the required environment variables in the Vercel dashboard:

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | PostgreSQL connection string (e.g. Supabase, Neon, Railway) |

5. Deploy. Subsequent pushes to `main` trigger automatic deployments.

> The `output: "standalone"` mode in `next.config.ts` is used for the Docker
> image. Vercel ignores this setting and handles bundling itself.

---

## CI/CD

GitHub Actions workflows live in `.github/workflows/`:

| Workflow | Trigger | What it does |
|---|---|---|
| `ci.yml` | Push / PR to `main` | Lint, type-check, test (web + ETL), build |
| `etl-schedule.yml` | Daily 03:00 UTC + manual | Runs the ETL pipeline |

### Required GitHub secrets for ETL scheduling

Go to **Settings → Secrets and variables → Actions** and add:

| Secret | Description |
|---|---|
| `DATABASE_URL` | Production database connection string |
| `FWF_API_KEY` | FWF Open Research API key |
| `FWF_API_URL` | Optional — defaults to the public FWF endpoint |

The `etl-schedule.yml` workflow also supports a **manual trigger** from the
Actions tab with an option to run `--metrics-only`.

---

## ETL deployment options

### Option A — GitHub Actions (recommended)

Use `etl-schedule.yml` (already configured). No infrastructure to manage.

### Option B — Docker on a server or VPS

```bash
# Build the ETL image
docker build -t fwf-etl ./etl

# Run on a schedule with cron (add to crontab)
0 3 * * * docker run --rm \
  -e DATABASE_URL="..." \
  -e FWF_API_KEY="..." \
  fwf-etl
```

### Option C — Run locally on demand

```bash
cd etl
python -m src.pipeline
```

---

## Project structure

```
fwf-open-science-monitor/
├── apps/
│   └── web/               # Next.js 16 frontend
│       ├── prisma/        # Database schema & migrations
│       ├── src/
│       │   ├── app/       # App Router pages and API routes
│       │   ├── components/
│       │   └── lib/       # Prisma client, cache, API client
│       ├── Dockerfile
│       └── vercel.json
├── etl/                   # Python ETL pipeline
│   ├── src/
│   │   ├── pipeline.py    # Orchestrator
│   │   ├── fetcher.py     # FWF API client
│   │   ├── cleaner.py     # Data normalisation
│   │   ├── loader.py      # Database loader
│   │   └── metrics.py     # Metric computation
│   ├── tests/
│   ├── Dockerfile
│   └── requirements.txt
├── docker-compose.yml
└── .env.example
```
