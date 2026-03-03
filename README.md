# Parthenon

**Unified Outcomes Research Platform on OMOP CDM v5.4**

Parthenon consolidates the fragmented OHDSI ecosystem — Atlas, WebAPI, Achilles, DataQualityDashboard, Usagi, WhiteRabbit, Circe, CohortGenerator, and more — into a single, AI-powered application. Built with a modern stack (Laravel 11 + React 19 + TypeScript), it replaces two decades of language sprawl (Java, R, Knockout.js, .NET) with one deployable Docker Compose stack.

**Live demo:** [parthenon.acumenus.net](https://parthenon.acumenus.net)

---

## What It Replaces

| OHDSI Tool | Language | Role | Parthenon |
|---|---|---|---|
| **Atlas** | JS/Knockout | Research UI | React 19 SPA |
| **WebAPI** | Java/Spring | REST backend | Laravel 11 API |
| **Achilles** | R | CDM characterization | Built-in (~200 analyses) |
| **DataQualityDashboard** | R | Data quality checks | Built-in DQ engine |
| **Ares** | Node.js | DQD visualization | Built-in dashboards |
| **WhiteRabbit** | Java | Source profiling | AI-powered profiler |
| **Usagi** | Java desktop | Vocabulary mapping | AI concept mapper |
| **Circe** | Java | Cohort expression → SQL | Built-in SQL compiler |
| **CohortGenerator** | R | Cohort SQL execution | Built-in cohort engine |
| **SqlRender** | R/Java | SQL dialect translation | PHP dialect layer |
| **CohortMethod** | R | Population-level estimation | R sidecar |
| **PatientLevelPrediction** | R/Python | Patient-level prediction | R/Python sidecar |
| **Strategus** | R | Study orchestration | Built-in study executor |
| **CohortIncidence** | R | Incidence rates | Built-in IR engine |
| **FeatureExtraction** | R | Covariate extraction | Built-in feature engine |
| **ETL-CDMBuilder** | .NET | ETL to OMOP | AI-powered pipeline |
| **HADES** | R meta-pkg | 20+ analytics packages | R/Python sidecars |

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Backend API** | Laravel 11, PHP 8.4, Sanctum auth, Laravel Horizon, Spatie Permissions |
| **Frontend** | React 19, TypeScript, Vite 7, TailwindCSS v4, Zustand, TanStack Query |
| **AI Service** | Python FastAPI, Ollama (MedGemma `MedAIBase/MedGemma1.5:4b`) |
| **Analytics** | R Plumber API (HADES sidecar stubs) |
| **Primary DB** | PostgreSQL 17 (`ohdsi` schema) — OMOP CDM + Achilles results |
| **App DB** | PostgreSQL 16 (`parthenon` schema, Docker) — Laravel app tables |
| **Cache / Queue** | Redis 7 |
| **Web Server** | Nginx (reverse proxy) + Apache (production) |

---

## Architecture

```
┌────────────────────────────── React 19 SPA ──────────────────────────────┐
│                                                                           │
│  Dashboard  │  Research Workbench  │  Data Explorer  │  Admin Panel       │
│  Cohorts    │  Concept Sets        │  Achilles       │  Users / Roles     │
│  Analyses   │  Vocab Browser       │  DQ Dashboard   │  Auth Providers    │
│  Studies    │  Patient Profiles    │  Ingestion      │  AI Providers      │
│  Care Gaps  │  Abby AI             │  Mapping Review │  System Health     │
└────────────────────────┬──────────────────────────────────────────────────┘
                         │ REST / JSON
┌────────────────────────▼──────────────────────────────────────────────────┐
│                         Laravel 11 API (PHP 8.4)                          │
│                                                                           │
│  Auth & RBAC (Sanctum + Spatie)   │  Job Queue (Horizon + Redis)          │
│  Cohort Expression Engine         │  Achilles Results Reader              │
│  Concept Set Resolver             │  DQD Results Reader                   │
│  SQL Compiler (Circe-compatible)  │  Ingestion Pipeline                   │
│  AI Concept Mapper                │  Study Orchestrator                   │
│  Population Risk Scores           │  Care Gap Engine                      │
│  Network Analysis Engine          │  Population Characterization           │
└──────┬──────────────────┬─────────────────────────┬──────────────────────┘
       │                  │                         │
   PG 17 (ohdsi)     PG 16 (parthenon)         Redis 7
   OMOP CDM v5.4     App tables                Cache / Queues
   Achilles results  Users, Sources            Sessions
   7.2M concepts     Cohorts, Studies
   1M patients
```

---

## Features

### Research Workbench
- **Cohort Definitions** — Atlas-compatible cohort expression editor with Circe-compatible SQL compiler, generation history, attrition charts, and person counts against any registered CDM source
- **Concept Sets** — Full OMOP concept set management with descendant/mapped inclusion, vocabulary-enriched item display, and set resolution
- **Atlas Import/Export** — Round-trip JSON compatibility with Atlas cohort definitions and concept sets; batch CLI import via `parthenon:import-atlas-cohorts`
- **Share Links** — Read-only share tokens for cohorts (configurable expiry, public URL, no account required to view)
- **Tagging** — JSONB tag arrays on cohort definitions with server-side tag filter
- **Abby AI** — Natural-language cohort builder: describe criteria in plain English, Abby generates the structured OMOP cohort expression

### Analyses
- **Characterizations** — Cohort feature extraction across domains
- **Incidence Rates** — Population-level incidence rate calculations
- **Pathways** — Treatment pathway sequencing
- **Estimation** — Population-level effect estimation (CohortMethod sidecar)
- **Prediction** — Patient-level prediction (PatientLevelPrediction sidecar)
- **Studies** — Multi-analysis study packages with unified execution and progress tracking

### Data Explorer (Achilles)
- Record counts, demographics, observation periods
- Per-domain concept drilldowns with distribution histograms
- Temporal trends
- Achilles HEEL rule violations (`achilles_heel_results`)

### Data Quality Dashboard
- DQD run dispatch and results viewer
- Per-table and per-check result browsing
- Summary statistics

### Ingestion Pipeline
- CSV / FHIR upload with AI-powered schema mapping suggestions
- Field-level source profiling
- Concept mapping queue with confidence scoring
- Human review queue (approve / reject / remap)
- Mapping candidates panel

### Vocabulary Browser
- Full-text and semantic concept search across 7.2M OMOP concepts
- Concept hierarchy, ancestors, descendants, relationships
- Side-by-side concept comparison
- Domain and vocabulary listings

### Patient Profiles
- Per-person timeline of conditions, drugs, procedures, measurements, observations
- Cohort member browse

### Care Gaps
- Care bundle definition with overlap rules
- Care gap measure management
- Population-level gap evaluation and results

### Population Analytics (Parthenon-native)
- **Clinical Coherence** — Cross-domain coherence analyses (CC001–CC006)
- **Population Risk Scores** — 20 validated clinical risk scores (CHADS₂-VASc, Charlson, APACHE, etc.)
- **Population Characterization** — PC001–PC006 population-level characterizations
- **Network Analysis** — Multi-site federated analyses

### Auth & Administration
- **Sanctum SPA authentication** with CSRF cookie
- **Spatie RBAC** — roles (`super-admin`, `admin`, researcher, viewer) with fine-grained permissions
- **Auth providers** — configurable LDAP/SAML/OAuth stubs
- **Temp passwords** — register flow emails a temporary password; login forces change before proceeding
- **Admin panel** — user management, role/permission management, auth provider config, AI provider config, system health
- **Notification preferences** — per-user preference store

---

## Data Model

### OMOP CDM v5.4 Tables (read-only, `omop` schema)
`person`, `observation_period`, `visit_occurrence`, `visit_detail`, `condition_occurrence`, `drug_exposure`, `procedure_occurrence`, `device_exposure`, `measurement`, `observation`, `note`, `note_nlp`, `specimen`, `fact_relationship`, `payer_plan_period`, `cost`, `drug_era`, `dose_era`, `condition_era`, `cdm_source`, `metadata`, `location`, `care_site`, `provider`

Vocabulary tables: `concept`, `vocabulary`, `domain`, `concept_class`, `concept_relationship`, `relationship`, `concept_synonym`, `concept_ancestor`, `drug_strength`, `source_to_concept_map`

### App Tables (`parthenon` DB)
`users`, `roles`, `permissions`, `sources`, `source_daimons`, `cohort_definitions`, `cohort_generations`, `concept_sets`, `concept_set_items`, `characterizations`, `incidence_rate_analyses`, `pathway_analyses`, `estimation_analyses`, `prediction_analyses`, `studies`, `study_analyses`, `analysis_executions`, `ingestion_jobs`, `concept_mappings`, `mapping_reviews`, `mapping_candidates`, `schema_mappings`, `validation_results`, `care_bundles`, `care_gap_measures`, `care_bundle_evaluations`, `achilles_results`, `dqd_results`, `auth_provider_settings`, `ai_provider_settings`, `notification_preferences`

---

## Project Structure

```
Parthenon/
├── backend/                        Laravel 11 API
│   ├── app/
│   │   ├── Console/Commands/       Artisan commands (see below)
│   │   ├── Http/Controllers/Api/V1/
│   │   │   ├── Admin/              UserController, RoleController,
│   │   │   │                       AuthProviderController, SystemHealthController
│   │   │   ├── AbbyAiController    AI cohort builder
│   │   │   ├── AchillesController  Data characterization
│   │   │   ├── CareGapController   Care bundles + gap measures
│   │   │   ├── CharacterizationController
│   │   │   ├── ClinicalCoherenceController
│   │   │   ├── CohortDefinitionController   (+ import/export/share)
│   │   │   ├── ConceptSetController          (+ import/export)
│   │   │   ├── DataQualityController
│   │   │   ├── EstimationController
│   │   │   ├── IncidenceRateController
│   │   │   ├── IngestionController
│   │   │   ├── MappingReviewController
│   │   │   ├── NetworkAnalysisController
│   │   │   ├── PathwayController
│   │   │   ├── PatientProfileController
│   │   │   ├── PopulationCharacterizationController
│   │   │   ├── PopulationRiskScoreController
│   │   │   ├── PredictionController
│   │   │   ├── SourceController
│   │   │   ├── StudyController
│   │   │   └── VocabularyController
│   │   ├── Models/
│   │   │   ├── App/                CohortDefinition, ConceptSet, Source, ...
│   │   │   ├── Cdm/                39 OMOP CDM v5.4 read-only models
│   │   │   └── Vocabulary/         Concept, ConceptAncestor, ...
│   │   └── Services/
│   │       ├── Cohort/             CohortSqlCompiler, CohortGenerationService,
│   │       │                       CohortExpressionSchema
│   │       ├── ConceptSet/         ConceptSetResolverService
│   │       ├── Analysis/           CohortOverlapService
│   │       └── Vocabulary/         VocabularySearchService
│   ├── database/migrations/        83 migrations
│   └── routes/api.php              ~120 routes
├── frontend/                       React 19 + TypeScript SPA
│   └── src/
│       ├── app/                    router.tsx, QueryClient
│       ├── components/layout/      MainLayout, Sidebar, ChangePasswordModal
│       ├── lib/                    api-client (Axios), utils
│       ├── stores/                 authStore (Zustand)
│       └── features/
│           ├── abby-ai/            NL → cohort expression AI panel
│           ├── administration/     Users, roles, auth/AI providers, health
│           ├── analyses/           Characterizations, IR, pathways
│           ├── auth/               Login, Register, ChangePassword
│           ├── care-gaps/          Care bundles + gap measures
│           ├── cohort-definitions/ Editor, SQL preview, generation, import/export/share
│           ├── concept-sets/       Set editor, resolver, import/export
│           ├── dashboard/          Overview stats
│           ├── data-explorer/      Achilles drilldowns, DQ dashboard
│           ├── data-sources/       Source + daimon management
│           ├── estimation/         PLE analysis detail
│           ├── ingestion/          Upload, schema mapping, profiling
│           ├── jobs/               Queue monitor
│           ├── pathways/           Treatment pathway detail
│           ├── prediction/         PLP detail
│           ├── profiles/           Patient timeline
│           ├── settings/           Notification preferences
│           ├── studies/            Study package management
│           └── vocabulary/         Concept search + browser
├── ai/                             Python FastAPI (Ollama/MedGemma)
│   └── app/
│       ├── routers/                cohort_builder, chat, suggest
│       └── config.py               Ollama model config
├── r-runtime/                      R Plumber API stubs
│   └── plumber_api.R
├── docker/                         Dockerfiles (nginx, php, node, python, r)
├── docker-compose.yml
├── deploy.sh                       One-command deploy helper
└── docs/devlog/                    Phase-by-phase build logs
```

---

## Getting Started

### Prerequisites

- Docker and Docker Compose v2
- Git

### Setup

```bash
# Clone
git clone https://github.com/sudoshi/Parthenon.git
cd Parthenon

# Copy environment files
cp .env.example .env
cp backend/.env.example backend/.env
# Edit both files — set DB credentials, APP_KEY, Sanctum domains

# Start all services
docker compose up -d

# Generate Laravel app key
docker compose exec php php artisan key:generate

# Run migrations
docker compose exec php php artisan migrate

# Seed the super-admin account (interactive)
docker compose exec php php artisan admin:seed

# Build the frontend (first time)
docker compose exec node sh -c "cd /app && npx vite build"
```

**App available at:** http://localhost:8082 (nginx) or configure Apache reverse proxy.

### Development

```bash
# Vite dev server with HMR (port 5175)
docker compose exec node sh -c "cd /app && npx vite"

# PHP artisan commands
docker compose exec php php artisan <command>

# Tail Laravel logs
docker compose exec php tail -f storage/logs/laravel.log

# Run PHP tests
docker compose exec php php artisan test

# TypeScript type check
docker compose exec node sh -c "cd /app && npx tsc --noEmit"
```

### Deploy (after code changes)

```bash
./deploy.sh             # Full: PHP opcache + migrations + frontend build
./deploy.sh --php       # PHP caches only
./deploy.sh --frontend  # Frontend rebuild only
./deploy.sh --db        # Migrations only
```

---

## Docker Services

| Service | Image | Port (host) | Role |
|---|---|---|---|
| `nginx` | nginx:1.27-alpine | 8082 | Reverse proxy |
| `php` | custom (8.4-fpm) | — | Laravel FPM |
| `node` | node:22-alpine | 5175 | Vite dev server |
| `postgres` | pgvector/pgvector:pg16 | 5480 | App database |
| `redis` | redis:7-alpine | 6381 | Cache + queues |
| `python-ai` | custom (3.12) | 8002 | FastAPI AI service |
| `r-runtime` | rocker/r-ver:4.4 | 8787 | R Plumber API |
| `horizon` | (same as php) | — | Queue dashboard |

Configure ports via env vars in `docker-compose.yml`.

---

## Environment

### Key backend env vars (`backend/.env`)

```env
APP_URL=https://your-domain.com

# Primary DB (OMOP data lives here)
DB_CONNECTION=pgsql
DB_HOST=your-pg-host
DB_PORT=5432
DB_DATABASE=ohdsi
DB_USERNAME=your-user
DB_PASSWORD=your-pass
DB_SEARCH_PATH=app,public
CDM_DB_SEARCH_PATH=omop,public
VOCAB_DB_SEARCH_PATH=omop,public
RESULTS_DB_SEARCH_PATH=achilles_results,public

# Redis
REDIS_HOST=redis
REDIS_PORT=6379

# Sanctum (stateful SPA auth)
SESSION_DOMAIN=your-domain.com
SANCTUM_STATEFUL_DOMAINS=your-domain.com

# Mail (Resend for production)
MAIL_MAILER=resend
RESEND_KEY=re_...

# AI service
OLLAMA_BASE_URL=http://python-ai:8002
OLLAMA_MODEL=MedAIBase/MedGemma1.5:4b
```

### Production (Apache reverse proxy)

```apache
ProxyPass /api/ http://localhost:8082/api/
ProxyPassReverse /api/ http://localhost:8082/api/
DocumentRoot /path/to/Parthenon/frontend/dist
```

---

## Artisan Commands

| Command | Description |
|---|---|
| `admin:seed` | Create/update super-admin user (interactive) |
| `parthenon:import-atlas-cohorts {path}` | Bulk-import Atlas cohort JSON files |
| `parthenon:run-achilles` | Trigger Achilles analysis run |
| `parthenon:run-dqd` | Trigger DQD run |
| `parthenon:load-vocabularies` | Load OMOP vocabulary files |
| `parthenon:compute-embeddings` | Compute concept embeddings via AI service |

---

## API Overview

All endpoints are under `/api/v1/`. Most require `Authorization: Bearer {token}` (Sanctum).

### Auth
| Method | Endpoint | Notes |
|---|---|---|
| POST | `/auth/login` | Rate-limited: 5 req/15 min |
| POST | `/auth/register` | Sends temp password via email |
| GET | `/auth/user` | Current user + permissions |
| POST | `/auth/logout` | |
| POST | `/auth/change-password` | Required on first login |

### Cohort Definitions
| Method | Endpoint | Notes |
|---|---|---|
| GET | `/cohort-definitions` | Paginated; `?search=`, `?tags[]=` |
| POST | `/cohort-definitions` | |
| GET | `/cohort-definitions/{id}` | |
| PUT | `/cohort-definitions/{id}` | |
| DELETE | `/cohort-definitions/{id}` | Soft delete |
| POST | `/cohort-definitions/import` | Atlas JSON (single or batch) |
| GET | `/cohort-definitions/tags` | Distinct tag values |
| GET | `/cohort-definitions/{id}/export` | Atlas-format JSON |
| POST | `/cohort-definitions/{id}/share` | `{days?}` → `{token, url, expires_at}` |
| GET | `/cohort-definitions/shared/{token}` | **Public** — no auth required |
| POST | `/cohort-definitions/{id}/generate` | Dispatch cohort generation job |
| GET | `/cohort-definitions/{id}/generations` | Generation history |
| GET | `/cohort-definitions/{id}/sql` | SQL preview |
| POST | `/cohort-definitions/{id}/copy` | Duplicate |

### Concept Sets
| Method | Endpoint | Notes |
|---|---|---|
| GET/POST | `/concept-sets` | CRUD |
| GET/PUT/DELETE | `/concept-sets/{id}` | |
| POST | `/concept-sets/import` | Atlas expression format |
| GET | `/concept-sets/{id}/export` | Atlas format + concept details |
| GET | `/concept-sets/{id}/resolve` | Flat concept ID list |
| POST/PUT/DELETE | `/concept-sets/{id}/items/{item}` | Item management |

### Sources
`GET/POST/PUT/DELETE /sources` — CDM data source + daimon management

### Vocabulary
`GET /vocabulary/search`, `/vocabulary/concepts/{id}`, `/vocabulary/concepts/{id}/relationships`, `/vocabulary/concepts/{id}/ancestors`, `/vocabulary/concepts/{id}/descendants`, `/vocabulary/concepts/{id}/hierarchy`, `POST /vocabulary/semantic-search`

### Analyses
Standard CRUD + `execute` + `executions` for:
- `/characterizations`
- `/incidence-rates`
- `/pathways`
- `/estimations`
- `/predictions`
- `/studies`

### Achilles (per source)
`GET /sources/{source}/achilles/record-counts`, `/demographics`, `/observation-periods`, `/domains/{domain}`, `/domains/{domain}/concepts/{id}`, `/temporal-trends`, `/analyses`, `/distributions/{id}`, `/heel`

### Data Quality (per source)
`GET/POST /sources/{source}/dqd/runs`, `/runs/{id}/results`, `/runs/{id}/summary`, `/runs/{id}/tables/{table}`

### Population Analytics (per source)
- `/sources/{source}/risk-scores` — 20 clinical risk score models
- `/sources/{source}/clinical-coherence` — CC001–CC006 analyses
- `/sources/{source}/population-insights` — PC001–PC006 characterizations
- `/network/analyses` — federated network analyses

### Ingestion
`POST /ingestion/upload`, `GET /ingestion/jobs`, per-job: `profile`, `schema-mapping`, `validation`, `mappings`, `retry`, `destroy`

### Abby AI
`POST /abby/build-cohort`, `/abby/chat`, `/abby/suggest-criteria`, `/abby/explain`, `/abby/refine`

### Patient Profiles
`GET /sources/{source}/profiles/{personId}`, `/sources/{source}/cohorts/{cohortId}/members`

### Care Gaps
`GET/POST /care-bundles`, per-bundle: `measures`, `evaluate`, `evaluations`

### Admin
`GET /admin/users`, `/admin/roles`, `/admin/roles/permissions`, `/admin/auth-providers`

---

## Database Notes

The `ohdsi` database (local PostgreSQL 17) uses the Atlas/ETL convention: both clinical CDM tables **and** vocabulary tables live in the `omop` schema. Separate `cdm` and `vocab` schemas exist in migrations but are empty — all real data is in `omop`.

The `parthenon` database (Docker PostgreSQL 16) holds all Laravel app tables: users, sources, cohort definitions, analyses, ingestion jobs, etc.

---

## AI / Abby

The Abby AI assistant is backed by MedGemma (`MedAIBase/MedGemma1.5:4b`) running via Ollama in the `python-ai` container. It:

1. Accepts natural-language cohort criteria descriptions
2. Produces structured OMOP cohort expression JSON
3. Supports iterative refinement via a chat interface
4. Explains existing cohort logic in plain English

Configure the model in `ai/app/config.py` or via `OLLAMA_MODEL` env var.

---

## Authentication Flow

1. User registers → backend emails a temporary password (Resend in production, log driver in dev)
2. User logs in → receives Sanctum token
3. If `must_change_password = true` → `ChangePasswordModal` blocks all navigation until changed
4. RBAC enforced per endpoint via `role:admin|super-admin` middleware + Spatie permissions

---

## Contributing

1. Fork and clone
2. Branch off `main`
3. Make changes with tests
4. Run `docker compose exec php php artisan test` and `docker compose exec node sh -c "cd /app && npx tsc --noEmit"`
5. Open a pull request against `main`

Default branch is `main`. The original OHDSI Atlas codebase is archived at `archive/legacy`.

---

## License

Apache License 2.0 — see [LICENSE](LICENSE) for details.

Built on the OMOP Common Data Model. OMOP CDM and the OHDSI vocabulary are governed by their respective licenses — see [ohdsi.org](https://ohdsi.org).
