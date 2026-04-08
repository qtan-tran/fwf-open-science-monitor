# Fixes Applied

## Database / Prisma

- **`apps/web/prisma/schema.prisma`**: Removed `directUrl = env("DIRECT_URL")` from
  the datasource block. `directUrl` is only required when using a connection pooler
  (Neon, Supabase PgBouncer, etc.). Without it the `DIRECT_URL` env var must be set, but
  it was never defined in `.env`, causing Prisma to throw at startup and producing the
  generic "Something went wrong" UI error.

- **`apps/web/prisma/schema.prisma`**: Changed `grantDoi String @unique` to
  `grantDoi String? @unique`. Multiple FWF projects lack a grant DOI; the non-nullable
  unique constraint caused a `duplicate key value violates unique constraint` error when
  trying to insert more than one project with a missing grant DOI (all mapped to `""`).
  PostgreSQL allows multiple `NULL` values in a unique index, so nullable is the correct type.

- **Direct DB migration applied**: `ALTER TABLE "Project" ALTER COLUMN "grantDoi" DROP NOT NULL`
  (applied to the already-running container without a full rebuild).

## ETL Pipeline — cleaner.py

- **`safe_get` function**: The FWF API returns flat dicts with dotted keys
  (`{"_str.category": "publications"}`), not nested objects. The original `safe_get`
  split the path on `.` and tried to navigate nested dicts, so every `safe_get` call
  returned `None`. Added a fast-path that tries the full dotted string as a flat dict
  key first, with the nested-navigation fallback preserved for future-proofing.
  This fix unblocked all field extraction — without it, all outputs had empty
  title/category/years and hashed to the same stable ID, leaving only 1 output in the DB.

- **`_extract_fwf_id_from_project_id`**: Changed prefix from `"projects-"` to `"project-"`.
  Actual project document IDs from the API use `project-<ID>` (e.g. `project-DOC32`),
  not the documented `projects-` prefix.

- **`_strip_projects_prefix`**: Changed prefix from `"projects-"` to `"project."`.
  Output documents reference their linked projects as `project.<ID>` (with a period),
  while project document IDs use a hyphen. After stripping both prefixes the bare IDs
  match, enabling correct many-to-many linking.

- **`grantDoi` fallback**: Removed `or ""` on `grantDoi` in `clean_project()` so missing
  grant DOIs are stored as `None` instead of `""`, matching the now-nullable schema column.

## ETL Pipeline — loader.py

- **`upsert_projects` / `upsert_outputs` / `upsert_further_funding` / `upsert_institutions` /
  `link_projects_outputs` / `link_projects_funding`**: Wrapped each database write block in
  `try/except: self._conn.rollback(); raise`. Without this, a failure in any step left the
  psycopg2 connection in an aborted-transaction state, making every subsequent step fail
  with "current transaction is aborted, commands ignored until end of transaction block".

- **`upsert_outputs`**: Added deduplication by `id` before splitting into DOI/hash batches.
  Multiple outputs with identical title+category+year produce the same stable hash ID;
  a single `VALUES` clause with duplicate conflict-key rows causes `CardinalityViolation`.

- **`upsert_further_funding`**: Same deduplication fix — `_ff_stable_id` can collide when
  two further-funding records share the same funder+fundingId+year combination.

- **`update_institution_counts` SQL**: Fixed `SET "projectCount" = COALESCE(pc.cnt, 0)`
  to `SET "projectCount" = counts.proj_cnt`. The CTE aliases `pc` and `oc` are not
  visible in the `UPDATE SET` clause — only the derived table alias `counts` is.

- **`link_projects_outputs` / `link_projects_funding`**: Added pre-filtering of link pairs
  against project IDs that actually exist in the database. The FWF API limits search
  results to 10 000 records; outputs and further-funding reference projects beyond that
  limit (e.g. `F81`). Without filtering, FK violations abort the entire link step.

- **`loader.py` — `grantDoi` row tuple**: Changed `p.get("grantDoi") or ""` to
  `p.get("grantDoi")` to match the now-nullable schema column.

## ETL Pipeline — Dockerfile

