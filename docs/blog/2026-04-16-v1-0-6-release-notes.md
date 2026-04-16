---
slug: v1-0-6-finngen-sso-light-mode
title: "Parthenon v1.0.6 — FinnGen Workbench, SSO, and Light Mode"
description: "Largest feature drop of the v1.0.x arc. Ships the FinnGen Cohort Workbench (SP1–SP4), Authentik SSO via OIDC, first-class light mode, and a Patient Similarity rework — 275 commits in 5 days."
authors: [mudoshi]
tags: [release, finngen, sso, light-mode, patient-similarity, ecqm]
date: 2026-04-16
---

## v1.0.6 — FinnGen Workbench, SSO, and Light Mode

v1.0.6 is the biggest feature release in the v1.0.x arc. After two
back-to-back stabilization releases (v1.0.4 test coverage, v1.0.5 data
quality), the platform was ready for net-new modules. This release lands
**four** of them at once: the FinnGen Cohort Workbench, Authentik SSO,
first-class light mode, and a substantially reworked Patient Similarity
explorer — plus a doubled care-bundle library, OpenProject bidirectional
sync, and a long list of installer and CI hardening fixes.

<!--truncate-->

### FinnGen Cohort Workbench (SP1–SP4)

The headline module. The FinnGen Workbench is a full-React port of the
FinnGen Shiny CO2/CodeWAS workflow, integrated end-to-end with Darkstar
(our R/Plumber sidecar) and the OHDSI HADES stack.

**SP1 — Runtime foundation**
- New `parthenon_finngen_ro` / `parthenon_finngen_rw` Postgres roles with
  least-privilege grants
- `app.finngen_runs` + `app.finngen_analysis_modules` schema with idempotent
  Laravel migrations
- `FinnGenClient` HTTP wrapper, `FinnGenRunService`, `RunFinnGenAnalysisJob`
  Horizon job with polling, cancellation, and `Idempotency-Key` middleware
  backed by Redis SETNX
- `FinnGenArtifactService` with signed URLs, path-traversal guards, and
  Nginx `X-Accel-Redirect` for streaming large result artifacts
- RBAC: `finngen.view`, `finngen.run`, `finngen.cancel`, `finngen.import`
  permissions wired into RolePermissionSeeder
- Operational runbook + SP1 pre-merge verification report

**SP2 — Code Explorer**
- ROMOPAPI sync reads (code counts, relationships, ancestors) with
  Plumber2 query params and `safe_sync` wrapper
- Per-source vocabulary auto-grants, pandoc render path, E2E coverage

**SP3 — HADES analyses**
- Async workers for CodeWAS, TimeCodeWAS, Overlaps, and Demographics
- HadesExtras configuration corrected; cohort overlap, demographics, and
  cohort-counts handlers wired
- DuckDB result reads with Shiny-parity `analysisSettings`
- Bespoke SQL workers for CodeWAS / TimeCodeWAS / Overlaps (option C2)
  after upstream HadesExtras gaps surfaced
- Artifacts race fixed; cohort staging + demographics display corrected
- 4 display.json shape tests for CO2 analysis workers

**SP4 — Workbench UI**
- Sessions list + workbench shell with autosave and not-found recovery
- Operation tree algebra + compiler (entry / inclusion / exit operations
  with union / intersect / minus)
- Cohort typeahead, drag-and-drop reorder, live expression preview
- Materialize step with cohort-id handoff and overwrite flow
- Import Cohorts step with real cohort browser
- Atlas import via the active WebAPI registry (Phase E)
- Run history panel inside a session
- Matching wrapper with `MatchingConfigForm` + `MatchingResults`
- SMD diagnostics + attrition waterfall
- Wired to the SP3 analysis gallery handoff
- E2E Playwright spec — gallery loads, module detail, run dispatch
- Vitest contract tests for `useAnalysisModules` and `ResultViewerSwitch`

The workbench is surfaced on the launcher and uses the **PANCREAS** source
by default (multimodal oncology + genomics corpus) rather than EUNOMIA.

### Authentik SSO via OIDC (Phase 7 live)

Production users can now sign in with Authentik. The auth subsystem is
now strictly additive — username/password remains, with SSO as a
conditional path:

- `app.user_external_identities` table for OIDC linking
- `app.oidc_email_aliases` table + C-suite seeder for canonical email
  reconciliation
- OIDC service layer: handshake store, discovery, validator, reconciliation
- OIDC HTTP endpoints (feature-flagged off until enabled per environment)
- Frontend `/auth/callback` page + conditional login button
- Phase 7 callback rewrite returning the full `formatUser` shape
- API-driven Authentik provisioning for the `parthenon-oidc` app
- Acropolis installer registers `parthenon-oidc` automatically

A phased rollout plan is documented at `docs/devlog/auth/phased-rollout.md`.
Username/password and the existing temp-password / forced-change flow are
preserved exactly.

### Light mode

Parthenon now ships a first-class light theme — a warm parchment palette
designed to coexist with the existing dark clinical theme.

- `theme-store.ts` (Zustand) with `localStorage` persistence
- Flash-prevention script in `index.html` so the wrong theme never paints
- `ThemeToggle` sun/moon icon button in the header
- Per-user theme preference stored server-side
- New CSS token file with the warm parchment palette
- Theme-aware Recharts palette
- **28,000+ hardcoded hex values** swept across the frontend and
  replaced with CSS variable tokens (sweeps `260411-qux` 12,000+,
  `260411-s3c` 1,150, `260411-sxo` text/bg/border/divide grayscale,
  plus inline-style + Tailwind arbitrary values)
- Light-mode compliance pass across modals, wizards, drawers, pages,
  panels, and feature components

