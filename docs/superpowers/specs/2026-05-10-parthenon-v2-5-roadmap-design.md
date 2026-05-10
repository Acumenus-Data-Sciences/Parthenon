# Parthenon Roadmap to v2.5 — Design

**Status:** Draft for user review
**Date:** 2026-05-10
**Author:** Sanjay Udoshi (with Claude assistance)
**Decision owner:** Sanjay Udoshi (founder, Acumenus Data Sciences, Inc.)
**Companion deliverable:** `ROADMAP.md` (replaced as part of this work)

---

## 1. Goal

Author a new authoritative `ROADMAP.md` that takes Parthenon from its current shipped state (v1.0.7, 2026-05-10) to a **v2.5 convergence GA** where the platform is:

1. **Easily installable as Community Edition** — one-liner install, single-binary workstation app, docker-compose for self-hosters.
2. **Installable by Acumenus Data Sciences for Enterprise customers** on-prem as a dockerized application, on bare metal, or on a VPS (Hetzner / DigitalOcean / Linode / OVH class).
3. **Available on AWS, Azure, and GCP marketplaces** as customer-deployable BYOL listings (AMI/VM-image + Kubernetes app per cloud).

The roadmap covers a ~12-month aggressive arc from 2026-05 to 2027-Q2 and consolidates the v2.0 work already implied in the existing ROADMAP.md (Cloud-Native Deployment, Workstation Edition, Enterprise Features) into a phased, channel-by-channel ramp.

---

## 2. Decisions Locked

| Question | Decision |
|---|---|
| Document treatment | **Replace `ROADMAP.md` entirely** with a refreshed, rebaselined version that extends through v2.5. |
| Ramp model for distribution channels | **Channel-per-minor.** v2.0 = foundations; v2.1 = CE polish; v2.2 = EE on-prem; v2.3 = AWS BYOL; v2.4 = Azure + GCP BYOL; v2.5 = convergence GA. |
| Bare-metal / VPS architecture | **Docker Compose on bare metal/VPS (no K8s on-prem).** Same compose stack as the rest of CE/EE, wrapped by an Ansible/bash bootstrap. K8s remains the cloud-marketplace topology only. |
| Cloud marketplace business model | **BYOL first, SaaS follows.** v2.3 and v2.4 ship customer-deployed BYOL listings on each cloud. Acumenus-hosted SaaS is explicitly **post-v2.5** (v3.0 horizon). |
| v2.5 timing | **Aggressive — Q2 2027 (~12 months).** Requires v1.x feature work to overlap with v2.0 foundation prep. |
| SaaS in v2.5 | **Out of scope.** v2.5 ships BYOL on three clouds; SaaS preview is the v3.0 milestone. |
| Document structure | **Two-arc model.** Arc I = Feature Maturation (v1.0.8 → v1.5). Arc II = Distribution Convergence (v2.0 → v2.5) with three named phases (Foundations / Channel Ramp / Convergence GA). |

---

## 3. Current State (anchor for the rebaseline)

