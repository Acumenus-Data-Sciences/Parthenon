---
doc_type: spec
status: active
date: 2026-05-13
---

# Pre-Publication Library — Design Spec

**Date:** 2026-05-13
**Author:** Sanjay Udoshi (with Claude Code brainstorming)
**Scope:** Frontend Publish page improvement — Pre-Publication Library with save/load drafts, figures, graphs, tables
**Status:** Approved (ready for implementation planning)

---

## 1. Problem

The current Publish page (`frontend/src/features/publish/pages/PublishPage.tsx`) runs a 4-step manuscript wizard whose state lives in `sessionStorage`. When the user closes the browser tab, all work — selected analyses, edited narrative, configured sections, generated tables and figures — is lost. There is no concept of a "draft library", no way to resume a manuscript-in-progress, no way to snapshot a version for sharing or review, and no way for study collaborators to see each other's work.

The backend infrastructure for this feature already exists (shipped 2026-04-15):
- `app.publication_drafts` table (id, user_id, study_id, title, template, `document_json` jsonb, status, last_opened_at)
- `app.publication_report_bundles` table (linked to drafts, used for OHDSI export/import)
- `PublicationController` with full CRUD: `GET/POST /publish/drafts`, `GET/PATCH/DELETE /publish/drafts/{id}`, `POST /publish/report-bundles/{export,import}`
- Frontend API client (`publishApi.ts`) with `fetchPublicationDrafts`, `createPublicationDraft`, `updatePublicationDraft`, `deletePublicationDraft`, `exportReportBundle`, `importReportBundle`
- Pest tests in `tests/Feature/Api/V1/PublicationTest.php`

What is missing is the frontend UI surface that consumes these endpoints — a Library page, draft save/load wiring in the wizard, autosave, snapshots, and study-scoped sharing.

## 2. Design decisions (confirmed during brainstorming)

| # | Decision | Choice |
|---|----------|--------|
| 1 | Persistence model for figures/graphs/tables | **Hybrid** — frozen SVG markup + frozen `tableData` in `document_json`; execution references kept for refresh; raw `resultJson` NOT persisted |
| 2 | Save semantics | **Hybrid** — prompt once on first meaningful edit ("Save as draft?"), then autosave silently from Phase 2 onward |
| 3 | Library entry point | **Standalone route** `/publish/library` as the landing page; wizard becomes per-document |
| 4 | Versioning | **Named snapshots on demand** — reuse `publication_report_bundles` table with `direction='snapshot'` |
| 5 | Sharing scope | **Study-scoped collaborators** — new `visibility` enum (`private` \| `study`); study membership = access |
| 6 | Status workflow | **Keep as-is** — `draft` \| `ready` \| `archived` with minimal semantics |

## 3. Architecture

### 3.1 Data model

Existing table, additive changes only:

```
app.publication_drafts
  id, user_id, study_id, title, template,
  document_json,         -- hybrid snapshot (see §3.2)
  status,                -- draft | ready | archived
  visibility,            -- NEW Phase 3: 'private' | 'study' (default 'private')
  updated_by_user_id,    -- NEW Phase 3: last editor (nullable)
  last_opened_at, created_at, updated_at
```

Existing table, repurposed:

```
app.publication_report_bundles
  id, publication_draft_id, user_id,
  direction,             -- 'export' | 'import' | 'snapshot' (NEW value Phase 2)
  format,                -- 'docx' | 'pdf' | 'ohdsi' | 'snapshot' (NEW value Phase 2)
  bundle_json,           -- frozen document_json + frozen title/authors/template
  metadata_json,         -- { snapshot_label, comment, created_by_user_id }
  created_at, updated_at
```

### 3.2 `document_json` shape (locked at Phase 1)

```json
{
  "version": 1,
  "title": "Hypertension Cohort Comparison",
  "authors": ["S. Udoshi", "L. Lu"],
  "template": "generic-ohdsi",
  "step": 2,
  "selectedExecutions": [
    {
      "studyId": 12,
      "analysisId": 88,
      "executionId": 901,
      "analysisType": "characterization",
      "analysisName": "...",
      "studyTitle": "...",
      "designJson": { }
    }
  ],
  "sections": [
    {
      "id": "results-characterization",
      "type": "results",
      "analysisType": "characterization",
      "title": "Characterization Results",
      "content": "narrative text...",
      "included": true,
      "tableIncluded": true,
      "narrativeIncluded": true,
      "diagramIncluded": true,
      "tableData": { },
      "diagramType": "kaplan-meier",
      "svgMarkup": "<svg>...</svg>"
    }
  ]
}
```

