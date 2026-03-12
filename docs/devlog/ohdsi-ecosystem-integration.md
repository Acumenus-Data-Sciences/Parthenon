# OHDSI Ecosystem Integration — Devlog

**Date:** 2026-03-12
**Branch:** feature/chromadb-abby-brain (committed on feature/fhir-omop-ig-compliance)
**Commit:** 9a75e8a5

## What Was Built

Full 5-phase integration of the OHDSI open-source ecosystem into Parthenon, replacing the need for standalone Atlas/WebAPI tools with native, modern equivalents.

### Phase A — Study Design Intelligence
- **StudyAgent** (Python sidecar): AI-powered study design assistant — intent splitting, phenotype search, cohort linting, concept set review
- **Circe SQL Compiler**: Frontend panel (3 tabs: Generated SQL, Validation, Print Friendly) integrated into Cohort Definition detail page
- Frontend: StudyDesignerPage (4-tab wizard), study-agent API client

### Phase B — Diagnostics & Deep Learning
- **CohortDiagnostics**: R endpoint wrapping OHDSI/CohortDiagnostics@v3.4.2 — 6 diagnostic types (incidence, orphan concepts, index breakdown, visit context, inclusion stats, temporal characterization)
- **DeepPatientLevelPrediction**: Added Transformer, ResNet, deep_mlp model types to R prediction endpoint using DeepPLP@v2.3.0
- **PhenotypeLibrary**: Eloquent model + sync command fetching 300+ curated phenotypes from OHDSI GitHub, with search/filter/import UI
- Frontend: CohortDiagnosticsPanel (815 lines, 6 result sections), PhenotypeLibraryPage (612 lines, domain filters, expandable rows)

### Phase C — Study Orchestration & Enhanced Analytics
- **Strategus**: R endpoints for multi-analysis study execution (CohortMethod + PLP + SCCS coordinated), spec validation, module listing — 1800s timeout for long studies
- **CohortIncidence**: R endpoint with multi-TAR, age/gender/year stratification, Poisson CIs
- **Characterization**: R endpoint with aggregate covariates (Table 1 + SMD), time-to-event, dechallenge-rechallenge
- Laravel controllers: StrategusController (3 endpoints), plus `calculateDirect` and `runDirect` methods added to IncidenceRateController and CharacterizationController
- Frontend: StudyPackagePage (1,079 lines, 5-step wizard), enhanced IncidenceRateDesigner/Results and CharacterizationDesigner/Results

### Phase D — Vocabulary Intelligence
- **Hecate** (Docker sidecar): Rust-based semantic search over OMOP vocabulary using Qdrant vector DB — 7 proxy endpoints (search, autocomplete, concept details, hierarchy, relationships)
- **Ariadne**: 3-stage term mapping pipeline (verbatim → vector → LLM re-ranking) with graceful fallback if package unavailable
- **Text-to-SQL**: NL→SQL with comprehensive OMOP CDM v5.4 schema context, read-only SQL validation, dangerous pattern detection
- Frontend: SemanticSearchPanel (928 lines, keyboard nav, autocomplete), MappingAssistantPage (845 lines, CSV import/export, confidence bars), QueryAssistantPage (1,193 lines, schema browser, query history)

### Phase E — Data Pipeline & ETL
- **WhiteRabbit** (Docker sidecar): Java CLI wrapped in Python HTTP server — source database profiling with xlsx→JSON report conversion
- **ETL-Synthea**: R endpoint using ETLSyntheaBuilder@v2.1.0 — Synthea CSV → OMOP CDM conversion for synthetic data generation
- **FHIR-to-CDM** (Docker sidecar): .NET CLI wrapped in Python HTTP server — FHIR R4 Bundle/NDJSON → OMOP CDM records
- Frontend: EtlToolsPage (866 lines, 3 tabs: Source Profiler, Synthea Generator, FHIR Ingestion), FhirIngestionPanel (655 lines, drag-drop, NDJSON batch)

## Infrastructure Changes

### Docker
- R Dockerfile: 3 new HADES layers (5-7) + PyTorch ecosystem (torch>=2.7, polars, pyarrow, duckdb)
- 3 new sidecar services: hecate (port 8080), whiterabbit (port 8090), fhir-to-cdm (port 8091)
- Qdrant vector DB (internal-only, no host port)
- New volumes: study-agent-data, qdrant-data, hecate-data

### Backend
- 10 new Laravel controllers
- 1 new Eloquent model (PhenotypeLibraryEntry) + migration
- 1 new Artisan command (PhenotypeSync)
- services.php extended with hecate, whiterabbit, fhir_to_cdm URLs

### AI Service
- 3 new FastAPI routers: ariadne, circe, text_to_sql
- New dependencies: ariadne (OHDSI), spacy

### R Runtime
- 5 new Plumber endpoint files: cohort_diagnostics, cohort_incidence, characterization, strategus, synthea
- Enhanced prediction.R with DeepPLP model types

## Architecture Decisions

1. **Sidecar pattern for non-R/Python tools**: WhiteRabbit (Java), FhirToCdm (.NET), Hecate (Rust) run as standalone Docker containers with lightweight Python HTTP wrappers — avoids polyglot complexity in the main services
2. **Proxy through Laravel**: All external service calls route Browser → Laravel → service, maintaining consistent auth and API gateway
3. **Graceful degradation**: Ariadne (alpha v0.0.1) falls back to raw SQL + Ollama if package unavailable; DeepPLP models fall back gracefully if package not installed
4. **`deep_mlp` key**: Avoids collision with existing `mlp` key in PatientLevelPrediction
5. **Nostos reimplemented**: Original is Amazon-private; built own text-to-SQL with Ollama + OMOP schema context

## Stats
- 73 files changed, 18,189 insertions, 532 deletions
- 10 fully implemented frontend pages/panels (avg 770 lines each)
- All TypeScript and PHP syntax checks passing
