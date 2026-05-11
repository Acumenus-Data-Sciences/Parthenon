# OHDSI Repository Catalog & Parthenon Integration Plan

**Date:** 2026-03-11
**Total Repositories:** 371 (351 active, 20 archived)
**Analysis Scope:** All repos in github.com/OHDSI, sorted by activity and strategic value

---

## Part 1: Repository Catalog

### Activity Classification Criteria

| Status | Definition |
|--------|-----------|
| **Hot** | Pushed within last 30 days (since 2026-02-09), active development |
| **Warm** | Pushed within last 6 months (since 2026-09-11), maintained |
| **Cold** | Pushed within last 2 years, minimal maintenance |
| **Dead** | No push in 2+ years, or archived |

---

### HOT Repositories (Last 30 days — 50 repos)

#### Tier 1: Core Platform & Analytics (High Stars, High Activity)

| Repo | Lang | Stars | Last Push | Description | Parthenon Status |
|------|------|-------|-----------|-------------|-----------------|
| **Data2Evidence** | TS | 32 | Mar 12 | End-to-end OMOP analysis solution | NOT integrated — competitor/peer |
| **PatientLevelPrediction** | R | 215 | Mar 9 | Patient-level prediction | **INTEGRATED** (v6.5.1) |
| **CohortMethod** | R | 89 | Mar 10 | New-user cohort studies | **INTEGRATED** (v6.0.0) |
| **FeatureExtraction** | R | 71 | Mar 6 | Feature generation for cohorts | **INTEGRATED** (v3.12.0) |
| **Vocabulary-v5.0** | PLpgSQL | 262 | Mar 4 | Vocabulary build process | **INTEGRATED** (vocab schema) |
| **Hades** | R | 27 | Mar 6 | HADES suite coordinator | **INTEGRATED** (R runtime) |
| **Strategus** | R | 8 | Mar 6 | Coordinated analytics execution | NOT integrated |
| **WebAPI** | Java | 144 | Feb 14 | Legacy OHDSI services | **COMPATIBILITY LAYER** exists |
| **Atlas** | JS | 307 | Feb 5 | Legacy analysis tool | **REPLACED** by Parthenon |
| **DataQualityDashboard** | JS | 173 | Feb 6 | Data quality standards | **INTEGRATED** (DQD service) |

#### Tier 2: Emerging & High-Potential

| Repo | Lang | Stars | Last Push | Description | Parthenon Status |
|------|------|-------|-----------|-------------|-----------------|
| **Circepy** | Python | 5 | Mar 11 | Python CIRCE cohort compiler | NOT integrated |
| **CommunityDashboard** | Python | 5 | Mar 10 | Community intelligence platform | NOT integrated |
| **StudyAgent** | Python | 1 | Mar 10 | AI study design assistant | **EVALUATED** — MCP integration planned |
| **DeepPatientLevelPrediction** | R | 14 | Mar 10 | Deep learning PLP | NOT integrated |
| **Hecate** | Rust | 11 | Mar 9 | Semantic vocab search | NOT integrated |
| **PhenotypeR** | R | 6 | Mar 9 | Phenotype development | NOT integrated |
| **ARTEMIS** | R | 7 | Mar 9 | (undocumented) | NOT integrated |
| **Characterization** | R | 3 | Mar 9 | Target/outcome characterization | NOT integrated |
| **Keeper** | R | 6 | Mar 10 | Case validation tool | NOT integrated |
| **CohortConstructor** | R | 10 | Mar 8 | Cohort building | NOT integrated |
| **bayes-bridge** | Jupyter | 21 | Mar 11 | Bayesian sparse regression | NOT integrated |
| **Arachne** | TS | 3 | Mar 8 | Distributed data node | NOT integrated |

#### Tier 3: ETL & Infrastructure

