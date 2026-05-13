# Library Lifecycle — Concept Sets, Cohort Definitions, Analyses

**Date:** 2026-05-13
**Status:** Design approved by user; pending review of written spec.
**Author:** Brainstorming session — Sanjay Udoshi + Claude
**Implementation skill:** `writing-plans` (next step)

---

## 1. Problem

Parthenon's three core research-artifact tables — **concept sets**, **cohort definitions**, and **analyses** — accumulate scratch work as users iterate. List pages (`/concept-sets`, `/cohort-definitions`, `/analyses`) and pickers inside Studies become cluttered with abandoned drafts and stale items. Users have no first-class way to mark something as "done with this", and superusers have no maintenance interface for cleaning up across users.

Goal: introduce a lightweight lifecycle (Draft → Active → Archived, plus superuser hard-delete) that reduces noise without taking destructive action on user data.

## 2. Decisions captured during brainstorming

| Question | Decision |
|---|---|
| Where does clutter hurt? | List pages **and** pickers — both. |
| Ownership model | Per-user namespace by default; superusers see all items globally for maintenance. |
| Lifecycle states | **Draft → Active → Archived** plus superuser hard-delete with 30-day grace. |
| Draft → Active trigger | **Hybrid:** auto-promote on first real use (attach to Study, share, reference from Analysis) **with an explicit confirmation modal**. |
| Archive trigger | **Manual + auto-suggest:** owner clicks Archive; background job surfaces stale candidates in a "Cleanup Suggestions" panel. No automatic archiving. |
| Superuser UI | **Both** an inline "Show all users" toggle on existing list pages **and** a dedicated `/admin/library` page. |
| Hard delete | Superuser-only; requires `status='archived'`; blocks if any Study attachments exist (including archived Studies); audit-logged; soft-delete with 30-day grace. |
| Picker visibility | Active items the user owns OR attached to a **non-archived** Study they collaborate on. Drafts hidden by default, revealable behind a checkbox. Archived never shown. |
| Architecture | **Approach 1:** per-table `status` enum + `archived_at` / `archived_by` / `promoted_at` columns, centralized through a `HasLibraryLifecycle` trait and global scope. No central morph table, no separate usage table. |

## 3. Data model

For each of the following tables:

- `concept_sets`
- `cohort_definitions`
- `incidence_rate_analyses`
- `pathway_analyses`
- `estimation_analyses`
- `prediction_analyses`
- `feature_analyses`
- `sccs_analyses`
- `evidence_synthesis_analyses`
- `self_controlled_cohort_analyses`

Add columns:

```sql
status         ENUM('draft','active','archived') NOT NULL DEFAULT 'active',
archived_at    TIMESTAMP NULL,
archived_by    BIGINT NULL REFERENCES users(id),
promoted_at    TIMESTAMP NULL
```

**Notes:**

- `DEFAULT 'active'` at the SQL level ensures existing rows are never silently hidden when the migration runs. The backfill command (§7) reclassifies a subset to `'draft'`.
- Soft deletes (`deleted_at`) remain on tables that already have them. **Archive is not soft-delete.** Soft-delete is reserved for the post-hard-delete 30-day purge window.
- The existing `deprecated_at` column on `cohort_definitions` is folded into `archived` (Migration B drops it after a release).

**One supporting table** (for the Cleanup Suggestions cache only — see §6.2 — *not* a usage log):

```sql
CREATE TABLE library_cleanup_suggestions (
  user_id        BIGINT NOT NULL REFERENCES users(id),
  item_type      VARCHAR(64) NOT NULL,   -- 'concept_set' | 'cohort_definition' | 'incidence_rate_analysis' | …
  item_id        BIGINT NOT NULL,
  last_activity_at TIMESTAMP NULL,
  computed_at    TIMESTAMP NOT NULL,
  PRIMARY KEY (user_id, item_type, item_id)
);
```

This is a denormalized cache refreshed nightly, not a permanent record. Refusing to introduce it would force a 7-table join on every page load.

**Trait:** `App\Concerns\HasLibraryLifecycle` provides:

- `$casts['status'] => LibraryStatus::class` (PHP enum, UPPERCASE cases per CLAUDE.md: `LibraryStatus::DRAFT`, `LibraryStatus::ACTIVE`, `LibraryStatus::ARCHIVED`).
- `scopeActive()`, `scopeDraft()`, `scopeArchived()`, `scopeVisibleTo(User $user)`.
- Methods `promote(User $actor)`, `archive(User $actor)`, `restore(User $actor)` — guard invalid transitions and stamp timestamps.
- Global scope `LibraryDefaultScope` hides Drafts (not-owner) and Archived from default queries; opt-in via `withDrafts()` / `withArchived()` / `withAnyStatus()`.

**Policies:** One `LibraryLifecyclePolicy` per model, three thin classes. Authorizes `promote`, `archive`, `restore`, `hardDelete`. `hardDelete` requires `role:super-admin`.

## 4. Visibility & permissions

