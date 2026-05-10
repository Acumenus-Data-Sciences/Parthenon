# Parthenon Roadmap

**A unified OHDSI outcomes research platform replacing Atlas, WebAPI, Achilles, DQD, and 15+ disconnected tools with a single application built on OMOP CDM v5.4.**

*Last updated: May 10, 2026*

---

## Where We Are

Parthenon v1.0.7 shipped on May 10, 2026, delivering the **AGPL-3.0-only relicense** and the **Community Edition / Enterprise Edition fork**. The platform today spans 39 feature modules, 97 API controllers, a Docker Compose topology that scales from a single workstation to a production cluster, and the eight CE/EE extension points required to plug an Enterprise overlay into a Community core without patching public files.

What follows is the plan from here to **v2.5** — the release where Parthenon is simultaneously the easiest-to-install OHDSI platform in the community **and** an enterprise-grade product Acumenus Data Sciences sells on-prem, on bare metal, on a VPS, and on every major cloud marketplace.

> **Editions.** Parthenon is distributed in two editions. **Community Edition** (this repository, AGPL-3.0-only) is the full research platform — all 39 feature modules, every clinical/research capability. **Enterprise Edition** (commercial license, separate private distribution) adds enterprise infrastructure: Keycloak SSO with SAML/SCIM, multi-tenancy, FIPS-validated crypto, signed audit log retention, observability shippers (Datadog/Splunk/OTel), Kubernetes operator, and Acumenus support. EE is distributed from the private [`Acumenus-Data-Sciences/Parthenon-EE`](https://github.com/Acumenus-Data-Sciences/Parthenon-EE) repository — source available to licensed Enterprise customers only. Contact `licensing@acumenus.net` for Enterprise inquiries.
>
> **CE/EE plumbing landed in v1.0.7.** All eight extension points (AuthDriver, TenantResolver, CryptoProvider, AuditSink, ObservabilityShipper, frontend `featureFlags` + `EnterpriseGate`, Acropolis installer phase registry, compose composition contract) are documented at [`docs/architecture/extension-points.md`](docs/architecture/extension-points.md). Every CE deployment continues to use its default implementation; EE plugs alternate drivers in via these seams.

---

## Release Philosophy

The path from v1.0.7 to v2.5 is organized as two arcs:

| Arc | Versions | Focus |
|---|---|---|
| **Arc I — Feature Maturation** | v1.0.8 → v1.5 | Close the stabilization tail, then add federation, advanced AI, regulatory-grade evidence, deeper analytics, and an ecosystem plugin architecture. |
| **Arc II — Distribution Convergence** | v2.0 → v2.5 | Take the matured platform from "self-hosted by experts" to "installable in five different ways on every major target environment." |

Arc I continues the current release philosophy: focused minors with clear themes. Arc II is structured as **three phases** — Foundations, Channel Ramp, Convergence GA — because v2.5 is fundamentally a distribution problem, not a feature problem.

The two arcs overlap: v2.0 foundation work begins in parallel with v1.3 / v1.4 / v1.5 feature work so the convergence release lands by Q2 2027.

---

## Arc I — Feature Maturation (v1.0.8 → v1.5)

### v1.0.8 — Documentation & Onboarding

*Target: June 2026*

A platform this large needs excellent documentation to be useful.

**User Manual (Docusaurus):**
- Complete all 14 parts of the user manual with screenshots, walkthroughs, and clinical examples.
- "Your first cohort in 5 minutes" quickstart using the Eunomia demo dataset.
- Document Abby AI capabilities with example prompts and workflows.
- Video-friendly step-by-step tutorials for the top 10 research workflows.

**Developer Documentation:**
- API reference auto-generated from OpenAPI with request/response examples.
- Architecture guide covering database schema, service patterns, and Docker topology.
- Contributing guide with local setup, testing conventions, and PR workflow.
- Document all Artisan commands and their use cases.

**In-App Help:**
- Expand the help module with contextual guides per feature.
- Improve the SetupWizard onboarding flow for new super-admin users.
- Guided tours (react-joyride) for cohort building, vocabulary exploration, and analysis setup.

**Arc II handoff.** Documentation completeness is a v2.1 CE One-Click release-gate dependency — a one-click installer is only useful if the first-run experience is documented end to end.

---

### v1.0.9 — Security Audit & Hardening

*Target: July 2026*

HIGHSEC is established. This release validates it end to end.

**Authentication & Authorization:**
- Penetration test all 97 API controllers for auth bypass, privilege escalation, and IDOR.
- Validate the Sanctum token lifecycle: creation, expiration (8hr), revocation, refresh.
- Audit every route in `api.php` against the three-layer security model (auth → permission → ownership).
- Confirm RBAC role hierarchy enforcement (viewers cannot escalate, researchers cannot admin).

**Data Protection:**
- Validate that no unauthenticated route exposes PHI, PII, or clinical data.
- Audit Abby AI's `interrogation` connection for read-only enforcement.
- Review shared cohort link token generation for cryptographic randomness and time-bounding.
- Confirm CdmModel read-only enforcement on clinical tables.

**Infrastructure:**
- Verify all Docker containers run as non-root users.
- Audit secret file permissions (`.env`, `.resendapikey` at chmod 600).
- Confirm Redis, Orthanc, and Grafana authentication is enforced.
- Scan Docker images for known CVEs.
- Review network segmentation between containers.

**Compliance:**
- Document HIPAA technical safeguards.
- Generate a security controls matrix mapping HIGHSEC rules to implementation evidence.
- Prepare for third-party security review.

**Arc II handoff.** A third-party security review report is a prerequisite for EE customer pilots and for AWS / Azure / GCP marketplace listings. v1.0.9 produces that artifact.

---

### v1.0.10 — Release Candidate

*Target: late July 2026*

The final v1.0.x release. Everything that made it through stabilization ships here as a polished, validated whole.

- Full end-to-end regression suite: every research workflow exercised against every CDM source.
- Load testing simulating concurrent researchers running cohorts, analyses, and vocabulary queries.
- Chaos testing verifying graceful degradation when Solr, Redis, R runtime, or AI service are unavailable.
- Cross-source validation of Achilles/DQD results across Acumenus, SynPUF, IRSF, Pancreas, Morpheus.
- Fresh-install validation of `install.py` on a clean Ubuntu 22.04 box.
- `install.py --with-infrastructure` validation for the full Acropolis stack.
- `deploy.sh` validation across all modes (full, PHP-only, frontend-only, DB-only).
- Tagged release with comprehensive changelog (v1.0.3 → v1.0.10).

**Arc II handoff.** Stabilization closes here. From v1.1 forward, every feature release must keep the v1.0.10 release-gate criteria green.

---

### v1.1 — Federation & Multi-Site Studies

*Target: August 2026*

The Studies module gets real multi-site orchestration. Researchers design a study protocol, distribute it to participating sites, and collect results without sharing patient-level data.

- Federated study execution engine — define once, run everywhere.
- Site enrollment and approval workflow with audit trail.
- Distributed cohort counting (aggregate counts only, no PHI transfer).
- Result aggregation with heterogeneity analysis.
- Arachne DataNode integration for OHDSI network studies.
- Strategus large-scale analytics orchestration across federated sites.

**Identity & SSO.** Authentik 2026.x remains the SSO provider for Acropolis throughout v1.1. A detailed Keycloak migration plan is authored as a pre-v1.2 deliverable so v1.2 executes cleanly.

**Arc II handoff.** Multi-tenant primitives (tenant-aware Eloquent scopes, tenant ID columns added as nullable in v1.0.7) get exercised in CE during v1.1 federation work. EE multi-tenant routing in v2.0+ rides on a primitives layer that has already been load-tested.

---

### v1.2 — Advanced AI & Enterprise Identity

*Target: October / November 2026*

v1.2 runs two parallel workstreams: evolving Abby from assistant to research co-pilot, and migrating the Acropolis SSO gateway from Authentik to Keycloak in preparation for the v2.0 Enterprise edition.

**Advanced AI & Natural Language Research (Abby co-pilot):**
- MedGemma model fine-tuning on OHDSI-specific research patterns.
- Multi-turn research conversations with persistent context and memory.
- Natural language cohort definition: *"Patients with Type 2 diabetes who had an A1C above 9 in the last year."*
- AI-powered data quality recommendations based on DQD results.
- Automated concept mapping suggestions with confidence scoring.
- Study protocol generation from natural language descriptions.

**Acropolis SSO migration: Authentik → Keycloak.**

The Enterprise edition of Parthenon (v2.0+) requires FIPS 140-2 validated crypto, multi-vendor CNCF governance, a real LTS support window, and a first-class Kubernetes operator story — none of which Authentik offers in its open-source tier. Keycloak (CNCF Incubating, Red Hat Build of Keycloak LTS) is the required path. v1.2 performs the switchover so the Enterprise edition can ship on a hardened identity foundation.

Pre-v1.2 deliverable — **detailed implementation plan** covering: Keycloak Operator vs `codecentric/keycloakx` Helm chart selection; realm and client schema design; migration of all 7 Acropolis forward-auth services (Grafana, Superset, DataHub, pgAdmin, Portainer, n8n, Wazuh) to `oauth2-proxy` sidecars with per-service Traefik middleware; rewrite of the 1,008-line `acropolis/installer/authentik.py` as `keycloak.py` against the Keycloak Admin REST API and `terraform-provider-keycloak`; user/group export from Authentik with forced password reset; Wazuh/OpenSearch SAML metadata re-minting; staged cutover runbook with rollback plan; smoke test coverage; devlog and docs rewrites.

v1.2 execution scope:

- Deploy Keycloak 26.x via the official Keycloak Operator (K8s) or `codecentric/keycloakx` (Compose) behind Traefik at `auth.acumenus.net`.
- Stand up `oauth2-proxy` sidecars for all forward-auth-gated services; replace `authentik@docker` middleware with per-service `oauth2-proxy@docker` middleware in Traefik labels.
- Rewrite `acropolis/installer/keycloak.py` (replacing `authentik.py`) with automated provisioning of realms, clients, scopes, protocol mappers, roles, and groups via KC Admin REST + Terraform provider.
- Reconfigure native OIDC for Grafana, Superset, DataHub, pgAdmin, Portainer.
- Re-mint Wazuh/OpenSearch SAML metadata from Keycloak.
- Export Authentik users and groups; import into Keycloak with forced password reset on first login.
- Enable FIPS 140-2 mode using the BouncyCastle FIPS provider (free in RHBK upstream).
- Update `docker-compose.enterprise.yml`, `.env.example`, `acropolis/k8s/helm/acropolis/`, smoke tests, and all Authentik-referencing devlogs.
- Decommission Authentik containers (`authentik-server`, `authentik-worker`, `authentik-db`, `authentik-redis`) and archive the DB backup.
- Parallel-run Authentik and Keycloak during cutover with a documented rollback window; retire Authentik only after smoke tests pass.

**Arc II handoff.** Keycloak is the EE identity foundation for v2.0 and beyond. v1.2 must close cleanly before v2.0 ships.

---

### v1.3 — Real-World Evidence & Regulatory

*Target: January 2027*

Expand the platform's utility for regulatory-grade evidence generation.

- CER (Comparative Effectiveness Research) workflow templates.
- CONSORT and STROBE reporting automation.
- Study pre-registration integration.
- Evidence synthesis with network meta-analysis visualization.
- Automated study report generation (publication-ready manuscripts).
- FDA REMS and post-market surveillance dashboards.

**Arc II handoff.** "Regulatory-grade evidence" is a load-bearing claim in marketplace listing copy. v1.3 produces the workflows that back the claim.

---

### v1.4 — Advanced Analytics & Visualization

*Target: February 2027*

Deepen the analytical capabilities and make results more actionable.

- Interactive Kaplan-Meier and forest plot builders.
- Advanced patient pathway visualization with Sankey diagrams.
- Temporal pattern mining across CDM domains.
- Genomic-clinical correlation dashboards (radiogenomics expansion).
- GIS Explorer: spatial clustering, hotspot detection, catchment area analysis.
- Custom dashboard builder for institutional KPIs.

**Arc II handoff.** The visualizations introduced here become the marketplace demo workflows in v2.3 / v2.4.

---

### v1.5 — Ecosystem & Interoperability

*Target: late February 2027*

Make Parthenon a good citizen in the broader healthcare data ecosystem.

- OMOP CDM v5.5 support (when released by OHDSI).
- Bulk FHIR export/import for EHR integration.
- REDCap integration for clinical trial data capture.
- i2b2 / tranSMART data source connectivity.
- HL7 CDS Hooks for clinical decision support at the point of care.
- Open plugin architecture for community-developed modules.

**Arc II handoff.** The plugin architecture validated here is the long-term home for EE-only drivers — Phase 2 extension points get one more level of formalization so third parties can ship EE-compatible plugins without CE bleed.

---

## Arc II — Distribution Convergence (v2.0 → v2.5)

Arc II is a distribution problem, not a feature problem. Same Parthenon, five+ install paths, one license model, one parity matrix at the end.

### Phase 1 — Foundations (v2.0)

*Target: Q4 2026 / Q1 2027*

The platform-level release every distribution channel later depends on. v2.0 lands the **runtime artifacts**, **identity foundation**, and **packaging groundwork** that v2.1–v2.5 ride on. Foundation work begins in parallel with v1.3 / v1.4 so the channel ramp can start as soon as the v1.x feature arc closes.

**Signed multi-arch images:**
- Publish official multi-arch images (`linux/amd64` + `linux/arm64`) on GHCR and Docker Hub for both CE and EE.
- Cosign signatures on every published image; verification documented in `docs/security/image-signing.md`.
- CycloneDX SBOMs published alongside each image.
- Trivy CVE scans gating the release pipeline.

**Helm chart and Kustomize overlays GA:**
- `oci://ghcr.io/acumenus-data-sciences/charts/parthenon` published from `acropolis/k8s/helm/parthenon/`.
- `community` and `enterprise` values overlays.
- Kustomize overlays under `acropolis/k8s/kustomize/{base,community,enterprise}` for K8s-savvy operators who prefer Kustomize.
- Tested on `kind`, `k3d`, EKS, AKS, and GKE.

**License server (EE only):**
- Standalone service at `license.acumenus.net` issuing signed JWT entitlements (Ed25519 or ECDSA P-256).
- EE driver validates the JWT on boot and on a refresh schedule.
- Air-gap mode: offline-signed license blob accepted as a fallback.
- Revocation supported via short-lived refresh tokens (revoked JWTs reach EE instances within 24h).
- Public protocol spec in `docs/enterprise/license-server.md`; signing keys live in Acumenus KMS.

**Packaging refactor groundwork (subtree → package migration):**
- Backend extracts a `parthenon-core` Composer package.
- Frontend extracts an `@parthenon/ui` workspace.
- AI service extracts a `parthenon-ai` Python package.
- R runtime extracts a `parthenon.r` package.
- Subtree remains the EE consumption model through v2.5 — the actual swap to package dependencies lands at v2.5. v2.0 puts the packages on registries with proper SemVer and CI release flow so v2.5 is incremental, not a big-bang.

**Workstation Edition (CE):**
- Single-binary Rust launcher graduates from experimental to GA.
- Mac (Apple Silicon + Intel), Windows (x64), Linux (`.deb` + `.rpm`).
- Embedded Postgres and Redis (no Docker Desktop dependency for the no-clinical-data workstation profile).
- Bundled Eunomia demo data.
- Auto-update channel.

**OpenAPI and SDK strategy:**
- Published TypeScript and Python SDKs auto-generated from the OpenAPI spec.
- Becomes the documented integration surface for marketplace customers in v2.3+.

**v2.0 release gate.** Helm chart installs cleanly on `kind`, `k3d`, EKS, AKS, and GKE. Workstation launcher runs on a Mac without Docker Desktop pre-installed. Signed image set passes Cosign verification. License server issues, refreshes, and revokes JWTs end to end.

---

### Phase 2 — Channel Ramp (v2.1 → v2.4)

One distribution channel per minor. Each release in this phase follows the same template — *target user / install path / license model / support tier / release gate* — so the parity matrix at v2.5 has a structurally identical row per channel.

---

### v2.1 — Community Edition One-Click

*Target: Q1 2027*

- **Target user:** OHDSI researcher on a laptop or a small lab server.
- **Install path:**
  - Linux: `curl -fsSL https://parthenon.acumenus.net/install.sh | sh`
  - macOS: signed `.dmg` from `parthenon.acumenus.net/download`
  - Windows: signed `.exe` from `parthenon.acumenus.net/download`
- **License:** CE / AGPL-3.0-only.
- **Support:** Community (GitHub issues, OHDSI forums).

**Scope:**

- Polish the v2.0 Workstation launcher and the docker-compose path so both reach a logged-in dashboard with Eunomia loaded out of the box.
- In-product update channel (signed updates via the same Cosign chain as v2.0 images).
- Automated demo data load (Eunomia + GiBleed + optional SynPUF subset).
- Guided tour (react-joyride) covering cohort building, vocabulary exploration, and analysis setup.
- `parthenon doctor --fix` for first-run diagnostics — extends the existing `installer/diagnostics.py` surface.
- First-run setup wizard: registers the super-admin, seeds source connections, accepts a UMLS API key, and offers an optional Hecate bootstrap.
- "Try Parthenon online" link from `parthenon.acumenus.net` pointing to a hosted demo instance (run by Acumenus on a small VM, not a SaaS).

**Release gate.** A clean Ubuntu 22.04 / macOS 14 / Windows 11 machine completes install and reaches a logged-in dashboard with Eunomia loaded in **under 15 minutes**.

---

### v2.2 — Enterprise Edition On-Prem (Docker Compose on bare metal + VPS)

*Target: late Q1 2027*

- **Target user:** Hospital IT, healthcare CIO office, contracted Acumenus EE customer running on owned servers or VPS.
- **Install path:** `curl -fsSL https://parthenon.acumenus.net/ee-install.sh | sh -- --license-key=…`. Ansible-backed bootstrap under the hood.
- **License:** EE / BYOL JWT issued by `license.acumenus.net`.
- **Support:** Standard SLA (business-hours response, 24h initial acknowledgment).

**Scope.** Docker Compose-only on bare metal and VPS — no Kubernetes on-prem in this release. The same compose stack used in CE workstation deployments, wrapped by an installer that handles the on-prem realities:

- Hardened systemd unit wrappers for the compose stack (start on boot, restart on failure, journald integration).
- Automated certbot / Let's Encrypt for customer FQDN.
- Opinionated UFW / firewalld rules with documented overrides.
- Optional WireGuard mesh for multi-host EE deployments.
- FIPS-mode toggle invoking the `FipsCryptoProvider`.
- Keycloak as the identity foundation (Authentik fully retired in EE per v1.2).
- Signed-audit-log retention with WORM-style storage (S3-compatible target or local filesystem with append-only ACLs).
- Datadog / Splunk / OpenTelemetry observability shipper enabled by default for EE deployments.

**Tested target environments:**
- Bare-metal: Ubuntu 22.04 LTS, Debian 12, RHEL 9 (via OL9 surrogate in CI).
- VPS providers: DigitalOcean, Hetzner Cloud, Linode, OVH.

**Release gate.** A clean Hetzner CCX33 or DigitalOcean 8-vCPU droplet runs the install script and reaches a working EE stack (Keycloak SSO + multi-tenant routing + signed audit + Datadog/OTel shipper online) **in under 30 minutes** with no manual intervention beyond the license key and FQDN.

---

### v2.3 — AWS Marketplace BYOL

*Target: early Q2 2027*

- **Target user:** AWS-native EE customer.
- **Install paths:**
  - AMI-based EC2 launch via CloudFormation Quick Launch in AWS Marketplace.
  - Kubernetes app (Helm chart) via AWS Marketplace for EKS.
- **License:** EE / BYOL (customer supplies license JWT during launch).
- **Support:** Standard SLA.

**Scope.**

- IAM least-privilege bootstrap — no admin keys baked into images; instance roles only.
- Optional Amazon RDS Postgres (schema isolation preserved across all CDM connections).
- Optional S3 for medical images, genomic VCFs, and study artifacts.
- KMS-backed `FipsCryptoProvider` variant (AWS KMS as the FIPS module).
- CloudWatch log shipper variant of `ObservabilityShipper` (in addition to Datadog/Splunk/OTel which already work).
- Marketplace deliverables: listing copy, screenshots, validation video, product code + SKU registered, private offer flow for direct EE customers, AWS technical validation passed.

**Release gate.** Marketplace listing live. Quick Launch works in `us-east-1`, `us-west-2`, `eu-west-1`. End-to-end EE feature parity with v2.2 on-prem.

---

### v2.4 — Azure + GCP Marketplaces BYOL

*Target: mid Q2 2027*

- **Target user:** Azure-native or GCP-native EE customer.
- **Install paths:**
  - Azure Marketplace VM image and AKS Kubernetes app.
  - GCP Marketplace VM image and GKE Kubernetes app.
- **License:** EE / BYOL.
- **Support:** Standard SLA.

**Scope (Azure):**
- Azure Database for PostgreSQL (Flexible Server) as the managed Postgres option.
- Azure Blob storage for objects.
- Azure Key Vault as the FIPS module for `FipsCryptoProvider`.
- Azure Monitor shipper variant of `ObservabilityShipper`.

**Scope (GCP):**
- Cloud SQL for Postgres as the managed option.
- Google Cloud Storage for objects.
- Cloud KMS as the FIPS module.
- Cloud Logging shipper variant.

**Code organization.** A single source of Terraform modules under `acropolis/cloud/{aws,azure,gcp}/`. Per-cloud variations are thin wrappers around the same shared input variables (FQDN, license key, source DB choice, observability sink choice). The same EE license JWT issued by `license.acumenus.net` works unchanged across AWS, Azure, and GCP.

**Release gate.** Both Azure and GCP marketplace listings live. A single EE license JWT works unchanged across AWS, Azure, and GCP deployments. The channel parity matrix shows zero exceptions vs. v2.2 / v2.3.

---

### Phase 3 — Convergence GA (v2.5)

*Target: Q2 2027*

v2.5 is the version where everything that exists across the five+ install paths is **the same Parthenon**. Three deliverables, then ship.

**1. Channel parity matrix.**

A published table comparing every CE/EE feature against every install path:

| Feature | Workstation (CE) | Compose on-prem (EE) | Bare-metal/VPS (EE) | AWS (EE) | Azure (EE) | GCP (EE) |
|---|---|---|---|---|---|---|
| (one row per major feature) | … | … | … | … | … | … |

Target is 100% parity across paths. Any cell below 100% is a publicly documented exception with a GitHub issue link and a target version for closure (typically v2.6 or v3.0).

**2. Packaging refactor lands.**

The CE/EE design spec's deferred Approach C executes here:

- Swap the EE repo's `parthenon/` subtree for proper package dependencies.
- EE `composer.json` pulls `parthenon-core` from Packagist (or a private Composer registry for Acumenus-managed dependencies).
- EE `package.json` pulls `@parthenon/ui` from npm.
- EE Python imports `parthenon-ai` from PyPI.
- CI builds reproducibly from pinned package versions.
- Subtree tooling stays as a backwards-compat path through v2.6, then retires.

The migration is incremental, not big-bang — the v2.0 foundation work already published the packages; v2.5 just flips EE consumption from subtree to package dependency.

**3. Support readiness.**

- Tiered SLAs: **Community** (best-effort, public channels), **Standard** (business-hours, 24h initial response), **Premier** (24×7, 1h initial response).
- Runbook library covering each install path under `docs/enterprise/runbooks/` (private) and `docs/community/runbooks/` (public).
- Paid-support portal handoff to a real ticketing system (HubSpot Service / Zendesk / equivalent).
- On-call rotation skeleton for the EE team.
- Public status page at `status.parthenon.io` covering the license server, the `parthenon.acumenus.net` install endpoints, the GHCR/Docker Hub image registries, and any Acumenus-managed demo instance.
- Opt-in telemetry phone-home shipping minimal install-success/failure signal back to Acumenus.

**v2.5 release gate (the five-demo test).** An Acumenus team member can demonstrate, live, in a single sitting:

1. A researcher on a fresh Mac runs `curl https://parthenon.acumenus.net/install.sh | sh` and reaches a logged-in dashboard with Eunomia loaded in under 15 minutes.
2. A customer admin on a fresh Hetzner VPS runs the EE installer with a license key and reaches a working EE stack in under 30 minutes.
3. The same EE license JWT launches a working EE deployment from the AWS, Azure, and GCP marketplaces with no changes.
4. The published channel parity matrix shows 100% feature parity (or a public exception list with target close versions).
5. A Standard-tier customer opens a ticket via the support portal and receives an acknowledgment within the documented SLA.

---

## Post-v2.5 Horizon — v3.0 SaaS

Named explicitly so v2.5 does not absorb it.

v3.0 introduces an **Acumenus-hosted SaaS** offering on one or more clouds with marketplace billing integration. SaaS demands operational maturity (24×7 SRE, multi-tenant billing, customer model isolation, hosted Abby AI with managed fine-tuning, etc.) that BYOL does not. v3.0 will be planned after v2.5 ships and the BYOL operating experience has informed the SaaS design.

---

## Cross-Cutting Concerns

### CI parity

- CE PRs continue to pass with no EE present — true today, must remain true.
- EE PRs run a combined CE+EE test suite. `sync-from-ce.sh` drives subtree refresh through v2.4; `verify-no-ce-patches.sh` is enforced as a pre-commit hook and CI gate.
- v2.5 adds a new gate: CE package versions published to public registries must build green before EE consumes them.

### Image signing pipeline

A single Cosign-signing pipeline drives every published image (CE-only, EE-bundled, marketplace-bundled). Signing keys live in Acumenus KMS. Public verification documented in `docs/security/image-signing.md` (new in v2.0).

### License server reliability

The license server is a single dependency for every EE deployment. It is:

- Highly available — multi-region or active-passive.
- Air-gap supported — offline-signed license blob accepted as a fallback.
- Revocation-capable — revoked license JWTs reach EE instances within 24h.

Documented in `docs/enterprise/license-server.md` (new in v2.0).

### CLA and license drift

CLA Assistant remains load-bearing on the CE repo. Any contributor change re-triggers CLA acceptance. As the packaging refactor publishes packages to public registries (Packagist, npm, PyPI) in v2.0 and consumes them in v2.5, the same CLA terms cover those packages.

### Marketplace approval risk

AWS Marketplace technical validation takes **4–12 weeks**. Azure and GCP are comparable. This is the single largest schedule risk for v2.3 and v2.4. Mitigation: submit listings as soon as implementation is feature-complete, not after; expect at least one reject-and-resubmit cycle per cloud; budget approval lead time into the timeline.

---

## Timeline Summary

| Version | Target | Theme | Channel impact |
|---|---|---|---|
| v1.0.7 | 2026-05-10 (shipped) | AGPLv3 + CE/EE fork + extension points | Baseline. |
| v1.0.8 | 2026-06 | Documentation & Onboarding | Gates v2.1. |
| v1.0.9 | 2026-07 | Security Audit & Hardening | Unblocks EE pilots and marketplace listings. |
| v1.0.10 | 2026-07 late | Release Candidate | Stabilization closes. |
| v1.1 | 2026-08 | Federation & Multi-Site Studies | Multi-tenant primitives validated. |
| v1.2 | 2026-10 / 11 | Advanced AI + Keycloak SSO migration | EE identity foundation. |
| v1.3 | 2027-01 | RWE & Regulatory | Marketplace claims validated. |
| v1.4 | 2027-02 | Advanced Analytics & Visualization | Marketplace demo workflows. |
| v1.5 | 2027-02 late | Ecosystem & Interoperability | Plugin architecture for EE drivers. |
| **v2.0** | **2026-Q4 / 2027-Q1** | **Foundations** | Signed images, Helm GA, license server, workstation Edition GA, packaging groundwork. |
| **v2.1** | **2027-Q1** | **CE One-Click** | Channel 1 lights up. |
| **v2.2** | **2027-Q1 late** | **EE On-Prem (compose on bare-metal + VPS)** | Channel 2 lights up. |
| **v2.3** | **2027-Q2 early** | **AWS Marketplace BYOL** | Channel 3 lights up. |
| **v2.4** | **2027-Q2 mid** | **Azure + GCP Marketplaces BYOL** | Channels 4 + 5 light up. |
| **v2.5** | **2027-Q2** | **Convergence GA** | All channels converge; packaging refactor lands; support readiness. |
| v3.0 | post-v2.5 | Acumenus-hosted SaaS | New business model. |

Arc I and Arc II overlap. v2.0 foundation work begins during v1.3 / v1.4 / v1.5 so the channel ramp can start as soon as v1.5 closes.

---

## How to Contribute

Parthenon is an open platform built for the research community. Whether you're a clinical researcher, data engineer, frontend developer, or OHDSI veteran, there is meaningful work in every phase of this roadmap.

- **Report bugs** — file issues on GitHub with reproduction steps.
- **Write tests** — Arc I stabilization closes here; every minor still needs more coverage.
- **Improve documentation** — v1.0.8 and v2.1 both depend on documentation that researchers can follow without help.
- **Build plugins** — the v1.5 plugin architecture welcomes community modules and EE-compatible drivers.
- **Try the install paths** — v2.1 onward, every channel needs install-success feedback from real environments.
- **Join the conversation** — OHDSI Forums, GitHub Discussions, OHDSI Symposium.

---

*Parthenon is built by [Acumenus](https://acumenus.net) for the OHDSI community.*
