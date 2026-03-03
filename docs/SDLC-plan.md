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
├── r-runtime/        R 4.4, Plumber
├── docker/           Dockerfiles + nginx config
├── docs/
│   ├── site/         Docusaurus v3 user manual
│   ├── devlog/       Per-phase devlogs (session-level)
│   ├── SDLC-plan.md           ← this file
│   └── SDLC-documentation.md  ← Phase 8/9 playbook
├── .github/workflows/ci.yml
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

| Version | Phases delivered |
|---------|-----------------|
| 0.1.0 | Phase 1 — Foundation |
| 0.2.0 | Phase 2 — OMOP DB + Cohort Builder + Vocabulary |
| 0.3.0 | Phase 5 — Research Workbench (analyses, studies) |
| 0.4.0 | Phase 8 — Testing (PHPStan L8, Pest 195 tests) |
| 0.5.0 | Phase 12 — Admin Dashboard Expansion (AI providers, system health) |
| 0.6.0 | Phase 11 — Care Bundles, Population Characterization, Risk Scoring, Network |
| 0.7.0 | Phase 9.2–9.6 — Atlas parity, WebAPI compat, Data Quality Dashboard |
| 0.8.0 | Phase 9.7/12.1 — Onboarding, Setup Wizard |
| 0.9.0 | Phase 9.8–9.12 — Documentation site, API reference, in-app help |
| 1.0.0 | Phase 14 — HADES integration (full R sidecar, PLE/PLP production) |
| 1.1.0 | Phase 15 — Genomics |
| 1.2.0 | Phase 16 — Medical Imaging |
| 1.3.0 | Phase 17 — HEOR |

**Pre-1.0 convention:** Minor bumps (0.x) are used freely for new feature phases. After 1.0, minor bumps require a completed Phase 8/9 loop. Patch releases may ship without new documentation chapters but must update the changelog.

---

## 4. Branch Model

```
main
 │
 ├── feature/phase-15-genomics          ← active development
 ├── feature/phase-15a-foundation       ← sub-phase (optional)
 ├── fix/incidence-rate-year-boundary   ← bug fixes
 ├── chore/upgrade-docusaurus-3.8       ← deps / maintenance
 └── release/1.1.0                      ← release branch (PDF CI triggers here)
```

**Rules:**

- `main` is always deployable. Never push broken code to `main`.
- All feature work happens on `feature/phase-{N}-{slug}` branches.
- Feature branches are created from `main`, merged back to `main` via PR.
- Release branches (`release/X.Y.Z`) are cut from `main` when a version is ready. The `docs-pdf` CI job runs only on `release/**` and `v*.*.*` tags.
- Tags follow `vX.Y.Z` convention: `git tag v1.1.0 && git push origin v1.1.0`.
- Hotfixes: branch from `main`, fix, merge to `main`, patch-version tag.

---

## 5. Development Workflow

### 5.1 Starting a New Phase

