"""
Data normalization — transforms raw FWF API documents into clean dicts that
match the Prisma schema field names exactly.

Each public function accepts a single raw document (as returned by the
Meilisearch API) and returns a plain dict ready for DB insertion.  No
function raises on missing or null fields.

Field name conventions
----------------------
- Raw API uses snake_case paths like ``_str.principalinvestigator.orcid``
- Clean output uses camelCase matching the Prisma model fields exactly
- Array fields default to [] rather than None (Prisma requires this for
  PostgreSQL array columns)

See docs/api-field-reference.md for the full field reference.
See apps/web/prisma/schema.prisma for the target schema.
"""

from __future__ import annotations

import hashlib
import logging
import re
from datetime import datetime, timezone
from typing import Any

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Date formats observed in the FWF API
# ---------------------------------------------------------------------------
_DATE_FORMATS = [
    "%Y-%m-%dT%H:%M:%S.%fZ",   # 2023-06-15T00:00:00.000Z
    "%Y-%m-%dT%H:%M:%SZ",      # 2023-06-15T00:00:00Z
    "%Y-%m-%dT%H:%M:%S",       # 2023-06-15T00:00:00
    "%Y-%m-%d",                 # 2023-06-15
    "%d.%m.%Y",                 # 15.06.2023  (European short format)
    "%Y",                       # 2023        (year-only fallback)
]

# Bare ORCID: 4 groups of 4 digits, last group may end with X
_ORCID_BARE_RE = re.compile(r"^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$")
# Full ORCID URL
_ORCID_URL_PREFIX = "https://orcid.org/"

# ROR canonical form starts with this prefix
_ROR_URL_PREFIX = "https://ror.org/"


# ---------------------------------------------------------------------------
# Utilities
# ---------------------------------------------------------------------------

def safe_get(d: dict, path: str, default: Any = None) -> Any:
    """Return the value at *path* from *d*.

    The FWF API returns flat dicts with dotted keys (e.g. ``{"_str.category": "publications"}``).
    This function tries the full dotted string as a flat key first, then falls back to
    navigating nested dicts — so it works correctly with both API response shapes.

    Examples
    --------
    >>> safe_get({"_str.grantdoi": "10.55776/P1"}, "_str.grantdoi")
    '10.55776/P1'
    >>> safe_get({"_str": {"grantdoi": "10.55776/P1"}}, "_str.grantdoi")
    '10.55776/P1'
    >>> safe_get({}, "_str.missing.field")  # no KeyError
    None
    """
    # Fast path: flat dotted key (matches the actual FWF API response format)
    if isinstance(d, dict) and path in d:
        return d[path]
    # Fallback: navigate nested dicts segment by segment
    node: Any = d
    for key in path.split("."):
        if not isinstance(node, dict):
            return default
        node = node.get(key)
        if node is None:
            return default
    return node


def _str_or_none(value: Any) -> str | None:
    """Return stripped string or None for falsy/non-string values."""
    if value is None:
        return None
    s = str(value).strip()
    return s if s else None


def _list_of_strings(value: Any) -> list[str]:
    """Coerce *value* to a list of non-empty stripped strings."""
    if not isinstance(value, list):
        return []
    result = []
    for item in value:
        if isinstance(item, str):
            s = item.strip()
            if s:
                result.append(s)
        elif item is not None:
            result.append(str(item))
    return result


def _list_of_ints(value: Any) -> list[int]:
    """Coerce *value* to a list of ints, silently dropping non-numeric items."""
    if not isinstance(value, list):
        return []
    result = []
    for item in value:
        try:
            result.append(int(item))
        except (TypeError, ValueError):
            pass
    return result


def parse_fwf_date(date_str: str | None) -> datetime | None:
    """Parse a date string from the FWF API into a timezone-aware datetime.

    Tries each format in ``_DATE_FORMATS`` in order.  Returns None if
    *date_str* is None, empty, or does not match any known format.

    All returned datetimes are UTC-aware.
    """
    if not date_str:
        return None
    date_str = date_str.strip()
    for fmt in _DATE_FORMATS:
        try:
            dt = datetime.strptime(date_str, fmt)
            return dt.replace(tzinfo=timezone.utc)
        except ValueError:
            continue
    logger.warning("parse_fwf_date: unrecognised date format %r", date_str)
    return None


