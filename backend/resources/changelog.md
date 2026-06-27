# Changelog

All notable changes to Parthenon are documented here.

## [1.0.9] — 2026-06-26

### Added
- **Protocol-to-Publication pipeline (ADR-0020)** — a deterministic study orchestration FSM that carries a study from protocol through estimation, calibration, and gated analysis to a publication-ready manuscript. Includes a **provenance spine** (content-addressable hashes, version pinning, reproducible study packages), **empirical calibration** (calibrated confidence intervals, EASE, multiplicity correction, negative-control calibration in the CohortMethod sidecar), a **scientific gate ledger with estimate blinding** (behind `studies.gating_enabled`), index-event breakdown + orphan-concept diagnostics, and a **gate-aware STROBE/RECORD manuscript composer**
- **Abby study orchestrator** — a Claude Agent SDK copilot that drives study design → execution → publication, with an orchestrator launch surface and copilot panel
- **FHIR ingestion (Medgnosis parity)** — ingest CarePlan, Goal, CareTeam, DocumentReference, Coverage, and ServiceRequest into the OMOP CDM via a new `ResourceMapper` interface with registry dispatch; care-extension tables and soft-delete crosswalk columns; soft-delete via `entered-in-error` with a Bulk deleted manifest
- **Epic SMART Backend Services authentication** — public JWKS endpoint with `kid` in the Backend Services JWT, validated end-to-end against the live Epic FHIR sandbox (auth handshake + six mappers proven on real data)
- **OMOP-to-FHIR bulk `$export`** with per-user rate limiting, plus an admin bulk-export page wired to the backend (create / poll / download NDJSON)
- **Omnipresent Abby copilot** — action-taking assistant on the Claude Agent SDK, grounded on all 38 page contexts, with help and Abby drawer coverage on every page
- **Local-model copilots for Community Edition** — an admin-switchable copilot provider (Anthropic cloud ↔ local Ollama) with graceful fallback, and a config-driven local-model backend so CE can run the copilots fully on-prem
- **`sidecars:readiness` command** — health probes for all nine sidecars (darkstar/R, python-ai, redis, orthanc, hecate, fhir-to-cdm, templates, anonymizer, scispacy) with `--json` and a non-zero exit for environment promotion gates
- **Publish module export maturation** — XLSX manuscript export, PNG/SVG figure export, OHDSI report-bundle import/export, a rich OHDSI study-first picker with typed result summaries, and `###` subheading support in the paper renderer
- **OHDSI-lifecycle study tabs** — Study Protocol → Analysis Results → Draft Manuscript, populated from analysis results with a composed manuscript and merged progress tracking, plus inclusion-attrition diagnostics
- **Source profiler scan comparison** — cross-source and cross-project schema/row-count/null-rate/vocabulary/distribution deltas
- **Patient-similarity PSM export** — write matched propensity-score cohorts to the results table
- **GIS `.xlsx`/`.xls` upload** in the data-import wizard
- **Multi-reviewer phenotype adjudication** contract
- **Hypertension v4 study** end-to-end on the Acumenus OMOP CDM (BP-indexed target, delay strata, negative-control panel, recording-comparable normotensive comparator)
- Self-controlled cohort analysis detail route wired into the UI

### Changed
- Estimation, prediction, SCCS, and evidence-synthesis runs now **fail with actionable diagnostics** when the R sidecar is unavailable, instead of silently completing; the R sidecar response contract is hardened and HADES is verified end-to-end
- A per-contrast study-diagnostics gate means one bad contrast no longer fails an entire study
- Airflow / Dagster / Temporal are relabeled as developer-extension examples (ADR-0021), not first-class orchestration connectors
- Removed non-functional surfaces for honesty: the dead Abby agentic plan-execution UI, Chroma Studio seed-FAQ / aggregate-conversations, and imaging AI measurement-extraction / template-suggestion stubs
- Health endpoints canonicalized on `/api/health` with an `/api/v1/health` alias to prevent drift

