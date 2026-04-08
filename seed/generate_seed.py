#!/usr/bin/env python3
"""
Generate seed data by running the FWF ETL pipeline against the local database.

Usage (from repo root):
    python seed/generate_seed.py               # full ETL (fetch + load + metrics)
    python seed/generate_seed.py --metrics-only # recompute metrics only

Requirements:
    - PostgreSQL running and schema applied:
        docker compose up db -d
        cd apps/web && npx prisma db push
    - .env in repo root with DATABASE_URL and FWF_API_KEY set.
    - Python deps installed:
        cd etl && pip install -r requirements.txt
"""

import sys
import os

# Allow running from repo root OR from inside etl/
_HERE = os.path.dirname(os.path.abspath(__file__))
_REPO_ROOT = os.path.dirname(_HERE)
_ETL_DIR = os.path.join(_REPO_ROOT, "etl")

if _ETL_DIR not in sys.path:
    sys.path.insert(0, _ETL_DIR)

from src.pipeline import run_full_pipeline, run_metrics_only, _parse_args  # noqa: E402


def main() -> None:
    args = _parse_args()
    if args.metrics_only:
        run_metrics_only()
    else:
        run_full_pipeline()


if __name__ == "__main__":
    main()
