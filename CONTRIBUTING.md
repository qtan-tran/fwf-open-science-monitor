# Contributing to FWF Open Science Monitor

Thank you for taking the time to contribute. This document covers everything
you need to go from zero to a merged pull request.

---

## Table of Contents

1. [Code of Conduct](#code-of-conduct)
2. [Development Environment Setup](#development-environment-setup)
3. [Branch Naming Convention](#branch-naming-convention)
4. [Making Changes](#making-changes)
5. [Pull Request Checklist](#pull-request-checklist)
6. [Testing Requirements](#testing-requirements)
7. [Code Style](#code-style)
8. [Issue Templates](#issue-templates)
9. [Questions](#questions)

---

## Code of Conduct

This project follows the
[Contributor Covenant Code of Conduct v2.1](https://www.contributor-covenant.org/version/2/1/code_of_conduct/).
By participating you agree to uphold it. Report unacceptable behaviour to the
maintainers via a GitHub issue marked **private** or by email.

---

## Development Environment Setup

### Prerequisites

| Tool | Version | Install |
|---|---|---|
| Git | any recent | <https://git-scm.com> |
| Docker Desktop | v4.x+ | <https://docs.docker.com/get-docker/> |
| Node.js | 20 LTS | <https://nodejs.org> or `nvm install 20` |
| Python | 3.12+ | <https://python.org> or `pyenv install 3.12` |

### First-time setup

```bash
# 1. Fork the repo on GitHub, then clone your fork
git clone https://github.com/<your-username>/fwf-open-science-monitor.git
cd fwf-open-science-monitor

# 2. Add the upstream remote
git remote add upstream https://github.com/qtan-tran/fwf-open-science-monitor.git

# 3. Copy environment variables
# macOS / Linux
cp .env.example .env
# Windows (PowerShell)
Copy-Item .env.example .env
# Edit .env if you want to run the ETL (FWF_API_KEY is optional for UI work)

# 4. Start the database
docker compose up db -d

# 5. Set up the web app
cd apps/web
npm install
npx prisma generate
npx prisma db push
npm run dev          # → http://localhost:3000

# 6. Set up the ETL (only needed for ETL work)
cd ../../etl
pip install -r requirements.txt
pip install pytest   # test runner
```

### Keeping your fork up to date

```bash
git fetch upstream
git rebase upstream/main
```

---

## Branch Naming Convention

Branches must be prefixed by type:

| Prefix | Use for |
|---|---|
| `feat/` | New feature or exploration mode |
| `fix/` | Bug fix |
| `docs/` | Documentation only |
| `refactor/` | Internal restructuring without behaviour change |
| `test/` | Adding or fixing tests |
| `chore/` | Dependency updates, CI changes, tooling |

**Examples:**

```
feat/dfg-integration
fix/oa-rate-null-crash
docs/extending-guide
refactor/metric-computer-extract
test/export-route-coverage
chore/bump-prisma-5.23
```

Use kebab-case. Keep the slug short (≤ 40 characters). No branch should stay
open longer than two weeks without activity — stale branches will be closed.

---

## Making Changes

1. **Branch** off `main`:
   ```bash
   git checkout main
   git pull upstream main
   git checkout -b feat/my-feature
   ```

2. **Make your changes.** See the [docs/extending.md](docs/extending.md) guide
   for common tasks (new mode, new metric, new data source).

3. **Write tests.** See [Testing Requirements](#testing-requirements) below.

4. **Run linting and type-checking** before pushing:
   ```bash
   # Web
   cd apps/web
   npx next lint
   npx tsc --noEmit
   npm test

   # ETL
   cd etl
   python -m pytest
   ```

5. **Commit** with a clear message:
   ```bash
   git commit -m "feat: add co-funding landscape explore mode"
   ```
   Follow [Conventional Commits](https://www.conventionalcommits.org/):
   `type(scope): short description` — scope is optional but helpful
   (e.g. `fix(export): handle null approvedAmount`).

6. **Push** to your fork and open a pull request against `main`.

---

## Pull Request Checklist

Before marking your PR ready for review, confirm every item:

**General**
- [ ] The PR title follows Conventional Commits format
- [ ] The description explains *what* changed and *why* (not just *how*)
- [ ] Related issues are linked with `Closes #123` or `Fixes #123`
- [ ] No unrelated changes are included (scope is focused)

**Tests**
- [ ] New or changed functionality has tests
- [ ] All existing tests pass (`npm test` and `python -m pytest`)
- [ ] Coverage has not decreased (check `npm run test:coverage`)

**Frontend**
- [ ] New API routes handle invalid parameters with a 400 response
- [ ] New UI components handle empty/loading/error states
- [ ] New components work on both light and dark backgrounds
- [ ] No TypeScript errors (`npx tsc --noEmit` passes)
- [ ] No new ESLint warnings (`npx next lint` passes)

**ETL**
- [ ] New metrics are registered in `MetricComputer.compute_all()`
- [ ] New ETL steps are isolated (a failure does not stop subsequent steps)
- [ ] ETL tests mock the database (no live DB required)

**Documentation**
- [ ] Public API changes are reflected in `README.md`
- [ ] New exploration modes are documented in `docs/exploration-modes.md`
- [ ] New extension points are documented in `docs/extending.md`

---

## Testing Requirements

### Web (Vitest)

- **API routes** must have unit tests mocking `@/lib/prisma` and `@/lib/cache`.
  See `apps/web/src/app/api/__tests__/test_metrics_summary.test.ts` as a
  reference.
- **UI components** must have rendering tests using `@testing-library/react`.
  At minimum: renders without crashing, renders key content, handles empty state.
- **Coverage thresholds** (enforced in `vitest.config.ts`):
  - API routes: 70% lines, 70% functions, 60% branches
  - UI components: 70% lines, 70% functions, 60% branches

Run: `cd apps/web && npm run test:coverage`

### ETL (pytest)

- **All new `MetricComputer` methods** must have a corresponding test class
  in `etl/tests/test_metrics.py`. Use the `mock_conn` fixture — no live
  database is needed.
- **New pipeline steps** must be tested in `etl/tests/test_pipeline.py`.
- **Coverage target:** 80% for `src/cleaner.py` and `src/metrics.py`.
- Integration tests live in `test_integration.py` and are skipped by default.
  Enable with `RUN_INTEGRATION_TESTS=1`.

Run: `cd etl && python -m pytest -v`

### No flaky tests

Tests must be deterministic. Do not use real timestamps (`datetime.now()`)
or real random values in assertions. Mock `datetime` or pass it as a parameter.

---

## Code Style

### TypeScript / JavaScript

- **Linter:** ESLint via `next lint` (config in `apps/web/.eslintrc.json`).
- **Formatter:** [Prettier](https://prettier.io) — run `npx prettier --write .`
  (or configure your editor to format on save).
- **Conventions:**
  - `const` over `let`; never `var`
  - Named exports over default exports for components
  - `type` over `interface` for simple shapes; `interface` for objects
    that may be extended
  - No `any` — use `unknown` and narrow it, or add a specific type
  - Server components are the default; add `"use client"` only when you
    need browser APIs or React hooks

### Python

- **Formatter:** [Black](https://black.readthedocs.io) — `black etl/`
- **Linter:** [Ruff](https://docs.astral.sh/ruff/) — `ruff check etl/`
  (or Flake8 if you prefer)
- **Conventions:**
  - Type hints on all public function signatures
  - `from __future__ import annotations` at the top of every module
  - No bare `except:` — catch specific exceptions
  - Logger messages use `%s` formatting, not f-strings
    (`logger.info("loaded %d rows", n)`)

### SQL (in ETL)

- Use `ON CONFLICT DO UPDATE` for upserts. Always use `%s` parameter placeholders — never string interpolation.

---

## Issue Templates

Use the templates in `.github/ISSUE_TEMPLATE/`:

- **Bug report** — for unexpected behaviour or crashes
- **Feature request** — for new modes, metrics, or data sources

When filing an issue, provide as much context as possible. For bugs, include
the browser/OS, the URL where it happened, and any console errors.

---

## Questions

Open a GitHub Issue with the label `question` for questions that are not bugs or feature requests.
