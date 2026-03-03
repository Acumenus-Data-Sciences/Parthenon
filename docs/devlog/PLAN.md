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

## Phase 9: Atlas Parity, Migration & Documentation (Weeks 20-24)

This phase ensures that every research team currently running Atlas can switch to Parthenon without losing a single workflow, and that users who have never touched OHDSI tooling can onboard confidently within a day. It covers three areas: a systematic Atlas feature parity audit with gap remediation, a migration tooling suite to import Atlas artefacts and WebAPI configurations, and a full documentation platform (Quick Start, User Manual, API Reference, Migration Guide) delivered as a Docusaurus site with PDF exports.

---

### 9.1 Atlas Feature Parity Audit

The table below is the definitive checklist. Every row must be green before Phase 10 (Deployment). Items already delivered in earlier phases are marked; gaps are assigned to specific 9.x subsections.

#### Cohort & Concept Management

| Atlas Feature | Parthenon Equivalent | Status |
|---|---|---|
| Cohort Definition builder (Circe JSON) | `CohortSqlCompiler` + expression editor | ✅ Phase 5 |
| Circe JSON import (Atlas export format) | `POST /cohort-definitions/import` | 🔲 §9.2 |
| Circe JSON export | `GET /cohort-definitions/{id}/export` | 🔲 §9.2 |
| Concept Set builder | Concept set editor + item flags | ✅ Phase 5 |
| Concept Set JSON import/export | `POST /concept-sets/import`, `GET .../export` | 🔲 §9.2 |
| Cohort copy / clone | `POST /cohort-definitions/{id}/copy` | ✅ Phase 5 |
| Cohort tagging / search | Tag field on definitions + filter API | 🔲 §9.2 |
| Cohort sharing (read-only link) | Deep-link URL → public read token | 🔲 §9.2 |

#### Vocabulary

| Atlas Feature | Parthenon Equivalent | Status |
|---|---|---|
| Concept search (name, code, ID) | Vocabulary search endpoint + panel | ✅ Phase 5 |
| Domain / vocabulary / class filters | Filter params on search API | ✅ Phase 5 |
| Hierarchy tree (ancestors/descendants) | `HierarchyTree` component | ✅ Phase 5 |
| Concept relationships | Relationship panel in ConceptDetailPanel | ✅ Phase 5 |
| Standard / non-standard toggle | `standard_concept` filter param | ✅ Phase 5 |
| Synonym search | Synonym rows in concept detail | ✅ Phase 5 |
| Concept comparison (side-by-side) | Multi-concept comparison panel | 🔲 §9.3 |
| "Maps from" (source codes) | Reverse relationship query | 🔲 §9.3 |

#### Analyses

| Atlas Feature | Parthenon Equivalent | Status |
|---|---|---|
| Cohort Characterization (FeatureExtraction) | `CharacterizationService` + 6 builders | ✅ Phase 5 |
| Incidence Rate analysis | `IncidenceRateService` + stratification | ✅ Phase 5 |
| Treatment Pathways (PathFinder) | `PathwayService` + Sankey/sunburst | ✅ Phase 5 |
| Population-Level Estimation (CohortMethod) | `EstimationService` → R sidecar | ✅ stub Phase 5 |
| Patient-Level Prediction (PLP) | `PredictionService` → R sidecar | ✅ stub Phase 5 |
| Negative Control Outcomes selection | Negative control concept set + IR run | 🔲 §9.4 |
| Cohort Diagnostics | `CohortDiagnosticsService` → R sidecar | 🔲 §9.4 |
| Cohort Overlap / Venn | Overlap analysis endpoint + Venn chart | 🔲 §9.4 |
| IR analysis with negative controls | NC-adjusted IR computation | 🔲 §9.4 |

#### Data Sources & Configuration

| Atlas Feature | Parthenon Equivalent | Status |
|---|---|---|
| Source registration (CDM + Vocab + Results) | Data Sources CRUD + Daimons | ✅ Phase 1 |
| Source priority ordering | `priority` field on Source | ✅ Phase 1 |
| CDM version detection | `cdm_version` on Source | ✅ Phase 2 |
| WebAPI source JSON import | `POST /data-sources/import-webapi` | 🔲 §9.5 |
| Achilles heel rules | Achilles heel check engine | 🔲 §9.4 |

#### Patient Profiles

| Atlas Feature | Parthenon Equivalent | Status |
|---|---|---|
| Patient timeline by domain | `PatientTimeline` swimlane | ✅ Phase 5 |
| Cohort member navigation | `CohortMemberList` pagination | ✅ Phase 5 |
| Domain record drill-down | `ClinicalEventCard` detail | ✅ Phase 5 |
| Concept record detail | Link to vocabulary browser | 🔲 §9.3 |
| Drug era / condition era (derived) | Era derivation query + timeline layer | 🔲 §9.4 |

#### Administration

| Atlas Feature | Parthenon Equivalent | Status |
|---|---|---|
| User management | Admin → Users page | ✅ Phase 6 |
| Role assignment | Admin → Roles & Permissions | ✅ Phase 6 |
| Source-level permissions | Per-source role restrictions | 🔲 §9.5 |
| Atlas security provider config | Admin → Auth Providers (LDAP/OAuth2/OIDC/SAML) | ✅ Phase 6 |
| WebAPI URL configuration | System Config panel | 🔲 §9.5 |

---

### 9.2 Import / Export Compatibility Layer

Atlas stores cohort definitions and concept sets as Circe-format JSON. Parthenon must read and write this format without loss.

#### Cohort Definition Import/Export

**`POST /api/v1/cohort-definitions/import`**

- Accepts the standard Atlas cohort expression JSON (single object or Atlas "export" wrapper with `name`, `description`, `expression`)
- Runs through `CohortExpressionSchema::normalise()` to fill any missing optional fields
- Creates a new `CohortDefinition` record and returns it
- Batch import: accepts a JSON array of expressions; returns array of results (success/failure per item)
- Validation errors returned per item (does not abort the whole batch)

**`GET /api/v1/cohort-definitions/{id}/export`**

Returns the expression JSON in the exact Atlas export wrapper format:

```json
{
  "name": "GiBleed New-User Cohort",
  "description": "...",
  "expression": { /* Circe CohortExpression */ }
}
```

Accepting `Accept: application/zip` on a batch export returns a ZIP containing one JSON file per cohort definition.

**`artisan parthenon:import-atlas-cohorts {path}`**

CLI command for bulk import from a directory of Atlas-exported JSON files. Skips duplicates (by name hash). Reports: imported N, skipped K (duplicate), failed M (with error).

#### Concept Set Import/Export

**`POST /api/v1/concept-sets/import`**

Accepts Atlas concept set export format (name, expression items with `concept.CONCEPT_ID`, `includeDescendants`, `includeMapped`, `isExcluded`). Maps Atlas field names to Parthenon schema. Batch import supported.

**`GET /api/v1/concept-sets/{id}/export`**

Returns Atlas-format concept set JSON with full concept objects embedded (as Atlas expects when re-importing). Concept objects fetched from the vocabulary schema.

#### Cohort Tagging

Add `tags` (string array, stored as `jsonb`) to `cohort_definitions` table. Filter params on the list endpoint: `?tags[]=diabetes&tags[]=new-user`. Tag management: inline tag input on the definition detail page (create-on-type). Shared global tag list for autocomplete (distinct tags from all definitions).

#### Read-Only Sharing Links

`POST /api/v1/cohort-definitions/{id}/share` — generates a signed URL token (expires in N days, configurable). Recipients who are not logged in can view the cohort expression and generation results (read-only, no CDM data) via a public-facing page at `/shared/{token}`. Useful for sharing study protocols pre-publication.

---

### 9.3 Vocabulary Enhancements

#### Concept Comparison

**`GET /api/v1/vocabulary/compare?ids[]=4329847&ids[]=4182210`**

Returns 2–4 concept objects side-by-side with all attributes, relationships, and first 2 levels of ancestor hierarchy for each. Frontend renders them as equal-width cards with a "same/different" highlight for fields that differ.

#### "Maps From" (Reverse Source Codes)

`GET /api/v1/vocabulary/concepts/{id}/maps-from` — queries `concept_relationship` where `relationship_id = 'Mapped from'` (reverse of "Maps to"). Returns source codes (ICD-10-CM, SNOMED, RxNorm, etc.) that map to this standard concept. Essential for understanding what EHR source codes feed a standard concept.

#### Concept → Clinical Record Link

From the patient profile's clinical event card, clicking a concept name navigates to the vocabulary browser with that concept pre-selected. URL: `/vocabulary?concept={id}`. Vocabulary page detects this param on mount and loads the concept directly into the detail panel.

#### Drug / Condition Era Layer in Patient Profiles

**`GET /api/v1/sources/{source}/profiles/{personId}/eras`**

Queries `drug_era` and `condition_era` tables (OMOP CDM derived tables). Returns era records grouped by domain. The `PatientTimeline` component adds an "Eras" toggle that overlays era blocks (longer duration bars) behind the individual exposure events.

---

### 9.4 Gap Remediation — Analyses

#### Negative Control Outcomes

Negative controls are outcomes not expected to be causally associated with the exposure, used to detect residual confounding in PLE studies.

**Backend:**

