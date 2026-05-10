# v2.0 → v2.5 Roadmap Execution — Umbrella Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. This is an **umbrella plan** — each child workstream below is implemented via its own detailed plan (named in the workstream's "Child plan" line). Authoring those child plans happens just-in-time as each phase approaches; this umbrella defines the order, the prerequisites, and the release gates.

**Goal:** Take Parthenon from v1.0.7 (current) to v2.5 (convergence GA) where the platform is simultaneously the easiest-to-install OHDSI platform for community researchers and an Acumenus-sold enterprise product available on-prem (compose + bare-metal + VPS) and on AWS, Azure, and GCP marketplaces.

**Architecture:** Two-arc execution. Arc I (v1.0.8 → v1.5) closes stabilization and ships the feature work that v2.x markets. Arc II (v2.0 → v2.5) is a three-phase distribution-convergence program: **Phase 1 — Foundations (v2.0)** ships runtime artifacts (signed images, Helm chart, license server, Workstation GA, packaging groundwork); **Phase 2 — Channel Ramp (v2.1 → v2.4)** lights up one distribution channel per minor; **Phase 3 — Convergence GA (v2.5)** delivers the channel parity matrix, packaging-refactor swap, and support readiness.

**Tech Stack:** Laravel 11 + PHP 8.4 (backend), React 19 + TypeScript + Vite (frontend), Python 3.12 + FastAPI (AI service), R 4.4 + Plumber (HADES), PostgreSQL 17, Redis 7, Docker Compose (CE + EE on-prem), Helm + Kustomize (cloud K8s), Cosign + Trivy + CycloneDX (image supply chain), Keycloak 26 (EE SSO), Authentik 2026.x (CE SSO through v1.1), Rust (Workstation launcher), Ansible (EE on-prem bootstrap), Terraform (cloud marketplace launches), Cosmopolitan (no-Docker bundle), GitHub Actions (CI), GHCR + Docker Hub (image registry), Packagist + npm + PyPI (package registries in v2.0 onward).

**Spec:** [docs/superpowers/specs/2026-05-10-parthenon-v2-5-roadmap-design.md](../specs/2026-05-10-parthenon-v2-5-roadmap-design.md)

**Roadmap:** [ROADMAP.md](../../../ROADMAP.md)

---

## Plan Inventory

Each entry below is a child plan. Filenames follow the existing convention (`YYYY-MM-DD-<topic>.md`). Plans marked *(deferred)* are authored just-in-time when their predecessor's release gate is met.

### Arc I — Feature Maturation (already in-flight, listed for completeness)

| ID | Plan | Status | Predecessor |
|---|---|---|---|
| AI-1 | `2026-05-XX-v1-0-8-docs-and-onboarding.md` | *deferred* | v1.0.7 shipped |
| AI-2 | `2026-05-XX-v1-0-9-security-audit.md` | *deferred* | v1.0.8 |
| AI-3 | `2026-05-XX-v1-0-10-release-candidate.md` | *deferred* | v1.0.9 |
| AI-4 | `2026-05-XX-v1-1-federation-multisite.md` | *deferred* | v1.0.10 |
| AI-5 | `2026-05-XX-v1-2-advanced-ai-keycloak-migration.md` | *deferred* | v1.1; **detailed Keycloak migration plan is itself a pre-v1.2 deliverable per ROADMAP** |
| AI-6 | `2026-05-XX-v1-3-rwe-regulatory.md` | *deferred* | v1.2 |
| AI-7 | `2026-05-XX-v1-4-advanced-analytics.md` | *deferred* | v1.3 (can overlap) |
| AI-8 | `2026-05-XX-v1-5-ecosystem-interop.md` | *deferred* | v1.4 (can overlap) |

These plans inherit the existing roadmap's intent and are produced via writing-plans invocations as each minor begins.

### Arc II — Distribution Convergence

#### Phase 1 — Foundations (v2.0)

v2.0 is an umbrella minor with 6 workstreams. v2.0 foundation work begins **in parallel** with v1.3 (Jan 2027) so the channel ramp can start as v1.5 closes.

