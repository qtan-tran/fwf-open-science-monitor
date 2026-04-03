"""
Tests for etl/src/cleaner.py

Run with:
    cd etl
    python -m pytest tests/test_cleaner.py -v
"""

from __future__ import annotations

import hashlib
from datetime import datetime, timezone

import pytest

from src.cleaner import (
    _normalise_ror,
    _stable_output_id,
    _validate_orcid,
    clean_further_funding,
    clean_output,
    clean_project,
    extract_institutions,
    parse_fwf_date,
    safe_get,
)


# ---------------------------------------------------------------------------
# Fixtures — realistic raw API documents
# ---------------------------------------------------------------------------

FULL_PROJECT_RAW = {
    "id": "projects-P12345",
    "_str": {
        "grantdoi": "10.55776/P12345",
        "projecttitle": {
            "en": "  Open Science in Alpine Ecology  ",
            "de": "Offene Wissenschaft in alpiner Ökologie",
        },
        "prproposalsummary": {"en": "A study of alpine ecosystems under open-science principles."},
        "program": {"en": "Stand-alone Projects"},
        "status": {"en": "Ended"},
        "url": "https://radar.fwf.ac.at/en/project/P12345",
        "principalinvestigator": {
            "firstname": "Maria",
            "lastname": "Huber",
            "orcid": "0000-0001-2345-6789",
            "role": "Principal Investigator",
            "researchinstitute": {
                "name": "University of Vienna",
                "ror": "https://ror.org/04d836q62",
            },
        },
    },
    "_date": {
        "approvaldate": "2019-03-15T00:00:00.000Z",
        "startdate": "2019-10-01T00:00:00.000Z",
        "enddate": "2023-03-31T00:00:00.000Z",
    },
    "_long": {"approvedamount": 380500},
    "_list": {
        "keywords": {"split": ["alpine ecology", "open data", "biodiversity"]},
        "researchdisciplines": {"en": ["Ecology", "Environmental Sciences"]},
        "researchfields": {"en": ["Natural Sciences"]},
        "researchinstitutes": [
            {"name": "University of Vienna", "ror": "https://ror.org/04d836q62", "percentage": 100},
        ],
        "connected": {
            "output": ["output-111", "output-222"],
            "further-funding": ["further-funding-999"],
        },
    },
}

MINIMAL_PROJECT_RAW = {
    "id": "projects-DOC7",
    "_str": {
        "grantdoi": "10.55776/DOC7",
        "projecttitle": {"en": "Minimal Project"},
    },
}

FULL_OUTPUT_RAW = {
    "id": "output-555",
    "_str": {
        "category": "publications",
        "type": "Journal Article",
        "title": "Ecology meets open science",
        "doi": "10.1234/ecology.2021.001",
        "pmid": "34567890",
        "journal": "Nature Ecology",
        "publisher": "Springer",
        "url": "https://doi.org/10.1234/ecology.2021.001",
    },
    "_list": {
        "year": [2021],
        "connected": {"projects": ["projects-P12345", "projects-P99999"]},
    },
    "_bool": {"providedtoothers": None},
}

RESEARCH_DATA_OUTPUT_RAW = {
    "id": "output-666",
    "_str": {
        "category": "research data and analysis techniques",
        "type": "Dataset",
        "title": "Alpine soil dataset 2019–2022",
        "url": "https://zenodo.org/record/123456",
    },
    "_list": {"year": [2022], "connected": {"projects": ["projects-P12345"]}},
    "_bool": {"providedtoothers": True},
}

MINIMAL_OUTPUT_RAW = {
    "id": "output-777",
    "_str": {"category": "awards"},
}

FULL_FURTHER_FUNDING_RAW = {
    "id": "further-funding-999",
    "_str": {
        "funder": "European Research Council",
        "fundingid": "ERC-2020-STG-123456",
        "country": "EU",
        "sector": "Government",
        "title": "ERC Starting Grant: Alpine OS",
        "doi": None,
        "type": "Grant",
        "funderprojecturl": "https://cordis.europa.eu/project/id/123456",
    },
    "_int": {"startyear": 2021, "endyear": 2026},
    "_list": {"connected": {"projects": ["projects-P12345"]}},
}


# ---------------------------------------------------------------------------
# safe_get
# ---------------------------------------------------------------------------

