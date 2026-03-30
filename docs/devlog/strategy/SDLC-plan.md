# Parthenon SDLC — Continuous Development Plan

**Purpose:** Defines how Parthenon is developed, tested, documented, released, and maintained on an ongoing basis — from daily development practice through versioned releases and long-term platform evolution.

---

## 1. Guiding Principles

**1. Clinical correctness over velocity.** A wrong cohort definition or miscalculated incidence rate invalidates a study. Ship nothing that hasn't been tested against known data. Eunomia is the ground truth.

**2. Documentation is not optional.** Every shipped feature must be reachable from the user manual, from in-app help, and from the API reference before the release tag is cut. Undocumented features are incomplete features.

**3. The platform replaces a fragmented ecosystem.** Every Parthenon release should eliminate at least one tool a researcher previously needed to run separately. Progress is measured by Atlas parity, HADES coverage, and OMOP extension support.

**4. One codebase, one deploy command.** `./deploy.sh` is the authoritative deployment action. CI is the authoritative quality gate. No manual server patching.

**5. Backward compatibility for research artifacts.** Cohort definitions, concept sets, and study packages created by users must survive upgrades without modification. API changes that break existing JSON formats require a migration path.

---

## 2. Repository Layout

```
sudoshi/Parthenon/
├── backend/          Laravel 11, PHP 8.4
├── frontend/         React 19, TypeScript, Vite 7
├── ai/               Python 3.12, FastAPI
├── darkstar/         R 4.4, Plumber (was r-runtime)
├── poseidon/         Dagster + dbt data lakehouse
├── docker/           Dockerfiles + nginx config
├── acropolis/        Infrastructure layer (Traefik, Portainer, pgAdmin, Enterprise)
│   └── installer/    Acropolis 9-phase infrastructure installer
├── installer/        Parthenon application installer
├── docs/
│   ├── site/         Docusaurus v3 user manual
│   ├── devlog/       Devlogs by module, phase, and topic
│   └── SDLC-plan.md           ← this file
├── install.py        Bootstrap entry point (--upgrade, --with-infrastructure)
├── ROADMAP.md        Public roadmap (v1.0.x → v2.0)
├── deploy.sh
└── docker-compose.yml
```

---

## 3. Versioning

Parthenon uses **semantic versioning** (SemVer): `MAJOR.MINOR.PATCH`.

| Increment | When |
|-----------|------|
| `MAJOR` | Breaking API changes, incompatible migration required, major architecture change |
| `MINOR` | New feature phase delivered, new OMOP extension, new analytical module |
| `PATCH` | Bug fixes, dependency updates, security patches, documentation corrections |

**Current version map:**

| Version | Date | Milestone |
|---------|------|-----------|
| 0.1.0–0.9.0 | Feb–Mar 2026 | Pre-release development (Phases 1–13) |
| 1.0.0 | 2026-03-23 | Installer + dataset acquisition TUI, GHCR registry |
| 1.0.3 | 2026-03-30 | **Foundation Release** — public launch baseline |
| 1.0.4 | TBD | Test Coverage & CI Hardening |
| 1.0.5 | TBD | Data Quality & Validation |
| 1.0.6 | TBD | Performance Optimization |
| 1.0.7 | TBD | UX Polish & Accessibility |
| 1.0.8 | TBD | Documentation & Onboarding |
| 1.0.9 | TBD | Security Audit & Hardening |
| 1.0.10 | 2026-05-11 | Release Candidate — stabilization complete |
| 1.1 | TBD | Federation & Multi-Site Studies |
| 1.2 | TBD | Advanced AI & Natural Language Research |
| 1.3 | TBD | Real-World Evidence & Regulatory |
| 1.4 | TBD | Advanced Analytics & Visualization |
| 1.5 | TBD | Ecosystem & Interoperability |
| 2.0 | Late 2026 | General Availability — Cloud + Workstation |

