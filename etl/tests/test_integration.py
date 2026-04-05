"""
Integration tests for the ETL pipeline.

These tests hit a real (test) database and therefore only run when the
environment variable RUN_INTEGRATION_TESTS=1 is set.  In CI this is
done in a separate job that spins up a Postgres container.

Usage:
    RUN_INTEGRATION_TESTS=1 python -m pytest tests/test_integration.py -v
"""

from __future__ import annotations

import os
import pytest

# Skip the entire module unless opted in
pytestmark = pytest.mark.skipif(
    os.getenv("RUN_INTEGRATION_TESTS") != "1",
    reason="Integration tests disabled — set RUN_INTEGRATION_TESTS=1 to enable",
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(scope="module")
def db_url():
    """Database URL for integration tests.

    Override with TEST_DATABASE_URL if you want to point at a different
    instance than the one configured in the environment.
    """
    url = os.getenv("TEST_DATABASE_URL") or os.getenv("DATABASE_URL")
    if not url:
        pytest.skip("No DATABASE_URL configured for integration tests")
    return url


@pytest.fixture(scope="module")
def metric_computer(db_url):
    from src.metrics import MetricComputer
    with MetricComputer(db_url) as mc:
        yield mc


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestMetricComputerIntegration:
    """Verify MetricComputer can connect and compute against a real database."""

    def test_compute_all_runs_without_error(self, metric_computer):
        """compute_all() must not raise against a live database."""
        metric_computer.compute_all()

    def test_summary_snapshot_written(self, metric_computer, db_url):
        """After compute_all(), a 'summary' MetricSnapshot row should exist."""
        import psycopg2

        metric_computer.compute_all()

        with psycopg2.connect(db_url) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT value FROM metric_snapshots WHERE metric_key = 'summary' LIMIT 1"
                )
                row = cur.fetchone()

        assert row is not None, "Expected a 'summary' MetricSnapshot to exist after compute_all()"
        assert row[0] >= 0


class TestDatabaseLoaderIntegration:
    """Verify DatabaseLoader can upsert records without constraint errors."""

    def test_upsert_empty_projects_list(self, db_url):
        from src.loader import DatabaseLoader

        loader = DatabaseLoader(db_url)
        try:
            count = loader.upsert_projects([])
            assert count == 0
        finally:
            loader.close()

    def test_upsert_empty_outputs_list(self, db_url):
        from src.loader import DatabaseLoader

        loader = DatabaseLoader(db_url)
        try:
            count = loader.upsert_outputs([])
            assert count == 0
        finally:
            loader.close()
