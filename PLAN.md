# Parthenon: Unified Outcomes Research Platform

## Executive Summary

**Parthenon** is a next-generation, unified outcomes research platform that consolidates the fragmented OHDSI ecosystem (20+ disconnected projects) into a single, AI-powered application built on the OMOP Common Data Model v5.4. It replaces Atlas, WebAPI, Achilles, DQD, Ares, WhiteRabbit, Usagi, SqlRender, and more with an integrated Laravel 11 + React 18 platform featuring AI-powered data ingestion and Athena ontology tagging.

Repository: `sudoshi/Parthenon` (current content archived to `archive/legacy` branch).

---

## The Problem: OHDSI's Fragmented Ecosystem

### Projects Being Consolidated

| OHDSI Project | Lang | What It Does | Parthenon Replacement |
|---|---|---|---|
| **Atlas** | JS/Knockout | Frontend research UI | React 18 SPA |
| **WebAPI** | Java/Spring | Backend REST API | Laravel 11 API |
| **Achilles** | R | CDM characterization (~200 SQL analyses) | Built-in engine |
| **DataQualityDashboard** | R | ~3,500 data quality checks | Built-in DQ engine |
| **Ares** | Node.js | DQD/Achilles visualization | Built-in dashboards |
| **WhiteRabbit** | Java | Source data profiling + ETL design | AI-powered profiler |
| **Usagi** | Java desktop | Manual vocabulary mapping | AI-powered concept mapper |
| **SqlRender** | R/Java | SQL dialect translation | PHP dialect layer |
| **DatabaseConnector** | R | Multi-DB connectivity | Laravel multi-DB facades |
| **CommonDataModel** | DDL | OMOP CDM v5.4 schema | Laravel migrations |
| **CohortGenerator** | R | Cohort SQL generation | Built-in cohort engine |
| **CohortDiagnostics** | R | Cohort evaluation | Built-in diagnostics |
| **FeatureExtraction** | R | Covariable extraction | Built-in feature engine |
| **CohortMethod** | R | Population-level estimation | R sidecar orchestration |
| **PatientLevelPrediction** | R/Python | Patient-level prediction | R/Python sidecar |
| **Strategus** | R | Study execution orchestrator | Built-in orchestrator |
| **Circe** | Java | Cohort expression to SQL | Built-in SQL compiler |
| **CohortIncidence** | R | Incidence rate calculation | Built-in IR engine |
| **Athena** | Web | Vocabulary download/browser | Built-in vocab manager |
| **FhirToCdm** | Java | FHIR to OMOP conversion | Built-in FHIR ingestion |
| **ETL-CDMBuilder** | .NET | Generic ETL to OMOP | AI-powered ETL pipeline |
| **Eunomia** | R | Synthetic test dataset | Built-in test seeder |
| **HADES** | R meta-pkg | 20+ R analytics packages | R/Python sidecars |

### Core Problems
1. **Fragmented**: 10+ separate tools to install/configure
2. **Language sprawl**: Java, R, JS, .NET, Python, SQL
3. **No AI**: Manual vocabulary mapping (Usagi) is the #1 bottleneck
4. **Poor UX**: 2014-era Knockout.js frontend
5. **Complex deployment**: Docker orchestration nightmare
6. **No integrated ETL**: 4+ tools just to get data into the CDM

---

## Architecture Overview

```
PARTHENON PLATFORM
===================================================================

  React 18 + TypeScript SPA
  +-----------+ +----------+ +----------+ +-----------------+
  | Research   | | Data     | | Vocab &  | | AI Ingestion    |
  | Workbench  | | Explorer | | Ontology | | & Mapping UI    |
  |            | |          | | Browser  | |                 |
  | -Cohorts   | | -Achilles| | -Search  | | -Data profiling |
  | -Concepts  | | -DQ Dash | | -Hierarch| | -AI concept map |
  | -Charact.  | | -Profiles| | -Sets    | | -Review queue   |
  | -IR/PLE    | | -Drilldown| | -Mapping| | -FHIR/CSV/HL7  |
  | -Pathways  | | -Reports | |          | | -ETL pipeline   |
  +-----------+ +----------+ +----------+ +-----------------+
                      |
                REST API + WebSocket
                      |
  Laravel 11 (PHP 8.3) API
  +-------------+ +-------------+ +-------------------------+
  | Research     | | Data Quality| | AI/ML Engine            |
  | Services     | | & Character.| |                         |
  |              | |             | | -SapBERT embeddings     |
  | -Cohort Def  | | -Achilles   | | -pgvector concept store |
  | -Concept Set | |  (200+ SQL) | | -LLM concept mapping   |
  | -Vocabulary  | | -DQD        | | -Clinical NLP (MedCAT)  |
  | -Analysis    | |  (3500 chks)| | -Confidence router      |
  | -Study Exec  | | -Data Prof  | | -Active learning        |
  +-------------+ +-------------+ +-------------------------+
  +-------------+ +-------------+ +-------------------------+
  | Auth & RBAC  | | Job Engine  | | SQL Dialect Layer       |
  | (Sanctum)    | | (Horizon)   | | (replaces SqlRender)    |
  +-------------+ +-------------+ +-------------------------+
                      |
  +----------+ +-------+ +-----------+ +--------+ +--------+
  |PostgreSQL | | Redis | | CDM Sources| |R Sidecar| |Python  |
  | +pgvector | | cache/| | PG/BQ/    | | HADES  | |Sidecar |
  |  app DB   | | queue | | Oracle    | | PLE/PLP| | MedCAT |
  +----------+ +-------+ +-----------+ +--------+ +--------+
```