| ID | Plan | Workstream | Predecessor | Parallel with |
|---|---|---|---|---|
| 05-01 | `2026-XX-XX-v2-0-signed-images-supply-chain.md` | Signed multi-arch images, Cosign, CycloneDX SBOM, Trivy gates | — (kickable now) | 05-02 through 05-06 |
| 05-02 | `2026-XX-XX-v2-0-helm-chart-ga.md` | Helm chart + Kustomize overlays GA on OCI registry | 05-01 (consumes signed images) | 05-03, 05-05, 05-06 |
| 05-03 | `2026-XX-XX-v2-0-license-server.md` | `license.acumenus.net` JWT entitlement service with air-gap mode | v1.0.9 security audit | 05-02, 05-04, 05-05 |
| 05-04 | `2026-XX-XX-v2-0-packaging-refactor-groundwork.md` | Extract `parthenon-core` (Composer), `@parthenon/ui` (npm), `parthenon-ai` (PyPI), `parthenon.r` (CRAN-style) | — (kickable now) | 05-01 through 05-06 |
| 05-05 | `2026-XX-XX-v2-0-workstation-edition-ga.md` | Rust launcher GA: macOS + Windows + Linux, embedded Postgres + Redis, auto-update | 05-04 (consumes packages); 05-01 (signed binaries) | 05-02, 05-03, 05-06 |
| 05-06 | `2026-XX-XX-v2-0-openapi-sdk-strategy.md` | TypeScript + Python SDKs auto-generated from OpenAPI, published to registries | 05-04 (shares package release tooling) | 05-01 through 05-05 |

v2.0 release gate (all child plans complete):

- Helm chart installs cleanly on `kind`, `k3d`, EKS, AKS, GKE.
- Workstation launcher runs on a Mac without Docker Desktop pre-installed.
- Signed image set passes Cosign verification.
- License server issues, refreshes, and revokes JWTs end-to-end.
- Public SDKs published with passing CI on a separate consumer project.

#### Phase 2 — Channel Ramp (v2.1 → v2.4)

| ID | Plan | Channel | Predecessor (hard) | Predecessor (soft) | Marketplace lead time |
|---|---|---|---|---|---|
| 06 | `2026-XX-XX-v2-1-ce-one-click.md` | CE one-click installer (Linux one-liner + macOS `.dmg` + Windows `.exe`) | 05-05 (Workstation GA); 05-01 (signed); AI-1 (docs) | 05-02 (compose path mirror) | — |
| 07 | `2026-XX-XX-v2-2-ee-on-prem.md` | EE Docker Compose + Ansible bootstrap on bare-metal and VPS | 05-03 (license server); v1.2 (Keycloak); AI-2 (security audit) | 05-04 (packages reduce drift) | — |
| 08 | `2026-XX-XX-v2-3-aws-marketplace-byol.md` | AWS Marketplace AMI + EKS app | 05-02 (Helm); 05-03 (license); AI-2 (security audit report) | 05-06 (SDK reference) | 4–12 weeks AWS validation |
| 09 | `2026-XX-XX-v2-4-azure-gcp-marketplaces-byol.md` | Azure Marketplace + GCP Marketplace (VM + K8s app each) | 08 (Terraform module reuse); 05-02; 05-03 | — | 4–12 weeks each cloud |

#### Phase 3 — Convergence GA (v2.5)

| ID | Plan | Workstream | Predecessor |
|---|---|---|---|
| 10-01 | `2026-XX-XX-v2-5-channel-parity-matrix.md` | Published feature parity table across all five install paths + exception register | 06, 07, 08, 09 |
| 10-02 | `2026-XX-XX-v2-5-packaging-refactor-swap.md` | Swap EE `parthenon/` subtree → package dependencies (Composer / npm / PyPI / R) | 05-04; 09 |
| 10-03 | `2026-XX-XX-v2-5-support-readiness.md` | Tiered SLAs, runbook library, support portal, status page, opt-in telemetry | 06, 07, 08, 09 |

v2.5 release gate (the five-demo test, executed live):

