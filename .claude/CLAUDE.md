# Parthenon — Project Context for Claude Code

## What This Project Is

Parthenon is a unified OHDSI outcomes research platform that replaces Atlas, WebAPI, Achilles, DQD, and 15+ other disconnected tools with a single application built on OMOP CDM v5.4. It serves clinical researchers, data engineers, and healthcare organizations running population-level studies.

## Tech Stack

- **Backend:** Laravel 11, PHP 8.4, Sanctum auth, Spatie RBAC, Horizon queues
- **Frontend:** React 19, TypeScript strict, Vite 7, Tailwind 4, Zustand state, TanStack Query/Table
- **AI Service:** Python 3.12, FastAPI, Ollama (MedGemma), pgvector for embeddings
- **R Runtime:** R 4.4, Plumber API, HADES packages (CohortMethod, PatientLevelPrediction)
- **Search:** Solr 9.7 (9 configsets: vocabulary, cohorts, analyses, mappings, clinical, imaging, claims, gis_spatial, vector_explorer)
- **Database:** PostgreSQL 16 (Docker) / PostgreSQL 17 (host) — single `parthenon` DB, schema-isolated, pgvector, Redis 7
- **Infrastructure:** Docker Compose (16 services), Nginx proxy, deploy.sh

## Database Architecture

**Single database, schema-isolated.** Every environment uses one `parthenon` database:

```
parthenon
├── app.*              — Application tables (users, roles, cohorts, sources, studies)
├── omop.*             — OMOP CDM + Vocabulary (person, concept, visit_occurrence, etc.)
├── results.*          — Achilles/DQD output
├── gis.*              — Geospatial tables
├── eunomia.*          — GiBleed demo dataset
├── eunomia_results.*  — Demo Achilles results
├── php.*              — Laravel internals (migrations, jobs, cache)
└── webapi.*           — Legacy OHDSI WebAPI (Atlas migration)
```

**5 Laravel connections** (all same DB, different `search_path`):

| Connection | Search Path | Used By |
|---|---|---|
| `pgsql` (default) | `app,php` | App models, auth, Spatie RBAC |
| `omop` | `omop,php` | CdmModel, VocabularyModel, AbbyAI, DQD, ingestion |
| `results` | `results,php` | ResultsModel, AchillesResultReaderService |
| `gis` | `gis,omop,php` | GIS services |
| `eunomia` | `eunomia,php` | Eunomia demo queries |

**CRITICAL:** There is no `cdm`, `vocab`, or `docker_pg` connection. Use `omop` for CDM and vocabulary queries.

## Project Structure

```
Root files:
  CLAUDE.md              — This file (also at .claude/CLAUDE.md)
  docker-compose.yml     — All Docker service definitions
  deploy.sh              — Production deployment script
  install.py             — One-command installer entry point
  Makefile               — Top-level test/lint shortcuts

Application code:
  backend/               — Laravel 11 PHP application
    app/
      Models/            — Eloquent models by domain (App/, Cdm/, Vocabulary/, Results/)
      Http/
        Controllers/Api/V1/  — All API controllers
        Requests/             — Form Request validation classes
      Services/          — Business logic (AI/, Achilles/, Cohort/, Dqd/, Fhir/, etc.)
      Jobs/              — Queue jobs (Horizon)
      Console/Commands/  — Artisan commands
    routes/api.php       — All API routes
    database/migrations/
    config/              — Laravel config (database.php, solr.php, etc.)

  frontend/              — React 19 + TypeScript SPA
    src/
      features/          — Feature modules (cohort-definitions/, analyses/, genomics/, etc.)
        {feature}/
          pages/         — Route-level page components
          components/    — Feature-specific components
          hooks/         — Feature-specific React hooks
          api.ts         — TanStack Query hooks for API calls
      components/        — Shared UI components
      lib/               — Utilities, API client (Axios)
      stores/            — Zustand stores
      types/             — TypeScript types (api.generated.ts from OpenAPI)
    public/              — Static assets (images, favicons)

  ai/                    — Python FastAPI AI service
    app/                 — FastAPI application
    requirements.txt

  r-runtime/             — R Plumber API for HADES analytics
    plumber_api.R        — R Plumber endpoints

Infrastructure:
  docker/                — Dockerfiles and container configs
  solr/                  — Solr configsets (9 search cores)
    configsets/          — vocabulary, cohorts, analyses, mappings, clinical, imaging, claims, gis_spatial, vector_explorer
  installer/             — Python installer modules (bootstrap, config, ETL, Eunomia)

Scripts & tools:
  scripts/               — Utility scripts
    importers/           — Data import scripts (DICOM, VCF, COVID, GiAB)
    gis/                 — GIS data loading scripts
    claude-agents/       — CI/maintenance agent scripts
    db-backup.sh         — Database backup
    db-restore.sh        — Database restore

Documentation:
  docs/
    architecture/        — Architecture decision records
    blog/                — Blog posts and community content
    commons/             — Commons workspace design docs
      abby-components/   — Reference component implementations
      diagrams/          — SVG architecture diagrams
      mockups/           — HTML wireframes and prototypes
    devlog/              — Development logs organized by topic
      modules/           — Per-module devlogs
        abby-ai/         — Abby AI assistant
        analyses/        — Analysis execution
        commons/         — Commons workspace
        fhir/            — FHIR integration
        genomics/        — Genomics/radiogenomics
        gis/             — GIS explorer
        heor/            — HEOR/claims
        imaging/         — DICOM imaging
        results-explorer/— Results explorer
        solr/            — Solr search
        ux/              — UX improvements
      phases/            — Phase-numbered devlogs (01-17)
      plans/             — Implementation planning docs
      specs/             — Design specifications
      process/           — CI, tooling, infra devlogs
      architecture/      — Architecture decisions
      strategy/          — Roadmaps, SDLC
    site/                — Docusaurus v3 user manual source
    dist/                — Built docs site (gitignored)

Testing:
  e2e/                   — Playwright end-to-end tests

External (submodules):
  OHDSI-scraper/         — OHDSI corpus scraper (submodule)
  study-agent/           — OHDSI StudyAgent (submodule)

Data directories (gitignored, local only):
  GIS/                   — Raw geospatial data (~4GB)
  vcf/                   — Genomic VCF files (~16GB)
  backups/               — Database backup .sql files
  chroma/                — ChromaDB embeddings
  output/                — Analysis output/scratch
  dicom_samples/         — DICOM sample files
```

