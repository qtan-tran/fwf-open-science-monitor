"""
FWF Open Science Monitor ETL pipeline orchestrator.

Usage
-----
Full pipeline (fetch + load + metrics):
    python -m src.pipeline                  # from inside etl/
    python -m etl.src.pipeline              # from repo root

Metrics only (no API fetch):
    python -m src.pipeline --metrics-only
    python -m etl.src.pipeline --metrics-only

Pipeline steps
--------------
1. Initialise FWF client and DB loader; log sync start to SyncLog.
2. Fetch projects → clean → upsert.
3. Fetch outputs  → clean → upsert → link to projects.
4. Fetch further-funding → clean → assign stable IDs → upsert → link.
5. Extract institutions from project data → upsert → update counts.
6. Compute and store all MetricSnapshot rows via MetricComputer.
7. Log sync completion (or failure) to SyncLog.

Resilience
----------
Steps 2–6 each catch their own exceptions and add them to an error list.
A failure in one step never stops the pipeline — subsequent steps run with
whatever data was loaded successfully.  The final SyncLog status is
"completed" if there were no errors, "failed" otherwise.
"""

from __future__ import annotations

import argparse
import hashlib
import logging
import sys
from datetime import datetime, timezone

from .config import FWF_API_URL, FWF_API_KEY, DATABASE_URL
from .fetcher import FWFClient
from .cleaner import clean_project, clean_output, clean_further_funding, extract_institutions
from .loader import DatabaseLoader
from .metrics import MetricComputer

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger(__name__)

_SEP = "-" * 72


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _now() -> datetime:
    return datetime.now(tz=timezone.utc)


def _elapsed(start: datetime) -> str:
    return f"{(_now() - start).total_seconds():.1f}s"


def _ff_stable_id(ff: dict) -> str:
    """Deterministic ID for a further-funding record.

    further-funding has no stable external key, so we hash the combination
    of funder name, funder-assigned ID, and year range to produce a
    reproducible cuid-like string across daily uploads.
    """
    fingerprint = "|".join([
        (ff.get("funder") or "").strip().lower(),
        (ff.get("fundingId") or "").strip().lower(),
        str(ff.get("startYear") or ""),
        str(ff.get("endYear") or ""),
    ])
    return "ff-" + hashlib.sha256(fingerprint.encode()).hexdigest()[:24]


# ---------------------------------------------------------------------------
# Pipeline steps (each returns a step-level error string or None)
# ---------------------------------------------------------------------------

def _step_projects(client: FWFClient, loader: DatabaseLoader) -> tuple[list[dict], int, str | None]:
    """Fetch, clean, and upsert all projects.

    Returns
    -------
    clean_projects:
        Cleaned project dicts (needed later for institution extraction).
    count:
        Number of rows upserted.
    error:
        Error string if the step failed, else None.
    """
    logger.info("%s", _SEP)
    logger.info("STEP 2: Fetching projects")
    start = _now()
    try:
        raw = client.fetch_all_projects()
        logger.info("STEP 2: Fetched %d raw projects (%s)", len(raw), _elapsed(start))

        cleaned = [clean_project(p) for p in raw]
        count = loader.upsert_projects(cleaned)
        logger.info("STEP 2: Upserted %d projects (%s)", count, _elapsed(start))
        return cleaned, count, None
    except Exception as exc:
        msg = f"STEP 2 (projects) failed: {exc}"
        logger.error(msg, exc_info=True)
        return [], 0, msg


def _step_outputs(client: FWFClient, loader: DatabaseLoader) -> tuple[int, str | None]:
    """Fetch, clean, upsert, and link all outputs.

    Returns
    -------
    count:
        Number of output rows upserted.
    error:
        Error string if the step failed, else None.
    """
    logger.info("%s", _SEP)
    logger.info("STEP 3: Fetching outputs")
    start = _now()
    try:
        raw = client.fetch_all_outputs()
        logger.info("STEP 3: Fetched %d raw outputs (%s)", len(raw), _elapsed(start))

        cleaned = [clean_output(o) for o in raw]
        count = loader.upsert_outputs(cleaned)
        logger.info("STEP 3: Upserted %d outputs (%s)", count, _elapsed(start))

        output_to_projects = {
            o["id"]: o["connectedProjectIds"]
            for o in cleaned
            if o.get("connectedProjectIds")
        }
        links = loader.link_projects_outputs(output_to_projects)
        logger.info("STEP 3: Linked %d output→project pairs (%s)", links, _elapsed(start))
        return count, None
    except Exception as exc:
        msg = f"STEP 3 (outputs) failed: {exc}"
        logger.error(msg, exc_info=True)
        return 0, msg


def _step_further_funding(client: FWFClient, loader: DatabaseLoader) -> str | None:
    """Fetch, clean, upsert, and link all further-funding records.

    Returns
    -------
    error:
        Error string if the step failed, else None.
    """
    logger.info("%s", _SEP)
    logger.info("STEP 4: Fetching further funding")
    start = _now()
    try:
        raw = client.fetch_all_further_funding()
        logger.info("STEP 4: Fetched %d raw further-funding records (%s)", len(raw), _elapsed(start))

        cleaned = [clean_further_funding(f) for f in raw]
        # further-funding has no stable external identifier — assign a
        # deterministic hash ID so upserts are idempotent across daily runs.
        for ff in cleaned:
            ff["id"] = _ff_stable_id(ff)

        loader.upsert_further_funding(cleaned)
        logger.info("STEP 4: Upserted %d further-funding records (%s)", len(cleaned), _elapsed(start))

        ff_to_projects = {
            ff["id"]: ff["connectedProjectIds"]
            for ff in cleaned
            if ff.get("connectedProjectIds")
        }
        links = loader.link_projects_funding(ff_to_projects)
        logger.info("STEP 4: Linked %d further-funding→project pairs (%s)", links, _elapsed(start))
        return None
    except Exception as exc:
        msg = f"STEP 4 (further-funding) failed: {exc}"
        logger.error(msg, exc_info=True)
        return msg