**Release rules:**
- **v1.0.x (stabilization):** No new features. Testing, debugging, optimization, polish only. Weekly cadence.
- **v1.x (feature):** New capabilities. Each minor version requires full test + documentation loop.
- **Patch releases:** Bug fixes, dependency updates. Must update changelog. May ship without new documentation chapters.

See [ROADMAP.md](/ROADMAP.md) for detailed release descriptions.

---

## 4. Branch Model

```
main
 │
 ├── feature/federation-engine          ← v1.1 feature work
 ├── feature/description                ← general features
 ├── fix/incidence-rate-year-boundary   ← bug fixes
 ├── chore/upgrade-docusaurus-3.8       ← deps / maintenance
 └── release/1.1.0                      ← release branch (PDF CI triggers here)
```

**Rules:**

- `main` is always deployable. Never push broken code to `main`.
- All feature work happens on `feature/{description}` branches.
- Feature branches are created from `main`, merged back to `main` via PR.
- During the v1.0.x stabilization arc, work happens directly on `main` (weekly releases, no feature branches needed for fixes/tests/polish).
- Release branches (`release/X.Y.Z`) are cut from `main` for v1.x+ feature releases.
- Tags follow `vX.Y.Z` convention: `gh release create v1.0.4 --target main`.
- Hotfixes: branch from `main`, fix, merge to `main`, patch-version tag.

---

## 5. Development Workflow

### 5.1 Starting New Work

```bash
# For v1.0.x stabilization (fixes, tests, polish) — work on main
git checkout main && git pull
# Make changes, commit, push

# For v1.x feature work — branch
git checkout main && git pull
git checkout -b feature/federation-engine

# Review the ROADMAP.md for the target version's scope
# Create a devlog: docs/devlog/modules/{module}/{topic}.md

# Begin implementation (models → migrations → services → controllers → routes → frontend)
```

### 5.2 Daily Development Loop

```bash
# Backend changes
docker compose exec php php artisan route:clear
docker compose exec php php artisan config:clear
# (or ./deploy.sh --php for a full cache rebuild)

# Frontend changes — rebuild for production (Apache serves dist)
docker compose exec node sh -c "cd /app && npx vite build"
# For development iteration, use Vite dev server (port 5175)

# Verify static analysis before committing
cd backend && ./vendor/bin/pint && ./vendor/bin/phpstan analyse
cd frontend && npx tsc --noEmit && npm run lint
```

### 5.3 Committing

```bash
# Never commit secrets
git add backend/ frontend/ docker/ docs/  # be specific
git status  # verify: no .claudeapikey, .resendapikey, .env files staged

git commit -m "$(cat <<'EOF'
feat(risk-scores): add cohort-scoped execution engine with eligibility checks

- RiskScoreExecutionService with per-score CDM validation
- Eligibility API endpoint returning data availability per score
- Score catalogue with detail modal and run configuration
EOF
)"
```

**Commit message conventions:**

| Prefix | Use |
|--------|-----|
| `feat:` | New feature or capability |
| `fix:` | Bug fix |
| `chore:` | Dependency update, tooling, CI change |
| `docs:` | Documentation only |
| `test:` | Test additions or fixes |
| `refactor:` | Code restructuring, no behavior change |

### 5.4 Releasing a Version

**v1.0.x stabilization releases (weekly):**
1. Verify all changes committed and pushed to `main`
2. CI must be **fully green**
3. Update `backend/resources/changelog.md` with version entry
4. Create release: `gh release create v1.0.X --title "..." --notes-file docs/devlog/releases/vX.Y.Z-release-notes.md`
5. Run `./deploy.sh` on the production server

**v1.x feature releases:**
1. Run the full test + documentation checklist
2. Push feature branch, open PR, CI must be green
3. Merge to `main` (fast-forward preferred; rebase if needed)
4. Update `backend/resources/changelog.md` with version entry
5. Create release: `gh release create v1.X.0 --title "..." --notes-file ...`
6. Run `./deploy.sh` on the production server

