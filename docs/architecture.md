# Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│  FWF Open Research API  (Meilisearch, 3 indices)                    │
│  https://openapi.fwf.ac.at                                          │
└─────────────────┬───────────────────────────────────────────────────┘
                  │ HTTPS  (daily or on-demand)
                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│  ETL Pipeline  (Python 3.12)                                        │
│                                                                     │
│  FWFClient → Cleaner → DatabaseLoader → MetricComputer              │
│  (fetcher.py) (cleaner.py) (loader.py)   (metrics.py)               │
└─────────────────┬───────────────────────────────────────────────────┘
                  │ psycopg2 (PostgreSQL wire protocol)
                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│  PostgreSQL 16                                                       │
│                                                                     │
│  projects  outputs  further_funding  institutions                   │
│  metric_snapshots  sync_log                                         │
└─────────────────┬───────────────────────────────────────────────────┘
                  │ Prisma Client (connection pool)
                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Next.js 16  (App Router, Node.js runtime)                          │
│                                                                     │
│  API routes (/api/*)   →   In-memory LRU cache   →   JSON          │
│  Server components     →   Prisma queries         →   HTML          │
└─────────────────┬───────────────────────────────────────────────────┘
                  │ HTTP
                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Browser  (React 19, Recharts, Tailwind CSS 4)                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow

1. **Fetch** — `FWFClient` paginates through the three FWF API indices
   (`projects`, `output`, `further-funding`) using Meilisearch's offset/limit
   API. It applies exponential-backoff retries on network errors and respects a
   configurable rate-limiting sleep between batches.

2. **Clean** — Each raw JSON document is passed through a cleaner function
   (`clean_project`, `clean_output`, `clean_further_funding`). The cleaner:
   - Normalises ROR identifiers to full URLs
   - Validates ORCID checksums
   - Parses dates in multiple formats into UTC-aware `datetime` objects
   - Coerces numeric fields; defaults missing arrays to `[]`
   - Preserves the full raw document in a `rawJson` column for forensic use

3. **Load** — `DatabaseLoader` issues batched `INSERT … ON CONFLICT DO UPDATE`
   (upsert) statements. Projects are keyed on `grant_doi`; outputs use their DOI
   when available or a deterministic SHA-256 hash otherwise. Further-funding
   records have no stable external key so a hash of funder+id+years is used.

4. **Compute** — `MetricComputer` issues SQL aggregation queries against the
   loaded tables and writes results to `metric_snapshots`. Each snapshot has a
   `metric_key`, optional `year` and `ror_id`, a float `value`, and a JSON
   `metadata` blob for auxiliary figures (e.g. OA count alongside OA rate).

5. **Serve** — Next.js API routes query `metric_snapshots` (and other tables)
   via Prisma, cache results in an in-process LRU cache for 5 minutes, and
   return JSON. Server components directly call the same Prisma client for
   pages that do not need client-side interactivity.

---

## Technology Choices

| Choice | Rationale |
|---|---|
| **Next.js App Router** | Collocates server and client components; built-in API routes avoid a separate backend service; excellent Vercel integration |
| **Prisma** | Type-safe query builder with automatic migration; avoids raw SQL for app queries while still allowing it where needed |
| **PostgreSQL** | JSONB support for `metadata` blobs; `BIGINT` for funding amounts; mature aggregation functions used by MetricComputer |
| **Tailwind CSS 4** | Zero runtime CSS; dark mode via `dark:` variants; no class-name collision |
| **Recharts** | Composable React charting; good TypeScript support; works with SSR (no document access at import time) |
| **Python ETL (not Node)** | psycopg2 gives direct COPY-level bulk insert performance; pandas available if needed; separate language boundary enforces the ETL/app boundary |
| **In-memory LRU cache** | Eliminates repeated database round-trips for the same query within a 5-minute window; no Redis dependency for small deployments |
| **Docker Compose** | Single command to reproduce the full stack locally; `profiles: ["etl"]` keeps the ETL out of the default `up` target |

---

## Database Schema Overview

```
projects
  id             TEXT PK          -- FWF internal ID
  grant_doi      TEXT UNIQUE      -- stable: "10.55776/P12345"
  title_en       TEXT
  ...22 more columns...
  raw_json       JSONB            -- full FWF API document

outputs
  id             TEXT PK          -- DOI or SHA-256 hash
  doi            TEXT
  category       TEXT             -- publication | research_data | software | …
  years          INT[]
  has_doi        BOOL
  ...13 more columns...

further_funding
  id             TEXT PK          -- "ff-<sha256[:24]>"
  funder         TEXT
  country        TEXT
  sector         TEXT
  ...9 more columns...

institutions
  ror_id         TEXT PK          -- "https://ror.org/…"
  name           TEXT
  country        TEXT
  project_count  INT
  output_count   INT

metric_snapshots
  metric_key     TEXT             -- e.g. "oa_publication_rate_by_year"
  year           INT  NULLABLE    -- NULL for all-time metrics
  ror_id         TEXT NULLABLE    -- NULL for cross-institution metrics
  value          FLOAT
  metadata       JSONB NULLABLE   -- auxiliary figures
  computed_at    TIMESTAMP
  PRIMARY KEY (metric_key, year, ror_id)  -- enforced via UPSERT

sync_log
  id             SERIAL PK
  status         TEXT             -- running | completed | failed
  projects_count INT
  outputs_count  INT
  errors         TEXT NULLABLE
  started_at     TIMESTAMP
  finished_at    TIMESTAMP

-- Join tables
_project_outputs      (project_id, output_id)
_project_further_funding (project_id, further_funding_id)
```

---

## ETL Pipeline Stages

```
run_full_pipeline()
│
├─ Step 1: Init
│    FWFClient(url, api_key)
│    DatabaseLoader(db_url)
│    SyncLog.status = "running"
│
├─ Step 2: Projects          ← catches errors independently
│    client.fetch_all_projects()   →  list[dict]  (all pages)
│    [clean_project(p) for p in raw]
│    loader.upsert_projects(cleaned)
│
├─ Step 3: Outputs           ← catches errors independently
│    client.fetch_all_outputs()
│    [clean_output(o) for o in raw]
│    loader.upsert_outputs(cleaned)
│    loader.link_projects_outputs(output_id → [project_ids])
│
├─ Step 4: Further Funding   ← catches errors independently
│    client.fetch_all_further_funding()
│    [clean_further_funding(f) for f in raw]
│    assign stable hash IDs
│    loader.upsert_further_funding(cleaned)
│    loader.link_projects_funding(ff_id → [project_ids])
│
├─ Step 5: Institutions      ← catches errors independently
│    extract_institutions(clean_projects)  →  unique ROR IDs
│    loader.upsert_institutions(institutions)
│    loader.update_institution_counts()    ← SQL COUNT aggregation
│
├─ Step 6: Metrics           ← catches errors independently
│    MetricComputer(db_url).__enter__()
│    mc.compute_all()        ← runs ~10 SQL queries
│    MetricComputer.__exit__()
│
└─ Step 7: Log completion
     SyncLog.status = "completed" | "failed"
     loader.close()
```

---

## Caching Strategy

The web app uses a **module-level in-memory LRU cache** (`src/lib/cache.ts`):

- **Capacity:** 100 entries max (LRU eviction)
- **TTL:** 5 minutes for all API route responses
- **Scope:** single Node.js process — each Vercel serverless function instance
  has its own cache; there is no shared cache across instances
- **Cache keys:** deterministic strings encoding all query parameters,
  e.g. `metrics:yearly:oa_rate:2010:2023` or `projects:2:20:::climate:`
- **Invalidation:** TTL only (no explicit invalidation); after an ETL run, all
  entries expire within 5 minutes

For high-traffic deployments, replace `cache.ts` with a Redis client —
the interface (`get<T>(key)` / `set(key, value, ttlMs)`) is intentionally
minimal to make this a one-file swap.

---

## API Design Principles

1. **Query params over path segments for filters** — `/api/projects?year=2022` rather than `/api/projects/year/2022` — keeps the URL schema flat and easy to extend.

2. **Consistent pagination shape** — all list endpoints return `{ data, total, page, limit, totalPages }` so the frontend `DataTable` component works uniformly.

3. **Metric snapshots as the query layer** — the frontend never aggregates raw rows; all time-series and totals come from pre-computed `MetricSnapshot` rows. This keeps API response times under ~50 ms regardless of database size.

4. **400 before 500** — invalid parameters return a JSON error with the valid options listed; this makes debugging from the browser network tab trivial.

5. **No authentication** — the data is all public (FWF CC0); no auth layer is needed. If you fork this for private data, add NextAuth.js and gate the API routes with `getServerSession`.