### Fixed
- **Security** — CORS scoped to app origins (was wildcard with credentials); RBAC permission middleware added to Achilles, DQD, risk-score, and clinical-coherence routes; `profiles.view` enforced on Morpheus and Patient Profile PHI routes
- Estimation sidecar restored (age binning, incidence-rate confidence intervals, negative-control calibration)
- Abby grounded on all 38 page contexts (was 21); the data-quality profiler now targets the `omop` schema (not a phantom `cdm` schema); failed/empty agent turns are surfaced instead of hanging; the double `/api/v1` prefix on Abby profile and risk-score calls is removed
- Unauthenticated 401 responses are now localized via locale resolution in the exception handler
- Zero-resource FHIR-to-OMOP outputs are handled gracefully; schema mappings with a null `cdm_column` are skipped
- Cohort and analysis labels always resolve to names, never bare IDs
- Hecate vocabulary search latency and Ariadne vector search repaired; Orthanc PACS credentials kept in sync
- Installer loads the license module via an `importlib` spec and unblocks its build (rustfmt, bundle version pin)
- **Fresh-machine install hardening** — `docker compose` now starts from a clean `.env.example` (adds the required `PARTHENON_INTERNAL_TOKEN` plus default-service credentials for Reverb, Orthanc, Hecate, and JupyterHub); the installer creates the `acropolis-backend` network and the `data/wiki` bind directory; and the manual-install docs match the `dev`-profile frontend build

### Engineering
- Coverage floor ratcheted from 25% → 32% (measured 33.59%), enforced via pcov and explicit clover parsing
- Real PHPStan level 8 restored by replacing blanket ignores with a dated baseline
- Darkstar image builds authenticate `install_github` via a BuildKit secret (push-safe); HADES/ARTEMIS/FinnGen scheduled CI jobs green without external prerequisites
- Bounded Pest test lanes and a `composer test` alias; R↔PHP calibration contract test, Abby data-interrogation contract tests, and a manuscript numeric-fabrication guard

## [1.0.8] — 2026-05-28

### Added
- **Publish module** — server-side publication drafts with debounced autosave (retry + beforeunload guards), snapshot create/list/revert with optimistic locking, and study-scoped sharing via VisibilityBadge and ShareDropdown
- **Publication agent** — Claude Agent SDK copilot for manuscript drafting, with read-only and write/approval phases
- **Study Designer agent** — Claude Agent SDK copilot that assists study design (read-only slice)
- **Library Lifecycle management** — draft / active / archived states across cohort definitions, concept sets, and analyses, with status tabs and live counts on every list page
- **Admin Library console** (`/admin/library`) — unified index with bulk delete, owner reassignment (permission-checked + audited), trash, and hard-delete with attachment preflight
- **Cleanup suggestions** — nightly job that surfaces unused library items with an in-app banner and dedicated suggestions page
- **Studies v2 wizard** — 8-step stepper shell with version popover; Compiler Workbench v2 promoted to default
- Read-only Publish wizard mode for viewer collaborators

### Changed
- Auto-promote flow (409 contract) when attaching draft library items to a study
- Runtime **AI Agents** admin toggle now gates both Claude Agent SDK copilots (replaces the `publish.agent` flag)

### Fixed
- One-time lifecycle notice toast for end users
- Admin hard-delete preflight matches analyses by fully-qualified class name
- Nightly 30-day purge of soft-deleted library items

## [1.0.7] — 2026-05-10

### Added
- **Enterprise extension points** — pluggable AuthDriver, TenantResolver, CryptoProvider, AuditSink, and ObservabilityShipper, plus a feature-flag store and EnterpriseGate
- **Managed OHDSI Shiny viewer** — official viewer handoff, managed result loader and manifest contract, launch metrics with throttling, and workspace pruning
- **Aqueduct ingestion templates** — run progress, current node, timestamps, and error surfacing; NCDR commercial template (SQL stages, column map, end-to-end test)
- **CMS eCQM / VSAC** — sortable, filterable CMS Measures page and 72 backfilled eCQM titles
- Composition contract verification (`--check-infra-overlay`) and Acropolis phase registry

### Fixed
- Deploy auto-heals a composer autoloader poisoned by worktree paths
- R `fs` package build (libuv1-dev) and test-infra database host resolution

## [1.0.6] — 2026-04-16

### Added
- **FinnGen Cohort Workbench (SP4)** — operation-tree algebra and compiler, cohort matching wrapper, live preview counts, materialize flow, run history, and Atlas import via the active WebAPI registry
- SMD diagnostics and attrition waterfall in the FinnGen workbench; surfaced on the launcher
- Installer `--community` flag for the fastest path to login

