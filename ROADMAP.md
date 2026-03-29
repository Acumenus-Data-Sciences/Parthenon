# Parthenon Roadmap

**A unified OHDSI outcomes research platform replacing Atlas, WebAPI, Achilles, DQD, and 15+ disconnected tools with a single application built on OMOP CDM v5.4.**

*Last updated: March 29, 2026*

---

## Where We Are

Parthenon v1.0.3 launches on March 30, 2026. The platform today spans 39 feature modules, 97 API controllers, 47 Docker services, and 11 Solr search indices — all wired into a single PostgreSQL database with schema-isolated OMOP CDM instances. It serves clinical researchers, data engineers, and healthcare organizations running population-level studies.

What follows is our plan to harden, optimize, and evolve Parthenon from a working platform into a production-grade, cloud-deployable research operating system.

---

## Release Philosophy

Parthenon follows semantic versioning with a deliberate stabilization arc:

| Phase | Versions | Focus |
|-------|----------|-------|
| **Stabilization** | v1.0.3 – v1.0.10 | Testing, debugging, optimization, polish |
| **Feature Maturation** | v1.1 – v1.x | New capabilities, integrations, federation |
| **General Availability** | v2.0 | Cloud + workstation deployment, enterprise-ready |

The v1.0.x series is a six-week sprint dedicated entirely to quality. No new features — only refinement of what exists. Each release has a clear theme and ships on a roughly weekly cadence.

---

## v1.0.x — The Stabilization Arc

*Timeline: March 30 – May 11, 2026 (~6 weeks)*

### v1.0.3 — Foundation Release *(March 30, 2026)*

The public starting point. Everything that has been built ships as-is, establishing the baseline for the stabilization work ahead.

**What ships:**

- Full OHDSI research lifecycle: vocabulary exploration, cohort design, characterization, estimation, prediction, SCCS, pathways, incidence rates
- 5 CDM data sources (Acumenus, SynPUF, IRSF, Pancreas, Morpheus) + Eunomia demo dataset
- Abby AI assistant with concept mapping, text-to-SQL, and data interrogation
- GIS Explorer with social determinants, air quality, hospital networks, and comorbidity mapping
- Medical imaging viewer (OHIF/DICOM via Orthanc) and radiogenomics correlation
- Genomics module with VCF import, ClinVar sync, and variant analysis
- HEOR claims analysis and evidence synthesis
- FHIR R4 integration with CDM transformation pipeline
- Studies module with protocol management, multi-site coordination, and artifact tracking
- Commons collaborative workspace
- Population risk scores (v2 interface) with 20 validated instruments
- Standard PROs+ survey instrument library
- Phenotype library (1,100+ OHDSI definitions synced)
- Poseidon data lakehouse, Darkstar DBT framework, BlackRabbit PDF extraction
- Full monitoring stack (Prometheus, Grafana, Loki, cAdvisor)
- Docusaurus documentation site (14-part user manual)
- HIGHSEC security model: Spatie RBAC, Sanctum tokens, non-root Docker containers, schema isolation

---

### v1.0.4 — Test Coverage & CI Hardening

*Target: ~1 week after v1.0.3*

The platform has 74 PHP test files and 37 Playwright E2E specs, but zero frontend unit tests and thin coverage on several critical services. This release fills the gaps.

**Backend:**

- Expand Pest test suite to cover all 56 service namespaces, prioritizing Achilles, DQD, Cohort, and Analysis services
- Add integration tests for all 8 database connections and their schema search paths
- Test RBAC permission enforcement on every route group (auth, research, admin, data pipeline)
- Add contract tests for the R runtime Plumber API and Python AI FastAPI service

**Frontend:**

- Stand up Vitest test infrastructure with React Testing Library
- Unit tests for all Zustand stores (authStore, cohort stores, analysis stores)
- Component tests for critical workflows: cohort builder, concept set editor, analysis configuration
- Snapshot tests for dark clinical theme consistency

**E2E:**

- Expand Playwright suite to cover the full research lifecycle: login → cohort → analysis → results
- Add E2E coverage for GIS Explorer, imaging viewer, and genomics workflows
- Cross-browser validation (Chromium, Firefox, WebKit)

**CI/CD:**

- Pre-commit hook hardening — add ESLint and Vitest to the existing Pint/PHPStan/tsc checks
- GitHub Actions pipeline: lint → test → build → deploy gate
- Automated OpenAPI spec drift detection (generated types vs. actual API responses)