class TestSafeGet:
    def test_flat_key(self):
        assert safe_get({"a": 1}, "a") == 1

    def test_nested_key(self):
        assert safe_get({"_str": {"grantdoi": "10.55776/P1"}}, "_str.grantdoi") == "10.55776/P1"

    def test_missing_top_level(self):
        assert safe_get({}, "missing") is None

    def test_missing_nested(self):
        assert safe_get({"_str": {}}, "_str.missing.deep") is None

    def test_none_intermediate(self):
        assert safe_get({"_str": None}, "_str.grantdoi") is None

    def test_non_dict_intermediate(self):
        assert safe_get({"_str": "not-a-dict"}, "_str.grantdoi") is None

    def test_custom_default(self):
        assert safe_get({}, "x", default="fallback") == "fallback"

    def test_value_of_zero_is_returned(self):
        assert safe_get({"a": {"b": 0}}, "a.b") == 0

    def test_value_of_false_is_returned(self):
        assert safe_get({"a": {"b": False}}, "a.b") is False


# ---------------------------------------------------------------------------
# parse_fwf_date
# ---------------------------------------------------------------------------

class TestParseFwfDate:
    def test_none_returns_none(self):
        assert parse_fwf_date(None) is None

    def test_empty_string_returns_none(self):
        assert parse_fwf_date("") is None

    def test_iso_with_milliseconds(self):
        dt = parse_fwf_date("2023-06-15T00:00:00.000Z")
        assert dt == datetime(2023, 6, 15, tzinfo=timezone.utc)

    def test_iso_with_seconds(self):
        dt = parse_fwf_date("2023-06-15T00:00:00Z")
        assert dt == datetime(2023, 6, 15, tzinfo=timezone.utc)

    def test_iso_without_tz(self):
        dt = parse_fwf_date("2023-06-15T00:00:00")
        assert dt is not None
        assert dt.year == 2023

    def test_date_only(self):
        dt = parse_fwf_date("2023-06-15")
        assert dt == datetime(2023, 6, 15, tzinfo=timezone.utc)

    def test_european_format(self):
        dt = parse_fwf_date("15.06.2023")
        assert dt == datetime(2023, 6, 15, tzinfo=timezone.utc)

    def test_year_only(self):
        dt = parse_fwf_date("2023")
        assert dt is not None
        assert dt.year == 2023

    def test_returns_utc_aware(self):
        dt = parse_fwf_date("2019-03-15T00:00:00.000Z")
        assert dt.tzinfo is not None

    def test_garbage_returns_none(self):
        assert parse_fwf_date("not-a-date") is None

    def test_whitespace_stripped(self):
        dt = parse_fwf_date("  2023-06-15  ")
        assert dt is not None


# ---------------------------------------------------------------------------
# ORCID validation
# ---------------------------------------------------------------------------

class TestValidateOrcid:
    def test_valid_bare_orcid(self):
        assert _validate_orcid("0000-0001-2345-6789") == "0000-0001-2345-6789"

    def test_valid_orcid_with_x(self):
        assert _validate_orcid("0000-0002-1825-009X") == "0000-0002-1825-009X"

    def test_valid_url_form(self):
        assert _validate_orcid("https://orcid.org/0000-0001-2345-6789") == "0000-0001-2345-6789"

    def test_none_returns_none(self):
        assert _validate_orcid(None) is None

    def test_empty_string_returns_none(self):
        assert _validate_orcid("") is None

    def test_malformed_too_short(self):
        assert _validate_orcid("0000-0001-2345") is None

    def test_malformed_letters(self):
        assert _validate_orcid("ABCD-0001-2345-6789") is None

    def test_malformed_wrong_separator(self):
        assert _validate_orcid("0000.0001.2345.6789") is None

    def test_whitespace_stripped(self):
        assert _validate_orcid("  0000-0001-2345-6789  ") == "0000-0001-2345-6789"


# ---------------------------------------------------------------------------
# ROR normalisation
# ---------------------------------------------------------------------------

class TestNormaliseRor:
    def test_full_url_unchanged(self):
        ror = "https://ror.org/04d836q62"
        assert _normalise_ror(ror) == ror

    def test_bare_id_gets_prefix(self):
        assert _normalise_ror("04d836q62") == "https://ror.org/04d836q62"

    def test_none_returns_none(self):
        assert _normalise_ror(None) is None

    def test_empty_string_returns_none(self):
        assert _normalise_ror("") is None

    def test_whitespace_only_returns_none(self):
        assert _normalise_ror("   ") is None


# ---------------------------------------------------------------------------
# clean_project — complete document
# ---------------------------------------------------------------------------

