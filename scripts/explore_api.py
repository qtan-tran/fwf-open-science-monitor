"""
FWF Open API — exploration script.

Usage:
    pip install meilisearch python-dotenv
    python scripts/explore_api.py

Requires a .env file (or environment variable) with:
    FWF_API_KEY=<your key from https://openapi.fwf.ac.at/fwfkey>
"""

import json
import os
import sys
from pathlib import Path

# ---------------------------------------------------------------------------
# Bootstrap: load .env from the repo root regardless of where the script is
# invoked from.
# ---------------------------------------------------------------------------
try:
    from dotenv import load_dotenv
except ImportError:
    sys.exit("Missing dependency: run  pip install python-dotenv")

try:
    import meilisearch
except ImportError:
    sys.exit("Missing dependency: run  pip install meilisearch")

_repo_root = Path(__file__).resolve().parent.parent
load_dotenv(_repo_root / ".env")

API_KEY = os.getenv("FWF_API_KEY", "")
API_URL = os.getenv("FWF_API_URL", "https://openapi.fwf.ac.at")

if not API_KEY:
    sys.exit(
        "FWF_API_KEY is not set.\n"
        "Copy .env.example → .env and fill in your key from "
        "https://openapi.fwf.ac.at/fwfkey"
    )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def section(title: str) -> None:
    """Print a clearly delimited section header."""
    bar = "=" * 72
    print(f"\n{bar}")
    print(f"  {title}")
    print(bar)


def get_nested(doc: dict, dotted_path: str, default=None):
    """
    Traverse a dot-delimited path through nested dicts, e.g.
    '_str.principalinvestigator.orcid'.  Returns *default* if any
    intermediate key is missing or None.
    """
    parts = dotted_path.split(".")
    node = doc
    for part in parts:
        if not isinstance(node, dict):
            return default
        node = node.get(part)
        if node is None:
            return default
    return node


def present(value) -> bool:
    """True when a field is non-None and (for strings/lists) non-empty."""
    if value is None:
        return False
    if isinstance(value, (str, list)):
        return len(value) > 0
    return True


def pct(numerator: int, denominator: int) -> str:
    if denominator == 0:
        return "n/a"
    return f"{numerator / denominator * 100:.1f}%"


# ---------------------------------------------------------------------------
# Client
# ---------------------------------------------------------------------------

client = meilisearch.Client(API_URL, API_KEY)

INDICES = ["projects", "output", "further-funding"]


# ---------------------------------------------------------------------------
# (a) Index stats
# ---------------------------------------------------------------------------

section("(a) INDEX STATS")

try:
    for index_name in INDICES:
        index = client.index(index_name)
        stats = index.get_stats()
        # Meilisearch SDK returns an object; access as attributes or dict.
        num_docs = getattr(stats, "number_of_documents", None)
        if num_docs is None and isinstance(stats, dict):
            num_docs = stats.get("numberOfDocuments", "?")
        print(f"  {index_name:<20}  documents: {num_docs}")

    # Raw index list from the API for lastUpdate timestamps.
    raw = client.get_indexes()
    results = getattr(raw, "results", raw) if not isinstance(raw, dict) else raw.get("results", [])
    for idx in results:
        uid = getattr(idx, "uid", None) or idx.get("uid", "?")
        updated = getattr(idx, "updated_at", None) or idx.get("updatedAt", "unknown")
        if uid in INDICES:
            print(f"  {uid:<20}  last updated: {updated}")
except Exception as exc:
    print(f"  ERROR fetching index stats: {exc}")


# ---------------------------------------------------------------------------
# (b) Sample projects
# ---------------------------------------------------------------------------

section("(b) SAMPLE PROJECTS")

sample_fwf_id = None  # captured for step (f)

