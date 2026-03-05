# Parthenon Development Log

Index of all design documents, phase devlogs, architecture decisions, and planning artifacts.

## Strategy

High-level vision, specifications, and project direction.

| Document | Description |
|----------|-------------|
| [PLAN.md](strategy/PLAN.md) | Executive summary and full implementation plan |
| [ROADMAP.md](strategy/ROADMAP.md) | Post-1.0 roadmap: Genomics, Imaging, HEOR |
| [SPECS.md](strategy/SPECS.md) | Technical specifications — stack, architecture, API surface |
| [DESIGNLOG.md](strategy/DESIGNLOG.md) | Frontend design system and component library |
| [SDLC-plan.md](strategy/SDLC-plan.md) | Continuous development lifecycle plan |

## Phase Devlogs

Chronological build record — one file per phase shipped.

| Phase | Title | Status |
|-------|-------|--------|
| [01](phases/01-foundation.md) | Foundation | Complete |
| [02](phases/02-database-omop.md) | Database & OMOP | Complete |
| [03](phases/03-ingestion.md) | AI-Powered Data Ingestion | Complete |
| [04](phases/04-data-quality.md) | Data Quality & Characterization | Complete |
| [05](phases/05-research-workbench.md) | Research Workbench | Complete |
| [06](phases/06-auth-admin.md) | Auth & Multi-Tenancy | Complete |
| [07](phases/07-frontend-ux-polish.md) | Frontend UX Polish | Complete |
| [08](phases/08-testing.md) | Testing | Foundation complete |
| **09** | **Documentation & Compatibility** | |
| [9.2](phases/09-docs/9.2-import-export.md) | Import/Export Compatibility | Complete |
| [9.4](phases/09-docs/9.4-achilles-heel.md) | Achilles Heel Frontend | Complete |
| [9.5–9.6](phases/09-docs/9.5-9.6-webapi-compat.md) | WebAPI Compat & Legacy Redirects | Complete |
| [9.7](phases/09-docs/9.7-onboarding.md) | In-App Onboarding Overlay | Complete |
| [9.8](phases/09-docs/9.8-docusaurus.md) | Docusaurus User Manual | Complete |
| [9.9](phases/09-docs/9.9-migration-guide.md) | Migration Guide (Atlas → Parthenon) | Complete |
| [9.10](phases/09-docs/9.10-api-reference.md) | API Reference (Scramble + OpenAPI) | Complete |
| [9.11](phases/09-docs/9.11-docs-infrastructure.md) | Documentation Site Infrastructure | Complete |
| [9.12](phases/09-docs/9.12-in-app-help.md) | In-App Help System | Complete |
| [11](phases/11-analyses.md) | Parthenon-Native Analyses | Complete |
| [12](phases/12-admin-dashboard.md) | Admin Dashboard Expansion | Complete |
| [12.1](phases/12.1-setup-wizard.md) | Superuser Setup Wizard | Complete |
| [13](phases/13-data-wiring.md) | End-to-End Data Wiring | Complete |
| [14](phases/14-cdm-characterization.md) | CDM Source Characterization Dashboard | Complete |
| [14](phases/14-hades-integration.md) | HADES R Package Integration | Complete |
| [15](phases/15-clinvar.md) | ClinVar Integration | Shipped |
| [15](phases/15-genomics.md) | Molecular Diagnostics & Cancer Genomics | In progress |
| [16](phases/16-dicom-imaging.md) | DICOM & Medical Imaging | In progress |
| [16](phases/16-fhir-pipeline.md) | FHIR R4 Bulk Data Pipeline | Complete |
| [16](phases/16-vocabulary-mgmt.md) | Vocabulary Management (Admin) | Complete |
| [17](phases/17-heor.md) | Health Economics & Outcomes Research | In progress |

## Architecture

Technical decisions, database plans, and cross-cutting implementation details.

| Document | Description |
|----------|-------------|
| [authregime.md](architecture/authregime.md) | JWT registration & authentication system design |
| [care-gaps-etl-plan.md](architecture/care-gaps-etl-plan.md) | Care Gaps star schema & nightly ETL architecture |
| [db-landscape.md](architecture/db-landscape.md) | Database support landscape & roadmap |
| [db-worklist.md](architecture/db-worklist.md) | Database expansion worklist (Tier 1 & 2) |
| [docker-reliability-hardening.md](architecture/docker-reliability-hardening.md) | Docker reliability hardening |
| [ehr-omop-fhir-implementation-plan.md](architecture/ehr-omop-fhir-implementation-plan.md) | EHR-to-OMOP via FHIR R4 implementation plan |
| [e2e-patient-profile-fixes.md](architecture/e2e-patient-profile-fixes.md) | E2E test infrastructure & patient profile perf fix |

## Modules

Feature-area deep dives and standalone module documentation.

| Document | Description |
|----------|-------------|
| [STUDIES.md](modules/STUDIES.md) | Studies module design — federated outcomes research |
| [studies-module-s10-s13.md](modules/studies-module-s10-s13.md) | Studies phases S10–S13: Results, Logging, Advanced |
| [studies-ux-enhancements.md](modules/studies-ux-enhancements.md) | Studies UX enhancements devlog |
| [ohdsi-network-studies-catalog.md](modules/ohdsi-network-studies-catalog.md) | OHDSI network studies catalog (186 repos) |

## Process

Development lifecycle, testing playbooks, installer, and onboarding.

| Document | Description |
|----------|-------------|
| [SDLC-documentation.md](process/SDLC-documentation.md) | Documentation & testing playbook for shipping phases |
| [installer.md](process/installer.md) | Python installer with Rich TUI |
| [parthenon-onboarding-scripts/](process/parthenon-onboarding-scripts/) | Tutorial-style onboarding guides (10 docs) |

## Enhancement Plans (.docx)

Formal enhancement proposals for upcoming platform capabilities.

| Document | Description |
|----------|-------------|
| [DICOM Imaging](plans/Parthenon_DICOM_Imaging_Enhancement_Plan.docx) | Medical imaging enhancement plan |
| [Genomics](plans/Parthenon_Genomics_Enhancement_Plan.docx) | Genomics enhancement plan |
| [HEOR & Care Gaps](plans/Parthenon_HEOR_Care_Gap_Economics_Plan.docx) | Health economics & care gap economics plan |
