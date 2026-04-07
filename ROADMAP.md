# Roadmap

This document outlines the planned development trajectory for the FWF Open
Science Monitor. Items are grouped by phase. Each phase builds on the previous
one and can be delivered independently.

> **Status key:**  ✅ Done · 🚧 In progress · 📋 Planned · 💡 Idea

---

## Phase 1 — MVP (Current)  ✅

The initial release establishes the full-stack foundation and covers all data
currently available from the FWF Open Research API.

**Features:**
- [x] ETL pipeline: fetch, clean, load, compute metrics (projects, outputs, further-funding, institutions)
- [x] Dashboard with 6 charts and 4 headline stat cards
- [x] Projects browser with search, filters, pagination, and detail pages
- [x] Institutions list and detail pages with output linkage
- [x] 10 Explore modes (totals, recent, OA rates, rankings, trends, topics, export, researchers, funding-impact, system)
- [x] CSV / JSON bulk export for all four data types
- [x] In-memory LRU cache (5-minute TTL)
- [x] Dark mode
- [x] Vitest suite: 114 web tests
- [x] pytest suite: 245 ETL tests
- [x] Docker Compose local development stack
- [x] GitHub Actions CI (lint, type-check, test, build)
- [x] ETL scheduled daily via GitHub Actions
- [x] Vercel deployment configuration
- [x] Full documentation (architecture, exploration modes, extension guide)

---

## Phase 2 — Real OA Status via Unpaywall / OpenAlex  📋

The current OA metric is a proxy (DOI presence rate). Phase 2 replaces it
with actual open-access status by querying Unpaywall and OpenAlex.

**Goals:**
- Enrich each output with a true OA colour (gold, green, hybrid, bronze, closed)
- Break the OA rate chart down by OA type, not just presence/absence of DOI
- Add an "OA colour distribution" pie/donut chart to the dashboard
- Display per-project OA status on project detail pages

**Technical work:**
- Add `oa_colour TEXT` and `is_open_access BOOLEAN` columns to the `outputs` table
- New ETL step: batch-query the Unpaywall API (`api.unpaywall.org/v2/{doi}`) for
  all outputs with a DOI; fall back to OpenAlex for non-DOI records
- Rate-limit to ≤ 10 req/s (Unpaywall policy); cache responses for 30 days
- Update `MetricComputer` to compute OA-colour breakdown metrics
- Update the OA rate chart to show the colour stack

**Data requirement:** Unpaywall is free and requires only an email in the query
string. OpenAlex is fully open with no authentication required.

---

## Phase 3 — DFG Integration via GEPRIS  📋

Add German Research Foundation (DFG) projects alongside FWF, enabling
Austria–Germany open-science comparison.

**Goals:**
- Import DFG project metadata from the GEPRIS API
- Tag all existing records with a `source` field (`fwf` | `dfg`)
- Add a funder filter to all list views and the export builder
- Side-by-side OA rate comparison chart on the dashboard
- Institutional rankings that include DFG-affiliated institutions

**Technical work:**
- `DFGClient` and `clean_dfg_project()` (see [docs/extending.md](docs/extending.md#3-adding-a-new-data-source))
- Add `source TEXT DEFAULT 'fwf'` migration to the `projects` table
- Extend `MetricComputer` with per-source metric variants
  (`oa_rate_by_year_fwf`, `oa_rate_by_year_dfg`)
- Frontend: add funder filter to project list, institution rankings, and charts

**Data requirement:** GEPRIS offers a public REST API. DFG output/publication
data is limited — Phase 3 may only cover project metadata initially.

---

## Phase 4 — Cross-Funder European Comparison  💡

Extend the monitor to cover multiple European funders and enable direct
cross-funder comparison of open-science compliance.

**Goals:**
- Support at minimum: FWF (AT), DFG (DE), NWO (NL), SNSF (CH), ANR (FR)
- European-level OA rate comparison dashboard section
- Funder-selectable filters on all views
- Country-level heat map (map component)

**Technical work:**
- Refactor ETL to a plugin architecture: each funder is a module implementing
  a common `FunderPlugin` protocol (`fetch`, `clean`, `source_id`)
- Add `country TEXT` to the `projects` table (derived from `source`)
- Add a choropleth map component (e.g. react-simple-maps or D3 + GeoJSON)
- Investigate OpenAIRE Graph API as a unified source across all funders

---

## Phase 5 — Automated PDF Report Generation  💡

Allow users to generate a one-page PDF snapshot of the current dashboard
state — useful for annual reports, grant applications, and institutional
reviews.

**Goals:**
- "Download Report" button on the dashboard
- PDF contains: headline metrics, OA rate chart, top 10 institutions, key trends
- Configurable date range and optional institution filter
- Scheduled email delivery (weekly digest)

**Technical work:**
- Server-side PDF generation using Puppeteer (headless Chromium) or
  `@react-pdf/renderer`
- New API route `GET /api/report?format=pdf&year=...` that renders the report
  template and streams the PDF response
- Optional: integrate with a transactional email service (Resend, SendGrid)
  for scheduled delivery

---

## Phase 6 — Public API for Third-Party Integrations  💡

Open up the monitor's computed metrics as a documented, versioned public API so
other tools (institutional repositories, CRIS systems, grant portals) can embed
FWF open-science indicators.

**Goals:**
- Versioned REST API (`/api/v1/...`) with OpenAPI 3.0 specification
- API key authentication with rate limiting
- Embeddable badge endpoint (SVG) for OA rate, e.g.:
  `GET /api/v1/badge/oa-rate?institution=<ror-id>` → SVG badge
- Webhook support: notify subscribers when new ETL data is available
- Interactive API documentation page (Swagger UI or Scalar)

**Technical work:**
- Add API key table to the database (`api_keys`: `key_hash`, `owner`, `rate_limit`)
- Middleware for key validation and rate limiting
- OpenAPI spec generated from TypeScript types (e.g. `zod-to-openapi`)
- Badge endpoint renders SVG with current metric value, styled like shields.io
- Webhook dispatcher: after each ETL run, POST to registered URLs

---

## Out of Scope (intentionally)

The following will not be added to the core project to keep it focused:

- **User accounts / authentication** — the data is CC0-licensed and public;
  a login wall would undermine the open-science mission
- **Real-time data** — the FWF API is updated daily; sub-daily freshness adds
  infrastructure complexity with no user benefit
- **Full-text PDF indexing** — out of scope for a metadata monitor
- **Machine-learning recommendations** — feature creep; keep the tool descriptive not prescriptive

---

## Contributing to the Roadmap

Have ideas for new phases or features? Open a
[feature request](https://github.com/qtan-tran/fwf-open-science-monitor/issues/new?template=feature_request.md)
and tag it `roadmap`. Upvote existing requests with 👍 to signal priority.