class TestCleanProjectFull:
    def setup_method(self):
        self.result = clean_project(FULL_PROJECT_RAW)

    def test_id_extracted(self):
        assert self.result["id"] == "P12345"

    def test_grant_doi(self):
        assert self.result["grantDoi"] == "10.55776/P12345"

    def test_title_stripped(self):
        assert self.result["titleEn"] == "Open Science in Alpine Ecology"

    def test_title_de(self):
        assert self.result["titleDe"] == "Offene Wissenschaft in alpiner Ökologie"

    def test_summary(self):
        assert "alpine ecosystems" in self.result["summaryEn"]

    def test_program(self):
        assert self.result["programEn"] == "Stand-alone Projects"

    def test_status(self):
        assert self.result["statusEn"] == "Ended"

    def test_approval_date_parsed(self):
        assert self.result["approvalDate"] == datetime(2019, 3, 15, tzinfo=timezone.utc)

    def test_approval_year_derived(self):
        assert self.result["approvalYear"] == 2019

    def test_start_date_parsed(self):
        assert self.result["startDate"] == datetime(2019, 10, 1, tzinfo=timezone.utc)

    def test_end_date_parsed(self):
        assert self.result["endDate"] == datetime(2023, 3, 31, tzinfo=timezone.utc)

    def test_approved_amount(self):
        assert self.result["approvedAmount"] == 380500

    def test_pi_first_name(self):
        assert self.result["piFirstName"] == "Maria"

    def test_pi_last_name(self):
        assert self.result["piLastName"] == "Huber"

    def test_pi_orcid_valid(self):
        assert self.result["piOrcid"] == "0000-0001-2345-6789"

    def test_pi_role(self):
        assert self.result["piRole"] == "Principal Investigator"

    def test_pi_institution_name(self):
        assert self.result["piInstitutionName"] == "University of Vienna"

    def test_pi_institution_ror_normalised(self):
        assert self.result["piInstitutionRor"] == "https://ror.org/04d836q62"

    def test_radar_url(self):
        assert self.result["researchRadarUrl"].startswith("https://radar.fwf.ac.at")

    def test_keywords_list(self):
        assert set(self.result["keywords"]) == {"alpine ecology", "open data", "biodiversity"}

    def test_disciplines_list(self):
        assert "Ecology" in self.result["disciplinesEn"]

    def test_fields_list(self):
        assert "Natural Sciences" in self.result["fieldsEn"]

    def test_raw_json_preserved(self):
        assert self.result["rawJson"] is FULL_PROJECT_RAW

    def test_no_unexpected_none_for_required_arrays(self):
        assert isinstance(self.result["keywords"], list)
        assert isinstance(self.result["disciplinesEn"], list)
        assert isinstance(self.result["fieldsEn"], list)


# ---------------------------------------------------------------------------
# clean_project — minimal document (many fields absent)
# ---------------------------------------------------------------------------

class TestCleanProjectMinimal:
    def setup_method(self):
        self.result = clean_project(MINIMAL_PROJECT_RAW)

    def test_id_extracted(self):
        assert self.result["id"] == "DOC7"

    def test_title_en_present(self):
        assert self.result["titleEn"] == "Minimal Project"

    def test_optional_fields_are_none(self):
        for field in ("titleDe", "summaryEn", "programEn", "statusEn",
                      "approvalDate", "startDate", "endDate",
                      "approvedAmount", "approvalYear",
                      "piFirstName", "piLastName", "piOrcid", "piRole",
                      "piInstitutionName", "piInstitutionRor", "researchRadarUrl"):
            assert self.result[field] is None, f"Expected {field} to be None"

    def test_array_fields_are_empty_lists(self):
        for field in ("keywords", "disciplinesEn", "fieldsEn"):
            assert self.result[field] == [], f"Expected {field} to be []"

    def test_no_key_error_on_empty_doc(self):
        """Should never raise KeyError, even on a completely empty dict."""
        result = clean_project({})
        assert isinstance(result, dict)


# ---------------------------------------------------------------------------
# clean_project — missing nested PI fields
# ---------------------------------------------------------------------------

