"""
Shared pytest configuration.

Sets up sys.path so that `from src.xyz import ...` works when running
pytest from the etl/ directory.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

# Ensure the etl/ directory is on the path so `from src.xxx import ...` works.
ETL_ROOT = Path(__file__).parent.parent
if str(ETL_ROOT) not in sys.path:
    sys.path.insert(0, str(ETL_ROOT))

# Provide dummy environment variables required by src/config.py so that
# importing the module doesn't fail when running tests without a real .env.
os.environ.setdefault("FWF_API_URL", "https://fake-api.example.com")
os.environ.setdefault("FWF_API_KEY", "test-key-000")
os.environ.setdefault("DATABASE_URL", "postgresql://test:test@localhost:5432/test_db")
