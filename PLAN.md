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

### Design Philosophy

Atlas's UX was frozen in 2014: tab-heavy modal forms, disconnected pages, no real-time feedback, no AI, no collaboration, no keyboard navigation. Parthenon's frontend must be qualitatively different — not a reskin, but a rethinking of how outcomes research is done interactively.

**Ten governing principles:**

1. **Spatial over sequential.** Researchers think in graphs and networks, not forms. Where Atlas forces linear flows (modal → save → navigate), Parthenon uses canvas-based, multi-panel workspaces where related artifacts are visible simultaneously.
2. **AI as a collaborator, not a button.** The AI copilot is ambient — surfacing concept suggestions, flagging cohort issues, explaining DQ failures, and drafting inclusion criteria — throughout every surface, not isolated to the ingestion pipeline.
3. **Real-time first.** Every long-running operation (cohort generation, Achilles, DQD, study execution) emits live progress via Laravel Echo / WebSockets. No polling, no page-refresh, no "check back later."
4. **Keyboard sovereignty.** Every action reachable via keyboard. A command palette (`⌘K`) gives instant fuzzy access to any page, cohort, concept set, study, or action. Power users should be able to run a cohort without touching the mouse.
5. **Progressive disclosure.** Simple tasks are simple. Advanced options (temporal windows, censor events, custom end strategies, SQL preview) are a single expansion away — never buried, never mandatory.
6. **Context persistence.** Navigating away never loses in-progress work. Unsaved cohort expressions, concept set edits, and study configurations are auto-saved to draft state and restored on return.
7. **Data storytelling.** Results are not tables. Every numeric output has a chart. Every chart has a narrative annotation layer. Researchers can add findings-level comments that persist with the analysis.
8. **Composable panels.** The layout system allows splitting the viewport into multiple panels (cohort builder left, SQL preview right; vocabulary hierarchy top, concept set editor bottom). Panel state is URL-serialised so layouts can be shared.
9. **Accessibility by default.** WCAG 2.2 AA. Full keyboard navigation. Screen-reader tested. No chart-only information (always a table alternative). High-contrast and reduced-motion modes built in.
10. **Zero-friction sharing.** Every page, filter state, cohort expression, and analysis result is deep-linkable. Sharing a URL shares the exact state — including active tab, selected concept, and filter values.

---

### 7.1 Application Shell

