"""
Unit tests for MetricComputer.

Strategy
--------
- psycopg2.connect is patched so no real database is needed.
- Each test configures cursor.fetchall / fetchone to return a small
  in-memory dataset, then asserts that _store_metric was called with
  the expected arguments.
- _store_metric itself is tested separately to verify it issues the
  correct DELETE + INSERT SQL.
- Rate arithmetic is verified with explicit assertions (e.g. 3/10 = 30.0).
"""

from __future__ import annotations

from unittest.mock import MagicMock, call, patch

import pytest

from src.metrics import MetricComputer


# ---------------------------------------------------------------------------
# Fixture: a pre-wired mock connection + cursor
# ---------------------------------------------------------------------------

@pytest.fixture
def mock_conn():
    """Return (conn_mock, cursor_mock) with the cursor context-manager wired up."""
    cur = MagicMock()
    conn = MagicMock()
    conn.closed = False
    # Make `with self._conn.cursor() as cur:` work
    conn.cursor.return_value.__enter__.return_value = cur
    conn.cursor.return_value.__exit__.return_value = False
    return conn, cur


@pytest.fixture
def computer(mock_conn):
    """MetricComputer with psycopg2.connect patched to the mock connection."""
    conn, _ = mock_conn
    with patch("src.metrics.psycopg2.connect", return_value=conn):
        mc = MetricComputer("postgresql://test/db")
    return mc


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def _set_fetchall(mock_conn_fixture, rows):
    """Configure the cursor's fetchall to return *rows*."""
    _, cur = mock_conn_fixture
    cur.fetchall.return_value = rows


def _set_fetchone(mock_conn_fixture, row):
    """Configure the cursor's fetchone to return *row*."""
    _, cur = mock_conn_fixture
    cur.fetchone.return_value = row


# ---------------------------------------------------------------------------
# compute_yearly_project_counts
# ---------------------------------------------------------------------------

class TestYearlyProjectCounts:
    def test_stores_count_per_year(self, computer, mock_conn):
        _set_fetchall(mock_conn, [(2019, 3), (2020, 7), (2021, 12)])
        computer._store_metric = MagicMock()

        computer.compute_yearly_project_counts()

        assert computer._store_metric.call_count == 3
        computer._store_metric.assert_any_call("project_count_by_year", 2019, 3.0)
        computer._store_metric.assert_any_call("project_count_by_year", 2020, 7.0)
        computer._store_metric.assert_any_call("project_count_by_year", 2021, 12.0)

    def test_commits_after_storing(self, computer, mock_conn):
        conn, _ = mock_conn
        _set_fetchall(mock_conn, [(2020, 5)])
        computer._store_metric = MagicMock()

        computer.compute_yearly_project_counts()

        conn.commit.assert_called_once()

    def test_no_rows_no_store_calls(self, computer, mock_conn):
        _set_fetchall(mock_conn, [])
        computer._store_metric = MagicMock()

        computer.compute_yearly_project_counts()

        computer._store_metric.assert_not_called()


# ---------------------------------------------------------------------------
# compute_yearly_oa_rates
# ---------------------------------------------------------------------------

class TestYearlyOaRates:
    def test_rate_calculation_3_of_10(self, computer, mock_conn):
        # 3 OA out of 10 total → 30.0 %
        _set_fetchall(mock_conn, [(2020, 10, 3)])
        computer._store_metric = MagicMock()

        computer.compute_yearly_oa_rates()

        computer._store_metric.assert_called_once_with(
            "oa_publication_rate_by_year",
            2020,
            30.0,
            metadata={"total_publications": 10, "oa_publications": 3},
        )

    def test_rate_100_percent(self, computer, mock_conn):
        _set_fetchall(mock_conn, [(2021, 5, 5)])
        computer._store_metric = MagicMock()

        computer.compute_yearly_oa_rates()

        args = computer._store_metric.call_args
        assert args[0][2] == 100.0

    def test_zero_total_yields_zero_rate(self, computer, mock_conn):
        # Edge case: year with zero publication outputs
        _set_fetchall(mock_conn, [(2000, 0, 0)])
        computer._store_metric = MagicMock()

        computer.compute_yearly_oa_rates()

        args = computer._store_metric.call_args
        assert args[0][2] == 0.0

    def test_multiple_years(self, computer, mock_conn):
        _set_fetchall(mock_conn, [(2018, 20, 10), (2019, 4, 1)])
        computer._store_metric = MagicMock()

        computer.compute_yearly_oa_rates()

        assert computer._store_metric.call_count == 2
        calls = {c[0][1]: c[0][2] for c in computer._store_metric.call_args_list}
        assert calls[2018] == 50.0
        assert calls[2019] == 25.0