**Every release must produce two artifacts:**
- GitHub release notes (full technical detail)
- In-app What's New (`backend/resources/changelog.md`, user-facing only)

---

## 6. CI Pipeline

Defined in `.github/workflows/ci.yml`. Runs on every push to `main` and every PR.

### Jobs

| Job | Triggers | What it runs |
|-----|----------|-------------|
| `backend` | always | PHPStan + Pint + Pest (PostgreSQL service) |
| `frontend` | always | TSC + ESLint + Vitest + Vite build |
| `ai` | always | mypy + pytest (CPU torch) |
| `docs-build` | always | Docusaurus `npm run build` |
| `openapi-export` | always | `scribe:generate` + TypeScript compile + type check |
| `docs-pdf` | `release/**` + `v*.*.*` tags | Puppeteer PDF export → artifact |
| `docker` | after backend + frontend + ai + openapi | Docker image builds |

### Adding a new job for a new phase

If a new feature version introduces a new pipeline container (e.g., Python bioinformatics service):

```yaml
genomics-ai:
  name: Genomics AI Service
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-python@v5
      with:
        python-version: "3.12"
        cache: pip
        cache-dependency-path: genomics-ai/requirements*.txt
    - run: pip install -r requirements.txt -r requirements-dev.txt
      working-directory: genomics-ai
    - run: mypy app/
      working-directory: genomics-ai
    - run: pytest
      working-directory: genomics-ai
```

Add the new job to the `docker` job's `needs` array.

---

## 7. Deployment

### 7.1 deploy.sh Flags

```bash
./deploy.sh              # full deploy: PHP + DB + frontend + opcache
./deploy.sh --php        # PHP caches only (routes, config, views)
./deploy.sh --frontend   # Vite build only
./deploy.sh --db         # migrations only
./deploy.sh --openapi    # scribe:generate + generate:api-types
./deploy.sh --docs       # docs-build container (Docusaurus)
```

### 7.2 Production Topology

```
HTTPS → Apache reverse proxy (parthenon.acumenus.net)
  ├── /api/*        → Docker nginx:8082 → PHP-FPM
  ├── /docs/api*    → Docker nginx:8082 → static Scribe OpenAPI docs
  ├── /docs/*       → Docker nginx:8082 → static Docusaurus dist
  └── /*            → Apache serves frontend/dist (production Vite build)
```

### 7.3 Adding a New Docker Service

When a new phase introduces a new container (Orthanc for DICOM, genomics-ai, etc.):

1. Add the service definition to `docker-compose.yml` (with `profiles:` if optional)
2. Write a `docker/{service}/Dockerfile`
3. Add the image build step to `ci.yml` under the `docker` job
4. Add a `docker compose exec {service} healthcheck` to `deploy.sh`
5. Document the new container in `docs/SDLC-documentation.md` §9F (migration notes)
6. Add port to the Docker Ports section in `memory/MEMORY.md`

### 7.4 Environment Variables

Every new required `.env` variable must:
1. Have a sensible default in `.env.example` with a comment explaining it
2. Be listed in `docs/SDLC-documentation.md` §9F migration notes
3. Be validated in `AppServiceProvider::boot()` or the relevant service's constructor if missing would cause a silent failure

---

## 8. Database Schema Evolution

### 8.1 Migrations

All schema changes go through Laravel migrations. Never alter a production table manually.

```bash
php artisan make:migration add_genomic_fields_to_measurement
php artisan migrate              # production
php artisan migrate --force      # in deploy.sh (non-interactive)
```

**Naming convention:**

```
YYYY_MM_DD_NNNNNN_{description}.php
2026_04_01_000000_create_genomic_variants_table.php
2026_04_01_000001_create_molecular_sequences_table.php
```

**Rules:**
- Never modify an existing migration that has been deployed. Add a new migration.
- Migrations that drop columns or tables must be announced in the changelog under `### Removed` and included in migration notes.
- `down()` methods must be complete and tested — rollback must work.

### 8.2 OMOP CDM Extension Tables