---

### v1.0.5 — Data Quality & Validation

*Target: ~2 weeks after v1.0.3*

With test infrastructure in place, this release focuses on data integrity across the platform.

**Achilles & DQD:**

- Audit all Achilles SQL templates for correct `{@cdmSchema}` / `{@vocabSchema}` substitution across all 5 CDM sources
- Validate DQD check execution against OHDSI conformance benchmarks
- Fix edge cases in results schema switching (per-source `results.*` schema routing)

**Vocabulary:**

- Validate Solr vocabulary index completeness against the `vocab.concept` table
- Fix concept search ranking for clinical synonyms and multi-word queries
- Audit concept hierarchy traversal in concept set resolution

**Ingestion & ETL:**

- End-to-end validation of WhiteRabbit scan → ETL mapping → CDM load pipeline
- Add checksums and row-count verification to all ingestion jobs
- Validate FHIR-to-CDM transformation fidelity for Condition, MedicationRequest, and Observation resources

**Database:**

- Audit all 210 migrations for idempotency and rollback safety
- Validate foreign key constraints across schema boundaries
- Add database-level CHECK constraints for OMOP CDM required fields

---

### v1.0.6 — Performance Optimization

*Target: ~3 weeks after v1.0.3*

The platform queries large OMOP datasets (SynPUF alone is 2.3M patients). This release makes it fast.

**Backend:**

- Profile and optimize the top 20 slowest API endpoints (Achilles results, cohort generation, vocabulary search)
- Add database query caching (Redis) for expensive vocabulary lookups and concept ancestor traversals
- Optimize Eloquent eager loading across all CdmModel queries — eliminate N+1 patterns
- Add database indexes for common Achilles join patterns and cohort inclusion queries
- Tune Laravel Horizon queue concurrency for analysis execution jobs

**Frontend:**

- Implement virtualized rendering for large data tables (TanStack Table + react-window) in Data Explorer, vocabulary results, and Achilles reports
- Add skeleton loading states and optimistic updates across all TanStack Query hooks
- Audit and optimize React re-render cycles in the cohort builder and concept set editor
- Lazy-load heavy feature modules (GIS, imaging, genomics) via React.lazy + Suspense

**Infrastructure:**

- Tune PostgreSQL configuration for OMOP workloads (work_mem, shared_buffers, effective_cache_size)
- Optimize Solr query performance across all 11 configsets — review analyzers, field types, and cache settings
- Profile Docker container resource allocation and set appropriate memory/CPU limits
- Optimize the Vite production build — code splitting, tree shaking, asset compression

---

### v1.0.7 — UX Polish & Accessibility

*Target: ~4 weeks after v1.0.3*

