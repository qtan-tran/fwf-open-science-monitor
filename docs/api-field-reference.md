# FWF Open API — Field Reference

> Based on FWF Open API Documentation v1.1 (March 2026)

---

## Overview

| Property | Value |
|---|---|
| Base URL | `https://openapi.fwf.ac.at` |
| Search engine | Meilisearch |
| Authentication | Bearer token — obtain at `https://openapi.fwf.ac.at/fwfkey` |
| Data freshness | Updated daily |
| Indices | `projects`, `output`, `further-funding` |

**Critical engine constraint:** Meilisearch is used for full-text search only. Filtering and faceting are **not enabled**. All aggregation, grouping, and metric computation must be performed application-side after fetching data.

**ID stability warning:** `id` fields in the `output` and `further-funding` indices are **not stable** across daily data uploads. Never store these IDs as foreign keys. Always cross-reference via project grant DOIs (`_str.grantdoi`).

---

## Projects Index

Index name: `projects`

### Identifiers

| Field | Type | Description |
|---|---|---|
| `id` | `string` | Document ID — format `"projects-<FWF-id>"`. **Not stable** across uploads for linking purposes. Use `_str.grantdoi` for any stable cross-referencing. |
| `_str.grantdoi` | `string` | Stable project identifier. Format: `"10.55776/<FWF-ID>"` (e.g. `"10.55776/P12345"`). Use this as the canonical project key. |
| `_str.url` | `string` | URL to the project's page on the FWF Research Radar. |

### Principal Investigator

| Field | Type | Description |
|---|---|---|
| `_str.principalinvestigator.firstname` | `string` | PI first name. |
| `_str.principalinvestigator.lastname` | `string` | PI last name. |
| `_str.principalinvestigator.role` | `string` | PI role designation. |
| `_str.principalinvestigator.orcid` | `string` | PI ORCID identifier (bare ID). Mandatory only since 2016; may be absent for older records. |
| `_str.principalinvestigator.orcidlink` | `string` | Fully-qualified ORCID URL (e.g. `"https://orcid.org/0000-0001-2345-6789"`). |
| `_str.principalinvestigator.researchinstitute.name` | `string` | Name of the PI's primary host institution. |
| `_str.principalinvestigator.researchinstitute.ror` | `string` | ROR identifier for the PI's primary host institution. |

### Dates

| Field | Type | Description |
|---|---|---|
| `_date.approvaldate` | `date` | Date the project was approved by FWF. Used for yearly trend aggregation. |
| `_date.startdate` | `date` | Project start date. |
| `_date.enddate` | `date` | Project end date (may be absent for ongoing projects). |

### Funding

| Field | Type | Description |
|---|---|---|
| `_long.approvedamount` | `long` | Total approved funding amount in EUR. **Only present for projects approved 2012 or later.** Absent for earlier records. |

### Status & Programme

| Field | Type | Description |
|---|---|---|
| `_str.status.en` | `string` | Project lifecycle status in English. Known values: `"Ended"`, `"Ongoing"`. |
| `_str.program.en` | `string` | Name of the FWF funding programme (e.g. `"Stand-alone Projects"`, `"Doctoral Programme"`). |

### Titles & Descriptions

| Field | Type | Description |
|---|---|---|
| `_str.projecttitle.en` | `string` | Project title in English. |
| `_str.prproposalsummary.en` | `string` | Lay summary / abstract of the project in English. |

### Research Institutions (Co-applicants)

| Field | Type | Description |
|---|---|---|
| `_list.researchinstitutes` | `array<object>` | All research institutions associated with the project, including co-applicants. Each entry is an object with the following fields: |
| `_list.researchinstitutes[].name` | `string` | Institution name. |
| `_list.researchinstitutes[].ror` | `string` | ROR identifier for the institution. |
| `_list.researchinstitutes[].percentage` | `number` | Percentage of the project budget allocated to this institution. |

### Classification

| Field | Type | Description |
|---|---|---|
| `_list.keywords.split` | `array<string>` | Free-text keywords assigned to the project. |
| `_list.researchdisciplines.en` | `array<string>` | Research disciplines (finest granularity in the FWF classification hierarchy). |
| `_list.researchareas.en` | `array<string>` | Research areas (mid-level classification). |
| `_list.researchfields.en` | `array<string>` | Research fields (broadest classification level). |

### Connected Records

