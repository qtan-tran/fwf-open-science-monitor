# 🔬 Moniteur de Science Ouverte FWF

[![Next.js 16](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=flat-square&logo=docker)](https://www.docker.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](http://makeapullrequest.com)

🌍 Langues :  
🇬🇧 [English](README.md) | 🇫🇷 Français | 🇩🇪 [Deutsch](README.de.md) | 🇻🇳 [Tiếng Việt](README.vi.md)

Un tableau de bord full-stack qui permet de suivre, de manière claire et concrète, le respect des pratiques de science ouverte à travers des milliers de projets financés par le [FWF](https://www.fwf.ac.at/en/).

---

## 🏛️ Origines et Auteurs
Ce dépôt a été créé et est maintenu par **Quoc-Tan Tran**, Chercheur en Science Ouverte à la **Faculté de Sociologie, Université de Bielefeld**, avec l'assistance technique de **Claude AI**.

Tout a commencé par une tentative simple : donner du sens aux données de financement, de manière à ce que d’autres puissent aussi les comprendre, les suivre et les réutiliser. L’objectif n’est pas de construire un système parfait, mais de montrer que, même avec des pipelines automatisés simples et des outils web accessibles, il est déjà possible de rendre les financements de la recherche et leurs résultats plus transparents et plus faciles à explorer.

---

## ⚡ La Vision
L’ambition est volontairement claire : transformer des données de financement brutes et désordonnées en quelque chose de lisible et compréhensible. En mettant en lumière des éléments comme les taux d’accès ouvert, les tendances de publication ou encore l’activité des institutions, ce monitor cherche à offrir une vision plus nette de ce qui se passe réellement, avec l’espoir de contribuer, concrètement, à une science plus ouverte et reproductible.

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

## ✨ Fonctionnalités Principales

- **📊 Dashboard à 6 indicateurs** — Affiche les métriques importantes (taux d’accès ouvert, efficacité du financement) avec des graphiques interactifs (Recharts).
- **🔍 Exploration détaillée** — 10 modes d’analyse différents, dont la recherche de chercheurs, l’analyse des publications et des graphiques de financement.
- **⚡ Traitement rapide des données** — Pipeline en Python 3.12 qui met à jour, nettoie et calcule les données chaque jour depuis l’API FWF Open Research.
- **🚀 Prêt pour la production** — Cache en mémoire (5 minutes), sécurité des types avec Prisma, et mode sombre adapté au système.
- **📦 Lancement en une commande** — Environnement Docker prêt à l’emploi pour développer et tester rapidement en local.

---

## 🚀 Démarrage Rapide (Localhost)

### Prérequis

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installé et en cours d'exécution
- [Node.js](https://nodejs.org/) v20+
- [Python 3](https://www.python.org/) (nécessaire uniquement pour le pipeline ETL)
- [Git](https://git-scm.com/)

### 1. Cloner et Configurer

```bash
git clone https://github.com/qtan-tran/fwf-open-science-monitor.git
cd fwf-open-science-monitor
```

Copier le fichier d'environnement exemple :

- **macOS / Linux :** `cp .env.example .env`
- **Windows (PowerShell) :** `Copy-Item .env.example .env`

Éditer `.env` et ajouter votre clé API FWF (obtenez-la sur https://openapi.fwf.ac.at/fwfkey) :

```
FWF_API_KEY=votre_clé_ici
```

> **Note :** La clé API n'est requise que pour exécuter le pipeline ETL. Vous pouvez naviguer dans le tableau de bord sans elle (il affichera des graphiques vides jusqu'à ce que les données soient chargées).

### 2. Démarrer la Base de Données

```bash
docker compose up db -d
```

Attendre quelques secondes que PostgreSQL soit prêt.

### 3. Installer les Dépendances et Configurer le Schéma

```bash
cd apps/web
npm install
npx prisma generate
npx prisma db push
cd ../..
```

### 4. Démarrer l'App

```bash
cd apps/web
npm run dev
```

Ouvrir [http://localhost:3000](http://localhost:3000).

> **💡 Conseil :** La base de données démarre vide. Pour voir des données réelles, exécutez le pipeline ETL (voir [Guide ETL](#-guide-etl) ci-dessous) pour synchroniser les données en direct depuis l'API FWF, ou chargez un `seed/seed.sql` pré-construit s'il est disponible (voir [Chargement des Données de Graine](#chargement-des-données-de-graine) ci-dessous).

---

## Chargement des Données de Graine

Un fichier `seed/seed.sql` n'est pas inclus dans le dépôt — il est généré en exécutant le pipeline ETL au moins une fois. Après que l'ETL ait fonctionné, vous pouvez exporter un snapshot pour des chargements futurs plus rapides :

```bash
# Exporter un snapshot de graine (macOS/Linux) :
docker compose exec db pg_dump -U postgres fwf_monitor > seed/seed.sql

# Exporter un snapshot de graine (Windows PowerShell) :
docker exec (docker compose ps -q db) pg_dump -U postgres fwf_monitor | Out-File -Encoding utf8 seed/seed.sql
```

Une fois que vous avez un `seed/seed.sql`, chargez-le avec :

**macOS / Linux (script de commodité — gère automatiquement les deux chemins) :**
```bash
./seed/load_seed.sh
```

**macOS / Linux (manuel, avec psql installé localement) :**
```bash
psql "$DATABASE_URL" -f seed/seed.sql
```

**macOS / Linux (via Docker, pas besoin de psql local) :**
```bash
docker compose exec -T db psql -U postgres -d fwf_monitor < seed/seed.sql
```

**Windows (PowerShell, via Docker) :**
```powershell
Get-Content seed/seed.sql | docker exec -i (docker compose ps -q db) psql -U postgres -d fwf_monitor
```

**Ou utilisez n'importe quelle interface graphique de base de données** (pgAdmin, DBeaver, DataGrip) : connectez-vous à `localhost:5432`, utilisateur `postgres`, mot de passe `postgres`, base de données `fwf_monitor`, et exécutez le contenu de `seed/seed.sql`.

---

## 🛠 Pile Technologique

| Couche | Technologie | Pourquoi ? |
|------|-----------|------|
| **Frontend** | **Next.js 16 (App Router)** | Performance de classe mondiale et SEO pour les tableaux de bord. |
| **Styling** | **Tailwind CSS 4** | Design utility-first pour une UI propre et moderne. |
| **Backend** | **PostgreSQL + Prisma** | Données relationnelles robustes avec un ORM sécurisé par types. |
| **Pipeline** | **Python 3.12 + Pytest** | Traitement de données rapide avec 240+ tests unitaires pour la fiabilité. |
| **CI / CD** | **GitHub Actions** | Linting automatisé, vérification de types et planification ETL quotidienne. |

---

## 📂 Architecture du Projet

```text
fwf-open-science-monitor/
├── apps/web/           # Frontend Next.js 16
│   ├── prisma/         #   Schéma de base de données (schema.prisma)
│   ├── src/app/        #   App Router : pages + routes API
│   └── components/     #   Composants UI et graphiques réutilisables
├── etl/                # Pipeline de données Python
│   ├── src/            #   Orchestrateur, Nettoyeur & calcul de métriques
│   └── tests/          #   Suite pytest complète
├── .github/workflows/  # Pipelines CI + planification ETL quotidienne
└── docker-compose.yml  # Orchestration locale
```

---

## 🔄 Guide ETL

Le pipeline ETL récupère les données depuis l'API FWF Open Research, les nettoie et remplit la base de données PostgreSQL.

### Prérequis

1. **Obtenir une Clé API :** Prenez une clé gratuite sur https://openapi.fwf.ac.at/fwfkey
2. **Configurer :** Ouvrez votre `.env` et définissez `FWF_API_KEY=votre_clé_ici`
3. **Base de données en cours d'exécution et schéma appliqué** (voir les étapes Démarrage Rapide 2–3 ci-dessus)

### Option A : Exécuter via Docker (pas besoin de configuration Python)

```bash
docker compose run --rm etl
```

### Option B : Exécuter nativement (itération plus rapide, pas de build Docker requis)

**macOS / Linux :**
```bash
cd etl
pip install -r requirements.txt
python -m src.pipeline
```

**Windows (PowerShell) :**
```powershell
cd etl
pip install -r requirements.txt   # utiliser --user si l'installation globale est bloquée
python -m src.pipeline
```

> **Conseil :** Après la fin de l'ETL, exportez un snapshot `seed/seed.sql` pour des chargements futurs plus rapides (voir [Chargement des Données de Graine](#chargement-des-données-de-graine) ci-dessus).

---

## 🤝 Contribution

Les contributions sont les bienvenues ! Si vous voulez améliorer les graphiques, ajouter un nouveau mode "Explorer", ou corriger un bug :

1. **Forkez** le dépôt  
2. **Créez** votre branche de fonctionnalité :
   ```bash
   git checkout -b feature/FonctionnalitéIncroyable
   ```
3. **Commitez** vos changements en utilisant [Conventional Commits](https://www.conventionalcommits.org/)  
4. **Poussez** vers la branche et ouvrez une Pull Request  

---

## 📜 Licence et Attribution des Données

- **Code :** Distribué sous la **Licence MIT**  
- **Source de Données :** https://openapi.fwf.ac.at — Données fournies par le Fonds Autrichien pour la Science (FWF) sous CC0  
- **Identifiants :** Données institutionnelles supportées par https://ror.org et https://orcid.org  

---

**Construit avec ❤️ pour la Science Ouverte.**  
*Si vous trouvez ce projet utile, pensez à donner une ⭐ pour aider les autres à le trouver !*
