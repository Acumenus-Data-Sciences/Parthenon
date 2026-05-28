---
doc_type: lineage
status: active
date: 2026-05-28
owner: acumenus
module: library
lineage_anchor: true
supersedes: []
superseded_by: null
related_code:
  - frontend/src/features/library/components/LifecycleStatusBadge.tsx
  - frontend/src/features/library/components/LifecycleActionMenu.tsx
  - frontend/src/features/library/components/LifecycleConfirmModal.tsx
  - frontend/src/features/library/components/LifecycleHeaderControl.tsx
  - frontend/src/features/library/components/BulkActionToolbar.tsx
  - frontend/src/features/library/components/StatusTabs.tsx
  - frontend/src/features/library/hooks/useLifecycleActions.ts
  - frontend/src/features/library/hooks/useRowSelection.ts
  - frontend/src/features/library/lib/entityMap.ts
  - frontend/src/features/library/types.ts
  - frontend/src/features/cohort-definitions/components/CohortDefinitionList.tsx
  - frontend/src/features/cohort-definitions/pages/CohortDefinitionDetailPage.tsx
  - frontend/src/features/concept-sets/components/ConceptSetList.tsx
  - frontend/src/features/concept-sets/pages/ConceptSetDetailPage.tsx
  - frontend/src/features/analyses/components/AnalysisList.tsx
  - frontend/src/features/analyses/pages/AnalysesPage.tsx
  - frontend/src/features/analyses/pages/CharacterizationDetailPage.tsx
  - frontend/src/features/analyses/pages/IncidenceRateDetailPage.tsx
  - frontend/src/features/pathways/pages/PathwayDetailPage.tsx
  - frontend/src/features/estimation/pages/EstimationDetailPage.tsx
  - frontend/src/features/prediction/pages/PredictionDetailPage.tsx
  - frontend/src/features/sccs/pages/SccsDetailPage.tsx
  - frontend/src/features/evidence-synthesis/pages/EvidenceSynthesisDetailPage.tsx
  - frontend/src/features/administration/api/adminLibraryApi.ts
  - backend/app/Models/App/Characterization.php
  - backend/app/Http/Controllers/Api/V1/Library/LifecycleController.php
  - backend/app/Http/Controllers/Api/V1/Admin/LibraryController.php
  - backend/app/Providers/AppServiceProvider.php
  - backend/routes/api.php
  - backend/database/migrations/2026_05_28_170000_add_library_lifecycle_columns_to_characterizations.php
related_prs: []
---

# 2026-05-28 — Library lifecycle UI: bulk archive/promote/restore across cohorts, concept sets, analyses, and characterizations

End-to-end activation of the Phase D library lifecycle system. The backend
state machine (`draft → active → archived`), policies, routes, and admin
surface had shipped weeks earlier, but the user-facing controls were missing
on every list and detail page. This devlog covers the UI integration, a
production routing bug fixed in flight, and the addition of characterizations
as the 11th lifecycle-managed entity.

## What shipped

| Surface | Result |
|---|---|
| **`/admin/library`** | Fixed `/api/v1/api/v1/admin/library` double-prefix 404 in `adminLibraryApi.ts`. The admin surface now loads its 281 lifecycle-managed items (266 → 281 after characterizations joined). |
| **Concept Sets, Cohort Definitions, all 7 Analyses tabs** | Per-row status badge, kebab action menu (promote/archive/restore), row checkboxes, sticky bulk toolbar, confirm modal. |
| **Cohort Definitions grouped-by-domain view** | Status filter now reaches the grouped query (`status` + `scope` added to `CohortDefinitionGroupedParams`); each grouped row got a single-item action menu. |
| **8 detail pages** | `LifecycleHeaderControl` next to the title: status pill + menu, gated by owner-or-superadmin. |
| **Characterizations promoted to lifecycle citizens** | Additive migration, `HasLibraryLifecycle` trait on the model, registered in `LifecycleController::ENTITY_MAP`, `LibraryController::TABLES`, route loop, and `ADMIN_LIBRARY_ITEM_TYPES`. The 18 existing rows backfilled to `active`. |

## The bug found first

`adminLibraryApi.ts` was the only API module in the codebase that
hard-coded the full `/api/v1/…` path instead of relative paths. Axios
already has `baseURL: "/api/v1"`, producing `/api/v1/api/v1/admin/library`
on every request:

```
nginx access log:
GET /api/v1/api/v1/admin/library?type=concept_set&status=all → 404
GET /api/v1/api/v1/admin/library?include_trash=1            → 404
```

The page rendered the "Failed to load admin library" state and showed
nothing. The fix is the 5-line change everyone else's API module already
followed.

## Shared library components

Built once in `frontend/src/features/library/`, reused everywhere:

- **`LifecycleStatusBadge`** — color-coded pill (green active, gray draft, amber archived) with the right `aria-label`.
- **`LifecycleActionMenu`** — kebab dropdown offering only valid transitions per current status. Keyboard escape, click-outside dismiss, focus ring.
- **`LifecycleConfirmModal`** — single component handling promote/archive/restore copy for both single-item and batch flows. Explains consequences, helper text, and disables close while a mutation is in-flight.
- **`LifecycleHeaderControl`** — badge + menu pair for detail pages, manages its own confirm modal.
- **`BulkActionToolbar`** — sticky bar that slides in when rows are selected; archive- vs restore-context inferred from the active StatusTab. Rebuilt against the dark-clinical tokens (`surface-elevated`, `accent`) instead of raw zinc.
- **`StatusTabs`** — refreshed pills with counts, focus ring, descriptive titles.
- **`useLifecycleMutations` / `useBulkLifecycleMutations`** — wrap the existing API hooks with toast-aware success/error handling and `[entity]` + `["admin","library"]` cache invalidation. Bulk responses surface `done/skipped/missing` counts precisely.
- **`useRowSelection`** — generic select-all / toggle / clear / `toggleAll` with the indeterminate state baked in.
- **`lib/entityMap.ts`** — UI slug → backend lifecycle entity. The cleanest way to keep `AnalysisList` polymorphic across 7 analysis types.