try:
    index = client.index("projects")

    # One full document — pretty-print everything.
    print("\n--- Full JSON of first project document ---\n")
    result = index.search("", {"limit": 1})
    hits = result.get("hits", []) if isinstance(result, dict) else getattr(result, "hits", [])
    if hits:
        print(json.dumps(hits[0], indent=2, ensure_ascii=False))
        # Capture the FWF ID for step (f): id is "projects-<FWF-ID>"
        raw_id = hits[0].get("id", "")
        if raw_id.startswith("projects-"):
            sample_fwf_id = raw_id  # keep full id string

    # Five more — selected fields only.
    print("\n--- Selected fields for next 5 projects ---\n")
    result5 = index.search("", {"limit": 6})
    hits5 = result5.get("hits", []) if isinstance(result5, dict) else getattr(result5, "hits", [])
    for doc in hits5[1:6]:
        grant_doi      = get_nested(doc, "_str.grantdoi")
        title_en       = get_nested(doc, "_str.projecttitle.en")
        pi_last        = get_nested(doc, "_str.principalinvestigator.lastname")
        pi_orcid       = get_nested(doc, "_str.principalinvestigator.orcid")
        pi_ror         = get_nested(doc, "_str.principalinvestigator.researchinstitute.ror")
        amount         = get_nested(doc, "_long.approvedamount")
        approval_date  = get_nested(doc, "_date.approvaldate")
        status         = get_nested(doc, "_str.status.en")
        outputs        = get_nested(doc, "_list.connected.output") or []
        output_count   = len(outputs)

        print(f"  grantdoi      : {grant_doi}")
        print(f"  title (en)    : {str(title_en)[:80]}")
        print(f"  PI lastname   : {pi_last}")
        print(f"  PI orcid      : {pi_orcid}")
        print(f"  PI ROR        : {pi_ror}")
        print(f"  approved amt  : {amount}")
        print(f"  approval date : {approval_date}")
        print(f"  status        : {status}")
        print(f"  output count  : {output_count}")
        print()

except Exception as exc:
    print(f"  ERROR in sample projects: {exc}")


# ---------------------------------------------------------------------------
# (c) Sample outputs
# ---------------------------------------------------------------------------

section("(c) SAMPLE OUTPUTS")

try:
    index = client.index("output")
    result = index.search("", {"limit": 20})
    hits = result.get("hits", []) if isinstance(result, dict) else getattr(result, "hits", [])

    # Group by category.
    category_counts: dict[str, int] = {}
    for doc in hits:
        cat = get_nested(doc, "_str.category") or "(none)"
        category_counts[cat] = category_counts.get(cat, 0) + 1

    print(f"\n  Outputs fetched: {len(hits)}\n")
    print("  By category:")
    for cat, cnt in sorted(category_counts.items(), key=lambda x: -x[1]):
        print(f"    {cnt:>3}  {cat}")

    # Publications: DOI / PMID presence.
    pubs = [d for d in hits if get_nested(d, "_str.category") == "publications"]
    if pubs:
        print(f"\n  Publications ({len(pubs)} in sample):")
        for doc in pubs:
            doi  = get_nested(doc, "_str.doi")
            pmid = get_nested(doc, "_str.pmid")
            title = str(get_nested(doc, "_str.title") or "(no title)")[:60]
            doi_flag  = "DOI=yes" if present(doi)  else "DOI=no "
            pmid_flag = "PMID=yes" if present(pmid) else "PMID=no "
            print(f"    [{doi_flag}] [{pmid_flag}]  {title}")

    # Research data: providedtoothers.
    research_data = [
        d for d in hits
        if get_nested(d, "_str.category") == "research data and analysis techniques"
    ]
    if research_data:
        print(f"\n  Research data outputs ({len(research_data)} in sample):")
        for doc in research_data:
            shared = get_nested(doc, "_bool.providedtoothers")
            title  = str(get_nested(doc, "_str.title") or "(no title)")[:60]
            print(f"    providedtoothers={shared!r}  {title}")
    else:
        print("\n  (No 'research data and analysis techniques' outputs in this sample.)")

except Exception as exc:
    print(f"  ERROR in sample outputs: {exc}")


# ---------------------------------------------------------------------------
# (d) Sample further-funding
# ---------------------------------------------------------------------------

section("(d) SAMPLE FURTHER-FUNDING")

try:
    index = client.index("further-funding")
    result = index.search("", {"limit": 5})
    hits = result.get("hits", []) if isinstance(result, dict) else getattr(result, "hits", [])

    print(f"\n  Documents fetched: {len(hits)}\n")
    for doc in hits:
        funder     = get_nested(doc, "_str.funder")
        country    = get_nested(doc, "_str.country")
        funding_id = get_nested(doc, "_str.fundingid")
        print(f"  funder     : {funder}")
        print(f"  country    : {country}")
        print(f"  fundingid  : {funding_id}")
        print()

except Exception as exc:
    print(f"  ERROR in sample further-funding: {exc}")


# ---------------------------------------------------------------------------
# (e) Search test
# ---------------------------------------------------------------------------

section("(e) SEARCH TEST — 'Medizinische Universität Wien'")

try:
    index = client.index("projects")
    result = index.search("Medizinische Universität Wien", {"limit": 5})
    hits = result.get("hits", []) if isinstance(result, dict) else getattr(result, "hits", [])
    estimated = (
        result.get("estimatedTotalHits")
        if isinstance(result, dict)
        else getattr(result, "estimated_total_hits", None)
    )

    print(f"\n  Estimated total hits: {estimated}")
    print(f"  Showing: {len(hits)}\n")
    for doc in hits:
        grant_doi = get_nested(doc, "_str.grantdoi")
        title_en  = get_nested(doc, "_str.projecttitle.en")
        print(f"  {grant_doi}  |  {str(title_en)[:70]}")

