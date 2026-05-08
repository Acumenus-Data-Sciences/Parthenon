# CE/EE Fork and AGPLv3 Relicense — Design

**Status:** Draft for user review
**Date:** 2026-05-08
**Author:** Sanjay Udoshi (with Claude assistance)
**Decision owner:** Sanjay Udoshi (founder, Acumenus Data Sciences, Inc.)
**Estimated execution window:** ~10 weeks

---

## 1. Goal

Fork Parthenon into a free, open-source **Community Edition** and a paid, closed-source **Enterprise Edition** so Acumenus Data Sciences can pursue investor funding and commercial beta engagements without slowing the open research mission. Relicense Community Edition from Apache-2.0 to AGPL-3.0-only as part of the same effort. Move the canonical repo from the founder's personal account (`github.com/sudoshi`) to the company organization (`github.com/acumenus`).

The fork is **investor-grade** (clean IP boundaries, dual-license-capable, separate proprietary repo, distinct commercial license) but **not over-engineered** (no full open-core packaging refactor in this window — that is a v2.5 path).

---

## 2. Decisions Locked

| Question | Decision |
|---|---|
| Repo structure | Monorepo CE + private EE overlay (not feature flags, not pure two-fork) |
| CE license | AGPL-3.0-only |
| EE license | Proprietary, closed-source, commercial EULA |
| CE/EE split | Infrastructure-tier — CE = full Parthenon application + Acropolis community; EE = enterprise infra, scale, and compliance |
| Technical pattern | **Approach B**: EE merges CE into a `parthenon/` subdirectory via **git subtree** in a single working tree, EE-only code in `enterprise/` overlay, sync script (`git subtree pull`) keeps EE current with CE main. **Approach C** (proper packages) deferred to v2.5. |
| Timeline | ~10 weeks, phased; clean architecture over speed |
| Repo ownership | Move `sudoshi/Parthenon` → `acumenus/Parthenon`; create `acumenus/Parthenon-EE` (private) |
| CLA | Standard CLA Assistant grant (AGPL distribution + dual-license + patent grant) for all non-Acumenus contributors |
| EE code rule | EE never patches CE files. EE adds drivers/plugins under `enterprise/` consuming CE extension points. New extension points are CE PRs (public). |

---

## 3. Repo and License Architecture

### 3.1 Repos

- **`github.com/acumenus/Parthenon`** (public, AGPL-3.0-only) — Community Edition. Holds the entire Parthenon application: backend, frontend, ai, r-runtime, installer, docs, scripts, **Acropolis community services** (Authentik, Traefik, Portainer, pgAdmin), and CE-only docker-compose files.
- **`github.com/acumenus/Parthenon-EE`** (private, commercial EULA) — Enterprise Edition. Holds only EE-specific code in an `enterprise/` overlay, plus build/sync tooling.

### 3.2 License files

**In CE (`Parthenon`):**
- `LICENSE` — verbatim AGPL-3.0 text from gnu.org.
- `NOTICE` — copyright (Acumenus Data Sciences, Inc., 2024–2026), heritage attribution (OHDSI Atlas legacy `js/` tree, OMOP CDM v5.4, Achilles, Circe, DQD, HADES — all Apache-2.0, not redistributed in current source), third-party dependencies pointer.
- `LICENSING.md` — current license declaration, AGPL §13 explanation, dual-licensing offer with `licensing@acumenus.net` contact, project IP history, contributor terms (CLA reference), trademark notice pointing to `TRADEMARKS.md`.
- `TRADEMARKS.md` — **standalone trademark policy**. Declares "Parthenon", "Acumenus", "Wellstack.ai" as trademarks of Acumenus Data Sciences, Inc.; license does not grant trademark use; describes nominative-fair-use boundaries.

**In EE (`Parthenon-EE`):**
- `LICENSE-EE` — commercial EULA. **Drafted as a placeholder by Claude for Sanjay's counsel to review.** Until counsel signs off, the file is clearly marked "DRAFT — not legally executable. Contact licensing@acumenus.net."
- `COMMERCIAL.md` — describes the commercial offering structure (EE features, support tiers, deployment options, upgrade path) **without prices**. Pricing kept off-repo.
- `THIRD_PARTY_LICENSES.md` — list of EE-bundled third-party services (n8n, Superset, DataHub, Wazuh, Keycloak) and their respective licenses for customer compliance review.

### 3.3 CLA — load-bearing legal foundation

CLA Assistant goes live on `acumenus/Parthenon` **the same week as the AGPLv3 flip**. Standard grant:

1. Right to distribute the contribution under AGPL-3.0-only (CE).
2. Right to re-license the contribution under any other terms, including commercial (enables EE).
3. Patent grant equivalent to Apache-2.0 §3.
4. Author warrants original work or properly licensed.