---

## Repository Structure

```
sudoshi/Parthenon/
+-- docker/
|   +-- docker-compose.yml / .dev.yml / .prod.yml
|   +-- nginx/ php/ node/ python/ r-runtime/
+-- backend/                    (Laravel 11)
|   +-- app/
|   |   +-- Console/Commands/
|   |   |   LoadVocabularies, ComputeEmbeddings, RunAchilles,
|   |   |   RunDataQuality, ProfileSource, MigrateLegacy, SeedTestData
|   |   +-- Http/Controllers/Api/V1/
|   |   |   Auth, Source, Vocabulary, ConceptSet, CohortDefinition,
|   |   |   Characterization, IncidenceRate, Pathway, Estimation,
|   |   |   Prediction, Profile, DataQuality, Achilles, Ingestion,
|   |   |   Mapping, MappingReview, Job, Study, Configuration
|   |   +-- Jobs/
|   |   |   Cohort/  Analysis/  Estimation/  DataQuality/
|   |   |   Ingestion/  AI/
|   |   +-- Models/
|   |   |   App/        (User, Source, CohortDef, ConceptSet, etc.)
|   |   |   Cdm/        (all 39 OMOP CDM v5.4 tables, read-only)
|   |   |   Vocabulary/  (Concept, Relationship, Ancestor, etc.)
|   |   |   Ingestion/   (IngestionJob, SourceProfile, Mapping, etc.)
|   |   |   DataQuality/ (AchillesResult, DqdResult, etc.)
|   |   +-- Services/
|   |       Vocabulary/  Cohort/  Analysis/  DataQuality/
|   |       Ingestion/   AI/     Source/    Sql/
|   +-- database/migrations/ seeders/ factories/
|   +-- routes/api.php
|   +-- tests/
+-- frontend/                   (React 18 + TypeScript)
|   +-- src/
|       +-- app/ components/ features/ hooks/ lib/ stores/ types/
|       Features: auth, cohort-definitions, concept-sets, vocabulary,
|       characterizations, incidence-rates, estimation, prediction,
|       pathways, profiles, data-sources, data-quality, data-explorer,
|       ingestion, mapping-review, studies, jobs, configuration
+-- ai/                         (Python FastAPI)
|   +-- app/routers/  (embeddings, concept_mapping, clinical_nlp)
|   +-- app/services/ (sapbert, medcat, llm, ensemble_ranker)
+-- r-runtime/                  (R Plumber API for HADES)
|   +-- scripts/ plumber_api.R Dockerfile
+-- docs/ .github/workflows/ Makefile README.md LICENSE
```

---

## Phase 1: Foundation (Weeks 1-4)

### 1.1 Repository & Docker

Archive current Parthenon content, initialize monorepo.

Docker Compose services:
- **nginx** (alpine, port 80/443) - reverse proxy
- **php** (8.3-fpm-alpine, port 9000) - Laravel
- **node** (22-alpine, port 5173) - Vite dev server
- **postgres** (pgvector/pgvector:pg16, port 5432) - app DB + vocab + vectors
- **redis** (7-alpine, port 6379) - cache/queues/sessions
- **python-ai** (3.12-slim, port 8000) - FastAPI AI service
- **r-runtime** (rocker/r-ver:4.4, port 8787) - R Plumber API
- **horizon** - Laravel queue dashboard

### 1.2 Backend Scaffold (Laravel 11)

```bash
composer require laravel/sanctum laravel/horizon laravel/socialite
composer require spatie/laravel-permission doctrine/dbal laravel/pennant
composer require pgvector/pgvector                    # Vector search
composer require yajra/laravel-oci8                   # Oracle CDM
composer require prologuetech/laravel-bigquery        # BigQuery CDM
composer require colopl/laravel-spanner               # Spanner CDM
composer require pestphp/pest --dev
```

### 1.3 Frontend Scaffold (React 18 + TS)

```bash
npm install react-router-dom@6 zustand @tanstack/react-query axios
npm install tailwindcss @radix-ui/react-* lucide-react
npm install d3@7 recharts @tanstack/react-table
npm install react-hook-form zod react-i18next
npm install -D vitest playwright
```

### 1.4 Python AI Service Scaffold

```bash
pip install fastapi uvicorn transformers torch
pip install medcat pgvector sqlalchemy psycopg2 httpx
```

### 1.5 CI/CD

Backend: pest + phpstan + pint | Frontend: vitest + tsc + eslint | AI: pytest + mypy

---

## Phase 2: Database & OMOP Foundation (Weeks 3-7)

### 2.1 Application Schema (PostgreSQL 16 + pgvector)

