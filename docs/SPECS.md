# Parthenon — Technical Specifications

Full technical reference for architecture, stack, data model, project structure, Docker services, environment configuration, and API surface.

→ For a user-facing overview see [README.md](../README.md)
→ For the development process see [SDLC-plan.md](SDLC-plan.md)
→ For the Phase 15–17 roadmap see [ROADMAP.md](ROADMAP.md)

---

## Tech Stack

| Layer | Technology | Version |
|---|---|---|
| **Backend API** | Laravel + PHP | 11 / 8.4 |
| **Frontend** | React + TypeScript + Vite | 19 / 5 / 7 |
| **Styling** | TailwindCSS | v4 |
| **State** | Zustand + TanStack Query | latest |
| **HTTP Client** | Axios | latest |
| **Auth** | Laravel Sanctum (SPA, Bearer token) | — |
| **RBAC** | Spatie Laravel Permission | — |
| **Queue** | Laravel Horizon + Redis | — |
| **AI Service** | Python FastAPI + Ollama | 3.12 / MedGemma |
| **Analytics Runtime** | R Plumber API (HADES sidecar) | R 4.4 |
| **Primary DB** | PostgreSQL 17 (local, `ohdsi` schema) | 17 |
| **App DB** | PostgreSQL 16 (Docker, `parthenon` schema) | 16 |
| **Vector Search** | pgvector extension | — |
| **Cache / Queue** | Redis | 7 |
| **Web Server** | Nginx (proxy) + Apache (production host) | — |
| **API Documentation** | Scramble (OpenAPI 3.1) + Stoplight Elements | — |
| **User Manual** | Docusaurus | v3 |

---

## Architecture

```
┌────────────────────────── React 19 SPA ────────────────────────────┐
│                                                                     │
│  Dashboard   │  Research Workbench   │  Data Explorer  │  Admin    │
│  Cohorts     │  Concept Sets         │  Achilles        │  Users   │
│  Analyses    │  Vocab Browser        │  DQ Dashboard    │  Roles   │
│  Studies     │  Patient Profiles     │  Ingestion       │  Health  │
│  Care Gaps   │  Abby AI              │  Mapping Review  │  AI Cfg  │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ REST / JSON (Bearer token)
┌──────────────────────────────▼──────────────────────────────────────┐
│                    Laravel 11 API (PHP 8.4)                         │
│                                                                     │
│  Auth & RBAC (Sanctum + Spatie)   │  Job Queue (Horizon + Redis)   │
│  Cohort Expression Engine         │  Achilles Results Reader       │
│  Concept Set Resolver             │  DQD Results Reader            │
│  SQL Compiler (Circe-compatible)  │  Ingestion Pipeline            │
│  AI Concept Mapper                │  Study Orchestrator            │
│  Population Risk Scores (20)      │  Care Gap Engine (438 gaps)    │
│  Network Analysis Engine          │  Population Characterization   │
└──────┬──────────────────┬────────────────────────┬──────────────────┘
       │                  │                        │
   PG 17 (ohdsi)      PG 16 (parthenon)        Redis 7
   OMOP CDM v5.4      App tables               Cache / Queues
   Achilles results   Users, Sources           Sessions
   7.2M concepts      Cohorts, Studies
   1M patients        Analyses, Jobs
       │
   ┌───┴────────────────────────────────────┐
   │     Python FastAPI (AI Service)        │
   │     Ollama / MedGemma 1.5:4b          │
   │     Cohort builder, chat, embeddings   │
   └────────────────────────────────────────┘
   ┌───────────────────────────────────────┐
   │     R Plumber API (HADES Sidecar)     │
   │     CohortMethod, PLP, SCCS, etc.     │
   └───────────────────────────────────────┘
```

### Nginx Routing

| Path pattern | Routes to | Notes |
|---|---|---|
| `/api/*` | PHP-FPM | All Laravel API endpoints |
| `/docs/api*` | PHP-FPM | Scramble/Stoplight Elements (`^~` prefix, takes priority) |
| `/docs/*` | Static Docusaurus build | User manual (`/var/www/docs-dist/`) |
| `/*` (production Apache) | `frontend/dist` | Vite production build |

---

## Database Schema

### Database Topology

