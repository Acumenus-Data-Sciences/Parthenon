# Parthenon

**The unified outcomes research platform for OMOP CDM.**

![Parthenon](https://github.com/user-attachments/assets/ff7dd041-d489-4340-ae4e-4e3c56b56ded)

[![CI](https://github.com/sudoshi/Parthenon/actions/workflows/ci.yml/badge.svg)](https://github.com/sudoshi/Parthenon/actions/workflows/ci.yml)
[![PHP 8.4](https://img.shields.io/badge/PHP-8.4-777BB4?logo=php&logoColor=white)](https://php.net)
[![React 19](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![OMOP CDM v5.4](https://img.shields.io/badge/OMOP_CDM-v5.4-0078D4)](https://ohdsi.github.io/CommonDataModel/)
[![License](https://img.shields.io/badge/License-Apache_2.0-green.svg)](LICENSE)

**Live demo:** [parthenon.acumenus.net](https://parthenon.acumenus.net)
**User manual:** [parthenon.acumenus.net/docs](https://parthenon.acumenus.net/docs)
**API reference:** [parthenon.acumenus.net/docs/api](https://parthenon.acumenus.net/docs/api)

---

## The Problem

Running a real-world evidence study with OHDSI tools today means juggling 10+ separate applications — Atlas, WebAPI, Achilles, DataQualityDashboard, WhiteRabbit, Usagi, CohortMethod, PatientLevelPrediction, and more — each with its own install, its own credentials, its own UI, and its own language (Java, R, Knockout.js, .NET). A researcher who just wants to answer a clinical question spends most of their time wrestling with tooling.

**Parthenon is one application that does everything.** One login. One Docker Compose stack. One cohort builder that leads naturally into characterization, incidence rates, treatment pathways, and effect estimation — without switching tools.

---

## What Researchers Can Do

### Build Cohorts
Define patient populations using the same Circe-compatible expression format as Atlas — with a modern drag-and-drop editor, real-time SQL preview, and person-count feedback against any registered CDM source. Import existing Atlas cohort definitions without modification. Share cohorts with colleagues via a read-only link — no account required to view.

### Explore OMOP Vocabulary
Search 7+ million OMOP concepts by name, code, or synonym. Browse the concept hierarchy, navigate ancestor/descendant trees, and see what source codes map to a standard concept — all in a split-pane browser. Build concept sets with descendant expansion, inclusion/exclusion logic, and batch import from Atlas exports.

### Characterize Data Quality
Know your data before you analyze it. Parthenon ships a full Achilles characterization engine (~200 analyses) and the DataQualityDashboard (~3,500 checks) as built-in modules — no R required. The Data Explorer shows record counts, demographic distributions, temporal trends, and Achilles HEEL violations across every domain.

### Run Analyses
Five analysis types are fully integrated:
- **Characterizations** — extract covariate profiles for target and comparator cohorts
- **Incidence Rates** — time-at-risk incidence with gender, age, and calendar-year stratification
- **Treatment Pathways** — sequence treatment events to reveal real-world therapy patterns
- **Population-Level Estimation** — comparative effectiveness via CohortMethod (R sidecar)
- **Patient-Level Prediction** — machine-learning risk models via PatientLevelPrediction (R sidecar)

Package any combination into a Study with a single execution button and unified progress tracking.

### Track Care Quality
Define care bundles (e.g., Diabetes, Heart Failure, AFib) with constituent gap measures — HbA1c testing, retinal exams, statin adherence, ACE inhibitor prescribing. Evaluate against any population and see per-patient gap status, bundle compliance scores, and population-level dashboards across 45 pre-built bundles and 438 care gap measures.

### Ingest New Data
Upload CSV files or FHIR bundles and let the AI-powered ingestion pipeline handle the rest: source profiling, schema mapping suggestions, concept mapping with confidence scores, and a human review queue to approve, reject, or remap uncertain assignments before writing to the CDM.

### Explore Patient Timelines
Navigate individual patient records — conditions, drugs, procedures, measurements, observations — on an interactive timeline. Browse cohort members and drill into any event. Concept links take you directly to the vocabulary browser.

### Ask Abby
Describe a cohort in plain English — *"patients with type 2 diabetes newly started on metformin after age 40 with no prior insulin use"* — and Abby, the built-in AI assistant powered by MedGemma, generates the structured OMOP cohort expression. Refine it through chat. Explain any existing cohort in plain language.

---

## Key Capabilities at a Glance

| Capability | Details |
|---|---|
| **Atlas parity** | Full import/export compatibility with Atlas cohort definitions and concept sets |
| **In-app help** | Contextual `?` slide-overs on every page, linked to the full user manual |
| **What's New** | Auto-shows a changelog modal after each upgrade |
| **Guided onboarding** | 6-step setup wizard for super-admins; interactive tour for new users |
| **API reference** | Auto-generated OpenAPI spec (Scramble) with Stoplight Elements UI — 173 endpoints, 23 groups |
| **OpenAPI TypeScript types** | Auto-generated from the spec on every deploy |
| **Role-based access** | `super-admin`, `admin`, `researcher`, `viewer` with per-source restrictions |
| **Configurable auth** | LDAP / OAuth2 / OIDC / SAML provider configuration |
| **8 AI providers** | Ollama (default), OpenAI, Azure, Anthropic, Gemini, Mistral, Cohere, Bedrock |
| **System health** | Real-time 30-second monitoring dashboard for all services |
| **One-command deploy** | `./deploy.sh` handles migrations, cache warm, frontend build, and opcache flush |
| **Safe ref promotion** | `./deploy-ref.sh <ref>` promotes a tested commit or tag on the server, then runs `deploy.sh` |
| **Full CI suite** | PHPStan L8, Pint, Pest (195 tests), TSC strict, ESLint, Vitest, mypy, pytest |

---

## Getting Started

### Prerequisites
- Docker and Docker Compose v2
- Git
- Python 3.9+ (for the installer)

### Recommended: Install with Infrastructure

The full production deployment includes Parthenon plus the Acropolis infrastructure layer: automatic TLS via Traefik, container management via Portainer, database administration via pgAdmin. The Enterprise tier adds n8n workflow automation, Apache Superset BI dashboards, DataHub data catalog, Authentik SSO, and Wazuh security monitoring.

```bash
git clone https://github.com/sudoshi/Parthenon.git
cd Parthenon
python3 install.py --with-infrastructure
```

This runs both the Parthenon application installer and the Acropolis infrastructure installer in sequence: configuring environment files, starting all containers, running migrations, building the frontend, and wiring Traefik reverse proxy routes with auto-TLS for every service.

### Quick Start: Application Only

For local development or environments where you manage your own reverse proxy:

```bash
git clone https://github.com/sudoshi/Parthenon.git
cd Parthenon
python3 install.py
```

The Rich TUI installer walks through prerequisites, environment setup, container orchestration, and initial seeding in 9 phases.

### Promote A Tested Ref

For server-side promotion after CI passes, deploy an exact commit, tag, or branch ref with:

```bash
./deploy-ref.sh main
./deploy-ref.sh v1.0.4
./deploy-ref.sh a1b2c3d -- --frontend
```

This wrapper fetches from git, refuses a dirty checkout by default, switches to the target commit in detached HEAD mode, and then runs `./deploy.sh` with any extra deploy flags you pass after `--`.

The guided installer and browser launcher now also require:

- a `Beginner` or `Experienced` OHDSI/OMOP user selection
- a `UMLS Key` captured up front for vocabulary-import workflows
- an `Enterprise Key` if `Enterprise Edition` is selected

### Manual Install

If you prefer manual setup over the interactive installer:

```bash
git clone https://github.com/sudoshi/Parthenon.git
cd Parthenon

# Configure environment
cp .env.example .env
cp backend/.env.example backend/.env
# Edit backend/.env — set DB credentials, APP_KEY, and Sanctum domains

# Start services
docker compose up -d

# Initialize
docker compose exec php php artisan key:generate
docker compose exec php php artisan migrate
docker compose exec php php artisan admin:seed  # interactive: creates super-admin

# Build frontend
docker compose exec node sh -c "cd /app && npx vite build"
```

Open **http://localhost:8082** — you'll be greeted by the setup wizard.

### First Steps After Install

1. **Register a CDM source** — Settings → Data Sources → connect your PostgreSQL/OMOP database
2. **Browse the vocabulary** — verify concepts resolve against your vocabulary schema
3. **Confirm vocabulary-import prerequisites** — ensure the configured `UMLS_API_KEY` remains available before running CPT-4 or other vocabulary refresh workflows
4. **Run Achilles** — Data Explorer → select source → Run Achilles (takes 15–60 min depending on size)
5. **Create a cohort** — Cohort Definitions → New → build criteria or import an Atlas JSON
6. **Generate the cohort** — hit Generate, monitor progress, see person counts

---

## Documentation

| Resource | URL |
|---|---|
| User Manual (26 chapters + 7 appendices) | [/docs](https://parthenon.acumenus.net/docs) |
| API Reference (173 endpoints) | [/docs/api](https://parthenon.acumenus.net/docs/api) |
| Atlas → Parthenon Migration Guide | [/docs/migration](https://parthenon.acumenus.net/docs/migration) |
| Technical Architecture | [SPECS.md](docs/devlog/strategy/SPECS.md) |
| Roadmap | [ROADMAP.md](ROADMAP.md) |
| SDLC & Development Process | [SDLC-plan.md](docs/devlog/strategy/SDLC-plan.md) |
| Phase devlogs | [docs/devlog/](docs/devlog/) |

---

## What Parthenon Replaces

Parthenon consolidates more than a dozen OHDSI tools into a single deployable application.

| Instead of... | Parthenon provides... |
|---|---|
| **Atlas** (Knockout.js UI) | Modern React 19 SPA with full Atlas cohort/concept set compatibility |
| **WebAPI** (Java/Spring) | Laravel 11 REST API — same semantics, faster, easier to extend |
| **Achilles** (R) | Built-in characterization engine (~200 analyses), no R installation required |
| **DataQualityDashboard** (R) | Built-in DQD engine (~3,500 checks) with interactive results browser |
| **Usagi** (Java desktop) | AI-powered concept mapper with confidence scores and human review queue |
| **WhiteRabbit** (Java) | AI-powered source profiler — upload CSV, get schema + concept mapping suggestions |
| **Circe** (Java) | Built-in cohort expression compiler — Circe JSON in, CDM SQL out |
| **CohortMethod** (R) | R sidecar integration — submit from UI, results stream back |
| **PatientLevelPrediction** (R/Python) | R/Python sidecar integration — same workflow as CohortMethod |
| **Strategus** (R) | Built-in study orchestrator — bundle analyses, execute as a unit |
| **SqlRender** (R/Java) | PHP dialect layer — same template system, no R dependency |
| **ETL-CDMBuilder** (.NET) | AI-powered ETL pipeline with field-level mapping and review |

---

## Who It's For

**Clinical Researchers & Epidemiologists** who run population-level studies against OMOP CDM and want one tool instead of ten.

**Data Engineers & Informaticists** maintaining OMOP databases who need to characterize data quality, track vocabulary mapping quality, and onboard new data sources efficiently.

**Healthcare Organizations** measuring care quality, tracking bundle compliance, and building evidence for value-based care programs.

**OHDSI Network Participants** who need Atlas parity — Parthenon reads and writes every Atlas artefact format and exposes a WebAPI-compatible layer for legacy R package integration.

---

## Contributing

1. Fork and clone the repo
2. Branch off `main`: `git checkout -b feature/your-feature`
3. Follow the SDLC process in [docs/devlog/strategy/SDLC-plan.md](docs/devlog/strategy/SDLC-plan.md)
4. Run the Phase 8 quality gates: PHPStan, Pest, TSC, ESLint, Vitest
5. Open a PR against `main` — CI must be fully green

See [docs/devlog/process/SDLC-documentation.md](docs/devlog/process/SDLC-documentation.md) for the complete Phase 8/9 checklist.

The original OHDSI Atlas codebase is archived at the `archive/legacy` branch.

---

<!-- AUTO-STATS -->
## Platform Stats

> Auto-updated by the Parthenon docs-sync automation.

| Metric | Count |
|---|---|
| **Frontend features** | 33 modules |
| **Frontend pages** | 65 page components |
| **API controllers** | 81 |
| **API routes** | 434+ registered |
| **Docker services** | 18 containers |
| **Test files** | 2528 (21 PHP, 38 TS, 2444 Python, 25 E2E) |

### Frontend Feature Modules

`abby-ai`, `administration`, `analyses`, `auth`, `care-gaps`, `cohort-definitions`, `concept-sets`, `dashboard`, `data-explorer`, `data-sources`, `estimation`, `etl`, `evidence-synthesis`, `genomics`, `gis`, `help`, `heor`, `imaging`, `ingestion`, `jobs`, `pathways`, `phenotype-library`, `prediction`, `profiles`, `publish`, `radiogenomics`, `sccs`, `settings`, `strategus`, `studies`, `study-agent`, `text-to-sql`, `vocabulary`

### Docker Services

| Service | Ports |
|---|---|
| nginx | ${NGINX_PORT:-8082}:80 |
| php | internal |
| node | ${VITE_PORT:-5175}:5173 |
| postgres | ${POSTGRES_PORT:-5480}:5432 |
| redis | ${REDIS_PORT:-6381}:6379 |
| python-ai | ${AI_PORT:-8002}:8000 |
| chromadb | internal |
| study-agent | ${STUDY_AGENT_PORT:-8765}:8765 |
| qdrant | internal |
| hecate | ${HECATE_PORT:-8080}:8080 |
| solr | ${SOLR_PORT:-8983}:8983 |
| blackrabbit | ${BLACKRABBIT_PORT:-8090}:8090 |
| darkstar | ${R_PORT:-8787}:8787 |
| horizon | internal |
| orthanc | ${ORTHANC_PORT:-8042}:8042 |
| ohif-build | internal |
| docs-build | internal |
| fhir-to-cdm | ${FHIR_TO_CDM_PORT:-8091}:8091 |

<!-- /AUTO-STATS -->

## License

Apache License 2.0 — see [LICENSE](LICENSE) for details.

Built on the [OMOP Common Data Model](https://ohdsi.github.io/CommonDataModel/). OMOP CDM and the OHDSI vocabulary are governed by their respective licenses — see [ohdsi.org](https://ohdsi.org).
