---
slug: v1-0-8-publish-library-lifecycle-agentic-copilots
title: "Parthenon v1.0.8 — Publish, Library Lifecycle, and Agentic Copilots"
description: "Three intertwined feature lines land together: the Publish module (server-side drafts, autosave, snapshots, study-scoped sharing), Library Lifecycle management with an admin console, and the first two Claude Agent SDK copilots — 205 commits in 18 days."
authors: [mudoshi]
tags: [release, publish, library-lifecycle, agents, studies]
date: 2026-05-28
---

## v1.0.8 — Publish, Library Lifecycle, and Agentic Copilots

After the v1.0.7 platform/architecture release (CE/EE fork, extension
points, AGPLv3), v1.0.8 returns to the research surface and lands three
intertwined feature lines at once: the **Publish module** for authoring and
sharing study write-ups, **Library Lifecycle management** that gives every
cohort, concept set, and analysis a draft → active → archived state
machine plus an admin console, and the first two
**Claude Agent SDK copilots** — a Study Designer and a Publication
assistant — gated behind a single runtime toggle.

<!--truncate-->

### Publish module

A full authoring surface for turning a study into a shareable write-up,
persisted server-side with no "lost work" failure modes:

- **Server-side drafts** — `PublishPage` loads and saves drafts through the
  API rather than browser state, with a stable `documentHash` for autosave
  deduplication
- **Debounced autosave** with retry and a `beforeunload` guard, surfaced via
  a `SaveStatusIndicator`, `SaveDraftButton`, and a `HybridPromptModal` that
  prompts to save on first edit
- **Snapshots** — `PublicationSnapshotService` with create/list/revert
  endpoints under optimistic locking, wired into `CreateSnapshotModal`,
  `RevertSnapshotDialog`, and a `SnapshotsPanel`
- **Study-scoped sharing** — `PublicationDraftPolicy`, per-draft `visibility`
  and `updated_by_user_id`, a `VisibilityBadge`, a `ShareDropdown`, and a
  read-only wizard mode for viewer collaborators (`Study::scopeAccessibleBy`)
- **Publication library** — `/publish/library` route + `PublicationLibraryPage`

Shipped across PR #339 (Phase 1) and PR #347.

### Library Lifecycle management

Every library artifact — cohort definitions, concept sets, and the eight
analysis types — now carries a lifecycle state, with the plumbing to manage
it at both user and admin scale.

**Model + API (Phases A–B)**
- `HasLibraryLifecycle` trait with `draft` / `active` / `archived`
  transitions, reapplied to 9 models
- Lifecycle columns on `concept_sets`, `cohort_definitions`, and 8 analyses
  tables (folding in the prior `deprecated_at`)
- Owner + super-admin lifecycle policies
- `promote` / `archive` / `restore` endpoints plus bulk-archive and
  bulk-restore
- `RequiresPromotionException` → **409 contract**, with an auto-promote flow
  when a draft artifact is attached to a study
- Default scope hides drafts (for non-owners) and archived items

**List-page UX (Phase B7–B9)**
- Status tabs with live counts on the cohort-definitions, concept-sets, and
  analyses list pages
- Super-admin `scope=all` on list endpoints with an `AllUsersToggle`
  (D1–D2)

**Admin console (Phase D3–D9)**
- `/admin/library` unified index across all artifact types (D3)
- Hard-delete with attachment preflight + audit (D4) — preflight matches
  analyses by fully-qualified class name
- Nightly 30-day purge of soft-deleted items (D5)
- Owner reassignment with permission check + audit (D6)
- Bulk delete, reassign, and trash on the admin page (D7)
- `library:backfill-lifecycle` command for existing rows (D8)
- One-time lifecycle notice toast for end users (D9)

**Cleanup suggestions (Phase C1–C3)**
- Nightly `SuggestLibraryCleanupJob` (C1), a cache table + model, an API
  endpoint (C2), and a suggestions page + banner (C3) surfacing unused
  artifacts

33 `feat(library)` commits, landed across PR #339 and the D-phase series.

### Claude Agent SDK copilots

The first two agentic copilots, built on the Claude Agent SDK and gated so
they can be turned off entirely:

- **Study Designer** (PR #343) — a read-only slice (Phase 0+1) that assists
  study design from inside the Studies workspace
- **Publication agent** (PR #347) — assists manuscript drafting in the
  Publish module, shipped as a read-only Phase 1 and a write/approval
  Phase 2
- **Generalized agent core** (PR #346) — the agent core was refactored for
  multi-profile use so both copilots share one engine (Phase B)
- **Runtime AI Agents toggle** (PR #348) — a single admin switch that gates
  both copilots, replacing the earlier `publish.agent` feature flag

### Studies v2

- **Compiler Workbench v2** promoted to default, with v1 fidelity restored
- Create wizard shell with an 8-step stepper (Phase 3) and a version popover
  wired to the wizard footer
- Post-flip audit closeout (H1–H5, M1–M19, L3–L4) plus 204 new i18n keys
- `Study::scopeAccessibleBy` for collaborator lookups

### Hypertension v3 outcomes study

The Hypertension v3 study was redesigned and run end-to-end on the Acumenus
OMOP CDM as a real-world exercise of the new surfaces:

- v3 cohort redesign + manuscript update
- 12 OHDSI negative controls with empirical-null calibration
- End-to-end study run on the Acumenus OMOP CDM (1M patients)

### Dependencies

- Documented all directly-imported Python dependencies in the AI service
  requirements
- `umap-learn` `>=0.5.0` → `>=0.5.12`; `python-multipart` `>=0.0.27` →
  `>=0.0.29` (PRs #330, #331, #344)

### Upgrade notes

- `git pull && ./deploy.sh` is sufficient for most environments. The
  lifecycle columns are added by idempotent migrations; run
  `./deploy.sh --db` to apply them.
- Run `php artisan library:backfill-lifecycle` once to set lifecycle state
  on pre-existing library rows.
- **AI Agents** (Study Designer + Publication assistant) are **off by
  default** — enable them from the admin AI Agents toggle. The legacy
  `publish.agent` flag is no longer read.
- The nightly purge and cleanup-suggestion jobs are scheduled
  automatically; no action required.

### By the numbers

- **205 commits** since v1.0.7 over 18 days
- **33 `feat(library)`**, **31 `feat(publish)`**, **11 `feat(studies)`**,
  plus the agent-core and copilot work
- **3 feature lines** landed together: Publish, Library Lifecycle, and
  Agentic Copilots

### Contributors

Claude Code + @sudoshi