## Key Patterns

### Backend (Laravel)
- Use **Form Requests** for validation (not inline `$request->validate()`)
- Use **Eloquent scopes** for reusable query filters
- Use **eager loading** (`with()`) to avoid N+1 queries — critical for large OMOP datasets
- Return types on all public controller methods
- PHPStan level 8 — all public methods need full type hints

### Frontend (React)
- API calls go through **TanStack Query** hooks (not raw fetch/useEffect)
- State management via **Zustand** stores
- Validate API responses with **Zod** schemas
- No `any` types — use `unknown` and narrow
- Components follow **dark clinical theme**: #0E0E11 base, #9B1B30 crimson, #C9A227 gold, #2DD4BF teal
- Install npm packages with `--legacy-peer-deps` (react-joyride peer dep issue)

### Python (AI Service)
- FastAPI with Pydantic v2 models
- pgvector for concept embeddings
- Ollama integration for LLM features

## Testing & Linting Commands

```bash
# Run everything
make test          # Pest + Vitest + pytest
make lint          # Pint + PHPStan + ESLint + mypy

# Individual stacks
cd backend && vendor/bin/pest                    # PHP tests
cd backend && vendor/bin/pint --test             # PHP formatting check
cd backend && vendor/bin/phpstan analyse          # PHP static analysis (level 8)
cd frontend && npx vitest run                     # JS/TS tests
cd frontend && npx tsc --noEmit                   # TypeScript check
cd frontend && npx eslint .                       # ESLint
cd ai && pytest                                   # Python tests
cd ai && mypy app/                                # Python type check
```

## Deployment

```bash
./deploy.sh              # Full deploy: PHP caches, migrations, frontend build
./deploy.sh --php        # PHP + caches only
./deploy.sh --frontend   # Frontend build only
./deploy.sh --db         # Migrations only
./deploy.sh --openapi    # Refresh OpenAPI spec + generated types
```

Production is at https://parthenon.acumenus.net — Apache serves `frontend/dist/` (not the Vite dev server).
After any frontend change, the production build must be rebuilt via `deploy.sh --frontend` or `docker compose exec node sh -c "cd /app && npx vite build"`.

## Branch & Commit Conventions

- Feature branches: `feature/phase-N-slug` or `feature/description`
- Bug fixes: `fix/description`
- Maintenance: `chore/description`
- Commit messages: conventional commits (`feat:`, `fix:`, `chore:`, `docs:`, `style:`, `refactor:`, `test:`)

## Common Gotchas

1. Single `parthenon` DB with schema isolation — use the correct connection (`omop` for CDM/vocab, `results` for Achilles, `gis` for GIS). Never use `cdm`, `vocab`, or `docker_pg` connections (removed).
2. React 19 strict mode — components render twice in dev, effects must be idempotent
3. `--legacy-peer-deps` required for `npm install` (react-joyride compatibility)
4. PHPStan baseline exists at `backend/phpstan-baseline.neon` — check it before adding new ignores
5. OpenAPI types are auto-generated — don't edit `frontend/src/types/api.generated.ts` manually
6. Docker services have health checks — use `docker compose ps` to verify before testing
7. The R runtime container takes ~60s to start (HADES package loading)
8. Docker `env_file` loads at container CREATION time — `docker compose restart` does NOT reload; must `docker compose up -d`
9. PHP empty array `json_encode([])` produces `[]` not `{}` — use `(object) []` for empty JSON objects
10. Laravel `encrypted:array` cast produces base64 — use `text` columns, not `jsonb`

## Docker Services

```bash
docker compose up -d                  # Start all services
docker compose ps                     # Check health
docker compose exec php bash          # Shell into PHP container
docker compose exec postgres psql -U parthenon  # Database shell
docker compose logs -f php            # Follow PHP logs
```

Services: php, nginx, postgres, redis, python-ai, r-runtime, solr, chromadb, qdrant, node (Vite), horizon, reverb, fhir-to-cdm, orthanc, whiterabbit, study-agent, hecate

## Key URLs (Development)

- App: http://localhost:8082
- Vite dev server: http://localhost:5175
- API health: http://localhost:8082/api/v1/health
- AI service: http://localhost:8002
- Solr admin: http://localhost:8983
- Horizon dashboard: http://localhost:8082/horizon
- Production: https://parthenon.acumenus.net

## Key Artisan Commands

```bash
php artisan admin:seed                    # Seed super-admin user
php artisan acumenus:seed-source          # Seed Acumenus data source
php artisan eunomia:seed-source           # Seed Eunomia demo source
php artisan parthenon:load-eunomia --fresh # Load GiBleed demo dataset
php artisan phenotype:sync                # Sync OHDSI phenotype library (1100 definitions)
php artisan commons:seed-demo             # Seed Commons demo data
```