Key invariants:
- `resultJson` is **never** persisted. Re-fetched on demand via `fetchAnalysisExecution(executionId)` if the user clicks "Regenerate narrative".
- `svgMarkup` and `tableData` are **frozen at save time**. They survive deletion or re-run of the underlying execution.
- `step` is persisted so a reloaded draft returns to the step the user left.
- Schema is versioned (`version: 1`) to allow forward migrations.

### 3.3 Frontend routes

```
/publish                        → Navigate to /publish/library
/publish/library                → PublicationLibraryPage (NEW)
/publish/library/new            → PublishPage (empty state, draft created on first save)
/publish/library/:draftId       → PublishPage (loaded from draft row)
```

### 3.4 Backend endpoints

Phase 1: no new endpoints. All existing CRUD on `/publish/drafts` is sufficient.

Phase 2 (new):
```
POST   /api/v1/publish/drafts/{draft}/snapshots
       body: { label: string, comment?: string }
       → 201 { data: { id, label, created_at } }

GET    /api/v1/publish/drafts/{draft}/snapshots
       → 200 { data: [ { id, label, comment, created_by_user_id, created_at } ] }

POST   /api/v1/publish/drafts/{draft}/snapshots/{bundle}/revert
       → 200 { data: PublicationDraft }
```

Phase 3 (modifications):
- `PATCH /publish/drafts/{draft}` accepts `visibility` field
- `GET /publish/drafts` returns drafts where `user_id = me` OR (`visibility = 'study'` AND user is a study collaborator — see §4.3 for the access definition)
- New `PublicationDraftPolicy` for owner/editor/viewer authorization

**Study access definition (Phase 3 prerequisite):**

The `Study` model already carries collaboration FKs (`created_by`, `principal_investigator_id`, `lead_data_scientist_id`, `lead_statistician_id`) and a `teamMembers` HasMany relationship. Phase 3 introduces a new scope `Study::scopeAccessibleBy($query, int $userId)` that resolves "user is a collaborator on this study" as:

```
$userId = $study.created_by
  OR $userId = $study.principal_investigator_id
  OR $userId = $study.lead_data_scientist_id
  OR $userId = $study.lead_statistician_id
  OR EXISTS (
       SELECT 1 FROM study_team_members
       WHERE study_id = $study.id AND user_id = $userId
     )
```

Users with `super-admin` role bypass the check (consistent with HIGHSEC §6.1). This scope is added in Phase 3 and reused by `PublicationDraftPolicy`. Note: callers must still pass the Spatie `permission:studies.view` middleware to reach `/publish/drafts` — the scope narrows *which* drafts they see, not *whether* they can call the endpoint.

## 4. Implementation phases

### Phase 1 — Persistence + Library (~1 week)

**Goal:** Replace sessionStorage. Drafts live on the server. Library lists them.

**New frontend files:**
```
frontend/src/features/publish/
├── pages/
│   └── PublicationLibraryPage.tsx     NEW
├── components/library/
│   ├── DraftCard.tsx                  NEW
│   ├── DraftCardGrid.tsx              NEW
│   ├── DraftFilters.tsx               NEW
│   ├── NewDraftButton.tsx             NEW
│   └── SaveDraftButton.tsx            NEW
├── hooks/
│   └── useDrafts.ts                   NEW
└── lib/
    ├── snapshotCapture.ts             NEW
    └── draftSerialization.ts          NEW
```

**Modified:** `PublishPage.tsx` accepts `?draftId` / `:draftId`, calls `useDraft(id)` on mount, hydrates reducer from `document_json`.

**Critical flows:**

*Save flow:* Walk sections → call `getDiagramSvgMarkup(section.id)` (exists in `svgExport.ts`) → serialize `tableData` → strip `resultJson` from `selectedExecutions` → `createPublicationDraft({ study_id, title, template, document_json, status: 'draft' })` → navigate to `/publish/library/:id` with `replace: true` so back button returns to library.

*Load flow:* `useDraft(draftId)` → `GET /publish/drafts/:id` (server bumps `last_opened_at`) → `deserializeFromLoad` rehydrates the reducer → frozen `svgMarkup` and `tableData` populate sections directly. Narrative regeneration prompts a re-fetch.

*Hybrid prompt UX:* First meaningful change in the wizard triggers a modal: "Save as draft to keep this work? You can also continue without saving." Buttons: "Save as draft" / "Continue without saving". A subtle "Working without a draft — Save now" banner stays at the top until they save.