def _step_institutions(loader: DatabaseLoader, clean_projects: list[dict]) -> str | None:
    """Extract institutions from project data, upsert, and refresh counts.

    Returns
    -------
    error:
        Error string if the step failed, else None.
    """
    logger.info("%s", _SEP)
    logger.info("STEP 5: Extracting and upserting institutions")
    start = _now()
    try:
        institutions = extract_institutions(clean_projects)
        logger.info("STEP 5: Extracted %d unique institutions", len(institutions))

        loader.upsert_institutions(institutions)
        loader.update_institution_counts()
        logger.info("STEP 5: Institutions upserted and counts refreshed (%s)", _elapsed(start))
        return None
    except Exception as exc:
        msg = f"STEP 5 (institutions) failed: {exc}"
        logger.error(msg, exc_info=True)
        return msg


def _step_metrics() -> str | None:
    """Compute and store all MetricSnapshot rows.

    Returns
    -------
    error:
        Error string if the step failed, else None.
    """
    logger.info("%s", _SEP)
    logger.info("STEP 6: Computing metrics")
    start = _now()
    try:
        with MetricComputer(DATABASE_URL) as mc:
            mc.compute_all()
        logger.info("STEP 6: All metrics computed (%s)", _elapsed(start))
        return None
    except Exception as exc:
        msg = f"STEP 6 (metrics) failed: {exc}"
        logger.error(msg, exc_info=True)
        return msg


# ---------------------------------------------------------------------------
# Public entry points
# ---------------------------------------------------------------------------

def run_full_pipeline() -> None:
    """Execute the complete ETL pipeline: fetch → load → metrics."""
    pipeline_start = _now()
    logger.info("%s", _SEP)
    logger.info("FWF ETL pipeline starting at %s", pipeline_start.isoformat())
    logger.info("%s", _SEP)

    errors: list[str] = []
    projects_count = 0
    outputs_count = 0
    sync_started_at = _now()

    # Step 1: Initialise clients
    logger.info("%s", _SEP)
    logger.info("STEP 1: Initialising FWF client and database loader")
    try:
        client = FWFClient(FWF_API_URL, FWF_API_KEY)
        loader = DatabaseLoader(DATABASE_URL)
    except Exception as exc:
        logger.error("STEP 1 FAILED — cannot continue: %s", exc, exc_info=True)
        # DB might not be reachable at all — just exit rather than hiding the error
        raise

    try:
        loader.log_sync(
            status="running",
            projects_count=0,
            outputs_count=0,
            started_at=sync_started_at,
        )
        logger.info("STEP 1: Sync start logged to SyncLog")
    except Exception as exc:
        logger.warning("STEP 1: Could not write sync-start log: %s", exc)

    # Steps 2–6
    clean_projects, projects_count, err = _step_projects(client, loader)
    if err:
        errors.append(err)

    outputs_count, err = _step_outputs(client, loader)
    if err:
        errors.append(err)

    err = _step_further_funding(client, loader)
    if err:
        errors.append(err)

    err = _step_institutions(loader, clean_projects)
    if err:
        errors.append(err)

    err = _step_metrics()
    if err:
        errors.append(err)

    # Step 7: Log completion
    elapsed = _elapsed(pipeline_start)
    status = "completed" if not errors else "failed"
    error_str = "; ".join(errors) if errors else None

    try:
        loader.log_sync(
            status=status,
            projects_count=projects_count,
            outputs_count=outputs_count,
            errors=error_str,
            started_at=sync_started_at,
        )
    except Exception as exc:
        logger.warning("Could not write sync-completion log: %s", exc)

    loader.close()

    logger.info("%s", _SEP)
    logger.info(
        "Pipeline %s — %d projects, %d outputs in %s",
        status.upper(), projects_count, outputs_count, elapsed,
    )
    if errors:
        logger.warning("%d step(s) had errors:", len(errors))
        for err in errors:
            logger.warning("  • %s", err)
    logger.info("%s", _SEP)


def run_metrics_only() -> None:
    """Re-compute all MetricSnapshot rows without re-fetching data from the API."""
    start = _now()
    logger.info("Metrics-only mode: recomputing all metrics")
    try:
        with MetricComputer(DATABASE_URL) as mc:
            mc.compute_all()
        logger.info("Metrics recomputed in %s", _elapsed(start))
    except Exception as exc:
        logger.error("Metrics computation failed: %s", exc, exc_info=True)
        sys.exit(1)


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------

def _parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="FWF Open Science Monitor ETL",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=(
            "Examples:\n"
            "  python -m src.pipeline                 # full pipeline\n"
            "  python -m src.pipeline --metrics-only  # metrics only\n"
        ),
    )
    parser.add_argument(
        "--metrics-only",
        action="store_true",
        help="Only recompute metrics from existing DB data; skip API fetch.",
    )
    return parser.parse_args(argv)


if __name__ == "__main__":
    args = _parse_args()
    if args.metrics_only:
        run_metrics_only()
    else:
        run_full_pipeline()
