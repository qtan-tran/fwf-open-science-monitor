"""
Tests for etl/src/fetcher.py

Run with:
    cd etl
    python -m pytest tests/test_fetcher.py -v

All Meilisearch network calls are mocked — no live API key required.
"""

from __future__ import annotations

import os
import unittest
from unittest.mock import MagicMock, call, patch

from meilisearch.errors import MeilisearchApiError


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_search_result(hits: list[dict], estimated_total: int | None = None) -> dict:
    """Build a dict that looks like a Meilisearch search response."""
    return {
        "hits": hits,
        "estimatedTotalHits": estimated_total,
        "offset": 0,
        "limit": len(hits),
    }


def _make_doc(i: int) -> dict:
    return {"id": f"projects-{i}", "_str": {"grantdoi": f"10.55776/P{i}"}}


# ---------------------------------------------------------------------------
# Unit tests
# ---------------------------------------------------------------------------

class TestFWFClientInit(unittest.TestCase):
    """FWFClient.__init__ validation."""

    @patch("meilisearch.Client")
    def test_empty_key_raises(self, _mock_client):
        from src.fetcher import FWFClient
        with self.assertRaises(ValueError, msg="Should raise for empty key"):
            FWFClient("https://openapi.fwf.ac.at", "")

    @patch("meilisearch.Client")
    def test_whitespace_key_raises(self, _mock_client):
        from src.fetcher import FWFClient
        with self.assertRaises(ValueError):
            FWFClient("https://openapi.fwf.ac.at", "   ")

    @patch("meilisearch.Client")
    def test_valid_key_constructs(self, mock_client_cls):
        from src.fetcher import FWFClient
        client = FWFClient("https://openapi.fwf.ac.at", "valid-key")
        self.assertIsNotNone(client)
        mock_client_cls.assert_called_once_with("https://openapi.fwf.ac.at", "valid-key")

    @patch("meilisearch.Client")
    def test_trailing_slash_stripped_from_url(self, mock_client_cls):
        from src.fetcher import FWFClient
        FWFClient("https://openapi.fwf.ac.at/", "key")
        args, _ = mock_client_cls.call_args
        self.assertFalse(args[0].endswith("/"), "Trailing slash should be stripped")