*sessionStorage migration:* On first `/publish/library` visit with existing sessionStorage state, show a banner: "Continue your previous unsaved document? Save it to your library." → creates draft, clears sessionStorage.

**Library card:**
- Title (2-line truncate)
- Study name link
- Template badge
- Status pill (`draft` muted / `ready` accent / `archived` ghosted)
- `last_opened_at` relative
- Section count summary ("4 sections · 2 tables · 3 figures")
- Hover: Open + kebab (Rename, Archive, Delete, Duplicate)

**Empty state:** centered illustration + "Start a New Document" CTA + docs link.

**Filters/sort:** status (default hides archived), sort by last opened (default), free-text title search, study filter (when relevant).

**Error handling:**
- Save failure → toast with retry; local memory + sessionStorage fallback retained
- Load 404 → redirect to library with toast "Draft not found"
- `document_json` version mismatch → coerce defaults, warn banner
- Draft > 5MB → prompt user to drop the largest embedded SVG

### Phase 2 — Autosave + Snapshots (~1 week)

**Goal:** Zero-friction save. Named immutable snapshots for milestone versions.

**New/modified files:**
```
frontend/src/features/publish/
├── components/
│   ├── library/
│   │   ├── SnapshotsPanel.tsx          NEW
│   │   ├── CreateSnapshotModal.tsx     NEW
│   │   └── RevertSnapshotDialog.tsx    NEW
│   └── SaveStatusIndicator.tsx         NEW
└── hooks/
    ├── useAutosave.ts                  NEW
    └── useSnapshots.ts                 NEW
```

**Autosave behavior:**
- `useAutosave(draftId, state)` subscribes to wizard state
- Debounce 2s after last change
- Skip save if `draftId === null` or state hash unchanged (SHA-1 of `document_json`)
- `PATCH /publish/drafts/:id` — same endpoint as manual save
- Status indicator: **Saved** (grey check + relative timestamp) / **Saving…** (blue spinner) / **Unsaved changes** (amber dot) / **Save failed — retry** (red dot + button)
- `beforeunload` warning if unsaved changes pending
- 3 retries with exponential backoff (500ms, 2s, 8s) before surfacing error

**Snapshot UX:**
- "Snapshot" button next to Save indicator → `CreateSnapshotModal`
- Inputs: label (required, defaults "Snapshot N"), optional comment
- Backend stores `publication_report_bundles` row with `direction='snapshot'`, `format='snapshot'`, `bundle_json = current document_json` plus frozen title/authors/template
- Right-rail Snapshots tab in wizard shows list (label, comment, created_by, relative date)
- Per-snapshot kebab: Revert / Download as JSON / Delete

**Revert flow:**
- Confirms in dialog: "This will replace your current draft with the snapshot from {date}. The current state will be saved as a new snapshot labeled 'Before revert'."
- Server creates an auto-snapshot of current state with `label: 'Before revert (auto)'`, then copies chosen bundle's `bundle_json` into `document_json`
- Wizard reloads

**Concurrency / multi-tab:**
- Last-write-wins by default
- Optimistic locking via `If-Unmodified-Since` header on PATCH; server returns 412 Precondition Failed if stale
- Frontend on 412: "This draft was changed in another tab — reload?" prompt
- `useFocusRefresh` refetches the draft on window focus

**Idempotency on snapshot create:**
- Client generates a UUID per snapshot attempt, sent in body as `idempotency_key`
- Server dedupes within a 5-second window to prevent double-click duplicates

### Phase 3 — Sharing (~1 week)

**Goal:** Drafts visible to study collaborators with read or write access.

**Backend migration:**
```php
Schema::table('publication_drafts', function (Blueprint $table) {
    $table->string('visibility', 16)->default('private')->after('status');
    $table->foreignId('updated_by_user_id')->nullable()->after('visibility')
          ->constrained('users')->nullOnDelete();
    $table->index(['study_id', 'visibility'], 'publication_drafts_study_visibility_idx');
});
```

Backfill: all rows get `visibility = 'private'`.

**Backend authorization:**

New `PublicationDraftPolicy`:
- `view(User $user, PublicationDraft $draft)` — owner OR (visibility=study AND `Study::accessibleBy($user->id)` includes `draft.study_id`)
- `update(User $user, PublicationDraft $draft)` — owner OR (visibility=study AND user is study collaborator AND user has Spatie `studies.edit` permission)
- `delete(User $user, PublicationDraft $draft)` — owner only
- `share(User $user, PublicationDraft $draft)` — owner only

Two-layer authorization: Spatie permissions gate the *endpoint* (e.g., `studies.view` to reach `/publish/drafts`); the new policy gates the *row* via study collaborator membership.