def _validate_orcid(raw_orcid: str | None) -> str | None:
    """Return the bare ORCID (XXXX-XXXX-XXXX-XXXX) if valid, else None.

    Accepts both bare IDs and full ``https://orcid.org/`` URLs.
    Validates the 4×4 digit pattern (last position may be X).
    """
    if not raw_orcid:
        return None
    value = raw_orcid.strip()
    if value.startswith(_ORCID_URL_PREFIX):
        value = value[len(_ORCID_URL_PREFIX):]
    if _ORCID_BARE_RE.match(value):
        return value
    logger.debug("_validate_orcid: invalid ORCID %r — stored as None", raw_orcid)
    return None


def _normalise_ror(raw_ror: str | None) -> str | None:
    """Return the ROR value as-is if non-empty, normalising to bare ID form.

    The API may return either the full URL (``https://ror.org/04wxnsj81``) or
    a bare ID (``04wxnsj81``).  We store the full URL for consistency with the
    ROR canonical form, so bare IDs are prefixed.
    """
    if not raw_ror:
        return None
    value = raw_ror.strip()
    if not value:
        return None
    if value.startswith(_ROR_URL_PREFIX):
        return value
    # Bare ID — prefix it.
    return _ROR_URL_PREFIX + value


def _extract_fwf_id_from_project_id(raw_id: str | None) -> str | None:
    """Strip the ``'project-'`` prefix from a Meilisearch project document ID.

    The FWF API uses ``project-<ID>`` as the document id (e.g. ``"project-DOC32"``).

    >>> _extract_fwf_id_from_project_id("project-DOC32")
    'DOC32'
    """
    if not raw_id:
        return None
    prefix = "project-"
    if raw_id.startswith(prefix):
        return raw_id[len(prefix):]
    return raw_id  # unexpected format — return as-is rather than losing it


def _strip_projects_prefix(project_ref: str) -> str:
    """Strip the ``'project.'`` prefix from an output's connected-project reference.

    Output documents reference their linked projects as ``'project.<ID>'``
    (e.g. ``"project.DOC32"``), while project document IDs use a hyphen
    (``"project-DOC32"``).  Stripping the ``'project.'`` prefix from the
    reference yields the bare FWF ID that matches the stored ``Project.id``.
    """
    prefix = "project."
    return project_ref[len(prefix):] if project_ref.startswith(prefix) else project_ref


def _stable_output_id(doi: str | None, title: str | None, category: str | None, years: list[int]) -> str:
    """Generate a deterministic ID for an output record that has no DOI.

    Hashes title + category + first year so that the same logical output
    produces the same ID across daily uploads, enabling upsert deduplication.
    """
    year_str = str(years[0]) if years else ""
    fingerprint = "|".join([
        (title or "").strip().lower(),
        (category or "").strip().lower(),
        year_str,
    ])
    return "hash-" + hashlib.sha256(fingerprint.encode()).hexdigest()[:24]


# ---------------------------------------------------------------------------
# Public cleaning functions
# ---------------------------------------------------------------------------