| DB | Host | Schema | Contents |
|---|---|---|---|
| `ohdsi` | Local PG 17 (pgsql.acumenus.net) | `omop` | Full CDM v5.4 + vocabulary tables (combined, Atlas/ETL convention) |
| `ohdsi` | Local PG 17 | `achilles_results` | Achilles + DQD + cohort tables |
| `parthenon` | Docker PG 16 (port 5480) | `app` | All Laravel application tables |

> The `omop` schema is a combined CDM + vocabulary schema — both clinical tables (`person`, `condition_occurrence`, etc.) and vocabulary tables (`concept`, `concept_ancestor`, etc.) live together in `omop`. The separate `cdm` and `vocab` schemas created by migrations are structurally present but empty; all real data is in `omop`.

### OMOP CDM v5.4 Tables (read-only, `omop` schema)

**Clinical:**
`person`, `observation_period`, `visit_occurrence`, `visit_detail`, `condition_occurrence`, `drug_exposure`, `procedure_occurrence`, `device_exposure`, `measurement`, `observation`, `note`, `note_nlp`, `specimen`, `fact_relationship`, `payer_plan_period`, `cost`, `drug_era`, `dose_era`, `condition_era`, `cdm_source`, `metadata`, `location`, `care_site`, `provider`

**Vocabulary:**
`concept`, `vocabulary`, `domain`, `concept_class`, `concept_relationship`, `relationship`, `concept_synonym`, `concept_ancestor`, `drug_strength`, `source_to_concept_map`

**Scale (local instance):** 1M patients · 7.2M concepts · 710M measurements · 86M drug_exposures · 14.7M conditions · 82M concept_ancestors · 42.9M concept_relationships · 1.8M achilles_results rows

### App Tables (`parthenon` DB, `app` schema)

```
users                     roles                    permissions
sources                   source_daimons           auth_provider_settings
ai_provider_settings      notification_preferences

cohort_definitions        cohort_generations       cohort_shares
concept_sets              concept_set_items

characterizations         characterization_executions
incidence_rate_analyses   incidence_rate_executions
pathway_analyses          pathway_executions
estimation_analyses       estimation_executions
prediction_analyses       prediction_executions
sccs_analyses             sccs_executions
evidence_syntheses        evidence_synthesis_executions
studies                   study_analyses           analysis_executions

ingestion_jobs            schema_mappings          concept_mappings
mapping_reviews           mapping_candidates       validation_results

care_bundles              care_gap_measures        care_bundle_evaluations

negative_control_outcomes
webapi_registries
```

---

## Project Structure