class TestCleanProjectMissingNestedFields:
    def test_missing_pi_block(self):
        raw = {
            "id": "projects-X1",
            "_str": {
                "grantdoi": "10.55776/X1",
                "projecttitle": {"en": "No PI"},
                # _str.principalinvestigator entirely absent
            },
        }
        result = clean_project(raw)
        assert result["piFirstName"] is None
        assert result["piOrcid"] is None
        assert result["piInstitutionRor"] is None

    def test_missing_researchinstitute_block(self):
        raw = {
            "id": "projects-X2",
            "_str": {
                "grantdoi": "10.55776/X2",
                "projecttitle": {"en": "No Institute"},
                "principalinvestigator": {"firstname": "Test"},
            },
        }
        result = clean_project(raw)
        assert result["piInstitutionName"] is None
        assert result["piInstitutionRor"] is None

    def test_invalid_orcid_stored_as_none(self):
        raw = {
            "id": "projects-X3",
            "_str": {
                "grantdoi": "10.55776/X3",
                "projecttitle": {"en": "Bad ORCID"},
                "principalinvestigator": {"orcid": "not-an-orcid"},
            },
        }
        result = clean_project(raw)
        assert result["piOrcid"] is None

    def test_amount_not_coerced_from_none(self):
        raw = {
            "id": "projects-X4",
            "_str": {"grantdoi": "10.55776/X4", "projecttitle": {"en": "No Amount"}},
            "_long": {},
        }
        result = clean_project(raw)
        assert result["approvedAmount"] is None


# ---------------------------------------------------------------------------
# clean_output
# ---------------------------------------------------------------------------

class TestCleanOutputPublication:
    def setup_method(self):
        self.result = clean_output(FULL_OUTPUT_RAW)

    def test_id_is_doi(self):
        assert self.result["id"] == "10.1234/ecology.2021.001"

    def test_doi(self):
        assert self.result["doi"] == "10.1234/ecology.2021.001"

    def test_pmid(self):
        assert self.result["pmid"] == "34567890"

    def test_category_lowercased(self):
        assert self.result["category"] == "publications"

    def test_title(self):
        assert self.result["title"] == "Ecology meets open science"

    def test_years(self):
        assert self.result["years"] == [2021]

    def test_journal(self):
        assert self.result["journal"] == "Nature Ecology"

    def test_publisher(self):
        assert self.result["publisher"] == "Springer"

    def test_has_doi_true(self):
        assert self.result["hasDoi"] is True

    def test_has_pmid_true(self):
        assert self.result["hasPmid"] is True

    def test_provided_to_others_none_for_publication(self):
        assert self.result["providedToOthers"] is None

    def test_connected_project_ids_stripped(self):
        assert set(self.result["connectedProjectIds"]) == {"P12345", "P99999"}

    def test_raw_json_preserved(self):
        assert self.result["rawJson"] is FULL_OUTPUT_RAW


class TestCleanOutputResearchData:
    def setup_method(self):
        self.result = clean_output(RESEARCH_DATA_OUTPUT_RAW)

    def test_provided_to_others_true(self):
        assert self.result["providedToOthers"] is True

    def test_has_doi_false_when_no_doi(self):
        assert self.result["hasDoi"] is False

    def test_id_is_hash_when_no_doi(self):
        assert self.result["id"].startswith("hash-")

    def test_category(self):
        assert self.result["category"] == "research data and analysis techniques"


class TestCleanOutputMinimal:
    def setup_method(self):
        self.result = clean_output(MINIMAL_OUTPUT_RAW)

    def test_category_present(self):
        assert self.result["category"] == "awards"

    def test_no_key_error(self):
        assert isinstance(self.result, dict)

    def test_optional_fields_are_none(self):
        for field in ("doi", "pmid", "title", "url", "journal", "publisher",
                      "providedToOthers"):
            assert self.result[field] is None, f"Expected {field} to be None"

    def test_years_empty_list(self):
        assert self.result["years"] == []

    def test_connected_project_ids_empty(self):
        assert self.result["connectedProjectIds"] == []

    def test_id_is_hash_when_no_doi(self):
        assert self.result["id"].startswith("hash-")


class TestStableOutputId:
    def test_same_inputs_same_hash(self):
        id1 = _stable_output_id(None, "My Paper", "publications", [2021])
        id2 = _stable_output_id(None, "My Paper", "publications", [2021])
        assert id1 == id2

    def test_different_title_different_hash(self):
        id1 = _stable_output_id(None, "Paper A", "publications", [2021])
        id2 = _stable_output_id(None, "Paper B", "publications", [2021])
        assert id1 != id2

    def test_hash_prefix(self):
        result = _stable_output_id(None, "title", "cat", [2020])
        assert result.startswith("hash-")

    def test_none_inputs_do_not_raise(self):
        result = _stable_output_id(None, None, None, [])
        assert result.startswith("hash-")


# ---------------------------------------------------------------------------
# clean_further_funding
# ---------------------------------------------------------------------------

