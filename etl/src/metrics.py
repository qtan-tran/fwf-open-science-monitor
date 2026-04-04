"""
Derived metric computation — queries the database and stores results in MetricSnapshot.

Design notes
------------
- Uses raw psycopg2 (no ORM) consistent with loader.py.
- All SQL uses GROUP BY aggregates; Python does only rate arithmetic.
- _store_metric uses DELETE + INSERT with IS NOT DISTINCT FROM for NULL-safe
  idempotency, because PostgreSQL's unique index treats NULLs as distinct values,
  so ON CONFLICT (metricKey, year, rorId) cannot match rows where year or rorId
  is NULL.
- Each compute_* method commits once after storing all rows for that metric type.
- For output_count_by_category_year the category is encoded into the metricKey
  (e.g. "output_count_by_category_year:publications") because the MetricSnapshot
  unique constraint is (metricKey, year, rorId) — two rows for different categories
  in the same year would both have rorId=NULL and would otherwise conflict.

See apps/web/prisma/schema.prisma for the target schema.
See docs/api-field-reference.md for metric definitions.
"""

from __future__ import annotations

import logging

import psycopg2
import psycopg2.extras

logger = logging.getLogger(__name__)


class MetricComputer:
    """Computes open-science metrics from the FWF database and writes to MetricSnapshot.

    Parameters
    ----------
    database_url:
        PostgreSQL connection string, e.g.
        ``"postgresql://postgres:postgres@localhost:5432/fwf_monitor"``.
    """

    def __init__(self, database_url: str) -> None:
        self._conn = psycopg2.connect(database_url)
        self._conn.autocommit = False
        logger.info("MetricComputer: connected to PostgreSQL")

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def compute_all(self) -> None:
        """Run all metric computations and store results in MetricSnapshot."""
        self.compute_yearly_project_counts()
        self.compute_yearly_oa_rates()
        self.compute_yearly_output_counts_by_category()
        self.compute_institutional_rankings()
        self.compute_funding_efficiency()
        self.compute_open_data_rates()
        self.compute_open_software_rates()
        self.compute_summary_stats()

    # ------------------------------------------------------------------
    # Metric computations
    # ------------------------------------------------------------------

    def compute_yearly_project_counts(self) -> None:
        """MetricKey: 'project_count_by_year'

        For each approval year, count projects.  Rows without an approvalYear
        are skipped (approvalYear is a denormalised Int? derived from approvalDate).
        """
        sql = """
            SELECT "approvalYear", COUNT(*) AS cnt
            FROM "Project"
            WHERE "approvalYear" IS NOT NULL
            GROUP BY "approvalYear"
            ORDER BY "approvalYear"
        """
        with self._conn.cursor() as cur:
            cur.execute(sql)
            rows = cur.fetchall()

        logger.info("compute_yearly_project_counts: %d year buckets", len(rows))
        for year, cnt in rows:
            self._store_metric("project_count_by_year", year, float(cnt))
        self._conn.commit()

    def compute_yearly_oa_rates(self) -> None:
        """MetricKey: 'oa_publication_rate_by_year'

        For each project approval year:
        - denominator = publication outputs linked to projects approved that year
        - numerator   = those with hasDoi=true OR hasPmid=true
        - rate        = numerator / denominator * 100

        Projects or outputs lacking a year are excluded.
        """
        sql = """
            SELECT
                p."approvalYear",
                COUNT(o.id)                                                  AS total_pubs,
                COUNT(o.id) FILTER (WHERE o."hasDoi" OR o."hasPmid")         AS oa_pubs
            FROM "Project" p
            JOIN "_ProjectOutputs" po ON po."B" = p.id
            JOIN "Output"          o  ON o.id   = po."A"
            WHERE p."approvalYear" IS NOT NULL
              AND o.category = 'publications'
            GROUP BY p."approvalYear"
            ORDER BY p."approvalYear"
        """
        with self._conn.cursor() as cur:
            cur.execute(sql)
            rows = cur.fetchall()

        logger.info("compute_yearly_oa_rates: %d year buckets", len(rows))
        for year, total, oa in rows:
            rate = (oa / total * 100.0) if total > 0 else 0.0
            self._store_metric(
                "oa_publication_rate_by_year",
                year,
                rate,
                metadata={"total_publications": int(total), "oa_publications": int(oa)},
            )
        self._conn.commit()

    def compute_yearly_output_counts_by_category(self) -> None:
        """MetricKey: 'output_count_by_category_year:<category>'

        Groups outputs by category and minimum publication year.  The category
        is appended to the metricKey because the MetricSnapshot unique constraint
        is (metricKey, year, rorId) — without encoding the category into the key
        two rows for different categories in the same year would collide.

        Outputs with no years array are skipped.
        """
        sql = """
            WITH output_min_year AS (
                SELECT id,
                       category,
                       (SELECT MIN(y) FROM unnest(years) AS y) AS min_year
                FROM "Output"
                WHERE array_length(years, 1) > 0
            )
            SELECT category, min_year, COUNT(*) AS cnt
            FROM output_min_year
            WHERE min_year IS NOT NULL
            GROUP BY category, min_year
            ORDER BY category, min_year
        """
        with self._conn.cursor() as cur:
            cur.execute(sql)
            rows = cur.fetchall()

        logger.info(
            "compute_yearly_output_counts_by_category: %d (category, year) buckets",
            len(rows),
        )
        for category, year, cnt in rows:
            metric_key = f"output_count_by_category_year:{category}"
            self._store_metric(
                metric_key,
                year,
                float(cnt),
                metadata={"category": category},
            )
        self._conn.commit()

    def compute_institutional_rankings(self) -> None:
        """MetricKey: 'institution_project_count'

        For each PI institution (identified by piInstitutionRor):
        - value    = project count
        - metadata = output count, publication OA rate, publication count

        Institutions without a ROR are excluded.
        """
        sql = """
            SELECT
                p."piInstitutionRor",
                COUNT(DISTINCT p.id)                                              AS project_count,
                COUNT(po."A")                                                     AS output_count,
                COUNT(po."A") FILTER (WHERE o.category = 'publications')          AS pub_count,
                COUNT(po."A") FILTER (
                    WHERE o.category = 'publications' AND (o."hasDoi" OR o."hasPmid")
                )                                                                  AS oa_pub_count
            FROM "Project" p
            LEFT JOIN "_ProjectOutputs" po ON po."B" = p.id
            LEFT JOIN "Output"          o  ON o.id   = po."A"
            WHERE p."piInstitutionRor" IS NOT NULL
            GROUP BY p."piInstitutionRor"
            ORDER BY COUNT(DISTINCT p.id) DESC
        """
        with self._conn.cursor() as cur:
            cur.execute(sql)
            rows = cur.fetchall()

        logger.info("compute_institutional_rankings: %d institutions", len(rows))
        for ror_id, project_count, output_count, pub_count, oa_pub_count in rows:
            oa_rate = (oa_pub_count / pub_count * 100.0) if pub_count > 0 else 0.0
            self._store_metric(
                "institution_project_count",
                None,
                float(project_count),
                ror_id=ror_id,
                metadata={
                    "output_count": int(output_count),
                    "publication_count": int(pub_count),
                    "oa_publication_rate": round(oa_rate, 2),
                },
            )
        self._conn.commit()

    def compute_funding_efficiency(self) -> None:
        """MetricKey: 'funding_efficiency_by_year'

        For projects with approvedAmount (2012 onwards):
        - value    = average approved amount in EUR
        - metadata = total funding, project count, avg outputs per project,
                     avg funding per output (EUR/output)

        Pre-2012 projects are excluded because approvedAmount is absent for them.
        """
        sql = """
            WITH project_output_counts AS (
                SELECT po."B" AS project_id, COUNT(*) AS output_cnt
                FROM "_ProjectOutputs" po
                GROUP BY po."B"
            )
            SELECT
                p."approvalYear",
                AVG(p."approvedAmount")::float                          AS avg_amount,
                SUM(p."approvedAmount")::float                          AS total_funding,
                COUNT(p.id)                                              AS project_count,
                AVG(COALESCE(poc.output_cnt, 0))::float                 AS avg_outputs,
                CASE
                    WHEN SUM(COALESCE(poc.output_cnt, 0)) > 0
                    THEN SUM(p."approvedAmount")::float
                         / SUM(COALESCE(poc.output_cnt, 0))
                    ELSE NULL
                END                                                      AS funding_per_output
            FROM "Project" p
            LEFT JOIN project_output_counts poc ON poc.project_id = p.id
            WHERE p."approvalYear" IS NOT NULL
              AND p."approvedAmount" IS NOT NULL
              AND p."approvalYear" >= 2012
            GROUP BY p."approvalYear"
            ORDER BY p."approvalYear"
        """
        with self._conn.cursor() as cur:
            cur.execute(sql)
            rows = cur.fetchall()

        logger.info("compute_funding_efficiency: %d year buckets", len(rows))
        for year, avg_amount, total_funding, project_count, avg_outputs, funding_per_output in rows:
            self._store_metric(
                "funding_efficiency_by_year",
                year,
                float(avg_amount or 0.0),
                metadata={
                    "total_funding": float(total_funding or 0.0),
                    "project_count": int(project_count),
                    "avg_outputs_per_project": round(float(avg_outputs or 0.0), 2),
                    "avg_funding_per_output": (
                        round(float(funding_per_output), 2)
                        if funding_per_output is not None
                        else None
                    ),
                },
            )
        self._conn.commit()

    def compute_open_data_rates(self) -> None:
        """MetricKey: 'open_data_rate_by_year'

        For outputs in category 'research data and analysis techniques':
        - denominator = total outputs that year
        - numerator   = those with providedToOthers=true
        - rate        = numerator / denominator * 100
        """
        sql = """
            WITH output_min_year AS (
                SELECT id,
                       "providedToOthers",
                       (SELECT MIN(y) FROM unnest(years) AS y) AS min_year
                FROM "Output"
                WHERE category = 'research data and analysis techniques'
                  AND array_length(years, 1) > 0
            )
            SELECT
                min_year,
                COUNT(*)                                              AS total,
                COUNT(*) FILTER (WHERE "providedToOthers" = true)     AS provided
            FROM output_min_year
            WHERE min_year IS NOT NULL
            GROUP BY min_year
            ORDER BY min_year
        """
        with self._conn.cursor() as cur:
            cur.execute(sql)
            rows = cur.fetchall()

        logger.info("compute_open_data_rates: %d year buckets", len(rows))
        for year, total, provided in rows:
            rate = (provided / total * 100.0) if total > 0 else 0.0
            self._store_metric(
                "open_data_rate_by_year",
                year,
                rate,
                metadata={"total": int(total), "provided_to_others": int(provided)},
            )
        self._conn.commit()

    def compute_open_software_rates(self) -> None:
        """MetricKey: 'open_software_rate_by_year'

        For outputs in category 'software and technical products':
        - denominator = total outputs that year
        - numerator   = those with hasDoi=true (DOI as proxy for a citable release)
        - rate        = numerator / denominator * 100
        """
        sql = """
            WITH output_min_year AS (
                SELECT id,
                       "hasDoi",
                       (SELECT MIN(y) FROM unnest(years) AS y) AS min_year
                FROM "Output"
                WHERE category = 'software and technical products'
                  AND array_length(years, 1) > 0
            )
            SELECT
                min_year,
                COUNT(*)                                       AS total,
                COUNT(*) FILTER (WHERE "hasDoi" = true)        AS with_doi
            FROM output_min_year
            WHERE min_year IS NOT NULL
            GROUP BY min_year
            ORDER BY min_year
        """
        with self._conn.cursor() as cur:
            cur.execute(sql)
            rows = cur.fetchall()

        logger.info("compute_open_software_rates: %d year buckets", len(rows))
        for year, total, with_doi in rows:
            rate = (with_doi / total * 100.0) if total > 0 else 0.0
            self._store_metric(
                "open_software_rate_by_year",
                year,
                rate,
                metadata={"total": int(total), "with_doi": int(with_doi)},
            )
        self._conn.commit()

    def compute_summary_stats(self) -> None:
        """MetricKey: 'summary'

        Single row (year=NULL, rorId=NULL) with overall totals:
        total projects, total outputs, total institutions, overall OA rate,
        and the year range covered by the data.
        """
        sql = """
            SELECT
                (SELECT COUNT(*) FROM "Project")                               AS total_projects,
                (SELECT COUNT(*) FROM "Output")                                AS total_outputs,
                (SELECT COUNT(*) FROM "Institution")                           AS total_institutions,
                (SELECT MIN("approvalYear")
                   FROM "Project"
                  WHERE "approvalYear" IS NOT NULL)                            AS min_year,
                (SELECT MAX("approvalYear")
                   FROM "Project"
                  WHERE "approvalYear" IS NOT NULL)                            AS max_year,
                (
                    SELECT CASE
                        WHEN COUNT(*) FILTER (WHERE category = 'publications') > 0
                        THEN ROUND(
                            COUNT(*) FILTER (
                                WHERE category = 'publications'
                                  AND ("hasDoi" OR "hasPmid")
                            )::numeric
                            / COUNT(*) FILTER (WHERE category = 'publications')::numeric
                            * 100,
                            2
                        )
                        ELSE 0
                    END
                    FROM "Output"
                )                                                              AS overall_oa_rate
        """
        with self._conn.cursor() as cur:
            cur.execute(sql)
            row = cur.fetchone()

        if row is None:
            logger.warning("compute_summary_stats: query returned no rows")
            return

        total_projects, total_outputs, total_institutions, min_year, max_year, overall_oa_rate = row
        logger.info(
            "compute_summary_stats: projects=%s outputs=%s institutions=%s oa_rate=%s",
            total_projects, total_outputs, total_institutions, overall_oa_rate,
        )
        self._store_metric(
            "summary",
            None,
            float(total_projects or 0),
            metadata={
                "total_projects": int(total_projects or 0),
                "total_outputs": int(total_outputs or 0),
                "total_institutions": int(total_institutions or 0),
                "overall_oa_rate": float(overall_oa_rate or 0),
                "year_range": [min_year, max_year],
            },
        )
        self._conn.commit()

    # ------------------------------------------------------------------
    # Storage helper
    # ------------------------------------------------------------------

    def _store_metric(
        self,
        metric_key: str,
        year: int | None,
        value: float,
        ror_id: str | None = None,
        metadata: dict | None = None,
    ) -> None:
        """Upsert one row into MetricSnapshot.

        Uses DELETE + INSERT rather than ON CONFLICT because PostgreSQL unique
        indexes treat NULL as distinct from every other NULL, which means
        ON CONFLICT never fires when year or rorId is NULL.

        IS NOT DISTINCT FROM provides NULL-safe equality for the DELETE
        predicate, making re-runs fully idempotent.

        Does **not** commit — the caller is responsible for committing after
        all rows for a given metric type have been stored.
        """
        delete_sql = """
            DELETE FROM "MetricSnapshot"
            WHERE "metricKey" = %s
              AND ("year"  IS NOT DISTINCT FROM %s)
              AND ("rorId" IS NOT DISTINCT FROM %s)
        """
        insert_sql = """
            INSERT INTO "MetricSnapshot"
                (id, "metricKey", year, "rorId", value, metadata, "computedAt")
            VALUES (gen_random_uuid()::text, %s, %s, %s, %s, %s, NOW())
        """
        with self._conn.cursor() as cur:
            cur.execute(delete_sql, (metric_key, year, ror_id))
            cur.execute(
                insert_sql,
                (metric_key, year, ror_id, value, psycopg2.extras.Json(metadata)),
            )

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    def close(self) -> None:
        """Close the database connection."""
        if self._conn and not self._conn.closed:
            self._conn.close()
            logger.info("MetricComputer: connection closed")

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