### Fixed
- Fresh-machine install hardening — portable Compose defaults, lazy nginx upstream resolution, macOS host GID collision, and idempotent migrations
- Windows compatibility (`os.getuid`/`os.getgid` guards)
- FinnGen SP4 double-dispatch causing duplicate materialize rows

> Interim patch releases 1.0.4.1 and 1.0.5 delivered FinnGen SP3 close-out and earlier fresh-machine install fixes.

## [1.0.4] — 2026-04-09

### Added
- **OHDSI Wiki corpus** — curated 982-paper corpus with metadata extraction, chronological ordering, streaming chat, Claude routing, and Abby RAG integration
- Deeper Chroma Studio cluster explorer with hardened ingestion quality

### Fixed
- Vector Explorer tooltip stability (pause auto-rotate on hover) and rendering hardening
- Abby chat streaming restored; fake-PDF detection in the corpus scraper
- OMOP vocabulary table-name corrections and concept_embeddings schema

## [1.0.3] — 2026-03-30

### Added
- **Risk Scores v2** — 20 validated clinical instruments with cohort-scoped engine, eligibility checking, score catalogue, and detail modal
- **Standard PROs+** — Survey instrument library with 32 public-domain instruments (685+ items), tabbed workspace, and SNOMED CT coverage tracking
- **BlackRabbit** — next-gen source profiling replacing WhiteRabbit, with SQL Server, Azure Synapse, and Oracle database support
- **LiveKit** — real-time voice and video calls in Commons workspaces, powered by LiveKit Cloud
- **Arachne DataNode** — opt-in federated study execution for participating in OHDSI network studies
- **Phoebe** — AI-powered concept recommendations from OHDSI concept_recommended table, integrated into Concept Set Editor
- **Poseidon** — data lakehouse with Dagster orchestration and dbt transformations for incremental CDM ETL
- **Cohort Risk Score Criteria** — risk score thresholds as inclusion/exclusion criteria in the cohort definition editor
- **Scribe API docs** — replaced Scramble with Scribe, OpenAPI reference integrated into Docusaurus user manual
- **Admin broadcast email** — send announcements to all registered users

### Changed
- **Aqueduct** — full-screen canvas mode, persistent viewport, compact toolbar, universal CDM selector, click-to-map field detail modals
- **Hecate** — switched to EmbeddingGemma-300M via Ollama, Qdrant upgraded to v1.17.1
- **Darkstar** — CohortMethod 6.0.1, PLP 6.6.0, DeepPatientLevelPrediction, DQD support
- **Nginx** — security headers, template-based config, 5GB upload support
- **System Health** — service tier grouping with Poseidon health check panel

### Installer
- Module-grouped setup — services organized by function (Research, Commons, AI & Knowledge, Data Pipeline, Infrastructure)
- `--upgrade` flag for in-place upgrades with version detection, changelog display, and automatic migrations
- WhiteRabbit → BlackRabbit automatic migration during upgrade

## [1.0.0] — 2026-03-23

### Added
- **Acropolis installer** — universal 9-phase Python TUI for one-command Parthenon deployment (Docker, bare metal, Kubernetes)
- **Dataset Acquisition TUI** — post-install utility for downloading public datasets (OMOP Vocabulary, Eunomia, SynPUF, SyntheA, GIAB, ClinVar, DICOM, GIS boundaries) with recommended bundles
- **GHCR container registry** — all 16 Docker images published to `ghcr.io/acumenus-data-sciences/parthenon-*` with dependency-aware CI builds
- `--defaults-file` flag for fully non-interactive pre-seeded installs

### Changed
- Acropolis consolidated into Parthenon monorepo (previously separate repo)

## [0.17.0] — 2026-03-21

### Added
- **Morpheus multi-dataset support** — dataset selector, parameterized queries, and registry table for switching between MIMIC-IV, AtlanticHealth, and future EHR sources
- **AtlanticHealth dataset** — 243K inpatient patients synthesized from Epic EHR statistical distributions (7-phase pipeline: demographics, admissions, labs, vitals, procedures, microbiology, I/O events)
- **Evidence Investigation module** — full workflow with landing page, sample investigations, narrative editing, export (PDF/JSON), and version history with auto-snapshot
- JupyterHub starter notebooks for Morpheus, FinnGen, and penuX
- Materialized view support and 10-minute cache for Morpheus dashboard queries

