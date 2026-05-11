---
slug: v1-0-7-ce-ee-fork-extension-points-agplv3
title: "Parthenon v1.0.7 — CE/EE Fork, Extension Points, AGPLv3"
description: "Ground-up architectural release. Splits Parthenon into Community and Enterprise editions with 8 extension points, completes the AGPLv3 relicense, lands Harmonia AI concept-mapping, ships managed OHDSI Shiny + 4 industry templates, and closes 4 critical Sentinel security findings — 895 commits in 24 days."
authors: [mudoshi]
tags: [release, ce-ee, extension-points, agplv3, harmonia, shiny, security]
date: 2026-05-10
---

## v1.0.7 — CE/EE Fork, Extension Points, AGPLv3

v1.0.7 is the largest architectural release in the v1.0.x arc. Where v1.0.6
was a feature drop (FinnGen, SSO, light mode), v1.0.7 is the foundation
work that makes Parthenon a *platform* — a Community edition (AGPLv3) that
remains fully usable on its own and an Enterprise edition that swaps in
proprietary drivers for auth, tenancy, crypto, audit, observability,
feature flags, installer phases, and compose composition.

It also completes the AGPLv3 relicense, ships **Harmonia** (AI-assisted
concept-mapping with a reviewer UI), lands **four new industry templates**
(NAACCR, STS, NCDR, lis_lab_to_omop), brings up the **managed OHDSI Shiny
runtime**, and closes four critical Sentinel security findings.

<!--truncate-->

### CE/EE fork — Plans 01-04

Parthenon now has two editions sharing one source tree:

- **Community Edition (CE)** — AGPLv3, fully featured, single-tenant defaults.
  Everything in this repo is CE.
- **Enterprise Edition (EE)** — proprietary, layered on top via the eight
  extension points below. EE lives in `Acumenus-Data-Sciences/Parthenon-EE`
  with a sync from CE main.