| Domain | Key Tables |
|--------|-----------|
| **Vocabulary** | `concepts` (~6M), `concept_relationships` (~30M), `concept_ancestors` (~50M), `concept_synonyms`, `vocabularies`, `domains`, `concept_classes`, `source_to_concept_maps` |
| **Vector Store** | `concept_embeddings` (pgvector 768-dim, HNSW index) |
| **Users** | `users`, `roles`, `permissions`, `teams` |
| **Sources** | `sources`, `source_daimons` |
| **Cohorts** | `cohort_definitions`, `cohort_generations`, `cohort_diagnostics_results` |
| **Concept Sets** | `concept_sets`, `concept_set_items` |
| **Analyses** | `characterizations`, `incidence_rate_analyses`, `pathway_analyses`, `estimations`, `predictions`, `feature_analyses` |
| **Studies** | `studies`, `study_analyses`, `study_executions` |
| **Data Quality** | `achilles_results`, `achilles_results_dist`, `dqd_results`, `dqd_checks` |
| **Ingestion** | `ingestion_jobs`, `source_profiles`, `field_profiles`, `etl_mappings` |
| **AI Mapping** | `concept_mappings`, `mapping_reviews`, `mapping_cache` |
| **Jobs** | `analysis_executions`, `execution_logs` |

### 2.2 Vocabulary Loading

```bash
php artisan parthenon:load-vocabularies --path=/data/athena/
# Loads all Athena CSVs: CONCEPT, CONCEPT_RELATIONSHIP, CONCEPT_ANCESTOR, etc.
# Creates GIN full-text search indexes on concept_name
```

### 2.3 SapBERT Embeddings (pgvector)

```bash
php artisan parthenon:compute-embeddings
# Python AI service: SapBERT (cambridgeltl/SapBERT-from-PubMedBERT-fulltext)
# Embeds ~6M concept names + synonyms -> 768-dim vectors
# Stored in concept_embeddings with HNSW index for ANN search
```

### 2.4 CDM Multi-DB Connector

| Database | Driver | Priority |
|----------|--------|----------|
| PostgreSQL | native `pgsql` | P0 |
| Google BigQuery | `prologuetech/laravel-bigquery` | P1 |
| Google AlloyDB/Cloud SQL | native `pgsql` (PG-compatible) | P1 |
| Google Spanner | `colopl/laravel-spanner` | P1 |
| Oracle | `yajra/laravel-oci8` | P2 |
| MS SQL Server | native `sqlsrv` | P2 |

CDM models extend `CdmModel` base class with dynamic connection resolution. Read-only enforced at model level.

### 2.5 SQL Dialect Layer (SqlRender Replacement)

`SqlRendererService` with `PostgresDialect`, `BigQueryDialect`, `OracleDialect`, `SpannerDialect`. Handles DATEADD/DATEDIFF translation, temp table syntax, type casting. Houses ~200 Achilles + ~3,500 DQD parameterized SQL templates.

---

## Phase 3: AI-Powered Data Ingestion (Weeks 5-12)

**The key innovation.** Replaces the 4-tool manual ETL (WhiteRabbit -> Rabbit-in-a-Hat -> Usagi -> custom scripts) with an integrated AI pipeline.

### 3.1 Pipeline Steps

**Step 1 - Source Profiling** (replaces WhiteRabbit):
Upload CSV/FHIR/HL7 -> auto-detect format -> profile columns (types, distributions, nulls, cardinality) -> identify PII -> generate scan report

**Step 2 - Schema Mapping** (replaces Rabbit-in-a-Hat):
AI suggests source table -> CDM table + column mappings. Visual drag-and-drop mapper for user review. Domain routing by concept domain_id.

**Step 3 - Concept Mapping** (replaces Usagi - the key innovation):
Multi-strategy AI mapper:

| Strategy | Best For | Technology |
|---|---|---|
| Exact code match | Standard vocabs (ICD-10, NDC) | SQL lookup by vocab_id + concept_code |
| SapBERT similarity | Descriptive text names | pgvector ANN on pre-computed embeddings |
| LLM reasoning | Ambiguous/multi-mappings | Claude API + ontology context |
| Historical cache | Previously seen terms | Learned from prior human reviews |

Ensemble ranker with domain-specific weights produces ranked candidates + confidence score.

**Step 4 - Confidence Routing**:
- High (>=0.95): Auto-accept
- Medium (0.70-0.95): Quick review queue (top 3 candidates)
- Low (<0.70): Full manual review with Athena hierarchy browser
- Unmappable: Flag as concept_id = 0

**Step 5 - CDM Writing**:
Domain routing, concept triple pattern (standard + source + raw), observation period calc, visit linkage, era derivation.

**Step 6 - Validation** (built-in DQD):
Auto-run quality checks on new data, generate report, flag issues.

### 3.2 Human-in-the-Loop Review UI

- Source term with context (table, column, frequency, samples)
- Ranked AI suggestions with confidence + strategy attribution
- Concept hierarchy browser (ancestors/descendants)
- Accept / Reject / Search manually actions
- Batch review mode for high-volume sessions

### 3.3 Active Learning

Every review decision stored. Mapping cache updated immediately. Weekly SapBERT fine-tuning on reviews. Auto-adjust confidence thresholds based on measured precision.

### 3.4 Clinical NLP (MedCAT)

Clinical notes -> Python AI (MedCAT v2) -> NER + assertion detection + entity linking to OMOP -> writes to note_nlp + clinical tables.

### 3.5 FHIR R4 Ingestion

