# Changelog

All notable changes to Parthenon are documented here.

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