`PublicationController::authorizeDraft()` extended to consult the policy, not just `user_id` match.

`PublicationController::listDrafts()` rewritten:
```php
$accessibleStudyIds = Study::query()
    ->accessibleBy($userId)   // scope added in Phase 3, see §3.4
    ->pluck('id');

$drafts = PublicationDraft::query()
    ->where(function ($q) use ($userId, $accessibleStudyIds) {
        $q->where('user_id', $userId)
          ->orWhere(function ($qq) use ($accessibleStudyIds) {
              $qq->where('visibility', 'study')
                 ->whereIn('study_id', $accessibleStudyIds);
          });
    })
    ->orderByDesc('last_opened_at')
    ->limit(100)
    ->get();
```

`PublicationController::updateDraft()` sets `updated_by_user_id = current user` on each PATCH.

**Frontend additions:**
```
frontend/src/features/publish/components/library/
├── VisibilityBadge.tsx            NEW
└── ShareDropdown.tsx              NEW
```

**Share dropdown** (wizard header):
- "Private" (default) — visible only to owner
- "Study collaborators" — anyone with access to {study name}
- Disabled when `study_id === null`, tooltip "Link to a study to share"
- Read-only viewers see no dropdown

**Library card** additions:
- Owner avatar + name when `user_id !== current_user`
- Visibility badge (lock icon vs people icon)
- New filter chip "Shared with me" — drafts where `user_id !== current_user`
- Sort option "Recently shared" — orders by `updated_at` desc among drafts with `visibility = 'study'`
- Footer line "Last edited by S. Udoshi 2h ago" on shared drafts

**Activity indicator:**
- If another user has autosaved within last 30s, show non-blocking pill in wizard header: "S. Udoshi is editing now" — informational only

**Read-only mode** (study viewer without edit access):
- All wizard inputs `aria-disabled`, visually muted
- "Save Draft" replaced by "View only — request edit access from {owner}"
- "Duplicate to my drafts" button creates a private copy attributed to the viewer

## 5. Error handling and edge cases

| Scenario | Behavior |
|----------|----------|
| Save fails (network/500) | Toast "Couldn't save draft — retry?" + retry; state retained in memory and sessionStorage |
| Load 404 (draft deleted or RBAC mismatch) | Redirect to `/publish/library` with toast |
| `document_json` schema version mismatch | Coerce defaults, log to Sentry, warn banner |
| Draft size > 5MB | Prompt user to drop the largest embedded SVG |
| Concurrent edit (412 Precondition Failed) | Prompt "Reload to see changes from another tab?" |
| Underlying execution deleted | Draft still renders — frozen SVG + tableData survive; narrative regeneration shows "Execution no longer available — regenerate against a new run?" |
| Study membership revoked while editing shared draft | Next autosave returns 403, wizard shows "Access revoked — copy to private?" |
| Snapshot creation collision (double-click) | Server dedupes via 5-second idempotency window |
| Browser tab close with unsaved changes | Native `beforeunload` warning |

## 6. Testing strategy

### 6.1 Backend (Pest)

**Phase 1** (additions to existing `PublicationTest.php`):
- Creates draft with snapshot-style `document_json`; SVG round-trip integrity
- Large `document_json` (1MB) persists and reloads without truncation
- List endpoint filters by user, respects status filter, hides archived by default
- `last_opened_at` bumps on show

**Phase 2** (new `PublicationSnapshotTest.php`):
- Creates snapshot bundle with `direction='snapshot'`
- Revert copies `bundle_json` into `document_json` and creates "Before revert (auto)" snapshot
- 412 returned when `If-Unmodified-Since` is stale
- Snapshot list scoped to draft, ordered by `created_at` desc
- Idempotency: duplicate create within 5s window returns the same row

**Phase 3** (new `PublicationDraftPolicyTest.php` + `ShareDraftTest.php`):
- Owner/editor/viewer/outsider authorization matrix
- `listDrafts` returns drafts where user is study collaborator
- Cannot set `visibility=study` when `study_id` is null (422)
- Read-only user gets 403 on PATCH
- Revoking study membership hides previously shared draft from list

### 6.2 Frontend (Vitest + Testing Library)

**Phase 1:**
- `PublicationLibraryPage` — empty state, card rendering, navigation, search/filter
- `useDrafts` — TanStack Query cache invalidation on create/update/delete
- `snapshotCapture` — stable SVG strings, handles missing chart DOM gracefully
- `draftSerialization` — round-trip identity (`deserialize(serialize(x)) === x`)
- `PublishPage` route handling — `/library/new`, `/library/:draftId`, redirect from `/publish`
- sessionStorage migration banner appears once, dismisses, creates draft