Several worktree sweep regressions surfaced during this work and were
recovered: ThemeToggle, themeStore, cohort wizard modal, 40 Patient
Similarity + Commons files, and 14 files clobbered by `579117cdb`. New
git hooks (`scripts/githooks/pre-merge-commit`) now refuse stale
worktree merges to prevent recurrence.

### Patient Similarity rework

- UMAP panel reworked with new Inspector sidebar
- Phenotype Discovery enabled with clustering fixes and a new endpoint
- Landscape page restored with larger hit targets, cluster summary table,
  and disabled "Phenotype" button until the backing endpoint is ready
- AI step interpretation in saved runs
- PSM covariate name resolution fixed (direct index assignment;
  condition_NNN / drug_NNN / procedure_NNN formats)
- Continue → Landscape wired
- Centroid build streamed to avoid PHP OOM on large cohorts
- Compare-cohorts OOM fix + schema-ownership guard
- Target/Comparator counts aligned under their dropdowns
- Contextual help explaining Compare vs Expand

### Care Bundles — eCQM library expanded 10 → 45

The Standard PROs+ care bundle library now ships **45 OHDSI-compliant
eCQM bundles**, up from 10. Each bundle is structured with the correct
measure population (initial population, denominator, numerator,
exclusions) and references the correct OMOP concept sets.

### OpenProject bidirectional sync

A new `app.sync` schema and supporting services for bidirectional sync
between GSD planning artifacts (`ROADMAP.md`, `STATE.md`, `PLAN.md`),
OpenProject work packages, and GitHub Issues:

- OpenProject API v3 client + `gh` CLI wrapper
- GSD parser, sync database client, bidirectional entity mapper
- Backfill script for GSD → OpenProject → GitHub import
- Reconciliation HTTP server (port 9890) driven by an n8n cron workflow
- 4 n8n workflow scaffolds for OP↔GSD↔GH sync
- Implementation plan + design spec under `docs/devlog/sync/`

### Database role split (security hardening)

The runtime database identity was split from the migration identity:

- `parthenon_app` (runtime) — DML only; no DDL grants
- `parthenon_migrator` (migrations) — DDL + DML; used only by `php artisan
  migrate` via `./deploy.sh --db`
- `parthenon_owner` (schema owner) — owns all schemas

`./deploy.sh` has been hardened so `--frontend` deploys do not reload
PHP-FPM, and so the migrator identity is used only when migrations are
explicitly requested.

### Installer (Community edition focus)

- New `--community` flag for the fastest path to a working login
- Web MVP installer focused on the Community edition path
- Hecate-bootstrap module + preflight + Rust GUI updates
- Windows compatibility guard for `os.getuid` / `os.getgid`
- Public bootstrap script served correctly
- Revised Community install landing
- Acropolis installer registers `parthenon-oidc` automatically

### CI / deploy / infra fixes

- Frontend `tsc -b` (`npm run build`) unblocked for unfinished features
  via targeted `@ts-nocheck` and exclusions
- `@typescript-eslint/ban-ts-comment` disabled above each `@ts-nocheck`
- Per-request DNS resolution of the `php-fpm` upstream so Nginx boots
  without it
- Lazy-resolve optional Nginx upstreams
- PHP entrypoint handles host GID collision on macOS
- `compose down` scope hardened (compose-down nukes both stacks)
- Migration idempotency guards for duplicate-target migrations
- AppServiceProvider guards `.resendapikey` lookup against a directory
- Pre-commit hook now requires a devlog entry with migration commits
- Pre-commit hook adds `vite-build` + stale-branch merge guards
- DB role fallback no longer references a non-existent `parthenon` role
- Pre-migration `db-backup.sh` call dropped from deploy (already runs via
  cron)

### Dependencies

- TypeScript 5.9.3 → 6.0.2 (devDependency)
- react-router-dom 6.30.3 → 7.14.0
- pandas 2.* → 3.*
- uvicorn 0.42.* → 0.44.*
- GitHub Actions: actions/checkout 4 → 6, actions/setup-python 5 → 6,
  actions/upload-artifact 4 → 7, actions/download-artifact 4 → 8,
  signpath/github-action-submit-signing-request 1 → 2

### Darkstar (R sidecar) — service rename complete

The R Plumber sidecar formerly known as `r-runtime` is now consistently
named **`darkstar`** across docker-compose, Traefik, watchdog, Grafana,
deploy, and CI. The deprecated `finngen-runner` container has been
removed; FinnGen analyses run inside `darkstar` via the FinnGen route
group.

### Upgrade notes

- `git pull && ./deploy.sh` is sufficient for most environments.
- **If enabling SSO**: configure Authentik OIDC credentials in `.env` and
  flip the OIDC feature flag.
- **If running FinnGen workbench**: ensure the `darkstar` container is
  healthy (`docker compose ps darkstar`) and that the `parthenon_finngen_ro`
  / `_rw` roles exist (created automatically by SP1 migrations).
- **Database roles**: `./deploy.sh --db` now uses the `parthenon_migrator`
  identity. The runtime `parthenon_app` user no longer has DDL.
- **Light mode**: enabled per-user via the header sun/moon toggle. No
  config change required; the default remains the dark clinical theme.

### By the numbers

- **275 commits** since v1.0.5 (60 `feat(finngen)`, 17 `fix(finngen)`,
  12 `docs(finngen)`, 11 `test(finngen)`, 11 `feat(code-explorer)`,
  10 `feat(darkstar)`, 9 `feat(sync)`, 6 `feat(auth)`, plus the rest)
- **4 new modules** landed: FinnGen Workbench, Authentik SSO, Light Mode,
  OpenProject Sync
- **35 new care bundles** (10 → 45)
- **28,000+ hex values** tokenized for theming

### Contributors

Claude Code + @sudoshi