| Repo | Lang | Stars | Last Push | Description | Parthenon Status |
|------|------|-------|-----------|-------------|-----------------|
| **ETL-LambdaBuilder** | C# | 20 | Mar 11 | AWS Lambda CDM builder | NOT integrated |
| **Ares** | Vue | 17 | Mar 2 | Research exploration system | NOT integrated |
| **CohortGenerator** | R | 14 | Mar 2 | Cohort generation | **INTEGRATED** (v1.1.0) |
| **SelfControlledCaseSeries** | R | 13 | Mar 2 | SCCS analyses | **INTEGRATED** (v6.1.1) |
| **OhdsiShinyModules** | R | 8 | Mar 6 | Shiny result modules | NOT integrated (not needed) |
| **CohortIncidence** | R | 6 | Mar 3 | Incidence calculations | NOT integrated |
| **CohortDiagnostics** | R | 49 | Feb 4 | Cohort diagnostics | NOT integrated |
| **Criteria2Query** | Java | 75 | Mar 1 | NLP → cohort definitions | NOT integrated |
| **Cyclops** | C++ | 42 | Feb 27 | Regularized regression | **INTEGRATED** (v3.6.0 via CohortMethod) |
| **DatabaseConnector** | R | 57 | Jan 30 | JDBC connectivity | **INTEGRATED** (v7.1.0) |

---

### WARM Repositories (1-6 months — ~80 repos)

#### High-Value Warm Repos

| Repo | Lang | Stars | Last Push | Description | Parthenon Status |
|------|------|-------|-----------|-------------|-----------------|
| **Achilles** | R | 145 | Dec 2 | CDM characterization | **INTEGRATED** (PHP reimplementation) |
| **CommonDataModel** | HTML | 1,023 | Nov 5 | OMOP CDM DDLs | **INTEGRATED** (v5.4) |
| **SqlRender** | R | 86 | Oct 13 | SQL template rendering | **INTEGRATED** (PHP port) |
| **WhiteRabbit** | Java | 208 | Dec 25 | ETL database profiler | NOT integrated |
| **PhenotypeLibrary** | R | 53 | Oct 13 | Phenotype content library | NOT integrated |
| **Broadsea** | R | 90 | Jan 5 | Docker deployment | NOT needed (own Docker stack) |
| **Eunomia** | R | 46 | May 22 | Sample CDM datasets | **INTEGRATED** (GiBleed loader) |
| **PheValuator** | R | 21 | Nov 20 | Phenotype evaluation | NOT integrated |
| **Capr** | R | 21 | Feb 18 | Cohort definition in R | NOT integrated |
| **EmpiricalCalibration** | R | 10 | Nov 21 | Calibration methods | **INTEGRATED** (v3.1.4) |
| **Andromeda** | R | 11 | Nov 21 | Large data handling | **INTEGRATED** (v1.2.0) |
| **ParallelLogger** | R | 13 | Nov 21 | Logging utility | **INTEGRATED** (v3.5.1) |
| **ResultModelManager** | R | 4 | Jan 9 | Results management | **INTEGRATED** (v0.6.2) |
| **EvidenceSynthesis** | Java | 9 | Dec 16 | Meta-analysis | **INTEGRATED** (v1.1.0) |
| **dbt-synthea** | Python | 38 | Jan 8 | Synthea→OMOP dbt ETL | NOT integrated |
| **MIMIC** | Python | 88 | Feb 12 | MIMIC→OMOP ETL | NOT integrated |
| **ETL-Synthea** | R | 121 | Feb 21 | Synthea→OMOP ETL | NOT integrated |
| **Athena** | Java | 72 | Aug 28 | Vocabulary distribution | NOT integrated |
| **Usagi** | Java | 108 | May 28 | Vocabulary mapping tool | NOT integrated |
| **Nostos** | Jupyter | 11 | Jun 2 | Text-to-SQL on OMOP | NOT integrated |
| **Hestia** | Python | 7 | Feb 12 | API function calling on OMOP | NOT integrated |
| **Apollo** | Python | 14 | Jun 18 | Observational LLM | NOT integrated |
| **FhirToCdm** | C# | 19 | Jan 29 | FHIR→OMOP conversion | NOT integrated |
| **Ariadne** | Python | 2 | Jan 6 | Concept mapping toolkit | NOT integrated |
| **GIS** | Shell | 18 | Jan 30 | GIS working group | **PARTIALLY** (GIS Explorer v2) |
| **gaiaCatalog** | Python | 1 | Feb 23 | GIS catalog | NOT integrated |
| **gaiaDB** | PLpgSQL | 1 | Jan 30 | GIS staging database | NOT integrated |
| **gaiaCore** | R | 3 | Apr 25 | GIS R package | NOT integrated |