# ---------------------------------------------------------------------------
# compute_yearly_output_counts_by_category
# ---------------------------------------------------------------------------

class TestYearlyOutputCountsByCategory:
    def test_category_encoded_in_metric_key(self, computer, mock_conn):
        _set_fetchall(mock_conn, [
            ("publications", 2020, 8),
            ("software and technical products", 2020, 3),
        ])
        computer._store_metric = MagicMock()

        computer.compute_yearly_output_counts_by_category()

        keys = {c[0][0] for c in computer._store_metric.call_args_list}
        assert "output_count_by_category_year:publications" in keys
        assert "output_count_by_category_year:software and technical products" in keys

    def test_metadata_contains_category(self, computer, mock_conn):
        _set_fetchall(mock_conn, [("publications", 2021, 5)])
        computer._store_metric = MagicMock()

        computer.compute_yearly_output_counts_by_category()

        _, kwargs = computer._store_metric.call_args
        assert kwargs["metadata"]["category"] == "publications"

    def test_value_is_float_count(self, computer, mock_conn):
        _set_fetchall(mock_conn, [("awards", 2019, 42)])
        computer._store_metric = MagicMock()

        computer.compute_yearly_output_counts_by_category()

        assert computer._store_metric.call_args[0][2] == 42.0

    def test_no_outputs_no_store_calls(self, computer, mock_conn):
        _set_fetchall(mock_conn, [])
        computer._store_metric = MagicMock()

        computer.compute_yearly_output_counts_by_category()

        computer._store_metric.assert_not_called()


# ---------------------------------------------------------------------------
# compute_institutional_rankings
# ---------------------------------------------------------------------------

class TestInstitutionalRankings:
    def test_ror_id_passed_correctly(self, computer, mock_conn):
        _set_fetchall(mock_conn, [
            ("https://ror.org/abc123", 10, 50, 40, 30),
        ])
        computer._store_metric = MagicMock()

        computer.compute_institutional_rankings()

        _, kwargs = computer._store_metric.call_args
        assert kwargs["ror_id"] == "https://ror.org/abc123"

    def test_year_is_none_for_institution_metric(self, computer, mock_conn):
        _set_fetchall(mock_conn, [("https://ror.org/abc123", 5, 20, 15, 10)])
        computer._store_metric = MagicMock()

        computer.compute_institutional_rankings()

        assert computer._store_metric.call_args[0][1] is None

    def test_oa_rate_calculation_in_metadata(self, computer, mock_conn):
        # 30 oa_pub_count out of 40 pub_count → 75.0 %
        _set_fetchall(mock_conn, [("https://ror.org/x", 3, 80, 40, 30)])
        computer._store_metric = MagicMock()

        computer.compute_institutional_rankings()

        _, kwargs = computer._store_metric.call_args
        assert kwargs["metadata"]["oa_publication_rate"] == 75.0

    def test_zero_publications_yields_zero_oa_rate(self, computer, mock_conn):
        # Institution with no publication outputs → OA rate = 0
        _set_fetchall(mock_conn, [("https://ror.org/y", 2, 5, 0, 0)])
        computer._store_metric = MagicMock()

        computer.compute_institutional_rankings()

        _, kwargs = computer._store_metric.call_args
        assert kwargs["metadata"]["oa_publication_rate"] == 0.0

    def test_value_is_project_count(self, computer, mock_conn):
        _set_fetchall(mock_conn, [("https://ror.org/z", 7, 30, 20, 10)])
        computer._store_metric = MagicMock()

        computer.compute_institutional_rankings()

        assert computer._store_metric.call_args[0][2] == 7.0


# ---------------------------------------------------------------------------
# compute_funding_efficiency
# ---------------------------------------------------------------------------