class TestFetchAllDocuments(unittest.TestCase):
    """fetch_all_documents pagination and stopping behaviour."""

    @patch("time.sleep")
    def test_stops_on_partial_batch(self, mock_sleep):
        """Should stop after the first batch when it contains fewer docs than batch_size."""
        from src.fetcher import FWFClient

        docs_batch1 = [_make_doc(i) for i in range(3)]  # 3 < batch_size=5 → last page

        with patch("meilisearch.Client") as mock_cls:
            mock_ms = MagicMock()
            mock_cls.return_value = mock_ms
            mock_index = MagicMock()
            mock_ms.index.return_value = mock_index
            mock_index.search.return_value = _make_search_result(docs_batch1)

            client = FWFClient("https://openapi.fwf.ac.at", "key")
            result = client.fetch_all_documents("projects", batch_size=5)

        self.assertEqual(len(result), 3)
        # Only one search call should have been made.
        mock_index.search.assert_called_once()

    @patch("time.sleep")
    def test_stops_on_empty_batch(self, mock_sleep):
        """Should stop immediately when the first batch is empty."""
        from src.fetcher import FWFClient

        with patch("meilisearch.Client") as mock_cls:
            mock_ms = MagicMock()
            mock_cls.return_value = mock_ms
            mock_index = MagicMock()
            mock_ms.index.return_value = mock_index
            mock_index.search.return_value = _make_search_result([])

            client = FWFClient("https://openapi.fwf.ac.at", "key")
            result = client.fetch_all_documents("projects", batch_size=5)

        self.assertEqual(result, [])
        mock_index.search.assert_called_once()

    @patch("time.sleep")
    def test_multiple_pages_concatenated(self, mock_sleep):
        """Documents from multiple full batches should all be returned."""
        from src.fetcher import FWFClient

        batch1 = [_make_doc(i) for i in range(5)]
        batch2 = [_make_doc(i) for i in range(5, 10)]
        batch3 = [_make_doc(i) for i in range(10, 13)]  # partial → last page

        with patch("meilisearch.Client") as mock_cls:
            mock_ms = MagicMock()
            mock_cls.return_value = mock_ms
            mock_index = MagicMock()
            mock_ms.index.return_value = mock_index
            mock_index.search.side_effect = [
                _make_search_result(batch1),
                _make_search_result(batch2),
                _make_search_result(batch3),
            ]

            client = FWFClient("https://openapi.fwf.ac.at", "key")
            result = client.fetch_all_documents("projects", batch_size=5)

        self.assertEqual(len(result), 13)
        self.assertEqual(mock_index.search.call_count, 3)

    @patch("time.sleep")
    def test_offsets_incremented_correctly(self, mock_sleep):
        """Each successive call should advance the offset by batch_size."""
        from src.fetcher import FWFClient

        batch_size = 4
        batch1 = [_make_doc(i) for i in range(batch_size)]
        batch2 = [_make_doc(i) for i in range(batch_size, batch_size + 2)]  # partial

        with patch("meilisearch.Client") as mock_cls:
            mock_ms = MagicMock()
            mock_cls.return_value = mock_ms
            mock_index = MagicMock()
            mock_ms.index.return_value = mock_index
            mock_index.search.side_effect = [
                _make_search_result(batch1),
                _make_search_result(batch2),
            ]

            client = FWFClient("https://openapi.fwf.ac.at", "key")
            client.fetch_all_documents("projects", batch_size=batch_size)

        calls = mock_index.search.call_args_list
        self.assertEqual(calls[0], call("", {"limit": batch_size, "offset": 0}))
        self.assertEqual(calls[1], call("", {"limit": batch_size, "offset": batch_size}))

    @patch("time.sleep")
    def test_sleep_between_full_batches(self, mock_sleep):
        """A 0.5 s sleep should be inserted after each full batch (not after the last)."""
        from src.fetcher import FWFClient

        batch_size = 2
        batch1 = [_make_doc(0), _make_doc(1)]   # full
        batch2 = [_make_doc(2)]                  # partial → last page

        with patch("meilisearch.Client") as mock_cls:
            mock_ms = MagicMock()
            mock_cls.return_value = mock_ms
            mock_index = MagicMock()
            mock_ms.index.return_value = mock_index
            mock_index.search.side_effect = [
                _make_search_result(batch1),
                _make_search_result(batch2),
            ]

            client = FWFClient("https://openapi.fwf.ac.at", "key")
            client.fetch_all_documents("projects", batch_size=batch_size)

        # sleep(0.5) once after the first full batch; NOT after the partial last batch.
        mock_sleep.assert_called_once_with(0.5)


