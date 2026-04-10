# Parthenon — Project Context for Claude Code

## What This Project Is

Parthenon is a unified OHDSI outcomes research platform that replaces Atlas, WebAPI, Achilles, DQD, and 15+ other disconnected tools with a single application built on OMOP CDM v5.4. It serves clinical researchers, data engineers, and healthcare organizations running population-level studies.

## Tech Stack

- **Backend:** Laravel 11, PHP 8.4, Sanctum auth, Spatie RBAC, Horizon queues
- **Frontend:** React 19, TypeScript strict, Vite 7, Tailwind 4, Zustand state, TanStack Query/Table
- **AI Service:** Python 3.12, FastAPI, Ollama (MedGemma), pgvector for embeddings
- **R Runtime:** R 4.4, Plumber API, HADES packages (CohortMethod, PatientLevelPrediction)
- **Search:** Solr 9.7 (10 configsets: vocabulary, cohorts, analyses, mappings, clinical, imaging, claims, gis_spatial, vector_explorer, query_library)
- **Database:** PostgreSQL 16 (Docker) / PostgreSQL 17 (host) — single `parthenon` DB, schema-isolated, pgvector, Redis 7
- **Infrastructure:** Docker Compose (16 services), Nginx proxy, deploy.sh

## Database Architecture

**Single database, schema-isolated.** Every environment uses one `parthenon` database.
Vocabulary tables (concept, concept_relationship, concept_ancestor, etc.) live in a **shared `vocab` schema**, separate from CDM clinical tables. Each CDM instance has its own schema for clinical data but shares the single `vocab` schema via `search_path`.

```
parthenon
├── app.*                — Application tables (users, roles, cohorts, sources, studies)
├── vocab.*              — Shared OMOP Vocabulary (concept, concept_ancestor, concept_relationship, domain, vocabulary, etc.)
├── omop.*               — Acumenus CDM clinical tables (person, visit_occurrence, drug_exposure, etc.)
├── synpuf.*             — CMS SynPUF 2.3M CDM clinical tables
├── irsf.*               — IRSF Natural History Study CDM
├── pancreas.*           — Pancreatic Cancer Corpus CDM
├── inpatient.*          — Morpheus inpatient CDM
├── inpatient_ext.*      — Morpheus inpatient extension tables
├── results.*            — Acumenus Achilles/DQD output
├── synpuf_results.*     — SynPUF Achilles/DQD output
├── irsf_results.*       — IRSF Achilles/DQD output
├── pancreas_results.*   — Pancreas Achilles/DQD output
├── gis.*                — Geospatial tables
├── eunomia.*            — GiBleed demo dataset (CDM + vocab bundled)
├── eunomia_results.*    — Demo Achilles results
├── php.*                — Laravel internals (migrations, jobs, cache)
├── temp_abby.*          — Abby AI scratch/analytics workspace
└── webapi.*             — Legacy OHDSI WebAPI (Atlas migration)
```

**8 Laravel connections** (all same DB, different `search_path`):

| Connection | Search Path | Used By |
|---|---|---|
| `pgsql` (default) | `app,php` | App models, auth, Spatie RBAC |
| `omop` | `omop,vocab,php` | CdmModel, VocabularyModel, AbbyAI, DQD, ingestion |
| `results` | `results,php` | ResultsModel, AchillesResultReaderService (overrides per source) |
| `gis` | `gis,omop,vocab,php` | GIS services |
| `eunomia` | `eunomia,php` | Eunomia demo queries (vocab bundled in eunomia schema) |
| `inpatient` | `inpatient,inpatient_ext,vocab` | Morpheus inpatient CDM + extensions |
| `pancreas` | `pancreas,vocab,php` | Pancreatic cancer multimodal corpus |
| `interrogation` | `omop,vocab,results,temp_abby` | Abby AI read-only analytics (abby_analyst role) |

**CRITICAL:** There is no `cdm` or `docker_pg` connection. The `vocab` schema is **shared** — all CDM connections include it in their `search_path`. Each source's daimons (in `app.source_daimons`) map `vocabulary → vocab` for non-Eunomia sources. In SQL templates, use `{@cdmSchema}` for clinical tables and `{@vocabSchema}` (or the source's vocabulary daimon table_qualifier) for vocabulary tables.