---

### COLD Repositories (6 months - 2 years — ~100 repos)

Notable cold repos (not exhaustive):

| Repo | Stars | Last Push | Notes |
|------|-------|-----------|-------|
| Perseus | 39 | Nov 2023 | ETL tool (TypeScript) — stalled |
| OHDSIonAWS | 76 | May 2023 | AWS deployment — outdated |
| OHDSI-in-a-Box | 58 | Mar 2021 | VM deployment — dead |
| KnowledgeBase | 55 | Aug 2018 | Drug-outcome evidence — dead |
| StudyProtocols | 40 | Apr 2023 | Study packages — stale |
| NLPTools | 34 | Jan 2024 | NLP extraction — cold |
| Aphrodite | 41 | Jun 2021 | NLP tool — dead |
| Legend | 10 | Dec 2020 | Large-scale estimation — dead |

---

### ARCHIVED Repositories (20 total)

All 15 Strategus module wrappers archived on 2025-06-10 (functionality consolidated into Strategus core):
- ComparatorSelectionExplorerModule, DeepPatientLevelPredictionModule, PatientLevelPredictionValidationModule, DeepPatientLevelPredictionValidationModule, ModelTransferModule, DbProfileModule, CohortIncidenceModule, PatientLevelPredictionModule, CohortDiagnosticsModule, CharacterizationModule, CohortMethodModule, EvidenceSynthesisModule, SelfControlledCaseSeriesModule, DbDiagnosticsModule, CohortGeneratorModule

Other archived:
- AchillesWeb (replaced by Ares)
- Circe (replaced by circe-be)
- OMOP-Standardized-Vocabularies (moved to Vocabulary-v5.0)
- CdmAtlasCutover
- SOS_AA_DiagnosticsExplorer

---

## Part 2: Gap Analysis — What Parthenon Is Missing

### Already Integrated (17 packages)
CohortMethod, PatientLevelPrediction, SelfControlledCaseSeries, EvidenceSynthesis, CohortGenerator, FeatureExtraction, DatabaseConnector, SqlRender, Cyclops, EmpiricalCalibration, Andromeda, ParallelLogger, ResultModelManager, Achilles (PHP port), DataQualityDashboard (PHP port), Eunomia (sample data), OMOP CDM v5.4

### Critical Gaps

| Gap | OHDSI Repo(s) | Impact | Priority |
|-----|---------------|--------|----------|
| **No AI study design** | StudyAgent, Hestia | Users can't leverage LLM for study protocol design | P0 |
| **No deep learning PLP** | DeepPatientLevelPrediction | Missing neural net models for prediction | P1 |
| **No cohort diagnostics** | CohortDiagnostics | Can't evaluate cohort quality before studies | P1 |
| **No phenotype library** | PhenotypeLibrary, PhenotypeR | Users must build phenotypes from scratch | P1 |
| **No Strategus orchestration** | Strategus | Can't run multi-analysis study packages | P2 |
| **No concept mapping tools** | Circepy, Ariadne, Hecate | No vocabulary mapping assistance | P2 |
| **No text-to-SQL** | Nostos | Users can't query CDM in natural language | P2 |
| **No FHIR ingest** | FhirToCdm | Can't ingest FHIR data into CDM | P3 |
| **No ETL tooling** | WhiteRabbit, ETL-Synthea | No built-in ETL profiling or synthetic data | P3 |
| **No incidence analysis** | CohortIncidence | Missing epidemiological incidence rates | P2 |
| **No characterization R pkg** | Characterization | Missing standardized characterization beyond Achilles | P2 |