## Characterizations join the lifecycle

The other 10 entities (`concept_sets`, `cohort_definitions`,
`incidence_rate_analyses`, …) already used `HasLibraryLifecycle`.
`Characterization` was the odd one out — separate model from
`FeatureAnalysis`, no lifecycle trait, not in the admin surface.

Additive migration via `parthenon_migrator` role (runtime `parthenon_app`
has no DDL — separation of duties from 2026-04-12):

```sql
ALTER TABLE app.characterizations
  ADD COLUMN status varchar(16) NOT NULL DEFAULT 'active',
  ADD COLUMN archived_at timestamp,
  ADD COLUMN archived_by bigint REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN promoted_at timestamp;
CREATE INDEX ON characterizations (status);
```

Backend wiring:
- `Characterization` now `use HasLibraryLifecycle, SoftDeletes`.
- `Gate::policy(Characterization::class, AnalysisPolicy::class)` registered.
- `LifecycleController::ENTITY_MAP['characterizations'] = Characterization::class`.
- `LibraryController::TABLES` + `resolveModelClass()` gained the `'characterization'` slug.
- Route loop in `api.php` added `'characterizations' => 'analyses'` (uses the existing `permission:analyses.edit` gate).

Frontend wiring:
- `entityMap.ts` flipped `characterization → "characterizations"` (was `null`).
- `ADMIN_LIBRARY_ITEM_TYPES` gained `"characterization"`.
- `CharacterizationDetailPage` got the `LifecycleHeaderControl`.
- `AnalysisList` needed **zero changes** — it conditionally enables lifecycle UI on `entity !== null`, so the entityMap update flips the Characterizations tab on automatically.

## The grouped-view fix users actually triggered

After the initial deploy, the report came back: "Concept Sets and Cohort
Definitions don't show the new behavior, but Analyses does." Headless
Playwright tests proved the chunks were correct on prod — but the
`CohortDefinitionsPage` defaults to **`viewMode = "domain"`**, which calls
`useGroupedCohortDefinitions(...)` on a different path that:

1. Never forwarded `status` or `scope`, so clicking the StatusTabs was a no-op at the data level.
2. Rendered simplified rows with no per-row action menu (initial commit added only a status badge here).

Fix:
- `CohortDefinitionGroupedParams` accepts `status` + `scope`.
- The grouped query passes both through — the backend's `applyLibraryListFilters` already handled them, so this was a four-line frontend change.
- Each grouped row now has a `LifecycleActionMenu` in a new last column (single-item only — bulk stays in flat view).
- Shared `LifecycleConfirmModal` mounts on the grouped branch too.

For concept sets, the report was a stale browser cache from before the
fix landed.

## Verification

Static checks: `tsc --noEmit` 0 errors. ESLint 0 errors (6 hook-deps
warnings on the stable `sel.clear` reference). `pint --test` PASS.
PHPStan level 8 clean on the 9 touched PHP files. Vite build 1.64s.

End-to-end (headless Chromium against the deployed app, admin login):

```
CONCEPT_SETS:          20 rows, 20 badges, 20 row checkboxes, 20 menus, 0 console errors
COHORT_DEF Domain:     4 expanded groups, 40 badges, 40 menus
COHORT_DEF Flat:       20 rows, 1 select-all + 20 row checkboxes, badges, menus
COHORT_DEF Archived:   4 rows, all 4 show "Archived" badge, 4 menus
COHORT_DEF Bulk:       check 1 row → toolbar appears: "1 selected · Restore 1 · Clear"
ANALYSES:              15 badges, 15 menus, Lifecycle column present
DETAIL pages × 4:      every header shows 1 badge + 1 menu
ADMIN LIBRARY:         281 rows, type filter has all 11 entities incl. "characterization"
```

Round-trip API tests on every entity (single + bulk archive→restore)
return the expected `{id, status}` and `{done, skipped, missing}`
payloads. Cohort grouped endpoint with `?status=archived&scope=all`
returns exactly the 4 archived cohorts grouped under Renal (1) +
General (3).

## What was intentionally left out

- **Characterization detail page in flat view of the analyses tab still works as before** — promote/archive on a characterization is wired but no surfacing in the `CharacterizationDetailPage` analytics workflow. That's fine; the menu in `AnalysisList` is the primary path.
- **Bulk actions in the cohort grouped view** are deliberately not wired. Selecting rows across nested domain groups would be confusing UX; if you want bulk, switch to flat view. The grouped view keeps the single-row menu only.

## Why this matters

The lifecycle backend has existed since Phase D, but until today there was
no way for a user (super-admin or otherwise) to *use* it without curl.
The new surface is the path by which Acumenus and field researchers can
actually clean up stale concept sets, retire old cohort drafts, and keep
the active library focused. The bulk archive flow is the highest-leverage
single addition — a researcher can multi-select a dozen stale drafts and
archive them in one click, which directly serves the stated goal of
"reducing on-screen clutter."

## File inventory

- **30 source files changed**: +952 / −157 lines net
- **7 new shared components/hooks** in `frontend/src/features/library/`
- **1 additive migration** (applied via `parthenon_migrator`)
- **No destructive changes** to existing behavior
