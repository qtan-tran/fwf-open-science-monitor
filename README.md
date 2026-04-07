# 🔬 FWF Open Science Monitor

[![Next.js 16](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=flat-square&logo=docker)](https://www.docker.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](http://makeapullrequest.com)

A full-stack dashboard tracking open-science compliance across thousands of [FWF](https://www.fwf.ac.at/en/)-funded research projects. 

---

## 🏛️ Origins & Authorship
This repository was created and is maintained by **Quoc-Tan Tran**, Open Science Researcher at the **Faculty of Sociology, Bielefeld University**, with the technical assistance of **Claude AI**. 

It is designed to serve as a reproducible research infrastructure, demonstrating how automated pipelines and modern web technologies can enhance transparency in research funding and scientific outputs.

---

## ⚡ The Vision
This monitor bridges the gap between raw funding data and actionable insights. It visualizes open access rates, output trends, and institutional rankings to support the global move toward open, reproducible science.

```text
┌──────────────────────────────────────────────────────────────────────┐
│  Dashboard  │  Projects  │  Institutions  │  Explore  │  Export      │
├──────────────────────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐            │
│  │ 1,500    │  │ 12,000   │  │ 80       │  │ 67.5%    │            │
│  │ Projects │  │ Outputs  │  │ Instits  │  │ OA Rate  │            │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘            │
│                                                                      │
│  OA Rate Over Time          Projects by Year                         │
│  ┌──────────────────────┐   ┌──────────────────────┐                 │
│  │  ▁▂▃▄▅▆▇█           │   │  ▂▃▄▅▄▆▇█▇▆          │                 │
│  └──────────────────────┘   └──────────────────────┘                 │
└──────────────────────────────────────────────────────────────────────┘
```

## ✨ Key Features

- **📊 Six-Axis Dashboard** — Headline metrics (OA rates, funding efficiency) with interactive Recharts visualizations.
- **🔍 Deep-Dive Explorer** — 10 unique analysis modes including researcher search, publication breakdowns, and funding scatter plots.
- **⚡ High-Performance ETL** — Python 3.12 pipeline that daily syncs, cleans, and computes metrics from the FWF Open Research API.
- **🚀 Production Ready** — In-memory LRU caching (5-min TTL), full type-safety with Prisma, and system-aware Dark Mode.
- **📦 One-Command Setup** — Fully containerized environment for instant local development and testing.

---

## 🚀 Quick Start (Localhost)

### Prerequisites

Ensure you have Docker Desktop installed and running.

### 1. Clone & Initialize

```bash
git clone https://github.com/qtan-tran/fwf-open-science-monitor.git
cd fwf-open-science-monitor
cp .env.example .env
```

### 2. Launch Stack

```bash
docker compose up -d
```

### 3. Setup Database & Browse

```bash
docker compose exec web npx prisma migrate deploy
# Open http://localhost:3000
```

> [!TIP]  
> The database starts empty. To see real data, follow the ETL Guide below to sync from the official FWF API.

---

## 🛠 Tech Stack

| Layer | Technology | Why? |
|------|-----------|------|
| **Frontend** | **Next.js 16 (App Router)** | Best-in-class performance and SEO for dashboards. |
| **Styling** | **Tailwind CSS 4** | Utility-first design for a clean, modern UI. |
| **Backend** | **PostgreSQL + Prisma** | Robust relational data with a type-safe ORM. |
| **Pipeline** | **Python 3.12 + Pytest** | Fast data processing with 240+ unit tests for reliability. |
| **CI / CD** | **GitHub Actions** | Automated linting, type-checking, and ETL scheduling. |

---

## 📂 Project Architecture

```text
fwf-open-science-monitor/
├── apps/web/           # Next.js 16 frontend
│   ├── prisma/         #   Database schema and migrations
│   ├── src/app/        #   App Router: pages + API routes
│   └── components/     #   Reusable UI & Chart components
├── etl/                # Python data pipeline
│   ├── src/            #   Orchestrator, Cleaner, & Metric computation
│   └── tests/          #   Comprehensive pytest suite
├── .github/workflows/  # CI pipelines + Daily ETL schedule
└── docker-compose.yml  # Local orchestration
```

---

## 🔄 Running the ETL

The ETL pipeline fetches data from the FWF Open Research API, cleans it, and populates the PostgreSQL database.

1. **Get an API Key:** Grab a free key at https://openapi.fwf.ac.at/fwfkey  
2. **Configure:** Open your `.env` and set:
   ```bash
   FWF_API_KEY=your_key_here
   ```
3. **Run Pipeline:**
   ```bash
   docker compose run --rm etl
   ```

---

## 🤝 Contributing

Contributions are welcome! If you want to improve the charts, add a new "Explore" mode, or fix a bug:

1. **Fork** the repository  
2. **Create** your feature branch:
   ```bash
   git checkout -b feature/AmazingFeature
   ```
3. **Commit** your changes using [Conventional Commits](https://www.conventionalcommits.org/)  
4. **Push** to the branch and open a Pull Request  

---

## 📜 License & Data Attribution

- **Code:** Released under the **MIT License**  
- **Data Source:** https://openapi.fwf.ac.at — Data provided by the Austrian Science Fund (FWF) under CC0  
- **Identifiers:** Institutional data supported by https://ror.org and https://orcid.org  

---

**Built with ❤️ for Open Science.**  
*If you find this project useful, please consider giving it a ⭐ to help others find it!*