`NegativeControlService` — queries a published negative control concept set (OHDSI's standard ~700-concept NC set, loaded into a `negative_controls` table via seeder) and filters to concepts present in the connected CDM.

`GET /api/v1/negative-controls?source_id={id}` — returns NC concepts with CDM prevalence (from Achilles results). Frontend renders a checklist of recommended NCs ranked by outcome prevalence.

`EstimationDesign` extended with `negativeControlOutcomeIds[]` — these are included as additional outcomes in the CohortMethod payload; results used to calibrate the empirical null distribution and produce calibrated p-values.

**Frontend:**

`NegativeControlPicker.tsx` — searchable, paginated list of NC concepts with prevalence bars. "Recommended" (top 50 by prevalence), "All NCs" tabs. Multi-select with select-all. Embedded in `EstimationDesigner` as an expandable section.

#### Cohort Diagnostics

**Backend:**

`CohortDiagnosticsService` — orchestrates R sidecar's CohortDiagnostics package. Payload: cohort expression, CDM source, diagnostics to run (incidenceRates, cohortOverlap, indexEventBreakdown, inclusionStatistics, visitContext, temporalCovariates).

`RunCohortDiagnosticsJob` — queue: `r-analysis`, timeout: 7200s.

`GET /api/v1/cohort-definitions/{id}/diagnostics` — list of diagnostic runs.
`POST /api/v1/cohort-definitions/{id}/diagnostics` — dispatch job (202).
`GET /api/v1/cohort-definitions/{id}/diagnostics/{diagId}` — results.

**R Sidecar** (`r-runtime/api/cohort_diagnostics.R`): CohortDiagnostics::executeDiagnostics() stub with TODO plan. Returns structured JSON matching the CohortDiagnostics result schema.

**Frontend:**

`CohortDiagnosticsPage.tsx` — sub-tab on the cohort definition detail page. Shows:
- **Index Event Breakdown** — bar chart of concept IDs triggering the index event
- **Inclusion Rule Statistics** — waterfall attrition chart (same as generation diagnostics, but from CohortDiagnostics)
- **Visit Context** — bar chart of visit types at the index date
- **Temporal Covariates** — heatmap of feature prevalence over time relative to index
- **Cohort Overlap** — Venn/UpSet comparison with other selected cohorts

#### Cohort Overlap Analysis

`POST /api/v1/cohort-definitions/compare`

Body: `{ cohortIds: [1, 2, 3], sourceId: N }`. Computes pairwise and multi-way overlaps in the `cohort_results` table (persons present in each combination of cohort_definition_ids). Returns subject counts for each intersection set.

Frontend: 2 cohorts → `VennDiagram.tsx` (D3 two-circle Venn); 3 cohorts → three-circle Venn; 4+ → `UpSetPlot.tsx` (D3 UpSet). Accessible table alternative always rendered below the chart.

#### Achilles Heel Rules

**`AchillesHeelService`** — post-processes Achilles results against a configurable rule set (drawn from OHDSI's published AchillesHeel checks). Rules evaluate conditions like: death before birth, age implausibility, CDM field nullability violations, domain record counts below thresholds.

Rules stored in `achilles_heel_rules` table (rule_id, category, sql_template, severity). `RunAchillesHeelJob` executes all rules against the Achilles result tables and writes violations to `achilles_heel_results`.

Data Explorer → Characterization → new "Heel Checks" tab: table of violations by category, severity badge (notification/warning/error), record count, and remediation suggestion.

---

### 9.5 WebAPI Compatibility & Source Migration

Many institutions have existing Atlas/WebAPI deployments. Parthenon must be able to ingest their configuration without manual re-entry.

#### WebAPI Source Importer

**`POST /api/v1/data-sources/import-webapi`**

Body: `{ webapi_url: "https://legacy-webapi.example.com", token: "..." }`. Calls the WebAPI `/source/` endpoint, parses the source list (sourceKey, sourceName, daimons, CDM version), and creates corresponding `Source` + `SourceDaimon` records in Parthenon. Handles authentication via Basic Auth or Bearer token.

`artisan parthenon:import-webapi-sources {url} {--token=}` — CLI equivalent for scripted migration.

#### Per-Source Role Restrictions

Each `Source` gains a `restricted_to_roles` (jsonb, array of role names). If non-empty, only users with at least one of those roles can see or use that source. Enforced at the `Source` model's `scopeVisibleToUser()` query scope, applied on all API endpoints that list or select sources.

Admin → Data Sources → Edit → "Access Control" tab: role multi-select for restricting source visibility.

#### WebAPI URL Registry

`System Config → Legacy WebAPI` — stores base URLs of any legacy WebAPI instances the organisation is still running. Used by:
1. The source importer
2. The legacy redirect handler (see §9.6)

---

### 9.6 Legacy Atlas Redirect Handler

For organisations pointing existing bookmarks or integrations at Atlas URLs, a compatibility router maps common Atlas URL patterns to equivalent Parthenon routes.

**`LegacyAtlasRedirectController`** — mounted at `/atlas/` and `/WebAPI/` prefixes:

| Legacy Atlas URL | Parthenon Redirect |
|---|---|
| `/#/cohortdefinition/{id}` | `/cohort-definitions/{id}` |
| `/#/conceptset/{id}` | `/concept-sets/{id}` |
| `/#/incidencerate/{id}` | `/analyses/incidence-rates/{id}` |
| `/#/characterization/{id}` | `/analyses/characterizations/{id}` |
| `/#/estimation/{id}` | `/analyses/estimations/{id}` |
| `/#/prediction/{id}` | `/analyses/predictions/{id}` |
| `/#/pathway/{id}` | `/analyses/pathways/{id}` |
| `/#/profiles` | `/profiles` |
| `/#/datasources` | `/data-sources` |
| `/WebAPI/cohortdefinition/{id}` | API: `GET /api/v1/cohort-definitions/{id}` |
| `/WebAPI/cohortdefinition/{id}/generate/{sourceKey}` | API: `POST /api/v1/cohort-definitions/{id}/generate` |
| `/WebAPI/vocabulary/search` | API: `GET /api/v1/vocabulary/search` (param passthrough) |

Unknown Atlas paths return a 301 to the Parthenon Dashboard with a banner: "This Atlas URL has no direct equivalent — you may have been redirected from a legacy bookmark."

---

### 9.7 Quick Start Guide

**Audience:** Researchers familiar with Atlas who are logging into Parthenon for the first time, and new OMOP users who have never used Atlas.

**Delivery:** Embedded in the application as a dismissable onboarding overlay (shown once on first login), and hosted on the documentation site as `/docs/quick-start`.

**Goal:** Get from zero to a generated cohort count in 15 minutes.

#### Structure

```
Quick Start: From Zero to Cohort Count in 15 Minutes

Step 1 — Log in & navigate (2 min)
  1.1  Log in with your credentials (admin@parthenon.local / superuser for local dev)
  1.2  Explore the Sidebar — identify your primary tools
  1.3  Open the Command Palette (⌘K) — try searching "cohort"
  1.4  Check your Data Sources are configured (sidebar → Data Sources)

Step 2 — Explore your vocabulary (3 min)
  2.1  Open Vocabulary (sidebar)
  2.2  Search for "Type 2 diabetes" — note domain, vocabulary, concept ID
  2.3  Click the concept — explore hierarchy (parents/children)
  2.4  Click "Include Descendants" — note the descendant count
  2.5  Add to a new concept set: "T2D Concept Set"

Step 3 — Build your first cohort (5 min)
  3.1  Open Cohort Definitions → New Cohort Definition
  3.2  Name it "Type 2 Diabetes New Users"
  3.3  In Primary Criteria — click "Add Criteria" → Condition Occurrence
  3.4  Select concept set: "T2D Concept Set"
  3.5  Set Qualified Limit to "First" (first qualifying event per person)
  3.6  Add an Inclusion Rule: "No prior T2D in 365 days"
        Rule type: Condition Occurrence, same concept set, 0 occurrences,
        window: 365 days before to 0 days before index date
  3.7  Save the cohort definition

Step 4 — Generate & inspect (5 min)
  4.1  Click "Generate" — select your CDM source
  4.2  Watch the generation status update live
  4.3  Open the Generations tab — view person count and attrition chart
  4.4  Click "SQL Preview" — review the generated SQL (hover CTEs for explanations)
  4.5  If you have a connected CDM with patients — the count is real!

Congratulations — you have completed a new-user cohort definition.
Next steps → see User Manual §3 for characterization and §4 for incidence rates.
```

#### In-App Onboarding Overlay

On first login (detected via `user.onboarding_completed = false`), a full-screen overlay with:
- Welcome message + brief platform description
- Four action cards: "Explore Vocabulary", "Build a Cohort", "Import from Atlas", "Watch 3-min Demo"
- "Start Quick Start" launches a guided spotlight tour (react-joyride) highlighting sidebar, command palette, and first action

Tour steps are skippable and resumable. `PUT /api/v1/user/onboarding` marks completion. Tour progress stored in `localStorage` as backup.

---

### 9.8 User Manual

**Delivery:** Docusaurus v3 site at `/docs/` (served as a static subpath from the Parthenon nginx container). Versioned: one documentation version per Parthenon release. PDF export via `docusaurus-print-pdf` (generates a single-page print layout, exported to PDF via headless Chromium in CI).

**Structure:**

```
Parthenon User Manual

Part I — Getting Started
  1. Introduction & Platform Overview
     1.1 What is Parthenon?
     1.2 How Parthenon replaces the OHDSI toolchain
     1.3 System requirements
     1.4 Logging in for the first time
     1.5 Understanding the interface (sidebar, command palette, AI copilot)
     1.6 Keyboard shortcuts reference

  2. Data Sources
     2.1 Connecting a CDM database
     2.2 Configuring daimons (CDM, Vocabulary, Results)
     2.3 Testing a connection
     2.4 Managing multiple sources
     2.5 Importing sources from a legacy WebAPI

Part II — Vocabulary & Concept Sets
  3. Vocabulary Browser
     3.1 Searching concepts (name, code, domain, vocabulary)
     3.2 Exploring concept hierarchies
     3.3 Understanding standard vs non-standard concepts
     3.4 Concept relationships (maps to, maps from)
     3.5 Comparing concepts side-by-side
     3.6 Exporting search results

  4. Concept Sets
     4.1 Creating a concept set
     4.2 Adding concepts from search results
     4.3 Configuring per-item flags (include descendants, include mapped, exclude)
     4.4 Resolving a concept set (viewing the expanded concept list)
     4.5 Importing and exporting concept sets (Atlas format)
     4.6 Sharing concept sets

Part III — Cohort Definitions
  5. Understanding Cohort Expressions
     5.1 What is a cohort?
     5.2 Anatomy of a Circe cohort expression (Primary Criteria, Inclusion Rules, End Strategy)
     5.3 Qualified Limit (First / All events)
     5.4 Temporal windows explained
     5.5 Domain criteria (Condition, Drug, Procedure, Measurement, Observation, Visit, Death, Demographic)

  6. Building Cohorts
     6.1 Creating a cohort definition
     6.2 Defining primary criteria
     6.3 Adding inclusion rules (AND/OR/NOT logic)
     6.4 Configuring additional criteria groups
     6.5 Setting the end strategy (fixed offset, custom era, observation period)
     6.6 Adding censoring criteria
     6.7 Demographic filters (age, gender, race)
     6.8 Using the visual node-graph builder
     6.9 AI-assisted cohort building (Abby AI)
     6.10 Previewing the generated SQL

  7. Generating Cohorts
     7.1 Selecting a CDM source
     7.2 Monitoring generation progress (real-time)
     7.3 Reviewing generation results (person count, attrition chart)
     7.4 Generation history and rerunning
     7.5 Troubleshooting generation failures

  8. Cohort Management
     8.1 Copying and importing cohort definitions (Atlas JSON)
     8.2 Tagging cohorts for organisation
     8.3 Sharing cohorts with colleagues
     8.4 Comparing cohort overlaps (Venn diagrams)
     8.5 Cohort Diagnostics

Part IV — Analyses
  9. Characterization
     9.1 What is cohort characterization?
     9.2 Selecting target and comparator cohorts
     9.3 Choosing feature types (demographics, conditions, drugs, procedures, measurements, visits)
     9.4 Interpreting the covariate table and SMD plot
     9.5 Exporting characterization results

  10. Incidence Rates
      10.1 Defining target cohort, outcomes, and time-at-risk
      10.2 Stratification (gender, age, calendar year)
      10.3 Interpreting incidence rate results (IR, person-years, 95% CI)
      10.4 Negative control outcomes and empirical calibration

  11. Treatment Pathways
      11.1 Defining event cohorts and target population
      11.2 Combination window and max depth settings
      11.3 Interpreting the Sankey and sunburst diagrams
      11.4 Pathway table export

  12. Population-Level Estimation (PLE)
      12.1 Study design overview (target/comparator/outcome)
      12.2 Propensity score settings (matching, stratification, trimming)
      12.3 Covariate selection
      12.4 Interpreting PS diagnostics (overlap, balance)
      12.5 Interpreting estimation results (HR, 95% CI, KM curve)
      12.6 Subgroup analyses and forest plots

  13. Patient-Level Prediction (PLP)
      13.1 Study design (target cohort, outcome, time-at-risk)
      13.2 Algorithm selection (LASSO, XGBoost, random forest, gradient boosting)
      13.3 Interpreting model performance (AUC, calibration, SHAP)
      13.4 Model validation across data sources

  14. Studies (Multi-Analysis Orchestration)
      14.1 What is a study?
      14.2 Adding analyses to a study
      14.3 Understanding the study DAG
      14.4 Executing across multiple CDM sources (federated)
      14.5 Generating the study protocol document
      14.6 Exporting as a Strategus JSON package

Part V — Data Ingestion (AI ETL)
  15. Uploading Source Data
      15.1 Supported file formats
      15.2 Upload and file validation
      15.3 Monitoring ingestion pipelines

  16. Schema Mapping
      16.1 Understanding AI-generated schema suggestions
      16.2 Accepting, rejecting, and overriding mappings
      16.3 Manual field assignment

  17. Concept Mapping (Vocabulary Mapping)
      17.1 How the AI concept mapper works
      17.2 The review queue — interpreting confidence scores
      17.3 Batch accept/reject workflows
      17.4 Creating manual mappings
      17.5 Audit trail and export

Part VI — Data Explorer
  18. Characterization (Achilles)
      18.1 Running Achilles on a CDM source
      18.2 Domain deep-dives (person, condition, drug, procedure, measurement, visit, death)
      18.3 Chart interactions and annotations
      18.4 Achilles Heel checks (data quality alerts)

  19. Data Quality Dashboard (DQD)
      19.1 Running a DQD check
      19.2 Understanding the scorecard (Completeness, Conformance, Plausibility)
      19.3 Drilling into failing checks
      19.4 Acknowledging known issues
      19.5 Tracking DQD scores over time

  20. Population Stats
      20.1 Ad-hoc population exploration
      20.2 Applying domain filters
      20.3 Venn/UpSet diagrams for multi-condition populations

Part VII — Patient Profiles
  21. Viewing Patient Timelines
      21.1 Selecting a cohort and navigating to a member
      21.2 Reading the swimlane timeline
      21.3 Domain filters and zoom controls
      21.4 Drug and condition era overlay
      21.5 Adding annotations

Part VIII — Administration
  22. User Management
      22.1 Creating and editing users
      22.2 Assigning roles
      22.3 Onboarding checklist for new users

  23. Roles & Permissions
      23.1 Built-in roles (super-admin, admin, researcher, data-steward, mapping-reviewer, viewer)
      23.2 Creating custom roles
      23.3 Using the Permission Matrix for bulk edits
      23.4 Per-source access restrictions

  24. Authentication Providers
      24.1 Enabling LDAP/Active Directory
      24.2 Configuring OAuth 2.0 (GitHub, Google, Microsoft, Custom)
      24.3 Configuring SAML 2.0
      24.4 Configuring OIDC
      24.5 Testing provider connections

  25. System Configuration
      25.1 Default CDM source
      25.2 AI feature toggles
      25.3 Scheduled analysis runs (Achilles, DQD)
      25.4 Email and SMS notification settings
      25.5 Data retention policies

  26. Audit Log
      26.1 Understanding the audit trail
      26.2 Filtering and exporting audit records
      26.3 Regulatory compliance notes

Appendices
  A. Keyboard Shortcuts Reference
  B. OMOP CDM Domains Quick Reference
  C. Circe Cohort Expression JSON Schema
  D. Parthenon API Quick Reference (OpenAPI links)
  E. Glossary of OHDSI and OMOP Terms
  F. Known Limitations vs Atlas
  G. Troubleshooting Common Issues
```

#### PDF Generation

CI job runs `docusaurus build --out-dir docs-dist` then Puppeteer headless-Chromium print-to-PDF across all pages and concatenates them with `pdf-lib`. Output: `Parthenon_User_Manual_v{version}.pdf` and `Parthenon_Quick_Start_v{version}.pdf` (just Parts I + quick start guide). Both committed to `docs/releases/` and attached to GitHub Releases.

---

### 9.9 Migration Guide (Atlas → Parthenon)

**Audience:** Informatics teams migrating an institution from a running Atlas + WebAPI installation.

Hosted at `/docs/migration`. Also available as a standalone PDF.

#### Structure

```
Atlas → Parthenon Migration Guide

1. Before You Begin
   1.1 Prerequisites (Parthenon instance running, CDM source connected)
   1.2 What transfers automatically vs what requires manual work
   1.3 Timeline estimate (days per migration activity)

2. Export From Atlas
   2.1 Exporting all cohort definitions (Atlas JSON bulk export)
   2.2 Exporting concept sets
   2.3 Exporting IR and characterization analysis definitions
   2.4 Recording your WebAPI source configuration

3. Import Into Parthenon
   3.1 Import cohort definitions: UI (bulk upload) and CLI
       $ php artisan parthenon:import-atlas-cohorts ./atlas-exports/cohorts/
   3.2 Import concept sets: UI and CLI
       $ php artisan parthenon:import-atlas-concept-sets ./atlas-exports/
   3.3 Import WebAPI source configuration
       $ php artisan parthenon:import-webapi-sources https://webapi.example.com --token=...
   3.4 Verify imported records (count comparison checklist)

4. Validating Parity
   4.1 Run the parity validation suite
       $ php artisan parthenon:validate-atlas-parity --atlas-url=... --compare-n=10
       Selects 10 random cohort definitions, generates them on both Atlas and Parthenon,
       compares person counts (tolerance ±2%), reports discrepancies.
   4.2 Manual spot-check checklist
   4.3 SQL diff tool: compare Atlas-generated SQL vs Parthenon SQL for the same cohort

5. Cutover
   5.1 Setting up the legacy URL redirect (§9.6) so bookmarks continue to work
   5.2 Communication template for end users
   5.3 Running Atlas in read-only mode during parallel operation period
   5.4 Decommissioning Atlas (checklist)

6. Feature Comparison Reference
   (Reproduced version of §9.1 parity table — full Atlas feature mapping)
```

#### Parity Validation Artisan Command

`artisan parthenon:validate-atlas-parity {--atlas-url=} {--atlas-token=} {--compare-n=10} {--tolerance=0.02}`

1. Calls Atlas WebAPI `/cohortdefinition/` to get all definitions
2. Randomly selects N
3. For each: imports to Parthenon (if not already present), generates on the same source
4. Calls Atlas WebAPI `/cohortdefinition/{id}/generate/{sourceKey}` to get Atlas-generated count
5. Compares counts: pass if within tolerance, warn if within 5×tolerance, fail otherwise
6. Outputs a markdown table of results with pass/warn/fail status
7. Exits non-zero if any failures → usable in CI for regression testing during migration

---

### 9.10 API Reference

**Auto-generated** from the Laravel OpenAPI spec (via `dedoc/scramble` or `l5-swagger`). Hosted at `/docs/api/` and `/api/documentation`. Updated on every release via CI.

Structure:
- Authentication (Sanctum token flow + admin token creation)
- Grouped by resource: Data Sources, Vocabulary, Concept Sets, Cohort Definitions, Analyses (Characterization, IR, Pathway, PLE, PLP, Care Gaps), Studies, Patient Profiles, Administration, AI (Abby AI), Notifications
- Each endpoint: method, path, auth requirements, request schema (with examples), response schema (with examples), error codes
- Interactive "Try It" panel (Swagger UI) available in non-production environments only

**SDKs (generated stubs):** TypeScript SDK generated from the OpenAPI spec via `openapi-typescript-codegen`, published as `@parthenon/api-client`. Used by the frontend itself. External integrators can install it as a package.

---

### 9.11 Documentation Site Infrastructure

**Stack:** Docusaurus v3 (React-based, MDX, versioned, full-text search via Algolia DocSearch or local Lunr).

**Served from:** Static build output served by the Parthenon nginx container at `/docs/`. In development, runs as a separate Vite dev server on port 3001.

**Authoring workflow:**
- All docs in `docs/site/` directory (MDX files)
- Diagrams via Mermaid (rendered server-side at build)
- Screenshots captured with Playwright (`docs/screenshots/`) — a script runs Playwright against a Eunomia-seeded instance and captures annotated screenshots for the manual
- `docs/site/versioned_docs/` for per-release archives

**CI jobs:**
- `docs-build`: `docusaurus build`, link-checker, broken-internal-link detection
- `docs-pdf`: headless Chromium PDF export of full manual and quick start
- `docs-screenshots`: Playwright screenshot capture (runs on release branches only)

**Search:** Algolia DocSearch (free for open-source/academic projects). Fallback: Lunr.js client-side search if Algolia not configured.

---

### 9.12 In-App Help System

Beyond the documentation site, help is surfaced contextually within the application:

**Contextual help `?` button:** Every page and major component has a `?` icon (top-right of the component card). Clicking opens a slide-over with:
- A 2–3 sentence description of what this component does
- A "Learn more →" link to the relevant User Manual section
- A short embedded video clip (30–90 s, linked from YouTube/Vimeo, not hosted inline)
- 3–5 common "gotcha" tips for this specific workflow

Help content stored in `docs/help/` as JSON files, served via `GET /api/v1/help/{context-key}`. Context keys are defined per-component (e.g., `cohort-builder.primary-criteria`, `dqd.scorecard`, `characterization.smd-plot`).

**Tooltips:** Every non-obvious field label has a `(i)` info icon with a one-sentence tooltip. Tooltip content co-located with the component's help JSON. No tooltip on self-explanatory fields (name, description).

**"What's New" changelog:** On the first login after an upgrade, a "What's New in v{version}" modal shows the top 5 changes (pulled from `CHANGELOG.md` via a parsed endpoint). Dismissible; re-readable via Help → What's New.

---

### 9.13 Video Tutorial Scripts

Parthenon ships with a catalogue of short tutorial videos. Phase 9 delivers the production-ready scripts/storyboards; video recording is a post-deployment activity.

| # | Title | Duration | Covers |
|---|---|---|---|
| V1 | Getting Started: Your First Cohort | 8 min | Quick Start guide as a walkthrough |
| V2 | Vocabulary & Concept Sets Deep Dive | 12 min | Search, hierarchy, descendants, concept set management |
| V3 | Cohort Builder: Advanced Criteria | 15 min | Inclusion rules, temporal windows, end strategies |
| V4 | Running Achilles & Interpreting Results | 10 min | Achilles run, domain charts, Heel checks |
| V5 | Data Quality Dashboard | 8 min | DQD scorecard, drill-down, acknowledgement |
| V6 | Characterization & Incidence Rates | 12 min | Analysis design, SMD, forest plots, stratification |
| V7 | Treatment Pathways & Sunburst | 8 min | Pathway design, interpreting Sankey/sunburst |
| V8 | Migrating from Atlas | 10 min | Export → import, URL redirect, parity check |
| V9 | Administration: Users, Roles, Auth | 8 min | User CRUD, permission matrix, LDAP/OIDC config |
| V10 | AI Concept Mapping Review | 8 min | Review queue, batch accept, audit trail |

Each script is a Markdown document at `docs/videos/{slug}.md` with: learning objectives, section timestamps, narration text, screen action notes, and callout annotations.

---

### 9.14 Phase 9 Deliverables Checklist

Before Phase 10 (Deployment) begins, all of the following must be complete:

**Feature Parity:**
- [ ] All ✅ rows in §9.1 verified against a running Eunomia instance
- [ ] All 🔲 rows implemented and tested (cohort import/export, tagging, sharing, NC outcomes, Cohort Diagnostics, Overlap, Heel, source ACL, WebAPI importer, URL redirects, eras in profiles, concept comparison)
- [ ] Parity validation command passes at ≥ 98% of test cohorts vs Atlas reference

**Migration Tooling:**
- [ ] `parthenon:import-atlas-cohorts` command
- [ ] `parthenon:import-atlas-concept-sets` command
- [ ] `parthenon:import-webapi-sources` command
- [ ] `parthenon:validate-atlas-parity` command
- [ ] Legacy URL redirect controller with all Atlas route mappings

**Documentation:**
- [ ] Quick Start Guide complete (in-app + docs site)
- [ ] In-app onboarding tour (react-joyride, all steps)
- [ ] User Manual: all 26 chapters drafted and reviewed
- [ ] Migration Guide complete
- [ ] API Reference auto-generated and live at `/docs/api/`
- [ ] PDF exports: User Manual and Quick Start
- [ ] Contextual help JSON for all major pages
- [ ] Video tutorial scripts for V1–V10

---

## Phase 10: Deployment (Weeks 22-26)

Docker prod: nginx, php, horizon, scheduler, python-ai (GPU), r-runtime, postgres+pgvector, redis.

Legacy migration: `parthenon:migrate-legacy`, `parthenon:import-atlas-cohorts`, `parthenon:import-webapi-sources`, `parthenon:import-usagi-mappings`, `parthenon:import-achilles-results`, `parthenon:import-dqd-results`.

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

| Phase | Name | Weeks |
|---|---|---|
| 1 | Foundation | 1-4 |
| 2 | Database & OMOP | 3-7 |
| 3 | AI Ingestion | 5-12 |
| 4 | Data Quality | 8-13 |
| 5 | Research Workbench | 10-18 |
| 6 | Auth & Multi-tenancy | 5-8 |
| 7 | Frontend | 8-20 |
| 8 | Testing | Ongoing |
| 9 | Atlas Parity, Migration & Documentation | 20-24 |
| 10 | Deployment | 22-26 |
| 13 | End-to-End Data Wiring | Post-deploy |
| 14 | HADES R Package Integration | Post-deploy |

**Total: ~26 weeks (6.5 months)** with 2-3 developers.
Critical path: Foundation → Vocabulary/Embeddings → AI Mapper → Research Workbench → Atlas Parity → Deployment → Data Wiring → HADES Integration.

---

# Phase 13 — End-to-End Data Wiring: Every Page Functional Against Real OMOP Data

**Status:** Planned
**Target date:** TBD
**Branch:** `master`
**Goal:** Ensure every page in Parthenon is fully functional, displaying real clinical data from the local PostgreSQL 17 `ohdsi` database (`omop` schema: 1M patients, 7.2M concepts, 710M measurements, 86M drug exposures, 14.7M conditions). No page should show empty states, stubs, or broken queries when the seeded "OHDSI Acumenus" source (id=6) is selected.

---

## 1. Background & Motivation

Parthenon has 15+ feature areas, each with frontend pages backed by Laravel API endpoints. The backend is architecturally wired to the local PostgreSQL 17 database via three connections (`cdm`, `vocab`, `results`) pointing at the `omop` and `achilles_results` schemas. However, the full chain — from UI interaction → API call → service → database query → response → rendered result — has never been systematically verified end-to-end for every page.

This phase performs a page-by-page audit and fix pass, ensuring:
1. Every page loads without errors when authenticated
2. Data-dependent pages show real data from the `omop` schema (not empty states)
3. Actions (generate, execute, run) complete successfully
4. Error handling works gracefully for missing/optional data

### Data Inventory (Local PG 17 `ohdsi` DB)

| Schema | Contents | Key Counts |
|--------|----------|-----------|
| `omop` | Full CDM v5.4 + vocabulary (combined) | 1M persons, 7.2M concepts, 710M measurements, 86M drug_exposures, 14.7M conditions, 82M concept_ancestors, 42.9M concept_relationships |
| `achilles_results` | Populated Achilles + DQD + cohort tables | 1.8M achilles_results rows |

### Source Configuration

The seeded source "OHDSI Acumenus" (id=6) maps:
- CDM daimon → `table_qualifier: 'omop'`
- Vocabulary daimon → `table_qualifier: 'omop'`
- Results daimon → `table_qualifier: 'achilles_results'`

---

## 2. Page-by-Page Verification Plan

### 13.1 Dashboard (`/`)

**Component:** `DashboardPage.tsx`
**API:** `GET /v1/dashboard/stats`
**Queries:** Counts from sources, cohorts, jobs, DQD failures, concept sets

**Verify:**
- [ ] All 5 metric cards show non-zero values
- [ ] Source Health panel lists "OHDSI Acumenus" with status
- [ ] Active Jobs panel shows recent execution history
- [ ] Recent Cohort Activity shows seeded cohorts with person counts
- [ ] Quick Actions all navigate correctly

**Potential Issues:**
- Dashboard stats may return 0 for cohorts if none have been generated yet
- Job history empty until first analysis/generation is run

---

### 13.2 Data Sources (`/data-sources`)

**Component:** `SourcesListPage.tsx`
**API:** `GET /v1/sources`

**Verify:**
- [ ] "OHDSI Acumenus" appears with correct dialect (PostgreSQL)
- [ ] Expandable row shows 3 daimons: CDM → `omop`, Vocabulary → `omop`, Results → `achilles_results`
- [ ] Connection status/test button works
- [ ] WebAPI import panel functions (if WebAPI available)

**Potential Issues:**
- Source connection test may fail if Docker→localhost networking not configured (Docker must reach host PG)

---

### 13.3 Data Explorer (`/data-explorer`)

**Component:** `DataExplorerPage.tsx`
**API:** `GET /v1/sources/{source}/achilles/*`
**Service:** `AchillesResultReaderService`

**Verify:**
- [ ] Source selector shows "OHDSI Acumenus"
- [ ] **Overview tab:** Record counts (persons, visits, conditions, drugs, measurements) all non-zero
- [ ] **Overview tab:** Demographics charts (age distribution, gender breakdown, race/ethnicity) render with data
- [ ] **Overview tab:** Observation period histogram renders
- [ ] **Domains tab:** All domains (Condition, Drug, Procedure, Measurement, Observation, Visit) show top concepts
- [ ] **Domains tab:** Concept drilldown (click on a concept) shows gender/age/type distributions
- [ ] **DQD tab:** Data Quality Dashboard shows check results with pass/fail counts
- [ ] **Temporal tab:** Time-series trends render for at least one domain
- [ ] **Heel Checks tab:** Achilles Heel results display (warnings/errors)
- [ ] "Run Achilles" button dispatches a job and completes (or shows existing results)

**Potential Issues:**
- Achilles analysis IDs may not all be present in `achilles_results` — some analyses may return empty
- Temporal trends require specific Achilles analyses (monthly distributions) which may not have been run
- DQD results depend on DQD having been executed at least once
- Concept name resolution requires vocab connection to `omop.concept` table

---

### 13.4 Vocabulary Search (`/vocabulary`)

**Component:** `VocabularyPage.tsx`
**API:** `GET /v1/vocabulary/search`, `GET /v1/vocabulary/concepts/{id}`, etc.
**Connection:** `vocab` → `omop` schema

**Verify:**
- [ ] Search for "diabetes" returns multiple concepts from `omop.concept`
- [ ] Domain filter dropdown populated (from `omop.domain`)
- [ ] Vocabulary filter dropdown populated (from `omop.vocabulary`)
- [ ] Standard concept filter works
- [ ] Clicking a concept opens detail panel with:
  - [ ] Concept metadata (name, ID, domain, vocabulary, class, standard status)
  - [ ] Ancestors tab (from `omop.concept_ancestor`)
  - [ ] Descendants tab
  - [ ] Relationships tab (from `omop.concept_relationship`)
  - [ ] Mapped From tab
- [ ] Pagination works for large result sets
- [ ] URL parameter `?concept=201826` loads concept directly

**Potential Issues:**
- 7.2M concepts means search must be indexed/optimized — verify query performance
- `concept_synonym` table may need to be included for comprehensive search

---

### 13.5 Concept Sets (`/concept-sets`, `/concept-sets/:id`)

**Component:** `ConceptSetsPage.tsx`, `ConceptSetDetailPage.tsx`
**API:** `GET/POST/PUT /v1/concept-sets`

**Verify:**
- [ ] List page shows 7 seeded concept sets (T2DM, Hypertension, AFib, GI Hemorrhage, Heart Failure, Warfarin, Metformin)
- [ ] Click into a concept set shows items with resolved concept names
- [ ] Add concept (search + add) works
- [ ] Remove concept works
- [ ] Include descendants toggle resolves via `omop.concept_ancestor`
- [ ] Include mapped toggle resolves via `omop.concept_relationship`
- [ ] Resolved concept count updates when descendants/mapped toggled
- [ ] Export JSON produces valid Atlas-compatible format
- [ ] Import JSON works (paste or file upload)

**Potential Issues:**
- Descendant resolution on large hierarchies (e.g., "Diabetes mellitus") may be slow — verify query performance against 82M concept_ancestor rows

---

### 13.6 Cohort Definitions (`/cohort-definitions`, `/cohort-definitions/:id`)

**Component:** `CohortDefinitionsPage.tsx`, `CohortDefinitionDetailPage.tsx`
**API:** `GET/POST/PUT /v1/cohort-definitions`, `POST /v1/cohort-definitions/{id}/generate`
**Service:** `CohortGenerationService` → queries `omop.*` tables

**Verify:**
- [ ] List page shows 6 seeded cohorts (T2DM New Users, GI Hemorrhage, AFib on Warfarin, Heart Failure, HTN+DM, T2DM Metformin Users)
- [ ] Detail page — Expression tab: cohort expression renders correctly
- [ ] Detail page — SQL tab: compiled SQL shown, uses `omop.` schema qualifier
- [ ] **Generate cohort** against "OHDSI Acumenus" source:
  - [ ] Job dispatches successfully
  - [ ] Job completes (status → completed)
  - [ ] Person count is non-zero (e.g., T2DM cohort should find patients in 1M-person dataset)
- [ ] Diagnostics tab: attrition chart shows inclusion rule stats after generation
- [ ] Cohort overlap: compare two generated cohorts, see Venn diagram
- [ ] Copy cohort works
- [ ] Export/Import JSON works
- [ ] Abby AI panel opens and can generate suggestions (requires AI service)

**Potential Issues:**
- Cohort SQL compilation must use correct schema qualifiers from SourceDaimon
- Complex cohort expressions (temporal criteria, nested groups) may fail on edge cases
- Generation against 1M persons may take significant time — verify timeout settings
- Inclusion rule statistics must be tracked during generation for attrition to work

---

### 13.7 Patient Profiles (`/profiles`)

**Component:** `PatientProfilePage.tsx`
**API:** `GET /v1/sources/{source}/profiles/{personId}`, `GET /v1/sources/{source}/profiles/cohorts/{cohortId}/members`
**Service:** `PatientProfileService` → queries `omop.*` tables

**Verify:**
- [ ] Source selector shows "OHDSI Acumenus"
- [ ] Browse cohort members (requires a generated cohort) — shows person list
- [ ] Select a person → full profile loads:
  - [ ] Demographics card (age, gender, race, ethnicity)
  - [ ] Observation periods displayed
  - [ ] Timeline view renders clinical events chronologically
  - [ ] List view shows events filtered by domain
  - [ ] Eras view shows condition and drug eras (if available)
- [ ] Events have resolved concept names (from vocab lookup)
- [ ] Can navigate to a person directly via URL parameter

**Potential Issues:**
- Person IDs must exist in `omop.person` — verify sample person IDs
- Eras depend on `omop.condition_era` and `omop.drug_era` tables being populated
- Large patient records (many events) may need pagination

---

### 13.8 Analyses Hub (`/analyses`)

**Component:** `AnalysesPage.tsx`
**API:** Multiple endpoints per analysis type

**Verify all 5 analysis tabs:**

#### 13.8a Characterizations
- [ ] List page loads (may be empty initially)
- [ ] Create new characterization
- [ ] Select target cohort, feature settings
- [ ] Execute against "OHDSI Acumenus"
- [ ] Results show feature distributions, prevalence

#### 13.8b Incidence Rates
- [ ] Create new IR analysis
- [ ] Select target + outcome cohorts, time-at-risk settings
- [ ] Execute — job completes
- [ ] Results show incidence rates with confidence intervals

#### 13.8c Pathways
- [ ] Create new pathway analysis
- [ ] Select target cohort + event cohorts
- [ ] Execute — results show treatment sequences
- [ ] Sankey/sunburst visualization renders

#### 13.8d Estimation (PLE)
- [ ] Create new estimation
- [ ] Configure: target/comparator/outcome cohorts, PS settings, model type (Cox/logistic/poisson)
- [ ] CovariateSettingsPanel works (toggle domains, set time windows)
- [ ] Execute against "OHDSI Acumenus" — dispatches to R runtime
- [ ] Results: forest plot, KM curves, PS distribution, covariate balance (requires R runtime)

#### 13.8e Prediction (PLP)
- [ ] Create new prediction
- [ ] Configure: target/outcome cohorts, model type (9 options), split settings
- [ ] CovariateSettingsPanel works
- [ ] Execute — dispatches to R runtime
- [ ] Results: ROC curve, calibration plot, top predictors (requires R runtime)

#### 13.8f SCCS
- [ ] Create new SCCS analysis
- [ ] Configure: target/outcome cohorts, risk windows, model type
- [ ] Execute against "OHDSI Acumenus"
- [ ] Results: IRR estimates, population summary

#### 13.8g Evidence Synthesis
- [ ] Create new evidence synthesis
- [ ] Configure site estimates, method (Bayesian/Fixed)
- [ ] Execute (no source needed)
- [ ] Results: forest plot, pooled estimate, per-site table

**Potential Issues:**
- R runtime must be running for estimation/prediction/SCCS execution
- Characterization/IR/Pathway may need specific backend services verified
- Long-running analyses need proper timeout handling

---

### 13.9 Studies (`/studies`)

**Component:** `StudiesPage.tsx`
**API:** `GET/POST /v1/studies`

**Verify:**
- [ ] List page loads
- [ ] Create new study
- [ ] Study detail page allows attaching analyses
- [ ] Study execution orchestrates multiple analyses

---

### 13.10 Jobs (`/jobs`)

**Component:** `JobsPage.tsx`
**API:** `GET /v1/jobs`

**Verify:**
- [ ] Jobs list shows all dispatched jobs (cohort generation, Achilles, DQD, analyses)
- [ ] Status filter chips work (all, running, failed, completed, queued)
- [ ] Job detail drawer shows metadata + logs
- [ ] Retry failed job works
- [ ] Cancel running job works

---

### 13.11 Ingestion (`/ingestion`)

**Component:** `IngestionDashboardPage.tsx`
**API:** `GET /v1/ingestion/jobs`

**Verify:**
- [ ] Dashboard loads (may show empty state if no uploads)
- [ ] Upload page allows CSV file selection
- [ ] Schema mapping page maps CSV columns to CDM fields
- [ ] AI-assisted concept mapping works (requires AI service)

---

### 13.12 Care Gaps (`/care-gaps`)

**Component:** `CareGapsPage.tsx`
**API:** `GET/POST /v1/care-gaps/bundles`

**Verify:**
- [ ] Disease bundles tab loads
- [ ] Create new bundle with conditions/measures
- [ ] Population overview shows compliance metrics against "OHDSI Acumenus"

---

### 13.13 Administration (`/admin/*`)

**Verify all admin pages:**
- [ ] **Dashboard** (`/admin`): stat cards show correct counts
- [ ] **Users** (`/admin/users`): user list, create/edit/delete, role assignment
- [ ] **Roles** (`/admin/roles`): role CRUD, permission matrix
- [ ] **Auth Providers** (`/admin/auth-providers`): 4 providers listed, toggle/configure/test
- [ ] **AI Providers** (`/admin/ai-providers`): 8 providers, Ollama active, test connection
- [ ] **System Health** (`/admin/system-health`): 5 services with real status (Redis, AI, R, Queue, DB)

---

## 3. Cross-Cutting Concerns

### 13.14 Schema Resolution Verification

Verify the Source → SourceDaimon → schema resolution chain:

```
Source "OHDSI Acumenus" (id=6)
  ├── CDM daimon      → table_qualifier: 'omop'     → omop.person, omop.condition_occurrence, ...
  ├── Vocabulary daimon → table_qualifier: 'omop'   → omop.concept, omop.concept_ancestor, ...
  └── Results daimon   → table_qualifier: 'achilles_results' → achilles_results.achilles_results, ...
```

- [ ] All services using `$source->getTableQualifier()` produce correct schema-qualified queries
- [ ] Raw SQL queries use the daimon schema, not hardcoded schema names
- [ ] CohortGenerationService SQL uses `{cdmSchema}.person`, `{vocabSchema}.concept`, etc.

### 13.15 Docker → Host Database Connectivity

The Docker containers must reach the host PostgreSQL 17:

- [ ] `CDM_DB_HOST`, `DB_VOCAB_HOST`, `RESULTS_DB_HOST` env vars set correctly
- [ ] PHP container can connect to `pgsql.acumenus.net:5432` / `localhost:5432`
- [ ] R runtime has `DATABASE_URL` pointing to host PG (for HADES analyses)
- [ ] Connection pooling / timeouts appropriate for large queries (710M measurements)

### 13.16 Query Performance

With real data volumes, verify queries complete in reasonable time:

| Query | Expected Volume | Target Time |
|-------|----------------|-------------|
| Vocabulary search ("diabetes") | ~7.2M concepts scanned | < 2s |
| Concept ancestor resolution | ~82M ancestor rows | < 5s |
| Cohort generation (simple) | ~1M persons | < 30s |
| Achilles record counts | ~1.8M result rows | < 1s |
| Patient profile load | Variable per patient | < 3s |
| Domain summary (top concepts) | Aggregation over millions | < 5s |

- [ ] Add database indexes if missing (concept.concept_name, concept.domain_id, etc.)
- [ ] Verify `ANALYZE` has been run on large tables
- [ ] Consider materialized views for expensive aggregations if needed

---

## 4. Implementation Order

| Step | Section | Priority | Dependency |
|------|---------|----------|-----------|
| 1 | §13.14 Schema Resolution | P0 | None — everything else depends on this |
| 2 | §13.15 Docker Connectivity | P0 | None — must work for any data page |
| 3 | §13.4 Vocabulary Search | P0 | §13.14, §13.15 |
| 4 | §13.3 Data Explorer | P0 | §13.14, §13.15, Achilles run |
| 5 | §13.5 Concept Sets | P1 | §13.4 (vocab queries) |
| 6 | §13.6 Cohort Definitions | P1 | §13.5 (concept sets), §13.14 |
| 7 | §13.7 Patient Profiles | P1 | §13.6 (needs generated cohort for browsing) |
| 8 | §13.1 Dashboard | P1 | §13.6 (stats from cohorts/jobs) |
| 9 | §13.2 Data Sources | P1 | §13.14 |
| 10 | §13.8 Analyses | P2 | §13.6, R runtime for PLE/PLP/SCCS |
| 11 | §13.10 Jobs | P2 | §13.6, §13.8 (needs jobs to exist) |
| 12 | §13.16 Query Performance | P2 | After functional verification |
| 13 | §13.9, §13.11, §13.12, §13.13 | P3 | After core pages verified |

---

## 5. Acceptance Criteria

When Phase 13 is complete:

1. **Every page loads** without console errors or white screens
2. **Data Explorer** shows real demographics, domain summaries, and quality checks for 1M patients
3. **Vocabulary search** returns concepts from the 7.2M-concept vocabulary
4. **Concept sets** resolve descendants and mapped concepts correctly
5. **Cohort generation** produces non-zero person counts for all 6 seeded cohorts
6. **Patient profiles** display full clinical timelines for individual patients
7. **Dashboard** shows accurate aggregate stats
8. **All analysis types** can be created, saved, and (where R runtime available) executed
9. **No hardcoded schemas** — all CDM/vocab/results queries use SourceDaimon resolution
10. **Query performance** is acceptable (no page takes > 10s to load with real data)

---

# Phase 14 — HADES R Package Integration: Full PLE & PLP Parity with Atlas

**Status:** Planned
**Target date:** TBD
**Branch:** `master`
**Goal:** Eliminate the two remaining capability gaps — Population-Level Estimation (PLE) and Patient-Level Prediction (PLP) — so that long-time Atlas power users encounter **zero** capability absences when migrating to Parthenon.

---

## 1. Background & Motivation

The Phase 11 parity audit identified two real gaps between Parthenon and Atlas:

| Gap | Atlas Capability | Parthenon Status |
|-----|-----------------|-----------------|
| **PLE** | CohortMethod R package — comparative effectiveness studies with propensity scores, outcome modeling, negative control calibration, KM curves | Architecture complete, R sidecar stubs return 501 |
| **PLP** | PatientLevelPrediction R package — LASSO LR, GBM, Random Forest, model validation, ROC/calibration | Architecture complete, R sidecar stubs return 501 |

Both are architecturally ready: the Laravel backend has full CRUD, async job dispatch via Horizon, polymorphic execution tracking, and notification. The React frontend has complete designer forms, result visualizations (ForestPlot, RocCurve, CalibrationPlot), and execution history. The R sidecar (Plumber API) has mounted routers and validated request schemas.

**The only missing piece is the actual R package integration inside the sidecar.** Additionally, the frontend designers need enhancement to expose the full configuration surface that Atlas power users expect.

### What Atlas Power Users Expect

Atlas users configure PLE/PLP studies through a rich UI, then export downloadable R study packages via Hydra. They execute locally and view results in OhdsiShinyModules. Parthenon must match or exceed this:

1. **Full CohortMethod configuration** — PS matching/stratification/trimming/IPTW, Cox/logistic/Poisson outcome models, negative control calibration, empirical calibration plots
2. **Full PatientLevelPrediction configuration** — 10+ model types, hyperparameter grids, population settings, split strategies, external validation
3. **FeatureExtraction parity** — all 100+ covariate settings, temporal covariates, custom time windows
4. **Self-Controlled Case Series (SCCS)** — within-person design for safety surveillance
5. **EvidenceSynthesis** — cross-database meta-analysis
6. **In-platform execution** — no R package download needed; results stream back live
7. **Rich results viewers** — matching OhdsiShinyModules visualizations

---

## 2. Existing Infrastructure Inventory

### 2.1 R Sidecar (`r-runtime/`)

| File | Current State |
|------|--------------|
| `plumber_api.R` | Mounts routers at `/analysis/estimation` and `/analysis/prediction` |
| `api/estimation.R` | `POST /run` — validates `source`, `cohorts`, `model` fields → returns 501 with TODO comments outlining 7-step CohortMethod flow |
| `api/prediction.R` | `POST /run` — validates `source`, `cohorts`, `model` fields → returns 501 with TODO comments outlining 7-step PLP flow |
| `api/stubs.R` | Additional 501 stubs: `/estimation`, `/prediction`, `/feature-extraction`, `/self-controlled` |
| `api/health.R` | `GET /health` → `{status: "ok"}` |
| `R/db.R` | Database connection helper via `RPostgres`, parses `DATABASE_URL` env var |
| `Dockerfile` | R 4.4.0, installs system deps, `remotes`, `plumber`, `RPostgres` |

**Key observation:** HADES packages are not yet installed in the Docker image.

### 2.2 Backend (`backend/`)

| Component | File | State |
|-----------|------|-------|
| **EstimationController** | `Http/Controllers/Api/V1/EstimationController.php` | Full CRUD + execute + executions endpoints |
| **PredictionController** | `Http/Controllers/Api/V1/PredictionController.php` | Full CRUD + execute + executions endpoints |
| **EstimationService** | `Services/Analysis/EstimationService.php` | Parses design_json, resolves CDM/vocab/results schemas, calls `RService::runEstimation()`, handles not_implemented gracefully |
| **PredictionService** | `Services/Analysis/PredictionService.php` | Same pattern, calls `RService::runPrediction()` |
| **RService** | `Services/RService.php` | HTTP client to R sidecar (`POST /stubs/estimation`, `POST /stubs/prediction`), configurable URL + timeout |
| **RunEstimationJob** | `Jobs/Analysis/RunEstimationJob.php` | Horizon queue job, `r-analysis` queue, 4h timeout, 1 try, notifies author on completion |
| **RunPredictionJob** | `Jobs/Analysis/RunPredictionJob.php` | Same pattern |
| **EstimationAnalysis** | `Models/App/EstimationAnalysis.php` | `name`, `description`, `design_json` (jsonb), `author_id`, soft deletes, polymorphic executions |
| **PredictionAnalysis** | `Models/App/PredictionAnalysis.php` | Same schema |
| **AnalysisExecution** | `Models/App/AnalysisExecution.php` | Polymorphic, tracks status (pending→queued→running→completed/failed), `result_json`, `fail_message` |
| **ExecutionLog** | `Models/App/ExecutionLog.php` | Per-execution log entries (level, message, context) |
| **ExecutionStatus** | `Enums/ExecutionStatus.php` | Pending, Queued, Running, Completed, Failed, Cancelled |

**API routes** (from `routes/api.php`):
```
POST   /v1/estimations                              → create
GET    /v1/estimations                              → list (paginated)
GET    /v1/estimations/{estimation}                 → show
PUT    /v1/estimations/{estimation}                 → update
DELETE /v1/estimations/{estimation}                 → delete
POST   /v1/estimations/{estimation}/execute         → dispatch job
GET    /v1/estimations/{estimation}/executions       → list executions
GET    /v1/estimations/{estimation}/executions/{id}  → show execution

POST   /v1/predictions                              → create
GET    /v1/predictions                              → list (paginated)
GET    /v1/predictions/{prediction}                 → show
PUT    /v1/predictions/{prediction}                 → update
DELETE /v1/predictions/{prediction}                 → delete
POST   /v1/predictions/{prediction}/execute         → dispatch job
GET    /v1/predictions/{prediction}/executions       → list executions
GET    /v1/predictions/{prediction}/executions/{id}  → show execution
```

**Validation rules** already enforce the design_json schema:
- Estimation: targetCohortId, comparatorCohortId, outcomeCohortIds[], model (type, timeAtRisk), propensityScore (enabled, trimming, matching, stratification), covariateSettings, negativeControlOutcomes
- Prediction: targetCohortId, outcomeCohortId, model (type, hyperParameters), timeAtRisk, covariateSettings, populationSettings (washout, priorOutcome, requireTimeAtRisk, minTimeAtRisk), splitSettings (testFraction, splitSeed)

**Horizon queue config** (`config/horizon.php`):
- `r-analysis` supervisor: 2 processes, 512MB, 14400s timeout (4 hours), 1 try

**R service config** (`config/services.php`):
- `r_runtime.url`: `http://r-runtime:8787` (env `R_SERVICE_URL`)
- `r_runtime.timeout`: 300s (env `R_SERVICE_TIMEOUT`)

### 2.3 Frontend (`frontend/src/features/`)

#### Estimation Feature
| File | State |
|------|-------|
| `estimation/types/estimation.ts` | `EstimationDesign` (target/comparator/outcomes, model type Cox/Logistic, PS settings, covariates, negative controls), `EstimationResult` (summary, estimates[], PS diagnostics, equipoise, power) |
| `estimation/api/estimationApi.ts` | Full CRUD + execute + execution list/detail API calls |
| `estimation/hooks/useEstimations.ts` | TanStack Query hooks with 2s polling during execution |
| `estimation/components/EstimationDesigner.tsx` | Form builder: cohort selectors, model type, PS toggle with matching/stratification, covariate checkboxes + time windows |
| `estimation/components/EstimationResults.tsx` | Summary cards, forest plot, estimates table, PS diagnostics, equipoise/power |
| `estimation/components/ForestPlot.tsx` | SVG forest plot with log-scale HR visualization |
| `estimation/pages/EstimationDetailPage.tsx` | Design + Results tabs, source selector, execution history |

#### Prediction Feature
| File | State |
|------|-------|
| `prediction/types/prediction.ts` | `PredictionDesign` (target/outcome, model type LASSO/GBM/RF, hyperParams, timeAtRisk, covariates, population, split), `PredictionResult` (AUC, Brier, calibration, top predictors, ROC/calibration data) |
| `prediction/api/predictionApi.ts` | Full CRUD + execute + execution list/detail |
| `prediction/hooks/usePredictions.ts` | TanStack Query hooks with 2s polling |
| `prediction/components/PredictionDesigner.tsx` | Form builder: cohorts, model type selector, hyperparams, time windows, covariates, population settings, split settings |
| `prediction/components/PredictionResults.tsx` | Performance cards (AUC, Brier, calibration), ROC + calibration charts, top predictors table |
| `prediction/components/RocCurve.tsx` | SVG ROC curve with AUC annotation |
| `prediction/components/CalibrationPlot.tsx` | SVG calibration plot with slope/intercept overlay |
| `prediction/pages/PredictionDetailPage.tsx` | Design + Results tabs, source selector, execution history |

### 2.4 Database Migrations

| Table | Purpose |
|-------|---------|
| `estimation_analyses` | id, name, description, design_json (jsonb), author_id, timestamps, soft deletes |
| `prediction_analyses` | id, name, description, design_json (jsonb), author_id, timestamps, soft deletes |
| `analysis_executions` | Polymorphic (analysis_type + analysis_id), source_id, status, started_at, completed_at, result_json (jsonb), fail_message |
| `execution_logs` | execution_id, level, message, context (jsonb) |

---

## 3. Implementation Plan

### Phase 14a — R Sidecar: HADES Package Installation & Infrastructure

**Objective:** Install all required HADES R packages in the Docker image and establish shared infrastructure (connection management, schema resolution, logging, progress reporting).

#### 3a.1 Update Dockerfile (`r-runtime/Dockerfile`)

Install HADES packages from OHDSI's R-universe or GitHub:

```dockerfile
# System dependencies for HADES packages
RUN apt-get update && apt-get install -y \
    libxml2-dev libcurl4-openssl-dev libssl-dev \
    default-jdk \
    && R CMD javareconf

# Core HADES packages
RUN Rscript -e ' \
  options(repos = c( \
    OHDSI = "https://ohdsi.r-universe.dev", \
    CRAN = "https://cloud.r-project.org" \
  )); \
  install.packages(c( \
    "DatabaseConnector", \
    "SqlRender", \
    "FeatureExtraction", \
    "CohortMethod", \
    "PatientLevelPrediction", \
    "SelfControlledCaseSeries", \
    "EvidenceSynthesis", \
    "CohortGenerator", \
    "Cyclops", \
    "Andromeda", \
    "ParallelLogger", \
    "ResultModelManager", \
    "OhdsiShinyModules" \
  )); \
'

# Python for scikit-learn models (PLP)
RUN apt-get install -y python3 python3-pip && \
    pip3 install scikit-learn numpy
```

**Critical notes:**
- `DatabaseConnector` requires JDBC drivers. For PostgreSQL, include the PostgreSQL JDBC JAR (`postgresql-42.x.jar`) at a known path, set `DATABASECONNECTOR_JAR_FOLDER` env var.
- `Cyclops` needs a C++ compiler (already present in r-base image).
- `Andromeda` uses Arrow/DuckDB for memory-efficient data handling — verify it builds cleanly.
- PLP uses `reticulate` to call Python sklearn models — install Python 3 and `scikit-learn`.
- Expect Docker image build time to increase from ~5 min to ~30 min due to compilation. Consider a pre-built base image.

#### 3a.2 Shared Infrastructure (`r-runtime/R/`)

**File: `r-runtime/R/connection.R`** — DatabaseConnector wrapper

```r
# Establishes a DatabaseConnector connection from spec$source
# Handles dialect mapping (PostgreSQL → "postgresql")
# Returns connectionDetails object compatible with all HADES packages
# Sets CDM, vocabulary, results, cohort schema qualifiers
create_hades_connection <- function(source_spec) { ... }
```

**File: `r-runtime/R/covariates.R`** — FeatureExtraction settings builder

```r
# Translates design_json covariate settings to FeatureExtraction::createCovariateSettings()
# Maps frontend booleans (demographics, conditions, drugs, etc.) to 100+ individual flags
# Handles time windows (longTermStartDays, mediumTermStartDays, shortTermStartDays)
# Handles concept exclusions (exclude treatment drugs from PS model)
build_covariate_settings <- function(covariate_spec) { ... }
```

**File: `r-runtime/R/progress.R`** — Progress/logging callback

```r
# Wraps ParallelLogger to emit structured JSON logs
# Can POST progress updates back to Laravel for real-time status
# Captures R warnings and messages into structured output
create_progress_logger <- function(execution_id) { ... }
```

**File: `r-runtime/R/results.R`** — Result serialization

```r
# Converts HADES output objects to JSON-serializable lists
# Handles Andromeda data (extracts summary statistics, not raw data)
# Formats hazard ratios, confidence intervals, p-values
# Extracts ROC curve points, calibration data, feature importance
serialize_estimation_result <- function(cm_result) { ... }
serialize_prediction_result <- function(plp_result) { ... }
```

---

### Phase 14b — CohortMethod (PLE) R Implementation

**Objective:** Implement the full CohortMethod pipeline in the R sidecar, matching Atlas's PLE capability.

#### 3b.1 Replace Estimation Stub (`r-runtime/api/estimation.R`)

The `POST /run` endpoint currently returns 501. Replace with a fully functional CohortMethod pipeline:

```
Input (from EstimationService.php):
{
  "source": {
    "dialect": "postgresql",
    "connection": { "host", "port", "database", "user", "password" },
    "cdm_schema": "cdm",
    "vocab_schema": "vocab",
    "results_schema": "results",
    "cohort_table": "cohort"
  },
  "cohorts": {
    "target_cohort_id": 1,
    "comparator_cohort_id": 2,
    "outcome_cohort_ids": [3, 4, 5]
  },
  "model": {
    "type": "cox",           // "cox" | "logistic" | "poisson"
    "time_at_risk_start": 1,
    "time_at_risk_end": 9999,
    "end_anchor": "cohort end"
  },
  "propensity_score": {
    "enabled": true,
    "trimming": 0.05,
    "matching": { "ratio": 1, "caliper": 0.2, "caliper_scale": "standardized_logit" },
    "stratification": { "num_strata": 5 },
    "method": "matching"     // "matching" | "stratification" | "iptw"
  },
  "covariate_settings": { ... },
  "negative_control_outcomes": [101, 102, 103, ...]
}
```

#### 3b.2 CohortMethod Pipeline Steps

**Step 1: Establish connection**
```r
connectionDetails <- create_hades_connection(spec$source)
```

**Step 2: Extract data**
```r
covariateSettings <- build_covariate_settings(spec$covariate_settings)
cmData <- CohortMethod::getDbCohortMethodData(
  connectionDetails = connectionDetails,
  cdmDatabaseSchema = spec$source$cdm_schema,
  targetId = spec$cohorts$target_cohort_id,
  comparatorId = spec$cohorts$comparator_cohort_id,
  outcomeIds = spec$cohorts$outcome_cohort_ids,
  exposureDatabaseSchema = spec$source$results_schema,
  exposureTable = spec$source$cohort_table,
  outcomeDatabaseSchema = spec$source$results_schema,
  outcomeTable = spec$source$cohort_table,
  covariateSettings = covariateSettings
)
```

**Step 3: Create study population** (per outcome)
```r
studyPop <- CohortMethod::createStudyPopulation(
  cohortMethodData = cmData,
  outcomeId = outcomeId,
  removeSubjectsWithPriorOutcome = TRUE,
  riskWindowStart = spec$model$time_at_risk_start,
  startAnchor = "cohort start",
  riskWindowEnd = spec$model$time_at_risk_end,
  endAnchor = spec$model$end_anchor
)
```

**Step 4: Fit propensity score**
```r
ps <- CohortMethod::createPs(
  cohortMethodData = cmData,
  population = studyPop
)
psAuc <- CohortMethod::computePsAuc(ps)
equipoise <- CohortMethod::computeEquipoise(ps)
```

**Step 5: Adjust population**
```r
if (spec$propensity_score$method == "matching") {
  adjustedPop <- CohortMethod::matchOnPs(ps,
    maxRatio = spec$propensity_score$matching$ratio,
    caliper = spec$propensity_score$matching$caliper
  )
} else if (spec$propensity_score$method == "stratification") {
  adjustedPop <- CohortMethod::stratifyByPs(ps,
    numberOfStrata = spec$propensity_score$stratification$num_strata
  )
} else {  # IPTW
  adjustedPop <- CohortMethod::trimByPs(ps,
    trimFraction = spec$propensity_score$trimming
  )
}
```

**Step 6: Compute covariate balance**
```r
balance <- CohortMethod::computeCovariateBalance(
  population = adjustedPop,
  cohortMethodData = cmData
)
# Extract mean/max SMD before and after adjustment
```

**Step 7: Fit outcome model**
```r
outcomeModel <- CohortMethod::fitOutcomeModel(
  population = adjustedPop,
  cohortMethodData = cmData,
  modelType = spec$model$type,   # "cox", "logistic", "poisson"
  stratified = (spec$propensity_score$method %in% c("matching", "stratification"))
)
# Extract: HR/OR/IRR = exp(coef(outcomeModel)), CI = exp(confint(outcomeModel))
```

**Step 8: Negative control calibration** (if negative controls provided)
```r
if (length(spec$negative_control_outcomes) > 0) {
  # Run same pipeline for each negative control outcome
  # Compute empirical null distribution
  # Calibrate primary estimates
  # Use EmpiricalCalibration::calibrateCi()
}
```

**Step 9: Additional diagnostics**
```r
# Kaplan-Meier data extraction
kmData <- CohortMethod::plotKaplanMeier(adjustedPop, includeZero = TRUE)

# Attrition diagram data
attrition <- CohortMethod::getAttritionTable(adjustedPop)

# Follow-up distribution
followUp <- CohortMethod::getFollowUpDistribution(adjustedPop)

# Minimum detectable relative risk
mdrr <- CohortMethod::computeMdrr(adjustedPop, modelType = spec$model$type)
```

**Step 10: Serialize and return**
```r
result <- serialize_estimation_result(list(
  summary = list(
    target_count = nrow(studyPop[studyPop$treatment == 1,]),
    comparator_count = nrow(studyPop[studyPop$treatment == 0,]),
    outcome_counts = outcome_counts_list
  ),
  estimates = estimates_list,            # Per-outcome: HR, CI, p-value, events
  propensity_score = list(
    auc = psAuc,
    equipoise = equipoise,
    mean_smd_before = ...,
    mean_smd_after = ...,
    max_smd_before = ...,
    max_smd_after = ...
  ),
  covariate_balance = balance_summary,   # Top covariates with SMD before/after
  kaplan_meier = km_data,                # Time, survival, lower, upper per arm
  attrition = attrition_table,           # Step, subjects remaining, excluded
  follow_up = follow_up_data,            # Distribution of follow-up days
  mdrr = mdrr_per_outcome,              # Minimum detectable relative risk
  negative_controls = calibration_data,  # If provided: NC estimates + calibrated estimates
  ps_distribution = ps_dist_data         # Preference score histogram data
))
```

#### 3b.3 Expected Output Schema (`result_json` in `analysis_executions`)

```json
{
  "status": "completed",
  "summary": {
    "target_count": 45231,
    "comparator_count": 38792,
    "outcome_counts": { "3": 1205, "4": 892, "5": 2341 }
  },
  "estimates": [
    {
      "outcome_id": 3,
      "outcome_name": "MI",
      "hazard_ratio": 0.85,
      "ci_95_lower": 0.72,
      "ci_95_upper": 1.01,
      "p_value": 0.063,
      "target_events": 523,
      "comparator_events": 682,
      "log_rr": -0.163,
      "se_log_rr": 0.087,
      "calibrated_hr": 0.87,
      "calibrated_ci_lower": 0.71,
      "calibrated_ci_upper": 1.06,
      "calibrated_p": 0.091
    }
  ],
  "propensity_score": {
    "auc": 0.78,
    "equipoise": 0.62,
    "mean_smd_before": 0.145,
    "mean_smd_after": 0.012,
    "max_smd_before": 0.892,
    "max_smd_after": 0.035,
    "distribution": {
      "target": [{ "x": 0.0, "y": 120 }, ...],
      "comparator": [{ "x": 0.0, "y": 135 }, ...]
    }
  },
  "covariate_balance": [
    {
      "covariate_name": "Diabetes mellitus type 2",
      "concept_id": 201826,
      "smd_before": 0.34,
      "smd_after": 0.01,
      "mean_target_before": 0.45,
      "mean_comparator_before": 0.31,
      "mean_target_after": 0.38,
      "mean_comparator_after": 0.37
    }
  ],
  "kaplan_meier": {
    "target": [{ "time": 0, "survival": 1.0, "lower": 1.0, "upper": 1.0 }, ...],
    "comparator": [{ "time": 0, "survival": 1.0, "lower": 1.0, "upper": 1.0 }, ...]
  },
  "attrition": [
    { "step": "Starting population", "target": 50000, "comparator": 42000 },
    { "step": "First exposure only", "target": 48321, "comparator": 40108 },
    { "step": "Has ≥1 day at risk", "target": 45231, "comparator": 38792 },
    { "step": "PS matched", "target": 35000, "comparator": 35000 }
  ],
  "mdrr": { "3": 1.15, "4": 1.22, "5": 1.08 },
  "negative_controls": {
    "estimates": [
      { "outcome_id": 101, "log_rr": 0.02, "se_log_rr": 0.15 }
    ],
    "empirical_null": { "mean": 0.01, "sd": 0.12 }
  }
}
```

---

### Phase 14c — PatientLevelPrediction (PLP) R Implementation

**Objective:** Implement the full PLP pipeline in the R sidecar, matching Atlas's PLP capability.

#### 3c.1 Replace Prediction Stub (`r-runtime/api/prediction.R`)

```
Input (from PredictionService.php):
{
  "source": { /* same as estimation */ },
  "cohorts": {
    "target_cohort_id": 1,
    "outcome_cohort_id": 3
  },
  "model": {
    "type": "lasso_logistic_regression",
    "hyper_parameters": {
      "variance": [0.001, 0.01, 0.1],
      "seed": 42
    }
  },
  "time_at_risk": {
    "start": 1,
    "end": 365,
    "end_anchor": "cohort start"
  },
  "covariate_settings": { ... },
  "population_settings": {
    "washout_period": 364,
    "remove_subjects_with_prior_outcome": true,
    "require_time_at_risk": true,
    "min_time_at_risk": 364,
    "first_exposure_only": false
  },
  "split_settings": {
    "test_fraction": 0.25,
    "split_seed": 42,
    "n_fold": 3,
    "type": "stratified"
  }
}
```

#### 3c.2 PLP Pipeline Steps

**Step 1: Create database details**
```r
databaseDetails <- PatientLevelPrediction::createDatabaseDetails(
  connectionDetails = create_hades_connection(spec$source),
  cdmDatabaseSchema = spec$source$cdm_schema,
  cdmDatabaseName = "parthenon",
  cohortDatabaseSchema = spec$source$results_schema,
  cohortTable = spec$source$cohort_table,
  outcomeDatabaseSchema = spec$source$results_schema,
  outcomeTable = spec$source$cohort_table,
  targetId = spec$cohorts$target_cohort_id,
  outcomeIds = spec$cohorts$outcome_cohort_id
)
```

**Step 2: Configure model**
```r
modelSettings <- switch(spec$model$type,
  "lasso_logistic_regression" = PatientLevelPrediction::setLassoLogisticRegression(
    variance = spec$model$hyper_parameters$variance %||% 0.01,
    seed = spec$model$hyper_parameters$seed %||% 42
  ),
  "gradient_boosting" = PatientLevelPrediction::setGradientBoostingMachine(
    ntrees = spec$model$hyper_parameters$ntrees %||% c(100, 300),
    maxDepth = spec$model$hyper_parameters$max_depth %||% c(4, 6, 8),
    learnRate = spec$model$hyper_parameters$learn_rate %||% c(0.05, 0.1),
    seed = spec$model$hyper_parameters$seed %||% 42
  ),
  "random_forest" = PatientLevelPrediction::setRandomForest(
    ntrees = spec$model$hyper_parameters$ntrees %||% c(100, 500),
    maxDepth = spec$model$hyper_parameters$max_depth %||% c(4, 8, 17),
    seed = spec$model$hyper_parameters$seed %||% 42
  ),
  "ada_boost" = PatientLevelPrediction::setAdaBoost(
    nEstimators = spec$model$hyper_parameters$n_estimators %||% c(50, 100),
    learningRate = spec$model$hyper_parameters$learning_rate %||% c(0.5, 1.0),
    seed = spec$model$hyper_parameters$seed %||% 42
  ),
  "decision_tree" = PatientLevelPrediction::setDecisionTree(
    maxDepth = spec$model$hyper_parameters$max_depth %||% c(3, 5, 10),
    seed = spec$model$hyper_parameters$seed %||% 42
  ),
  "naive_bayes" = PatientLevelPrediction::setNaiveBayes(),
  "mlp" = PatientLevelPrediction::setMLP(
    hiddenLayerSizes = spec$model$hyper_parameters$hidden_layers %||% list(c(128)),
    seed = spec$model$hyper_parameters$seed %||% 42
  ),
  "lightgbm" = PatientLevelPrediction::setLightGBM(
    nthread = spec$model$hyper_parameters$nthread %||% 4,
    numLeaves = spec$model$hyper_parameters$num_leaves %||% c(31, 63),
    learningRate = spec$model$hyper_parameters$learning_rate %||% c(0.05, 0.1),
    seed = spec$model$hyper_parameters$seed %||% 42
  ),
  stop(paste("Unsupported model type:", spec$model$type))
)
```

**Step 3: Configure population and split**
```r
populationSettings <- PatientLevelPrediction::createStudyPopulationSettings(
  washoutPeriod = spec$population_settings$washout_period %||% 364,
  firstExposureOnly = spec$population_settings$first_exposure_only %||% FALSE,
  removeSubjectsWithPriorOutcome = spec$population_settings$remove_subjects_with_prior_outcome %||% TRUE,
  priorOutcomeLookback = 9999,
  riskWindowStart = spec$time_at_risk$start %||% 1,
  riskWindowEnd = spec$time_at_risk$end %||% 365,
  startAnchor = "cohort start",
  endAnchor = spec$time_at_risk$end_anchor %||% "cohort start",
  minTimeAtRisk = spec$population_settings$min_time_at_risk %||% 364,
  requireTimeAtRisk = spec$population_settings$require_time_at_risk %||% TRUE,
  includeAllOutcomes = TRUE
)

splitSettings <- PatientLevelPrediction::createDefaultSplitSetting(
  testFraction = spec$split_settings$test_fraction %||% 0.25,
  splitSeed = spec$split_settings$split_seed %||% 42,
  nfold = spec$split_settings$n_fold %||% 3,
  type = spec$split_settings$type %||% "stratified"
)
```

**Step 4: Run PLP**
```r
plpResult <- PatientLevelPrediction::runPlp(
  plpData = plpData,
  outcomeId = spec$cohorts$outcome_cohort_id,
  modelSettings = modelSettings,
  populationSettings = populationSettings,
  splitSettings = splitSettings,
  sampleSettings = PatientLevelPrediction::createSampleSettings(),
  featureEngineeringSettings = PatientLevelPrediction::createFeatureEngineeringSettings(),
  preprocessSettings = PatientLevelPrediction::createPreprocessSettings(
    minFraction = 0.001,
    normalize = TRUE,
    removeRedundancy = TRUE
  ),
  executeSettings = PatientLevelPrediction::createExecuteSettings(
    runSplitData = TRUE,
    runSampleData = FALSE,
    runfeatureEngineering = FALSE,
    runPreprocessData = TRUE,
    runModelDevelopment = TRUE,
    runCovariateSummary = TRUE
  ),
  saveDirectory = tempdir()
)
```

**Step 5: Extract and serialize results**
```r
result <- serialize_prediction_result(list(
  summary = list(
    target_count = plpResult$model$trainDetails$trainingSize +
                   nrow(plpResult$prediction[plpResult$prediction$evaluationType == "Test",]),
    outcome_count = sum(plpResult$prediction$outcomeCount),
    outcome_rate = mean(plpResult$prediction$outcomeCount)
  ),
  performance = list(
    auc = plpResult$performanceEvaluation$evaluationStatistics$AUC.auc,
    auc_ci_lower = plpResult$performanceEvaluation$evaluationStatistics$AUC.auc_lb95ci,
    auc_ci_upper = plpResult$performanceEvaluation$evaluationStatistics$AUC.auc_ub95ci,
    auprc = plpResult$performanceEvaluation$evaluationStatistics$AUPRC,
    brier_score = plpResult$performanceEvaluation$evaluationStatistics$BrierScore,
    calibration_slope = plpResult$performanceEvaluation$calibrationSummary$calibrationSlope,
    calibration_intercept = plpResult$performanceEvaluation$calibrationSummary$calibrationIntercept
  ),
  roc_curve = extract_roc_points(plpResult),
  calibration = extract_calibration_points(plpResult),
  top_predictors = extract_top_predictors(plpResult, n = 30),
  model_details = list(
    type = spec$model$type,
    hyper_parameters_selected = plpResult$model$modelDesign$modelSettings,
    covariate_count = plpResult$model$trainDetails$covariateCount,
    training_time_seconds = plpResult$executionSummary$TotalExecutionElapsedTime
  )
))
```

#### 3c.3 Expected Output Schema

```json
{
  "status": "completed",
  "summary": {
    "target_count": 28543,
    "outcome_count": 3421,
    "outcome_rate": 0.1199
  },
  "performance": {
    "auc": 0.812,
    "auc_ci_lower": 0.795,
    "auc_ci_upper": 0.829,
    "auprc": 0.452,
    "brier_score": 0.089,
    "calibration_slope": 1.02,
    "calibration_intercept": -0.03
  },
  "roc_curve": [
    { "fpr": 0.0, "tpr": 0.0 },
    { "fpr": 0.01, "tpr": 0.08 },
    { "fpr": 0.05, "tpr": 0.28 },
    ...
    { "fpr": 1.0, "tpr": 1.0 }
  ],
  "calibration": [
    { "predicted": 0.05, "observed": 0.048 },
    { "predicted": 0.10, "observed": 0.103 },
    ...
  ],
  "top_predictors": [
    { "name": "Diabetes mellitus type 2", "concept_id": 201826, "coefficient": 1.34, "importance": 0.089 },
    { "name": "Age 65-69", "concept_id": null, "coefficient": 0.92, "importance": 0.072 },
    { "name": "Hypertension", "concept_id": 320128, "coefficient": 0.87, "importance": 0.065 }
  ],
  "model_details": {
    "type": "lasso_logistic_regression",
    "hyper_parameters_selected": { "variance": 0.01 },
    "covariate_count": 23451,
    "training_time_seconds": 342
  }
}
```

---

### Phase 14d — FeatureExtraction Parity

**Objective:** Expose the full FeatureExtraction configuration surface to match Atlas's covariate settings UI.

#### 3d.1 Expand Frontend Covariate Designer

The current `EstimationDesigner.tsx` and `PredictionDesigner.tsx` have simple checkboxes for 6 covariate domains. Atlas exposes 100+ individual settings. Create a shared `CovariateSettingsPanel.tsx`:

**File: `frontend/src/components/analysis/CovariateSettingsPanel.tsx`**

Sections:
1. **Quick Presets**
   - "Default" — enables demographics + all common domains (matches `createDefaultCovariateSettings()`)
   - "Minimal" — demographics only
   - "Full" — everything enabled
   - "Custom" — manually toggle each domain

2. **Demographics** (checkboxes)
   - Gender, Age, Age Group, Race, Ethnicity, Index Year, Index Month, Prior Observation Time, Post Observation Time

3. **Conditions** (grouped with time window selector)
   - Condition Occurrence: Any Time Prior, Long Term, Medium Term, Short Term
   - Primary Inpatient Conditions: Any Time Prior, Long Term, Medium Term, Short Term
   - Condition Era: Any Time Prior, Long Term, Overlapping
   - Condition Group Era: Any Time Prior, Long Term, Overlapping

4. **Drugs** (same grouping pattern)
   - Drug Exposure: Any Time Prior, Long Term, Medium Term, Short Term
   - Drug Era: Any Time Prior, Long Term, Overlapping
   - Drug Group Era: Any Time Prior, Long Term, Overlapping

5. **Procedures**: Any Time Prior, Long Term, Medium Term, Short Term

6. **Measurements**: Occurrence, Values, Range Groups (below/within/above normal)

7. **Observations**: Any Time Prior, Long Term, Medium Term, Short Term

8. **Devices**: Any Time Prior, Long Term, Medium Term, Short Term

9. **Comorbidity Indices**: Charlson, DCSI, CHADS2, CHADS2Vasc, HFRS

10. **Count Covariates**: Distinct conditions, ingredients, procedures, measurements, observations, visits

11. **Time Windows** (editable)
    - Long term start: -365 (days)
    - Medium term start: -180
    - Short term start: -30
    - End: 0

12. **Concept Filters**
    - Include concept IDs (with "include descendants" toggle)
    - Exclude concept IDs (with "include descendants" toggle)
    - Integrated with concept set picker

#### 3d.2 Expand Backend Validation

Update `EstimationController` and `PredictionController` validation rules to accept the expanded covariate settings structure:

```php
'design_json.covariateSettings.demographics' => 'nullable|array',
'design_json.covariateSettings.demographics.gender' => 'nullable|boolean',
'design_json.covariateSettings.demographics.age' => 'nullable|boolean',
'design_json.covariateSettings.demographics.ageGroup' => 'nullable|boolean',
// ... etc for each individual flag
'design_json.covariateSettings.conditions' => 'nullable|array',
'design_json.covariateSettings.conditions.anyTimePrior' => 'nullable|boolean',
// ... etc
'design_json.covariateSettings.timeWindows' => 'nullable|array',
'design_json.covariateSettings.timeWindows.longTermStart' => 'nullable|integer',
'design_json.covariateSettings.timeWindows.mediumTermStart' => 'nullable|integer',
'design_json.covariateSettings.timeWindows.shortTermStart' => 'nullable|integer',
'design_json.covariateSettings.timeWindows.end' => 'nullable|integer',
'design_json.covariateSettings.excludedConceptIds' => 'nullable|array',
'design_json.covariateSettings.excludedConceptIds.*' => 'integer',
'design_json.covariateSettings.includedConceptIds' => 'nullable|array',
'design_json.covariateSettings.includedConceptIds.*' => 'integer',
```

#### 3d.3 R-side Covariate Builder

The `build_covariate_settings()` function in `R/covariates.R` maps the expanded JSON structure to `FeatureExtraction::createCovariateSettings()`:

```r
build_covariate_settings <- function(spec) {
  if (is.null(spec) || identical(spec, list())) {
    return(FeatureExtraction::createDefaultCovariateSettings())
  }

  args <- list()

  # Demographics
  if (!is.null(spec$demographics)) {
    args$useDemographicsGender <- spec$demographics$gender %||% FALSE
    args$useDemographicsAge <- spec$demographics$age %||% FALSE
    args$useDemographicsAgeGroup <- spec$demographics$ageGroup %||% FALSE
    args$useDemographicsRace <- spec$demographics$race %||% FALSE
    args$useDemographicsEthnicity <- spec$demographics$ethnicity %||% FALSE
    # ... etc
  }

  # Conditions
  if (!is.null(spec$conditions)) {
    args$useConditionOccurrenceAnyTimePrior <- spec$conditions$anyTimePrior %||% FALSE
    args$useConditionOccurrenceLongTerm <- spec$conditions$longTerm %||% FALSE
    # ... etc
  }

  # Time windows
  if (!is.null(spec$timeWindows)) {
    args$longTermStartDays <- spec$timeWindows$longTermStart %||% -365
    args$mediumTermStartDays <- spec$timeWindows$mediumTermStart %||% -180
    args$shortTermStartDays <- spec$timeWindows$shortTermStart %||% -30
    args$endDays <- spec$timeWindows$end %||% 0
  }

  # Concept filters
  if (!is.null(spec$excludedConceptIds)) {
    args$excludedCovariateConceptIds <- spec$excludedConceptIds
    args$addDescendantsToExclude <- spec$excludeDescendants %||% TRUE
  }

  do.call(FeatureExtraction::createCovariateSettings, args)
}
```

---

### Phase 14e — Enhanced Frontend Results Viewers

**Objective:** Match the full OhdsiShinyModules results experience within Parthenon's React UI.

#### 3e.1 Estimation Results Enhancements

Enhance `EstimationResults.tsx` with additional tabs/sections:

| Visualization | Component | What It Shows |
|--------------|-----------|--------------|
| **Forest Plot** | `ForestPlot.tsx` (existing) | HR/OR/IRR with 95% CI per outcome — already implemented |
| **Kaplan-Meier Curves** | `KaplanMeierChart.tsx` (new) | Time-to-event survival curves for target vs comparator, with confidence bands |
| **PS Distribution** | `PsDistributionChart.tsx` (new) | Overlapping histograms of propensity scores for target vs comparator, with preference score overlay |
| **Covariate Balance** | `CovariateBalanceScatter.tsx` (new) | Scatter plot: SMD before (x) vs after (y) adjustment, with dashed threshold lines at ±0.1 |
| **Table 1** | `PopulationCharacteristics.tsx` (new) | Baseline characteristics table: covariate name, target %, comparator %, SMD (sortable) |
| **Attrition Diagram** | `AttritionDiagram.tsx` (new) | Funnel/flow diagram showing patient counts at each inclusion/exclusion step |
| **Negative Control Plot** | `NegativeControlPlot.tsx` (new) | Systematic error diagnostic: NC estimates as blue dots, primary estimate as gold diamond, calibrated CI overlay |
| **Power Analysis** | Already in results | MDRR per outcome — already implemented |

#### 3e.2 Prediction Results Enhancements

Enhance `PredictionResults.tsx` with additional tabs/sections:

| Visualization | Component | What It Shows |
|--------------|-----------|--------------|
| **ROC Curve** | `RocCurve.tsx` (existing) | Sensitivity vs 1-specificity — already implemented |
| **Calibration Plot** | `CalibrationPlot.tsx` (existing) | Predicted vs observed — already implemented |
| **Precision-Recall Curve** | `PrecisionRecallCurve.tsx` (new) | Precision vs recall for rare outcomes, AUPRC annotation |
| **Threshold Analysis** | `ThresholdAnalysis.tsx` (new) | Interactive slider: at a given probability threshold, show sensitivity, specificity, PPV, NPV, F1, number needed to screen |
| **Decision Curve** | `DecisionCurve.tsx` (new) | Net benefit vs threshold probability, comparing model to "treat all" and "treat none" strategies |
| **Feature Importance** | Already in results | Top predictors with coefficient/importance bars — already implemented |
| **Variable Scatter** | `VariableScatter.tsx` (new) | Mean covariate difference between outcome+ vs outcome- groups, highlighting top discriminators |
| **Model Comparison** | `ModelComparison.tsx` (new) | Side-by-side AUC/Brier/calibration for multiple model types run on same data |

#### 3e.3 Shared Analysis Components

**File: `frontend/src/components/analysis/ExecutionStatusBanner.tsx`**

A unified execution status component showing:
- Queued → animated pulsing indicator
- Running → progress bar with elapsed time + log streaming
- Completed → summary metrics banner
- Failed → error message with retry button

**File: `frontend/src/components/analysis/LogViewer.tsx`**

Real-time log viewer that polls `GET /executions/{id}` and renders `ExecutionLog` entries with:
- Timestamp, level (info/warning/error), message
- Color-coded by level
- Auto-scroll to latest
- Collapsible context JSON

---

### Phase 14f — Self-Controlled Case Series (SCCS)

**Objective:** Add SCCS as a third analysis type, extending beyond what Atlas typically exposes inline.

#### 3f.1 Backend

- **Model:** `SccsAnalysis` (same pattern as EstimationAnalysis)
- **Controller:** `SccsController` with CRUD + execute
- **Service:** `SccsService` — builds spec, calls R sidecar
- **Job:** `RunSccsJob` on `r-analysis` queue
- **Migration:** `sccs_analyses` table (name, description, design_json, author_id, timestamps, soft deletes)
- **Routes:**
  ```
  POST   /v1/sccs
  GET    /v1/sccs
  GET    /v1/sccs/{sccs}
  PUT    /v1/sccs/{sccs}
  DELETE /v1/sccs/{sccs}
  POST   /v1/sccs/{sccs}/execute
  GET    /v1/sccs/{sccs}/executions
  GET    /v1/sccs/{sccs}/executions/{execution}
  ```

#### 3f.2 R Sidecar

**File: `r-runtime/api/sccs.R`**

Pipeline:
1. `SelfControlledCaseSeries::getDbSccsData()` — extract case series data
2. `createStudyPopulation()` — define observation/naive periods
3. `createEraCovariateSettings()` — define exposure risk windows (pre-exposure, on-treatment, post-exposure)
4. `createSccsIntervalData()` — create person-interval data with covariates
5. `fitSccsModel()` — conditional Poisson regression
6. Run diagnostics: rare outcome check, exposure-event independence, censoring independence, time stability
7. Return: IRR with CI, diagnostic pass/fail, pre-exposure estimate, seasonal/calendar effects

#### 3f.3 Frontend

| Component | Purpose |
|-----------|---------|
| `SccsDesigner.tsx` | Exposure cohort, outcome cohort, risk windows (pre/during/post exposure), naive period, seasonality toggle |
| `SccsResults.tsx` | IRR estimates, diagnostic checklist (4 assumption tests), exposure-centered plot |
| `SccsDetailPage.tsx` | Design + Results tabs, execution history |

#### 3f.4 SCCS Design JSON Schema

```json
{
  "exposureCohortId": 1,
  "outcomeCohortId": 3,
  "riskWindows": [
    { "label": "Pre-exposure", "start": -30, "end": -1, "endAnchor": "era start" },
    { "label": "On treatment", "start": 0, "end": 0, "endAnchor": "era end" },
    { "label": "Post-exposure", "start": 1, "end": 30, "endAnchor": "era end" }
  ],
  "naivePeriod": 180,
  "firstOutcomeOnly": true,
  "seasonality": true,
  "calendarTime": true,
  "eventDependentObservation": true,
  "covariateSettings": { ... }
}
```

---

### Phase 14g — Evidence Synthesis (Cross-Database Meta-Analysis)

**Objective:** Allow users to combine PLE/PLP results across multiple data sources, matching Atlas's multi-site study capability.

#### 3g.1 Backend

- **Model:** `EvidenceSynthesisAnalysis` (references parent EstimationAnalysis or PredictionAnalysis + multiple executions across sources)
- **Controller:** `EvidenceSynthesisController`
- **Service:** `EvidenceSynthesisService` — collects result_json from executions across sources, calls R sidecar for meta-analysis
- **Routes:**
  ```
  POST   /v1/evidence-synthesis
  GET    /v1/evidence-synthesis
  GET    /v1/evidence-synthesis/{id}
  POST   /v1/evidence-synthesis/{id}/run
  ```

#### 3g.2 R Sidecar

**File: `r-runtime/api/evidence_synthesis.R`**

Pipeline:
1. Receive per-site estimation results (log hazard ratios + SE)
2. `EvidenceSynthesis::approximateLikelihood()` — convert to shareable likelihoods
3. `EvidenceSynthesis::computeBayesianMetaAnalysis()` — Bayesian random-effects meta-analysis
4. Return: pooled estimate, CI, heterogeneity (tau), per-site forest plot data

#### 3g.3 Frontend

| Component | Purpose |
|-----------|---------|
| `EvidenceSynthesisDesigner.tsx` | Select parent analysis + pick which source executions to include |
| `MetaAnalysisForestPlot.tsx` | Forest plot with per-site estimates + diamond for pooled |
| `HeterogeneityTable.tsx` | I², tau², Q statistic, p-value for heterogeneity |

---

### Phase 14h — Backend Enhancements

#### 3h.1 Update RService Endpoints

Currently `RService.php` calls `/stubs/estimation` and `/stubs/prediction`. Update to call the real endpoints:

```php
// RService.php
public function runEstimation(array $spec): array
{
    // Change from: POST /stubs/estimation
    // Change to:   POST /analysis/estimation/run
    return $this->post('/analysis/estimation/run', $spec);
}

public function runPrediction(array $spec): array
{
    // Change from: POST /stubs/prediction
    // Change to:   POST /analysis/prediction/run
    return $this->post('/analysis/prediction/run', $spec);
}

public function runSccs(array $spec): array
{
    return $this->post('/analysis/sccs/run', $spec);
}

public function runEvidenceSynthesis(array $spec): array
{
    return $this->post('/analysis/evidence-synthesis/run', $spec);
}
```

#### 3h.2 Increase R Service Timeout

CohortMethod with large datasets can run for 30-60 minutes. PLP with hyperparameter grid search can take hours.

```php
// config/services.php
'r_runtime' => [
    'url' => env('R_SERVICE_URL', 'http://r-runtime:8787'),
    'timeout' => env('R_SERVICE_TIMEOUT', 7200),  // Increase from 300s to 7200s (2 hours)
],
```

The Horizon job timeout is already 14400s (4 hours) — sufficient.

#### 3h.3 Streaming Execution Logs

Add a new endpoint for real-time log streaming during long-running analyses:

```php
// EstimationController & PredictionController
public function streamLogs(Request $request, $analysisId, $executionId)
{
    // SSE (Server-Sent Events) endpoint
    // Polls execution_logs table for new entries
    // Yields events as they appear
    // Closes when execution status leaves 'running'
}
```

Route: `GET /v1/estimations/{id}/executions/{executionId}/logs/stream`

Frontend hooks: `useExecutionLogStream(executionId)` using `EventSource` API.

#### 3h.4 Expand Estimation Validation for PS Methods

```php
// Add to estimation validation
'design_json.propensityScore.method' => 'nullable|string|in:matching,stratification,iptw',
'design_json.propensityScore.matching.caliper' => 'nullable|numeric|min:0',
'design_json.propensityScore.matching.caliperScale' => 'nullable|string|in:ps,standardized,standardized_logit',
'design_json.propensityScore.iptw.maxWeight' => 'nullable|numeric|min:1',
'design_json.propensityScore.iptw.truncation' => 'nullable|numeric|min:0|max:0.5',
```

#### 3h.5 Expand Prediction Validation for All Model Types

```php
// Add to prediction validation
'design_json.model.type' => 'nullable|string|in:lasso_logistic_regression,gradient_boosting,random_forest,ada_boost,decision_tree,naive_bayes,mlp,lightgbm,cox_model',
'design_json.model.hyperParameters.variance' => 'nullable|array',
'design_json.model.hyperParameters.ntrees' => 'nullable|array',
'design_json.model.hyperParameters.maxDepth' => 'nullable|array',
'design_json.model.hyperParameters.learnRate' => 'nullable|array',
'design_json.model.hyperParameters.nEstimators' => 'nullable|array',
'design_json.model.hyperParameters.hiddenLayers' => 'nullable|array',
'design_json.model.hyperParameters.seed' => 'nullable|integer',
'design_json.splitSettings.nFold' => 'nullable|integer|min:2|max:10',
'design_json.splitSettings.type' => 'nullable|string|in:stratified,time',
```

---

### Phase 14i — Frontend Designer Enhancements

**Objective:** Expand the existing designers to expose the full configuration surface.

#### 3i.1 Estimation Designer Enhancements

Add to `EstimationDesigner.tsx`:

| Section | New Fields |
|---------|-----------|
| **Model Type** | Add Poisson regression option alongside Cox and Logistic |
| **PS Method** | Radio group: Matching / Stratification / IPTW (currently only matching/stratification) |
| **PS Matching** | Caliper input + caliper scale dropdown (PS / Standardized / Standardized Logit) |
| **PS IPTW** | Max weight, truncation percentage |
| **Negative Controls** | Concept set picker for negative control outcomes (currently just an ID array) |
| **Study Period** | Study start date, study end date boundaries |
| **Exposure** | First exposure only toggle, handling of subjects in both cohorts |
| **Covariates** | Replace simple checkboxes with `CovariateSettingsPanel` |

#### 3i.2 Prediction Designer Enhancements

Add to `PredictionDesigner.tsx`:

| Section | New Fields |
|---------|-----------|
| **Model Types** | Add AdaBoost, Decision Tree, Naive Bayes, MLP, LightGBM, Cox Model alongside existing LASSO/GBM/RF |
| **Hyperparameters** | Dynamic form based on selected model type — show relevant hyperparams with sensible defaults |
| **Multi-Model** | Allow selecting multiple model types for comparison runs |
| **Split Strategy** | Add time-based splitting option alongside stratified |
| **Cross-Validation** | Number of folds (2-10) slider |
| **Preprocessing** | Min fraction threshold, normalization toggle, redundancy removal toggle |
| **Sampling** | Under/over-sampling for class imbalance toggle |
| **Covariates** | Replace simple checkboxes with `CovariateSettingsPanel` |

#### 3i.3 Type Updates

Expand `estimation.ts` and `prediction.ts` types to match the full HADES API surface:

```typescript
// estimation.ts additions
interface EstimationDesign {
  // Existing fields...
  model: {
    type: "cox" | "logistic" | "poisson";
    // ...
  };
  propensityScore: {
    enabled: boolean;
    method: "matching" | "stratification" | "iptw";
    trimming: number;
    matching?: {
      ratio: number;
      caliper: number;
      caliperScale: "ps" | "standardized" | "standardized_logit";
      maxCasesPerComparator?: number;
    };
    stratification?: {
      numStrata: number;
      baseSelection: "target" | "comparator" | "overall";
    };
    iptw?: {
      maxWeight: number;
      truncation: number;
    };
  };
  studyPeriod?: {
    startDate?: string;
    endDate?: string;
  };
  exposure?: {
    firstExposureOnly: boolean;
    removeDuplicateSubjects: "keep_first" | "keep_all" | "remove_all";
    washoutPeriod: number;
  };
  covariateSettings: ExpandedCovariateSettings;  // Full FeatureExtraction surface
}

// prediction.ts additions
interface PredictionDesign {
  // Existing fields...
  model: {
    type: "lasso_logistic_regression" | "gradient_boosting" | "random_forest" |
          "ada_boost" | "decision_tree" | "naive_bayes" | "mlp" | "lightgbm" | "cox_model";
    hyperParameters: Record<string, unknown>;
  };
  splitSettings: {
    testFraction: number;
    splitSeed: number;
    nFold: number;
    type: "stratified" | "time";
  };
  preprocessSettings?: {
    minFraction: number;
    normalize: boolean;
    removeRedundancy: boolean;
  };
  sampleSettings?: {
    type: "none" | "underSample" | "overSample";
    ratio?: number;
  };
  covariateSettings: ExpandedCovariateSettings;
}
```

---

## 4. R Sidecar Docker Image Strategy

### 4.1 Two-Stage Build

HADES packages are large (CohortMethod alone pulls in ~50 dependencies). A two-stage Docker build avoids reinstalling on every code change:

```dockerfile
# Stage 1: Heavy dependencies (cached layer)
FROM rocker/r-ver:4.4.0 AS hades-base
RUN apt-get update && apt-get install -y \
    libxml2-dev libcurl4-openssl-dev libssl-dev \
    default-jdk libpq-dev libarrow-dev cmake \
    python3 python3-pip python3-venv
RUN R CMD javareconf
RUN Rscript -e 'install.packages(c("remotes", "plumber", "RPostgres", "rJava"))'
RUN Rscript -e ' \
  options(repos = c(OHDSI = "https://ohdsi.r-universe.dev", CRAN = "https://cloud.r-project.org")); \
  install.packages(c( \
    "DatabaseConnector", "SqlRender", "Cyclops", "Andromeda", "ParallelLogger", \
    "FeatureExtraction", "CohortMethod", "PatientLevelPrediction", \
    "SelfControlledCaseSeries", "EvidenceSynthesis", "CohortGenerator", \
    "EmpiricalCalibration", "ResultModelManager" \
  ))'
RUN pip3 install scikit-learn numpy xgboost lightgbm

# Stage 2: Application code (fast layer)
FROM hades-base AS runtime
WORKDIR /app
COPY . .
# Download PostgreSQL JDBC driver
RUN mkdir -p /app/jdbc && \
    curl -L -o /app/jdbc/postgresql-42.7.3.jar \
    https://jdbc.postgresql.org/download/postgresql-42.7.3.jar
ENV DATABASECONNECTOR_JAR_FOLDER=/app/jdbc
EXPOSE 8787
CMD ["Rscript", "-e", "plumber::plumb('plumber_api.R')$run(host='0.0.0.0', port=8787)"]
```

### 4.2 JDBC Driver Management

HADES uses `DatabaseConnector` which requires JDBC. For PostgreSQL:

```r
# In R/connection.R
library(DatabaseConnector)

create_hades_connection <- function(source_spec) {
  connectionDetails <- DatabaseConnector::createConnectionDetails(
    dbms = "postgresql",
    server = paste0(
      source_spec$connection$host, "/",
      source_spec$connection$database
    ),
    port = source_spec$connection$port,
    user = source_spec$connection$user,
    password = source_spec$connection$password,
    pathToDriver = Sys.getenv("DATABASECONNECTOR_JAR_FOLDER", "/app/jdbc")
  )
  return(connectionDetails)
}
```

### 4.3 Memory Considerations

- CohortMethod with 50K+ subjects and 30K+ covariates can use 4-8 GB RAM
- PLP with grid search can use 2-4 GB per model
- Andromeda uses Arrow/DuckDB for disk-backed data — reduces RAM pressure
- **Recommendation:** Set R container memory limit to 16 GB in production, 4 GB for dev

```yaml
# docker-compose.yml
r-runtime:
  deploy:
    resources:
      limits:
        memory: 16G
```

---

## 5. Migration Path & Backwards Compatibility

### 5.1 Existing Analyses Unaffected

The `design_json` column is schemaless JSONB. Existing analyses with the current minimal schema will continue to work. The R sidecar will apply sensible defaults for any missing fields:

```r
# Example: if propensity_score$method is missing, default to "matching"
spec$propensity_score$method <- spec$propensity_score$method %||% "matching"
```

### 5.2 Not-Implemented Graceful Fallback

The `EstimationService` and `PredictionService` already handle `status='not_implemented'` responses. During the transition, partially implemented endpoints can return partial results with a `warnings` array:

```json
{
  "status": "completed",
  "warnings": ["Negative control calibration not yet available"],
  "estimates": [...]
}
```

### 5.3 Frontend Feature Flags

New visualization components and designer sections can be gated behind feature flags:

```typescript
// features/estimation/components/EstimationResults.tsx
const SHOW_KM_CURVES = true;  // Flip to false if R sidecar doesn't return KM data yet
const SHOW_NEGATIVE_CONTROLS = true;
```

---

## 6. Testing Strategy

### 6.1 R Sidecar Unit Tests

**File: `r-runtime/tests/test_covariates.R`** — Verify `build_covariate_settings()` produces valid FeatureExtraction settings
**File: `r-runtime/tests/test_connection.R`** — Verify `create_hades_connection()` returns valid connectionDetails
**File: `r-runtime/tests/test_serialization.R`** — Verify result serialization handles edge cases (empty results, missing fields)

### 6.2 R Sidecar Integration Tests

Using a test PostgreSQL database with synthetic OMOP CDM data (e.g., Eunomia package):

```r
# Install Eunomia test CDM
Eunomia::exportToCdm(outputFolder = "/tmp/eunomia")
# Run estimation pipeline end-to-end
# Verify output JSON schema matches expected structure
```

### 6.3 Backend Tests

- **EstimationServiceTest** — Mock RService to return realistic JSON, verify execution tracking
- **PredictionServiceTest** — Same pattern
- **RServiceTest** — Integration test against running R sidecar

### 6.4 Frontend Tests

- **EstimationDesigner** — Render test with expanded covariate settings
- **PredictionDesigner** — Render test with all model types
- **Result visualizations** — Snapshot tests for SVG chart components with realistic data

### 6.5 End-to-End Test

1. Create estimation analysis via API with full design_json
2. Execute against test CDM
3. Poll until completed
4. Verify result_json contains all expected sections
5. Render in frontend, verify all charts render

---

## 7. Phased Rollout Order

| Sub-Phase | What | Priority | Dependency |
|-----------|------|----------|------------|
| **14a** | HADES Docker install + shared R infra | P0 | None |
| **14b** | CohortMethod R implementation | P0 | 14a |
| **14c** | PatientLevelPrediction R implementation | P0 | 14a |
| **14d** | FeatureExtraction full covariate UI | P1 | 14b, 14c |
| **14e** | Enhanced results viewers (KM, PS dist, balance, attrition, etc.) | P1 | 14b, 14c |
| **14f** | SCCS implementation | P2 | 14a |
| **14g** | Evidence Synthesis | P2 | 14b, 14f |
| **14h** | Backend enhancements (streaming logs, expanded validation) | P1 | 14b, 14c |
| **14i** | Frontend designer enhancements | P1 | 14d |

**Critical path:** 14a → 14b + 14c (parallel) → 14e + 14h (parallel) → 14d + 14i → 14f → 14g

**Estimated effort:**
- 14a: 1 day (Docker + infra)
- 14b: 3-4 days (CohortMethod pipeline + edge cases)
- 14c: 3-4 days (PLP pipeline + model types)
- 14d: 2 days (covariate settings panel)
- 14e: 3-4 days (6-8 new chart components)
- 14f: 2-3 days (SCCS full stack)
- 14g: 2 days (Evidence Synthesis)
- 14h: 1-2 days (backend enhancements)
- 14i: 2 days (designer expansion)

---

## 8. Files Manifest

### New Files (R Sidecar)

| File | Purpose |
|------|---------|
| `r-runtime/R/connection.R` | DatabaseConnector wrapper — creates HADES-compatible connectionDetails from spec |
| `r-runtime/R/covariates.R` | FeatureExtraction settings builder — maps JSON config to createCovariateSettings() |
| `r-runtime/R/progress.R` | Structured logging + progress reporting back to Laravel |
| `r-runtime/R/results.R` | Result serialization — converts HADES output to JSON |
| `r-runtime/api/sccs.R` | SCCS analysis endpoint |
| `r-runtime/api/evidence_synthesis.R` | Evidence Synthesis meta-analysis endpoint |
| `r-runtime/tests/test_covariates.R` | Unit tests for covariate settings builder |
| `r-runtime/tests/test_connection.R` | Unit tests for connection factory |
| `r-runtime/tests/test_serialization.R` | Unit tests for result serialization |

### Modified Files (R Sidecar)

| File | Change |
|------|--------|
| `r-runtime/Dockerfile` | Install HADES packages, Python sklearn, JDBC driver |
| `r-runtime/plumber_api.R` | Mount new routers: `/analysis/sccs`, `/analysis/evidence-synthesis` |
| `r-runtime/api/estimation.R` | Replace 501 stub with full CohortMethod pipeline |
| `r-runtime/api/prediction.R` | Replace 501 stub with full PLP pipeline |
| `r-runtime/api/stubs.R` | Remove stubs for endpoints now implemented |

### New Files (Backend)

| File | Purpose |
|------|---------|
| `backend/app/Models/App/SccsAnalysis.php` | SCCS analysis model |
| `backend/app/Http/Controllers/Api/V1/SccsController.php` | SCCS CRUD + execute |
| `backend/app/Services/Analysis/SccsService.php` | SCCS business logic |
| `backend/app/Jobs/Analysis/RunSccsJob.php` | SCCS queue job |
| `backend/app/Models/App/EvidenceSynthesisAnalysis.php` | Evidence Synthesis model |
| `backend/app/Http/Controllers/Api/V1/EvidenceSynthesisController.php` | ES controller |
| `backend/app/Services/Analysis/EvidenceSynthesisService.php` | ES service |
| `backend/database/migrations/xxxx_create_sccs_analyses_table.php` | SCCS migration |
| `backend/database/migrations/xxxx_create_evidence_synthesis_analyses_table.php` | ES migration |

### Modified Files (Backend)

| File | Change |
|------|--------|
| `backend/app/Services/RService.php` | Update endpoint paths, add `runSccs()` + `runEvidenceSynthesis()` |
| `backend/config/services.php` | Increase R timeout to 7200s |
| `backend/routes/api.php` | Add SCCS + ES routes |
| `backend/app/Http/Controllers/Api/V1/EstimationController.php` | Expand validation rules, add log streaming |
| `backend/app/Http/Controllers/Api/V1/PredictionController.php` | Expand validation rules, add log streaming |

### New Files (Frontend)

| File | Purpose |
|------|---------|
| `frontend/src/components/analysis/CovariateSettingsPanel.tsx` | Shared full FeatureExtraction covariate configuration UI |
| `frontend/src/components/analysis/ExecutionStatusBanner.tsx` | Unified execution status display |
| `frontend/src/components/analysis/LogViewer.tsx` | Real-time execution log viewer |
| `frontend/src/features/estimation/components/KaplanMeierChart.tsx` | KM survival curves |
| `frontend/src/features/estimation/components/PsDistributionChart.tsx` | PS histogram overlay |
| `frontend/src/features/estimation/components/CovariateBalanceScatter.tsx` | SMD scatter plot |
| `frontend/src/features/estimation/components/PopulationCharacteristics.tsx` | Table 1 |
| `frontend/src/features/estimation/components/AttritionDiagram.tsx` | Patient flow diagram |
| `frontend/src/features/estimation/components/NegativeControlPlot.tsx` | Systematic error diagnostic |
| `frontend/src/features/prediction/components/PrecisionRecallCurve.tsx` | PR curve |
| `frontend/src/features/prediction/components/ThresholdAnalysis.tsx` | Interactive threshold slider |
| `frontend/src/features/prediction/components/DecisionCurve.tsx` | Net benefit analysis |
| `frontend/src/features/prediction/components/VariableScatter.tsx` | Feature discrimination plot |
| `frontend/src/features/prediction/components/ModelComparison.tsx` | Multi-model comparison |
| `frontend/src/features/sccs/types/sccs.ts` | SCCS types |
| `frontend/src/features/sccs/api/sccsApi.ts` | SCCS API calls |
| `frontend/src/features/sccs/hooks/useSccs.ts` | SCCS TanStack Query hooks |
| `frontend/src/features/sccs/components/SccsDesigner.tsx` | SCCS configuration form |
| `frontend/src/features/sccs/components/SccsResults.tsx` | SCCS results display |
| `frontend/src/features/sccs/pages/SccsDetailPage.tsx` | SCCS detail page |
| `frontend/src/features/evidence-synthesis/types/evidenceSynthesis.ts` | ES types |
| `frontend/src/features/evidence-synthesis/api/evidenceSynthesisApi.ts` | ES API calls |
| `frontend/src/features/evidence-synthesis/hooks/useEvidenceSynthesis.ts` | ES hooks |
| `frontend/src/features/evidence-synthesis/components/EvidenceSynthesisDesigner.tsx` | ES configuration |
| `frontend/src/features/evidence-synthesis/components/MetaAnalysisForestPlot.tsx` | Pooled forest plot |
| `frontend/src/features/evidence-synthesis/components/HeterogeneityTable.tsx` | I² / tau² display |
| `frontend/src/features/evidence-synthesis/pages/EvidenceSynthesisDetailPage.tsx` | ES detail page |

### Modified Files (Frontend)

| File | Change |
|------|--------|
| `frontend/src/features/estimation/types/estimation.ts` | Expand EstimationDesign with full PS methods, study period, covariates |
| `frontend/src/features/estimation/components/EstimationDesigner.tsx` | Integrate CovariateSettingsPanel, add PS method radio, IPTW, negative controls |
| `frontend/src/features/estimation/components/EstimationResults.tsx` | Add tabs for KM, PS distribution, balance, attrition, negative controls |
| `frontend/src/features/prediction/types/prediction.ts` | Expand PredictionDesign with all model types, preprocessing, sampling |
| `frontend/src/features/prediction/components/PredictionDesigner.tsx` | Integrate CovariateSettingsPanel, add model types, hyperparams, sampling |
| `frontend/src/features/prediction/components/PredictionResults.tsx` | Add tabs for PR curve, threshold analysis, decision curve |
| `frontend/src/app/router.tsx` | Add SCCS and Evidence Synthesis routes |

---

## 9. Acceptance Criteria

When Phase 14 is complete, a long-time Atlas power user should be able to:

1. **Create a PLE study** with target/comparator/outcome cohorts, configure PS matching with caliper, select Cox outcome model, add negative control outcomes, and run the analysis entirely within Parthenon
2. **View PLE results** including: forest plot, Kaplan-Meier curves, PS distribution overlap, covariate balance scatter, attrition diagram, negative control calibration plot, and Table 1 — all matching or exceeding OhdsiShinyModules
3. **Create a PLP study** with any of 9+ model types, configure hyperparameter grids, set population and split settings, and run with cross-validation
4. **View PLP results** including: ROC curve, calibration plot, precision-recall curve, threshold analysis, decision curve, top predictors, and model comparison — all matching or exceeding OhdsiShinyModules
5. **Configure covariates** with the full FeatureExtraction surface: 100+ individual domain settings, time windows, concept inclusion/exclusion
6. **Run SCCS analyses** for within-person safety studies with customizable risk windows
7. **Combine results across data sources** via Evidence Synthesis meta-analysis
8. **Monitor execution** with real-time log streaming during long-running R analyses
9. **Never need to download an R package** — all execution happens server-side, results stream back to the browser

---

## 10. What Parthenon Will Do That Atlas Cannot

Even after achieving parity, Parthenon surpasses Atlas:

| Feature | Atlas | Parthenon |
|---------|-------|-----------|
| Execution model | Download R package → run locally → upload results | Click "Execute" → results stream back automatically |
| Result storage | Per-researcher, local files, shared via CSV export | Centralized, all results in database, full execution history |
| AI assistance | None | Abby can explain results, suggest analyses, flag issues |
| Real-time monitoring | None (R console output) | Live execution logs, status badges, notifications |
| Multi-model comparison | Requires separate exports and manual comparison | Side-by-side in-platform comparison |
| Authentication | None (assumes local R session) | Full RBAC with audit trail |
| Collaboration | Share R packages manually | Shared workspace, other users see all analyses |
| Concept search | Separate Vocabulary tab | Unified search with AI-powered synonym resolution |
| Data quality | Separate Achilles run | Integrated 170+ analyses run natively without R |