1. Fresh Mac runs `curl https://parthenon.acumenus.net/install.sh | sh` → logged-in dashboard with Eunomia in <15 min.
2. Fresh Hetzner VPS runs the EE installer with a license key → working EE stack in <30 min.
3. Same EE license JWT launches working deployments from AWS, Azure, GCP marketplaces — no changes.
4. Published channel parity matrix shows 100% parity (or a public exception list with target close versions).
5. Standard-tier support ticket opened via the portal → acknowledged within SLA.

---

## Dependency Graph

```
v1.0.7 (shipped)
    ↓
[Arc I: v1.0.8 → v1.5 — feature maturation, stabilization, Keycloak migration]
    │
    ├─→ AI-2 (v1.0.9 security audit) ──→ blocks 05-03, 07, 08, 09
    └─→ AI-5 (v1.2 Keycloak)         ──→ blocks 07 (EE identity)
                  │
                  └─→ Arc I continues in parallel with v2.0 starting here ↓
                                                                          │
[Arc II Phase 1: v2.0 Foundations]                                        │
    05-01 signed-images ──────┐                                           │
    05-04 packaging  ─────────┤── all six parallel where possible ────────┤
    05-02 helm-ga (after 05-01)                                           │
    05-03 license-server (after AI-2) ─┐                                  │
    05-05 workstation-ga (after 05-04, 05-01)                             │
    05-06 sdk-strategy (after 05-04)   │                                  │
                                       │                                  │
[Arc II Phase 2: v2.1 → v2.4 Channel Ramp]                                │
    06 v2.1 ce-one-click (after 05-05, 05-01, AI-1)  ─┐                   │
    07 v2.2 ee-on-prem (after 05-03, AI-5, AI-2)     ─┤── sequential ───┐│
    08 v2.3 aws (after 05-02, 05-03, AI-2)           ─┤                 ││
    09 v2.4 azure-gcp (after 08)                     ─┘                 ││
                                                                        ││
[Arc II Phase 3: v2.5 Convergence GA]                                   ││
    10-01 parity-matrix (after 06, 07, 08, 09)    ─┐                    ││
    10-02 packaging-swap (after 05-04, 09)        ─┤── parallel ────────┘│
    10-03 support-readiness (after 06, 07, 08, 09)─┘                     │
                                                                          │
v2.5 GA (Q2 2027) ←──────────────────────────────────────────────────────┘
```

---

## Cross-Phase Tasks (run continuously)

These are not child plans; they are recurring discipline that must hold across every plan in this umbrella.

### CP-1: CI parity enforcement

**Owner:** Every plan that touches CE or EE code.

- [ ] **Step 1: CE PRs continue to pass with no EE present.** Verified by GitHub Actions `parthenon-ci.yml` running on every PR to `Acumenus-Data-Sciences/Parthenon`. No new dependency on EE driver code may be introduced into CE.
- [ ] **Step 2: EE PRs run combined CE+EE test suite.** Verified by `parthenon-ee-ci.yml` in the private repo running `sync-from-ce.sh` → `vendor/bin/pest --testsuite=CE,EE`.
- [ ] **Step 3: `verify-no-ce-patches.sh` enforced.** Pre-commit hook + CI gate on every EE PR. Hook fails if any file under `parthenon/` was modified outside of a `[ce-sync]`-tagged subtree merge commit.
- [ ] **Step 4: v2.5 adds package-build gate.** When 10-02 lands, EE CI requires CE package versions (`parthenon-core`, `@parthenon/ui`, `parthenon-ai`) to have green CI on their public registry before EE consumes them.

### CP-2: Image signing pipeline

**Owner:** 05-01 establishes; every release plan consumes.

- [ ] **Step 1: Single Cosign key set in Acumenus KMS.** Public key published at `parthenon.acumenus.net/.well-known/cosign.pub`. Documented in `docs/security/image-signing.md` (created in 05-01).
- [ ] **Step 2: Every published image carries signature + SBOM.** GHCR + Docker Hub images include `*.sig` + `*.sbom` attestations.
- [ ] **Step 3: Trivy scan blocks release on HIGH/CRITICAL CVEs.** Allowlist file at `.security/cve-allowlist.yaml` requires sign-off from the security-architect agent before merge.
- [ ] **Step 4: Marketplace plans (08, 09) verify signature on launch.** AWS / Azure / GCP install paths run `cosign verify` against the public key before container start.