The dark clinical theme (#0E0E11 base, crimson, gold, teal) is established. This release polishes the experience.

**Navigation & Layout:**

- Audit and standardize navigation patterns across all 39 feature modules
- Ensure consistent breadcrumb trails, page titles, and back-navigation
- Standardize empty states, error boundaries, and loading indicators platform-wide
- Refine the MainLayout sidebar for discoverability — group modules by research phase

**Clinical Workflows:**

- Streamline the cohort definition → characterization → analysis → results flow
- Add contextual help tooltips and inline documentation links throughout the research workflow
- Improve the concept set builder drag-and-drop experience
- Polish the Abby AI chat interface — conversation history, suggested prompts, inline results

**Accessibility:**

- WCAG 2.1 AA audit across all feature modules
- Keyboard navigation for all interactive components (cohort builder, concept explorer, GIS map)
- Screen reader compatibility for data tables, charts (Recharts), and the OHIF imaging viewer
- Color contrast validation for the dark clinical theme

**Responsive Design:**

- Audit tablet and large-screen layouts for the research workspace
- Ensure all modals, drawers, and panels scale appropriately

---

### v1.0.8 — Documentation & Onboarding

*Target: ~4.5 weeks after v1.0.3*

A platform this large needs excellent documentation to be useful.

**User Manual (Docusaurus):**

- Complete all 14 parts of the user manual with screenshots, walkthroughs, and clinical examples
- Add a quickstart guide: "Your first cohort in 5 minutes" using the Eunomia demo dataset
- Document the Abby AI assistant capabilities with example prompts and workflows
- Add video-friendly step-by-step tutorials for the top 10 research workflows

**Developer Documentation:**

- API reference auto-generated from OpenAPI spec with request/response examples
- Architecture guide: database schema, service layer patterns, Docker topology
- Contributing guide with local development setup, testing conventions, and PR workflow
- Document all Artisan commands and their use cases

**In-App Help:**

- Expand the help module with contextual guides per feature
- Improve the SetupWizard onboarding flow for new super-admin users
- Add guided tours (react-joyride) for cohort building, vocabulary exploration, and analysis setup

---

### v1.0.9 — Security Audit & Hardening

*Target: ~5 weeks after v1.0.3*

HIGHSEC is established. This release validates it end-to-end.

**Authentication & Authorization:**

- Penetration test all 97 API controllers for auth bypass, privilege escalation, and IDOR
- Validate Sanctum token lifecycle: creation, expiration (8hr), revocation, and refresh
- Audit every route in `api.php` against the three-layer security model (auth → permission → ownership)
- Test RBAC role hierarchy: confirm viewers cannot escalate, researchers cannot admin

**Data Protection:**

- Validate that no unauthenticated route exposes PHI, PII, or clinical data
- Audit Abby AI's `interrogation` connection for read-only enforcement
- Review shared cohort link token generation for cryptographic randomness and time-bounding
- Validate that CdmModel enforces read-only access (no write operations on clinical tables)

**Infrastructure:**

- Verify all Docker containers run as non-root users
- Audit all secret file permissions (`.env`, `.resendapikey` at chmod 600)
- Validate Redis, Orthanc, and Grafana authentication is enforced
- Scan Docker images for known CVEs
- Review network segmentation between containers

**Compliance:**

- Document HIPAA technical safeguards implemented in Parthenon
- Generate a security controls matrix mapping HIGHSEC rules to implementation evidence
- Prepare for third-party security review

---

### v1.0.10 — Release Candidate

*Target: ~6 weeks after v1.0.3 (May 11, 2026)*

The final v1.0.x release. Everything that made it through stabilization ships here as a polished, validated whole.

**Integration Testing:**

- Full end-to-end regression suite: every research workflow exercised against every CDM source
- Load testing: simulate concurrent researchers running cohorts, analyses, and vocabulary queries
- Chaos testing: verify graceful degradation when individual services (Solr, Redis, R runtime, AI service) are unavailable
- Cross-source validation: confirm Achilles/DQD results consistency across Acumenus, SynPUF, IRSF, Pancreas, and Morpheus

**Installer & Deployment:**

- Validate `install.py` fresh installation on a clean Ubuntu 22.04 machine
- Test `install.py --with-infrastructure` for the full Acropolis stack
- Validate `deploy.sh` for all deployment modes (full, PHP-only, frontend-only, DB-only)
- Document minimum hardware requirements and recommended specifications

**Release Engineering:**

- Tag v1.0.10 as the stabilization milestone
- Generate comprehensive changelog (v1.0.3 → v1.0.10)
- Publish updated Docker images
- Community announcement and call for contributors

---

## v1.x — Feature Maturation

*Timeline: May 2026 – Q3 2026*

With a stable foundation, the v1.x series adds new capabilities and deepens existing ones. Each minor version introduces a focused set of features while maintaining backward compatibility.

### v1.1 — Federation & Multi-Site Studies

The Studies module gets real multi-site orchestration. Researchers can design a study protocol, distribute it to participating sites, and collect results without sharing patient-level data.

- Federated study execution engine — define once, run everywhere
- Site enrollment and approval workflow with audit trail
- Distributed cohort counting (aggregate counts only, no PHI transfer)
- Result aggregation with heterogeneity analysis
- Arachne DataNode integration for OHDSI network studies
- Strategus large-scale analytics orchestration across federated sites

### v1.2 — Advanced AI & Natural Language Research

Abby evolves from an assistant into a research co-pilot.

- MedGemma model fine-tuning on OHDSI-specific research patterns
- Multi-turn research conversations with persistent context and memory
- Natural language cohort definition: "Patients with Type 2 diabetes who had an A1C above 9 in the last year"
- AI-powered data quality recommendations based on DQD results
- Automated concept mapping suggestions with confidence scoring
- Study protocol generation from natural language descriptions

### v1.3 — Real-World Evidence & Regulatory

Expand the platform's utility for regulatory-grade evidence generation.

- CER (Comparative Effectiveness Research) workflow templates
- CONSORT and STROBE reporting automation
- Study pre-registration integration
- Evidence synthesis with network meta-analysis visualization
- Automated study report generation (publication-ready manuscripts)
- FDA REMS and post-market surveillance dashboards

### v1.4 — Advanced Analytics & Visualization

Deepen the analytical capabilities and make results more actionable.

- Interactive Kaplan-Meier and forest plot builders
- Advanced patient pathway visualization with Sankey diagrams
- Temporal pattern mining across CDM domains
- Genomic-clinical correlation dashboards (radiogenomics expansion)
- GIS Explorer: spatial clustering, hotspot detection, and catchment area analysis
- Custom dashboard builder for institutional KPIs

### v1.5 — Ecosystem & Interoperability

Make Parthenon a good citizen in the broader healthcare data ecosystem.

- OMOP CDM v5.5 support (when released by OHDSI)
- Bulk FHIR export/import for EHR integration
- REDCap integration for clinical trial data capture
- i2b2/tranSMART data source connectivity
- HL7 CDS Hooks for clinical decision support at the point of care
- Open plugin architecture for community-developed modules

---

## v2.0 — General Availability

*Target: Late 2026 / Early 2027*

Parthenon v2.0 is the production-grade, enterprise-ready release — deployable on cloud infrastructure and researcher workstations alike.

### Cloud-Native Deployment

- Kubernetes-native deployment with Helm charts and Kustomize overlays (building on Acropolis `k8s/`)
- One-click deployment on AWS, Azure, and GCP via Terraform modules
- Auto-scaling for compute-intensive workloads (cohort generation, analysis execution, AI inference)
- Managed PostgreSQL support (RDS, Cloud SQL, Azure Database) with schema isolation preserved
- S3/Blob/GCS object storage for medical images, genomic files, and study artifacts

### Workstation Edition

- Single-binary installer for macOS, Windows, and Linux
- Embedded PostgreSQL and Redis (no external dependencies)
- Local-first operation with optional cloud sync
- Pre-loaded Eunomia demo dataset for immediate exploration
- Minimal resource footprint: runs on a laptop with 16GB RAM

### Enterprise Features

- Multi-tenant architecture with organizational isolation
- SSO integration (SAML 2.0, OIDC) and LDAP directory sync
- Audit logging with tamper-evident storage
- Data governance workflows with approval chains
- SLA-grade monitoring, alerting, and incident response
- Professional support and training packages

### Community Edition

- Free and open-source, always
- Full research lifecycle — no artificial feature gates
- Community plugin marketplace
- OHDSI network participation out of the box
- Annual community release aligned with OHDSI Symposium

---

## How to Contribute

Parthenon is an open platform built for the research community. Whether you're a clinical researcher, data engineer, frontend developer, or OHDSI veteran, there's meaningful work to do.

- **Report bugs** — File issues on GitHub with reproduction steps
- **Write tests** — The v1.0.x stabilization arc needs test coverage everywhere
- **Improve documentation** — Every module needs better docs and clinical examples
- **Build plugins** — The v1.5 plugin architecture will welcome community modules
- **Join the conversation** — OHDSI Forums, GitHub Discussions

---

## Version History

| Version | Date | Milestone |
|---------|------|-----------|
| v1.0.3 | March 30, 2026 | Foundation Release — public launch |
| v1.0.4 | TBD | Test Coverage & CI Hardening |
| v1.0.5 | TBD | Data Quality & Validation |
| v1.0.6 | TBD | Performance Optimization |
| v1.0.7 | TBD | UX Polish & Accessibility |
| v1.0.8 | TBD | Documentation & Onboarding |
| v1.0.9 | TBD | Security Audit & Hardening |
| v1.0.10 | May 11, 2026 | Release Candidate — stabilization complete |
| v1.1 | TBD | Federation & Multi-Site Studies |
| v1.2 | TBD | Advanced AI & Natural Language Research |
| v1.3 | TBD | Real-World Evidence & Regulatory |
| v1.4 | TBD | Advanced Analytics & Visualization |
| v1.5 | TBD | Ecosystem & Interoperability |
| v2.0 | Late 2026 / Early 2027 | General Availability — Cloud + Workstation |

---

*Parthenon is built by [Acumenus](https://acumenus.net) for the OHDSI community.*