```bash
# 1. Branch from main
git checkout main && git pull
git checkout -b feature/phase-15-genomics

# 2. Review the phase specification in docs/devlog/PLAN.md
# Understand: new models, new endpoints, new pages, new Docker services

# 3. Create devlog skeleton
touch docs/devlog/phase-15-genomics.md
# Fill in: Phase title, date, status: In Progress

# 4. Begin implementation (models → migrations → services → controllers → routes → frontend)
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
feat: add genomic variant ingestion pipeline (§15a)

- VCF parser with HGVS → OMOP concept mapping via AI service
- GenomicVariant model + migration (MEASUREMENT table extension)
- VariantIngestionJob with queue: genomics
- POST /api/v1/genomics/ingest endpoint

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
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

### 5.4 Merging a Phase

1. Run the full Phase 8/9 checklist (see `SDLC-documentation.md`)
2. Push feature branch: `git push origin feature/phase-15-genomics`
3. CI must be **fully green** — all 7 jobs passing
4. Merge to `main` (fast-forward preferred; rebase if needed)
5. Update `backend/resources/changelog.md` with version bump
6. Tag the release: `git tag v1.1.0 && git push origin v1.1.0`
7. Run `./deploy.sh` on the production server

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
| `openapi-export` | always | `scramble:export` + TypeScript compile + type check |
| `docs-pdf` | `release/**` + `v*.*.*` tags | Puppeteer PDF export → artifact |
| `docker` | after backend + frontend + ai + openapi | 4 Docker image builds |

### Adding a new job for a new phase

If Phase 15 introduces a genomics pipeline container (e.g., Python bioinformatics service):

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
./deploy.sh --openapi    # scramble:export + generate:api-types
./deploy.sh --docs       # docs-build container (Docusaurus)
```

### 7.2 Production Topology

```
HTTPS → Apache reverse proxy (parthenon.acumenus.net)
  ├── /api/*        → Docker nginx:8082 → PHP-FPM
  ├── /docs/api*    → Docker nginx:8082 → PHP (Scramble/Stoplight)
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

New phases (15–17) extend the CDM with non-standard tables. These follow the same migration system but are prefixed to distinguish them from core CDM tables:

```sql
-- Phase 15 genomics extension tables (in cdm schema)
CREATE TABLE cdm.genomic_variant ( ... );
CREATE TABLE cdm.molecular_sequence ( ... );

-- Phase 16 imaging extension tables
CREATE TABLE cdm.image_occurrence ( ... );
CREATE TABLE cdm.image_feature ( ... );
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

### 10.5 Adding Observability for a New Phase

When Phase 15/16/17 ships:
1. Add the new service to the `SystemHealthController` service checks
2. Add a health card to the `SystemHealthPage.tsx` component
3. Add relevant Horizon queue names to the queue monitor
4. Document expected response time SLAs in the phase devlog

---

## 11. Long-Term Platform Roadmap

### Near-term (Phases 14–17, 2026)

| Phase | Target | Key deliverables |
|-------|--------|-----------------|
| 14 | HADES Integration | Full PLE/PLP via R sidecar (CohortMethod, PatientLevelPrediction), SCCS, EvidenceSynthesis |
| 15 | Genomics | VCF ingestion, variant-outcome correlation, genomic cohort criteria, tumor board |
| 16 | Medical Imaging | DICOM/Orthanc, OHIF viewer, MI-CDM, radiomic features, imaging cohort criteria |
| 17 | HEOR | OMOP COST + PAYER_PLAN_PERIOD, care gap economics, ROI modeling, value-based contracts |

### Medium-term (2026–2027)

- **Multi-tenancy** — schema-per-tenant or row-level security; separate CDM sources per institution
- **FHIR R4 server** — expose cohort definitions and patient data as FHIR resources
- **HL7 v2 ingestion** — ADT, ORU messages directly into CDM
- **Active learning loop** — AI concept mapper learns from human corrections in real time
- **i18n** — Japanese, French, Spanish UI translations (OHDSI network is global)
- **Vocabulary Refresh** — admin-facing UI to load new Athena downloads (zip upload → COPY → swap)

### Long-term (2027+)

- **OMOP on FHIR** — CQL-based cohort execution against FHIR endpoints
- **Federated analytics** — execute studies across network nodes without raw data sharing (OHDSI network studies)
- **Real-time evidence** — CDS Hooks service surfacing cohort membership and risk scores at point of care
- **Genomic federation** — GA4GH VRS-based variant frequency federation across OHDSI sites

---

## 12. SOP: End of Every Working Session

The following steps are mandatory at the end of every development session. Never leave a session without completing all four.

```
1. DEVLOG
   Update or create docs/devlog/phase-{N}-{slug}.md
   Include: what was built, key decisions, errors encountered, gotchas

2. COMMIT
   Stage specific files (never secrets: .claudeapikey, .resendapikey, .env)
   Write a descriptive commit message with feat:/fix:/docs: prefix
   Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

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
| `sed -i` creates new inode → Docker sees old file | Use `docker compose cp` or write via `docker compose exec` |
| `docker compose restart` does NOT reload `env_file` | Must `docker compose up -d` to recreate container |
| Scramble `#[Group]` weight must be integer, not float | Use `weight: 10` not `weight: 10.0` |
| `@docusaurus/theme-mermaid` version must match core exactly | Pin to same semver as `@docusaurus/core` in package.json |
| `!` in shell double-quoted strings → bash history expansion | Use passwords without `!` in test scripts |
| `encrypted:array` cast produces base64, not JSON | Use `text` columns, not `jsonb` |
| `react-joyride` React 19 peer dep conflict | Install with `--legacy-peer-deps` |
| Laravel `Rule::unique()` for PostgreSQL | Use `->ignore()` method, not string concatenation |
| Apache serves `frontend/dist` (not Vite dev server) | Frontend changes require `vite build` to go live in production |