Plan 01 handled the legal foundation: relicense from Apache-2.0 to
AGPL-3.0-only (#314), org transfer from `sudoshi/Parthenon` to
`Acumenus-Data-Sciences/Parthenon` (#311), CI license guard
(`license-text`, `license-metadata`, `notice-and-trademarks` jobs in #312).

Plans 02-04 are the architectural work — extension points, industry
templates, and the Phase 4 spec set. The detailed phase plans live in
`docs/lineage/archive/specs/` and `docs/lineage/archive/plans/`.

### Eight Phase 2 extension points

Every "place where EE swaps in proprietary code" is now a contract with a
default CE implementation, a typed interface, and a dependency-injection
seam. All eight landed in v1.0.7:

| # | Extension point | PR | What CE ships, what EE swaps |
|---|------------------|----|------------------------------|
| 1 | **AuthDriver** | #315 | CE: Sanctum + Spatie. EE: Authentik OIDC, Keycloak, SAML |
| 2 | **TenantResolver** | #316 | CE: single-tenant. EE: multi-tenant via host/header/JWT claim |
| 3 | **CryptoProvider** | #317 | CE: Laravel Crypt. EE: HSM/KMS-backed key wrapping |
| 4 | **AuditSink** | #318 | CE: stdout/log file. EE: SIEM (Wazuh, Splunk, Elastic) |
| 5 | **ObservabilityShipper** | #319 | CE: local Grafana. EE: Datadog, New Relic, OTel collectors |
| 6 | **FeatureFlags** | #320 | CE: env + `featureFlags` Zustand store + `EnterpriseGate` component |
| 7 | **AcropolisPhases** | #321 | CE: built-in installer phases. EE: discoverable phase plugins |
| 8 | **ComposeContract** | #322 | CE: composition contract verifier (`scripts/verify_compose_contract.py`) |

A devlog landed late in the cycle adding `--check-infra-overlay` mode to
the compose verifier so CE-bundled Acropolis overlays are validated as
EE-style overlays without false positives.

### Harmonia — AI-assisted concept-mapping (Plans 6+7)

The concept-mapping decision layer is now a first-class module called
**Harmonia**:

- **Plan 6 (#292)** — backend: AI suggestion service, scoring, candidate
  generation, batch processing pipeline (Llettuce on HOLD as T-024B blocker)
- **Plan 7 (#293)** — reviewer UI + ARTEMIS R-install fixes
- "Read, Write, Think" blog post explains how Plan 6 closes the
  concept-mapping stack

Harmonia integrates with the existing OMOP vocabulary tables and the
Aqueduct ingestion pipeline.

### Industry templates (Phase 3)

Four new commercial templates landed:

- **NAACCR cancer registry (T-022A, #287)** — Plan 4A
- **STS National Database (T-022B, #288)** — Plan 4B
- **lis_lab_to_omop (T-023, #291)** — Plan 5
- **NCDR** — column map + types + reader, SQL stages, manifest, fixture,
  E2E test, README (in `templates/commercial/`)

Plus an earlier **SDTM → OMOP v5.4 bridge** (Plan 6, T-016 + T-020, #274)
and **ARTEMIS chemo regimens** (Phase 2 Plan 5, T-019b, #275).

### Managed OHDSI Shiny runtime

Parthenon now manages OHDSI Shiny app launches end-to-end:

- Result manifest contract + result loader readiness
- Official OHDSI viewer handoff with deepened schema guards
- Launch metrics + throttle context surfaced
- Managed launch workspaces with pruning
- Smoke tests for official module entrypoints
- Tenant grants fixed for managed Shiny smoke setup
- HADES freshness + parity work

A dedicated devlog at `docs/lineage/modules/analyses/2026-05-09-hades-parity-managed-ohdsi-shiny-runtime.md` documents the runtime architecture.

### Aqueduct ingestion templates

The Aqueduct templates contract now ships end-to-end:

- Run progress, current_node, timestamps, error_message exposed
- Cancel + reconciliation flow
- DB credentials wired correctly; pending migrations run reliably
- Type tightening + tests + runbook
- Comprehensive session devlog committed

### Frontend i18n — 121 commits

A sustained i18n hardening pass: locale coverage, fallback handling,
missing-key detection, Arabic locale alignment with backend hidden flag,
i18n resource null placeholder support, hard-coded string elimination.

### CMS Measures — 72 eCQM titles backfilled

VSAC value-set imports were missing 72 CMS eCQM measure titles. Backfilled
in #b5f32d381 (`b5f32d381`), exposed via a sortable + filterable Measures
page (#76e87577a), with title column added to VSAC measures table.

### GIS Phase 19 — county stratification

- `gis` schema deployed with HIGHSEC GRANT posture (Phase 19-02)
- Eloquent models + dataset registration + legacy audit (19-02)
- Nationwide multi-source `load_geography` + `load_crosswalk` (19-03)
- UA county loader + README + conftest env override (19-03)
- IncidenceRateService `location_urban_pct` + FormRequests (19-04)
- Frontend `stratifyByLocation` dropdown + Pancreas warning (19-04)
- Legacy GIS loader remediation + DSN regression guard (19-05)
- Search_path PostGIS fix + boundary explorer + OHDSI todo consolidation

### Installer GUI v0.3.0 (Tauri)

The cross-platform GUI installer made it through Phases 1-8 in this cycle:

- **Phase 1** — cross-platform `run_elevated()` primitive
- **Phase 2** — Linux polkit policy + privileged helper
- **Phases 3+4** — Fix-this UI + Linux Docker auto-install
- **Phase 5** — recovery panel HTML/CSS + Rust shims, Resume/Retry/Reset
- **Phases 6a-c** — Windows action handlers + UAC dispatch, WSL2 + VM Platform
  preflight detection, reboot state persistence + welcome-back banner
- **Phase 7** — macOS Docker Desktop / Colima / Rancher
- **Phases 8a-b** — server-mode setup (Caddy + Let's Encrypt + UFW)

Plus Hero Done page, 9-cell phase progress strip, Verify step health probe,
service-status grid + runtime-image upgrade prompt, auto-updater notify
banner, Tauri 2 plugin migration (dialog/shell/store/updater), WSL distro
enumeration, four P0 fixes from Linux Phase A bench testing.

### Installer-c (contract layer)

The contract-driven installer engine reached feature parity with the GUI:

- `omop_cdm` phase complete (run + check, shell-injection / password-exposure
  / output-capture fixes)
- New contract actions: `health`, `credentials`, `service-status`, `open-app`,
  `port-holder`, `recover`, `diagnose`
- 50-fingerprint diagnostic KB (10 seed → 50 expanded)
- End-to-end round-trip tests for new actions

### Security — Sentinel findings

Four critical/high findings closed in this cycle:

- **CRITICAL** — SQL injection bypass in DataInterrogationService (#298)
- **CRITICAL** — plaintext password leak in logs (#294)
- **CRITICAL** — hardcoded Orthanc credentials (#280)
- **HIGH** — SQL safety bypass in DataInterrogationService (#279)

Plus per-route permissions on `/study-agent/*`, FormRequest `authorize()`
hardening, Wazuh ports bound to localhost with token-based healthchecks,
and the existing HIGHSEC.spec.md continues to be enforced.

### Studies + Patient Similarity hardening

- Studies: protocol import → study designer; OCC/`if-unmodified-since`
  precondition on lock endpoint; lock-race guard; dirty-form unsaved-changes
  warning; orphan `StudyDesigner.tsx` (1380 LOC dead code) removed; default
  Anthropic study designer to Opus
- Patient Similarity: temporal compare validation; workspace workflow repair
- Care Bundles: workbench workflow hardening; VSAC measures table title column

### CI / deploy / infra fixes

- **deploy** — auto-heal composer autoloader poisoned by `/tmp` worktree paths
  (this prevents the worktree-vendor incident captured in feedback memory)
- **docker** — install `libuv1-dev` so R `fs` package builds; preserve
  `.gitignore` mode in php entrypoint chmod sweep; fix scispacy
  `en_core_sci_md` wheel URL (was 404)
- **ci** — pin `DB_TEST_*` env vars to CI postgres service; share ingest
  timestamp across wiki pages; AI review advisory; Darkstar build
  timeout 60→120; PostGIS for FinnGen migrations; align frontend Arabic
  locale + tests with backend hidden flag
- **test-infra** — respect CI env when resolving test DB host; only patch
  `*_testing` config when broken
- **docs** — harden docs deploy build; harden docs content tree deployment;
  auto-fix duplicate blog slugs

### Dependencies

- **Frontend** — `@tanstack/react-query` (#308), `react-joyride` 3.0.2→3.1.0
  (#310), `zod` 4.3.6→4.4.3 (#309), `deck.gl` 9.2.11→9.3.2 (#237)
- **AI** — `transformers` (#302), `esda` >=2.5→>=2.9.0 (#305), `cyvcf2`
  >=0.31.0→>=0.32.1 (#304), `asyncpg` >=0.30.0→>=0.31.0 (#303), `spreg`
  >=1.4→>=1.9.0 (#300), `geopandas` >=1.0.0→>=1.1.3 (#248), `scikit-learn`
  (#249)
- **GitHub Actions** — `actions/github-script` 7→9 (#301),
  `astral-sh/setup-uv` 3→7 (#299)
- **Production deps group** — 7 updates (#307)
- **Dev deps group** — 2 updates (#306)

### Org transfer + license

The repo moved from `sudoshi/Parthenon` to
`Acumenus-Data-Sciences/Parthenon` on **2026-04-26** (#311). GitHub
auto-redirects, but please re-set your remotes:

```bash
git remote set-url origin git@github.com:Acumenus-Data-Sciences/Parthenon.git
```

License changed from **Apache-2.0** to **AGPL-3.0-only** (#314). All
existing source contributions are re-licensed under AGPL-3.0-only per the
relicense plan; see `LICENSE`, `NOTICE`, and `docs/legal/`.

### Upgrade notes

- `git pull && ./deploy.sh` is sufficient for most environments.
- **No config changes required** for upgrade from 1.0.6.
- **EE consumers**: review `docs/lineage/design/architecture/extension-points/` for the
  eight contract interfaces before subclassing.
- **Org rename**: update remote URLs (auto-redirected by GitHub but cleaner
  to fix).
- **License**: AGPL-3.0-only is now the project license. If you fork CE
  to a service, AGPL §13 applies — you must offer source to your users.

### By the numbers

- **895 commits** since v1.0.6 (2026-04-16 → 2026-05-10, 24 days)
- **121 `feat(i18n)`** commits — a sustained internationalization push
- **8 of 8** Phase 2 extension points landed
- **4 new industry templates** (NAACCR, STS, NCDR, lis_lab) + 2 from Phase 3
  (SDTM bridge, ARTEMIS)
- **4 critical/high security findings** closed by Sentinel
- **41 dependency updates** via `chore(deps)`
- **27 docs** + 11 `docs(installer)` + 8 `docs(plans)` + 8 `docs(devlog)`

### Contributors

Claude Code + @sudoshi, with PR review by Sentinel and the Acumenus
Data Sciences team.