class TestRetryLogic(unittest.TestCase):
    """_with_retry: exponential back-off on transient failures."""

    @patch("time.sleep")
    def test_retries_on_api_error_then_succeeds(self, mock_sleep):
        """Should retry up to _MAX_RETRIES times and succeed on eventual success."""
        from src.fetcher import FWFClient, _MAX_RETRIES

        good_result = _make_search_result([_make_doc(0)])
        api_error = MeilisearchApiError("timeout", MagicMock(status_code=503, text=""))

        with patch("meilisearch.Client") as mock_cls:
            mock_ms = MagicMock()
            mock_cls.return_value = mock_ms
            mock_index = MagicMock()
            mock_ms.index.return_value = mock_index
            # Fail twice, then succeed.
            mock_index.search.side_effect = [api_error, api_error, good_result]

            client = FWFClient("https://openapi.fwf.ac.at", "key")
            result = client.fetch_all_documents("projects", batch_size=1000)

        self.assertEqual(len(result), 1)
        self.assertEqual(mock_index.search.call_count, 3)

    @patch("time.sleep")
    def test_retries_on_connection_error_then_succeeds(self, mock_sleep):
        """ConnectionError should also trigger retry logic."""
        from src.fetcher import FWFClient

        good_result = _make_search_result([_make_doc(0)])

        with patch("meilisearch.Client") as mock_cls:
            mock_ms = MagicMock()
            mock_cls.return_value = mock_ms
            mock_index = MagicMock()
            mock_ms.index.return_value = mock_index
            mock_index.search.side_effect = [ConnectionError("network down"), good_result]

            client = FWFClient("https://openapi.fwf.ac.at", "key")
            result = client.fetch_all_documents("projects", batch_size=1000)

        self.assertEqual(len(result), 1)

    @patch("time.sleep")
    def test_raises_after_max_retries_exhausted(self, mock_sleep):
        """Should re-raise the exception once all retry attempts are used up."""
        from src.fetcher import FWFClient, _MAX_RETRIES

        api_error = MeilisearchApiError("bad gateway", MagicMock(status_code=502, text=""))

        with patch("meilisearch.Client") as mock_cls:
            mock_ms = MagicMock()
            mock_cls.return_value = mock_ms
            mock_index = MagicMock()
            mock_ms.index.return_value = mock_index
            mock_index.search.side_effect = api_error  # always fails

            client = FWFClient("https://openapi.fwf.ac.at", "key")
            with self.assertRaises(MeilisearchApiError):
                client.fetch_all_documents("projects", batch_size=1000)

        # Initial attempt + _MAX_RETRIES retries = _MAX_RETRIES + 1 total calls.
        self.assertEqual(mock_index.search.call_count, _MAX_RETRIES + 1)

    @patch("time.sleep")
    def test_backoff_delays_are_exponential(self, mock_sleep):
        """Delay between retries should be 1s, 2s, 4s (base * 2**attempt)."""
        from src.fetcher import FWFClient, _BACKOFF_BASE

        api_error = MeilisearchApiError("err", MagicMock(status_code=503, text=""))
        good_result = _make_search_result([_make_doc(0)])

        with patch("meilisearch.Client") as mock_cls:
            mock_ms = MagicMock()
            mock_cls.return_value = mock_ms
            mock_index = MagicMock()
            mock_ms.index.return_value = mock_index
            # Fail 3 times (all retries), then succeed.
            mock_index.search.side_effect = [
                api_error, api_error, api_error, good_result
            ]

            client = FWFClient("https://openapi.fwf.ac.at", "key")
            client.fetch_all_documents("projects", batch_size=1000)

        # time.sleep is called for the inter-retry delays only (not the 0.5 s
        # politeness delay — the result is a single-doc batch so no full-page
        # sleep fires).  Delays should be 1.0, 2.0, 4.0.
        delay_calls = [c.args[0] for c in mock_sleep.call_args_list]
        expected = [_BACKOFF_BASE * (2 ** i) for i in range(3)]
        self.assertEqual(delay_calls, expected)


class TestSearch(unittest.TestCase):
    """search() method."""

    @patch("time.sleep")
    def test_returns_hits(self, _mock_sleep):
        from src.fetcher import FWFClient

        docs = [_make_doc(i) for i in range(3)]

        with patch("meilisearch.Client") as mock_cls:
            mock_ms = MagicMock()
            mock_cls.return_value = mock_ms
            mock_index = MagicMock()
            mock_ms.index.return_value = mock_index
            mock_index.search.return_value = _make_search_result(docs, estimated_total=3)

            client = FWFClient("https://openapi.fwf.ac.at", "key")
            result = client.search("projects", "Medizinische Universität Wien", limit=5)

        self.assertEqual(result, docs)
        mock_index.search.assert_called_once_with(
            "Medizinische Universität Wien", {"limit": 5}
        )

    @patch("time.sleep")
    def test_empty_result(self, _mock_sleep):
        from src.fetcher import FWFClient

        with patch("meilisearch.Client") as mock_cls:
            mock_ms = MagicMock()
            mock_cls.return_value = mock_ms
            mock_index = MagicMock()
            mock_ms.index.return_value = mock_index
            mock_index.search.return_value = _make_search_result([])

            client = FWFClient("https://openapi.fwf.ac.at", "key")
            result = client.search("projects", "no match here")

        self.assertEqual(result, [])


