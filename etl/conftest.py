"""
pytest configuration for the etl package.

Adds the etl/ directory to sys.path so that `import src.fetcher` works
when pytest is invoked from inside etl/.

Also pre-populates required environment variables so that src/config.py's
validation guard does not raise during test collection.
"""

import os
import sys
from pathlib import Path

# Make `src` importable as a top-level package from within etl/.
sys.path.insert(0, str(Path(__file__).parent))

# Provide dummy env vars so config.py doesn't raise at import time.
# Tests that need specific values set them explicitly inside the test.
os.environ.setdefault("FWF_API_KEY", "test-key-placeholder")
os.environ.setdefault("FWF_API_URL", "https://openapi.fwf.ac.at")
os.environ.setdefault("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/fwf_monitor")