### CP-3: License server reliability

**Owner:** 05-03 establishes; 07, 08, 09 consume; 10-03 monitors.

- [ ] **Step 1: HA design documented.** 05-03 publishes `docs/enterprise/license-server.md` covering active-passive deployment, regional failover, and incident response.
- [ ] **Step 2: Air-gap mode supported.** EE driver accepts an offline-signed license blob (`license.json` + `license.sig`) as a fallback when `license.acumenus.net` is unreachable.
- [ ] **Step 3: Revocation reaches EE instances within 24h.** Short-lived refresh tokens (max 24h TTL) force a checkin; revoked licenses fail validation on next refresh.
- [ ] **Step 4: License-server status visible on `status.parthenon.io`.** Created in 10-03.

### CP-4: CLA continuity

**Owner:** Every CE PR; every plan that introduces a public package.

- [ ] **Step 1: CLA Assistant bot remains load-bearing on `Acumenus-Data-Sciences/Parthenon`.** Any contributor change re-triggers CLA acceptance.
- [ ] **Step 2: New public packages inherit the same CLA.** When 05-04 publishes `parthenon-core` to Packagist, `@parthenon/ui` to npm, and `parthenon-ai` to PyPI, each package README links to the same CLA document. No CLA divergence.
- [ ] **Step 3: Bot identities (Sentinel/Bolt/Palette/Jules) accept CLA on company's behalf.** Reaffirmed when any bot identity rotates.

### CP-5: Marketplace approval lead-time tracking

**Owner:** 08 (AWS) and 09 (Azure + GCP).

- [ ] **Step 1: Submit listings as soon as implementation is feature-complete, not after.** Don't wait for additional polish — submission and engineering can overlap.
- [ ] **Step 2: Expect one reject-and-resubmit cycle per cloud.** Budget 4–12 weeks AWS, 4–8 weeks Azure, 4–8 weeks GCP into the schedule.
- [ ] **Step 3: Maintain a marketplace status log.** `docs/enterprise/marketplace-status.md` records submission dates, validator feedback, resubmission counts.

---

## Order of Operations

### Phase 1 kick-off (immediately after v1.0.7 stabilization tail completes — target June 2026)

These three plans can be authored and start in parallel **as soon as v1.0.10 ships**:

1. **05-01 signed-images** — no upstream dependencies; pure supply-chain work.
2. **05-04 packaging-refactor-groundwork** — no runtime impact; pure repo reorganization with public registry publishing.
3. **AI-1 v1.0.8 docs** — documentation work; doesn't share resources with the above.

### Phase 1 second wave (after 05-01 and 05-04 land)

4. **05-02 helm-chart-ga** — consumes signed images and packages.
5. **05-05 workstation-edition-ga** — consumes packages and signed binaries.
6. **05-06 openapi-sdk-strategy** — consumes the package release tooling.
7. **05-03 license-server** — gated by AI-2 (v1.0.9 security audit report) since a license server is a HIGHSEC-class service.

### Phase 2 sequencing

v2.1 and v2.2 can overlap (different teams: CE polish vs EE on-prem). v2.3 → v2.4 should be sequential to reuse Terraform modules; submitting marketplace listings on AWS first lets us learn the validation process before doubling down on Azure + GCP simultaneously.

### Phase 3 sequencing

10-01 (parity matrix) and 10-03 (support readiness) can run in parallel as soon as v2.4 ships. 10-02 (packaging swap) is the highest-risk Phase 3 work and gets dedicated focus — it's the final lift before GA and must not be rushed.