Some modules extend the CDM with non-standard tables (genomics, imaging, HEOR). These follow the same migration system but live in their respective schemas:

```sql
-- Genomics extension tables (in per-source CDM schema)
CREATE TABLE {schema}.genomic_variant ( ... );
CREATE TABLE {schema}.molecular_sequence ( ... );

-- Imaging extension tables
CREATE TABLE {schema}.image_occurrence ( ... );
CREATE TABLE {schema}.image_feature ( ... );
```

Extension tables have corresponding `CdmModel` subclasses (read-only, abstract base) and `App\Models` Eloquent models (read-write for app-managed records).

### 8.3 Model Factories

Every new table needs a factory before tests can be written. The factory is created alongside the migration and model — never after.

---

## 9. Dependency Management

### 9.1 PHP (Composer)

```bash
# Add a production dependency
docker compose exec php composer require vendor/package

# Add a dev dependency
docker compose exec php composer require --dev vendor/package

# Update all (minor + patch only — review CHANGELOG before major)
docker compose exec php composer update

# Security audit
docker compose exec php composer audit
```

### 9.2 JavaScript (npm)

```bash
# Add production dependency
docker compose exec node sh -c "cd /app && npm install package"

# Add dev dependency
docker compose exec node sh -c "cd /app && npm install --save-dev package"

# Note: react-joyride and any package with React 19 peer dep issues
# require --legacy-peer-deps
docker compose exec node sh -c "cd /app && npm install package --legacy-peer-deps"

# Audit
cd frontend && npm audit
```

### 9.3 Python (pip)

```bash
# Add to requirements.txt (production)
# Add to requirements-dev.txt (testing only)

# Rebuild AI container
docker compose build ai
```

### 9.4 Docusaurus

```bash
cd docs/site

# CRITICAL: @docusaurus/theme-mermaid must be pinned to EXACT same version as @docusaurus/core
# Check core version first:
cat package.json | grep '"@docusaurus/core"'
# Then install matching theme-mermaid version:
npm install @docusaurus/theme-mermaid@{exact-core-version}

# General Docusaurus upgrade
npm install @docusaurus/core@latest @docusaurus/preset-classic@latest
# Then update theme-mermaid to match
npm install @docusaurus/theme-mermaid@{new-version}
# Verify build
npm run build
```

---

## 10. Monitoring & Observability

### 10.1 Application Health

- **`GET /api/health`** — public endpoint, returns 200 if Laravel is running
- **`GET /api/v1/admin/system-health`** — authenticated, returns status of all 5 services (DB, Redis, CDM DB, Horizon, AI)
- **System Health Dashboard** at `/admin/system-health` — 30s auto-refresh, shows service up/down + response time

### 10.2 Queue Monitoring

- **Laravel Horizon** at `/horizon` (admin-only) — shows queue throughput, failed jobs, worker status
- Failed jobs: `php artisan queue:failed` — investigate and retry with `queue:retry {id}`
- Long-running jobs: timeout set per job class. If a job exceeds timeout, it's re-queued (max 3 attempts before failure)

### 10.3 Logging

```bash
# Laravel log (last 100 lines)
docker compose exec php tail -100 storage/logs/laravel.log

# Nginx access log
docker compose exec nginx tail -100 /var/log/nginx/access.log

# Horizon worker log
docker compose exec horizon cat storage/logs/worker.log
```

### 10.4 Performance

- Slow query log: enabled in PostgreSQL with `log_min_duration_statement = 1000` (1s)
- N+1 detection: Laravel Debugbar enabled in dev (`APP_DEBUG=true`)
- Achilles queries against 710M measurements: all production queries must use indexes on `person_id`, `condition_concept_id`, `drug_concept_id`, `measurement_concept_id`

### 10.5 Adding Observability for a New Service

When a new service is added:
1. Add the service to the `SystemHealthController` service checks
2. Add a health card to the `SystemHealthPage.tsx` component (use service tier grouping)
3. Add relevant Horizon queue names to the queue monitor
4. Document expected response time SLAs in the module devlog
5. Update the Acropolis installer discovery registry if the service is Docker-based