| FHIR Resource | CDM Table |
|---|---|
| Patient | person |
| Encounter | visit_occurrence |
| Condition | condition_occurrence |
| MedicationRequest | drug_exposure |
| Procedure | procedure_occurrence |
| Observation (lab) | measurement |
| Observation (social) | observation |
| DiagnosticReport | measurement, note |
| Immunization | drug_exposure |
| Claim | cost |

---

## Phase 4: Data Quality & Characterization (Weeks 8-13)

### 4.1 Achilles Engine

Port ~200 SQL analyses to Laravel-managed parameterized SQL. Demographics, observation periods, visit patterns, condition/drug/procedure/measurement prevalence, temporal trends, data density. Results in standard Achilles schema.

### 4.2 DQD Engine

Port ~3,500 checks by Kahn framework:
- Completeness (~500): required fields, coverage
- Conformance (~1,500): value ranges, FK integrity, domain routing
- Plausibility (~1,500): temporal validity, age/gender appropriateness

### 4.3 Data Explorer Dashboard (Ares Replacement)

Overview (record counts, density treemap), domain drilldowns (top N, trends, stratification), DQ scorecard, population demographics.

---

## Phase 5: Research Workbench (Weeks 10-18)

### 5.1 Features

| Feature | Replaces | Complexity |
|---|---|---|
| Cohort Definition Builder | Atlas + Circe | Very High |
| Concept Set Management | Atlas | High |
| Vocabulary Search & Browse | Atlas + Athena | Medium |
| Cohort Characterization | Atlas + FeatureExtraction | High |
| Incidence Rates | Atlas + CohortIncidence | High |
| Pathway Analysis | Atlas | High |
| Patient Profiles | Atlas | Medium |
| PLE (CohortMethod) | Atlas + R | High (R sidecar) |
| PLP | Atlas + R/Python | High (R/Python sidecar) |
| Cohort Diagnostics | CohortDiagnostics R | High |
| Study Orchestrator | Strategus | High |

### 5.2 Cohort Expression Builder

Most complex component. Recursive AND/OR/NOT groups, domain-specific criteria, temporal relationships, concept set references, demographic criteria, inclusion/exclusion counts, censoring. JSON -> SQL compilation (Circe replacement).

### 5.3 Study Orchestrator (Strategus Replacement)

Bundle multiple analyses into study packages. Dependency resolution, multi-source execution, progress tracking, result aggregation.

### 5.4 R/Python Sidecar

Laravel queue job -> JSON spec -> R Plumber API -> CohortMethod/PLP execution -> results back -> WebSocket notification. Endpoints: /estimation, /prediction, /feature-extraction, /self-controlled.

### 5.5 Extensibility

- Custom analysis types via config
- Custom DQD checks / Achilles analyses via SQL templates
- API webhooks, export formats (JSON, CSV, ZIP, SQL, FHIR)
- Multi-tenant team workspaces with scoped permissions

---

## Phase 6: Auth & Multi-tenancy (Weeks 5-8)

| Auth Method | Implementation |
|---|---|
| Username/password | Laravel Sanctum |
| LDAP/AD | adldap2/adldap2-laravel |
| OAuth2 | Laravel Socialite |
| SAML 2.0 | aacotroneo/laravel-saml2 |
| OIDC | Socialite OIDC driver |

RBAC via spatie/laravel-permission. Permission groups for research, ingestion, mapping review, administration, team management.

---

## Phase 7: Frontend (Weeks 8-20)

### Navigation

```
Parthenon
+-- Dashboard
+-- Data Ingestion (NEW - AI ETL)
|   Upload, Profiles, Schema Maps, Concept Maps, Review Queue, Pipelines
+-- Data Explorer (Ares replacement)
|   Characterization (Achilles), Data Quality (DQD), Population Stats
+-- Vocabulary (Athena browser replacement)
|   Search, Hierarchy, Concept Sets
+-- Cohort Definitions
+-- Analyses
|   Characterizations, Incidence Rates, Pathways, PLE, PLP
+-- Studies (Strategus replacement)
+-- Patient Profiles
+-- Jobs
+-- Data Sources
+-- Administration
    Users, Teams, Roles, Vocabularies, Config
```

### Visualization Library

D3 v7 + Recharts: Treemap, sunburst, box plots, histograms, line/scatter/donut, Venn/UpSet, population pyramid, timeline, sankey, heatmap, forest plots, ROC curves, calibration plots.

### State: TanStack Query (server) + Zustand (client) + React Hook Form + Zod (forms) + React Router (URL) + Laravel Echo (real-time)

---

## Phase 8: Testing (Ongoing)

Testing is a first-class concern throughout every phase, not a post-hoc activity. Given the clinical and research stakes of outcomes data, correctness is non-negotiable: a wrong cohort definition or a miscalculated incidence rate can invalidate a study. The strategy covers static analysis, unit, integration, contract, E2E, and AI-accuracy layers across all four runtimes (PHP, TypeScript, Python, R).

---

### 8.1 Testing Philosophy