class TestMultiSearch(unittest.TestCase):
    """multi_search() method."""

    def test_returns_results_list(self):
        from src.fetcher import FWFClient

        fake_results = [
            {"indexUid": "output", "hits": [_make_doc(0)]},
            {"indexUid": "further-funding", "hits": []},
        ]

        with patch("meilisearch.Client") as mock_cls:
            mock_ms = MagicMock()
            mock_cls.return_value = mock_ms
            mock_ms.multi_search.return_value = {"results": fake_results}

            client = FWFClient("https://openapi.fwf.ac.at", "key")
            queries = [
                {"indexUid": "output", "q": "projects-123"},
                {"indexUid": "further-funding", "q": "projects-123"},
            ]
            result = client.multi_search(queries)

        self.assertEqual(result, fake_results)
        mock_ms.multi_search.assert_called_once_with(queries)

    @patch("time.sleep")
    def test_retries_on_connection_error(self, mock_sleep):
        from src.fetcher import FWFClient

        fake_results = [{"indexUid": "output", "hits": []}]

        with patch("meilisearch.Client") as mock_cls:
            mock_ms = MagicMock()
            mock_cls.return_value = mock_ms
            mock_ms.multi_search.side_effect = [
                ConnectionError("transient"),
                {"results": fake_results},
            ]

            client = FWFClient("https://openapi.fwf.ac.at", "key")
            result = client.multi_search([{"indexUid": "output", "q": "x"}])

        self.assertEqual(result, fake_results)
        self.assertEqual(mock_ms.multi_search.call_count, 2)


class TestConvenienceMethods(unittest.TestCase):
    """fetch_all_projects / fetch_all_outputs / fetch_all_further_funding."""

    @patch("time.sleep")
    def test_convenience_wrappers_use_correct_index(self, _mock_sleep):
        from src.fetcher import (
            FWFClient,
            INDEX_FURTHER_FUNDING,
            INDEX_OUTPUT,
            INDEX_PROJECTS,
        )

        with patch("meilisearch.Client") as mock_cls:
            mock_ms = MagicMock()
            mock_cls.return_value = mock_ms
            mock_index = MagicMock()
            mock_ms.index.return_value = mock_index
            mock_index.search.return_value = _make_search_result([])

            client = FWFClient("https://openapi.fwf.ac.at", "key")

            client.fetch_all_projects()
            client.fetch_all_outputs()
            client.fetch_all_further_funding()

        index_calls = [c.args[0] for c in mock_ms.index.call_args_list]
        self.assertIn(INDEX_PROJECTS, index_calls)
        self.assertIn(INDEX_OUTPUT, index_calls)
        self.assertIn(INDEX_FURTHER_FUNDING, index_calls)


class TestGetIndexStats(unittest.TestCase):
    """get_index_stats() method."""

    def test_returns_stats_for_known_indices(self):
        from src.fetcher import FWFClient

        mock_idx_projects = MagicMock()
        mock_idx_projects.uid = "projects"
        mock_idx_projects.updated_at = "2026-04-02T03:00:00Z"

        mock_idx_output = MagicMock()
        mock_idx_output.uid = "output"
        mock_idx_output.updated_at = "2026-04-02T03:01:00Z"

        mock_idx_ff = MagicMock()
        mock_idx_ff.uid = "further-funding"
        mock_idx_ff.updated_at = "2026-04-02T03:02:00Z"

        mock_stats = MagicMock()
        mock_stats.number_of_documents = 999

        with patch("meilisearch.Client") as mock_cls:
            mock_ms = MagicMock()
            mock_cls.return_value = mock_ms
            mock_ms.get_indexes.return_value = MagicMock(
                results=[mock_idx_projects, mock_idx_output, mock_idx_ff]
            )
            mock_index = MagicMock()
            mock_ms.index.return_value = mock_index
            mock_index.get_stats.return_value = mock_stats

            client = FWFClient("https://openapi.fwf.ac.at", "key")
            stats = client.get_index_stats()

        self.assertIn("projects", stats)
        self.assertIn("output", stats)
        self.assertIn("further-funding", stats)
        self.assertEqual(stats["projects"]["numberOfDocuments"], 999)
        self.assertEqual(stats["projects"]["updatedAt"], "2026-04-02T03:00:00Z")

    def test_unknown_indices_excluded(self):
        from src.fetcher import FWFClient

        mock_idx_unknown = MagicMock()
        mock_idx_unknown.uid = "some-other-index"
        mock_idx_unknown.updated_at = None

        with patch("meilisearch.Client") as mock_cls:
            mock_ms = MagicMock()
            mock_cls.return_value = mock_ms
            mock_ms.get_indexes.return_value = MagicMock(results=[mock_idx_unknown])

            client = FWFClient("https://openapi.fwf.ac.at", "key")
            stats = client.get_index_stats()

        self.assertEqual(stats, {}, "Unknown indices should be excluded from stats")


if __name__ == "__main__":
    unittest.main()