```
Parthenon/
├── backend/                        Laravel 11 API
│   ├── app/
│   │   ├── Console/Commands/       Artisan commands (admin:seed, parthenon:*)
│   │   ├── Http/Controllers/Api/V1/
│   │   │   ├── Admin/              User, Role, AuthProvider, AiProvider, SystemHealth
│   │   │   ├── AbbyAiController    AI cohort builder (NL → OMOP expression)
│   │   │   ├── AchillesController  Characterization results (5 endpoints + heel)
│   │   │   ├── CareGapController   Care bundles + gap measures + evaluations
│   │   │   ├── CharacterizationController
│   │   │   ├── ClinicalCoherenceController
│   │   │   ├── CohortDefinitionController   import/export/share/generate/SQL preview
│   │   │   ├── ConceptSetController         import/export/resolve/items
│   │   │   ├── DataQualityController        DQD run dispatch + results
│   │   │   ├── EstimationController         CohortMethod sidecar
│   │   │   ├── EvidenceSynthesisController  Meta-analysis
│   │   │   ├── HelpController              GET /help/{key} + GET /changelog
│   │   │   ├── IncidenceRateController
│   │   │   ├── IngestionController         upload/profile/schema-mapping/validation
│   │   │   ├── MappingReviewController     approve/reject/remap/candidates
│   │   │   ├── NegativeControlController
│   │   │   ├── NetworkAnalysisController
│   │   │   ├── NotificationPreferenceController
│   │   │   ├── OnboardingController
│   │   │   ├── PathwayController
│   │   │   ├── PatientProfileController    timeline + cohort member browse
│   │   │   ├── PopulationCharacterizationController  PC001–PC006
│   │   │   ├── PopulationRiskScoreController         20 validated scores
│   │   │   ├── PredictionController        PLP sidecar
│   │   │   ├── SccsController              Self-controlled case series
│   │   │   ├── SourceController            CDM source + daimon management
│   │   │   ├── StudyController             Multi-analysis study packages
│   │   │   └── VocabularyController        search/concepts/hierarchy/compare
│   │   ├── Jobs/
│   │   │   ├── Cohort/             CohortGenerationJob
│   │   │   ├── Analysis/           CharacterizationJob, IncidenceRateJob, ...
│   │   │   ├── Ingestion/          ProfileSourceJob, SchemaMapJob, ConceptMapJob, WriteJob, ValidateJob
│   │   │   └── DataQuality/        AchillesJob, DqdJob
│   │   ├── Models/
│   │   │   ├── App/                CohortDefinition, ConceptSet, Source, SourceDaimon, ...
│   │   │   ├── Cdm/                39 read-only OMOP CDM v5.4 models
│   │   │   └── Vocabulary/         Concept, ConceptAncestor, ConceptRelationship, ...
│   │   └── Services/
│   │       ├── Cohort/             CohortSqlCompiler, CohortGenerationService
│   │       ├── ConceptSet/         ConceptSetResolverService
│   │       ├── Vocabulary/         VocabularySearchService
│   │       └── Analysis/           CohortOverlapService
│   ├── database/
│   │   ├── migrations/             83 migrations (2026_02_* through 2026_03_*)
│   │   ├── seeders/                DatabaseSeeder, RolesAndPermissionsSeeder, ...
│   │   └── factories/              10 model factories
│   ├── resources/
│   │   ├── help/                   20 contextual help JSON files (§9.12)
│   │   └── changelog.md            Keep-a-Changelog formatted history
│   └── routes/api.php              ~180 routes across 23 groups
├── frontend/                       React 19 + TypeScript SPA
│   └── src/
│       ├── app/                    router.tsx, QueryClient, ProtectedLayout
│       ├── components/
│       │   ├── layout/             MainLayout, Sidebar, Header, CommandPalette, AiDrawer
│       │   └── ui/                 Drawer, Modal, Button, Table, Badge, ToastContainer, ...
│       ├── lib/                    api-client (Axios + interceptors), utils, cn()
│       ├── stores/                 authStore (Zustand), uiStore
│       ├── hooks/                  useGlobalKeyboard, useDebounce
│       └── features/
│           ├── abby-ai/            NL → cohort expression AI panel + chat
│           ├── administration/     Users, roles, auth providers, AI providers, system health
│           ├── analyses/           Characterizations, incidence rates, pathways
│           ├── auth/               Login, Register, ChangePassword, OnboardingModal, SetupWizard
│           ├── care-gaps/          Care bundles, gap measures, evaluations, population dashboard
│           ├── cohort-definitions/ Editor, SQL preview, generation history, import/export/share
│           ├── concept-sets/       Set editor, resolver, import/export
│           ├── dashboard/          Overview stats + quick actions
│           ├── data-explorer/      Achilles tabs (Overview/Domains/DQD/Temporal/Heel)
│           ├── data-sources/       Source + daimon management, WebAPI import
│           ├── estimation/         Population-level estimation detail
│           ├── evidence-synthesis/ Meta-analysis detail
│           ├── help/               HelpButton, HelpSlideOver, InfoTooltip, WhatsNewModal
│           ├── ingestion/          Upload, schema mapping, profiling, concept mapping
│           ├── jobs/               Queue monitor
│           ├── pathways/           Treatment pathway detail + Sankey
│           ├── prediction/         Patient-level prediction detail
│           ├── profiles/           Patient timeline, cohort member browse
│           ├── sccs/               Self-controlled case series detail
│           ├── settings/           Notification preferences
│           ├── studies/            Study package management + unified execution
│           └── vocabulary/         Concept search, detail panel, comparison
├── ai/                             Python FastAPI (Ollama/MedGemma)
│   ├── app/
│   │   ├── routers/                cohort_builder, chat, suggest, explain, refine
│   │   ├── services/               ollama client, prompt templates
│   │   └── config.py               model configuration
│   ├── requirements.txt
│   └── requirements-dev.txt
├── r-runtime/                      R Plumber API (HADES analytics stubs)
│   ├── plumber_api.R               CohortMethod, PLP, SCCS endpoint stubs
│   └── Dockerfile
├── docker/
│   ├── nginx/default.conf          Routing rules (docs/api ^~, docs/ alias, proxy_pass)
│   ├── php/Dockerfile              PHP 8.4-fpm-alpine + extensions
│   ├── node/Dockerfile             node:22-alpine
│   ├── python/Dockerfile           python:3.12-slim
│   ├── r/Dockerfile                rocker/r-ver:4.4
│   └── docs/Dockerfile             node:22-alpine (Docusaurus build)
├── docs/
│   ├── site/                       Docusaurus v3 (26 chapters + 7 appendices)
│   ├── devlog/                     Phase-by-phase build logs
│   ├── SPECS.md                    ← this file
│   ├── ROADMAP.md                  Phase 15–17 future functionality
│   ├── SDLC-plan.md                Continuous development process
│   └── SDLC-documentation.md      Phase 8/9 testing + docs playbook
├── docker-compose.yml
├── deploy.sh                       One-command deploy helper
├── install.py                      Python Rich TUI installer
└── .github/workflows/ci.yml        7-job CI pipeline
```