- **Test at the right layer.** Unit tests for pure logic; feature/integration tests for HTTP + DB flows; E2E only for critical user journeys. Avoid testing implementation details.
- **Domain correctness over coverage numbers.** A 60%-covered cohort SQL compiler that is provably correct against OHDSI's known-output suite is more valuable than 90% coverage on CRUD endpoints.
- **Eunomia as the ground truth.** All analytics tests run against the synthetic Eunomia dataset (GiBleed scenario). Results must match published reference values from the original OHDSI R packages.
- **Tests document behaviour.** Test names are written as sentences: `it('generates standard concept triple when mapping a condition code')`.
- **No mocks for database.** Feature tests run against a real Postgres test schema seeded from factories. Repository-level mocks are only acceptable in unit tests for external HTTP services (R sidecar, AI service).

---

### 8.2 Static Analysis & Linting

| Tool | Scope | Enforcement |
|---|---|---|
| **PHPStan** level 8 | All PHP (`app/`, `tests/`) | CI hard block |
| **Pint** | PHP code style (PSR-12 + opinionated) | CI auto-fix then fail if diff |
| **TypeScript strict** | All TS (`src/`) | CI hard block |
| **ESLint** (Airbnb + react-hooks + a11y) | All TSX/TS | CI hard block |
| **Prettier** | TS/TSX/CSS formatting | CI hard block |
| **mypy** strict | Python (`ai/app/`) | CI hard block |
| **Ruff** | Python style + lint | CI hard block |
| **lintr** | R scripts | CI warning (not hard block) |

PHPStan is configured at **level 8** (not L6 as previously noted) with Larastan extension. Baseline file committed to track deliberate suppressions. Any new suppression requires a `// @phpstan-ignore-next-line` comment with an explanation.

---

### 8.3 PHP Testing (Pest)

#### Structure

```
backend/tests/
+-- Unit/
|   +-- Services/
|   |   Vocabulary/ConceptMapperTest.php   (SapBERT ranker logic)
|   |   Sql/SqlRendererTest.php            (dialect translation)
|   |   Cohort/CohortSqlCompilerTest.php   (Circe replacement)
|   |   DataQuality/DqdCheckRunnerTest.php
|   +-- Models/
|   |   CdmModelTest.php                  (read-only guard)
|   |   SourceDaimonTest.php
|   +-- Pipelines/
|       IngestionPipelineTest.php          (step contracts)
+-- Feature/
|   +-- Api/V1/
|   |   AuthTest.php
|   |   SourceTest.php
|   |   VocabularyTest.php
|   |   ConceptSetTest.php
|   |   CohortDefinitionTest.php
|   |   CharacterizationTest.php
|   |   DataQualityTest.php
|   |   AchillesTest.php
|   |   IngestionTest.php
|   |   MappingReviewTest.php
|   +-- Jobs/
|       AchillesJobTest.php               (dispatched + result written)
|       DqdJobTest.php
|       ConceptMappingJobTest.php
+-- Integration/
|   +-- Eunomia/
|   |   AchillesReferenceTest.php         (matches known OHDSI output)
|   |   DqdReferenceTest.php
|   |   CohortGeneratorTest.php           (GiBleed cohort = known N)
|   +-- MultiDb/
|       PostgresDialectTest.php
```

#### Coverage Targets

| Area | Target | Rationale |
|---|---|---|
| Services / business logic | 90%+ | Core correctness; domain critical |
| HTTP controllers | 80%+ | Covers request validation + auth |
| Jobs / queue workers | 85%+ | Async failures are silent |
| Models / scopes | 70%+ | Mostly delegating; factory-covered |
| CLI commands | 60%+ | Covered by integration tests |
| **Overall** | **80%+** | CI fails below this threshold |

#### Key Test Patterns

**Cohort SQL Compiler (Circe replacement)** — parametrize across multiple known Atlas cohort definitions exported as JSON fixtures. Assert that generated SQL, when executed against Eunomia, yields the documented cohort size ± 2%.

```php
it('compiles GiBleed new-user cohort and yields expected count', function () {
    $json = fixture('cohorts/gibleed_new_user.json');
    $sql  = app(CohortSqlCompiler::class)->compile($json, 'eunomia');
    $count = DB::connection('eunomia')->select($sql);
    expect($count)->toBeWithin(expectedGiBleedN(), tolerance: 0.02);
});
```

**Dialect Translation** — assert that each SQL template renders identically for Postgres, BigQuery, Oracle, and MSSQL using snapshot testing. Any template change triggers snapshot review.

**Read-only CDM Guard** — assert that any `save()`, `delete()`, or `update()` call on a `CdmModel` subclass throws `CdmWriteAttemptException`.

**Ingestion Pipeline Contracts** — each step (`ProfileStep`, `SchemaMapStep`, `ConceptMapStep`, `WriteStep`, `ValidateStep`) tested in isolation with fake I/O. Pipeline integration test runs a 500-row synthetic CSV through all steps against Eunomia schema.

#### Test Database Strategy

- `RefreshDatabase` trait on all feature tests; uses Postgres `app_test` schema.
- CDM tests use a seeded `cdm_test` schema pre-loaded with Eunomia data (one-time Docker fixture, not re-seeded per test).
- Factories cover all `app.*` models. Vocabulary concept factories generate realistic `concept_id` + `domain_id` combinations.

---

### 8.4 TypeScript Testing (Vitest + Testing Library)

#### Structure