| Field | Type | Description |
|---|---|---|
| `_list.connected.output` | `array<string>` | IDs of linked output records. Format: `"output-<unstable-id>"`. **IDs are not stable** across uploads — use only for a single session / data snapshot. |
| `_list.connected.further-funding` | `array<string>` | IDs of linked further-funding records. Format: `"further-funding-<unstable-id>"`. **IDs are not stable** across uploads. |

---

## Output Index

Index name: `output`

Output records cover 11 distinct categories of research output. All categories share a common set of fields; some categories carry additional fields.

### Common Fields (all categories)

| Field | Type | Description |
|---|---|---|
| `id` | `string` | Document ID — format `"output-<unstable-id>"`. **Not stable** across daily uploads. |
| `_str.category` | `string` | Output category. Exactly one of the 11 values listed below. |
| `_str.type` | `string` | Subtype within the category (category-specific controlled vocabulary). |
| `_str.title` | `string` | Title of the output. |
| `_str.doi` | `string` | DOI of the output, if assigned. |
| `_str.url` | `string` | URL to the output or a landing page for it. |
| `_list.year` | `array<number>` | Year(s) associated with the output (e.g. publication year). |
| `_list.connected.projects` | `array<string>` | IDs of linked project records. Format: `"projects-<FWF-id>"`. These IDs follow the same format as the `projects` index `id` field and can be matched within a single data snapshot. |

### Category Values for `_str.category`

| Value | Description |
|---|---|
| `"publications"` | Journal articles, books, conference papers, etc. |
| `"creative and artistic works"` | Artistic and creative outputs. |
| `"awards"` | Awards and prizes received. |
| `"medical products and interventions"` | Clinical products, therapies, diagnostics. |
| `"patents and licenses"` | Patents filed or granted; licensing agreements. |
| `"research data and analysis techniques"` | Datasets and analytical methods. |
| `"research tools and methods"` | Instruments, protocols, methodologies. |
| `"science communication"` | Public engagement, outreach, media. |
| `"societal impact"` | Policy influence, societal outcomes. |
| `"software and technical products"` | Software, code, technical artefacts. |
| `"start-ups"` | Spin-out companies and start-ups. |

### Additional Fields — `"publications"`

| Field | Type | Description |
|---|---|---|
| `_list.author` | `array<string>` | Author name(s). |
| `_str.journal` | `string` | Journal name (for journal articles). |
| `_str.publisher` | `string` | Publisher name (for books/chapters). |
| `_str.pmid` | `string` | PubMed identifier, if indexed in PubMed. |
| `_str.isbn` | `string` | ISBN (for books and book chapters). |
| `_str.issnprint` | `string` | Print ISSN of the journal. |
| `_str.volume` | `string` | Volume number. |
| `_str.pages` | `string` | Page range (e.g. `"123-145"`). |
| `_str.conferencename` | `string` | Name of conference (for conference papers/proceedings). |
| `_str.editor` | `string` | Editor name(s) (for edited volumes). |
| `_str.anthology` | `string` | Title of the anthology or edited volume containing a chapter. |
| `_str.linkout` | `string` | External link to the publication (full text or publisher page). |

### Additional Fields — `"research data and analysis techniques"` and `"research tools and methods"`

| Field | Type | Description |
|---|---|---|
| `_bool.providedtoothers` | `boolean` | `true` if the data/tool has been shared with or made available to others (e.g. deposited in a repository, released publicly). Key field for open-data and open-tool metrics. |

---

## Further-Funding Index

Index name: `further-funding`

Records follow-on or co-funding attracted by FWF-funded projects from external funders.

| Field | Type | Description |
|---|---|---|
| `id` | `string` | Document ID — format `"further-funding-<unstable-id>"`. **Not stable** across daily uploads. |
| `_list.connected.projects` | `array<string>` | IDs of the FWF projects that attracted this further funding. Format: `"projects-<FWF-id>"`. |
| `_str.title` | `string` | Title of the further-funded project or grant. |
| `_str.doi` | `string` | DOI for the further-funded work, if assigned. |
| `_str.type` | `string` | Type of further funding (funder-specific controlled vocabulary). |
| `_str.funder` | `string` | Name of the external funder (e.g. `"European Research Council"`, `"NIH"`). |
| `_str.fundingid` | `string` | Funder-assigned grant or project identifier. |
| `_str.country` | `string` | Country of the external funder. |
| `_str.sector` | `string` | Sector of the external funder (e.g. `"Government"`, `"Charity"`). |
| `_int.startyear` | `integer` | Start year of the further-funded project. |
| `_int.endyear` | `integer` | End year of the further-funded project. |
| `_str.funderprojecturl` | `string` | URL to the project page on the funder's own system. |

