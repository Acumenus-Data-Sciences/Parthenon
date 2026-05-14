---
doc_type: lineage
status: historical
date: 2026-05-14
owner: acumenus
module: studies
lineage_anchor: true
supersedes: []
superseded_by: null
related_code:
  - backend/database/migrations/2026_05_14_003903_add_visibility_to_publication_drafts.php
  - backend/app/Models/App/PublicationDraft.php
related_prs: []
---
# 2026-05-14 — Visibility + updated_by_user_id on publication_drafts (Phase 3, Task 33)

Part of the pre-publication library Phase 3 work (study-scoped sharing).
Adds two columns to `app.publication_drafts` so draft visibility can be
toggled between owner-private and study-scoped sharing, and so we can
record which user last edited a draft (audit + read-only wizard mode in
later Phase 3 tasks).

## Schema — `app.publication_drafts` (additive)

`backend/database/migrations/2026_05_14_003903_add_visibility_to_publication_drafts.php`

| Column | Type | Default | Notes |
|---|---|---|---|
| `visibility` | `varchar(16)` | `'private'` | NOT NULL. Values: `private`, `study`. Backfilled to `private` for existing rows. |
| `updated_by_user_id` | `bigint` | `null` | FK → `app.users(id)` ON DELETE SET NULL. Captures last editor for shared drafts. |

Composite index `publication_drafts_study_visibility_idx` on
`(study_id, visibility)` supports the Phase 3 `Study::scopeAccessibleBy`
join (Task 34) without sequential scans.

The migration is fully reversible: `down()` drops the index, then the
constrained FK, then the `visibility` column.

## Model

`PublicationDraft::$fillable` extended with `visibility` and
`updated_by_user_id` so controllers and policies introduced in Tasks 34–35
can assign these directly.

## What's next in Phase 3

- Task 34 — `Study::scopeAccessibleBy(User)` reuses the
  `(study_id, visibility)` index for shared-draft visibility lookups.
- Task 35 — `PublicationDraftPolicy` enforces owner vs study-shared
  read/write rules.
- Tasks 36–39 — frontend visibility badges, share dropdown, and
  read-only wizard mode driven by these columns.
