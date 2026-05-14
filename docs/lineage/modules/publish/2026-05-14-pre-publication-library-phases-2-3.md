---
doc_type: lineage
status: historical
date: 2026-05-14
owner: acumenus
module: publish
lineage_anchor: true
supersedes:
  - docs/lineage/modules/publish/2026-04-14-publication-draft-autosave.md
superseded_by: null
related_code:
  - backend/app/Http/Controllers/Api/V1/PublicationController.php
  - backend/app/Services/Publication/PublicationSnapshotService.php
  - backend/app/Policies/PublicationDraftPolicy.php
  - backend/app/Models/App/Study.php
  - backend/database/migrations/2026_05_14_003903_add_visibility_to_publication_drafts.php
  - frontend/src/features/publish/pages/PublicationLibraryPage.tsx
  - frontend/src/features/publish/pages/PublishPage.tsx
  - frontend/src/features/publish/hooks/useAutosave.ts
  - frontend/src/features/publish/hooks/useSnapshots.ts
  - frontend/src/features/publish/components/library/SnapshotsPanel.tsx
  - frontend/src/features/publish/components/PublishPage/SaveStatusIndicator.tsx
  - frontend/src/features/publish/components/PublishPage/ShareDropdown.tsx
related_prs:
  - 339
---

# 2026-05-14 — Pre-Publication Library, Phases 2 + 3

Closes the three-phase implementation defined in `docs/superpowers/specs/2026-05-13-publish-library-design.md`. Phase 1 (persistence + library landing) merged earlier as PR #339; this entry covers Phases 2 (autosave + named snapshots) and 3 (study-scoped sharing) which shipped to production at https://parthenon.acumenus.net on 2026-05-14.

## What landed

### Phase 2 — Autosave + Snapshots

- **`useAutosave` hook** — debounces wizard state changes by 2s, dedupes via a stable `documentHash` (djb2 over a sorted-key JSON serialization), retries failed PATCHes with exponential backoff (500ms / 2s / 8s), and registers a `beforeunload` warning while saves are pending.
- **`SaveStatusIndicator`** — header pill rendering `Saved <relative>` / `Saving…` / `Unsaved changes` / `Save failed — retry`, with `aria-live="polite"`.
- **Snapshot endpoints** on `PublicationController`:
  - `GET /api/v1/publish/drafts/{draft}/snapshots`
  - `POST /api/v1/publish/drafts/{draft}/snapshots` (idempotency_key dedupes within a 5-second window)
  - `POST /api/v1/publish/drafts/{draft}/snapshots/{snapshot}/revert`
- **`PublicationSnapshotService`** — stores snapshots in the existing `publication_report_bundles` table with `direction='snapshot'`, `format='snapshot'`. Revert auto-creates a "Before revert (auto)" snapshot of the prior state before copying the chosen bundle's `bundle_json` into `document_json` (transaction-wrapped).
- **Optimistic locking on `updateDraft`** — accepts an `If-Unmodified-Since` header; returns `412 Precondition Failed` when the persisted `updated_at` is newer than the header timestamp.
- **`SnapshotsPanel` + `CreateSnapshotModal` + `RevertSnapshotDialog`** — right-rail UI on wizard Steps 2/3 when a draftId is loaded. Confirms intent before reverting and explicitly tells the user the prior state is auto-snapshotted.

### Phase 3 — Study-scoped sharing