```
frontend/src/
+-- features/
|   +-- cohort-definitions/
|   |   __tests__/
|   |       CohortBuilder.test.tsx
|   |       useCohortCompiler.test.ts
|   |       cohortStore.test.ts
|   +-- concept-sets/   __tests__/...
|   +-- data-quality/   __tests__/...
|   +-- ingestion/      __tests__/...
|   +-- mapping-review/ __tests__/...
+-- components/
|   __tests__/
|       ConceptSearchBox.test.tsx
|       ConfidenceGauge.test.tsx
|       HierarchyBrowser.test.tsx
+-- lib/
    __tests__/
        sqlHighlighter.test.ts
        cohortSerializer.test.ts
```

#### Coverage Targets

| Area | Target |
|---|---|
| Pure utility functions (`lib/`) | 95%+ |
| Zustand stores | 90%+ |
| Custom hooks (data-fetching) | 80%+ |
| UI Components (unit) | 70%+ |
| Page-level components | 50%+ (E2E covers rest) |
| **Overall** | **70%+** |

#### Key Test Patterns

**Cohort Expression Builder** — render the builder with a fixture cohort JSON, simulate user adding an inclusion criterion, assert the Zustand store updates and the SQL preview pane re-renders with the new criterion.

**TanStack Query integration** — use `createWrapper()` with `msw` (Mock Service Worker) handlers, not manual `jest.mock`. MSW intercepts at the network level; handlers live in `src/mocks/handlers/`.

**Zustand store tests** — test actions directly against the store using `act()`; no React rendering needed for store unit tests.

**Accessibility** — `@testing-library/jest-dom` + `axe-core` via `vitest-axe` on every interactive component. All tests run with `aria-*` assertions.

---

### 8.5 End-to-End Testing (Playwright)

#### Critical Paths (must never regress)

| Journey | Assertions |
|---|---|
| **Login → Data Source connect → Run Achilles** | Job dispatched, results written, charts load |
| **CSV upload → AI concept mapping → accept top suggestion → CDM write** | Row appears in `condition_occurrence` with correct `concept_id` |
| **Build cohort → Generate → View characterization** | Cohort count matches Eunomia reference; characterization charts render |
| **DQD run → View scorecard → Drill into failing check** | Failed check row visible, concept details modal opens |
| **Vocabulary search → Add to concept set → Save** | Concept set persists across page reload |
| **Mapping review queue — batch accept 10 suggestions** | Queue count decrements; accepted concepts appear in `concept_mappings` |
| **Admin: create user → assign role → log in as new user** | New user can access permitted routes; blocked on restricted routes |

#### Configuration

```ts
// playwright.config.ts
export default defineConfig({
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox',  use: { ...devices['Desktop Firefox'] } },
  ],
  webServer: { command: 'docker compose up -d', url: 'http://localhost:8082' },
  retries: 1,  // one retry in CI for network flakiness
  reporter: [['html'], ['github']],
});
```

- Tests use **page object models** (`pages/CohortBuilderPage.ts`, `pages/IngestionPage.ts`, etc.) to keep selectors out of test bodies.
- All POM locators use `data-testid` attributes — no CSS class selectors.
- Visual regression snapshots via `expect(page).toHaveScreenshot()` for chart-heavy pages (Data Explorer, DQ Scorecard).

---

### 8.6 Python Testing (pytest)

#### Structure

```
ai/tests/
+-- unit/
|   test_sapbert_ranker.py        (ranking logic, confidence weighting)
|   test_ensemble_ranker.py       (strategy fusion)
|   test_medcat_processor.py      (NER + assertion detection)
|   test_fhir_mapper.py           (resource-to-CDM field mapping)
|   test_confidence_router.py     (threshold routing logic)
+-- integration/
|   test_embeddings_api.py        (FastAPI endpoint, real pgvector roundtrip)
|   test_concept_mapping_api.py   (end-to-end: text in, OMOP concept out)
|   test_clinical_nlp_api.py      (clinical note -> note_nlp records)
+-- accuracy/
    benchmark_concept_mapping.py  (Usagi gold standard corpus)
    benchmark_clinical_nlp.py     (n2c2 NER challenge subset)
```

#### Coverage Targets

| Area | Target |
|---|---|
| Core services (`services/`) | 90%+ |
| API routers | 80%+ |
| **Overall** | **80%+** |

Measured with `pytest-cov`; CI fails below 80%.

#### Key Patterns

- `pytest-asyncio` for all async FastAPI handlers.
- `httpx.AsyncClient` + `asgi_transport` for API tests (no real HTTP server needed).
- Ollama calls mocked with `respx` in unit/integration tests. Only the accuracy benchmarks call a real inference endpoint (run manually, not in CI).
- pgvector operations tested against a real Postgres test container (via `pytest-docker` or pre-started Docker fixture in CI).

---

### 8.7 AI Accuracy Benchmarks

This layer runs outside normal CI (resource-intensive) but is gated before releases.

#### Concept Mapping Accuracy

**Gold standard corpus**: the published Usagi evaluation dataset (~2,000 source terms with known OMOP mappings). Supplemented with Parthenon's own growing reviewed corpus.

| Metric | Target | Measured By |
|---|---|---|
| Precision@1 | ≥ 95% | Top suggestion is correct standard concept |
| Recall@3 | ≥ 99% | Correct concept in top-3 |
| Auto-accept precision | ≥ 98% | Precision on terms routed to auto-accept (≥0.95 confidence) |
| False-accept rate | ≤ 0.5% | Auto-accepted terms that are wrong |
| Mean confidence calibration | ≤ 0.05 ECE | Expected calibration error |