class TestCleanFurtherFunding:
    def setup_method(self):
        self.result = clean_further_funding(FULL_FURTHER_FUNDING_RAW)

    def test_funder(self):
        assert self.result["funder"] == "European Research Council"

    def test_funding_id(self):
        assert self.result["fundingId"] == "ERC-2020-STG-123456"

    def test_country(self):
        assert self.result["country"] == "EU"

    def test_sector(self):
        assert self.result["sector"] == "Government"

    def test_title(self):
        assert "Alpine OS" in self.result["title"]

    def test_start_year(self):
        assert self.result["startYear"] == 2021

    def test_end_year(self):
        assert self.result["endYear"] == 2026

    def test_funder_project_url(self):
        assert "cordis.europa.eu" in self.result["funderProjectUrl"]

    def test_connected_project_ids(self):
        assert self.result["connectedProjectIds"] == ["P12345"]

    def test_no_key_error_on_empty(self):
        result = clean_further_funding({})
        assert isinstance(result, dict)
        assert result["connectedProjectIds"] == []

    def test_optional_fields_none_when_absent(self):
        result = clean_further_funding({})
        for field in ("funder", "fundingId", "country", "sector", "title",
                      "doi", "type", "startYear", "endYear", "funderProjectUrl"):
            assert result[field] is None, f"Expected {field} to be None"


# ---------------------------------------------------------------------------
# extract_institutions
# ---------------------------------------------------------------------------

class TestExtractInstitutions:
    def _make_project(self, ror: str | None, name: str | None, raw_institutes: list | None = None) -> dict:
        raw = {}
        if raw_institutes is not None:
            raw["_list"] = {"researchinstitutes": raw_institutes}
        return {
            "piInstitutionRor": ror,
            "piInstitutionName": name,
            "rawJson": raw,
        }

    def test_basic_extraction(self):
        projects = [self._make_project("https://ror.org/aaa", "Uni A")]
        result = extract_institutions(projects)
        assert len(result) == 1
        assert result[0]["rorId"] == "https://ror.org/aaa"
        assert result[0]["name"] == "Uni A"

    def test_deduplication_by_ror(self):
        projects = [
            self._make_project("https://ror.org/aaa", "Uni A"),
            self._make_project("https://ror.org/aaa", "Uni A (duplicate)"),
        ]
        result = extract_institutions(projects)
        assert len(result) == 1

    def test_multiple_unique_institutions(self):
        projects = [
            self._make_project("https://ror.org/aaa", "Uni A"),
            self._make_project("https://ror.org/bbb", "Uni B"),
        ]
        result = extract_institutions(projects)
        assert len(result) == 2

    def test_none_ror_skipped(self):
        projects = [self._make_project(None, "Unknown Uni")]
        result = extract_institutions(projects)
        assert result == []

    def test_co_applicant_institutes_included(self):
        projects = [
            self._make_project(
                "https://ror.org/aaa",
                "Uni A",
                raw_institutes=[
                    {"ror": "https://ror.org/bbb", "name": "Uni B", "percentage": 30},
                ],
            )
        ]
        result = extract_institutions(projects)
        ror_ids = {r["rorId"] for r in result}
        assert "https://ror.org/aaa" in ror_ids
        assert "https://ror.org/bbb" in ror_ids

    def test_co_applicant_bare_ror_normalised(self):
        projects = [
            self._make_project(
                None,
                None,
                raw_institutes=[{"ror": "04d836q62", "name": "Uni Vienna", "percentage": 100}],
            )
        ]
        result = extract_institutions(projects)
        assert len(result) == 1
        assert result[0]["rorId"] == "https://ror.org/04d836q62"

    def test_country_defaults_to_at(self):
        projects = [self._make_project("https://ror.org/aaa", "Uni A")]
        result = extract_institutions(projects)
        assert result[0]["country"] == "AT"

    def test_empty_list_returns_empty(self):
        assert extract_institutions([]) == []

    def test_dedup_across_pi_and_co_applicant(self):
        """PI institution also appears in _list.researchinstitutes — should deduplicate."""
        ror = "https://ror.org/04d836q62"
        projects = [
            self._make_project(
                ror,
                "University of Vienna",
                raw_institutes=[{"ror": ror, "name": "University of Vienna", "percentage": 100}],
            )
        ]
        result = extract_institutions(projects)
        assert len(result) == 1

    def test_full_pipeline_from_cleaned_project(self):
        """Integration: clean_project output flows correctly into extract_institutions."""
        cleaned = clean_project(FULL_PROJECT_RAW)
        institutions = extract_institutions([cleaned])
        assert len(institutions) >= 1
        ror_ids = {i["rorId"] for i in institutions}
        assert "https://ror.org/04d836q62" in ror_ids
