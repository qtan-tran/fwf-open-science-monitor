#!/usr/bin/env bash
# load_seed.sh — Populate the FWF Open Science Monitor database with real data.
#
# Strategy:
#   1. If seed/seed.sql exists, load it directly into PostgreSQL (fast path).
#   2. Otherwise run the ETL pipeline via Docker Compose to fetch live data
#      from the FWF Open API (requires FWF_API_KEY in .env).
#
# Usage (from repo root):
#   ./seed/load_seed.sh
#
# Prerequisites:
#   docker compose up db -d          # PostgreSQL must be running
#   cd apps/web && npx prisma db push # Tables must already exist

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SEED_SQL="$REPO_ROOT/seed/seed.sql"

echo ""
echo "=== FWF Open Science Monitor — Seed Loader ==="
echo ""

# ── Verify the database container is up ────────────────────────────────────
DB_CONTAINER=$(docker compose -f "$REPO_ROOT/docker-compose.yml" ps -q db 2>/dev/null || true)
if [[ -z "$DB_CONTAINER" ]]; then
  echo "ERROR: Database container is not running."
  echo "  Start it with:  docker compose up db -d"
  exit 1
fi

# ── Path 1: pre-built seed.sql ─────────────────────────────────────────────
if [[ -f "$SEED_SQL" ]]; then
  echo "Found seed/seed.sql — loading into PostgreSQL..."
  docker compose -f "$REPO_ROOT/docker-compose.yml" exec -T db \
    psql -U postgres -d fwf_monitor < "$SEED_SQL"
  echo ""
  echo "Verifying row counts..."
  docker compose -f "$REPO_ROOT/docker-compose.yml" exec -T db \
    psql -U postgres -d fwf_monitor -c \
    'SELECT '"'"'Project'"'"' AS "Table", COUNT(*) FROM "Project"
     UNION ALL SELECT '"'"'Output'"'"',     COUNT(*) FROM "Output"
     UNION ALL SELECT '"'"'MetricSnapshot'"'"', COUNT(*) FROM "MetricSnapshot";'
  echo ""
  echo "Seed data loaded successfully from seed.sql."
  exit 0
fi

# ── Path 2: run ETL pipeline ───────────────────────────────────────────────
echo "No seed/seed.sql found — running ETL pipeline to fetch live data."
echo "(This fetches from the FWF Open API and may take a few minutes.)"
echo ""

docker compose -f "$REPO_ROOT/docker-compose.yml" run --rm etl

echo ""
echo "Verifying row counts..."
docker compose -f "$REPO_ROOT/docker-compose.yml" exec -T db \
  psql -U postgres -d fwf_monitor -c \
  'SELECT '"'"'Project'"'"' AS "Table", COUNT(*) FROM "Project"
   UNION ALL SELECT '"'"'Output'"'"',     COUNT(*) FROM "Output"
   UNION ALL SELECT '"'"'MetricSnapshot'"'"', COUNT(*) FROM "MetricSnapshot";'

echo ""
echo "ETL complete. Data is now in the database."
echo ""
echo "Optional: export seed.sql for faster future loads:"
echo "  docker compose exec db pg_dump -U postgres fwf_monitor > seed/seed.sql"
