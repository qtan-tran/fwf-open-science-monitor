"""
FWF API client — fetches raw data from the FWF Open Data API.

The FWF Open API is backed by Meilisearch.  Key constraints:
  - No server-side filtering or faceting — all data must be fetched in full
    and aggregated in application code.
  - Output and further-funding record IDs are NOT stable across daily uploads.
  - Authentication via Bearer token (FWF_API_KEY).

See docs/api-field-reference.md for full field documentation.
"""

from __future__ import annotations

import logging
import time
from typing import Any

import meilisearch
from meilisearch.errors import MeilisearchApiError

logger = logging.getLogger(__name__)

# Indices exposed by the FWF Open API.
INDEX_PROJECTS = "projects"
INDEX_OUTPUT = "output"
INDEX_FURTHER_FUNDING = "further-funding"

_ALL_INDICES = (INDEX_PROJECTS, INDEX_OUTPUT, INDEX_FURTHER_FUNDING)

# Retry configuration.
_MAX_RETRIES = 3
_BACKOFF_BASE = 1.0  # seconds; delay = _BACKOFF_BASE * 2 ** attempt


def _extract_hits(result: Any) -> list[dict]:
    """Return the hits list from a Meilisearch search result.

    The SDK may return either a plain dict or a SearchResults object
    depending on version; this handles both.
    """
    if isinstance(result, dict):
        return result.get("hits", [])
    return list(getattr(result, "hits", []) or [])


def _extract_estimated_total(result: Any) -> int | None:
    """Return estimatedTotalHits from a search result, or None."""
    if isinstance(result, dict):
        return result.get("estimatedTotalHits")
    return getattr(result, "estimated_total_hits", None)