| Status | Owner | Study collaborator (item attached to **active** Study) | Other users | Superuser |
|---|---|---|---|---|
| **Draft** | Visible (own lists, "Drafts" tab) | Hidden | Hidden | Visible when in superuser mode (inline "All users" toggle or `/admin/library`) |
| **Active** | Visible | Visible | Hidden | Visible always |
| **Archived** | Hidden by default (behind "Show archived" toggle) | Hidden | Hidden | Visible when in superuser mode (inline "All users" toggle or `/admin/library`) |
| **Soft-deleted** | Hidden | Hidden | Hidden | Visible in `/admin/library` Trash tab only (30-day grace) |

**Picker rule:** items appear only if (a) the user owns them AND `status='active'`, OR (b) they are attached to a non-archived Study the user collaborates on AND `status='active'`. Drafts revealable via "Show my drafts" checkbox (badged "DRAFT — will be promoted on attach"). Archived never shown.

**Route protection:** existing `permission:*.view|create|edit|run|delete` middleware unchanged. The new endpoints attach to existing permissions:

- `POST /api/v1/{entity}/{id}/promote` → `permission:{entity}.edit`
- `POST /api/v1/{entity}/{id}/archive` → `permission:{entity}.edit`
- `POST /api/v1/{entity}/{id}/restore` → `permission:{entity}.edit`
- `POST /api/v1/{entity}/bulk-archive` → `permission:{entity}.edit` + per-id policy check
- `POST /api/v1/admin/library/bulk-delete` → `role:super-admin`
- `GET /api/v1/admin/library` → `role:super-admin`

## 5. Auto-promote flow

When a Draft is referenced from an attachment endpoint (e.g., `POST /api/v1/studies/{id}/cohorts`):

1. The handler checks the target cohort's `status`. If `draft` and actor is owner, return `409 Conflict` with body `{ requires_promotion: true, item_id, item_name, owner_id }`.
2. Frontend catches the 409, opens a modal: *"Promote 'CHF Phenotype v3' to Active? It will become visible to your Study collaborators."*
3. On confirm, frontend calls `POST /api/v1/cohort-definitions/{id}/promote`, then retries the original attach. From the user's view this is atomic — failure of either step leaves no half-state because the attach is the second call and only runs after promote succeeds.
4. If actor is not the owner of the Draft, the attach is rejected with 403 (Drafts are private to their owner).

## 6. UI

### 6.1 List pages (`/concept-sets`, `/cohort-definitions`, `/analyses`)

- Header segmented control: **Active** (default) · **Drafts** · **Archived** · **All mine**, with counts.
- Multi-select checkboxes per row; toolbar appears on selection with **Archive** / **Restore** / **Promote** as contextually appropriate.
- Banner when >5 stale candidates exist: *"You have 12 items not used in 90+ days. Review for cleanup →"* (links to Cleanup Suggestions).

### 6.2 Cleanup Suggestions (`/library/cleanup`)

- Three sections (Concept Sets · Cohort Defs · Analyses). Each lists items where: `status='active'`, no active-Study attachment, and `updated_at < NOW() - 90 days`.
- Eligibility computed nightly by `SuggestLibraryCleanupJob`; results cached in a small denormalized table `library_cleanup_suggestions(user_id, item_type, item_id, last_activity_at, computed_at)` with 24h TTL. *Exception to "no new tables"* — needed because the eligibility query joins seven tables and we don't want to re-run on every page load.
- User bulk-selects → "Archive selected" → confirmation → archive. No auto-action.

### 6.3 Auto-promote modal