## Project Structure

```
Root files:
  CLAUDE.md              — This file (also at .claude/CLAUDE.md)
  docker-compose.yml     — All Docker service definitions
  deploy.sh              — Production deployment script
  install.py             — One-command installer (--with-infrastructure for full stack)
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
  solr/                  — Solr configsets (10 search cores)
    configsets/          — vocabulary, cohorts, analyses, mappings, clinical, imaging, claims, gis_spatial, vector_explorer, query_library
  installer/             — Python installer modules (bootstrap, config, ETL, Eunomia)
  acropolis/             — Infrastructure layer (Traefik, Portainer, pgAdmin, Enterprise)
    installer/           — Infrastructure installer (9-phase Python TUI)
    docker-compose.*.yml — Infrastructure service definitions (base, community, enterprise)
    traefik/             — Traefik reverse proxy configs (static + dynamic routes)
    config/              — Service configs (pgAdmin servers, Superset)
    k8s/                 — Kubernetes Helm charts + Kustomize overlays (Enterprise)

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
- **Enum cases are UPPERCASE:** `DaimonType::CDM`, not `DaimonType::Cdm`
- **Event listeners that write to DB must use nested transactions** (`DB::beginTransaction()` / `DB::commit()` / `DB::rollBack()` inside try-catch) to prevent `SQLSTATE[25P02]` transaction poisoning in tests. The listener's failure must never abort the parent transaction.
- **Non-critical middleware** (audit logging, analytics) must wrap all DB/cache operations in try-catch. If Redis or a table is unavailable, silently skip — never break the request.
- **When changing a service method's return type**, update ALL tests that assert on the old shape. Search: `grep -rn 'MethodName' backend/tests/`
- **Run Pint after every PHP edit:** `docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint"` — CI uses Docker Pint, so always use Docker Pint for version parity.

### Frontend (React)
- API calls go through **TanStack Query** hooks (not raw fetch/useEffect)
- State management via **Zustand** stores
- Validate API responses with **Zod** schemas
- No `any` types — use `unknown` and narrow
- Components follow **dark clinical theme**: #0E0E11 base, #9B1B30 crimson, #C9A227 gold, #2DD4BF teal
- Install npm packages with `--legacy-peer-deps` (react-joyride peer dep issue)
- **Recharts Tooltip `formatter` prop** has a complex union type that causes TS errors. Always cast: `formatter={((value: number) => [`${value}`, '']) as never}`
- **Component props should use `Pick<T, ...>` instead of full interface types** when only a subset of fields is needed. This prevents TS errors when the component receives data from contexts that don't carry every field.
- **CI runs `npx vite build` which is STRICTER than `tsc --noEmit`** — always verify with both locally before committing TypeScript changes.

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

## Pre-Commit Hook

A pre-commit hook runs CI-equivalent checks before every commit: Pint, PHPStan, TypeScript (`tsc --noEmit`), ESLint (staged frontend files only), Vitest (`--changed`), and Python syntax. It auto-skips for docs-only commits (no PHP/TS/Python files staged).

The canonical source lives at `scripts/githooks/pre-commit` (tracked). It is activated via `git config core.hooksPath scripts/githooks`, which `deploy.sh` sets automatically on first run. On a fresh clone, run `./deploy.sh` once to bootstrap, or set it manually.

```
Pre-commit: Pint...        ✓ Pint
Pre-commit: PHPStan...     ✓ PHPStan
Pre-commit: TypeScript...  ✓ TypeScript
Pre-commit: ESLint...      ✓ ESLint
Pre-commit: Vitest...      ✓ Vitest
Pre-commit: all checks passed.
```

If a check fails, fix the issue and re-commit. To bypass in emergencies: `git commit --no-verify` (but CI will still catch it).

**Subagents:** When spawning execution agents that make code changes, always instruct them to run the relevant checks (Pint for PHP, tsc for TS) BEFORE returning. Do not commit unchecked code.

## Common Gotchas