class FWFClient:
    """Client for the FWF Open API (Meilisearch-based).

    Parameters
    ----------
    api_url:
        Base URL of the FWF Open API, e.g. ``"https://openapi.fwf.ac.at"``.
    api_key:
        Bearer token obtained from ``https://openapi.fwf.ac.at/fwfkey``.

    Raises
    ------
    ValueError
        If *api_key* is empty or obviously invalid (checked eagerly so callers
        get a clear error rather than a cryptic 401 buried in a retry loop).
    """

    def __init__(self, api_url: str, api_key: str) -> None:
        if not api_key or not api_key.strip():
            raise ValueError(
                "api_key must not be empty. "
                "Obtain a key from https://openapi.fwf.ac.at/fwfkey "
                "and set FWF_API_KEY in your .env file."
            )
        self._client = meilisearch.Client(api_url.rstrip("/"), api_key)
        logger.info("FWFClient initialised — endpoint: %s", api_url)

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _with_retry(self, operation_name: str, fn, *args, **kwargs) -> Any:
        """Execute *fn* with up to _MAX_RETRIES retries on transient errors.

        Retried exceptions:
          - ``MeilisearchApiError`` (covers HTTP 5xx and timeout responses)
          - ``ConnectionError`` (network-level failures)

        Raises the last exception if all attempts are exhausted.
        """
        last_exc: Exception | None = None
        for attempt in range(_MAX_RETRIES + 1):
            try:
                return fn(*args, **kwargs)
            except (MeilisearchApiError, ConnectionError) as exc:
                last_exc = exc
                if attempt == _MAX_RETRIES:
                    logger.error(
                        "%s failed after %d attempts: %s",
                        operation_name,
                        _MAX_RETRIES + 1,
                        exc,
                    )
                    raise
                delay = _BACKOFF_BASE * (2 ** attempt)
                logger.warning(
                    "%s — attempt %d/%d failed (%s). Retrying in %.1fs…",
                    operation_name,
                    attempt + 1,
                    _MAX_RETRIES + 1,
                    exc,
                    delay,
                )
                time.sleep(delay)

        raise RuntimeError("Unreachable")  # pragma: no cover

    def _search_once(self, index_name: str, query: str, params: dict) -> Any:
        """Single search call, wrapped for retry."""
        index = self._client.index(index_name)
        return self._with_retry(
            f"search({index_name!r}, {query!r})",
            index.search,
            query,
            params,
        )

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def fetch_all_documents(
        self,
        index_name: str,
        batch_size: int = 1000,
    ) -> list[dict]:
        """Fetch ALL documents from *index_name* via offset/limit pagination.

        Algorithm
        ---------
        Starts at offset=0 and increments by *batch_size* after each
        successful batch.  Stops when a batch returns fewer documents than
        *batch_size* (signals the last page).

        A 0.5 s courtesy delay is inserted between batches to avoid
        hammering the API.

        Parameters
        ----------
        index_name:
            One of ``"projects"``, ``"output"``, or ``"further-funding"``.
        batch_size:
            Documents per request.  The FWF API appears to cap results at
            1 000 per call; do not exceed this value.

        Returns
        -------
        list[dict]
            All documents from the index, in the order returned by the API.
        """
        documents: list[dict] = []
        offset = 0

        logger.info("Starting full fetch of index %r (batch_size=%d)", index_name, batch_size)

        while True:
            params = {"limit": batch_size, "offset": offset}
            result = self._search_once(index_name, "", params)
            batch = _extract_hits(result)

            if not batch:
                logger.info(
                    "Index %r — empty batch at offset=%d; fetch complete.",
                    index_name,
                    offset,
                )
                break

            documents.extend(batch)
            logger.info(
                "Fetched %d %s (offset=%d, total so far: %d)",
                len(batch),
                index_name,
                offset,
                len(documents),
            )

            if len(batch) < batch_size:
                # Last page — no need for another round-trip.
                logger.info(
                    "Index %r — partial batch (%d < %d); fetch complete.",
                    index_name,
                    len(batch),
                    batch_size,
                )
                break

            offset += batch_size
            time.sleep(0.5)

        logger.info(
            "Completed fetch of index %r — %d documents total.",
            index_name,
            len(documents),
        )
        return documents

    def search(
        self,
        index_name: str,
        query: str,
        limit: int = 1000,
    ) -> list[dict]:
        """Search *index_name* for *query* and return up to *limit* hits.

        Note: the FWF API has no server-side filtering; this is a full-text
        search only.  For bulk data retrieval use :meth:`fetch_all_documents`.

        Parameters
        ----------
        index_name:
            Target index name.
        query:
            Full-text search string.
        limit:
            Maximum results to return (API cap: 1 000).
        """
        result = self._search_once(index_name, query, {"limit": limit})
        hits = _extract_hits(result)
        estimated = _extract_estimated_total(result)
        logger.info(
            "search(%r, %r) → %d hits returned (estimated total: %s)",
            index_name,
            query,
            len(hits),
            estimated,
        )
        return hits

    def multi_search(self, queries: list[dict]) -> list[dict]:
        """Execute a multi-search across one or more indices.

        Parameters
        ----------
        queries:
            List of query dicts, each containing at minimum
            ``{"indexUid": str, "q": str}``.  Additional Meilisearch search
            parameters (``limit``, ``offset``, etc.) are passed through.

        Returns
        -------
        list[dict]
            One result object per query, in the same order as *queries*.
            Each result object has the same shape as a single search response.
        """
        def _do_multi_search():
            return self._client.multi_search(queries)

        raw = self._with_retry("multi_search", _do_multi_search)

        if isinstance(raw, dict):
            results = raw.get("results", [])
        else:
            results = list(getattr(raw, "results", []) or [])

        logger.info("multi_search — %d queries, %d result sets", len(queries), len(results))
        return results

    def fetch_all_projects(self) -> list[dict]:
        """Convenience wrapper: fetch all documents from the ``projects`` index."""
        return self.fetch_all_documents(INDEX_PROJECTS)

    def fetch_all_outputs(self) -> list[dict]:
        """Convenience wrapper: fetch all documents from the ``output`` index."""
        return self.fetch_all_documents(INDEX_OUTPUT)

    def fetch_all_further_funding(self) -> list[dict]:
        """Convenience wrapper: fetch all documents from the ``further-funding`` index."""
        return self.fetch_all_documents(INDEX_FURTHER_FUNDING)

    def get_index_stats(self) -> dict[str, dict]:
        """Return document counts and last-update timestamps for all indices.

        Returns
        -------
        dict
            Keys are index names; values are dicts with ``"numberOfDocuments"``
            and ``"updatedAt"`` entries.

        Example
        -------
        ::

            {
                "projects": {"numberOfDocuments": 12540, "updatedAt": "2026-04-02T03:00:00Z"},
                "output":   {"numberOfDocuments": 87231, "updatedAt": "2026-04-02T03:00:00Z"},
                ...
            }
        """
        def _do_get_indexes():
            return self._client.get_indexes()

        raw = self._with_retry("get_indexes", _do_get_indexes)

        if isinstance(raw, dict):
            index_list = raw.get("results", [])
        else:
            index_list = list(getattr(raw, "results", []) or [])

        stats: dict[str, dict] = {}
        for idx in index_list:
            uid = getattr(idx, "uid", None) or (idx.get("uid") if isinstance(idx, dict) else None)
            if uid not in _ALL_INDICES:
                continue

            # Fetch per-index stats (numberOfDocuments).
            def _get_stats(u=uid):
                return self._client.index(u).get_stats()

            index_stats = self._with_retry(f"get_stats({uid!r})", _get_stats)

            if isinstance(index_stats, dict):
                num_docs = index_stats.get("numberOfDocuments")
            else:
                num_docs = getattr(index_stats, "number_of_documents", None)

            updated_at = (
                getattr(idx, "updated_at", None)
                or (idx.get("updatedAt") if isinstance(idx, dict) else None)
            )

            stats[uid] = {
                "numberOfDocuments": num_docs,
                "updatedAt": str(updated_at) if updated_at is not None else None,
            }

        logger.info("get_index_stats → %s", stats)
        return stats