---

## Docker Services

| Service | Image | Host Port | Role |
|---|---|---|---|
| `nginx` | nginx:1.27-alpine | **8082** | Reverse proxy + static docs |
| `php` | custom PHP 8.4-fpm | — | Laravel FPM |
| `horizon` | (same as php) | — | Horizon queue dashboard |
| `node` | node:22-alpine | **5175** | Vite dev server (HMR) |
| `postgres` | pgvector/pgvector:pg16 | **5480** | App database (parthenon) |
| `redis` | redis:7-alpine | **6381** | Cache, queues, sessions |
| `python-ai` | custom Python 3.12 | **8002** | FastAPI AI service (Ollama) |
| `r-runtime` | rocker/r-ver:4.4 | **8787** | R Plumber API (HADES sidecars) |

All host ports are configurable via environment variables in `docker-compose.yml`.

---

## Environment Configuration

### `backend/.env` — Key Variables

```env
# Application
APP_NAME=Parthenon
APP_URL=https://your-domain.com
APP_KEY=                                    # generated by artisan key:generate

# Primary DB (OMOP data — points to your PostgreSQL with CDM data)
DB_CONNECTION=pgsql
DB_HOST=your-pg-host
DB_PORT=5432
DB_DATABASE=ohdsi
DB_USERNAME=your-user
DB_PASSWORD=your-pass
DB_SEARCH_PATH=app,public                   # Parthenon app tables
CDM_DB_HOST=your-pg-host                    # Can differ from app DB
CDM_DB_SEARCH_PATH=omop,public             # CDM schema
VOCAB_DB_SEARCH_PATH=omop,public            # Vocabulary schema (often same as CDM)
RESULTS_DB_SEARCH_PATH=achilles_results,public

# Sanctum (SPA auth — must match your frontend domain)
SESSION_DOMAIN=your-domain.com
SANCTUM_STATEFUL_DOMAINS=your-domain.com

# Redis
REDIS_HOST=redis
REDIS_PORT=6379

# Mail
MAIL_MAILER=log                             # 'resend' for production
RESEND_KEY=re_...                           # Resend API key (production)

# AI Service
OLLAMA_BASE_URL=http://python-ai:8002
OLLAMA_MODEL=MedAIBase/MedGemma1.5:4b
```

### Production Apache Reverse Proxy

```apache
ProxyPass /api/ http://localhost:8082/api/
ProxyPassReverse /api/ http://localhost:8082/api/
ProxyPass /docs/ http://localhost:8082/docs/
ProxyPassReverse /docs/ http://localhost:8082/docs/
DocumentRoot /path/to/Parthenon/frontend/dist
```

---

## Artisan Commands

| Command | Description |
|---|---|
| `admin:seed` | Create / update super-admin account (interactive) |
| `parthenon:import-atlas-cohorts {path}` | Bulk-import Atlas cohort JSON files from directory |
| `parthenon:validate-atlas-parity` | Audit Atlas feature parity status |
| `parthenon:run-achilles` | Trigger Achilles analysis run |
| `parthenon:run-dqd` | Trigger DQD run |
| `parthenon:load-vocabularies` | Load OMOP vocabulary CSV files |
| `parthenon:compute-embeddings` | Compute concept embeddings via AI service |
| `scramble:export` | Export OpenAPI 3.1 spec to `backend/api.json` |
| `queue:work --queue=cohort,analysis,r-analysis,ingestion,default` | Start queue workers |

### `deploy.sh` Flags