def clean_project(raw: dict) -> dict:
    """Transform a raw ``projects`` index document into a clean dict.

    The returned dict uses camelCase keys matching the Prisma ``Project``
    model exactly.  Required fields that are missing in the raw document
    fall back to sensible defaults (empty string for ``titleEn``).

    Connected output/further-funding arrays are NOT included — those
    relationships are resolved at load time via the raw doc's IDs.
    """
    approval_date = parse_fwf_date(safe_get(raw, "_date.approvaldate"))
    approval_year = approval_date.year if approval_date is not None else None

    raw_amount = safe_get(raw, "_long.approvedamount")
    approved_amount: int | None
    try:
        approved_amount = int(raw_amount) if raw_amount is not None else None
    except (TypeError, ValueError):
        approved_amount = None

    # Keywords: the API stores them as a list of strings under _list.keywords.split
    raw_keywords = safe_get(raw, "_list.keywords.split") or []
    keywords = _list_of_strings(raw_keywords)

    # Disciplines / fields: may be plain strings or objects with a 'name' key
    def _extract_name_list(value: Any) -> list[str]:
        if not isinstance(value, list):
            return []
        names: list[str] = []
        for item in value:
            if isinstance(item, str):
                s = item.strip()
                if s:
                    names.append(s)
            elif isinstance(item, dict):
                name = _str_or_none(item.get("name") or item.get("en"))
                if name:
                    names.append(name)
        return names

    disciplines = _extract_name_list(safe_get(raw, "_list.researchdisciplines.en"))
    fields_en   = _extract_name_list(safe_get(raw, "_list.researchfields.en"))

    fwf_id = _extract_fwf_id_from_project_id(raw.get("id"))

    return {
        "id":                fwf_id or "",
        "grantDoi":          _str_or_none(safe_get(raw, "_str.grantdoi")),
        "titleEn":           _str_or_none(safe_get(raw, "_str.projecttitle.en")) or "",
        "titleDe":           _str_or_none(safe_get(raw, "_str.projecttitle.de")),
        "summaryEn":         _str_or_none(safe_get(raw, "_str.prproposalsummary.en")),
        "programEn":         _str_or_none(safe_get(raw, "_str.program.en")),
        "statusEn":          _str_or_none(safe_get(raw, "_str.status.en")),
        "approvalDate":      approval_date,
        "startDate":         parse_fwf_date(safe_get(raw, "_date.startdate")),
        "endDate":           parse_fwf_date(safe_get(raw, "_date.enddate")),
        "approvedAmount":    approved_amount,
        "approvalYear":      approval_year,
        "piFirstName":       _str_or_none(safe_get(raw, "_str.principalinvestigator.firstname")),
        "piLastName":        _str_or_none(safe_get(raw, "_str.principalinvestigator.lastname")),
        "piOrcid":           _validate_orcid(safe_get(raw, "_str.principalinvestigator.orcid")),
        "piRole":            _str_or_none(safe_get(raw, "_str.principalinvestigator.role")),
        "piInstitutionName": _str_or_none(safe_get(raw, "_str.principalinvestigator.researchinstitute.name")),
        "piInstitutionRor":  _normalise_ror(safe_get(raw, "_str.principalinvestigator.researchinstitute.ror")),
        "researchRadarUrl":  _str_or_none(safe_get(raw, "_str.url")),
        "keywords":          keywords,
        "disciplinesEn":     disciplines,
        "fieldsEn":          fields_en,
        "rawJson":           raw,
    }


def clean_output(raw: dict) -> dict:
    """Transform a raw ``output`` index document into a clean dict.

    The returned dict uses camelCase keys matching the Prisma ``Output``
    model.  An extra ``"connectedProjectIds"`` key (list of bare FWF IDs)
    is included for the loader to resolve the many-to-many relation — it is
    not a schema column and must be popped before DB insertion.
    """
    doi   = _str_or_none(safe_get(raw, "_str.doi"))
    pmid  = _str_or_none(safe_get(raw, "_str.pmid"))
    title = _str_or_none(safe_get(raw, "_str.title"))

    category = _str_or_none(safe_get(raw, "_str.category"))
    if category:
        category = category.lower().strip()

    years = _list_of_ints(safe_get(raw, "_list.year") or [])

    # URL: prefer _str.url; fall back to _str.linkout (publications)
    url = _str_or_none(safe_get(raw, "_str.url")) or _str_or_none(safe_get(raw, "_str.linkout"))

    # Stable ID: DOI when present, otherwise a deterministic hash
    stable_id = doi if doi else _stable_output_id(doi, title, category, years)

    # Extract connected project FWF IDs (strip "projects-" prefix)
    raw_project_refs: list = safe_get(raw, "_list.connected.projects") or []
    connected_project_ids = [
        _strip_projects_prefix(ref)
        for ref in raw_project_refs
        if isinstance(ref, str) and ref
    ]

    return {
        "id":               stable_id,
        "doi":              doi,
        "title":            title,
        "category":         category or "",
        "type":             _str_or_none(safe_get(raw, "_str.type")),
        "years":            years,
        "url":              url,
        "pmid":             pmid,
        "journal":          _str_or_none(safe_get(raw, "_str.journal")),
        "publisher":        _str_or_none(safe_get(raw, "_str.publisher")),
        "providedToOthers": safe_get(raw, "_bool.providedtoothers"),  # keep None vs False distinction
        "hasDoi":           bool(doi),
        "hasPmid":          bool(pmid),
        "rawJson":          raw,
        # Loader-only — strip before DB insert
        "connectedProjectIds": connected_project_ids,
    }


