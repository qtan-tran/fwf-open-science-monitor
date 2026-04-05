"""
Unit tests for the ETL pipeline orchestrator (src/pipeline.py).

Strategy
--------
- FWFClient, DatabaseLoader, and MetricComputer are fully mocked so no
  network or database connections are made.
- Tests assert that steps run in the expected order and that errors in one
  step do not prevent subsequent steps from executing.
"""

from __future__ import annotations

from unittest.mock import MagicMock, call, patch

import pytest

from src.pipeline import (
    _ff_stable_id,
    _step_projects,
    _step_outputs,
    _step_further_funding,
    _step_institutions,
    _step_metrics,
    run_full_pipeline,
    run_metrics_only,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _mock_client(projects=None, outputs=None, further_funding=None):
    client = MagicMock()
    client.fetch_all_projects.return_value = projects or []
    client.fetch_all_outputs.return_value = outputs or []
    client.fetch_all_further_funding.return_value = further_funding or []
    return client


def _mock_loader():
    loader = MagicMock()
    loader.upsert_projects.return_value = 0
    loader.upsert_outputs.return_value = 0
    loader.link_projects_outputs.return_value = 0
    loader.upsert_further_funding.return_value = None
    loader.link_projects_funding.return_value = 0
    loader.upsert_institutions.return_value = None
    loader.update_institution_counts.return_value = None
    loader.log_sync.return_value = None
    return loader


# ---------------------------------------------------------------------------
# _ff_stable_id
# ---------------------------------------------------------------------------

class TestFfStableId:
    def test_returns_string_starting_with_ff(self):
        ff = {"funder": "FWF", "fundingId": "P12345", "startYear": 2020, "endYear": 2023}
        result = _ff_stable_id(ff)
        assert result.startswith("ff-")

    def test_is_deterministic(self):
        ff = {"funder": "FWF", "fundingId": "P12345", "startYear": 2020, "endYear": 2023}
        assert _ff_stable_id(ff) == _ff_stable_id(ff)

    def test_different_funders_produce_different_ids(self):
        ff1 = {"funder": "FWF", "fundingId": "P001", "startYear": 2020, "endYear": 2022}
        ff2 = {"funder": "DFG", "fundingId": "P001", "startYear": 2020, "endYear": 2022}
        assert _ff_stable_id(ff1) != _ff_stable_id(ff2)

    def test_handles_missing_fields_gracefully(self):
        ff = {}
        result = _ff_stable_id(ff)
        assert result.startswith("ff-")


# ---------------------------------------------------------------------------
# _step_projects
# ---------------------------------------------------------------------------

class TestStepProjects:
    def test_returns_cleaned_projects_and_count_on_success(self):
        raw = [{"id": "p1", "titleDe": "T", "titleEn": "T"}]
        client = _mock_client(projects=raw)
        loader = _mock_loader()
        loader.upsert_projects.return_value = 1

        with patch("src.pipeline.clean_project", return_value={"id": "p1"}):
            cleaned, count, error = _step_projects(client, loader)

        assert error is None
        assert count == 1
        assert len(cleaned) == 1

    def test_returns_error_string_on_exception(self):
        client = _mock_client()
        client.fetch_all_projects.side_effect = RuntimeError("API down")
        loader = _mock_loader()

        cleaned, count, error = _step_projects(client, loader)

        assert error is not None
        assert "API down" in error or "projects" in error.lower()
        assert cleaned == []
        assert count == 0


# ---------------------------------------------------------------------------
# _step_outputs
# ---------------------------------------------------------------------------

class TestStepOutputs:
    def test_returns_count_and_no_error_on_success(self):
        raw = [{"id": "o1"}]
        client = _mock_client(outputs=raw)
        loader = _mock_loader()
        loader.upsert_outputs.return_value = 1

        with patch("src.pipeline.clean_output", return_value={"id": "o1", "connectedProjectIds": ["p1"]}):
            count, error = _step_outputs(client, loader)

        assert error is None
        assert count == 1

    def test_returns_error_string_on_exception(self):
        client = _mock_client()
        client.fetch_all_outputs.side_effect = ConnectionError("timeout")
        loader = _mock_loader()

        count, error = _step_outputs(client, loader)

        assert error is not None
        assert count == 0


# ---------------------------------------------------------------------------
# _step_further_funding
# ---------------------------------------------------------------------------

class TestStepFurtherFunding:
    def test_returns_none_on_success(self):
        client = _mock_client(further_funding=[{"funder": "DFG"}])
        loader = _mock_loader()

        with patch("src.pipeline.clean_further_funding", return_value={"funder": "DFG", "connectedProjectIds": []}):
            error = _step_further_funding(client, loader)

        assert error is None

    def test_returns_error_string_on_exception(self):
        client = _mock_client()
        client.fetch_all_further_funding.side_effect = ValueError("bad response")
        loader = _mock_loader()

        error = _step_further_funding(client, loader)

        assert error is not None


# ---------------------------------------------------------------------------
# _step_institutions
# ---------------------------------------------------------------------------

class TestStepInstitutions:
    def test_returns_none_on_success(self):
        loader = _mock_loader()
        clean_projects = [{"piInstitutionRor": "https://ror.org/xyz", "piInstitutionName": "Uni"}]

        with patch("src.pipeline.extract_institutions", return_value=[{"rorId": "xyz"}]):
            error = _step_institutions(loader, clean_projects)

        assert error is None
        loader.upsert_institutions.assert_called_once()
        loader.update_institution_counts.assert_called_once()

    def test_returns_error_string_on_exception(self):
        loader = _mock_loader()
        loader.upsert_institutions.side_effect = Exception("DB error")

        with patch("src.pipeline.extract_institutions", return_value=[]):
            error = _step_institutions(loader, [])

        assert error is not None


# ---------------------------------------------------------------------------
# _step_metrics
# ---------------------------------------------------------------------------

class TestStepMetrics:
    def test_returns_none_on_success(self):
        mock_mc = MagicMock()
        with patch("src.pipeline.MetricComputer", return_value=mock_mc):
            mock_mc.__enter__ = MagicMock(return_value=mock_mc)
            mock_mc.__exit__ = MagicMock(return_value=False)
            error = _step_metrics()

        assert error is None

    def test_returns_error_string_on_exception(self):
        with patch("src.pipeline.MetricComputer") as MockMC:
            MockMC.return_value.__enter__.side_effect = RuntimeError("metrics failed")
            error = _step_metrics()

        assert error is not None


# ---------------------------------------------------------------------------
# run_full_pipeline
# ---------------------------------------------------------------------------

class TestRunFullPipeline:
    def _patch_all(self):
        """Context manager that patches all external dependencies."""
        return [
            patch("src.pipeline.FWFClient", return_value=_mock_client()),
            patch("src.pipeline.DatabaseLoader", return_value=_mock_loader()),
            patch("src.pipeline._step_projects", return_value=([], 0, None)),
            patch("src.pipeline._step_outputs", return_value=(0, None)),
            patch("src.pipeline._step_further_funding", return_value=None),
            patch("src.pipeline._step_institutions", return_value=None),
            patch("src.pipeline._step_metrics", return_value=None),
        ]

    def test_runs_all_steps_without_error(self):
        patches = self._patch_all()
        mocks = [p.start() for p in patches]
        try:
            run_full_pipeline()  # should not raise
        finally:
            for p in patches:
                p.stop()

    def test_continues_when_a_step_fails(self):
        """A failure in one step must not prevent subsequent steps from running."""
        step_metrics = MagicMock(return_value=None)
        patches = [
            patch("src.pipeline.FWFClient", return_value=_mock_client()),
            patch("src.pipeline.DatabaseLoader", return_value=_mock_loader()),
            patch("src.pipeline._step_projects", return_value=([], 0, "projects step error")),
            patch("src.pipeline._step_outputs", return_value=(0, None)),
            patch("src.pipeline._step_further_funding", return_value=None),
            patch("src.pipeline._step_institutions", return_value=None),
            patch("src.pipeline._step_metrics", step_metrics),
        ]
        for p in patches:
            p.start()
        try:
            run_full_pipeline()
            step_metrics.assert_called_once()
        finally:
            for p in patches:
                p.stop()

    def test_logs_sync_start_and_completion(self):
        mock_loader = _mock_loader()
        patches = [
            patch("src.pipeline.FWFClient", return_value=_mock_client()),
            patch("src.pipeline.DatabaseLoader", return_value=mock_loader),
            patch("src.pipeline._step_projects", return_value=([], 0, None)),
            patch("src.pipeline._step_outputs", return_value=(0, None)),
            patch("src.pipeline._step_further_funding", return_value=None),
            patch("src.pipeline._step_institutions", return_value=None),
            patch("src.pipeline._step_metrics", return_value=None),
        ]
        for p in patches:
            p.start()
        try:
            run_full_pipeline()
            assert mock_loader.log_sync.call_count >= 2
        finally:
            for p in patches:
                p.stop()


# ---------------------------------------------------------------------------
# run_metrics_only
# ---------------------------------------------------------------------------

class TestRunMetricsOnly:
    def test_calls_compute_all(self):
        mock_mc = MagicMock()
        mock_mc.__enter__ = MagicMock(return_value=mock_mc)
        mock_mc.__exit__ = MagicMock(return_value=False)

        with patch("src.pipeline.MetricComputer", return_value=mock_mc):
            run_metrics_only()

        mock_mc.compute_all.assert_called_once()

    def test_exits_on_failure(self):
        with patch("src.pipeline.MetricComputer") as MockMC:
            MockMC.return_value.__enter__.side_effect = RuntimeError("DB down")
            with pytest.raises(SystemExit):
                run_metrics_only()