#### Layout Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  [≡] Parthenon          [⌘K] Command...           [AI ●] [👤]  │  ← TopBar
├──────────┬──────────────────────────────────────────────────────┤
│          │                                                       │
│ Sidebar  │                 Main Panel                           │
│ (60-256px│         (multi-panel, splittable)                    │
│ collaps. │                                                       │
│          │                                                       │
│          │                                                       │
└──────────┴──────────────────────────────────────────────────────┘
```

The sidebar collapses to an icon rail (60 px) on demand or automatically on viewports < 1280 px. The main panel supports horizontal splits: any page can be "popped" into a right-hand panel (e.g., vocabulary search alongside concept set editor, or SQL preview alongside cohort builder). Panel split state persists in URL (`?panel=vocabulary&concept=4329847`).

#### TopBar

- **Logo + nav breadcrumb**: `Parthenon / Cohort Definitions / GiBleed New-User`
- **Command palette trigger** (`⌘K`): see 7.2
- **AI Copilot indicator**: green pulse when active, amber when processing; click to open the AI drawer
- **Job activity indicator**: spinning icon + count badge when any background job is running; click to open the Jobs slide-over
- **Notification bell**: real-time alerts (generation completed, DQD failed, mapping review ready)
- **User menu**: avatar initial, `hasRole`-gated quick links (Admin → if admin), theme toggle, sign out

#### Sidebar Navigation

```
Parthenon
├── Dashboard                      (all users)
│
├── ── DATA ──────────────────────
├── Data Sources                   (data-steward+)
├── Data Ingestion                 (data-steward+)
│   ├── Upload
│   ├── Ingestion Jobs
│   ├── Schema Mapping
│   ├── Concept Mapping
│   └── Review Queue
│
├── ── ANALYSIS ──────────────────
├── Data Explorer                  (researcher+)
│   ├── Characterization (Achilles)
│   ├── Data Quality (DQD)
│   └── Population Stats
├── Vocabulary                     (all users)
│   ├── Search
│   ├── Hierarchy
│   └── Concept Sets
├── Cohort Definitions             (researcher+)
├── Concept Sets                   (researcher+)
├── Analyses                       (researcher+)
│   ├── Characterizations
│   ├── Incidence Rates
│   ├── Pathways
│   ├── Pop. Level Estimation
│   └── Patient Level Prediction
├── Studies                        (researcher+)
├── Patient Profiles               (researcher+)
│
├── ── SYSTEM ────────────────────
├── Jobs                           (all users - own jobs)
├── Administration                 (admin+)
│   ├── Users
│   ├── Roles & Permissions
│   └── Auth Providers
```

Role-gated: items invisible (not just disabled) to users lacking permission. `data-testid` on every nav item for Playwright targeting.

Active item: left-border accent + background tint. Sub-items expand inline (no separate page for sub-navigation). Hover tooltips on collapsed rail mode show full label.

---

### 7.2 Command Palette (`⌘K`)

Global command palette, always available, inspired by Linear/Raycast. Opens with `⌘K` (Mac) / `Ctrl+K` (Windows/Linux) or clicking the search trigger in the TopBar.

**Search scope:** fuzzy-matches across:
- Pages and actions ("generate cohort", "new concept set", "run DQD")
- Cohort definitions (name, description)
- Concept sets
- Studies
- Vocabulary concepts (top 5 matches from Postgres full-text index)
- Users (admin context)
- Recent items (last 20 visited, stored in Zustand + localStorage)

**Result anatomy:**
```
[icon]  GiBleed New-User Cohort              Cohort Definitions
        Last generated 3h ago · 18,431 persons
[icon]  Generate cohort…                     Action
[icon]  Gastrointestinal Bleed (concept)     Vocabulary · SNOMED · 4291241
```

**Keyboard:** `↑↓` to navigate, `Enter` to go, `Tab` to preview in right panel without navigating, `Esc` to close. `>` prefix for commands only, `#` for concepts only, `@` for users.

**AI shortcut:** typing `?` prefix routes the query to the AI copilot and displays the answer inline without leaving the palette.

---

### 7.3 AI Copilot Drawer

A persistent right-side drawer (320 px, toggleable) that acts as a research assistant throughout the application. Context-aware: the copilot knows the currently open cohort definition, concept set, or analysis and provides relevant suggestions.

**Modes (tabs within drawer):**

| Tab | Function |
|---|---|
| **Chat** | Free-form questions: "explain this DQ failure", "suggest inclusion criteria for T2D", "what concepts map to ICD-10 E11?" |
| **Suggestions** | Proactive: "This cohort has no washout period — consider adding a 365-day lookback", "3 concepts in this set are non-standard — review?" |
| **SQL Explain** | Paste or auto-loads current cohort SQL; AI explains each CTE in plain English |
| **Literature** | PubMed-linked concept summaries for the active domain (powered by AI summarisation) |

AI responses cite sources (vocabulary IDs, OHDSI guidance docs, PubMed PMIDs) and include confidence indicators. Thumbs up/down feedback stored to improve future suggestions.

---

### 7.4 Dashboard

**URL:** `/`

Replaces Atlas's static landing page with an activity-centred command centre.

**Layout (3 columns above fold, activity feed below):**

```
┌─────────────┬─────────────┬─────────────────────────────────┐
│  My Cohorts │  My Studies │  Data Health                    │
│  (3 recent) │  (2 active) │  DQD score · Achilles freshness │
├─────────────┴─────────────┴─────────────────────────────────┤
│  Activity Feed (real-time)                                   │
│  ● Cohort "MACE Primary" generated — 24,109 persons  3m ago │
│  ● DQD check run completed — 2 new failures          1h ago │
│  ● Concept mapping batch — 847 auto-accepted         2h ago │
└──────────────────────────────────────────────────────────────┘
```

**Data Health widget:** single-glance CDM status. Achilles last-run age, DQD overall conformance score (%), record counts per domain (bar sparklines), and a colour-coded freshness indicator (green/amber/red). Click to go to Data Explorer.

**Quick-actions bar:** `+ New Cohort`, `+ New Concept Set`, `+ New Study`, `Run Achilles`, `Run DQD` — one-click shortcuts to the most common research actions.

**Recent items rail:** last 8 visited objects (cohorts, concept sets, studies, jobs) with type icons and status chips. Reopens exactly where you left off.

---

### 7.5 Data Sources

**URL:** `/data-sources`

Replaces the Atlas Source/Daimon configuration page. Card-based layout: one card per source.

**Source card:**
- Source name, CDM version, dialect badge (PostgreSQL)
- Daimon chips: CDM ✓, Vocab ✓, Results ✓ / ✗ (colour-coded)
- "Last Achilles" and "Last DQD" run timestamps with staleness indicator
- Quick-action buttons: `Run Achilles`, `Run DQD`, `Edit`, `Test Connection`
- Record count sparklines: person, visit, condition, drug (pulled from Achilles results)

**Add source flow:** stepped wizard (connection string → test → daimon config → save) with live connection-test feedback before saving. No page navigation required — the wizard is a right-side sheet.

---

### 7.6 Data Ingestion (AI ETL)

**URL:** `/ingestion`

Already partially built (Phases 3 & 5). Phase 7 polishes the UX and fills remaining gaps.

#### 7.6.1 Ingestion Dashboard

Active and recent pipelines. Filterable by status (Running / Completed / Failed / Draft). Each job card shows:
- Source file name, size, upload timestamp
- Pipeline stage progress bar: `Upload → Profile → Schema Map → Concept Map → Review → Write`
- Current stage with live step-level progress (WebSocket)
- Person/record estimates per domain

#### 7.6.2 Upload

Drag-and-drop zone (multi-file). Accepts CSV, TSV, XLSX, Parquet, JSON, HL7 FHIR R4 bundles. File-type badge auto-detected. Progress ring per file. Validation errors displayed inline (duplicate header names, encoding issues) before the pipeline starts.

#### 7.6.3 Schema Mapping

Two-panel layout: source columns (left) and target OMOP fields (right). AI-suggested mappings displayed as confidence-ranked rows — green (auto-accepted), amber (needs review), red (no match found). Drag rows to reorder; double-click to override. Column preview shows 5 sample values to aid manual mapping decisions. "Apply all suggestions above 0.9 confidence" bulk action.

#### 7.6.4 Concept Mapping

Full-width table: source value, source count, AI-suggested OMOP concept (name + ID + domain), confidence bar, and status chip. Filter bar: domain, status, confidence tier. Batch-select rows for bulk accept/reject/reassign. Clicking a suggestion opens the vocabulary hierarchy inline in a split-right panel — researchers can browse siblings/children without leaving the review queue.

**Keyboard shortcuts:** `A` = accept, `R` = reject, `S` = skip, `J/K` = next/prev row (vim-style).

#### 7.6.5 Review Queue

Prioritised by downstream impact: concepts with highest source-value frequency appear first. Queue statistics header: total, accepted, rejected, pending, auto-accepted. Export-to-CSV for offline review / audit trail. Pagination replaced by virtual scrolling (react-virtual).

---

### 7.7 Data Explorer (Ares Replacement)

**URL:** `/data-explorer`
**Replaces:** Ares + standalone Achilles/DQD visualisation tools

Three sub-sections, unified under a source-aware shell. Top-level source selector (dropdown) applies to all sub-sections.

#### 7.7.1 Characterization (Achilles)

**URL:** `/data-explorer/characterization`

Overview page: domain record counts (horizontal bar chart, sortable), person demographics (population pyramid — age × sex), observation period distribution (line area chart), and a "freshness" banner if Achilles results are > 30 days old.

**Domain deep-dives** (navigated via domain tab strip):

| Domain | Visualisations |
|---|---|
| Person | Age distribution (histogram 5-yr bins), sex pie, race/ethnicity breakdown, index year line |
| Condition | Prevalence treemap (condition category → specific condition), top-50 conditions bar, temporal trend (year-over-year), co-occurrence heatmap |
| Drug | Drug class sunburst (ATC → drug), exposure duration histogram, days-supply distribution, polypharmacy histogram |
| Measurement | Measurement × value distribution (box plots per concept), lab result over time (line), abnormal flag rate |
| Observation | Similar to measurement; free-text vs coded split |
| Visit | Visit type donut, length-of-stay box-plot, visit frequency histogram |
| Death | Cause of death bar, time-from-cohort-entry-to-death KM curve |
| Procedure | Procedure frequency, OR vs inpatient vs outpatient split |

**Chart interactions:** click any bar/segment to filter the full page to that subgroup; breadcrumb shows active filters; "Export to PNG" and "Copy data as CSV" on every chart. Annotations: click a chart → add a sticky note (persists in database, visible to all users with access to that source).

#### 7.7.2 Data Quality Dashboard (DQD)

**URL:** `/data-explorer/data-quality`

Replaces the standalone DQD Shiny app.

**Scorecard header:** overall conformance score (large %, colour-coded), pass/fail/error counts, last run timestamp, `Run DQD` button.

**Category breakdown** (Kahn et al. 2016 framework): three columns — Completeness, Conformance, Plausibility — each with a donut score and failing-check count.

**Checks table** (filterable by category, severity, domain, status):
- Check name, domain, table, field, severity (note/warning/error/critical)
- Threshold value, actual value, delta
- Expandable row: full check description, SQL query used, suggested remediation
- Status toggle: Mark as "Acknowledged" (with reason) — acknowledged checks excluded from score

**Drill-down:** clicking a failing check opens a right panel with the raw SQL, the failing rows (sample, paginated), a time-series of this check's value across historical DQD runs, and a link to the OHDSI DQD documentation for that check.

#### 7.7.3 Population Stats

**URL:** `/data-explorer/population`

Free-form population exploration without needing to define a full cohort. Filter builder (domain + concept + date range + value) produces a live person count and domain breakdown. Think of it as a "quick cohort count" for ad-hoc exploration.

Venn/UpSet diagram when 2–6 conditions are selected simultaneously (powered by D3 UpSet.js). Population pyramid refreshes with each filter change.

---

### 7.8 Vocabulary Browser (Athena Replacement)

**URL:** `/vocabulary`
**Already built:** search, hierarchy tree, concept detail panel (Phase 5). Phase 7 adds:

**Enhanced search UX:**
- Filter chips replace dropdowns: `Domain: Condition` `Vocabulary: SNOMED` `Standard only` — removable chips, instant re-query
- Saved searches ("My Searches") persisted per user
- Concept comparison: select 2–4 concepts → "Compare" opens a side-by-side panel showing all attributes, relationships, and ancestor paths simultaneously
- Export search results to CSV

**Concept detail panel:**
- Add-to-concept-set popover (select target set or create new) without leaving the page
- "Related studies" — shows any cohort definitions or concept sets that reference this concept
- "Usage statistics" — record count for this concept in connected CDMs (if Achilles results exist), shown as sparkline
- Relationship graph: D3 force-directed mini-graph of concept relationships (parents, children, maps-from/to) — more intuitive than a flat list for branching hierarchies

**Hierarchy tree:**
- Keyboard navigable: `→` expand, `←` collapse, `↑↓` navigate siblings
- "Pin" nodes to keep them expanded across navigations
- Breadcrumb at top shows current concept's ancestor chain to root
- Level-of-Detail: shows only standard children by default; toggle "show non-standard" to reveal mapped variants

---

### 7.9 Cohort Definitions

**URL:** `/cohort-definitions`
**Already built:** full CRUD, expression editor, generation, SQL preview (Phase 5). Phase 7 adds:

#### 7.9.1 List Page Upgrades
- Gallery / table view toggle
- Status chips: Draft, Generated (N persons, date), Failed
- Bulk actions: generate all selected, export expressions as JSON, copy to another source
- Cohort comparison: select 2 cohorts → view Venn overlap (requires both generated against same source)

#### 7.9.2 Cohort Expression Editor — UX Refinements

**Visual cohort builder mode:** toggle between the current form-based editor and a node-graph view (D3 dagre layout) where each criterion is a node, inclusion rules are edges, and logical operators (AND/OR/NOT) are junction nodes. Researchers who think visually can build cohorts without encountering a single text input.

**Inline validation:** real-time warnings as the expression is built:
- "No washout period defined" (AI suggestion: "Add 365-day prior observation requirement?")
- "Concept set is empty" with a link to open the concept set editor in a split-right panel
- "End strategy not specified — defaults to observation period end"

**Concept set picker improvements:** search box inside the picker, "recent" concept sets at top, "Create and assign" one-click to create a new concept set and immediately assign it to this criterion.

**Temporal window visualiser:** interactive timeline diagram showing the index event, start/end windows, and gap ranges. Dragging the window handles updates the numeric inputs. Updates bi-directionally.

**Cohort diagnostics panel** (after generation):
- Attrition chart: waterfall bar chart showing person count after applying each inclusion rule in order
- Inclusion rule breakdown table: persons passing, failing, gain, percent
- Concept set coverage: for each concept set used, shows the actual record count in the CDM
- Index event distribution: histogram of index dates over time

#### 7.9.3 Generation History
Live-updating row for the active generation (spinner + elapsed time + current step label). Completed rows show person count, duration, and source. One-click regeneration. Delete generation record (with confirmation). CSV export of generation results (subject_id, start_date, end_date).

---

### 7.10 Analyses

**URL:** `/analyses`
**Already built:** Characterizations, Incidence Rates list/detail pages (Phase 5 shell). Phase 7 completes all analysis types.

#### 7.10.1 Characterizations

Cohort characterization (Feature Extraction): select a generated cohort + feature set (demographics, conditions, drugs, procedures, measurements). Dispatches an R-sidecar job. Results rendered as:

- **Covariate table**: feature name, % in cohort, mean (for continuous), standardised mean difference (SMD) vs comparator if applicable — sortable, searchable, CSV-exportable
- **SMD forest plot**: all covariates plotted with confidence intervals; click row to highlight concept in vocabulary browser
- **Domain breakdown tabs**: separate views for each domain with domain-appropriate charts (condition prevalence treemap, drug sunburst, measurement distribution box plots)

#### 7.10.2 Incidence Rates

**IR builder**: target cohort, outcome cohort, time-at-risk start/end offsets, optional subgroup stratification (age, sex, calendar year). Results as:

- Rate table: IR, person-time, case count, 95% CI — per subgroup row
- Trend line chart: IR by calendar year with CI ribbon
- Subgroup comparison bar chart
- Export: CSV, publication-ready PNG

#### 7.10.3 Pathways

Patient Treatment Pathways (OHDSI Sunburst): define a target cohort and up to 10 event cohorts (treatment lines). Results displayed as:

- **Sunburst diagram** (D3): each ring = treatment line; arc width = patient proportion. Interactive: hover shows path + %, click drills down to that sub-path
- **Sankey diagram** alternative: treatment sequences as flowing bands (D3 Sankey)
- **Path table**: top-N most common treatment sequences, sortable by frequency
- **Combination detection**: identifies patients receiving simultaneous treatments (overlapping cohort periods)

Settings: maximum path length, combination window (days), minimum cell count (privacy threshold), event persistence strategy.

#### 7.10.4 Population-Level Estimation (PLE)

Comparative cohort study: target and comparator cohort, outcome, propensity score model, time-at-risk. Dispatches CohortMethod R-sidecar job.

Results page:

- **Propensity score distribution** (mirrored histogram — target above axis, comparator below)
- **Covariate balance** (SMD plot before/after PS matching or weighting)
- **Kaplan-Meier curve** with risk table
- **Forest plot** (subgroup HRs with CI)
- **Calibration plot** (negative control outcomes)
- Effect estimate table: HR, RR, OR, 95% CI, p-value, method

#### 7.10.5 Patient-Level Prediction (PLP)

Prediction model builder: target cohort, outcome cohort, time-at-risk, ML algorithm selector (LASSO, XGBoost, random forest, GBM via PatientLevelPrediction). Dispatches PLP R-sidecar job.

Results page:

- **ROC curve** with AUC (interactive: hover shows sensitivity/specificity at each threshold)
- **Precision-Recall curve**
- **Calibration plot** (observed vs predicted probability by decile)
- **Variable importance** (SHAP-style horizontal bar chart, top-20 features)
- Performance table: AUROC, AUPRC, Brier score, Calibration slope, c-statistic

---

### 7.11 Studies (Strategus Replacement)

**URL:** `/studies`

The highest-level orchestration layer — a study bundles multiple analyses (characterization, IR, PLE, PLP) to be executed consistently across federated CDM sites. Replaces OHDSI Strategus.

#### Study Builder

Step-by-step wizard with a persistent **study DAG sidebar** (directed acyclic graph showing study components and their dependencies):

```
Study: "ACE Inhibitor Comparative Effectiveness"
├── Concept Sets (3)          ← shared across all analyses
│   ├── ACE Inhibitors
│   ├── ARBs
│   └── MACE Outcomes
├── Cohorts (3)
│   ├── ACE Inhibitor New Users
│   ├── ARB New Users
│   └── MACE (outcome)
└── Analyses (2)
    ├── Incidence Rate (MACE in each cohort)
    └── Population-Level Estimation (ACE vs ARB → MACE)
```

Each node in the DAG is clickable (opens inline editor for that component). Edges show data dependencies (which cohorts feed which analyses). Status badges on each node (Draft / Ready / Running / Complete / Failed) update live via WebSocket.

**Study Protocol**: auto-generated Markdown document from the study configuration — hypothesis, target/comparator/outcome definitions, analysis specs. Exported as a DOCX or PDF for regulatory submission. OHDSI Protocol Template compliant.

**Network execution**: for federated networks, each participating CDM site listed with its status (Invited / Running / Results Submitted / Complete). Results are aggregated (meta-analysis forest plot) when all sites complete. Data never leaves the site — only summary statistics are transmitted.

**Study Package export**: generates an R-ready Strategus JSON study package for sites that cannot use the Parthenon API directly (backward compatibility).

---

### 7.12 Patient Profiles

**URL:** `/profiles`

Interactive individual patient timeline. Requires a generated cohort and a connected CDM source with patient-level data access permissions.

**Patient selector**: search by subject_id (de-identified) within a cohort; random-patient navigation; filter by subgroup.

**Timeline view:**

```
Age: 45                      Index Date: 2018-03-15
─────────────────────────────────────────────────────────────────►
│ Conditions   [■ Type 2 Diabetes]        [■ Hypertension]
│              [■ Hyperlipidemia]                       [■ CKD]
│ Drugs        [══ Metformin ══════════════════]  [═══ Lisinopril
│              [═══ Atorvastatin ══════════════════════════════]
│ Visits       ↑ ED    ↑ Out  ↑ Out  ↑ Out     ↑ Hosp  ↑ Out
│ Measurements         ✦ HbA1c 7.2           ✦ HbA1c 8.1
```

- Each row is a domain; events rendered as blocks (for durations) or markers (for point events)
- Colour-coded by concept domain; hover for concept name, date, value
- Scrollable horizontally (time), collapsible rows vertically
- Index date highlighted with a vertical marker
- Click any event to open the full observation record detail
- "Add annotation" on any event — persisted per-study note visible to collaborators

**Privacy controls**: `profiles.view` permission required; de-identified subject_id only; no free-text note access unless explicitly enabled by admin.

---

### 7.13 Jobs

**URL:** `/jobs`

Unified job monitor across all job types: cohort generation, Achilles, DQD, PLE, PLP, Pathway, concept mapping, ingestion.

**List view**: sortable/filterable table. Columns: job type (icon), name, status (badge), created, started, duration, queued-by user, actions (cancel if running, re-run if failed, view log).

**Job detail slide-over**: full log output (ANSI-coloured terminal display), step-by-step progress timeline, error traceback if failed, output artifact links (result record, generated cohort, DQD report).

**Horizon integration**: link to Laravel Horizon dashboard for infrastructure-level queue visibility (available to admins).

**Real-time**: all status changes pushed via Laravel Echo; no manual refresh required.

---

### 7.14 Administration

**URL:** `/admin`
**Already built:** Users, Roles & Permissions (permission matrix), Auth Providers (Phase 6). Phase 7 adds:

#### Vocabulary Management

`/admin/vocabulary` — status panel for the OMOP vocabulary tables: loaded vocabularies (name, version, concept count, load date), vocabulary health checks (orphaned concepts, missing relationships), and a trigger for re-importing vocabulary from a new Athena download.

#### System Configuration

`/admin/config` — application-level settings:
- Default CDM source for new analyses
- AI service enable/disable toggles per feature (concept mapping, copilot, NLP)
- Achilles/DQD auto-run schedules (cron expressions with human-readable preview)
- Email notification settings (SMTP config, alert thresholds)
- Data retention policies (generation history TTL, job log TTL)

#### Audit Log

`/admin/audit` — immutable log of all write operations across the platform (who, what, when, before/after values). Filterable by user, action type, entity type, date range. Non-repudiation critical for regulatory environments.

---

### 7.15 Visualization Library

**Primary stack:**

| Library | Role |
|---|---|
| **Recharts** | Standard charts: bar, line, area, scatter, donut, histogram, composed |
| **D3 v7** | Custom / interactive: force graph, dagre DAG, sunburst, sankey, timeline, treemap, UpSet |
| **Visx** (AirBnB) | Low-level D3-React bridge for bespoke chart components |
| **Observable Plot** | Exploratory small-multiples and layered statistical charts |

**Chart catalogue:**

| Chart | Used In |
|---|---|
| Population pyramid | Data Explorer / Characterization (person domain) |
| Treemap | Condition / Procedure prevalence |
| Sunburst | Drug class hierarchy, Treatment Pathways |
| Sankey | Treatment Pathways (alternative view) |
| Box plot | Measurement value distributions |
| Histogram | Age, days-supply, observation period |
| Kaplan-Meier curve | PLE results |
| Forest plot | PLE subgroup HRs, IR comparisons, meta-analysis |
| SMD plot (lollipop) | Covariate balance |
| ROC curve | PLP model evaluation |
| Precision-Recall curve | PLP model evaluation |
| Calibration plot | PLP model evaluation |
| SHAP bar chart | PLP variable importance |
| Waterfall / Attrition | Cohort inclusion rule attrition |
| Venn diagram | Cohort overlap (2–3 cohorts) |
| UpSet plot | Cohort overlap (4+ cohorts) |
| Mirrored histogram | PLE propensity score overlap |
| Heatmap | Concept co-occurrence, correlation matrix |
| Force-directed graph | Concept relationship network |
| Timeline (swimlane) | Patient profiles |
| Sparkline | Dashboard/card summary values |
| Donut + score | DQD scorecard |

**Cross-cutting chart standards:**
- All charts export PNG (high-DPI) and CSV via a standard right-click context menu
- All charts have a "Table view" toggle for screen-reader accessibility
- All charts respect system-level colour-scheme preference (dark/light)
- Colour palettes are perceptually uniform (OKLab-based) and colour-blind safe (tested against Deuteranopia and Protanopia)
- Hover tooltips rendered via a portal (never clipped by overflow) with ARIA roles

---

### 7.16 State Architecture

| Concern | Tool | Notes |
|---|---|---|
| Server state | **TanStack Query v5** | All API data: caching, background refetch, pagination, optimistic updates |
| Client state | **Zustand** | Per-feature stores: `cohortExpressionStore`, `uiStore`, `authStore`, `studyBuilderStore` |
| Forms | **React Hook Form + Zod** | Validation at field level; schema shared with backend TS types |
| URL state | **React Router v6** | Deep-linkable filters, panel splits, selected items; `useSearchParams` |
| Real-time | **Laravel Echo + Pusher** | WebSocket channel per job, per cohort generation, per study execution |
| Drag-and-drop | **@dnd-kit/core** | Concept set item reordering, panel splits, DAG node repositioning |
| Virtual lists | **TanStack Virtual** | Concept mapping review queue (10k+ rows), job logs |
| Rich text | **Tiptap** | Study protocol editor, annotation notes |
| Command palette | **cmdk** | Global `⌘K` command palette |
| Date/time | **date-fns** | All formatting and arithmetic (no Moment.js) |
| Keyboard shortcuts | **useHotkeys** | Registered per-page with a help sheet (`?`) |

---

### 7.17 Interaction Design System

#### Design Tokens

All visual attributes defined as CSS custom properties (TailwindCSS v4 theme). Tokens:

- **Color**: 9-shade semantic palettes (foreground, background, muted, accent, primary, destructive, success, warning, info) + data-viz palettes
- **Typography**: `--font-sans` (Inter), `--font-mono` (Geist Mono) — mono used for concept IDs, SQL, medical codes
- **Spacing**: 4 px base grid
- **Radius**: small (4 px), medium (8 px), large (16 px) — applied consistently by component type
- **Shadow**: 3 elevations (card, modal, overlay)
- **Motion**: `--duration-fast` (100 ms), `--duration-base` (200 ms), `--duration-slow` (350 ms) — all transitions respect `prefers-reduced-motion`

#### Component Library

Built on Radix UI primitives (accessible, unstyled) + TailwindCSS v4 styling. Components:

| Group | Components |
|---|---|
| Layout | Sheet (slide-over), Dialog (modal), Drawer, Popover, Tooltip, ContextMenu, Splitter |
| Data display | Table (sortable, paginated, virtual-scroll), Card, Badge, Avatar, Skeleton, Timeline |
| Forms | Input, Textarea, Select, Combobox (searchable), MultiSelect, DatePicker, Checkbox, Switch, RadioGroup, Slider |
| Feedback | Toast (top-right, 4s, dismissible), AlertBanner, Progress (linear + circular), Spinner, EmptyState |
| Navigation | Tabs, Breadcrumb, Pagination, CommandPalette, Sidebar, Stepper |
| Charts | ChartContainer (standard wrapper with title, export, table-view toggle) |

All interactive components have `data-testid` attributes. All custom components export a Storybook story. All form components are keyboard-navigable with clear focus rings.

#### Keyboard Shortcuts

Global shortcuts (active on all pages):

| Shortcut | Action |
|---|---|
| `⌘K` | Open command palette |
| `⌘/` | Open AI copilot drawer |
| `⌘J` | Open jobs slide-over |
| `⌘,` | Go to settings (admin only) |
| `?` | Show keyboard shortcut help sheet |
| `G` then `D` | Go to Dashboard |
| `G` then `C` | Go to Cohort Definitions |
| `G` then `V` | Go to Vocabulary |
| `G` then `S` | Go to Studies |

Page-level shortcuts documented in each section above (`A/R/S/J/K` for mapping review, `→/←/↑↓` for hierarchy tree, etc.).

---

### 7.18 Performance Targets

| Metric | Target | Measurement |
|---|---|---|
| Initial page load (LCP) | < 2.0 s | Lighthouse CI, p75 |
| Route navigation (SPA) | < 150 ms | React DevTools Profiler |
| Vocabulary search (TTFB) | < 100 ms | k6 |
| Chart render (10k data points) | < 300 ms | Vitest benchmark |
| Command palette open | < 50 ms | Measured with `performance.now()` |
| Bundle size (initial) | < 250 kB gzip | Vite bundle analysis |
| Route chunks (lazy) | < 80 kB gzip each | Vite bundle analysis |

**Techniques:**
- All routes lazy-loaded (`React.lazy` + `Suspense`) — already implemented
- TanStack Query stale-while-revalidate on all list endpoints
- Optimistic UI updates on all mutations (no waiting for server before UI reflects change)
- `react-virtual` for all tables > 100 rows
- D3 charts rendered to `<canvas>` for data sets > 5,000 points; SVG for < 5,000
- Service worker (Workbox) for static asset caching in production
- `preconnect` DNS hints to API origin and AI service origin in `<head>`

---

### 7.19 Accessibility & Internationalisation

**Accessibility (WCAG 2.2 AA):**
- All interactive elements keyboard-reachable and have visible focus indicators
- All images and charts have `aria-label` or `aria-describedby`
- All colour-only information has a secondary non-colour indicator (icon or pattern)
- Modal dialogs trap focus and restore on close
- Live regions (`aria-live="polite"`) for toast notifications and async status updates
- High-contrast mode: system-level `prefers-contrast: more` automatically activates a high-contrast theme variant

**Internationalisation:**
- All user-facing strings externalised via `react-i18next` with English as the source locale
- Date/time formatted via `Intl.DateTimeFormat` (locale-aware)
- Number formatting via `Intl.NumberFormat` (thousand separator, decimal locale)
- Medical concept names always served from OMOP vocabulary (multilingual concept names available via `concept_synonym` where loaded)
- RTL layout support via CSS logical properties (`margin-inline-start` not `margin-left`)

---

### 7.20 Already-Built Inventory (Do Not Rebuild)

The following features are fully implemented and must be preserved/extended, not rebuilt:

| Feature | Phase | Status |
|---|---|---|
| Auth (login/logout, Sanctum) | 1, 6 | Complete |
| Sidebar + TopBar shell | 1, 6 | Complete |
| Dark mode (TailwindCSS v4 `dark:`) | 1 | Complete |
| Data Sources CRUD | 1 | Complete |
| AI Ingestion (Upload, Jobs, Schema Map, Review) | 3 | Complete |
| Vocabulary Search + Hierarchy + Concept Sets | 5 | Complete |
| Cohort Definitions (Editor, Generation, SQL Preview) | 5 | Complete |
| Concept Sets (CRUD + item flags) | 5 | Complete |
| Analyses (Characterizations, Incidence Rates) | 5 | Complete (shell) |
| Data Explorer (shell) | 5 | Shell only |
| Administration (Users, Roles Matrix, Auth Providers) | 6 | Complete |
| Router (lazy routes, `/admin/*`) | 1, 5, 6 | Complete |

---

### 7.21 Build Order

Phase 7 work is sequenced by user value and dependency:

| Step | Deliverable | Deps |
|---|---|---|
| 7A | Command palette + keyboard shortcuts + AI drawer shell | — |
| 7B | Dashboard (activity feed, data health widget, quick actions) | Achilles/DQD results |
| 7C | Data Explorer: Achilles visualisations (all domains) | Achilles results |
| 7D | Data Explorer: DQD Scorecard + drill-down | DQD results |
| 7E | Cohort Definitions: attrition chart, diagnostics panel, visual builder | Cohort generation |
| 7F | Analyses: Characterization results (covariate table, SMD plot) | R sidecar |
| 7G | Analyses: Incidence Rate results (trend, subgroup) | IR engine |
| 7H | Analyses: Pathways (sunburst + sankey) | R sidecar |
| 7I | Patient Profiles (timeline, domain rows) | CDM access |
| 7J | Studies (builder, DAG, protocol, network execution) | All analyses |
| 7K | Analyses: PLE results (KM, forest plot, PS overlap) | CohortMethod |
| 7L | Analyses: PLP results (ROC, calibration, SHAP) | PLP sidecar |
| 7M | Admin: Vocabulary management + audit log + system config | — |
| 7N | Storybook, accessibility audit, Lighthouse CI gate | All above |

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