---

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| AWS Marketplace technical validation rejects on first submission | High (>50%) | 4-week schedule slip | Submit early; budget one resubmit cycle into v2.3 timeline |
| Azure + GCP submissions both reject | Medium (~30%) | 8-week schedule slip on v2.4 | Stagger submissions; use AWS feedback to pre-empt similar issues |
| License server design fails security audit (AI-2) | Medium | 05-03 redesign | Engage security-architect agent during 05-03 design phase, not at PR review |
| Packaging refactor (05-04 / 10-02) breaks EE consumers | High | EE customer escapes | Long parallel-run window: subtree path stays valid through v2.6; package consumption is opt-in at v2.5 |
| Workstation embedded Postgres has perf issues on large CDM sources | Medium | v2.1 release-gate slip | Document and enforce "Workstation = Eunomia + GiBleed scale" limits; large CDM sources require docker-compose path |
| Keycloak migration (v1.2) slips past Q4 2026 | Medium | v2.0 + v2.2 schedule slip | Pre-v1.2 detailed plan (per ROADMAP) authored before v1.2 starts so execution risk is bounded |
| CE/EE drift during 12-month arc | Medium | Higher v2.5 packaging-swap risk | CP-1 enforcement; weekly `sync-from-ce.sh` runs; monthly CE→EE drift audit |
| Aggressive 12-month timing (Q2 2027) is unrealistic | Medium-High | v2.5 slips to Q3 / Q4 2027 | Re-baseline this umbrella every quarter; flag schedule slip publicly in the ROADMAP timeline table |

---

## Status Tracking

This umbrella is updated as each child plan completes. The format below mirrors the existing CE/EE fork umbrella convention.

| Plan ID | Status | Started | Completed | Notes |
|---|---|---|---|---|
| 05-01 signed-images | Not started | — | — | Authorable now |
| 05-02 helm-chart-ga | Not started | — | — | Wait for 05-01 |
| 05-03 license-server | Not started | — | — | Wait for AI-2 |
| 05-04 packaging-refactor | Not started | — | — | Authorable now |
| 05-05 workstation-edition-ga | Not started | — | — | Wait for 05-04 + 05-01 |
| 05-06 openapi-sdk-strategy | Not started | — | — | Wait for 05-04 |
| 06 v2.1 ce-one-click | Not started | — | — | Wait for 05-05 + AI-1 |
| 07 v2.2 ee-on-prem | Not started | — | — | Wait for AI-5 + AI-2 + 05-03 |
| 08 v2.3 aws-marketplace | Not started | — | — | Wait for 05-02 + AI-2 + 05-03 |
| 09 v2.4 azure-gcp-marketplaces | Not started | — | — | Wait for 08 |
| 10-01 parity-matrix | Not started | — | — | Wait for 06, 07, 08, 09 |
| 10-02 packaging-swap | Not started | — | — | Wait for 05-04 + 09 |
| 10-03 support-readiness | Not started | — | — | Wait for 06, 07, 08, 09 |

---

## How to Author the Next Child Plan

When ready to start a child plan, invoke writing-plans with the spec section that covers that child plan's scope:

1. Identify the next plan from the order-of-operations list above.
2. Confirm its hard predecessors have shipped (check the Status Tracking table).
3. Invoke writing-plans to produce `docs/superpowers/plans/YYYY-MM-DD-<id>-<topic>.md`.
4. The new child plan inherits this umbrella as its parent and updates the Status Tracking table when it starts and completes.

The next child plans authorable today (no unmet predecessors):

- **05-01 — Signed multi-arch images, Cosign, CycloneDX SBOM, Trivy gates** — start here. Establishes the supply-chain foundation every other Arc II plan rides on.
- **05-04 — Packaging refactor groundwork** — also kickable now. Extracts `parthenon-core` / `@parthenon/ui` / `parthenon-ai` / `parthenon.r` packages and gets them on public registries. Big-bang risk is contained because the EE repo continues consuming via subtree until v2.5.
- **AI-1 — v1.0.8 docs & onboarding** — also kickable now. Independent of Arc II; gates v2.1 CE one-click.

---

## Definition of Done (umbrella)

This umbrella plan is "done" when every Status Tracking row is `Completed` and the five-demo test (named in the v2.5 release gate) passes live for an Acumenus team member.

Until then, this umbrella is updated as each child plan ships, and the ROADMAP.md timeline table is updated in lockstep so the public roadmap stays in sync with execution reality.