- **`etl/Dockerfile`**: Removed `COPY .env .env`. The `etl/.env` file is a 1-line blank
  file, so copying it into the container silently shadowed the real env vars injected by
  `docker-compose env_file`. Docker Compose already injects all vars via `env_file: - .env`
  and `environment:` overrides.

## Configuration

- **`.env`**: Fixed stray 4-space indentation on the comment above `FWF_API_KEY` (cosmetic).

## Seed Infrastructure (new files)

- **`seed/generate_seed.py`** *(new)*: Python entry-point that patches `sys.path` and
  delegates to `etl/src/pipeline`. Supports `--metrics-only`. Run from repo root.

- **`seed/load_seed.sh`** *(new)*: Shell script that loads `seed/seed.sql` if present
  (fast path) or runs `docker compose run --rm etl` (live fetch). Prints row counts
  after loading to confirm success.

---

## Verified end-to-end results (after all fixes)

```
Table         | count
--------------+-------
Projects      | 10000
Outputs       |  9928
Institutions  |   255
Metrics       |   308
SyncLogs      |     2
```

API endpoints returning real data:
- `/api/metrics/summary` → `{"totalProjects":10000,"totalOutputs":9928,"totalInstitutions":255,"overallOaRate":78.15,"yearRange":[2011,2026]}`
- `/api/metrics/yearly?metric=oa_rate` → 15 year rows
- `/api/metrics/institutions?limit=3` → Universität Wien (2118), TU Wien (902), Uni Innsbruck (821)
- `/api/projects?limit=3` → total=10000
- `/api/outputs?limit=3` → total=9928

Next.js build: clean (no errors, all 19 routes compiled).

---

## Vercel Deployment Fixes

- **`apps/web/package.json` — `build` script**: changed `"next build"` →
  `"prisma generate && next build"`. Vercel runs this script; without
  `prisma generate` the Prisma Client is missing and the build fails.

- **`apps/web/package.json` — added `postinstall`**: `"prisma generate"`.
  Fires after `npm ci` so the Prisma Client exists even before the build
  command runs (belt-and-suspenders for Vercel's install step).

- **`apps/web/src/lib/prisma.ts`**: Fixed type annotation to
  `{ prisma: PrismaClient | undefined }` and switched `||` → `??`.
  Added comment clarifying that the `globalThis` cache is intentionally
  not used in production (serverless cold starts get a fresh module scope).

- **`apps/web/src/lib/cache.ts`**: Added comment explaining that the
  in-memory LRU cache does not persist across Vercel serverless invocations.
  No code changes — fall-through to the DB on cold starts is acceptable
  for MVP.

- **`apps/web/prisma/schema.prisma`**: Added
  `directUrl = env("DIRECT_URL")` to the datasource block. Neon and
  Supabase route `DATABASE_URL` through a connection pooler (pgBouncer).
  Prisma Migrate / `db push` requires a direct non-pooled connection and
  reads `directUrl` for that. Without this, migrations fail against
  hosted databases.

- **`apps/web/vercel.json`**: Updated `buildCommand` to `"npm run build"`
  (delegates to package.json, which now includes `prisma generate`).

- **`apps/web/.env.example`** *(new)*: Documents the three env vars the
  web app needs on Vercel: `DATABASE_URL`, `DIRECT_URL`,
  `NEXT_PUBLIC_API_BASE`.

- **`DEPLOY_VERCEL.md`** *(new)*: Step-by-step guide for Neon/Supabase
  provisioning, Vercel project import (Root Directory: `apps/web`),
  required environment variables, post-deploy verification, and a
  troubleshooting table.

---

## Verified local install instructions

```bash
# 1. Start the database
docker compose up db -d

# 2. Push the Prisma schema (creates all tables)
docker compose exec web node node_modules/prisma/build/index.js db push --skip-generate
# OR locally: cd apps/web && npx prisma db push

# 3. Load data — runs ETL pipeline (~2–3 min)
docker compose run --rm etl
# OR: chmod +x seed/load_seed.sh && ./seed/load_seed.sh

# 4. Start the web app (production)
docker compose up web -d
# OR for development: cd apps/web && npm run dev

# 5. Verify
curl http://localhost:3000/api/metrics/summary

# Optional: export seed.sql for instant future reloads
docker compose exec db pg_dump -U postgres fwf_monitor > seed/seed.sql
```