**Phase 2:**
- `useAutosave` — debounce timing, dedup by hash, retry on failure, beforeunload warning
- `SaveStatusIndicator` — all four states render correctly
- `CreateSnapshotModal` — required-field validation, idempotency on double-click
- `RevertSnapshotDialog` — confirms, calls API, refreshes state

**Phase 3:**
- `ShareDropdown` — disabled when no study, toggle calls PATCH
- `DraftCard` — owner badge appears only on shared drafts
- Read-only wizard — inputs disabled, Save replaced by request-access CTA

### 6.3 E2E (Playwright)

**Phase 1 — Manuscript lifecycle:**
1. Login → `/publish/library` → empty state
2. Click "New Document", select study + 2 analyses, configure, narrate
3. Save Draft → toast → return to library → card appears
4. Click card → wizard reloads with exact state, SVG charts intact

**Phase 2 — Autosave + snapshots:**
5. Edit a section title → within 2s see "Saved"
6. Close tab, reopen → state preserved
7. Create snapshot "Pre-IRB" with comment
8. Edit more, then revert → confirm before-revert snapshot exists

**Phase 3 — Sharing:**
9. Owner: set visibility to "Study collaborators"
10. Switch user to study collaborator
11. Open library → see shared draft with owner badge
12. Open draft, edit a section → see "S. Udoshi is editing" if owner online
13. Owner: revoke collaborator's study access
14. Collaborator: refresh library → shared draft gone

### 6.4 Manual verification gates (before release)

- Save draft, force-delete the underlying analysis execution from the DB, reopen — should render with frozen SVG/table
- Save 200KB+ characterization draft, time save and reload — sub-500ms
- Open same draft in two tabs, edit in both, save in both — second save returns 412

### 6.5 Accessibility

- Library cards: keyboard nav, focus rings (consistent with Phase 6 polish work)
- Snapshot modal: focus trap, escape to close
- Save status indicator: `aria-live="polite"`
- Read-only mode: `aria-disabled` on inputs + visible disabled style

### 6.6 Performance gates

- Library initial load < 800ms with 100 drafts
- Draft load (300KB `document_json`) < 500ms end-to-end
- Autosave PATCH p95 < 300ms

## 7. Security considerations (HIGHSEC compliance)

- All draft endpoints already require `auth:sanctum`. Phase 3 adds `PublicationDraftPolicy` enforcement via `$this->authorize()`.
- Phase 3 list endpoint joins against the existing `Study::whereUserHasAccess()` scope — no new ACL surface.
- `visibility` field validated against allowed values (`private`, `study`); cannot be set to `study` when `study_id` is null (422).
- Snapshot reverts logged via `updated_by_user_id` audit field.
- No PHI in `document_json` beyond what the analysis result already exposes; same RBAC applies.
- `idempotency_key` for snapshots and saves is client-generated UUIDv4, server validates format.

## 8. Out of scope (deferred)

- Real-time collaborative editing (multiple users typing simultaneously) — Y combinator out for v1
- Custom per-draft share lists (Google-Docs style ACL) — defer until a concrete co-authoring need exists
- Manuscript lifecycle states (submitted/in-review/published) — defer; snapshots cover the milestone need
- Comment threads on draft sections — separate feature, not required by this design
- Export to LaTeX or BibTeX bibliography integration — separate feature
- Versioning beyond snapshots (full edit-by-edit history) — overkill for v1

## 9. Open questions

None at spec-approval time. All design decisions confirmed during brainstorming.

## 10. References

- Existing backend: `backend/app/Http/Controllers/Api/V1/PublicationController.php`
- Existing model: `backend/app/Models/App/PublicationDraft.php`
- Existing model: `backend/app/Models/App/PublicationReportBundle.php`
- Existing wizard: `frontend/src/features/publish/pages/PublishPage.tsx`
- Existing API client: `frontend/src/features/publish/api/publishApi.ts`
- HIGHSEC spec: `.claude/rules/HIGHSEC.spec.md`
- Study model + collaboration FKs: `backend/app/Models/App/Study.php` (`created_by`, `principal_investigator_id`, `lead_data_scientist_id`, `lead_statistician_id`, `teamMembers` relationship)
- Phase 3 adds new scope `Study::scopeAccessibleBy` — see §3.4
- Spatie permissions: `studies.view`, `studies.edit` (via `permission:` middleware in `backend/routes/api.php`)