1. Single `parthenon` DB with schema isolation — vocabulary lives in `vocab` schema (shared), CDM clinical data in per-source schemas (`omop`, `synpuf`, `irsf`, `pancreas`, `inpatient`). Each source's `source_daimons` row maps `vocabulary → vocab`. In Achilles SQL templates, use `{@vocabSchema}` for vocabulary tables and `{@cdmSchema}` for clinical tables. Never use `cdm` or `docker_pg` connections (removed).
2. React 19 strict mode — components render twice in dev, effects must be idempotent
3. `--legacy-peer-deps` required for `npm install` (react-joyride compatibility)
4. PHPStan baseline exists at `backend/phpstan-baseline.neon` — check it before adding new ignores
5. OpenAPI types are auto-generated — don't edit `frontend/src/types/api.generated.ts` manually
6. Docker services have health checks — use `docker compose ps` to verify before testing
7. The R runtime container takes ~60s to start (HADES package loading)
8. Docker `env_file` loads at container CREATION time — `docker compose restart` does NOT reload; must `docker compose up -d`
9. PHP empty array `json_encode([])` produces `[]` not `{}` — use `(object) []` for empty JSON objects
10. Laravel `encrypted:array` cast produces base64 — use `text` columns, not `jsonb`
11. **Recharts Tooltip formatter** — always cast as `never`: `formatter={(...) as never}`. The Recharts type union is intentionally complex and not worth satisfying.
12. **PostgreSQL transaction poisoning** — if ANY statement fails inside a PG transaction, ALL subsequent statements fail with `SQLSTATE[25P02]`. Event listeners and middleware that write to optional tables MUST use nested transactions or try-catch to avoid poisoning the request's transaction.
13. **DaimonType enum** — cases are UPPERCASE: `DaimonType::CDM`, `DaimonType::Vocabulary`, `DaimonType::Results`, `DaimonType::Temp`

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

## Project Memory (Parthenon Brain)

This project has a persistent knowledge base stored in ChromaDB, accessible via
the `parthenon-brain` MCP server. It contains all project documentation, devlogs,
development blogs, architecture specs, module designs, and key code files that
have been created over the course of development.

### CRITICAL: Always Query Before Working

**Before starting any task**, query the Parthenon Brain to recall relevant context:

1. **At the start of every session**, use the Chroma MCP tools to search for
   context related to the current task. Search the `parthenon_docs` collection
   for documentation and specs, and `parthenon_code` for implementation details.

2. **Before making architectural decisions**, search for prior design decisions
   and specs. Many modules have detailed phase specifications, data models, and
   API contracts already documented.

3. **Before writing new code**, check if similar patterns already exist. The
   codebase has established conventions for FastAPI endpoints, React components,
   database migrations, and testing.

### How to Query

Use the Chroma MCP tools (available as `parthenon-brain` in your MCP server list):

- `chroma_query` — Semantic search across collections
  - Collection `parthenon_docs`: 6,500+ chunks from documentation, specs, devlogs, blogs
  - Collection `parthenon_code`: 13,800+ chunks from Python, TypeScript, PHP, SQL source

- Filter by metadata when narrowing scope:
  - `doc_type`: documentation, devblog, devlog, specification, architecture,
    design, module_spec, planning, guide, api_reference, source_code, prompt, rules
  - `module`: commons, studies, gis, imaging, molecular, heor, abby, atlas,
    cohort, explorer, pipeline, auth, dashboard, federated, network, ai,
    study-agent, frontend, backend, docker, scripts

### Example Queries

- "How does the Commons module handle real-time messaging?"
- "What is the federated architecture for the Studies module?"
- "Abby RAG pipeline ChromaDB collections"
- "GIS Explorer PostGIS spatial statistics"
- "OMOP CDM schema extensions for oncology"
- "FastAPI router endpoint patterns" (use `parthenon_code` collection)
- "Laravel controller conventions" (use `parthenon_code` collection)

### Brain Updates

The brain auto-updates via a git `post-commit` hook whenever documentation files
(`.md`, `.mdx`, `.txt`, `.rst`) change. For manual updates or to include code:

```bash
# Incremental docs only (fast — skips unchanged files)
python3 ~/.parthenon-brain/ingest.py -s /home/smudoshi/Github/Parthenon -i

# Full re-index with code
python3 ~/.parthenon-brain/ingest.py -s /home/smudoshi/Github/Parthenon --include-code
```
