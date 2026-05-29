---
doc_type: lineage
status: active
date: 2026-05-29
owner: acumenus
module: library
lineage_anchor: true
supersedes: []
superseded_by: null
related_code:
  - frontend/src/features/administration/pages/AdminLibraryPage.tsx
  - frontend/src/features/administration/hooks/useAdminLifecycle.ts
  - frontend/src/features/administration/lib/adminLibraryEntityMap.ts
  - frontend/src/features/administration/components/AdminBulkToolbar.tsx
  - frontend/src/features/administration/components/PurgeConfirmModal.tsx
  - frontend/src/features/administration/__tests__/AdminLibraryPage.test.tsx
  - frontend/src/features/analyses/components/AnalysisList.tsx
  - frontend/src/features/cohort-definitions/components/CohortDefinitionList.tsx
  - frontend/src/features/concept-sets/components/ConceptSetList.tsx
related_prs: []
---

# 2026-05-29 — Library Administration: lifecycle archiving + gold-standard UX

Extends the library lifecycle system (see
[2026-05-28 — Library lifecycle UI](./2026-05-28-library-lifecycle-ui.md)) onto
the super-admin **Library Administration** surface (`/admin/library`), and
rebuilds that page to the same gold-standard UX the feature pages now use.

The prior advancement fixed the double-prefix 404 so `/admin/library` *loads*
its union of all 11 lifecycle-managed tables. But the surface still only offered
**hard-delete**, **reassign-owner**, and **trash restore/purge** — there was no
way to perform the soft lifecycle transitions (promote / archive / restore) that
researchers can now do on their own list pages. A super-admin organizing another
user's clutter had to either curl the per-entity endpoints or impersonate. This
closes that gap and brings the page's UX up to standard.

## What shipped

| Area | Result |
|---|---|
| **Per-row lifecycle** | Each Active-tab row gets a `LifecycleActionMenu` (promote/archive/restore, valid transitions only) feeding the shared `LifecycleConfirmModal`. |
| **Bulk lifecycle** | Sticky `AdminBulkToolbar` on the Active tab: Archive · Restore · Delete · Reassign · Clear. A heterogeneous selection (concept sets + cohorts + analyses in one batch) is grouped by entity and dispatched as one bulk call per entity, with `done/skipped/missing` tallies merged into a single toast. |
| **Status axis** | `StatusTabs` (Active / Drafts / Archived / All) with **accurate live counts** — the Active tab fetches `status=all` once and filters client-side, so the counts are real (the feature pages still pass zeroes). |
| **Gold-standard polish** | Pill Active/Trash tabs, `LifecycleStatusBadge` (was plain text), human-readable type labels, icon search field, rounded/zebra/hover table matching `ConceptSetList`. |
| **Trash tab** | Per-row + bulk Restore/Purge; native `confirm()` replaced by a styled `PurgeConfirmModal` (single + bulk). |

## Design decision — reuse, don't rebuild the backend

**No backend changes were required.** The admin surface calls the *existing*
per-entity lifecycle endpoints (`POST /{entity}/{id}/{promote|archive|restore}`,
`/{entity}/bulk-archive`, `/{entity}/bulk-restore`) — the same routes the
feature pages use. Authorization already permits it: `AuthorizesLibraryLifecycle`
grants every transition on `... || hasRole('super-admin')`, and super-admin holds
the `*.edit` route permissions. Adding admin-specific lifecycle endpoints would
have duplicated tested, authorized logic for zero benefit.

The one piece of glue is **`adminLibraryEntityMap.ts`**, which maps the union
endpoint's snake_case `item_type` (`incidence_rate_analysis`) to the kebab-case
lifecycle slug (`incidence-rate-analyses`). It is typed
`Record<AdminLibraryItemType, LibraryEntity>`, so `tsc` guarantees all 11 types
are mapped — a missing entry is a compile error, not a runtime 404.

## New / changed frontend

- **`adminLibraryEntityMap.ts`** — item_type → lifecycle slug + display labels.
- **`useAdminLifecycle.ts`** — `useAdminSingleLifecycle` (per-row) and
  `useAdminBulkLifecycle` (group-by-entity bulk); both invalidate the
  `["admin","library"]` query and toast precise outcomes.
- **`AdminBulkToolbar.tsx`** — sticky bulk bar (lifecycle + admin actions).
- **`PurgeConfirmModal.tsx`** — styled single/bulk purge confirm.
- **`AdminLibraryPage.tsx`** — rewritten around the above; checkboxes retained on
  both tabs, selection keyed by `type:id` (rows are heterogeneous, so a numeric
  id alone isn't unique).
- **`AdminLibraryPage.test.tsx`** — kept the 3 existing tests, added 2 (row
  archive hits `/concept-sets/7/archive`; status-tab filtering shows drafts only
  under the Drafts tab).

## Bug fixed in flight — ESLint gate

The pre-commit hook runs ESLint with `--max-warnings 0`. It surfaced 6 latent
warnings in the prior session's `AnalysisList`, `CohortDefinitionList`, and
`ConceptSetList`: each `useEffect(() => sel.clear(), [...])` carried an *unused*
`react-hooks/set-state-in-effect` disable (the body is a function call, not a
direct `setState`, so the rule never fired) plus a real `sel` `exhaustive-deps`
warning. Replaced the dead directive with a targeted
`react-hooks/exhaustive-deps` suppression — clearing selection on filter change,
intentionally not on `sel`'s per-render identity. (The 2026-05-28 devlog noted
these as accepted warnings; the stricter commit gate required resolving them.)

## Verification

Static: `tsc --noEmit` 0 errors · ESLint clean (after the 3 fixes) ·
`vite build` ✓ · `pint --test` PASS (5 files) · PHPStan level 8 0 errors.

Frontend tests: 18/18 across `administration` + `library` (5 in
`AdminLibraryPage`, incl. the 2 new).

Backend tests (the paths the admin UI invokes): **38 passed / 1 skipped** across
`LifecycleControllerTest`, `BulkLifecycleTest`, `LibraryLifecyclePolicyTest`,
`HasLibraryLifecycleTraitAppliedTest`, `LibraryControllerTest`,
`LibraryLifecycleColumnsTest`.

Contract + live checks:
- FE entity-map slugs `diff` byte-identical to the 11 backend route slugs.
- Trait methods `promote`/`archive`/`restore_lifecycle(User)` match the
  controller calls and are idempotent.
- Production reachability (unauthenticated): `concept-sets/1/archive`,
  `characterizations/1/archive`, `concept-sets/bulk-archive` → **401**
  (registered + auth-gated, not 404); `admin/library` POST → **405** (GET route
  exists).

## Shipped

Commit `fc40d91b4` *feat(library): lifecycle management UI across library +
admin surface* (the ESLint fixes folded in), plus chore commits for dependency
manifests and auto-exported fixtures. Pushed to `origin/main`; full
`./deploy.sh` ran with all post-deploy smoke checks green.

## Why this matters

The admin surface is the only place a super-admin can organize the *entire*
library across all users. Until now it could delete and reassign but not archive
— the single most-requested, lowest-risk cleanup action. A super-admin can now
multi-select stale items spanning any mix of entity types and archive them in
one click, directly serving the goal of reducing on-screen clutter for everyone.