### Fixed
- Morpheus breadcrumb dataset persistence, `\\N` bulk-import artifacts, AtlanticHealth schema adaptation
- PHP empty array serialization for investigation domain state fields
- GWAS Catalog endpoint corrections for disease-trait and gene lookups

## [0.16.0] — 2026-03-17

### Added
- **Acropolis infrastructure layer** — Traefik reverse proxy, Portainer, pgAdmin, Grafana/Loki/Alloy observability stack, cAdvisor, node-exporter
- Kubernetes Helm charts and Kustomize overlays for enterprise deployment
- Docusaurus site broken-link audit and repair (all internal links validated)

### Fixed
- CI pipeline: aligned test schemas with database.php, added missing eunomia_results schema, PHPStan baseline sync
- TypeScript strict mode violations and ESLint conditional hooks errors

## [0.15.0] — 2026-03-14

### Added
- **Abby AI Agency** — Plan-Confirm-Execute engine with DAG executor for parallel step execution, tool registry with risk levels, dry run mode, and action audit trail with rollback
- **Institutional Intelligence** — automatic knowledge capture from conversations, FAQ auto-promoter, contextual knowledge surfacing
- **Aqueduct ETL module** — vocabulary lookup generator with SQL templates extracted from Perseus, session/run tracking
- Workflow templates for 6 common OHDSI study designs (cohort characterization, incidence rate, PLE, PLP, treatment pathways, DQD)
- Data quality warnings injected as safety-critical context in Abby chat pipeline
- Knowledge graph service with hierarchy traversal and Redis caching
- Data profile service with CDM coverage analysis and gap detection

### Fixed
- PostGIS schema compatibility (use ALTER TABLE instead of AddGeometryColumn)
- FAQ promoter referencing correct table name

### Security
- HIGH severity issues from code review addressed
- Missing `conn.commit()` in action_logger, knowledge_capture, cost_tracker

## [0.14.0] — 2026-03-10

### Added
- **GIS Explorer v3** — multi-layer analysis system with data import wizard (upload, mapping, configuration, validation, import steps), FastAPI geo conversion, and Abby spatial analysis
- **Chroma Studio** — vector database management UI with 3D Vector Explorer (PCA→UMAP projections), Solr-accelerated 48x faster initial load
- About Abby memorial modal
- Database architecture guide with domain ERDs and `db:audit` command
- Daily digest preferences with role-based email summaries
- Drillable summary cards across the entire platform

### Fixed
- Permission updates on protected roles
- ChromaDB pagination and git dependency in Docker image
- Numpy array None checks in collection overview

## [0.13.0] — 2026-03-08

### Added
- **Morpheus Inpatient module** — full ICU patient journey dashboard with Labs (sparklines, masonry layout), Vitals (bedside monitor 2x3 grid), Microbiology (antibiogram heatmap per CLSI M39, culture table), ConceptDetailDrawer, and SearchDropdown
- HoverCard tooltips and keyboard navigation across LocationTrack and MedicationTimeline
- Clickable MetricCards with drill-through on Morpheus dashboard

### Changed
- FinnGenWorkbenchService decomposed from 3,486-line monolith into 9 focused domain services

### Fixed
- Dashboard SVG tooltip rendering, responsive chart sizing, denser layout
- ESLint hooks-called-conditionally errors in LocationTrack

## [0.12.0] — 2026-03-06

### Added
- **Imaging Outcomes Research** — OHIF measurement bridge, study browser, comparison viewer, longitudinal timeline, AI extraction, and COVID CT dataset import
- **Results Explorer Phase 4** — Kaplan-Meier curves, Love plots, attrition diagrams, propensity score distributions, cohort diagnostics panel
- First R-backed CohortMethod estimation on Acumenus CDM (1M patients)
- Solr imaging core with OHIF performance tuning, Orthanc transcoding, nginx DICOM cache layer

### Fixed
- OHIF iframe viewport sizing, study prefetcher disabled, investigational dialog suppressed
- Darkstar API fixes for SCCS and PLP pipelines
- All analysis chart components hardened against R "NA" values

## [0.11.0] — 2026-03-04