Triggered by the 409 response in §5. Buttons: **Promote & Attach** / **Cancel**. No third option (we don't want a "always promote silently" toggle — the gate is the point).

### 6.4 Pickers

- Default list filtered to the picker visibility rule in §4.
- "Show my drafts" checkbox slides in Drafts with a yellow "DRAFT" badge.
- Selecting a Draft + clicking Attach triggers the auto-promote modal.

### 6.5 Superuser inline mode

- On list pages, users with `super-admin` see a header toggle **My library** ↔ **All users**. Per-page state stored in localStorage.
- "All users" view adds an `Owner` column and owner filter, exposes bulk archive/restore/hard-delete in the toolbar.

### 6.6 `/admin/library`

- Unified table across all three entity types. Type filter chips: `All` · `Concept Sets` · `Cohort Defs` · `Analyses`.
- Filters: Owner, Status (default Active+Archived), Last activity range, Attached to active Study? (Yes/No/Any), Created before, Soft-deleted (trash view).
- Columns: Name, Type, Owner, Status, Last used, Studies (count, hover for list), Created.
- Bulk: **Archive**, **Restore**, **Hard delete**, **Reassign owner**.
- Trash tab shows soft-deleted items pending purge with **Restore** and **Purge now**.

### 6.7 Hard-delete preflight

- Requires `status='archived'` — endpoint refuses with 422 otherwise.
- Pre-flight returns count of Study attachments across ALL Studies (including archived). If >0, response includes blocking Study list with names + IDs; UI disables the action until detached.
- On confirm: soft-deletes row, writes `audit_log` entry `{actor_id, action: 'library.hard_delete', subject_type, subject_id, snapshot: <serialized row>}`. Nightly `PurgeSoftDeletedLibraryItemsJob` removes rows with `deleted_at > 30 days`.

### 6.8 Reassign owner

- Modal requires typing target user's email to confirm. Audit-logged. Rejected if target user lacks the relevant `.view` permission.

## 7. Backfill & migration plan

**Migration A (additive, ship first):**

- Add `status`, `archived_at`, `archived_by`, `promoted_at` columns to all 10 tables. Default `'active'` so no existing row is hidden.
- Add `library_cleanup_suggestions` table.

**Artisan command: `php artisan library:backfill-lifecycle [--dry-run|--apply]`**

Classifies existing rows:

1. **`status='active'`** for rows that are attached to ≥1 Study OR were updated in the last 90 days.
2. **`status='draft'`** for rows with zero Study attachments AND not updated in 30+ days. (Drafts are still owner-visible, so worst case the user sees them under the Drafts tab and promotes with one click.)
3. **`status='archived'`** for cohort_definitions where `deprecated_at IS NOT NULL`. Set `archived_at = deprecated_at`, `archived_by = NULL`.
4. Seeded/system items (phenotype library imports, OHDSI-imported cohorts) → `status='active'` unconditionally. Detection: `created_by IS NULL` or owner is the system seed user.

Dry-run prints a per-user summary. `--apply` runs the update inside a transaction per entity type.

**Migration B (follow-up, after one release cycle):**

- Drop `cohort_definitions.deprecated_at` and any related views.

**Rollback:** Migration A is purely additive. If the model proves wrong post-release, one `UPDATE … SET status='active'` per table restores prior behavior and the UI can ship a hotfix to hide the new controls. Migration B is deferred specifically to keep this rollback path open.

**User comms:** One-time dismissable toast on first post-release login: *"New: organize your library with Draft / Active / Archived states. [Show me] [Got it]"* — links to a one-page doc explaining the model.

## 8. Testing

### 8.1 Backend (Pest)

- `HasLibraryLifecycle` unit tests — transitions, invalid transitions, timestamp stamping.
- Policy tests per entity — owner vs collaborator vs other vs super-admin matrix for `view`, `promote`, `archive`, `restore`, `hardDelete`.
- Global scope tests — default list hides Drafts (non-owner) + Archived; opt-in flags work; superuser inline mode bypasses scope.
- Auto-promote interceptor — Draft attach returns `409 requires_promotion`, no DB mutation; promote-then-attach is atomic.
- Backfill command — fixture rows exercising each classification rule get the expected `status`.
- Hard-delete — refuses on non-archived; refuses with Study attachments (including archived Studies); writes audit_log; soft-deletes; purge job removes >30-day-deleted rows.

### 8.2 Frontend (Vitest)

- Segmented control switches query and clears bulk selection.
- Cleanup Suggestions panel: empty state, bulk archive calls correct endpoint.
- Auto-promote modal: 409 opens modal; confirm fires promote-then-attach; cancel resets selection.
- Picker: drafts hidden by default; "Show my drafts" reveals + badges; selecting a Draft + Attach triggers modal.
- Superuser inline toggle: only renders for `super-admin`; flip adds owner column + bulk actions.

### 8.3 E2E (Playwright)

- Regular-user golden path: create → promote → archive → restore a cohort definition.
- Superuser path: navigate to `/admin/library`, find archived item with no Study attachments, hard-delete → Trash → Restore.

### 8.4 Coverage

Existing 80% threshold applies to new code. Migrations and the backfill command are tested in isolation.

## 9. Open items / out of scope

- **Studies "archived" state:** the picker rule assumes Studies have an `archived` status. Recent commits show Studies have lock/publish; if "archived" isn't a Study state yet, that's a small follow-on (not a blocker — until then, the picker treats only "deleted/closed" Studies as inactive).
- **Notifications when superuser archives or reassigns an item you own:** not in v1. Audit log only.
- **Bulk-promote:** not in v1. Promotion is intentionally one-by-one with the confirmation gate.
- **Tags / folders:** out of scope. The 4-tab segmented control on each list page is the only organizational primitive in v1.

## 10. Implementation order (for the writing-plans step)

1. Migration A + `HasLibraryLifecycle` trait + `LibraryStatus` enum + global scope.
2. Policies + new API endpoints (`promote`, `archive`, `restore`, bulk variants).
3. Auto-promote interceptor on the Study/Analysis attachment endpoints + 409 contract.
4. Frontend: list-page segmented control + bulk toolbar.
5. Frontend: pickers (drafts checkbox + auto-promote modal handling 409).
6. Cleanup Suggestions job, table, page.
7. Superuser inline toggle on list pages.
8. `/admin/library` page (unified table) + hard-delete preflight + Trash.
9. Reassign owner.
10. Backfill command — dry-run output → apply.
11. Migration B (drop `deprecated_at`) — deferred one release.
