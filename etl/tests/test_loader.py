"""
Tests for etl/src/loader.py

All PostgreSQL interaction is mocked via unittest.mock — no live DB required.

Run with:
    cd etl
    python -m pytest tests/test_loader.py -v
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from unittest.mock import MagicMock, call, patch, PropertyMock

import pytest

# ---------------------------------------------------------------------------
# Helpers / fixtures
# ---------------------------------------------------------------------------

def _make_project(i: int) -> dict:
    return {
        "id": f"P{i}",
        "grantDoi": f"10.55776/P{i}",
        "titleEn": f"Project {i}",
        "titleDe": None,
        "summaryEn": None,
        "programEn": "Stand-alone Projects",
        "statusEn": "Ongoing",
        "approvalDate": datetime(2020, 1, 1, tzinfo=timezone.utc),
        "startDate": datetime(2020, 6, 1, tzinfo=timezone.utc),
        "endDate": None,
        "approvedAmount": 200000,
        "approvalYear": 2020,
        "piFirstName": "Anna",
        "piLastName": "Muster",
        "piOrcid": "0000-0001-2345-6789",
        "piRole": "PI",
        "piInstitutionName": "University of Vienna",
        "piInstitutionRor": "https://ror.org/04d836q62",
        "researchRadarUrl": f"https://radar.fwf.ac.at/en/project/P{i}",
        "keywords": ["ecology", "alpine"],
        "disciplinesEn": ["Ecology"],
        "fieldsEn": ["Natural Sciences"],
        "rawJson": {"id": f"projects-P{i}"},
    }


def _make_output(i: int, has_doi: bool = True) -> dict:
    doi = f"10.1000/output{i}" if has_doi else None
    return {
        "id": doi or f"hash-{i:024d}",
        "doi": doi,
        "title": f"Output {i}",
        "category": "publications",
        "type": "Journal Article",
        "years": [2021],
        "url": None,
        "pmid": None,
        "journal": "Nature",
        "publisher": None,
        "providedToOthers": None,
        "hasDoi": has_doi,
        "hasPmid": False,
        "rawJson": {},
        "connectedProjectIds": [f"P{i}"],
    }


def _make_funding(i: int) -> dict:
    return {
        "id": f"cuid{i}",
        "funder": "ERC",
        "fundingId": f"ERC-{i}",
        "country": "EU",
        "sector": "Government",
        "title": f"ERC Grant {i}",
        "doi": None,
        "type": "Grant",
        "startYear": 2021,
        "endYear": 2026,
        "funderProjectUrl": None,
        "connectedProjectIds": [f"P{i}"],
    }


def _make_institution(i: int) -> dict:
    return {
        "rorId": f"https://ror.org/{i:09d}",
        "name": f"University {i}",
        "country": "AT",
    }


# ---------------------------------------------------------------------------
# Mock setup
# ---------------------------------------------------------------------------

def _make_mock_loader(batch_size: int = 500):
    """Return a DatabaseLoader with a fully mocked psycopg2 connection."""
    with patch("psycopg2.connect") as mock_connect:
        mock_conn = MagicMock()
        mock_conn.closed = False
        mock_connect.return_value = mock_conn

        mock_cursor_ctx = MagicMock()
        mock_cursor = MagicMock()
        mock_cursor_ctx.__enter__ = MagicMock(return_value=mock_cursor)
        mock_cursor_ctx.__exit__ = MagicMock(return_value=False)
        mock_conn.cursor.return_value = mock_cursor_ctx

        # _verify_join_tables: fetchall returns empty list (tables not found)
        mock_cursor.fetchall.return_value = []
        mock_cursor.fetchone.return_value = None

        from src.loader import DatabaseLoader
        loader = DatabaseLoader("postgresql://test/db", batch_size=batch_size)

    # After construction, reset mocks so tests start clean.
    mock_cursor.reset_mock()
    mock_conn.reset_mock()

    # Re-attach so tests can inspect calls.
    loader._conn = mock_conn
    loader._mock_cursor = mock_cursor
    loader._mock_cursor_ctx = mock_cursor_ctx
    return loader


# ---------------------------------------------------------------------------
# DatabaseLoader.__init__
# ---------------------------------------------------------------------------

class TestDatabaseLoaderInit:
    def test_connects_with_database_url(self):
        with patch("psycopg2.connect") as mock_connect:
            mock_conn = MagicMock()
            mock_conn.closed = False
            mock_connect.return_value = mock_conn
            mock_cursor_ctx = MagicMock()
            mock_cursor = MagicMock()
            mock_cursor_ctx.__enter__ = MagicMock(return_value=mock_cursor)
            mock_cursor_ctx.__exit__ = MagicMock(return_value=False)
            mock_conn.cursor.return_value = mock_cursor_ctx
            mock_cursor.fetchall.return_value = []

            from src.loader import DatabaseLoader
            loader = DatabaseLoader("postgresql://user:pass@host/db")

        mock_connect.assert_called_once_with("postgresql://user:pass@host/db")

    def test_autocommit_disabled(self):
        with patch("psycopg2.connect") as mock_connect:
            mock_conn = MagicMock()
            mock_conn.closed = False
            mock_connect.return_value = mock_conn
            mock_cursor_ctx = MagicMock()
            mock_cursor = MagicMock()
            mock_cursor_ctx.__enter__ = MagicMock(return_value=mock_cursor)
            mock_cursor_ctx.__exit__ = MagicMock(return_value=False)
            mock_conn.cursor.return_value = mock_cursor_ctx
            mock_cursor.fetchall.return_value = []

            from src.loader import DatabaseLoader
            loader = DatabaseLoader("postgresql://user:pass@host/db")

        assert mock_conn.autocommit is False


# ---------------------------------------------------------------------------
# _batched helper
# ---------------------------------------------------------------------------

class TestBatched:
    def test_exact_multiple(self):
        from src.loader import _batched
        batches = list(_batched(list(range(10)), 5))
        assert len(batches) == 2
        assert batches[0] == list(range(5))
        assert batches[1] == list(range(5, 10))

    def test_partial_last_batch(self):
        from src.loader import _batched
        batches = list(_batched(list(range(7)), 3))
        assert len(batches) == 3
        assert batches[-1] == [6]

    def test_single_item(self):
        from src.loader import _batched
        batches = list(_batched([42], 100))
        assert batches == [[42]]

    def test_empty_list(self):
        from src.loader import _batched
        batches = list(_batched([], 10))
        assert batches == []

    def test_batch_size_larger_than_list(self):
        from src.loader import _batched
        batches = list(_batched([1, 2, 3], 100))
        assert batches == [[1, 2, 3]]


# ---------------------------------------------------------------------------
# upsert_projects
# ---------------------------------------------------------------------------

class TestUpsertProjects:
    @patch("src.loader.execute_values")
    def test_returns_count(self, mock_ev):
        loader = _make_mock_loader()
        projects = [_make_project(i) for i in range(3)]
        result = loader.upsert_projects(projects)
        assert result == 3

    @patch("src.loader.execute_values")
    def test_empty_list_returns_zero(self, mock_ev):
        loader = _make_mock_loader()
        assert loader.upsert_projects([]) == 0
        mock_ev.assert_not_called()

    @patch("src.loader.execute_values")
    def test_commits_after_all_batches(self, mock_ev):
        loader = _make_mock_loader(batch_size=2)
        projects = [_make_project(i) for i in range(5)]
        loader.upsert_projects(projects)
        loader._conn.commit.assert_called_once()

    @patch("src.loader.execute_values")
    def test_batches_correctly(self, mock_ev):
        """With batch_size=2 and 5 projects, execute_values is called 3×."""
        loader = _make_mock_loader(batch_size=2)
        projects = [_make_project(i) for i in range(5)]
        loader.upsert_projects(projects)
        assert mock_ev.call_count == 3  # ceil(5/2) = 3

    @patch("src.loader.execute_values")
    def test_sql_targets_project_table(self, mock_ev):
        loader = _make_mock_loader()
        loader.upsert_projects([_make_project(0)])
        sql_used = mock_ev.call_args[0][1]  # second positional arg to execute_values
        assert '"Project"' in sql_used
        assert "ON CONFLICT" in sql_used
        assert "DO UPDATE" in sql_used

    @patch("src.loader.execute_values")
    def test_row_tuple_has_correct_column_count(self, mock_ev):
        loader = _make_mock_loader()
        loader.upsert_projects([_make_project(0)])
        rows = mock_ev.call_args[0][2]  # third positional arg = list of rows
        assert len(rows) == 1
        # 24 columns: id + 22 data cols + lastSyncedAt
        assert len(rows[0]) == 24

    @patch("src.loader.execute_values")
    def test_none_values_passed_for_optional_fields(self, mock_ev):
        loader = _make_mock_loader()
        p = _make_project(0)
        p["titleDe"] = None
        p["summaryEn"] = None
        p["endDate"] = None
        loader.upsert_projects([p])
        row = mock_ev.call_args[0][2][0]
        # titleDe is index 3, summaryEn is 4, endDate is 9
        assert row[3] is None   # titleDe
        assert row[4] is None   # summaryEn
        assert row[9] is None   # endDate

    @patch("src.loader.execute_values")
    def test_large_batch_respects_batch_size(self, mock_ev):
        loader = _make_mock_loader(batch_size=500)
        projects = [_make_project(i) for i in range(1200)]
        loader.upsert_projects(projects)
        # ceil(1200 / 500) = 3 calls
        assert mock_ev.call_count == 3


# ---------------------------------------------------------------------------
# upsert_outputs
# ---------------------------------------------------------------------------

class TestUpsertOutputs:
    @patch("src.loader.execute_values")
    def test_returns_total_count(self, mock_ev):
        loader = _make_mock_loader()
        outputs = [_make_output(i) for i in range(4)]
        result = loader.upsert_outputs(outputs)
        assert result == 4

    @patch("src.loader.execute_values")
    def test_empty_list_returns_zero(self, mock_ev):
        loader = _make_mock_loader()
        assert loader.upsert_outputs([]) == 0
        mock_ev.assert_not_called()

    @patch("src.loader.execute_values")
    def test_doi_and_hash_outputs_use_different_conflict_targets(self, mock_ev):
        loader = _make_mock_loader()
        outputs = [
            _make_output(0, has_doi=True),
            _make_output(1, has_doi=False),
        ]
        loader.upsert_outputs(outputs)
        # Called twice: once for doi conflict, once for id conflict
        assert mock_ev.call_count == 2
        doi_sql  = mock_ev.call_args_list[0][0][1]
        hash_sql = mock_ev.call_args_list[1][0][1]
        assert "ON CONFLICT (doi)"  in doi_sql
        assert "ON CONFLICT (id)"   in hash_sql

    @patch("src.loader.execute_values")
    def test_only_doi_outputs_calls_ev_once(self, mock_ev):
        loader = _make_mock_loader()
        outputs = [_make_output(i, has_doi=True) for i in range(3)]
        loader.upsert_outputs(outputs)
        assert mock_ev.call_count == 1
        assert "ON CONFLICT (doi)" in mock_ev.call_args[0][1]

    @patch("src.loader.execute_values")
    def test_only_hash_outputs_calls_ev_once(self, mock_ev):
        loader = _make_mock_loader()
        outputs = [_make_output(i, has_doi=False) for i in range(3)]
        loader.upsert_outputs(outputs)
        assert mock_ev.call_count == 1
        assert "ON CONFLICT (id)" in mock_ev.call_args[0][1]

    @patch("src.loader.execute_values")
    def test_commits_once_after_all_passes(self, mock_ev):
        loader = _make_mock_loader()
        outputs = [_make_output(0, True), _make_output(1, False)]
        loader.upsert_outputs(outputs)
        loader._conn.commit.assert_called_once()

    @patch("src.loader.execute_values")
    def test_batching_within_doi_pass(self, mock_ev):
        loader = _make_mock_loader(batch_size=2)
        outputs = [_make_output(i, has_doi=True) for i in range(5)]
        loader.upsert_outputs(outputs)
        # 3 batches for doi pass; 0 for hash pass
        assert mock_ev.call_count == 3


# ---------------------------------------------------------------------------
# link_projects_outputs
# ---------------------------------------------------------------------------

class TestLinkProjectsOutputs:
    @patch("src.loader.execute_values")
    def test_returns_pair_count(self, mock_ev):
        loader = _make_mock_loader()
        mapping = {"out-1": ["P1", "P2"], "out-2": ["P3"]}
        result = loader.link_projects_outputs(mapping)
        assert result == 3

    @patch("src.loader.execute_values")
    def test_empty_mapping_returns_zero(self, mock_ev):
        loader = _make_mock_loader()
        assert loader.link_projects_outputs({}) == 0
        mock_ev.assert_not_called()

    @patch("src.loader.execute_values")
    def test_sql_uses_correct_join_table(self, mock_ev):
        loader = _make_mock_loader()
        loader.link_projects_outputs({"out-1": ["P1"]})
        sql = mock_ev.call_args[0][1]
        assert "_ProjectOutputs" in sql
        assert '"A"' in sql
        assert '"B"' in sql
        assert "ON CONFLICT" in sql
        assert "DO NOTHING" in sql

    @patch("src.loader.execute_values")
    def test_pairs_passed_correctly(self, mock_ev):
        loader = _make_mock_loader()
        loader.link_projects_outputs({"out-A": ["P1"]})
        rows = mock_ev.call_args[0][2]
        assert ("out-A", "P1") in rows

    @patch("src.loader.execute_values")
    def test_skips_empty_ids(self, mock_ev):
        loader = _make_mock_loader()
        result = loader.link_projects_outputs({"": ["P1"], "out-1": [""]})
        # Both are empty — no pairs should be created
        assert result == 0
        mock_ev.assert_not_called()

    @patch("src.loader.execute_values")
    def test_commits(self, mock_ev):
        loader = _make_mock_loader()
        loader.link_projects_outputs({"out-1": ["P1"]})
        loader._conn.commit.assert_called_once()


# ---------------------------------------------------------------------------
# upsert_further_funding
# ---------------------------------------------------------------------------

class TestUpsertFurtherFunding:
    @patch("src.loader.execute_values")
    def test_returns_count(self, mock_ev):
        loader = _make_mock_loader()
        funding = [_make_funding(i) for i in range(3)]
        assert loader.upsert_further_funding(funding) == 3

    @patch("src.loader.execute_values")
    def test_empty_returns_zero(self, mock_ev):
        loader = _make_mock_loader()
        assert loader.upsert_further_funding([]) == 0
        mock_ev.assert_not_called()

    @patch("src.loader.execute_values")
    def test_sql_targets_further_funding_table(self, mock_ev):
        loader = _make_mock_loader()
        loader.upsert_further_funding([_make_funding(0)])
        sql = mock_ev.call_args[0][1]
        assert '"FurtherFunding"' in sql
        assert "ON CONFLICT (id) DO UPDATE" in sql

    @patch("src.loader.execute_values")
    def test_row_tuple_column_count(self, mock_ev):
        loader = _make_mock_loader()
        loader.upsert_further_funding([_make_funding(0)])
        rows = mock_ev.call_args[0][2]
        # id + 10 data cols + lastSyncedAt = 12
        assert len(rows[0]) == 12

    @patch("src.loader.execute_values")
    def test_batching(self, mock_ev):
        loader = _make_mock_loader(batch_size=3)
        funding = [_make_funding(i) for i in range(7)]
        loader.upsert_further_funding(funding)
        assert mock_ev.call_count == 3  # ceil(7/3)


# ---------------------------------------------------------------------------
# link_projects_funding
# ---------------------------------------------------------------------------

class TestLinkProjectsFunding:
    @patch("src.loader.execute_values")
    def test_returns_count(self, mock_ev):
        loader = _make_mock_loader()
        result = loader.link_projects_funding({"ff-1": ["P1", "P2"]})
        assert result == 2

    @patch("src.loader.execute_values")
    def test_sql_uses_correct_join_table(self, mock_ev):
        loader = _make_mock_loader()
        loader.link_projects_funding({"ff-1": ["P1"]})
        sql = mock_ev.call_args[0][1]
        assert "_ProjectFurtherFunding" in sql
        assert "DO NOTHING" in sql

    @patch("src.loader.execute_values")
    def test_empty_returns_zero(self, mock_ev):
        loader = _make_mock_loader()
        assert loader.link_projects_funding({}) == 0
        mock_ev.assert_not_called()


# ---------------------------------------------------------------------------
# upsert_institutions
# ---------------------------------------------------------------------------

class TestUpsertInstitutions:
    @patch("src.loader.execute_values")
    def test_returns_count(self, mock_ev):
        loader = _make_mock_loader()
        insts = [_make_institution(i) for i in range(4)]
        assert loader.upsert_institutions(insts) == 4

    @patch("src.loader.execute_values")
    def test_empty_returns_zero(self, mock_ev):
        loader = _make_mock_loader()
        assert loader.upsert_institutions([]) == 0
        mock_ev.assert_not_called()

    @patch("src.loader.execute_values")
    def test_sql_targets_institution_table(self, mock_ev):
        loader = _make_mock_loader()
        loader.upsert_institutions([_make_institution(0)])
        sql = mock_ev.call_args[0][1]
        assert '"Institution"' in sql
        assert '"rorId"' in sql
        assert "ON CONFLICT" in sql

    @patch("src.loader.execute_values")
    def test_row_has_three_columns(self, mock_ev):
        loader = _make_mock_loader()
        loader.upsert_institutions([_make_institution(0)])
        rows = mock_ev.call_args[0][2]
        assert len(rows[0]) == 3  # rorId, name, country

    @patch("src.loader.execute_values")
    def test_default_country_at(self, mock_ev):
        loader = _make_mock_loader()
        inst = {"rorId": "https://ror.org/abc", "name": "Uni"}  # no country key
        loader.upsert_institutions([inst])
        rows = mock_ev.call_args[0][2]
        assert rows[0][2] == "AT"

    @patch("src.loader.execute_values")
    def test_large_volume(self, mock_ev):
        loader = _make_mock_loader(batch_size=500)
        insts = [_make_institution(i) for i in range(10_000)]
        result = loader.upsert_institutions(insts)
        assert result == 10_000
        assert mock_ev.call_count == 20  # ceil(10000/500)


# ---------------------------------------------------------------------------
# update_institution_counts
# ---------------------------------------------------------------------------

class TestUpdateInstitutionCounts:
    def test_executes_update_sql(self):
        loader = _make_mock_loader()
        loader._mock_cursor.rowcount = 5
        loader.update_institution_counts()
        loader._mock_cursor.execute.assert_called_once()
        sql = loader._mock_cursor.execute.call_args[0][0]
        assert "UPDATE" in sql
        assert '"Institution"' in sql
        assert '"projectCount"' in sql
        assert '"outputCount"' in sql

    def test_commits_after_update(self):
        loader = _make_mock_loader()
        loader._mock_cursor.rowcount = 0
        loader.update_institution_counts()
        loader._conn.commit.assert_called_once()


# ---------------------------------------------------------------------------
# log_sync
# ---------------------------------------------------------------------------

class TestLogSync:
    def test_inserts_sync_log_row(self):
        loader = _make_mock_loader()
        loader.log_sync("completed", 100, 500)
        loader._mock_cursor.execute.assert_called_once()
        sql = loader._mock_cursor.execute.call_args[0][0]
        assert '"SyncLog"' in sql
        assert "INSERT INTO" in sql

    def test_passes_status_and_counts(self):
        loader = _make_mock_loader()
        loader.log_sync("failed", 42, 7, errors="Something went wrong")
        args = loader._mock_cursor.execute.call_args[0][1]
        # args = (started_at, completed_at, status, projects, outputs, errors)
        assert "failed" in args
        assert 42 in args
        assert 7 in args
        assert "Something went wrong" in args

    def test_commits(self):
        loader = _make_mock_loader()
        loader.log_sync("completed", 0, 0)
        loader._conn.commit.assert_called_once()


# ---------------------------------------------------------------------------
# close / context manager
# ---------------------------------------------------------------------------

class TestCloseAndContextManager:
    def test_close_closes_connection(self):
        loader = _make_mock_loader()
        loader.close()
        loader._conn.close.assert_called_once()

    def test_context_manager_closes_on_exit(self):
        loader = _make_mock_loader()
        with loader:
            pass
        loader._conn.close.assert_called_once()

    def test_context_manager_rolls_back_on_exception(self):
        loader = _make_mock_loader()
        try:
            with loader:
                raise ValueError("test error")
        except ValueError:
            pass
        loader._conn.rollback.assert_called_once()

    def test_close_is_idempotent(self):
        loader = _make_mock_loader()
        loader.close()
        loader._conn.closed = True  # simulate already-closed
        loader.close()  # should not raise
        # close() called only once because conn.closed is True on second call
        loader._conn.close.assert_called_once()


# ---------------------------------------------------------------------------
# _to_json helper
# ---------------------------------------------------------------------------

class TestToJson:
    def test_none_returns_none(self):
        from src.loader import _to_json
        assert _to_json(None) is None

    def test_dict_serialised(self):
        from src.loader import _to_json
        result = _to_json({"key": "value"})
        assert json.loads(result) == {"key": "value"}

    def test_unserializable_returns_none(self):
        from src.loader import _to_json

        class Unserializable:
            pass

        # datetime is handled via default=str; truly unserializable would need
        # a type that raises.  We just confirm None is returned rather than
        # raising.
        import unittest.mock as mock
        with mock.patch("json.dumps", side_effect=TypeError("not serializable")):
            result = _to_json({"key": "val"})
        assert result is None


if __name__ == "__main__":
    import pytest as _pytest
    _pytest.main([__file__, "-v"])