- **Migration `2026_05_14_003903_add_visibility_to_publication_drafts`** — adds `visibility VARCHAR(16) NOT NULL DEFAULT 'private'` and nullable `updated_by_user_id BIGINT` (FK to `users` with `nullOnDelete`), plus a composite index on `(study_id, visibility)`. Backfills `visibility = 'private'` for existing rows.
- **`Study::scopeAccessibleBy(int $userId)`** — returns studies where the user is the creator, principal investigator, lead data scientist, lead statistician, or an explicit row in `study_team_members`. Reused by both the draft policy and the list endpoint.
- **`PublicationDraftPolicy`** — `view` allows owner OR (visibility=study AND `Study::accessibleBy`). `update` additionally requires the Spatie `studies.edit` permission, so a study viewer can read a shared draft but not edit it. `delete` and `share` are owner-only. Registered in `AppServiceProvider::boot()` via `Gate::policy(...)`.
- **`PublicationController::listDrafts`** rewritten to union owner drafts with drafts on accessible studies where `visibility='study'`. `updateDraft` stamps `updated_by_user_id = $request->user()?->id` on every PATCH and runs `validateDraftPayload` through a 422 path that rejects `visibility=study` when `study_id` is null.
- **Read-only wizard mode** — when the current user is not the owner and lacks `studies.edit`, the wizard renders a "View only — request edit access from owner" pill and a "Duplicate to my drafts" CTA that creates a private copy. Autosave is skipped (`useAutosave({ draftId: null, ... })`) so the hook short-circuits.
- **`ShareDropdown`** in the wizard header — toggles `private` ↔ `study`. The `study` option is disabled when no `study_id` is linked, mirroring the server-side 422.
- **`VisibilityBadge`** on each `DraftCard` — lock icon for private, people icon for study-shared. An "owned by user #N" indicator appears on shared drafts when the viewer is not the owner.

## Why hybrid persistence

`document_json` carries frozen `svgMarkup` and `tableData` per section captured at save time, plus `selectedExecutions` references (without raw `resultJson`, which can be 300KB+ per characterization). Frozen artifacts survive deletion or re-run of the underlying execution; the references let users regenerate narratives on demand. Typical draft size stays in the 50KB–200KB range — well under the comfortable jsonb limit.

## Why snapshots reuse `publication_report_bundles`

The bundles table was already in place for OHDSI report bundle import/export (shipped 2026-04-15). Reusing it for the snapshot direction avoids a parallel `publication_draft_versions` table for an inherently similar "frozen jsonb plus metadata" record. Snapshot rows are differentiated by `direction='snapshot'` and `format='snapshot'`. Auto-snapshots written during a revert have `metadata_json.snapshot_label = 'Before revert (auto)'`.

## Test coverage at ship

| Layer | Suite | Count |
|---|---|---|
| Backend feature | `PublicationTest.php` | 16/16 pass |
| Backend feature | `PublicationSnapshotTest.php` | 5/5 pass |
| Backend feature | `PublicationDraftPolicyTest.php` | 5/5 pass |
| Backend unit | `StudyAccessibleByScopeTest.php` | 6/6 pass |
| Frontend Vitest | `src/features/publish` | 55/55 pass |
| E2E | `phase1-lifecycle.spec.ts` | 3/3 pass |
| E2E | `phase2-autosave-snapshots.spec.ts` | 2/2 pass |
| E2E | `phase3-sharing.spec.ts` | 1 pass + 1 graceful skip (admin token lacks `studies.view` in seed; cross-user matrix covered by Pest policy tests) |

## Operational note

Production deploy on 2026-05-14 hit an OOM at `vite build` chunk rendering inside the `parthenon-node` container (2GB cgroup limit, default 4GB V8 heap insufficient for the 6700-module bundle). Fix landed as `ede57d7d2 chore(infra): bump node container heap to 5GB and memory limit to 6GB` — sets `NODE_OPTIONS=--max-old-space-size=5120` and bumps the deploy resource limit to 6GB. Future deploys complete in ~3s reliably.

## What was deliberately deferred

- Real-time collaborative editing (multi-user concurrent typing) — out of scope for v1; last-write-wins with `If-Unmodified-Since` is the contract.
- Per-draft share lists (Google-Docs-style ACL) — defer until a concrete co-authoring need exists; the study collaborator graph is the access primitive for now.
- Manuscript lifecycle states beyond `draft`/`ready`/`archived` (submitted, in-review, published) — snapshots cover the milestone-marking need.
- Comment threads on sections, LaTeX/BibTeX export — separate features.