### Added
- **Studies module** — 13 phases covering schema, controllers, frontend, create wizard, command center, results, synthesis, activity logging, R bridge, and AI assist
- SCCS and Evidence Synthesis analysis types with sample data
- Development blog with Docusaurus blog plugin
- Precision Medicine panel in Patient Profile
- Concept sets enhancements — 12 sample sets, search/filter, bulk actions, duplicate, bundle creation
- Vocabulary browser enhancements — pagination, clickable rows, synonyms, add-to-set

### Fixed
- Eunomia vocabulary tables now loaded from GiBleed zip
- Concept metadata nested under 'concept' key in API response
- Darkstar container persistence issues

### Security
- HIGHSEC paradigm established (2026-03-20): WADO endpoints require auth, new users get viewer-only role, Horizon gate uses role check, mass assignment protection restored, Redis/Orthanc/Grafana authentication enforced, non-root Docker users, Sanctum 8-hour token expiration

## [0.10.0] — 2026-03-03

### Added
- Eunomia dataset loader with multi-source Achilles and Dashboard CDM summary
- Installer hardening and Setup Wizard overhaul
- Standalone Docker install: nginx serves React SPA from `frontend/dist/`

### Fixed
- Admin pages React errors with shared component consistency
- `--legacy-peer-deps` added to Node image build

## [0.9.0] — 2026-03-03

### Added
- In-app contextual help system with `?` slide-over panels on every major feature (§9.12)
- Algolia DocSearch support with Lunr.js fallback; Mermaid diagram rendering in docs (§9.11)
- API Reference with 173 documented endpoints grouped across 23 sections; auto-generated TypeScript types (§9.10)
- Atlas → Parthenon migration guide (7 chapters) and CLI validation tool (`parthenon:validate-atlas-parity`) (§9.9)
- Full Docusaurus v3 user manual — 26 chapters, 7 appendices, full-text search (§9.8)

### Fixed
- PHP 8.4 compatibility: resolved trait property redeclaration errors in ingestion queue jobs

## [0.8.0] — 2026-03-02

### Added
- Super-admin first-login setup wizard (6-step guided configuration)
- User onboarding modal with Joyride guided tour
- Achilles Heel Checks tab in Data Explorer (5th tab)

### Fixed
- Spatie role middleware alias registration in Laravel 11 bootstrap

## [0.7.0] — 2026-03-01

### Added
- WebAPI compatibility layer (`/WebAPI/*` routes) for HADES R package integration
- Legacy Atlas URL redirects (`/atlas/#/` → Parthenon equivalents)
- Auto-generated OpenAPI spec via `dedoc/scramble` at `/docs/api`
- Data Quality Dashboard with full DQD + Achilles Heel check support
- Cohort import/export (JSON), concept set import/export, share-by-link

## [0.6.0] — 2026-02-28

### Added
- Care Bundles & Gaps analysis module
- Population Characterization (PC001–PC006)
- Population Risk Scoring (20 validated clinical scores)
- Network Analysis (multi-site federation analytics)
- Clinical Coherence analysis

## [0.5.0] — 2026-02-25

### Added
- AI Provider configuration (8 providers, Ollama default)
- System Health Dashboard with real-time service monitoring
- Admin panel: User, Role, Permission, Auth Provider management

## [0.4.0] — 2026-02-20

### Added
- PHPStan L8 static analysis with baseline
- Pest feature test suite (195 tests — backend, frontend, AI)
- 10 model factories for testing

## [0.3.0] — 2026-02-15

### Added
- Characterization, Incidence Rate, Treatment Pathway analyses
- Population-Level Estimation and Patient-Level Prediction (UI stubs)
- Study package management
- Patient Timeline viewer (requires PHI access role)

## [0.2.0] — 2026-02-10

### Added
- Cohort Builder with full CIRCE expression support
- Cohort generation via Horizon queue workers
- Concept Set Builder with ancestor/descendant resolution
- Vocabulary Browser with full-text and semantic search

## [0.1.0] — 2026-02-01

### Added
- Initial Parthenon platform — Laravel 11 + React 19 + OMOP CDM v5.4
- Sanctum authentication, Spatie RBAC, Redis queues
- Data Source management with CDM/vocabulary/results daimon configuration
- Achilles data characterization integration