except Exception as exc:
    print(f"  ERROR in search test: {exc}")


# ---------------------------------------------------------------------------
# (f) Multi-search: outputs + further-funding for one project
# ---------------------------------------------------------------------------

section("(f) MULTI-SEARCH — outputs and further-funding for one project")

try:
    if not sample_fwf_id:
        print("  (No sample project ID captured from step (b); skipping.)")
    else:
        print(f"\n  Using project id: {sample_fwf_id}")

        queries = [
            {
                "indexUid": "output",
                "q": sample_fwf_id,
                "limit": 100,
            },
            {
                "indexUid": "further-funding",
                "q": sample_fwf_id,
                "limit": 100,
            },
        ]
        response = client.multi_search(queries)
        results = (
            response.get("results", [])
            if isinstance(response, dict)
            else getattr(response, "results", [])
        )

        for res in results:
            idx_uid = (
                res.get("indexUid") if isinstance(res, dict)
                else getattr(res, "index_uid", "?")
            )
            hits = (
                res.get("hits", []) if isinstance(res, dict)
                else getattr(res, "hits", [])
            )
            estimated = (
                res.get("estimatedTotalHits") if isinstance(res, dict)
                else getattr(res, "estimated_total_hits", None)
            )
            print(f"  {idx_uid:<20}  hits returned: {len(hits):<5}  estimated total: {estimated}")

        print()
        print(
            "  Note: full-text search on the unstable ID string may not match all "
            "linked records.\n"
            "  For precise linking, load all outputs and join on "
            "_list.connected.projects in application code."
        )

except Exception as exc:
    print(f"  ERROR in multi-search: {exc}")


# ---------------------------------------------------------------------------
# (g) Field presence audit — 100 projects
# ---------------------------------------------------------------------------

section("(g) FIELD PRESENCE AUDIT — 100 projects")

try:
    index = client.index("projects")
    result = index.search("", {"limit": 100})
    hits = result.get("hits", []) if isinstance(result, dict) else getattr(result, "hits", [])
    n = len(hits)

    has_orcid    = sum(1 for d in hits if present(get_nested(d, "_str.principalinvestigator.orcid")))
    has_ror      = sum(1 for d in hits if present(get_nested(d, "_str.principalinvestigator.researchinstitute.ror")))
    has_amount   = sum(1 for d in hits if present(get_nested(d, "_long.approvedamount")))
    has_outputs  = sum(1 for d in hits if present(get_nested(d, "_list.connected.output")))

    print(f"\n  Projects in sample: {n}\n")
    print(f"  PI ORCID present             : {has_orcid:>4} / {n}  ({pct(has_orcid,   n)})")
    print(f"  PI ROR present               : {has_ror:>4} / {n}  ({pct(has_ror,     n)})")
    print(f"  approvedamount present       : {has_amount:>4} / {n}  ({pct(has_amount,  n)})")
    print(f"  ≥1 connected output          : {has_outputs:>4} / {n}  ({pct(has_outputs, n)})")

except Exception as exc:
    print(f"  ERROR in field presence audit: {exc}")


# ---------------------------------------------------------------------------
# (h) Pagination test
# ---------------------------------------------------------------------------

section("(h) PAGINATION TEST — projects offset 0 and offset 20")

try:
    index = client.index("projects")

    page1 = index.search("", {"limit": 20, "offset": 0})
    page2 = index.search("", {"limit": 20, "offset": 20})

    hits1 = page1.get("hits", []) if isinstance(page1, dict) else getattr(page1, "hits", [])
    hits2 = page2.get("hits", []) if isinstance(page2, dict) else getattr(page2, "hits", [])

    ids1 = {d.get("id") for d in hits1}
    ids2 = {d.get("id") for d in hits2}
    overlap = ids1 & ids2

    total = (
        page1.get("estimatedTotalHits")
        if isinstance(page1, dict)
        else getattr(page1, "estimated_total_hits", None)
    )

    print(f"\n  Page 1 (offset=0,  limit=20): {len(hits1)} documents")
    print(f"  Page 2 (offset=20, limit=20): {len(hits2)} documents")
    print(f"  Overlapping IDs             : {len(overlap)}  {'(OK — no overlap)' if not overlap else '(WARNING — overlap found!)'}")
    print(f"  Estimated total hits        : {total}")

except Exception as exc:
    print(f"  ERROR in pagination test: {exc}")


print("\n" + "=" * 72)
print("  Exploration complete.")
print("=" * 72 + "\n")