---

## 11. Platform Roadmap

See [ROADMAP.md](/ROADMAP.md) for the full public roadmap. Summary:

### Stabilization Arc (v1.0.3–v1.0.10, March–May 2026)

Six weeks of quality-only releases. No new features.

| Version | Theme |
|---------|-------|
| v1.0.3 | Foundation Release (shipped 2026-03-30) |
| v1.0.4 | Test Coverage & CI Hardening |
| v1.0.5 | Data Quality & Validation |
| v1.0.6 | Performance Optimization |
| v1.0.7 | UX Polish & Accessibility |
| v1.0.8 | Documentation & Onboarding |
| v1.0.9 | Security Audit & Hardening |
| v1.0.10 | Release Candidate |

### Feature Maturation (v1.1–v1.5, May–Q3 2026)

| Version | Theme |
|---------|-------|
| v1.1 | Federation & Multi-Site Studies |
| v1.2 | Advanced AI & Natural Language Research |
| v1.3 | Real-World Evidence & Regulatory |
| v1.4 | Advanced Analytics & Visualization |
| v1.5 | Ecosystem & Interoperability |

### General Availability (v2.0, Late 2026 / Early 2027)

Cloud-native deployment (Kubernetes, Terraform), Workstation Edition (single-binary), multi-tenancy, SSO, community plugin marketplace.

---

## 12. SOP: End of Every Working Session

The following steps are mandatory at the end of every development session. Never leave a session without completing all four.

```
1. DEVLOG
   Update or create docs/devlog/modules/{module}/{topic}.md
   Include: what was built, key decisions, errors encountered, gotchas

2. COMMIT
   Stage specific files (never secrets: .claudeapikey, .resendapikey, .env)
   Write a descriptive commit message with feat:/fix:/docs: prefix

3. PUSH
   git push origin main (or feature branch)

4. DEPLOY
   ./deploy.sh
   Verify: curl https://parthenon.acumenus.net/api/health returns 200
```

---

## 13. Known Gotchas Reference

A condensed list of architectural gotchas encountered during development. See `memory/MEMORY.md` and individual devlogs for full context.

| Gotcha | Fix |
|--------|-----|
| PHP 8.4 typed property redeclares untyped trait property | Remove typed property; set `$this->prop = value` in constructor |
| `docker compose restart` does NOT reload `env_file` | Must `docker compose up -d` to recreate container |
| `@docusaurus/theme-mermaid` version must match core exactly | Pin to same semver as `@docusaurus/core` in package.json |
| `!` in shell double-quoted strings → bash history expansion | Use passwords without `!` in generated passwords |
| `encrypted:array` cast produces base64, not JSON | Use `text` columns, not `jsonb` |
| `react-joyride` React 19 peer dep conflict | Install with `--legacy-peer-deps` |
| Apache serves `frontend/dist` (not Vite dev server) | Frontend changes require `vite build` to go live in production |
| PostgreSQL transaction poisoning (`SQLSTATE[25P02]`) | Event listeners and middleware must use nested transactions or try-catch |
| Recharts Tooltip `formatter` union type | Cast as `never`: `formatter={(...) as never}` |
| `DaimonType` enum cases are UPPERCASE | `DaimonType::CDM`, not `DaimonType::Cdm` |
| Vocabulary lives in shared `vocab` schema | Use `{@vocabSchema}` in SQL templates, not `{@cdmSchema}` for vocabulary |
| `npx vite build` is STRICTER than `tsc --noEmit` | Always verify with both before committing TypeScript changes |
| Hecate port changed from 8080 to 8088 in v1.0.3 | Update all references; old port was Superset in Acropolis |
| WhiteRabbit replaced by BlackRabbit in v1.0.3 | Installer handles migration automatically; update `enable_whiterabbit` → `enable_blackrabbit` |
