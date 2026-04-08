# 🔬 FWF Open Science Monitor

[![Next.js 16](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=flat-square&logo=docker)](https://www.docker.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](http://makeapullrequest.com)

🌍 Sprachen:  
🇬🇧 [English](README.md) | 🇫🇷 [Français](README.fr.md) | 🇩🇪 Deutsch | 🇻🇳 [Tiếng Việt](README.vi.md)

Ein Full-Stack-Dashboard, das transparent und übersichtlich zeigt, wie tausende vom [FWF](https://www.fwf.ac.at/en/) geförderte Forschungsprojekte Open-Science-Prinzipien umsetzen.

---

## 🏛️ Ursprünge und Autorschaft
Dieses Repository wurde erstellt und wird gepflegt von **Quoc-Tan Tran**, Open Science Researcher an der **Fakultät für Soziologie, Universität Bielefeld**, mit technischer Unterstützung von **Claude AI**.

Alles begann als ein kleiner Versuch, Förderdaten so aufzubereiten, dass sie verständlich werden und auch von anderen nachvollzogen und weiterverwendet werden können. Es geht dabei nicht darum, ein perfektes System zu bauen, sondern zu zeigen, dass bereits einfache automatisierte Pipelines und grundlegende Web-Tools ausreichen können, um Forschungsförderung und ihre Ergebnisse transparenter und leichter zugänglich zu machen.

---

## ⚡ Die Vision
Das Ziel ist bewusst einfach gehalten: rohe, unübersichtliche Förderdaten in etwas zu verwandeln, das man tatsächlich ansehen und verstehen kann. Indem Aspekte wie Open-Access-Raten, Publikationstrends und institutionelle Aktivitäten sichtbar gemacht werden, versucht dieser Monitor, ein klareres Bild davon zu vermitteln, was eigentlich passiert, in der Hoffnung, so zu einer offeneren und besser nachvollziehbaren Wissenschaft beizutragen.

```text
┌──────────────────────────────────────────────────────────────────────┐
│  Dashboard  │  Projects  │  Institutions  │  Explore  │  Export      │
├──────────────────────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │ 1,500    │  │ 12,000   │  │ 80       │  │ 67.5%    │              │
│  │ Projects │  │ Outputs  │  │ Instits  │  │ OA Rate  │              │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘              │
│                                                                      │
│  OA Rate Over Time          Projects by Year                         │
│  ┌──────────────────────┐   ┌──────────────────────┐                 │
│  │ ▁▂▃▄▅▆▇█         │   │ ▂▃▄▅▄▆▇█▇▆      │                 │
│  └──────────────────────┘   └──────────────────────┘                 │
└──────────────────────────────────────────────────────────────────────┘
```

## ✨ Wichtige Funktionen

- **📊 Dashboard mit 6 Kennzahlen** — Zeigt wichtige Metriken (Open-Access-Raten, Effizienz der Förderung) mit interaktiven Diagrammen (Recharts).
- **🔍 Detaillierte Analyse** — 10 verschiedene Analysemodi, z. B. Forschersuche, Auswertung von Publikationen und Finanzierungsdiagramme.
- **⚡ Schnelle Datenverarbeitung** — Python-3.12-Pipeline, die Daten täglich aus der FWF Open Research API lädt, bereinigt und auswertet.
- **🚀 Bereit für den Einsatz** — In-Memory-Cache (5 Minuten), sichere Typen mit Prisma und automatischer Dark Mode.
- **📦 Start mit einem Befehl** — Komplett containerisierte Umgebung (Docker) für schnelle lokale Entwicklung und Tests.
---

## 🚀 Schnellstart (Localhost)

### Voraussetzungen

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installiert und laufend
- [Node.js](https://nodejs.org/) v20+
- [Python 3](https://www.python.org/) (nur für die ETL-Pipeline benötigt)
- [Git](https://git-scm.com/)

### 1. Klonen und Konfigurieren

```bash
git clone https://github.com/qtan-tran/fwf-open-science-monitor.git
cd fwf-open-science-monitor
```

Kopieren Sie die Beispiel-Umgebungsdatei:

- **macOS / Linux:** `cp .env.example .env`
- **Windows (PowerShell):** `Copy-Item .env.example .env`

Bearbeiten Sie `.env` und fügen Sie Ihren FWF-API-Schlüssel hinzu (holen Sie ihn von https://openapi.fwf.ac.at/fwfkey):

```
FWF_API_KEY=ihr_schlüssel_hier
```

> **Hinweis:** Der API-Schlüssel wird nur benötigt, um die ETL-Pipeline auszuführen. Sie können das Dashboard ohne ihn durchsuchen (es zeigt leere Diagramme an, bis Daten geladen sind).

### 2. Datenbank starten

```bash
docker compose up db -d
```

Warten Sie ein paar Sekunden, bis PostgreSQL bereit ist.

### 3. Abhängigkeiten installieren und Schema einrichten

```bash
cd apps/web
npm install
npx prisma generate
npx prisma db push
cd ../..
```

### 4. App starten

```bash
cd apps/web
npm run dev
```

Öffnen Sie [http://localhost:3000](http://localhost:3000).

> **💡 Tipp:** Die Datenbank startet leer. Um echte Daten zu sehen, führen Sie die ETL-Pipeline aus (siehe [ETL-Leitfaden](#-etl-leitfaden) unten), um Live-Daten von der FWF-API zu synchronisieren, oder laden Sie eine vorgefertigte `seed/seed.sql`, falls verfügbar (siehe [Seed-Daten laden](#seed-daten-laden) unten).

---

## Seed-Daten laden

Eine `seed/seed.sql`-Datei ist nicht im Repository enthalten — sie wird generiert, indem die ETL-Pipeline mindestens einmal ausgeführt wird. Nachdem die ETL gelaufen ist, können Sie einen Snapshot für schnellere zukünftige Ladevorgänge exportieren:

```bash
# Seed-Snapshot exportieren (macOS/Linux):
docker compose exec db pg_dump -U postgres fwf_monitor > seed/seed.sql

# Seed-Snapshot exportieren (Windows PowerShell):
docker exec (docker compose ps -q db) pg_dump -U postgres fwf_monitor | Out-File -Encoding utf8 seed/seed.sql
```

Sobald Sie eine `seed/seed.sql` haben, laden Sie sie mit:

**macOS / Linux (Komfort-Skript — behandelt beide Pfade automatisch):**
```bash
./seed/load_seed.sh
```

**macOS / Linux (manuell, mit lokal installiertem psql):**
```bash
psql "$DATABASE_URL" -f seed/seed.sql
```

**macOS / Linux (via Docker, kein lokales psql benötigt):**
```bash
docker compose exec -T db psql -U postgres -d fwf_monitor < seed/seed.sql
```

**Windows (PowerShell, via Docker):**
```powershell
Get-Content seed/seed.sql | docker exec -i (docker compose ps -q db) psql -U postgres -d fwf_monitor
```

**Oder verwenden Sie eine beliebige Datenbank-GUI** (pgAdmin, DBeaver, DataGrip): Verbinden Sie sich mit `localhost:5432`, Benutzer `postgres`, Passwort `postgres`, Datenbank `fwf_monitor`, und führen Sie den Inhalt von `seed/seed.sql` aus.

---

## 🛠 Tech-Stack

| Ebene | Technologie | Warum? |
|------|-----------|------|
| **Frontend** | **Next.js 16 (App Router)** | Weltklasse-Performance und SEO für Dashboards. |
| **Styling** | **Tailwind CSS 4** | Utility-first-Design für eine saubere, moderne UI. |
| **Backend** | **PostgreSQL + Prisma** | Robuste relationale Daten mit einem typsicheren ORM. |
| **Pipeline** | **Python 3.12 + Pytest** | Schnelle Datenverarbeitung mit 240+ Unit-Tests für Zuverlässigkeit. |
| **CI / CD** | **GitHub Actions** | Automatisierte Linting, Typprüfung und ETL-Planung. |

---

## 📂 Projektarchitektur

```text
fwf-open-science-monitor/
├── apps/web/           # Next.js 16 Frontend
│   ├── prisma/         #   Datenbankschema (schema.prisma)
│   ├── src/app/        #   App Router: Seiten + API-Routen
│   └── components/     #   Wiederverwendbare UI- & Chart-Komponenten
├── etl/                # Python Datenpipeline
│   ├── src/            #   Orchestrator, Cleaner & Metrikberechnung
│   └── tests/          #   Umfassende pytest-Suite
├── .github/workflows/  # CI-Pipelines + tägliche ETL-Planung
└── docker-compose.yml  # Lokale Orchestrierung
```

---

## 🔄 ETL-Leitfaden

Die ETL-Pipeline holt Daten von der FWF Open Research API, bereinigt sie und füllt die PostgreSQL-Datenbank.

### Voraussetzungen

1. **API-Schlüssel erhalten:** Holen Sie sich einen kostenlosen Schlüssel auf https://openapi.fwf.ac.at/fwfkey
2. **Konfigurieren:** Öffnen Sie Ihre `.env` und setzen Sie `FWF_API_KEY=ihr_schlüssel_hier`
3. **Datenbank läuft und Schema angewendet** (siehe Schnellstart-Schritte 2–3 oben)

### Option A: Via Docker ausführen (kein Python-Setup benötigt)

```bash
docker compose run --rm etl
```

### Option B: Natürlich ausführen (schnellere Iteration, kein Docker-Build erforderlich)

**macOS / Linux:**
```bash
cd etl
pip install -r requirements.txt
python -m src.pipeline
```

**Windows (PowerShell):**
```powershell
cd etl
pip install -r requirements.txt   # --user verwenden, wenn globale Installation blockiert ist
python -m src.pipeline
```

> **Tipp:** Nach Abschluss der ETL exportieren Sie einen `seed/seed.sql`-Snapshot für schnellere zukünftige Ladevorgänge (siehe [Seed-Daten laden](#seed-daten-laden) oben).

---

## 🤝 Mitwirken

Beiträge sind willkommen! Wenn Sie die Diagramme verbessern, einen neuen "Explore"-Modus hinzufügen oder einen Bug beheben möchten:

1. **Forken** Sie das Repository  
2. **Erstellen** Sie Ihren Feature-Branch:
   ```bash
   git checkout -b feature/TolleFunktion
   ```
3. **Committen** Sie Ihre Änderungen mit [Conventional Commits](https://www.conventionalcommits.org/)  
4. **Pushen** Sie zum Branch und öffnen Sie eine Pull Request  

---

## 📜 Lizenz und Datenattribution

- **Code:** Veröffentlicht unter der **MIT-Lizenz**  
- **Datenquelle:** https://openapi.fwf.ac.at — Daten bereitgestellt vom Österreichischen Wissenschaftsfonds (FWF) unter CC0  
- **Identifikatoren:** Institutionelle Daten unterstützt von https://ror.org und https://orcid.org  

---

**Gebaut mit ❤️ für Open Science.**  
*Dieses Projekt ist ein Versuch, Open-Science-Daten zugänglicher und leichter erkundbar zu machen. Wenn es für Sie nützlich ist, freue ich mich über ein ⭐.*