Without the CLA, EE cannot legally embed/link CE code under non-AGPL terms. **Heritage authors are not retroactively bound** — the existing audit (per `docs/handoffs/Apache2.0_to_AGPLv3_Conversion.md`) confirmed no surviving substantial contributions from heritage authors in the current tree.

Bot PRs (Sentinel/Bolt/Palette/Jules) require either bot-specific bypass tokens (not recommended) or the bot identity must accept the CLA on the company's behalf.

### 3.4 EE consumption model — Approach B (subtree + overlay)

EE working tree layout:

```
Parthenon-EE/                        # private repo, acumenus org
├── parthenon/                       # CE merged in as git subtree at pinned tag
├── enterprise/                      # EE-only overlay, mirrors CE structure
│   ├── backend/
│   │   └── src/
│   │       ├── Auth/                # Keycloak, SAML, SCIM drivers
│   │       ├── Tenant/              # MultiTenantResolver
│   │       ├── Crypto/              # FipsCryptoProvider
│   │       ├── Audit/               # SignedAuditSink
│   │       ├── License/             # JWT license validation, entitlement checks
│   │       └── Telemetry/           # opt-in usage telemetry (future)
│   ├── frontend/
│   │   └── src/features/admin-enterprise/  # SAML/SCIM/multi-tenant config UIs
│   ├── ai/
│   │   └── compliance/              # FIPS-mode AI service config
│   ├── acropolis/
│   │   ├── docker-compose.enterprise.yml
│   │   ├── n8n/, superset/, datahub/, wazuh/
│   │   └── keycloak/                # replaces authentik in EE deployments
│   ├── k8s/
│   │   ├── helm/parthenon/          # Helm chart
│   │   └── kustomize/               # Kustomize overlays
│   ├── operator/                    # Parthenon Operator skeleton (full operator → v1.2)
│   ├── installer/
│   │   └── phases/                  # FIPS bootstrap, multi-tenant init, Keycloak setup
│   └── docs/                        # private/customer docs (FIPS guide, SAML setup, etc.)
├── docker-compose.ee.yml            # EE composition (extends CE)
├── scripts/
│   ├── sync-from-ce.sh              # daily merge of CE main → EE main
│   ├── build-ee.sh                  # combined CE+EE container image build
│   └── verify-no-ce-patches.sh      # pre-commit guard against patching parthenon/
├── .github/workflows/
│   ├── ce-sync.yml                  # daily scheduled sync GH Action
│   ├── ee-ci.yml                    # full CE+EE test pipeline
│   └── ee-release.yml               # signed image build + GHCR push
├── LICENSE-EE                       # commercial EULA (counsel-finalized)
├── COMMERCIAL.md
├── THIRD_PARTY_LICENSES.md
├── README.md                        # private; oriented to Acumenus team + customers
└── CE_VERSION                       # pinned CE tag/sha; validated at build time
```

**Hard rule:** EE never edits files under `parthenon/` directly. Enforced by `scripts/verify-no-ce-patches.sh` running as a pre-commit hook and as a CI gate on every EE PR. The only exception is the subtree merge commits produced by `sync-from-ce.sh`, which are detected by their merge commit shape and `[ce-sync]` marker in the commit message.

**Why git subtree, not git submodule:** subtree gives EE devs a single working tree (one IDE window, one test run, one PR for cross-cutting features) while preserving full CE git history under `parthenon/`. Submodules require contributors to learn `git submodule update --init`, hit detached-HEAD surprises, and split every cross-cutting change across two PRs. The cost of subtree is sync tooling complexity, which we already need anyway. Subtree is also easier to migrate away from later (in v2.5, swap `parthenon/` for a package dependency).

---

## 4. CE/EE Feature Split

### 4.1 What stays in CE (AGPLv3, public)