Benchmark runs on the AI service's `/concept-mapping/batch` endpoint. Results logged to `benchmark_results/` with timestamp for trend tracking.

#### Clinical NLP Accuracy

Evaluated against the **i2b2/n2c2 2018 NER** task subset and the **MedCAT MIMIC validation** corpus.

| Entity Type | F1 Target |
|---|---|
| Disease / diagnosis | ≥ 0.85 |
| Medication | ≥ 0.90 |
| Procedure | ≥ 0.82 |
| Lab value | ≥ 0.88 |
| Negation detection | ≥ 0.92 |

#### Achilles / DQD Reference Validation

Run against Eunomia GiBleed. All ~200 Achilles analyses and a representative 350-check DQD subset must match the R reference implementation output within ±1% for continuous values and exactly for counts.

---

### 8.8 R Testing (testthat)

R scripts in `r-runtime/` are tested with `testthat`. Scope is narrow: validate the Plumber endpoint contracts and that HADES packages are correctly invoked, not re-test HADES itself.

| Test | What It Covers |
|---|---|
| `test-plumber-endpoints.R` | HTTP 200 on /estimation, /prediction, /feature-extraction |
| `test-cohortmethod-adapter.R` | JSON spec → CohortMethod call parameters (mocked execution) |
| `test-plp-adapter.R` | JSON spec → PatientLevelPrediction call parameters (mocked) |
| `test-eunomia-integration.R` | Full estimation run on Eunomia; compares HR to reference |

---

### 8.9 CI/CD Integration

```yaml
# .github/workflows/ci.yml (abbreviated)
jobs:
  php-static:    PHPStan L8 + Pint
  php-tests:     Pest (unit + feature) → coverage report → Codecov
  ts-static:     tsc --noEmit + ESLint + Prettier check
  ts-tests:      Vitest (unit + component) → coverage report
  python-static: mypy strict + Ruff
  python-tests:  pytest (unit + integration) → coverage report
  e2e:           Playwright (chromium + firefox) — runs on main + PRs to main
  r-tests:       testthat via Rscript — runs on changes to r-runtime/
```

**Coverage gates** (enforced via Codecov PR checks):
- PHP: 80% overall, 90% on `app/Services/`
- TypeScript: 70% overall, 95% on `lib/`
- Python: 80% overall, 90% on `services/`

**PR merge rules:**
- All static analysis jobs green
- All unit + feature test jobs green
- E2E required on PRs targeting `main`; optional on feature branches
- Coverage must not decrease by more than 2% from base branch

---

### 8.10 Test Data & Fixtures

| Fixture | Location | Used By |
|---|---|---|
| Eunomia GiBleed CDM (Postgres dump) | `docker/fixtures/eunomia.pgdump` | PHP integration, R testthat, Playwright |
| Usagi gold standard mapping corpus | `tests/fixtures/usagi_gold.csv` | Python accuracy benchmark |
| Atlas cohort definition JSONs | `tests/fixtures/cohorts/*.json` | PHP Circe-compat tests |
| DQD reference outputs | `tests/fixtures/dqd_reference.json` | PHP DQD validation |
| Achilles reference outputs | `tests/fixtures/achilles_reference.json` | PHP Achilles validation |
| Synthetic clinical notes (de-identified) | `tests/fixtures/clinical_notes/*.txt` | Python NLP tests |
| FHIR R4 bundle samples | `tests/fixtures/fhir/*.json` | PHP + Python ingestion tests |
| MSW API handlers | `frontend/src/mocks/handlers/` | Vitest + Playwright |

Model factories for all `app.*` Eloquent models live in `backend/database/factories/`. A `EunomiaSeeder` class loads the Eunomia dump into the `cdm_test` schema once per test run (not per test case).

---

### 8.11 Contract Testing (Inter-Service API Stability)

The three runtimes (Laravel, FastAPI, R Plumber) communicate over HTTP. Schema drift between a producer and consumer must be caught before integration, not during E2E.

