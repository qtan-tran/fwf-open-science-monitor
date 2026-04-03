"""
Runtime configuration for the ETL.

Loads environment variables from .env (repo root) using python-dotenv and
exports them as typed module-level constants.  Import this module early in
any entry-point so that all subsequent imports see the populated environment.

Required variables
------------------
FWF_API_KEY   Bearer token from https://openapi.fwf.ac.at/fwfkey
DATABASE_URL  PostgreSQL connection string

Optional variables
------------------
FWF_API_URL   Defaults to https://openapi.fwf.ac.at
"""

from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

# Load .env from the repo root (two levels above etl/src/).
_repo_root = Path(__file__).resolve().parent.parent.parent
load_dotenv(_repo_root / ".env")

# ------------------------------------------------------------------
# Required
# ------------------------------------------------------------------
FWF_API_KEY: str = os.getenv("FWF_API_KEY", "")
DATABASE_URL: str = os.getenv("DATABASE_URL", "")

# ------------------------------------------------------------------
# Optional (with sensible defaults)
# ------------------------------------------------------------------
FWF_API_URL: str = os.getenv("FWF_API_URL", "https://openapi.fwf.ac.at")

# ------------------------------------------------------------------
# Validation
# ------------------------------------------------------------------
_REQUIRED = {
    "FWF_API_KEY": FWF_API_KEY,
    "DATABASE_URL": DATABASE_URL,
}

_missing = [name for name, value in _REQUIRED.items() if not value]
if _missing:
    raise EnvironmentError(
        "The following required environment variables are not set: "
        + ", ".join(_missing)
        + f"\nCopy .env.example → .env and fill in the values."
    )