The full Parthenon research platform — every clinical/research feature stays open. This protects the "Parthenon helps researchers" mission and matches the investor pitch (clinical care isn't paywalled).

| Layer | What stays in CE |
|---|---|
| Backend | All 97 API controllers, all 39 feature modules, Laravel + Sanctum + Spatie RBAC, Horizon |
| Frontend | All React features (cohorts, characterization, analyses, vocabulary, GIS, imaging, genomics, HEOR, Commons, **Abby AI assistant** (full local Abby — UI, RAG pipeline, conversation history), ingestion, mapping, risk scores, pathways) |
| AI | Python AI service, **Ollama/MedGemma integration (full local AI inference)**, ChromaDB, pgvector |
| R | Plumber API, HADES packages |
| Search | Solr (all 10 configsets) |
| DB | PostgreSQL schemas (omop, vocab, results, etc.), all migrations |
| Infra (CE) | `docker-compose.yml` + `docker-compose.community.yml`, Acropolis community: **Authentik, Traefik, Portainer, pgAdmin** |
| Installer | `install.py`, `installer/`, `acropolis/installer/` (community phases) |
| Docs | All public docs, devlogs, blog, ADRs, user manual |

**Open question deferred:** Commons / Hive Networks federation features. Default = stay in CE for now (single-org collaboration is research, not enterprise scale). Decision revisited once first EE customer conversations clarify whether multi-org Hive federation is a paid feature.

### 4.2 What lives in EE only (proprietary, private)

| Layer | EE-only code |
|---|---|
| Acropolis enterprise services | n8n, Apache Superset, DataHub, Wazuh, **Keycloak (replaces Authentik)** |
| Identity & access | SAML 2.0, SCIM 2.0 user provisioning, OIDC IdP federation, JIT account creation, group→role mapping |
| Multi-tenancy | Tenant model, per-tenant data isolation, tenant routing middleware, tenant-aware RBAC, tenant-scoped storage |
| Compliance | FIPS 140-2 crypto adapter, HIPAA-grade audit log retention with WORM, SOC 2 controls module, signed audit log export |
| Observability | Datadog/Splunk shippers, OpenTelemetry exporter configs, enterprise Grafana dashboards, SLA monitoring |
| Kubernetes | Helm charts, Kustomize overlays, **Parthenon Operator skeleton** (CRDs for Sources/Cohorts/Analyses; full operator → v1.2) |
| Support tooling | Customer license server, telemetry phone-home (opt-in, **future** once Hyperscaler Terraforms ready), bundled diagnostic export |
| Hosted services (future) | **Acumenus-hosted Abby AI** — managed fine-tuning, scaled inference, customer model isolation (post-Hyperscaler-Terraforms). The local Abby experience itself stays in CE; this is a separate hosted offering. |
| Docs | Private customer runbooks, FIPS deployment guide, multi-tenant ops, SSO setup guides |

### 4.3 EE is purely additive

No CE feature is removed or downgraded by the existence of EE. Researchers running CE on a workstation get the same clinical/research feature set they have today.

---

## 5. CE Extension Points (Phase 2 work, public AGPL)

CE exposes stable interfaces so EE plugs in without patching CE files. Each extension point is a standalone, valuable CE feature in its own right (community users can write custom drivers).

| # | Extension point | CE pattern | EE consumes via |
|---|---|---|---|
| 1 | **AuthDriver registry** | `AuthDriver` interface + `config/auth.php` driver registry. CE ships `sanctum`, `authentik` drivers. | `keycloak`, `saml`, `scim` drivers under `enterprise/backend/src/Auth/`. |
| 2 | **TenantResolver + tenant-aware Eloquent scopes** | `TenantResolver` interface, default `SingleTenantResolver` returning a static tenant. Tenant-aware Eloquent global scopes wired through middleware. `tenant_id` columns added as nullable to relevant tables behind a feature flag (off by default). | `MultiTenantResolver` (subdomain/header/JWT-claim based) + tenant-aware Eloquent scopes activated. |
| 3 | **CryptoProvider** | Wraps `Hash`, `Crypt`, `Signer`. CE default uses Laravel native. | `FipsCryptoProvider` backed by FIPS-validated OpenSSL/BoringSSL. |
| 4 | **AuditSink** | CE default writes to `app.audit_logs` table. | `SignedAuditSink` (signed JSONL to S3/Azure Blob with WORM retention). |
| 5 | **ObservabilityShipper** | Logs/metrics/traces. CE default = Loki + Prometheus. | Datadog, Splunk, OpenTelemetry shippers. |
| 6 | **Frontend featureFlags + EnterpriseGate** | `featureFlags` Zustand store reading server config. `<EnterpriseGate>` component hides EE-only UI surfaces when EE not licensed. | Flags reveal admin panels, multi-tenant switcher, SAML/SCIM config UI. |
| 7 | **Acropolis installer phase registry** | Each phase is a discoverable module. CE registers community phases. | EE adds enterprise phases (FIPS bootstrap, multi-tenant init, Keycloak setup) via the same registry mechanism. |
| 8 | **Compose composition contract** | CE: `docker-compose.yml` + `docker-compose.community.yml`. Documented override conventions. | `docker-compose.ee.yml` extends CE compose + brings in `enterprise/acropolis/`. |

Each extension point ships as its own CE PR with:
- Interface definition + docblock
- CE default implementation that preserves current behavior byte-for-byte
- Documentation in `docs/architecture/extension-points.md`
- Tests verifying the default + at least one alternate stub (proves pluggability)
- Where applicable, a feature flag so the new abstraction can be A/B-toggled in production

---

## 6. Sync Workflow, CI/CD, and Release Process

### 6.1 Day-to-day developer flow

**CE-only contributors (community + most internal work):**
- Same as today. Clone `acumenus/Parthenon`, branch, PR, merge. CLA Assistant gates first PR. Nothing changes about the public OSS workflow.

**EE contributors (Acumenus employees + paid contractors only):**
1. Clone `acumenus/Parthenon-EE`. The `parthenon/` subdirectory is already populated via git subtree at the pinned CE commit — no extra init step.
2. Work flow depends on what's touched:
   - **EE-only change** → edit under `enterprise/`, PR to `Parthenon-EE`.
   - **CE extension point change** → branch in `parthenon/`, PR to **public** `Parthenon` first. After merge, sync EE.
   - **Cross-cutting change** (CE plugin point + EE driver) → CE PR first (public review, lands in `main`), then EE PR consumes the new point.
3. CI on EE PRs runs CE tests + EE tests in a combined working tree.

### 6.2 Sync tooling

A scheduled GitHub Action in `Parthenon-EE` runs **`scripts/sync-from-ce.sh`** daily:

1. `git fetch parthenon-remote main` (where `parthenon-remote` is the named remote pointing at `acumenus/Parthenon`).
2. `git subtree pull --prefix=parthenon parthenon-remote main --squash` (squash keeps EE history readable; full CE history remains accessible in the public repo).
3. If conflicts: open auto-PR titled `sync: CE main → EE @ <sha>` and ping `@acumenus/maintainers`.
4. If clean: commit message tagged `[ce-sync]`, push, run full EE CI, post status.
5. Bump `CE_VERSION` file with new pinned sha + tag with date.

The "EE never patches CE" rule means most syncs are conflict-free. Conflicts only appear if CE deletes/renames a file EE depends on for an extension point — which is exactly the moment we *want* a maintainer to look.

### 6.3 CI/CD

**CE (`acumenus/Parthenon`) — public CI:**
- GitHub Actions free runners.
- Pint, PHPStan, ESLint, tsc, vitest, Pest, pytest, mypy.
- Builds public CE container images → `ghcr.io/acumenus/parthenon-{php,nginx,node,...}` (public).

**EE (`acumenus/Parthenon-EE`) — private CI:**
- GitHub Actions on **self-hosted private runners** on `beastmode` (or small dedicated host). Decision: self-hosted to start; revisit if local capacity becomes a bottleneck.
- Runs CE pipeline (against bundled CE source) + EE-specific tests.
- Builds EE container images → `ghcr.io/acumenus/parthenon-ee-{php,nginx,...}` (private, restricted to EE customer GitHub orgs).
- Generates Helm chart artifacts → private OCI registry.
- Signs containers (cosign) with Acumenus signing key.
- SBOM generation (syft) for customer compliance review.

### 6.4 Release process

**CE releases (public, semver):**
- Cut `v1.x.y` tags on `acumenus/Parthenon` main.
- GitHub Release with auto-generated changelog (conventional commits).
- Container images tagged `:v1.x.y` and `:latest`.

**EE releases (commercial, separate semver, independent cadence):**
- Cut `vEE-1.x.y` tags on `acumenus/Parthenon-EE` main.
- EE version pins a CE version (`CE_VERSION` file, validated at build time).
- EE may release more often than CE for customer hotfixes without forcing a CE release.
- Customer notification via private mailing list / customer portal.
- Container images pushed to private GHCR + optionally to customer-specified registries (ECR/ACR/GCR) on request.

### 6.5 Customer install flow

EE customers receive:
1. **License key** — signed JWT, validated by EE license module on startup.
2. **Access to private container registry** — GitHub PAT scoped to customer org.
3. **Installer wrapper** — `parthenon-ee install --license <key>` pulls EE images and overlay configs, drives the installer phases.
4. **No source code by default.** Source escrow available via Iron Mountain at customer cost.

### 6.6 Repo permissions

| Repo | Read | Write | Admin |
|---|---|---|---|
| `acumenus/Parthenon` (public) | World | Maintainers + contributors via PR (CLA-gated) | `@acumenus/maintainers` (Sanjay + 1 backup) |
| `acumenus/Parthenon-EE` (private) | `@acumenus/employees`, `@acumenus/ee-team` | `@acumenus/employees`, `@acumenus/ee-team` | `@acumenus/maintainers` |
| Private GHCR `parthenon-ee-*` | Paid EE customer org PATs | EE CI bot | `@acumenus/maintainers` |

### 6.7 Branch protection

- Both repos: signed commits required, linear history on main, all PRs must pass CI + ≥1 reviewer.
- CE: external contributors cannot self-merge (CLA + maintainer review required).
- EE: same rules; reviewers must be Acumenus employees (legal IP boundary).
- Pre-merge GH Action on `Parthenon` blocks any PR that breaks a documented extension point (lint rule on the interface files).

---

## 7. Phased Timeline (~10 weeks)

Phase gates are real. Don't start phase N+1 until phase N's exit criteria pass.

**Note on parallelism:** Phases 0 and 0.5 run in parallel during Week 0–1 (they touch different surfaces — legal scaffolding vs GitHub admin). Phase 1 only starts after both have completed.

### Phase 0 — Pre-flight (Week 0, ~3 days, parallel with Phase 0.5)

- Engage counsel to draft commercial EULA (`LICENSE-EE`); meanwhile use a Claude-drafted placeholder clearly marked "DRAFT — not legally executable."
- Decide CLA wording; stand up CLA Assistant with the agreed terms (AGPLv3 distribution + dual-license grant + patent grant).
- Trademark notice text drafted (`TRADEMARKS.md`).
- **Notify private fork users** (Geisinger, Hive Networks pilots, any other deployed instances) that license change is coming. Get written ack before merging Phase 1.

**Exit:** EULA placeholder exists, CLA bot live (test PR signed), `TRADEMARKS.md` drafted, private fork users notified.

### Phase 0.5 — Org transfer (Week 0–1, ~2 days, parallel with Phase 0)

Move `sudoshi/Parthenon` → `acumenus/Parthenon` so all later artifacts (CLA, LICENSING.md, package manifests, container images) generate against the new namespace once.

**Pre-transfer prep:**
- Audit `sudoshi/Parthenon` and `ghcr.io/sudoshi` references with `grep -r`. Expected hits: `README.md` badges, `docker-compose.community.yml` (image refs), CI workflows, `CONTRIBUTING.md`, scripts using `gh`, `package.json` repository field.
- Decide org structure on `github.com/acumenus`:
  - Teams: `@acumenus/maintainers` (Sanjay + 1 backup), `@acumenus/employees` (CE+EE write), `@acumenus/ee-team` (EE-only).
  - Org-level branch protection rulesets.
  - Org-level Actions secrets (signing keys, PATs).

**Transfer day:**
- GitHub "Transfer ownership" preserves PRs, issues, stars, releases, history. Old URLs auto-redirect.
- Re-point CLA Assistant to new URL.
- Update repo description, topics, social preview to acumenus branding.
- Re-add org-scoped secrets / app installations. Re-link bots (Sentinel/Bolt/Palette/Jules), Codecov.

**Post-transfer cleanup PR:**
- Bulk replace `sudoshi/Parthenon` → `acumenus/Parthenon` and `ghcr.io/sudoshi/parthenon-*` → `ghcr.io/acumenus/parthenon-*` in active source.
- Submodules (`OHDSI-scraper`, `study-agent`) stay at current URLs — they're separate repos.
- Keep `ghcr.io/sudoshi/parthenon-*` images live for one minor version with a deprecation notice.
- Notify any external integrations / partner pipelines.

**Exit:** `acumenus/Parthenon` is canonical, CI green on a no-op PR, container images publish to `ghcr.io/acumenus/parthenon-*`, CLA Assistant gates a test PR, all `sudoshi/Parthenon` references in active source updated.

### Phase 1 — AGPLv3 relicense (Weeks 1–2)

Execute the existing handoff (`docs/handoffs/Apache2.0_to_AGPLv3_Conversion.md`), with the org rename folded in. Single PR.

- Replace `LICENSE` with AGPLv3 verbatim from gnu.org.
- Add `NOTICE` (heritage attribution).
- Add `LICENSING.md` (current license + dual-licensing offer + commercial contact + trademark pointer).
- Add `TRADEMARKS.md` (standalone).
- Update package manifests: `backend/composer.json`, `frontend/package.json`, `ai/pyproject.toml`, `templates/pyproject.toml` → `AGPL-3.0-only`. Resolves the pre-existing inconsistency where `composer.json` declared MIT.
- Update `README.md` badge from Apache 2.0 to AGPLv3 + add EE pointer ("Enterprise Edition available — see `LICENSING.md`").
- Delete stale root `package-lock.json` stub (88 bytes).
- Update `CONTRIBUTING.md` with CLA reference + dual-licensing terms.
- CI runs full pipeline; smoke-test composer/npm/pip parse the new license metadata.

**Exit:** PR merged into `acumenus/Parthenon`, CI green, CLA gating new external PRs, no production breakage at `parthenon.acumenus.net`.

### Phase 2 — CE extension points (Weeks 3–6, ~4 weeks)

Add the 8 extension-point seams in CE. All work is **AGPLv3, in public Parthenon**. Each ships as its own PR with documentation and tests. Order is roughly:

1. `AuthDriver` registry (refactor existing Sanctum + Authentik).
2. `TenantResolver` + tenant-aware Eloquent scopes (default = single-tenant; behavior unchanged).
3. `CryptoProvider` interface.
4. `AuditSink` interface.
5. `ObservabilityShipper` interface.
6. Frontend `featureFlags` + `<EnterpriseGate>` component.
7. Acropolis installer phase registry.
8. Compose composition contract documentation.

PRs are independent; can be parallelized if more contributors are available. Each preserves byte-identical CE behavior via the default implementation.

**Exit:** All 8 PRs merged; `docs/architecture/extension-points.md` complete; integration tests prove default implementations preserve CE behavior; ROADMAP updated.

### Phase 3 — EE repo bootstrap (Week 7)

Stand up `acumenus/Parthenon-EE` (private) and the sync infrastructure.

- Create the private repo.
- Add `LICENSE-EE`, `COMMERCIAL.md`, `THIRD_PARTY_LICENSES.md`, private `README.md`.
- Bootstrap directory structure (`parthenon/`, `enterprise/`, `scripts/`, `.github/`).
- Wire CE in via `git subtree add --prefix=parthenon parthenon-remote <tag> --squash` at the latest CE tag.
- Write `scripts/sync-from-ce.sh` + GH Action for daily sync.
- Write `scripts/build-ee.sh` (CE+EE → container images).
- Write `scripts/verify-no-ce-patches.sh` (pre-commit + CI gate).
- Set up self-hosted GH Actions runner on `beastmode`.
- Create private GHCR namespace (`ghcr.io/acumenus/parthenon-ee-*`); push sample image.
- Set up cosign signing for EE artifacts; SBOM generation via syft.
- Configure repo branch protection + CODEOWNERS (Acumenus-employees-only on EE).

**Exit:** EE repo exists; sync script proves a CE→EE merge with no conflicts; CI runs CE tests against bundled CE source; sample EE container image builds, is signed, pushes to private GHCR; pre-commit guard rejects a test patch to `parthenon/`.

### Phase 4 — First-pass EE migration (Weeks 8–10, ~3 weeks)

Move actually-EE assets out of public CE and into private EE. Each move is **two coordinated PRs**: one removing from CE, one adding to EE, landed together by a maintainer.

**Move from CE → EE:**

| Asset | CE location | EE location |
|---|---|---|
| Acropolis enterprise compose | `acropolis/docker-compose.enterprise.yml` | `enterprise/acropolis/docker-compose.enterprise.yml` |
| n8n config | `acropolis/config/n8n*` | `enterprise/acropolis/n8n/` |
| Superset config | `acropolis/config/superset*` | `enterprise/acropolis/superset/` |
| DataHub config | `acropolis/config/datahub*` | `enterprise/acropolis/datahub/` |
| Wazuh config | `acropolis/config/wazuh*` (if present) | `enterprise/acropolis/wazuh/` |
| K8s/Helm charts | `acropolis/k8s/` | `enterprise/k8s/` |
| Enterprise installer phases | `acropolis/installer/` enterprise phase modules | `enterprise/installer/phases/` |
| Enterprise docs | `docs/handoffs/*-enterprise-*`, `docs/architecture/*-enterprise-*` | `enterprise/docs/` |
| Keycloak migration code (per ROADMAP v1.2 — placeholder) | (not yet present) | `enterprise/auth/keycloak/` |

**Build new in EE (no CE removal):**
- Keycloak `AuthDriver`.
- SAML 2.0 `AuthDriver` (e.g., `aacotroneo/laravel-saml2` or `simplesamlphp/simplesamlphp`).
- SCIM 2.0 controllers + `ScimSyncService`.
- `MultiTenantResolver` (subdomain-based default).
- `FipsCryptoProvider`.
- `SignedAuditSink` (S3/Azure WORM).
- Datadog/Splunk shippers.
- Parthenon Operator skeleton (CRDs + reconciler stubs; full operator deferred to v1.2).
- License module (JWT validation + entitlement checks).

**Bookkeeping:**
- CE `README` mentions "Enterprise Edition available — see `LICENSING.md` / `licensing@acumenus.net`."
- CE `ROADMAP` updated to reflect v2.0 enterprise edition status.
- 1-version deprecation window: files moved out of CE remain in CE main with a deprecation notice pointing to EE for one minor release before removal.

**Exit:** EE container images build green; EE customer install path works on a clean test VM; investor/beta-tester demo flow rehearsed end-to-end; CE behavior unchanged for community users; deprecation notices visible on Acropolis enterprise files in CE.

### Phase exit summary

| Phase | Weeks | Outcome |
|---|---|---|
| 0 | Week 0 (3 days) | Legal + CLA scaffolding, EULA placeholder, fork-user notifications |
| 0.5 | Week 0–1 (2 days) | `sudoshi/Parthenon` → `acumenus/Parthenon`; org teams + branch rulesets |
| 1 | Weeks 1–2 | AGPLv3 live in CE |
| 2 | Weeks 3–6 | 8 extension points in CE (all public, AGPL) |
| 3 | Week 7 | EE repo + sync infra live |
| 4 | Weeks 8–10 | First-pass EE migration; investor-grade demo path |

---

## 8. Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| CLA gap — past contributor refuses retroactive consent, blocking dual-licensing for one file | Low (heritage audit clean) | High | Heritage audit found no surviving substantial contributions. If a future contributor refuses, isolate the file; rewrite if needed. |
| EE accidentally patches CE — maintainer slips and edits `parthenon/` in EE | Medium | High (legal line erodes) | Pre-commit hook + CI gate (`verify-no-ce-patches.sh`) reject diffs touching `parthenon/*` outside merge commits. |
| CE refactor breaks an EE extension point | Medium | Medium | Each extension point has a documented contract test in CE. EE's daily sync CI catches breakage day-1. |
| AGPLv3 §13 viral terms scare community users | Medium | Medium | LICENSING.md clarifies that internal use within an organization is fine; only modified versions accessed over a network trigger §13. Commercial license offer skirts §13. |
| Investor wants a different license late (BUSL, MPL, dual MIT/commercial) | Medium | High if late | Phase 0 has a "decide license" gate; CLA covers re-licensing rights so post-Phase-1 changes are still possible. |
| GHCR rate limits or transfer breakage during org migration | Low | Medium | Schedule transfer for low-traffic window; pre-validate on a dummy repo first; keep `ghcr.io/sudoshi/*` images live for one minor version. |
| Multi-tenant refactor changes CE migrations in subtle ways that hurt single-tenant deployments | Medium | High | Tenant columns added as nullable with default tenant resolver; integration tests verify single-tenant behavior is byte-identical. |
| Customer expects source escrow we didn't architect for | Medium | Medium | `COMMERCIAL.md` explicitly states "source escrow available via Iron Mountain at customer cost." No direct repo access. |
| EE sync conflicts on Acropolis enterprise files moved out of CE | Low | Low | Phase 4 paired-PR pattern; 1-version deprecation window. |
| Federated learning / Hive Networks pilots running on Apache 2.0 receive a license-change surprise | Medium | High to relationships | Phase 0 mandates written ack from private fork users before Phase 1 merges. |
| Bot PRs (Sentinel/Bolt/Palette/Jules) blocked by CLA | High | Low | Bot identity accepts CLA on company's behalf via CLA Assistant bypass token. |
| OHDSI community optics — perceived "going proprietary" backlash | Medium | Medium | Public messaging emphasizes: full research platform stays AGPL, EE = enterprise infra/scale/compliance only. Cite GitLab/Mattermost precedent. |

---

## 9. Open Questions Resolved

| # | Question | Resolution |
|---|---|---|
| 1 | EE EULA author | **Claude drafts placeholder for counsel review.** Marked "DRAFT — not legally executable" until counsel signs. |
| 2 | Pricing model | **Off-repo.** `COMMERCIAL.md` describes structure without prices. |
| 3 | Telemetry / phone-home | **Future**, once Hyperscaler Terraforms ready. Design extension point now (`Telemetry/` directory in EE), wire later. Not blocking Phase 4. |
| 4 | Commons / Hive Networks federation in CE or EE | **Defer.** Default = stay in CE. Revisit when first EE customer conversations clarify whether multi-org Hive federation is paid. |
| 5 | Acumenus-hosted Abby AI | **Yes, future.** EE-only managed Abby with fine-tuning post-Hyperscaler-Terraforms. Not Phase 4 scope. |
| 6 | EE customer contributing to CE | **Standard CLA path.** Customer signs CLA via CLA Assistant on their first PR like any external contributor. |
| 7 | Trademark policy file | **Standalone `TRADEMARKS.md`** (not bundled into LICENSING.md). |

---

## 10. v2.5 Path: Overlay → Packages

Once EE has paying customers and revenue funding the refactor, migrate from "EE consumes CE subtree" to "EE consumes CE packages" (Approach C):

- **CE backend** → publish `acumenus/parthenon-backend` to a private Packagist mirror or GitHub Packages composer registry.
- **CE frontend** → publish `@acumenus/parthenon-frontend` to npm (private).
- **CE AI service** → publish `acumenus-parthenon-ai` to a private PyPI mirror.
- **CE infra** → split Acropolis community into per-service Helm subcharts.

EE then declares CE packages as dependencies, applies overlays via package extension points, no source check-in of CE in EE. This is what GitLab CE/EE looked like at v8+; expect ~3 months of refactor.

**v2.5 trigger:** any of —
- (a) EE engineer count > 5 (sync overhead becomes painful),
- (b) EE customer SLA requires faster release cadence than CE supports, or
- (c) need to ship a fully separable Parthenon Operator that customers install without the source.

---

## 11. Definition of Done for This Initiative

- `acumenus/Parthenon` (public, AGPL-3.0-only) is the canonical CE repo; transfer redirects from `sudoshi/Parthenon`.
- `acumenus/Parthenon-EE` (private, commercial EULA) exists, builds, signs, and pushes to private GHCR.
- 8 CE extension points are live, documented, tested.
- EE first-pass migration is complete: enterprise infra, SAML/SCIM/Keycloak drivers, multi-tenancy, FIPS, signed audit, observability shippers all functional in EE.
- Investor demo path: spin up CE on a workstation; spin up EE on a customer-grade environment; show same UI, more capabilities (multi-tenant switcher, SAML login, FIPS mode, Datadog dashboards).
- CLA Assistant active; EULA placeholder in EE awaiting counsel signoff; trademark policy live.
- Existing `parthenon.acumenus.net` production deployment unchanged.
- Private fork users notified and acknowledged.
- ROADMAP and `LICENSING.md` reflect the new world.

---

## 12. Out of Scope (explicitly)

- Full Parthenon Operator implementation (deferred to v1.2; only skeleton CRDs + reconciler stubs in this window).
- Acumenus-hosted Abby AI service (deferred to post-Hyperscaler-Terraforms).
- Telemetry phone-home implementation (extension point only; full implementation deferred).
- Migration to Approach C (packages) — that's the v2.5 path.
- Rewriting the Parthenon application itself — this is purely structural.
- Kubernetes operator development beyond CRDs/reconciler stubs.
- BUSL or other license alternative — locked at AGPLv3 for CE.
- Trademark registrations (filing) — that's a parallel legal effort with counsel, not part of this initiative.
- Existing Phase 3 application work (cohort phase 2, ingestion templates, etc.) continues independently.

---

## Appendix A — File touchpoints summary (for plan-writers)

**New files to create in CE:**
- `LICENSE` (replace) — AGPL-3.0 verbatim
- `NOTICE` (new)
- `LICENSING.md` (new)
- `TRADEMARKS.md` (new)
- `docs/architecture/extension-points.md` (new, grows over Phase 2)
- `backend/app/Contracts/AuthDriver.php` (new)
- `backend/app/Contracts/TenantResolver.php` (new)
- `backend/app/Contracts/CryptoProvider.php` (new)
- `backend/app/Contracts/AuditSink.php` (new)
- `backend/app/Contracts/ObservabilityShipper.php` (new)
- `frontend/src/components/EnterpriseGate.tsx` (new)
- `frontend/src/stores/featureFlagsStore.ts` (extend existing or new)

**Existing files to modify in CE:**
- `README.md` (badge + EE pointer)
- `CONTRIBUTING.md` (CLA + dual-license)
- `backend/composer.json` (license, name, keywords)
- `frontend/package.json` (license, repository)
- `ai/pyproject.toml` (license, authors)
- `templates/pyproject.toml` (license)
- `ROADMAP.md` (v2.0 enterprise edition status)
- `docker-compose.community.yml` (`ghcr.io/sudoshi/` → `ghcr.io/acumenus/`)
- All CI workflow files (org rename + tests for extension points)

**Files/dirs to move CE → EE:**
- `acropolis/docker-compose.enterprise.yml` → `enterprise/acropolis/docker-compose.enterprise.yml`
- `acropolis/config/n8n*` → `enterprise/acropolis/n8n/`
- `acropolis/config/superset*` → `enterprise/acropolis/superset/`
- `acropolis/config/datahub*` → `enterprise/acropolis/datahub/`
- `acropolis/config/wazuh*` (if present) → `enterprise/acropolis/wazuh/`
- `acropolis/k8s/` → `enterprise/k8s/`
- `acropolis/installer/` enterprise phase modules → `enterprise/installer/phases/`
- Enterprise docs (`docs/handoffs/*-enterprise-*`, `docs/architecture/*-enterprise-*`) → `enterprise/docs/`

**Files/dirs to delete from CE:**
- `package-lock.json` (root, 88-byte stub)

**New files to create in EE:**
- `LICENSE-EE` (commercial EULA placeholder)
- `COMMERCIAL.md`
- `THIRD_PARTY_LICENSES.md`
- `README.md` (private)
- `CE_VERSION` (pinned CE sha)
- `docker-compose.ee.yml`
- `scripts/sync-from-ce.sh`
- `scripts/build-ee.sh`
- `scripts/verify-no-ce-patches.sh`
- `.github/workflows/ce-sync.yml`
- `.github/workflows/ee-ci.yml`
- `.github/workflows/ee-release.yml`
- `enterprise/backend/src/Auth/{Keycloak,Saml,Scim}Driver.php`
- `enterprise/backend/src/Tenant/MultiTenantResolver.php`
- `enterprise/backend/src/Crypto/FipsCryptoProvider.php`
- `enterprise/backend/src/Audit/SignedAuditSink.php`
- `enterprise/backend/src/License/LicenseValidator.php`
- `enterprise/frontend/src/features/admin-enterprise/` (SAML/SCIM/multi-tenant UIs)
- `enterprise/operator/` (CRD skeletons)

---

*End of design.*