def clean_further_funding(raw: dict) -> dict:
    """Transform a raw ``further-funding`` index document into a clean dict.

    The returned dict uses camelCase keys matching the Prisma
    ``FurtherFunding`` model.  An extra ``"connectedProjectIds"`` key is
    included for the loader (same pattern as ``clean_output``).
    """
    raw_project_refs: list = safe_get(raw, "_list.connected.projects") or []
    connected_project_ids = [
        _strip_projects_prefix(ref)
        for ref in raw_project_refs
        if isinstance(ref, str) and ref
    ]

    raw_start = safe_get(raw, "_int.startyear")
    raw_end   = safe_get(raw, "_int.endyear")

    def _to_int_or_none(v: Any) -> int | None:
        try:
            return int(v) if v is not None else None
        except (TypeError, ValueError):
            return None

    return {
        "funder":           _str_or_none(safe_get(raw, "_str.funder")),
        "fundingId":        _str_or_none(safe_get(raw, "_str.fundingid")),
        "country":          _str_or_none(safe_get(raw, "_str.country")),
        "sector":           _str_or_none(safe_get(raw, "_str.sector")),
        "title":            _str_or_none(safe_get(raw, "_str.title")),
        "doi":              _str_or_none(safe_get(raw, "_str.doi")),
        "type":             _str_or_none(safe_get(raw, "_str.type")),
        "startYear":        _to_int_or_none(raw_start),
        "endYear":          _to_int_or_none(raw_end),
        "funderProjectUrl": _str_or_none(safe_get(raw, "_str.funderprojecturl")),
        # Loader-only — strip before DB insert
        "connectedProjectIds": connected_project_ids,
    }


def extract_institutions(projects: list[dict]) -> list[dict]:
    """Extract unique institutions from a list of *cleaned* project dicts.

    Sources examined (in priority order for the name field):
    1. ``piInstitutionRor`` + ``piInstitutionName`` on the cleaned project
    2. ``_list.researchinstitutes`` on the original ``rawJson`` (co-applicants)

    Deduplication is by ROR ID.  Records without a ROR ID are skipped because
    there is no stable key to deduplicate on.

    Country defaults to ``"AT"`` for all records — FWF only funds Austrian
    institutions as lead applicants, and co-applicants are predominantly
    Austrian.  The country field can be refined by a future enrichment step.

    Parameters
    ----------
    projects:
        List of dicts returned by :func:`clean_project`.  Each must contain
        ``piInstitutionRor``, ``piInstitutionName``, and ``rawJson``.

    Returns
    -------
    list[dict]
        Unique institution records with keys ``rorId``, ``name``, ``country``.
    """
    seen: dict[str, dict] = {}  # rorId -> institution dict

    def _register(ror: str | None, name: str | None) -> None:
        if not ror:
            return
        ror = ror.strip()
        if not ror:
            return
        if ror not in seen:
            seen[ror] = {
                "rorId":   ror,
                "name":    (name or "").strip() or ror,
                "country": "AT",
            }
        elif name and not seen[ror]["name"]:
            # Back-fill name if it was missing on first encounter
            seen[ror]["name"] = name.strip()

    for project in projects:
        # Primary institution (PI's host)
        _register(project.get("piInstitutionRor"), project.get("piInstitutionName"))

        # Co-applicant institutions from raw document
        raw = project.get("rawJson") or {}
        for inst in (safe_get(raw, "_list.researchinstitutes") or []):
            if not isinstance(inst, dict):
                continue
            ror  = _normalise_ror(inst.get("ror"))
            name = _str_or_none(inst.get("name"))
            _register(ror, name)

    return list(seen.values())
