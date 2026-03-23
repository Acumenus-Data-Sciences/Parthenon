# Changelog

All notable changes to Parthenon are documented here.

## [1.0.0] — 2026-03-23

### Added
- **Acropolis installer** — universal 9-phase Python TUI for one-command Parthenon deployment (Docker, bare metal, Kubernetes)
- **Dataset Acquisition TUI** — post-install utility for downloading public datasets (OMOP Vocabulary, Eunomia, SynPUF, SyntheA, GIAB, ClinVar, DICOM, GIS boundaries) with recommended bundles
- **GHCR container registry** — all 16 Docker images published to `ghcr.io/sudoshi/parthenon-*` with dependency-aware CI builds
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
- R runtime v6 API fixes for SCCS and PLP pipelines
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
- R runtime container persistence issues

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