**Laravel ↔ FastAPI** — OpenAPI contract verified with [Schemathesis](https://schemathesis.readthedocs.io/) (property-based HTTP fuzzing against the FastAPI OpenAPI schema). Run as a separate CI job against the dev Docker stack. Any endpoint that deviates from its declared schema fails the job.

**Laravel ↔ R Plumber** — R Plumber exposes a `/openapi.json`. A Pest integration test downloads and validates it on startup; the PHP client's request/response DTOs are code-generated from this schema using `jane-php/open-api-3`.

**Consumer-driven contracts** — for the AI service, Pest drives the contract: each `ConceptMappingJob` test records the HTTP requests it makes (via `Http::fake()` with recording mode), and those recordings form the contract that the Python `test_contract_laravel.py` test validates on every AI service build.

---

### 8.12 Mutation Testing (Critical Domain Logic)

Coverage percentage cannot prove correctness — a test suite can cover code without asserting anything meaningful. For the highest-stakes modules, mutation testing is used to verify that the test suite actually catches regressions.

**PHP (Infection)** — run against `app/Services/Cohort/` and `app/Services/Sql/`. Minimum Mutation Score Indicator (MSI): **85%**. Run weekly and on PRs touching those paths.

```bash
vendor/bin/infection --min-msi=85 --filter=app/Services/Cohort,app/Services/Sql
```

**Python (mutmut)** — run against `ai/app/services/ensemble_ranker.py` and `ai/app/services/confidence_router.py`. These modules determine which mappings are auto-accepted; a silent logic error could corrupt CDM data at scale.

Mutation testing is not required to pass CI on every PR. It runs as a scheduled nightly job; failures create GitHub issues automatically.

---

### 8.13 Performance & Load Testing

Correctness must hold under load. Two scenarios matter most: vocabulary search (high-QPS, latency-sensitive) and Achilles / DQD job execution (long-running, resource-intensive).

**API load testing — k6**

```js
// tests/load/vocabulary_search.js
export const options = {
  vus: 50, duration: '60s',
  thresholds: { http_req_duration: ['p95<200'], http_req_failed: ['rate<0.01'] },
};
export default () => {
  http.get('/api/v1/vocabulary/search?q=myocardial+infarction');
};
```

| Scenario | VUs | Target p95 | Failure rate |
|---|---|---|---|
| Vocabulary search | 50 | < 200 ms | < 1% |
| Concept set save | 20 | < 500 ms | < 1% |
| Cohort definition save | 20 | < 300 ms | < 1% |
| Mapping review batch | 10 | < 800 ms | < 1% |

Load tests run weekly against a staging environment. Regressions > 20% from baseline block the release.

**Database query analysis** — `EXPLAIN ANALYZE` snapshots for the 20 most-executed queries (identified via `pg_stat_statements`) are committed to `tests/query-plans/`. Any migration that changes a query plan for these by > 30% in estimated cost triggers a manual review flag in CI (via a custom Pest database test that compares plans).

**Horizon queue throughput** — a load test seeds 1,000 concept mapping jobs and asserts all complete within 5 minutes with the standard 4-worker configuration.

---

### 8.14 Security Testing

**OWASP ZAP baseline scan** — runs against the staging Laravel API as a CI job on PRs targeting `main`. Scans for OWASP Top 10: SQLi, XSS, broken auth, IDOR, insecure headers, exposed stack traces. Any High or Critical finding blocks merge.

```yaml
- name: OWASP ZAP baseline scan
  uses: zaproxy/action-baseline@v0.11.0
  with:
    target: 'http://localhost:8082/api/v1'
    fail_action: true
    rules_file_name: '.zap/rules.tsv'
```

**Auth boundary tests** — every HTTP feature test that tests a protected route includes a sibling test asserting that the route returns 401/403 when called without a token or with insufficient permissions. This is enforced by a custom Pest `arch()` expectation:

```php
arch('every API route has an unauthenticated rejection test')
    ->expect('Tests\\Feature\\Api')
    ->toHaveAuthRejectionCounterpart();
```

**Secret scanning** — `trufflesecurity/trufflehog` runs on every push via GitHub Actions to prevent accidental credential commits.

**Dependency auditing** — `composer audit`, `npm audit --audit-level=high`, and `pip-audit` run on every CI build. High-severity CVEs block merge.

---

## Phase 9: Deployment (Weeks 18-24)

Docker prod: nginx, php, horizon, scheduler, python-ai (GPU), r-runtime, postgres+pgvector, redis.

Legacy migration: `parthenon:migrate-legacy`, `import-usagi-mappings`, `import-achilles-results`, `import-dqd-results`.

---

## Priority Order

| Priority | Module |
|---|---|
| **P0** | Infrastructure, Auth, DB schema |
| **P0** | Vocabulary loading + search + pgvector embeddings |
| **P0** | AI concept mapper + review UI |
| **P1** | Data ingestion pipeline (CSV + profiler + ETL) |
| **P1** | Cohort definitions + builder + SQL compiler |
| **P1** | Achilles engine + Data Explorer |
| **P2** | DQD engine + Data Quality dashboard |
| **P2** | Cohort generation + characterizations |
| **P3** | IR, Pathways, Profiles, NLP, Study orchestrator |
| **P4** | PLE/PLP (R sidecar), Feature extraction, Diagnostics |
| **P5** | Active learning, HL7, Multi-tenancy, i18n |

---

## Risks

| Risk | Impact | Mitigation |
|---|---|---|
| AI mapping accuracy | High | Conservative thresholds, human fallback, measure continuously |
| Cohort builder complexity | High | 4+ weeks, incremental build, extensive E2E tests |
| CDM multi-DB compat | High | Integration tests per driver, test on real CDMs early |
| Porting 3,700+ SQL checks | Medium | Automated via dialect layer, validate against known output |
| Circe replacement accuracy | High | Validate against legacy for known cohort definitions |
| R sidecar reliability | Medium | Plumber health checks, timeouts, retries |

---

## Timeline

| Phase | Weeks |
|---|---|
| Foundation | 1-4 |
| Database & OMOP | 3-7 |
| AI Ingestion | 5-12 |
| Data Quality | 8-13 |
| Research Workbench | 10-18 |
| Auth & Teams | 5-8 |
| Frontend | 8-20 |
| Testing | Ongoing |
| Deployment | 18-24 |

**Total: ~24 weeks (6 months)** with 2-3 developers.
Critical path: Foundation -> Vocabulary/Embeddings -> AI Mapper -> Research Workbench.
