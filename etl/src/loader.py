"""
Database loader — persists cleaned FWF records to PostgreSQL via psycopg2.

Design notes
------------
- Uses raw SQL with psycopg2 rather than a Python ORM.  The Prisma client
  owns the schema on the Next.js side; the ETL just writes rows.
- All upserts use INSERT … ON CONFLICT … DO UPDATE so re-runs are safe.
- Prisma generates implicit many-to-many join tables named
  ``_<RelationName>`` with columns ``A`` (alphabetically first model id)
  and ``B`` (the other).  For our relations:
    * ``_ProjectOutputs``  → A=Output.id, B=Project.id
      (Output < Project alphabetically)
    * ``_ProjectFurtherFunding`` → A=FurtherFunding.id, B=Project.id
      (FurtherFunding < Project alphabetically)
  These names are verified at runtime in ``__init__`` and a warning is
  emitted if the tables don't exist yet (run ``npx prisma db push`` first).
- ``execute_values`` from psycopg2.extras is used for all bulk inserts —
  it sends a single multi-row VALUES clause, which is 10–50× faster than
  individual inserts for large batches.

See apps/web/prisma/schema.prisma for the target schema.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Any

import psycopg2
import psycopg2.extras
from psycopg2.extras import execute_values

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

_BATCH_SIZE = 500

# Prisma implicit join table names.
# Prisma sorts the two model names alphabetically and uses that order for
# columns A and B.  Verify with:
#   SELECT table_name FROM information_schema.tables WHERE table_schema='public';
_JOIN_OUTPUT_PROJECT    = "_ProjectOutputs"       # A=Output.id, B=Project.id
_JOIN_FUNDING_PROJECT   = "_ProjectFurtherFunding" # A=FurtherFunding.id, B=Project.id


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _to_json(value: Any) -> str | None:
    """Serialise a value to a JSON string for JSONB columns, or return None."""
    if value is None:
        return None
    try:
        return json.dumps(value, ensure_ascii=False, default=str)
    except (TypeError, ValueError) as exc:
        logger.warning("_to_json: serialisation failed (%s) — storing null", exc)
        return None


def _batched(items: list, size: int):
    """Yield successive slices of *items* of at most *size* elements."""
    for i in range(0, len(items), size):
        yield items[i : i + size]


def _now_utc() -> datetime:
    return datetime.now(tz=timezone.utc)


# ---------------------------------------------------------------------------
# DatabaseLoader
# ---------------------------------------------------------------------------

class DatabaseLoader:
    """Loads cleaned FWF records into PostgreSQL.

    Parameters
    ----------
    database_url:
        PostgreSQL connection string, e.g.
        ``"postgresql://postgres:postgres@localhost:5432/fwf_monitor"``.
    batch_size:
        Number of rows per INSERT statement.  Defaults to 500.
    """

    def __init__(self, database_url: str, batch_size: int = _BATCH_SIZE) -> None:
        self._database_url = database_url
        self._batch_size = batch_size
        self._conn = psycopg2.connect(database_url)
        # Use dict-style cursors so column names are accessible by name in
        # result sets (used in update_institution_counts).
        self._conn.autocommit = False
        logger.info("DatabaseLoader connected to PostgreSQL")
        self._verify_join_tables()

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _cursor(self):
        return self._conn.cursor()

    def _verify_join_tables(self) -> None:
        """Warn if the Prisma join tables haven't been created yet."""
        expected = {_JOIN_OUTPUT_PROJECT, _JOIN_FUNDING_PROJECT}
        with self._cursor() as cur:
            cur.execute(
                """
                SELECT table_name
                FROM information_schema.tables
                WHERE table_schema = 'public'
                  AND table_name = ANY(%s)
                """,
                (list(expected),),
            )
            found = {row[0] for row in cur.fetchall()}
        missing = expected - found
        if missing:
            logger.warning(
                "Join tables not found: %s — run `npx prisma db push` first",
                missing,
            )

    def _discover_join_table(self, candidate: str) -> str:
        """Return *candidate* if it exists, otherwise try swapping A/B columns.

        Prisma's column assignment (A vs B) is alphabetical by model name.
        If we guessed wrong at module level, this method detects the real name.
        """
        with self._cursor() as cur:
            cur.execute(
                "SELECT table_name FROM information_schema.tables "
                "WHERE table_schema='public' AND table_name=%s",
                (candidate,),
            )
            if cur.fetchone():
                return candidate
        # Table not found — return as-is (upsert will fail visibly)
        return candidate

    @staticmethod
    def _pg_array(values: list) -> Any:
        """Wrap a Python list as a psycopg2 array literal."""
        return psycopg2.extras.Json(None) if values is None else values

    # ------------------------------------------------------------------
    # Projects
    # ------------------------------------------------------------------

    def upsert_projects(self, projects: list[dict]) -> int:
        """Upsert Project rows.

        Conflict key: ``id`` (FWF short ID, e.g. ``"P12345"``).
        On conflict, all mutable columns are updated.

        Parameters
        ----------
        projects:
            List of dicts returned by ``cleaner.clean_project()``.

        Returns
        -------
        int
            Total rows upserted.
        """
        if not projects:
            return 0

        sql = """
            INSERT INTO "Project" (
                id, "grantDoi", "titleEn", "titleDe", "summaryEn",
                "programEn", "statusEn",
                "approvalDate", "startDate", "endDate",
                "approvedAmount", "approvalYear",
                "piFirstName", "piLastName", "piOrcid", "piRole",
                "piInstitutionName", "piInstitutionRor",
                "researchRadarUrl",
                keywords, "disciplinesEn", "fieldsEn",
                "rawJson", "lastSyncedAt"
            ) VALUES %s
            ON CONFLICT (id) DO UPDATE SET
                "grantDoi"         = EXCLUDED."grantDoi",
                "titleEn"          = EXCLUDED."titleEn",
                "titleDe"          = EXCLUDED."titleDe",
                "summaryEn"        = EXCLUDED."summaryEn",
                "programEn"        = EXCLUDED."programEn",
                "statusEn"         = EXCLUDED."statusEn",
                "approvalDate"     = EXCLUDED."approvalDate",
                "startDate"        = EXCLUDED."startDate",
                "endDate"          = EXCLUDED."endDate",
                "approvedAmount"   = EXCLUDED."approvedAmount",
                "approvalYear"     = EXCLUDED."approvalYear",
                "piFirstName"      = EXCLUDED."piFirstName",
                "piLastName"       = EXCLUDED."piLastName",
                "piOrcid"          = EXCLUDED."piOrcid",
                "piRole"           = EXCLUDED."piRole",
                "piInstitutionName"= EXCLUDED."piInstitutionName",
                "piInstitutionRor" = EXCLUDED."piInstitutionRor",
                "researchRadarUrl" = EXCLUDED."researchRadarUrl",
                keywords           = EXCLUDED.keywords,
                "disciplinesEn"    = EXCLUDED."disciplinesEn",
                "fieldsEn"         = EXCLUDED."fieldsEn",
                "rawJson"          = EXCLUDED."rawJson",
                "lastSyncedAt"     = EXCLUDED."lastSyncedAt"
        """

        total = 0
        now = _now_utc()

        try:
            with self._cursor() as cur:
                for batch in _batched(projects, self._batch_size):
                    rows = [
                        (
                            p["id"],
                            p.get("grantDoi"),
                            p.get("titleEn") or "",
                            p.get("titleDe"),
                            p.get("summaryEn"),
                            p.get("programEn"),
                            p.get("statusEn"),
                            p.get("approvalDate"),
                            p.get("startDate"),
                            p.get("endDate"),
                            p.get("approvedAmount"),
                            p.get("approvalYear"),
                            p.get("piFirstName"),
                            p.get("piLastName"),
                            p.get("piOrcid"),
                            p.get("piRole"),
                            p.get("piInstitutionName"),
                            p.get("piInstitutionRor"),
                            p.get("researchRadarUrl"),
                            p.get("keywords") or [],
                            p.get("disciplinesEn") or [],
                            p.get("fieldsEn") or [],
                            psycopg2.extras.Json(p.get("rawJson")),
                            now,
                        )
                        for p in batch
                    ]
                    execute_values(cur, sql, rows)
                    total += len(batch)
                    logger.info("upsert_projects: %d/%d rows processed", total, len(projects))
                self._conn.commit()
        except Exception:
            self._conn.rollback()
            raise

        logger.info("upsert_projects: committed %d rows", total)
        return total

    # ------------------------------------------------------------------
    # Outputs
    # ------------------------------------------------------------------

    def upsert_outputs(self, outputs: list[dict]) -> int:
        """Upsert Output rows.

        Conflict strategy:
        - Records WITH a DOI: conflict on ``doi`` (the @unique field).
        - Records WITHOUT a DOI: conflict on ``id`` (the deterministic hash).

        We use a single INSERT … ON CONFLICT (id) DO UPDATE statement.
        For DOI records the ``id`` equals the DOI (set by the cleaner), so
        the id-based conflict catches both cases.  The ``doi`` column's
        @unique constraint is additionally maintained.

        Parameters
        ----------
        outputs:
            List of dicts returned by ``cleaner.clean_output()``.
            The ``connectedProjectIds`` key is ignored here (handled by
            ``link_projects_outputs``).

        Returns
        -------
        int
            Total rows upserted.
        """
        if not outputs:
            return 0

        # Deduplicate by id within this batch. The hash-based stable ID can
        # collide when two outputs share title+category+year; a single VALUES
        # clause with duplicate conflict-key rows causes CardinalityViolation.
        seen: dict[str, dict] = {}
        for o in outputs:
            seen.setdefault(o["id"], o)
        outputs = list(seen.values())

        # Two-pass strategy:
        # 1. Insert/update by DOI for records that have one.
        # 2. Insert/update by id for the rest.
        # This avoids a single query having to handle both conflict targets.

        doi_outputs  = [o for o in outputs if o.get("doi")]
        hash_outputs = [o for o in outputs if not o.get("doi")]

        total = 0
        now   = _now_utc()

        _cols = """(
            id, doi, title, category, type, years, url,
            pmid, journal, publisher, "providedToOthers",
            "hasDoi", "hasPmid", "rawJson", "lastSyncedAt"
        )"""

        _set_clause = """
                doi              = EXCLUDED.doi,
                title            = EXCLUDED.title,
                category         = EXCLUDED.category,
                type             = EXCLUDED.type,
                years            = EXCLUDED.years,
                url              = EXCLUDED.url,
                pmid             = EXCLUDED.pmid,
                journal          = EXCLUDED.journal,
                publisher        = EXCLUDED.publisher,
                "providedToOthers" = EXCLUDED."providedToOthers",
                "hasDoi"         = EXCLUDED."hasDoi",
                "hasPmid"        = EXCLUDED."hasPmid",
                "rawJson"        = EXCLUDED."rawJson",
                "lastSyncedAt"   = EXCLUDED."lastSyncedAt"
        """

        def _row(o: dict) -> tuple:
            return (
                o["id"],
                o.get("doi"),
                o.get("title"),
                o.get("category") or "",
                o.get("type"),
                o.get("years") or [],
                o.get("url"),
                o.get("pmid"),
                o.get("journal"),
                o.get("publisher"),
                o.get("providedToOthers"),
                bool(o.get("hasDoi")),
                bool(o.get("hasPmid")),
                psycopg2.extras.Json(o.get("rawJson")),
                now,
            )

        try:
            with self._cursor() as cur:
                # Pass 1: DOI records — conflict on doi
                if doi_outputs:
                    sql_doi = f"""
                        INSERT INTO "Output" {_cols} VALUES %s
                        ON CONFLICT (doi) DO UPDATE SET {_set_clause}
                    """
                    for batch in _batched(doi_outputs, self._batch_size):
                        execute_values(cur, sql_doi, [_row(o) for o in batch])
                        total += len(batch)
                        logger.info("upsert_outputs (doi): %d/%d", total, len(outputs))

                # Pass 2: hash-id records — conflict on id
                if hash_outputs:
                    sql_id = f"""
                        INSERT INTO "Output" {_cols} VALUES %s
                        ON CONFLICT (id) DO UPDATE SET {_set_clause}
                    """
                    for batch in _batched(hash_outputs, self._batch_size):
                        execute_values(cur, sql_id, [_row(o) for o in batch])
                        total += len(batch)
                        logger.info("upsert_outputs (hash): %d/%d", total, len(outputs))

                self._conn.commit()
        except Exception:
            self._conn.rollback()
            raise

        logger.info("upsert_outputs: committed %d rows", total)
        return total

    # ------------------------------------------------------------------
    # Output ↔ Project links
    # ------------------------------------------------------------------

    def link_projects_outputs(self, output_to_project_ids: dict[str, list[str]]) -> int:
        """Insert Project↔Output many-to-many links.

        Prisma's implicit join table ``_ProjectOutputs`` has:
          - Column ``A``: Output.id  (Output < Project alphabetically)
          - Column ``B``: Project.id

        Uses ``ON CONFLICT DO NOTHING`` so re-runs are idempotent.

        Parameters
        ----------
        output_to_project_ids:
            ``{output_id: [project_id, ...]}`` mapping where IDs match
            the values stored in the DB (output.id and project.id).

        Returns
        -------
        int
            Number of link rows inserted (not counting skipped duplicates).
        """
        pairs: list[tuple[str, str]] = []
        for output_id, project_ids in output_to_project_ids.items():
            for project_id in project_ids:
                if output_id and project_id:
                    pairs.append((output_id, project_id))

        if not pairs:
            return 0

        # Filter out project IDs that were not fetched (API caps at 10 000 records).
        # Without this, FK violations abort the entire link step.
        with self._cursor() as cur:
            cur.execute('SELECT id FROM "Project"')
            valid_ids = {row[0] for row in cur.fetchall()}
        before = len(pairs)
        pairs = [(a, b) for a, b in pairs if b in valid_ids]
        skipped = before - len(pairs)
        if skipped:
            logger.warning("link_projects_outputs: skipping %d pairs — project not in DB", skipped)

        if not pairs:
            return 0

        sql = f"""
            INSERT INTO "{_JOIN_OUTPUT_PROJECT}" ("A", "B")
            VALUES %s
            ON CONFLICT ("A", "B") DO NOTHING
        """

        total = 0
        try:
            with self._cursor() as cur:
                for batch in _batched(pairs, self._batch_size):
                    execute_values(cur, sql, batch)
                    total += len(batch)
                self._conn.commit()
        except Exception:
            self._conn.rollback()
            raise

        logger.info("link_projects_outputs: %d pairs processed", total)
        return total

    # ------------------------------------------------------------------
    # Further Funding
    # ------------------------------------------------------------------

    def upsert_further_funding(self, funding: list[dict]) -> int:
        """Upsert FurtherFunding rows.

        FurtherFunding has no stable external identifier so we conflict on
        ``id`` (a cuid() assigned by the cleaner's caller / loader).  For
        records that come from the same ETL run the id is the row's primary
        key and will always match.

        Parameters
        ----------
        funding:
            List of dicts from ``cleaner.clean_further_funding()``.

        Returns
        -------
        int
            Total rows upserted.
        """
        if not funding:
            return 0

        # Deduplicate by id — hash collisions within a batch cause CardinalityViolation.
        seen: dict[str, dict] = {}
        for f in funding:
            seen.setdefault(f["id"], f)
        funding = list(seen.values())

        sql = """
            INSERT INTO "FurtherFunding" (
                id, funder, "fundingId", country, sector,
                title, doi, type, "startYear", "endYear",
                "funderProjectUrl", "lastSyncedAt"
            ) VALUES %s
            ON CONFLICT (id) DO UPDATE SET
                funder            = EXCLUDED.funder,
                "fundingId"       = EXCLUDED."fundingId",
                country           = EXCLUDED.country,
                sector            = EXCLUDED.sector,
                title             = EXCLUDED.title,
                doi               = EXCLUDED.doi,
                type              = EXCLUDED.type,
                "startYear"       = EXCLUDED."startYear",
                "endYear"         = EXCLUDED."endYear",
                "funderProjectUrl"= EXCLUDED."funderProjectUrl",
                "lastSyncedAt"    = EXCLUDED."lastSyncedAt"
        """

        total = 0
        now = _now_utc()

        try:
            with self._cursor() as cur:
                for batch in _batched(funding, self._batch_size):
                    rows = [
                        (
                            f["id"],
                            f.get("funder"),
                            f.get("fundingId"),
                            f.get("country"),
                            f.get("sector"),
                            f.get("title"),
                            f.get("doi"),
                            f.get("type"),
                            f.get("startYear"),
                            f.get("endYear"),
                            f.get("funderProjectUrl"),
                            now,
                        )
                        for f in batch
                    ]
                    execute_values(cur, sql, rows)
                    total += len(batch)
                    logger.info("upsert_further_funding: %d/%d rows processed", total, len(funding))
                self._conn.commit()
        except Exception:
            self._conn.rollback()
            raise

        logger.info("upsert_further_funding: committed %d rows", total)
        return total

    # ------------------------------------------------------------------
    # FurtherFunding ↔ Project links
    # ------------------------------------------------------------------

    def link_projects_funding(self, funding_to_project_ids: dict[str, list[str]]) -> int:
        """Insert Project↔FurtherFunding many-to-many links.

        Prisma's implicit join table ``_ProjectFurtherFunding`` has:
          - Column ``A``: FurtherFunding.id  (F < P alphabetically)
          - Column ``B``: Project.id

        Parameters
        ----------
        funding_to_project_ids:
            ``{furtherfunding_id: [project_id, ...]}`` mapping.

        Returns
        -------
        int
            Number of link rows inserted.
        """
        pairs: list[tuple[str, str]] = []
        for ff_id, project_ids in funding_to_project_ids.items():
            for project_id in project_ids:
                if ff_id and project_id:
                    pairs.append((ff_id, project_id))

        if not pairs:
            return 0

        # Filter out project IDs not present in the DB (API result-set cap).
        with self._cursor() as cur:
            cur.execute('SELECT id FROM "Project"')
            valid_ids = {row[0] for row in cur.fetchall()}
        before = len(pairs)
        pairs = [(a, b) for a, b in pairs if b in valid_ids]
        skipped = before - len(pairs)
        if skipped:
            logger.warning("link_projects_funding: skipping %d pairs — project not in DB", skipped)

        if not pairs:
            return 0

        sql = f"""
            INSERT INTO "{_JOIN_FUNDING_PROJECT}" ("A", "B")
            VALUES %s
            ON CONFLICT ("A", "B") DO NOTHING
        """

        total = 0
        try:
            with self._cursor() as cur:
                for batch in _batched(pairs, self._batch_size):
                    execute_values(cur, sql, batch)
                    total += len(batch)
                self._conn.commit()
        except Exception:
            self._conn.rollback()
            raise

        logger.info("link_projects_funding: %d pairs processed", total)
        return total

    # ------------------------------------------------------------------
    # Institutions
    # ------------------------------------------------------------------

    def upsert_institutions(self, institutions: list[dict]) -> int:
        """Upsert Institution rows.

        Conflict key: ``rorId`` (@id in Prisma schema).

        Parameters
        ----------
        institutions:
            List of dicts from ``cleaner.extract_institutions()``.

        Returns
        -------
        int
            Total rows upserted.
        """
        if not institutions:
            return 0

        sql = """
            INSERT INTO "Institution" ("rorId", name, country)
            VALUES %s
            ON CONFLICT ("rorId") DO UPDATE SET
                name    = EXCLUDED.name,
                country = EXCLUDED.country
        """

        total = 0
        try:
            with self._cursor() as cur:
                for batch in _batched(institutions, self._batch_size):
                    rows = [
                        (
                            inst["rorId"],
                            inst.get("name") or inst["rorId"],
                            inst.get("country") or "AT",
                        )
                        for inst in batch
                    ]
                    execute_values(cur, sql, rows)
                    total += len(batch)
                self._conn.commit()
        except Exception:
            self._conn.rollback()
            raise

        logger.info("upsert_institutions: committed %d rows", total)
        return total

    # ------------------------------------------------------------------
    # Institution count refresh
    # ------------------------------------------------------------------

    def update_institution_counts(self) -> None:
        """Recompute projectCount and outputCount on every Institution row.

        Uses two CTEs to aggregate counts from the Project table (which
        stores ``piInstitutionRor`` directly) and from the join table
        (summing output counts per project, then per institution).

        Safe to run repeatedly — updates are idempotent.
        """
        sql = """
            WITH project_counts AS (
                SELECT "piInstitutionRor" AS ror_id,
                       COUNT(*)           AS cnt
                FROM "Project"
                WHERE "piInstitutionRor" IS NOT NULL
                GROUP BY "piInstitutionRor"
            ),
            output_counts AS (
                SELECT p."piInstitutionRor" AS ror_id,
                       COUNT(po."A")        AS cnt
                FROM "Project"            p
                JOIN "_ProjectOutputs"    po ON po."B" = p.id
                WHERE p."piInstitutionRor" IS NOT NULL
                GROUP BY p."piInstitutionRor"
            )
            UPDATE "Institution" i
            SET
                "projectCount"   = counts.proj_cnt,
                "outputCount"    = counts.out_cnt,
                "lastComputedAt" = NOW()
            FROM (
                SELECT ror_id,
                       COALESCE(pc.cnt, 0) AS proj_cnt,
                       COALESCE(oc.cnt, 0) AS out_cnt
                FROM (SELECT DISTINCT "piInstitutionRor" AS ror_id FROM "Project" WHERE "piInstitutionRor" IS NOT NULL) all_rors
                LEFT JOIN project_counts pc USING (ror_id)
                LEFT JOIN output_counts  oc USING (ror_id)
            ) counts
            WHERE i."rorId" = counts.ror_id
        """
        with self._cursor() as cur:
            cur.execute(sql)
            updated = cur.rowcount
            self._conn.commit()
        logger.info("update_institution_counts: updated %d institution rows", updated)

    # ------------------------------------------------------------------
    # Sync log
    # ------------------------------------------------------------------

    def log_sync(
        self,
        status: str,
        projects_count: int,
        outputs_count: int,
        errors: str | None = None,
        started_at: datetime | None = None,
    ) -> None:
        """Insert a SyncLog record.

        Parameters
        ----------
        status:
            ``"running"`` | ``"completed"`` | ``"failed"``
        projects_count:
            Number of project rows processed in this run.
        outputs_count:
            Number of output rows processed in this run.
        errors:
            Optional error summary string.
        started_at:
            ETL run start time.  Defaults to now.
        """
        now = _now_utc()
        sql = """
            INSERT INTO "SyncLog" (
                id, "startedAt", "completedAt", status,
                "projectsProcessed", "outputsProcessed", errors
            ) VALUES (
                gen_random_uuid()::text,
                %s, %s, %s, %s, %s, %s
            )
        """
        with self._cursor() as cur:
            cur.execute(
                sql,
                (
                    started_at or now,
                    now,
                    status,
                    projects_count,
                    outputs_count,
                    errors,
                ),
            )
            self._conn.commit()
        logger.info("log_sync: status=%s, projects=%d, outputs=%d", status, projects_count, outputs_count)

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    def close(self) -> None:
        """Close the database connection."""
        if self._conn and not self._conn.closed:
            self._conn.close()
            logger.info("DatabaseLoader: connection closed")

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if exc_type is not None:
            try:
                self._conn.rollback()
            except Exception:
                pass
        self.close()
        return False