class TestFundingEfficiency:
    def test_stores_avg_amount_as_value(self, computer, mock_conn):
        _set_fetchall(mock_conn, [
            (2015, 250_000.0, 1_000_000.0, 4, 2.5, 100_000.0),
        ])
        computer._store_metric = MagicMock()

        computer.compute_funding_efficiency()

        assert computer._store_metric.call_args[0][2] == 250_000.0

    def test_metadata_fields_present(self, computer, mock_conn):
        _set_fetchall(mock_conn, [
            (2020, 300_000.0, 900_000.0, 3, 5.0, 60_000.0),
        ])
        computer._store_metric = MagicMock()

        computer.compute_funding_efficiency()

        _, kwargs = computer._store_metric.call_args
        md = kwargs["metadata"]
        assert md["total_funding"] == 900_000.0
        assert md["project_count"] == 3
        assert md["avg_outputs_per_project"] == 5.0
        assert md["avg_funding_per_output"] == 60_000.0

    def test_none_funding_per_output_stored_as_none(self, computer, mock_conn):
        # Projects with zero outputs → funding_per_output is None from SQL
        _set_fetchall(mock_conn, [
            (2013, 150_000.0, 150_000.0, 1, 0.0, None),
        ])
        computer._store_metric = MagicMock()

        computer.compute_funding_efficiency()

        _, kwargs = computer._store_metric.call_args
        assert kwargs["metadata"]["avg_funding_per_output"] is None


# ---------------------------------------------------------------------------
# compute_open_data_rates
# ---------------------------------------------------------------------------

class TestOpenDataRates:
    def test_rate_3_of_10(self, computer, mock_conn):
        _set_fetchall(mock_conn, [(2020, 10, 3)])
        computer._store_metric = MagicMock()

        computer.compute_open_data_rates()

        computer._store_metric.assert_called_once_with(
            "open_data_rate_by_year",
            2020,
            30.0,
            metadata={"total": 10, "provided_to_others": 3},
        )

    def test_all_provided_yields_100(self, computer, mock_conn):
        _set_fetchall(mock_conn, [(2021, 6, 6)])
        computer._store_metric = MagicMock()

        computer.compute_open_data_rates()

        assert computer._store_metric.call_args[0][2] == 100.0

    def test_none_provided_yields_zero(self, computer, mock_conn):
        _set_fetchall(mock_conn, [(2019, 4, 0)])
        computer._store_metric = MagicMock()

        computer.compute_open_data_rates()

        assert computer._store_metric.call_args[0][2] == 0.0

    def test_zero_total_yields_zero(self, computer, mock_conn):
        # Edge case: year bucket exists but total is 0 (shouldn't occur via SQL but guard anyway)
        _set_fetchall(mock_conn, [(2005, 0, 0)])
        computer._store_metric = MagicMock()

        computer.compute_open_data_rates()

        assert computer._store_metric.call_args[0][2] == 0.0


# ---------------------------------------------------------------------------
# compute_open_software_rates
# ---------------------------------------------------------------------------

class TestOpenSoftwareRates:
    def test_rate_5_of_10(self, computer, mock_conn):
        _set_fetchall(mock_conn, [(2022, 10, 5)])
        computer._store_metric = MagicMock()

        computer.compute_open_software_rates()

        computer._store_metric.assert_called_once_with(
            "open_software_rate_by_year",
            2022,
            50.0,
            metadata={"total": 10, "with_doi": 5},
        )

    def test_no_doi_yields_zero(self, computer, mock_conn):
        _set_fetchall(mock_conn, [(2018, 8, 0)])
        computer._store_metric = MagicMock()

        computer.compute_open_software_rates()

        assert computer._store_metric.call_args[0][2] == 0.0

    def test_zero_total_yields_zero(self, computer, mock_conn):
        _set_fetchall(mock_conn, [(2010, 0, 0)])
        computer._store_metric = MagicMock()

        computer.compute_open_software_rates()

        assert computer._store_metric.call_args[0][2] == 0.0


# ---------------------------------------------------------------------------
# compute_summary_stats
# ---------------------------------------------------------------------------