---

## Part 3: Integration Plan

### Phase A: AI-Powered Study Design (P0) — 2 weeks

**Repos:** StudyAgent, Hestia, Circepy

**Rationale:** These three repos form the emerging OHDSI AI layer. StudyAgent designs studies via LLM, Hestia provides function-calling APIs on OMOP, and Circepy compiles cohort definitions in Python (replacing the Java circe-be dependency). Together they enable an AI assistant that can design, define, and validate studies — a transformative capability no current OHDSI tool offers in production.

**Integration Approach:**

1. **StudyAgent MCP Integration** (already evaluated — see session #S618)
   - Add StudyAgent as Python dependency in `ai/requirements.txt`
   - Expose MCP tools via FastAPI proxy at `/api/v1/ai/study-agent/*`
   - Replace StudyAgent's Atlas/WebAPI calls with Parthenon API calls
   - Frontend: "Abby Study Designer" panel in analyses creation workflow

2. **Hestia Function Calling**
   - Integrate Hestia's OMOP function definitions into Abby AI's tool registry
   - Enables natural language → CDM queries via structured function calls
   - Connects through existing pgvector/chromadb infrastructure

3. **Circepy Cohort Compiler**
   - Add as Python dependency — eliminates Java circe-be dependency for cohort SQL generation
   - Wire into cohort definition save/compile pipeline
   - Validate generated SQL against existing CIRCE output for parity

**Deliverables:**
- AI-assisted study design via Abby chat interface
- Natural language CDM queries
- Pure Python cohort SQL compilation

---

### Phase B: Cohort Quality & Phenotyping (P1) — 3 weeks

**Repos:** CohortDiagnostics, PhenotypeLibrary, PhenotypeR, DeepPatientLevelPrediction

**Rationale:** CohortDiagnostics is the standard OHDSI tool for evaluating whether a cohort definition captures the intended patient population — it produces incidence rates, temporal patterns, overlap analyses, and concept prevalence breakdowns. Without it, researchers are flying blind on cohort quality. PhenotypeLibrary provides 300+ curated phenotype definitions that users can import directly instead of building from scratch. DeepPatientLevelPrediction adds neural network models (transformers, LSTM, ResNet) to the existing PLP pipeline.

**Integration Approach:**

1. **CohortDiagnostics (R runtime)**
   - Add to R runtime Dockerfile: `remotes::install_github("OHDSI/CohortDiagnostics")`
   - New Plumber endpoint: `POST /cohort-diagnostics/run`
   - Parameters: cohort IDs, CDM source, analysis settings
   - Returns: incidence rates, temporal characterization, overlap matrix, orphan concepts
   - Frontend: "Diagnostics" tab on CohortDefinition detail page
   - Results stored in `app.cohort_diagnostic_results` table

2. **PhenotypeLibrary (Backend + Frontend)**
   - Fetch phenotype definitions from OHDSI PhenotypeLibrary GitHub releases
   - `php artisan phenotype:sync` command — downloads and indexes curated phenotypes
   - Solr-indexed phenotype search
   - Frontend: "Phenotype Library" page under Cohorts section
   - One-click import: phenotype → cohort definition with expression JSON

3. **PhenotypeR (R runtime)**
   - Add to R runtime for phenotype development workflows
   - Integrates with CohortDiagnostics for phenotype evaluation
   - Plumber endpoint: `POST /phenotype/evaluate`

4. **DeepPatientLevelPrediction (R runtime + Python)**
   - Add to R runtime Dockerfile
   - Extends existing PLP pipeline with deep learning models
   - New model types in PredictionDesigner: Transformer, LSTM, ResNet, CNN
   - GPU support via CUDA container option (Docker Compose profile)
   - Frontend: additional model type cards in prediction workflow

**Deliverables:**
- Cohort quality evaluation with diagnostics dashboard
- 300+ importable phenotype definitions
- Deep learning prediction models

---

### Phase C: Study Orchestration & Incidence (P2) — 2 weeks

**Repos:** Strategus, CohortIncidence, Characterization

**Rationale:** Strategus is OHDSI's study execution coordinator — it runs multi-analysis study packages that combine CohortMethod, PLP, SCCS, CohortDiagnostics, and Characterization into a single reproducible execution. CohortIncidence calculates epidemiological incidence rates (required for many study types). Characterization provides standardized baseline characterization tables beyond what Achilles offers.

**Integration Approach:**

1. **Strategus (R runtime)**
   - Add to R runtime with all HADES module dependencies
   - New Plumber endpoint: `POST /strategus/execute`
   - Accepts Strategus JSON specification (analysis modules + settings)
   - Frontend: "Study Package" creation wizard
     - Select analysis types (estimation, prediction, characterization, diagnostics)
     - Configure shared cohorts across analyses
     - Execute as a single coordinated study
   - Results aggregated in unified results viewer
   - Import/export Strategus JSON for reproducibility

2. **CohortIncidence (R runtime)**
   - Add to R runtime
   - New Plumber endpoint: `POST /cohort-incidence/calculate`
   - Frontend: "Incidence" analysis type in analyses page
   - IncidenceDesigner: target cohort, outcome cohort, time-at-risk, age/gender stratification
   - Results: incidence rate, person-time, confidence intervals

3. **Characterization (R runtime)**
   - Add to R runtime
   - Extends existing characterization beyond Achilles
   - Compares baseline characteristics between target and outcome cohorts
   - Frontend: "Characterization" analysis type enhancement
   - Table 1 generation with standardized mean differences

**Deliverables:**
- Reproducible multi-analysis study packages
- Epidemiological incidence analysis
- Enhanced baseline characterization

---

### Phase D: Vocabulary Intelligence (P2) — 2 weeks

**Repos:** Hecate, Circepy (continued), Ariadne, Nostos

**Rationale:** Vocabulary work is the most time-consuming part of OHDSI studies. Hecate (Rust-based semantic search) provides dramatically faster concept discovery than traditional keyword search. Nostos enables natural language queries against the CDM. Ariadne assists with mapping source codes to standard concepts. Together these create an AI-augmented vocabulary layer.

**Integration Approach:**

1. **Hecate Semantic Vocabulary Search**
   - Deploy as Docker sidecar service (Rust binary, small footprint)
   - Index OMOP vocabulary with semantic embeddings
   - API: `GET /api/v1/vocabulary/semantic-search?q=heart+failure`
   - Replaces/augments existing Solr vocabulary search
   - Frontend: enhanced concept search with semantic results panel

2. **Nostos Text-to-SQL**
   - Integrate Nostos's prompt templates into Abby AI
   - Natural language → SQL against CDM tables
   - Guardrails: read-only queries, schema validation, result size limits
   - Frontend: "Ask Abby" query panel in Data Explorer

3. **Ariadne Concept Mapping**
   - Add as Python dependency in AI service
   - Assists ETL process: source codes → standard concept suggestions
   - Frontend: mapping assistant in vocabulary tools section

**Deliverables:**
- Semantic concept search
- Natural language CDM queries
- Assisted vocabulary mapping

---

### Phase E: Data Pipeline & ETL (P3) — 3 weeks

**Repos:** WhiteRabbit, ETL-Synthea, dbt-synthea, FhirToCdm, MIMIC

**Rationale:** Parthenon currently requires pre-loaded CDM data. Adding ETL capabilities makes it a complete end-to-end platform — from raw data to analysis results.

**Integration Approach:**

1. **WhiteRabbit Database Profiler**
   - Run as Java sidecar or wrap in Python subprocess
   - Profiles source databases before ETL design
   - Frontend: "Source Profiler" tool under Administration
   - Generates scan reports with table/column statistics

2. **ETL-Synthea / dbt-synthea**
   - Built-in Synthea→OMOP pipeline for demo/testing
   - `php artisan synthea:generate --patients=1000`
   - Generates synthetic patients directly into CDM schema
   - Replaces current Eunomia-only demo capability

3. **FhirToCdm**
   - FHIR R4 → OMOP CDM conversion service
   - Docker sidecar (.NET container)
   - API: `POST /api/v1/etl/fhir/ingest` (accepts FHIR Bundle)
   - Critical for sites receiving FHIR data from EHRs

**Deliverables:**
- Source database profiling
- Synthetic data generation
- FHIR data ingestion

---

## Part 4: Priority Ranking & Timeline

```
Month 1 (Weeks 1-4)
├── Phase A: AI Study Design (StudyAgent + Hestia + Circepy)     [Weeks 1-2]
├── Phase B: Cohort Quality (CohortDiagnostics + PhenotypeLib)   [Weeks 2-4]

Month 2 (Weeks 5-8)
├── Phase B: continued (DeepPLP + PhenotypeR)                    [Week 5]
├── Phase C: Study Orchestration (Strategus + CohortIncidence)   [Weeks 5-7]
├── Phase D: Vocabulary Intelligence (Hecate + Nostos)           [Weeks 7-8]

Month 3 (Weeks 9-12)
├── Phase D: continued (Ariadne)                                 [Week 9]
├── Phase E: Data Pipeline (WhiteRabbit + Synthea + FHIR)        [Weeks 9-12]
```

---

## Part 5: Repos Explicitly NOT Worth Integrating

| Repo | Reason |
|------|--------|
| **Atlas** | Parthenon replaces it entirely |
| **WebAPI** | Compatibility layer already exists; no deeper integration needed |
| **Broadsea** (all variants) | Docker deployment stack — Parthenon has its own |
| **OhdsiShinyModules/ShinyAppBuilder** | R Shiny UI — replaced by React frontend |
| **ROhdsiWebApi** | R client for WebAPI — not needed |
| **OHDSIonAWS** | AWS CloudFormation — own deployment |
| **OHDSI-in-a-Box** | VM approach — obsolete |
| **Perseus** | ETL tool — cold, TypeScript — consider WhiteRabbit instead |
| **Olympus** | Legacy launcher — dead |
| **All 15 archived Strategus modules** | Consolidated into Strategus core |
| **AchillesWeb** | Archived — Parthenon has React Achilles dashboard |
| **Hermes/Heracles** | Deprecated vocabulary/characterization tools |
| **Data2Evidence** | Competitor platform — study but don't integrate |
| **Atlas3 / WebAPI3** | "Under development" with 0-1 stars — vaporware |
| **Arachne** (all) | Distributed network infrastructure — different architecture |
| **Regional ETLs** (Korean NSC, German FHIR, etc.) | Site-specific, not generalizable |
| **Working group repos** (OncologyWG, PsychiatryWG, etc.) | Documentation/coordination, no code to integrate |
| **Tutorial repos** | Educational materials, not software |
| **Study-specific apps** (SemaglutideNvamdApp, etc.) | One-off Shiny apps for specific studies |

---

## Part 6: Repos to Monitor (Watch List)

These aren't ready for integration but show promise:

| Repo | Why Watch |
|------|-----------|
| **Data2Evidence** | 32 stars, very active — TypeScript OMOP platform, potential patterns to learn from |
| **CommunityDashboard** | OHDSI network intelligence — could inform Parthenon's multi-site features |
| **ARTEMIS** | Active R package, unclear purpose — monitor for relevance |
| **Keeper** | Case validation — could complement CohortDiagnostics |
| **OmopSketch/OmopViewer** | CDM visualization tools — may have UI patterns worth adopting |
| **bayes-bridge** | Bayesian regression — could enhance Cyclops/CohortMethod capabilities |
| **CohortConstructor** | 10 stars, 69 issues — active cohort building alternative to Capr |
| **Apollo/ApolloR** | Observational LLM — could enhance Abby AI |
| **Kala** | Time series from cohorts — novel analysis type |
| **LlmPromptBuilders** | Pre-built LLM prompts for OHDSI — could feed Abby AI |

---

## Part 7: Integration Architecture Summary

```
┌─────────────────────────────────────────────────────────┐
│                     Parthenon Frontend                    │
│  React 19 + TypeScript + TailwindCSS + Zustand           │
│                                                           │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐    │
│  │ Cohort   │ │ Analysis │ │ Phenotype│ │ Study    │    │
│  │ Builder  │ │ Designer │ │ Library  │ │ Package  │    │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘    │
│       │             │            │             │          │
└───────┼─────────────┼────────────┼─────────────┼──────────┘
        │             │            │             │
┌───────┼─────────────┼────────────┼─────────────┼──────────┐
│       ▼             ▼            ▼             ▼          │
│              Laravel 11 API Gateway                       │
│  ┌─────────────────────────────────────────────────┐     │
│  │ Existing: Auth, Sources, Cohorts, Concepts,     │     │
│  │           Achilles, DQD, Atlas Migration         │     │
│  ├─────────────────────────────────────────────────┤     │
│  │ NEW Phase B: PhenotypeLibrary sync, diagnostics │     │
│  │ NEW Phase C: Strategus proxy, Incidence proxy   │     │
│  │ NEW Phase E: WhiteRabbit proxy, FHIR ingest     │     │
│  └─────────────────────────────────────────────────┘     │
└──────────┬──────────────┬──────────────┬─────────────────┘
           │              │              │
     ┌─────▼─────┐ ┌─────▼─────┐ ┌─────▼──────┐
     │  Python   │ │ R Runtime │ │  Docker     │
     │  FastAPI  │ │ Plumber   │ │  Sidecars   │
     │           │ │           │ │             │
     │ Phase A:  │ │ Existing: │ │ Phase D:    │
     │ StudyAgent│ │ CohortMthd│ │ Hecate      │
     │ Hestia   │ │ PLP       │ │ (vocab srch)│
     │ Circepy  │ │ SCCS      │ │             │
     │ Ariadne  │ │ EvidSynth │ │ Phase E:    │
     │ Nostos   │ │           │ │ WhiteRabbit │
     │           │ │ Phase B:  │ │ FhirToCdm  │
     │           │ │ CohortDx  │ │             │
     │           │ │ DeepPLP   │ │             │
     │           │ │ PhenoTypeR│ │             │
     │           │ │           │ │             │
     │           │ │ Phase C:  │ │             │
     │           │ │ Strategus │ │             │
     │           │ │ CohortInc │ │             │
     │           │ │ Character │ │             │
     └───────────┘ └───────────┘ └─────────────┘
```

---

## Appendix: Complete Dead/Inactive Repository List

Repos with no meaningful push since 2024 (148 repos) — not listed individually. Full data available in `/tmp/ohdsi_repos_sorted.tsv`.

Key dead repos by star count:
- KnowledgeBase (55★, last push Aug 2018)
- StudyProtocols (40★, last push Apr 2023)
- Aphrodite (41★, last push Jun 2021)
- Perseus (39★, last push Nov 2023)
- OHDSIonAWS (76★, last push May 2023)
- OHDSI-in-a-Box (58★, last push Mar 2021)
- Visualizations (8★, last push Jan 2023)
- OMOP-Queries (32★, last push Jul 2018)