```bash
./deploy.sh              # Full: PHP caches + migrations + frontend build
./deploy.sh --php        # PHP route/config/view cache only
./deploy.sh --frontend   # Vite build only
./deploy.sh --db         # php artisan migrate only
./deploy.sh --openapi    # scramble:export + generate TypeScript types
./deploy.sh --docs       # Docusaurus build (docs-build container)
```

---

## API Reference

All endpoints under `/api/v1/`. Auth endpoints are public; all others require `Authorization: Bearer {token}`.

Full interactive documentation at [/docs/api](https://parthenon.acumenus.net/docs/api).

### Auth

| Method | Endpoint | Notes |
|---|---|---|
| POST | `/auth/login` | Throttled: 5 req / 15 min per IP |
| POST | `/auth/register` | Sends temp password via email |
| GET | `/auth/user` | Authenticated user + roles + permissions |
| POST | `/auth/logout` | |
| POST | `/auth/change-password` | Required on first login (`must_change_password = true`) |

### Cohort Definitions

| Method | Endpoint | Notes |
|---|---|---|
| GET | `/cohort-definitions` | Paginated; `?search=`, `?tags[]=` |
| POST | `/cohort-definitions` | Create |
| GET/PUT/DELETE | `/cohort-definitions/{id}` | |
| POST | `/cohort-definitions/import` | Atlas Circe JSON — single object or batch array |
| GET | `/cohort-definitions/tags` | Distinct tag values across all definitions |
| GET | `/cohort-definitions/{id}/export` | Atlas-format JSON wrapper |
| POST | `/cohort-definitions/{id}/share` | `{days?}` → `{token, url, expires_at}` |
| GET | `/cohort-definitions/shared/{token}` | **Public** — no auth required |
| POST | `/cohort-definitions/{id}/generate` | Dispatch cohort generation job → 202 + `{job_id}` |
| GET | `/cohort-definitions/{id}/generations` | Generation history with person counts |
| GET | `/cohort-definitions/{id}/sql` | SQL preview (no execution) |
| POST | `/cohort-definitions/{id}/copy` | Duplicate |
| POST | `/cohort-definitions/{id}/diagnostics` | Dispatch CohortDiagnostics → 202 |
| POST | `/cohort-definitions/compare` | Cohort overlap comparison |

### Concept Sets

| Method | Endpoint | Notes |
|---|---|---|
| GET/POST | `/concept-sets` | CRUD |
| GET/PUT/DELETE | `/concept-sets/{id}` | |
| POST | `/concept-sets/import` | Atlas concept set format |
| GET | `/concept-sets/{id}/export` | Atlas format with full concept objects |
| GET | `/concept-sets/{id}/resolve` | Flat concept ID list (after descendant expansion) |
| POST/PUT/DELETE | `/concept-sets/{id}/items/{item}` | Item management |

### Sources

| Method | Endpoint | Notes |
|---|---|---|
| GET/POST | `/sources` | List / create CDM sources |
| GET/PUT/DELETE | `/sources/{id}` | |
| POST | `/sources/import-webapi` | Import source config from WebAPI registry |

### Vocabulary

| Method | Endpoint | Notes |
|---|---|---|
| GET | `/vocabulary/search` | `?q=`, `?domain_id=`, `?vocabulary_id=`, `?standard_concept=` |
| POST | `/vocabulary/semantic-search` | Vector similarity search (requires embeddings) |
| GET | `/vocabulary/concepts/{id}` | Full concept details |
| GET | `/vocabulary/concepts/{id}/relationships` | Direct concept relationships |
| GET | `/vocabulary/concepts/{id}/ancestors` | Ancestor chain |
| GET | `/vocabulary/concepts/{id}/descendants` | Descendant tree |
| GET | `/vocabulary/concepts/{id}/hierarchy` | Bi-directional hierarchy |
| GET | `/vocabulary/concepts/{id}/maps-from` | Source codes mapping to this standard concept |
| GET | `/vocabulary/compare` | Side-by-side comparison: `?ids[]=4329847&ids[]=4182210` |
| GET | `/vocabulary/domains` | Domain list |
| GET | `/vocabulary/vocabularies-list` | Vocabulary list |

### Analyses (standard pattern)

Each analysis type follows: `GET/POST /{type}` · `GET/PUT/DELETE /{type}/{id}` · `POST /{type}/{id}/execute` · `GET /{type}/{id}/executions` · `GET /{type}/{id}/executions/{execId}`

Types: `/characterizations` · `/incidence-rates` · `/pathways` · `/estimations` · `/predictions` · `/sccs` · `/evidence-synthesis` · `/studies`

Studies also: `POST /studies/{id}/execute` (executes all analyses) · `GET /studies/{id}/progress`

### Achilles (per source)

`GET /sources/{source}/achilles/`

| Endpoint | Description |
|---|---|
| `record-counts` | Total records per CDM domain |
| `demographics` | Age distribution, gender, race, ethnicity |
| `observation-periods` | Observation period histogram |
| `domains/{domain}` | Top concepts in a domain |
| `domains/{domain}/concepts/{id}` | Concept drilldown with distributions |
| `temporal-trends` | Monthly/yearly event distributions |
| `analyses` | Available analysis IDs |
| `distributions/{analysisId}` | Raw distribution for a specific analysis |
| `performance` | Achilles run performance stats |
| `heel` | HEEL rule violations |
| `heel/run` (POST) | Trigger HEEL re-evaluation |

### Data Quality (per source)

`GET/POST /sources/{source}/dqd/`

| Endpoint | Description |
|---|---|
| `runs` | List DQD runs |
| `run` (POST) | Dispatch DQD run |
| `latest` | Most recent run summary |
| `runs/{id}` | Run details |
| `runs/{id}/results` | All check results (paginated) |
| `runs/{id}/summary` | Category-level pass/fail summary |
| `runs/{id}/tables/{table}` | Results filtered to a specific CDM table |
| `runs/{id}` (DELETE) | Delete run |

### Population Analytics (per source)

| Group | Endpoints |
|---|---|
| Risk Scores | `GET /risk-scores/catalogue` · `GET/POST /sources/{s}/risk-scores` · `GET /sources/{s}/risk-scores/{id}` |
| Clinical Coherence | `GET/POST /sources/{s}/clinical-coherence` · `GET /sources/{s}/clinical-coherence/{id}` |
| Population Insights | `GET /population-insights/catalogue` · `GET/POST /sources/{s}/population-insights` · `GET /sources/{s}/population-insights/{id}` |
| Network Analysis | `GET /network/analyses` · `GET /network/analyses/{id}` · `POST /network/run` · `GET /network/summary` |

### Ingestion

| Method | Endpoint | Notes |
|---|---|---|
| POST | `/ingestion/upload` | Multipart CSV/FHIR upload |
| GET | `/ingestion/jobs` | List jobs |
| GET | `/ingestion/jobs/{id}` | Job detail + status |
| GET | `/ingestion/jobs/{id}/profile` | Source profiling results |
| POST | `/ingestion/jobs/{id}/retry` | Retry failed job |
| DELETE | `/ingestion/jobs/{id}` | Delete job |
| GET/PUT | `/ingestion/jobs/{id}/schema-mapping` | Get / update schema mapping |
| POST | `/ingestion/jobs/{id}/schema-mapping/suggest` | AI-powered mapping suggestions |
| POST | `/ingestion/jobs/{id}/schema-mapping/confirm` | Lock mapping, advance to concept mapping |
| GET | `/ingestion/jobs/{id}/validation` | Validation errors |
| GET | `/ingestion/jobs/{id}/mappings` | Concept mapping queue |
| GET | `/ingestion/jobs/{id}/mappings/stats` | Mapping progress summary |
| POST | `/ingestion/jobs/{id}/mappings/{mapping}/review` | Approve/reject/remap |
| POST | `/ingestion/jobs/{id}/mappings/batch-review` | Batch review |
| GET | `/ingestion/jobs/{id}/mappings/{mapping}/candidates` | Alternative concept candidates |

### Abby AI

| Method | Endpoint | Description |
|---|---|---|
| POST | `/abby/build-cohort` | NL → OMOP cohort expression |
| POST | `/abby/create-cohort` | Build + persist as new cohort definition |
| POST | `/abby/chat` | Multi-turn conversation |
| POST | `/abby/suggest-criteria` | Suggest additional inclusion criteria |
| POST | `/abby/explain` | Explain existing cohort expression in plain English |
| POST | `/abby/refine` | Refine cohort based on feedback |

### Patient Profiles

| Method | Endpoint | Description |
|---|---|---|
| GET | `/sources/{source}/profiles/{personId}` | Full patient timeline by domain |
| GET | `/sources/{source}/cohorts/{cohortId}/members` | Paginated cohort member list |

### Care Gaps

| Method | Endpoint |
|---|---|
| GET/POST | `/care-bundles` |
| GET/PUT/DELETE | `/care-bundles/{bundle}` |
| GET/POST | `/care-bundles/{bundle}/measures` |
| DELETE | `/care-bundles/{bundle}/measures/{measure}` |
| POST | `/care-bundles/{bundle}/evaluate` |
| GET | `/care-bundles/{bundle}/evaluations` |
| GET | `/care-bundles/{bundle}/evaluations/{evaluation}` |
| GET | `/care-bundles/overlap-rules` |
| GET | `/care-bundles/population-summary` |

### Help & Changelog

| Method | Endpoint | Description |
|---|---|---|
| GET | `/help/{key}` | Contextual help JSON for a feature key |
| GET | `/changelog` | Parsed changelog entries (for What's New modal) |

### WebAPI Compatibility Layer

`/WebAPI/*` routes provide HADES R package compatibility — see [WebAPI compat layer docs](https://parthenon.acumenus.net/docs/migration/06-webapi-r-packages).

### Admin (requires `admin` or `super-admin` role)

| Group | Endpoints |
|---|---|
| Users | `GET/POST /admin/users` · `GET/PUT/DELETE /admin/users/{id}` · `PUT /admin/users/{id}/roles` · `GET /admin/users/roles` |
| Roles | `GET/POST /admin/roles` · `GET/PUT/DELETE /admin/roles/{id}` · `GET /admin/roles/permissions` |
| Auth Providers | `GET/PUT /admin/auth-providers/{type}` · `POST /admin/auth-providers/{type}/enable|disable|test` |
| AI Providers | `GET/PUT /admin/ai-providers/{type}` · `POST /admin/ai-providers/{type}/enable|disable|activate|test` |
| WebAPI Registry | `GET/POST /admin/webapi-registries` · `GET/PUT/DELETE /admin/webapi-registries/{id}` · `POST /admin/webapi-registries/{id}/sync` |
| System Health | `GET /admin/system-health` |

---

## CI Pipeline

Defined in `.github/workflows/ci.yml`. Runs on every push to `main` and every PR.

| Job | Triggers | Runs |
|---|---|---|
| `backend` | always | PHPStan L8 + Pint + Pest (PostgreSQL service) |
| `frontend` | always | TSC strict + ESLint + Vitest + Vite build |
| `ai` | always | mypy strict + pytest |
| `docs-build` | always | `npm run build` in `docs/site/` |
| `openapi-export` | always | `scramble:export` + TypeScript type check |
| `docs-pdf` | `release/**` + `v*.*.*` tags | Puppeteer PDF → artifact |
| `docker` | after all above | 4 Docker image builds |

---

## Authentication Flow

1. User registers → backend emails a temporary password (Resend in production, `log` driver in dev)
2. User logs in with temp password → receives Sanctum Bearer token
3. `must_change_password = true` → `ChangePasswordModal` blocks all navigation until changed
4. Super-admin first login → `SetupWizard` (6-step: System Health → AI Provider → Auth → Data Sources)
5. New non-admin users → `OnboardingModal` (Joyride guided tour of key features)
6. RBAC enforced per endpoint via `role:admin|super-admin` Spatie middleware + permission checks

---

## Known Architectural Notes

- **`omop` schema is combined** — both CDM and vocabulary live in `omop`, following the Atlas/ETL convention. Do not use the separate `cdm`/`vocab` schemas for real data.
- **PHP 8.4 trait property rule** — typed class properties cannot redeclare untyped trait properties. Use constructor assignment instead.
- **Docker bind-mount inodes** — `sed -i` creates a new inode; running containers see the old inode. Use `docker compose exec` to write files inside containers, or run `docker compose up -d` to recreate.
- **`encrypted:array` cast** — produces base64, not JSON. Use `text` columns, not `jsonb`, for encrypted fields.
- **Docusaurus theme-mermaid** — must be pinned to the exact same semver as `@docusaurus/core`. Version mismatches cause fatal build errors.
- **Apache serves `frontend/dist`** — frontend changes require `vite build` to go live in production. The Vite dev server (port 5175) is for local development only.