class TestSummaryStats:
    def test_stores_summary_with_null_year(self, computer, mock_conn):
        _set_fetchone(mock_conn, (1500, 12000, 80, 1995, 2024, 67.5))
        computer._store_metric = MagicMock()

        computer.compute_summary_stats()

        args, kwargs = computer._store_metric.call_args
        assert args[0] == "summary"
        assert args[1] is None  # year=None
        assert args[2] == 1500.0  # value = total_projects

    def test_metadata_contents(self, computer, mock_conn):
        _set_fetchone(mock_conn, (100, 800, 20, 2000, 2023, 55.0))
        computer._store_metric = MagicMock()

        computer.compute_summary_stats()

        _, kwargs = computer._store_metric.call_args
        md = kwargs["metadata"]
        assert md["total_projects"] == 100
        assert md["total_outputs"] == 800
        assert md["total_institutions"] == 20
        assert md["overall_oa_rate"] == 55.0
        assert md["year_range"] == [2000, 2023]

    def test_none_row_does_not_store(self, computer, mock_conn):
        _set_fetchone(mock_conn, None)
        computer._store_metric = MagicMock()

        computer.compute_summary_stats()

        computer._store_metric.assert_not_called()

    def test_all_null_fields_default_to_zero(self, computer, mock_conn):
        _set_fetchone(mock_conn, (None, None, None, None, None, None))
        computer._store_metric = MagicMock()

        computer.compute_summary_stats()

        args, kwargs = computer._store_metric.call_args
        assert args[2] == 0.0
        md = kwargs["metadata"]
        assert md["total_projects"] == 0
        assert md["total_outputs"] == 0
        assert md["total_institutions"] == 0
        assert md["overall_oa_rate"] == 0.0
        assert md["year_range"] == [None, None]


# ---------------------------------------------------------------------------
# _store_metric — SQL correctness
# ---------------------------------------------------------------------------

class TestStoreMetric:
    def test_executes_delete_then_insert(self, computer, mock_conn):
        conn, cur = mock_conn

        computer._store_metric("project_count_by_year", 2020, 42.0)

        assert cur.execute.call_count == 2
        delete_sql, delete_params = cur.execute.call_args_list[0][0]
        insert_sql, insert_params = cur.execute.call_args_list[1][0]

        assert "DELETE" in delete_sql.upper()
        assert "INSERT" in insert_sql.upper()
        # NULL-safe equality used in DELETE
        assert "IS NOT DISTINCT FROM" in delete_sql

    def test_delete_params_match_key_year_ror(self, computer, mock_conn):
        _, cur = mock_conn

        computer._store_metric("oa_publication_rate_by_year", 2019, 55.5, ror_id=None)

        delete_params = cur.execute.call_args_list[0][0][1]
        assert delete_params == ("oa_publication_rate_by_year", 2019, None)

    def test_insert_params_include_value_and_metadata(self, computer, mock_conn):
        _, cur = mock_conn

        computer._store_metric(
            "institution_project_count",
            None,
            7.0,
            ror_id="https://ror.org/abc",
            metadata={"output_count": 30},
        )

        insert_params = cur.execute.call_args_list[1][0][1]
        metric_key, year, ror_id, value, metadata_json = insert_params
        assert metric_key == "institution_project_count"
        assert year is None
        assert ror_id == "https://ror.org/abc"
        assert value == 7.0
        # metadata is wrapped in psycopg2.extras.Json; check the adapted value
        assert metadata_json.adapted == {"output_count": 30}

    def test_does_not_commit(self, computer, mock_conn):
        conn, _ = mock_conn

        computer._store_metric("summary", None, 0.0)

        conn.commit.assert_not_called()


# ---------------------------------------------------------------------------
# compute_all — integration smoke test
# ---------------------------------------------------------------------------

class TestComputeAll:
    def test_all_compute_methods_called(self, computer):
        methods = [
            "compute_yearly_project_counts",
            "compute_yearly_oa_rates",
            "compute_yearly_output_counts_by_category",
            "compute_institutional_rankings",
            "compute_funding_efficiency",
            "compute_open_data_rates",
            "compute_open_software_rates",
            "compute_summary_stats",
        ]
        mocks = {}
        for name in methods:
            mocks[name] = MagicMock()
            setattr(computer, name, mocks[name])

        computer.compute_all()

        for name, mock in mocks.items():
            mock.assert_called_once_with(), f"{name} was not called"


# ---------------------------------------------------------------------------
# Lifecycle
# ---------------------------------------------------------------------------

class TestLifecycle:
    def test_context_manager_closes_connection(self, mock_conn):
        conn, _ = mock_conn
        with patch("src.metrics.psycopg2.connect", return_value=conn):
            with MetricComputer("postgresql://test/db") as mc:
                pass
        conn.close.assert_called_once()

    def test_context_manager_rolls_back_on_exception(self, mock_conn):
        conn, _ = mock_conn
        with patch("src.metrics.psycopg2.connect", return_value=conn):
            try:
                with MetricComputer("postgresql://test/db") as mc:
                    raise ValueError("simulated failure")
            except ValueError:
                pass
        conn.rollback.assert_called_once()