- **v1.0.7 shipped 2026-05-10** with AGPLv3 relicense and CE/EE fork architecture.
- **Phase 2 extension points (8 of 8) landed in v1.0.7** per `docs/architecture/extension-points.md` — AuthDriver, TenantResolver, CryptoProvider, AuditSink, ObservabilityShipper, frontend `featureFlags` + `EnterpriseGate`, Acropolis installer phase registry, compose composition contract.
- **Plan 04 (EE migration) partial.** Private `Acumenus-Data-Sciences/Parthenon-EE` repo is live with CE merged via `git subtree`; daily sync workflow runs. License module + MultiTenantResolver + Keycloak/SAML/SCIM/FIPS/SignedAudit/Datadog/Splunk/OTel drivers are scheduled against v1.2.
- **Installer surfaces today:**
  - `install.py` Python TUI + `--community` MVP + headless `--defaults-file` path.
  - `install.sh` source-bootstrap one-liner from `parthenon.acumenus.net`.
  - `installer/rust-gui/` Rust desktop launcher (in flight; not a release asset yet per packaging policy).
  - `installer/bundle_manifest.py` produces a verifiable bundle tarball published to GitHub Releases.
  - `acropolis/installer/` 9-phase Python TUI with discoverable phase registry (Plan 02 #7).
- **Compose surfaces today:** `docker-compose.yml` + `docker-compose.community.yml` (CE) + `acropolis/docker-compose.{base,community,enterprise,local}.yml` (infrastructure tiers). Composition contract verifier (`scripts/verify-compose-contract.py` per Plan 02 #8) checks CE-bundled enterprise overlays.
- **Cloud surface today:** `acropolis/k8s/` contains Helm chart skeletons and Kustomize overlays for the Enterprise tier; no published chart, no signed images, no marketplace listing.

---

## 4. The Two-Arc Structure

### Arc I — Feature Maturation (v1.0.8 → v1.5)

Continues the existing roadmap's intent. **Rebaselined**, not rewritten: v1.0.4 already shipped (2026-04-09), v1.0.5 / v1.0.6 / v1.0.7 collapsed into the platform that exists today, and v1.0.8 onward is the remaining tail of the stabilization arc.

Each minor version in Arc I is documented with:

1. **Theme** — one sentence.
2. **Scope** — bullet list of deliverables (compressed where the existing ROADMAP was over-detailed; preserved where the detail is load-bearing, e.g. v1.2 Keycloak migration).
3. **Arc II handoff** — explicit "what this unlocks for Distribution Convergence" line. This is new; it forces Arc I to feed Arc II.

| Version | Theme | Arc II handoff |
|---|---|---|
| v1.0.8 | Documentation & Onboarding | User manual completeness gates v2.1 CE polish. |
| v1.0.9 | Security Audit & Hardening | Third-party security review unblocks EE customer pilots and cloud marketplace listings. |
| v1.0.10 | Release Candidate | Closes stabilization; final preflight before feature work resumes. |
| v1.1 | Federation & Multi-Site Studies | Multi-tenant primitives validated in CE before EE adds tenant routing. |
| v1.2 | Advanced AI + **Keycloak SSO migration** | Keycloak in place across all Acropolis services → required for v2.0 EE identity foundation. |
| v1.3 | Real-World Evidence & Regulatory | Validates the "regulatory-grade" claim used in marketplace listings. |
| v1.4 | Advanced Analytics & Visualization | Establishes the visual stories used in marketplace demo workflows. |
| v1.5 | Ecosystem & Interoperability | Plugin architecture validated; enables third-party EE drivers without CE bleed. |

### Arc II — Distribution Convergence (v2.0 → v2.5)

Structured as three named phases.

#### Phase 1 — Foundations (v2.0, target Q4 2026 / Q1 2027)

The platform-level release every distribution channel later depends on.

- **Signed multi-arch images** — `linux/amd64` + `linux/arm64` on GHCR + Docker Hub; Cosign signatures; CycloneDX SBOMs; Trivy scan gates.
- **Helm chart GA** — `oci://ghcr.io/acumenus-data-sciences/charts/parthenon`. Promotes the current `acropolis/k8s/helm/` skeleton to a first-class deliverable with `community`/`enterprise` values overlays.
- **Kustomize overlays GA** — `acropolis/k8s/kustomize/{base,community,enterprise}` as the alternative to Helm for K8s-savvy operators.
- **License server (EE)** — `license.acumenus.net` issuing signed JWTs (Ed25519 / ECDSA P-256). EE driver validates on boot, refreshes on a schedule, and supports an air-gap mode (offline-signed license blob). Public protocol spec; private signing keys (Acumenus HSM/KMS).
- **Image signing approach (v2.0 launch):** Cosign **keyless OIDC signing** anchored to the GitHub Actions release workflow at `Acumenus-Data-Sciences/Parthenon`. The trust anchor is the immutable workflow source ref + the GitHub OIDC issuer — cryptographically equivalent to KMS-backed keys for the v2.0 launch posture without requiring Acumenus KMS provisioning lead time. **KMS-backed long-lived keys** are a documented follow-up (plan `05-01-followup-kms-keys`) once Acumenus KMS is operational; the migration is non-breaking because both signing modes can co-exist on a transition tag.
- **Packaging refactor groundwork (subtree → package migration)** — incremental, not big-bang. Backend extracts a `parthenon-core` Composer package; Frontend extracts `@parthenon/ui` workspace; AI extracts `parthenon-ai` PyPI package; R extracts a `parthenon.r` package. Subtree remains the EE consumption model through v2.5 — packaging refactor only lands at v2.5.
- **Workstation Edition (CE)** — Rust launcher graduates from experimental to GA: Mac (Apple Silicon + Intel), Windows (x64), Linux (deb/rpm). Embedded Postgres + Redis. Bundled Eunomia demo data. Auto-update channel.
- **OpenAPI + SDK strategy** — published TypeScript and Python SDKs generated from the OpenAPI spec, so v2.1+ marketplace launches don't ship undocumented APIs.

**v2.0 release gate.** Helm chart installs cleanly on `kind`, `k3d`, EKS, AKS, and GKE. Workstation launcher runs on a Mac without Docker Desktop pre-installed. Signed image set passes Cosign verification. License server issues, refreshes, and revokes JWTs end-to-end.

#### Phase 2 — Channel Ramp (v2.1 → v2.4)

One distribution channel per minor. Each minor section in the roadmap follows the same template:

- **Target user.** Who installs this.
- **Install command / path.** The literal one-liner or marketplace flow.
- **License model.** CE (AGPLv3) vs EE (BYOL JWT).
- **Support tier.** Community / Standard / Premier.
- **Release gate.** Concrete, testable definition of "done".

##### v2.1 — CE One-Click (target Q1 2027)

- **Target user:** OHDSI researcher on a laptop or a small lab server.
- **Install path:** `curl -fsSL https://parthenon.acumenus.net/install.sh | sh` on Linux; `.dmg` on macOS; `.exe` on Windows.
- **License:** CE / AGPL-3.0-only.
- **Support:** Community (GitHub issues, OHDSI forums).
- **Scope:** Polish the v2.0 workstation launcher and the docker-compose path. Adds in-product update channel, automated demo data load (Eunomia + GiBleed + optional SynPUF subset), guided tour (react-joyride), `parthenon doctor --fix` for diagnostics, and a first-run setup wizard that registers the super-admin and seeds source connections.
- **Release gate:** A clean Ubuntu 22.04 / macOS 14 / Windows 11 machine completes install and reaches a logged-in dashboard with Eunomia loaded in **under 15 minutes**.

##### v2.2 — EE On-Prem (target Q1 2027 late)

- **Target user:** Hospital IT, healthcare CIO office, contracted Acumenus EE customer running on owned servers or VPS.
- **Install path:** `curl -fsSL https://parthenon.acumenus.net/ee-install.sh | sh -- --license-key=…`. Ansible-backed bootstrap under the hood.
- **License:** EE (BYOL JWT issued by `license.acumenus.net`).
- **Support:** Standard SLA (business-hours response).
- **Scope:** Docker Compose-only on bare metal and VPS (no K8s on-prem per decision). Includes hardened systemd unit wrappers for the compose stack, automated certbot/Let's Encrypt for `*.acumenus.net` style subdomains or customer-provided FQDN, opinionated UFW/firewalld rules, optional WireGuard mesh for multi-host EE deployments, the FIPS-mode toggle invoking the `FipsCryptoProvider`, and Keycloak as the identity foundation (Authentik retired in EE).
- **Tested target environments:** Bare-metal Ubuntu 22.04 LTS, Debian 12; VPS providers DigitalOcean, Hetzner, Linode, OVH.
- **Release gate:** A clean Hetzner CCX33 / DO 8-vCPU droplet runs the install script and reaches a working EE stack (Keycloak SSO + multi-tenant routing + signed audit + Datadog/OTel shipper online) **in under 30 minutes**.

##### v2.3 — AWS Marketplace BYOL (target Q2 2027 early)

- **Target user:** AWS-native EE customer.
- **Install paths:** AWS Marketplace listing publishes (a) an AMI-based EC2 Quick Launch via CloudFormation, and (b) an AWS Marketplace for EKS Kubernetes app using the v2.0 Helm chart.
- **License:** EE BYOL (customer supplies license JWT during launch).
- **Support:** Standard SLA.
- **Scope:** IAM least-privilege bootstrap (no admin keys baked into images), optional RDS Postgres (schema isolation preserved), optional S3 for object storage (medical images, genomic VCFs, study artifacts), KMS-backed `FipsCryptoProvider` variant, CloudWatch log shipper variant of `ObservabilityShipper`.
- **Marketplace deliverables:** Listing copy, screenshots, validation videos; product code + SKU registered; private offer flow for direct EE customers; AWS technical validation (security scan, launch test) passed.
- **Release gate:** Marketplace listing live, Quick Launch works in `us-east-1`, `us-west-2`, and `eu-west-1`; end-to-end EE feature parity with v2.2 on-prem.

##### v2.4 — Azure + GCP Marketplaces BYOL (target Q2 2027 mid)

- **Target user:** Azure-native or GCP-native EE customer.
- **Install paths:** Azure Marketplace VM image + AKS app; GCP Marketplace VM image + GKE app. All BYOL.
- **License:** EE BYOL.
- **Support:** Standard SLA.
- **Scope (Azure):** Azure Database for PostgreSQL (flexible server) option, Azure Blob storage, Azure Key Vault for `FipsCryptoProvider`, Azure Monitor shipper.
- **Scope (GCP):** Cloud SQL Postgres option, GCS for storage, Cloud KMS for `FipsCryptoProvider`, Cloud Logging shipper.
- **Code organization:** Single source of Terraform modules under `acropolis/cloud/{aws,azure,gcp}/`; per-cloud variations are thin wrappers around the same shared inputs (FQDN, license key, source DB choice, observability sink choice).
- **Release gate:** Both marketplace listings live; a single EE license JWT works unchanged across AWS, Azure, and GCP deployments; feature parity matrix shows zero exceptions vs. v2.2 / v2.3.

#### Phase 3 — Convergence GA (v2.5, target Q2 2027)

Three deliverables.

1. **Channel parity matrix.** A published table comparing every CE/EE feature against every install path (workstation / docker-compose on-prem / bare-metal-VPS / AWS / Azure / GCP). Targets 100% feature parity across paths; anything below 100% is a documented, public exception with an issue link and target version for closure.
2. **Packaging refactor lands.** The CE/EE design spec's deferred "Approach C": swap the EE repo's `parthenon/` subtree for proper package dependencies. EE `composer.json` pulls `parthenon-core` from Packagist (or a private Composer registry); EE `package.json` pulls `@parthenon/ui` from npm; EE Python imports `parthenon-ai` from PyPI. CI builds reproducibly from pinned versions. Subtree tooling stays as a backwards-compat path through v2.6, then retires.
3. **Support readiness.** Tiered SLAs (Community / Standard / Premier) with documented response times. Runbook library for each install path. Paid-support portal (HubSpot Service / Zendesk / equivalent). On-call rotation skeleton. Status page at `status.parthenon.io`. Opt-in telemetry phone-home shipping minimal install-success/failure signal back to Acumenus.

**Post-v2.5 horizon (named explicitly to prevent scope creep):** v3.0 introduces Acumenus-hosted SaaS on one or more clouds with marketplace billing integration.

---

## 5. Cross-Cutting Concerns

### 5.1 CI parity

CE PRs must keep passing without EE present (true today, must remain true). EE PRs run a combined CE+EE test suite — `sync-from-ce.sh` drives the subtree refresh; `verify-no-ce-patches.sh` is enforced as a pre-commit hook and CI gate. The packaging refactor in v2.5 adds a new gate: CE package versions published to public registries must build green before EE consumes them.

### 5.2 Image signing pipeline

Single Cosign-signing pipeline used by all three editions (CE-only, EE-bundled, marketplace-bundled). **v2.0 launches with keyless OIDC signing** anchored to the official Parthenon GitHub Actions release workflow; this avoids a KMS-provisioning critical path while preserving cryptographic auditability. **KMS-backed long-lived keys** migrate in via plan `05-01-followup-kms-keys` post-launch — both signing modes can co-exist on a transition tag, so the migration is non-breaking. Public verification documented in `docs/security/image-signing.md` (new in v2.0).

### 5.3 License server reliability

The license server is a single dependency for every EE deployment. It must be:

- Highly available (multi-region or active-passive).
- Air-gap supported (offline-signed license blob accepted as a fallback).
- Revocation-capable (revoked license JWTs reach EE instances within 24h via short-lived refresh tokens).

This is documented in `docs/enterprise/license-server.md` (new in v2.0).

### 5.4 CLA & license drift

CLA Assistant remains load-bearing on the CE repo. Any contributor change re-triggers CLA acceptance. The roadmap explicitly notes that as packaging refactor publishes packages to public registries (Packagist, npm, PyPI), the same CLA terms cover those packages.

### 5.5 Marketplace approval risk

AWS Marketplace technical validation takes **4–12 weeks**. Azure and GCP comparable. This is the single largest schedule risk for v2.3 and v2.4. Mitigation: submit listings as soon as the implementation is feature-complete, not after; expect at least one reject-and-resubmit cycle per cloud; budget approval lead time into the timeline.

---

## 6. Timeline Summary

| Version | Target | Theme | Channel impact |
|---|---|---|---|
| v1.0.7 | 2026-05-10 (shipped) | AGPLv3 + CE/EE fork + extension points | Baseline. |
| v1.0.8 | 2026-06 | Documentation & Onboarding | Doc gates v2.1. |
| v1.0.9 | 2026-07 | Security Audit & Hardening | Unblocks EE pilots + marketplace listings. |
| v1.0.10 | 2026-07 late | Release Candidate | Stabilization closes. |
| v1.1 | 2026-08 | Federation | Multi-tenant primitives validated. |
| v1.2 | 2026-10 / 2026-11 | Advanced AI + Keycloak SSO migration | EE identity foundation. |
| v1.3 | 2027-01 | RWE & Regulatory | Marketplace claims validated. |
| v1.4 | 2027-02 | Advanced Analytics | Marketplace demo workflows. |
| v1.5 | 2027-02 late | Ecosystem & Interoperability | Plugin architecture for EE drivers. |
| **v2.0** | **2026-Q4 / 2027-Q1** | **Foundations** (Helm, signed images, license server, workstation Edition, packaging groundwork) | Platform layer. |
| **v2.1** | **2027-Q1** | **CE One-Click** | Channel 1. |
| **v2.2** | **2027-Q1 late** | **EE On-Prem (compose on bare-metal + VPS)** | Channel 2. |
| **v2.3** | **2027-Q2 early** | **AWS Marketplace BYOL** | Channel 3. |
| **v2.4** | **2027-Q2 mid** | **Azure + GCP Marketplaces BYOL** | Channels 4 + 5. |
| **v2.5** | **2027-Q2** | **Convergence GA** (parity matrix, packaging refactor, support readiness) | All channels converge. |
| v3.0 | post-v2.5 | Acumenus-hosted SaaS | New business model. |

The v1.x feature releases (v1.3, v1.4, v1.5) **overlap** with v2.0 foundation work — that overlap is what makes the 12-month arc feasible. Arc I and Arc II are not strictly sequential.

---

## 7. Success Criteria

The v2.5 roadmap is "done" when, at GA, an Acumenus team member can demonstrate the following live, in a single sitting:

1. A researcher on a fresh Mac runs `curl https://parthenon.acumenus.net/install.sh | sh`, reaches a logged-in dashboard with Eunomia loaded in under 15 minutes.
2. A customer admin on a fresh Hetzner VPS runs `curl … ee-install.sh | sh -- --license-key=…` and reaches a working EE stack in under 30 minutes.
3. The same EE license JWT launches a working EE deployment from the AWS, Azure, and GCP marketplaces with no changes.
4. The published channel parity matrix shows 100% feature parity (or a public exception list with target close versions).
5. The EE repo's `parthenon/` subtree has been replaced by versioned package dependencies; CI builds green from pinned versions.
6. A support runbook exists for every install path; a Standard-tier customer can open a ticket via the support portal and receive an acknowledgment within the documented SLA.

---

## 8. Out of Scope for v2.5

Named explicitly to prevent scope creep:

- **Acumenus-hosted SaaS on any cloud.** v3.0.
- **K8s on bare metal / VPS.** EE on-prem is compose-only per decision.
- **Single-binary EE installer that bundles all containers as one executable.** EE always uses docker-compose on-prem and Helm in cloud.
- **Custom EE-only ML model offerings.** MedGemma stays in CE.
- **Marketplace billing integration.** BYOL only — Acumenus invoices EE customers directly.

---

## 9. What This Spec Produces

1. **`ROADMAP.md`** — replaced in this same commit. Two-arc structure described above.
2. **This spec** — `docs/superpowers/specs/2026-05-10-parthenon-v2-5-roadmap-design.md` — preserves the brainstorming session and decision history for future contributors.

After this spec is reviewed and approved, the writing-plans skill will produce a phased implementation plan covering at minimum:

- v2.0 Foundations plan (signed images, Helm chart GA, license server, packaging groundwork, workstation Edition GA)
- v2.1 CE One-Click plan
- v2.2 EE On-Prem plan
- v2.3 AWS Marketplace plan
- v2.4 Azure + GCP Marketplaces plan
- v2.5 Convergence GA plan (parity matrix, packaging refactor, support readiness)

Each phase is a separate plan in `docs/superpowers/plans/`, consistent with how the CE/EE fork was decomposed.

---

*Authored 2026-05-10 — Acumenus Data Sciences, Inc.*