---

## Open Science Metric Definitions

The following metrics are derived application-side from the raw index data. None can be computed via Meilisearch queries directly.

### 1. OA Publication Rate

**Definition:** Percentage of publication-category outputs that have a DOI or PubMed ID — used as a proxy for discoverability and openness.

```
numerator   = outputs where _str.category = "publications"
              AND (_str.doi IS NOT NULL OR _str.pmid IS NOT NULL)
denominator = outputs where _str.category = "publications"
rate        = numerator / denominator × 100
```

**Scope:** Can be computed per project (via `_list.connected.projects`), per institution (via the linked project's `_str.principalinvestigator.researchinstitute.ror`), or globally.

### 2. Open Data Rate

**Definition:** Percentage of research-data outputs that have been shared with others.

```
numerator   = outputs where _str.category = "research data and analysis techniques"
              AND _bool.providedtoothers = true
denominator = outputs where _str.category = "research data and analysis techniques"
rate        = numerator / denominator × 100
```

### 3. Open Software Rate

**Definition:** Percentage of software outputs with a DOI (proxy for a citable, persistent release).

```
numerator   = outputs where _str.category = "software and technical products"
              AND _str.doi IS NOT NULL
denominator = outputs where _str.category = "software and technical products"
rate        = numerator / denominator × 100
```

### 4. Outputs per Project

**Definition:** Total count of linked output records per project.

```
value = length(_list.connected.output)   [from the projects index]
```

Alternatively derived by grouping the `output` index on `_list.connected.projects` after a full fetch.

### 5. Funding Efficiency

**Definition:** Approved funding amount divided by total output count — a rough indicator of cost per output.

```
value = _long.approvedamount / outputs_per_project
```

**Scope:** Only meaningful for projects approved 2012 or later (earlier records lack `_long.approvedamount`). Filter on `_date.approvaldate >= 2012-01-01` before computing.

### 6. Institutional Output Volume

**Definition:** Total output count grouped by host institution.

```
group_key = _str.principalinvestigator.researchinstitute.ror   [from projects]
aggregate = sum of outputs_per_project for all projects with that ROR
```

For multi-institutional projects, use `_list.researchinstitutes[].ror` and apply `_list.researchinstitutes[].percentage` as a weighting factor if pro-rating is needed.

### 7. Yearly Trends

**Definition:** Aggregated metric values binned by year.

- For **project approvals / funding flows**: extract year from `_date.approvaldate`.
- For **output publication trends**: use `_list.year` (take the first/minimum element if multiple years are present).
- For **ongoing vs. ended projects over time**: bin by `_date.startdate` and `_date.enddate`.

---

## Caveats

**OA rates are proxied, not verified.**
The OA Publication Rate uses DOI or PMID presence as a proxy for openness. A DOI or PMID does not guarantee that the publication is open access — it indicates the work is discoverable and registered. Actual OA status (Gold, Green, Diamond, etc.) would require an additional lookup against Unpaywall or a similar service.

**Funding amounts available from 2012 only.**
`_long.approvedamount` is absent for projects approved before 2012. Exclude pre-2012 projects from any funding-based metric or display a clear "data unavailable" state.

**ORCID mandatory only since 2016.**
`_str.principalinvestigator.orcid` and `_str.principalinvestigator.orcidlink` may be absent for PIs on projects approved before 2016. Do not assume ORCID presence for older records.

**Output and further-funding IDs reset daily.**
The `id` fields in `output` and `further-funding` are reassigned with every data upload. Any stored ID becomes invalid the following day. Always use `_str.grantdoi` (format `"10.55776/<FWF-ID>"`) as the stable anchor when persisting relationships to a local database. Resolve output links via `_list.connected.output` on a per-session basis.

**Data sources are not exhaustive.**
Output and further-funding records are sourced primarily from **Researchfish** (researcher self-reporting) and **Dimensions** (bibliographic harvesting). Coverage is incomplete: outputs that researchers did not report and publications not indexed in Dimensions will be absent. Derived rates should be interpreted as lower bounds rather than ground truth.

**Multi-institutional projects and percentage allocation.**
`_list.researchinstitutes` provides a percentage split of the budget, but this allocation is self-reported and may not sum to exactly 100 in all records. Validate and normalise before using percentages as weights in institutional aggregations.
