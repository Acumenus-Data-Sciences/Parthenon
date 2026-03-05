# Phase 9.2 — Import/Export Compatibility Layer

**Date:** 2026-03-02
**Branch:** master

## What was built

Atlas-compatible import/export for cohort definitions and concept sets, plus cohort tagging and read-only share links. Research teams can now migrate from OHDSI Atlas without manual re-entry.

---

## Database

### Migration `2026_03_02_400000_add_tags_and_sharing_to_cohort_definitions`
- `tags JSONB NULL` — array of tag strings per cohort definition
- `share_token VARCHAR(64) UNIQUE NULL` — 64-char random token for share links
- `share_expires_at TIMESTAMP NULL` — expiry for share links
- Index `idx_cohort_definitions_share_token` on `share_token`

---

## Backend

### CohortDefinition model
- Added `tags`, `share_token`, `share_expires_at` to `$fillable`
- Casts: `tags → 'array'`, `share_expires_at → 'datetime'`

### CohortDefinitionController — new methods
- **`import()`** `POST /cohort-definitions/import`
  - Accepts single or array of `{name, description, expression}`
  - Validates via `CohortExpressionSchema::validate()`
  - Duplicate check by `lower(name)` match
  - Returns `{imported, skipped, failed, results[]}`
- **`export()`** `GET /cohort-definitions/{id}/export`
  - Returns `{name, description, expression}` (Atlas wrapper format)
- **`tags()`** `GET /cohort-definitions/tags`
  - Uses `jsonb_array_elements_text()` to enumerate distinct tags across all non-deleted definitions
- **`share()`** `POST /cohort-definitions/{id}/share`
  - `?days=` param (1–365, default 30)
  - Sets `share_token` + `share_expires_at`
  - Returns `{token, url, expires_at}`
- **`showShared()`** `GET /cohort-definitions/shared/{token}` (**public, no auth**)
  - Returns `{id, name, description, expression, expires_at}` or 404 if missing/expired

Also updated `index()` to support `?tags[]=` filter using JSONB `@>` containment.

### ConceptSetController — new methods
- **`import()`** `POST /concept-sets/import`
  - Atlas format: `{name, expression: {items: [{concept: {CONCEPT_ID,...}, isExcluded, includeDescendants, includeMapped}]}}`
  - Creates `ConceptSet` + `ConceptSetItem` rows
  - Batch supported (array of objects)
- **`export()`** `GET /concept-sets/{id}/export`
  - Returns full Atlas format with concept objects enriched from vocab
  - Fields: CONCEPT_ID, CONCEPT_NAME, DOMAIN_ID, VOCABULARY_ID, CONCEPT_CLASS_ID, STANDARD_CONCEPT, CONCEPT_CODE

### Routes (`api.php`)
- Static routes added **before** `apiResource()` calls to avoid wildcard conflicts:
  - `POST /cohort-definitions/import`
  - `GET /cohort-definitions/tags`
  - `GET /cohort-definitions/{id}/export`
  - `POST /cohort-definitions/{id}/share`
  - `POST /concept-sets/import`
  - `GET /concept-sets/{id}/export`
- Public route outside auth middleware: `GET /cohort-definitions/shared/{token}`

### Artisan command — `ImportAtlasCohortsCommand`
- Signature: `parthenon:import-atlas-cohorts {path}`
- Reads all `*.json` in directory (or single file)
- Skips duplicates by case-insensitive name match
- Color-coded output: `✓ Imported N  ↷ Skipped K (duplicate)  ✗ Failed M`
- Auto-discovers first super-admin as author (override with `--user-id=`)

---

## Frontend

### API additions

**`cohortApi.ts`:**
- `importCohortDefinitions(payload)` → POST /cohort-definitions/import
- `exportCohortDefinition(id)` → GET /cohort-definitions/{id}/export
- `getCohortTags()` → GET /cohort-definitions/tags
- `shareCohortDefinition(id, days?)` → POST /cohort-definitions/{id}/share
- `getSharedCohort(token)` → GET /cohort-definitions/shared/{token}

**`conceptSetApi.ts`:**
- `importConceptSets(payload)` → POST /concept-sets/import
- `exportConceptSet(id)` → GET /concept-sets/{id}/export

### New components
- **`ImportCohortModal`** — file upload + JSON paste; shows import summary (imported/skipped/failed)
- **`ShareCohortModal`** — expiry picker (7/14/30/90/365 days), generates link, copy-to-clipboard

### New page
- **`SharedCohortPage`** (`/shared/:token`) — public, no-auth page showing cohort name/description/expression JSON read-only

### Updated pages
- **`CohortDefinitionsPage`** — "Import" button (opens ImportCohortModal), tag filter chips with multi-select, clear-all
- **`CohortDefinitionDetailPage`** — "Export" button (downloads JSON), "Share" button (opens ShareCohortModal)
- **`ConceptSetsPage`** — "Import" button (inline modal using same pattern)
- **`ConceptSetDetailPage`** — "Export" button (downloads Atlas JSON)

### Type updates
- `CohortDefinitionListParams` gained `tags?: string[]` for server-side tag filtering
- `CohortDefinitionList` now accepts `tags?: string[]` prop

### Router
- Added `/shared/:token` as public (unauthenticated) lazy route before the ProtectedLayout subtree

---

## Test results (manual)

| Endpoint | Result |
|----------|--------|
| `POST /cohort-definitions/import` (valid) | 201, `imported: 1` |
| `POST /cohort-definitions/import` (duplicate) | 201, `skipped: 1` |
| `GET /cohort-definitions/tags` | `[]` (no tags set yet) |
| `GET /cohort-definitions/{id}/export` | Atlas JSON with name/description/expression |
| `POST /cohort-definitions/{id}/share` | token + url + expires_at returned |
| `GET /cohort-definitions/shared/{token}` (no auth) | definition data returned |
| `GET /cohort-definitions/shared/{expired-token}` | 404 |
| `POST /concept-sets/import` (Atlas format) | 201, `imported: 1` |
| `GET /concept-sets/{id}/export` | Atlas format with CONCEPT_ID etc. |
| `php artisan parthenon:import-atlas-cohorts /tmp/test-cohorts/` | `✓ Imported 1` |
| Re-run artisan command | `↷ Skipped 1 (duplicate)` |
| `npx tsc --noEmit` | 0 errors |
| Vite build | success |

---

## Gotchas / Notes
- Static routes (`/import`, `/tags`) must be declared **before** `apiResource()` in `api.php`, otherwise Laravel's wildcard `{cohortDefinition}` route captures them first and tries to find a record with ID "import" or "tags".
- `jsonb_array_elements_text()` is PostgreSQL-specific — fine for this project (PostgreSQL-only).
- The `CohortExpressionSchema::validate()` requires non-empty `PrimaryCriteria.CriteriaList`, so importing minimal Atlas cohorts with empty criteria will fail validation. This is intentional — imports must be valid cohort definitions. Users importing skeletons from Atlas need to add criteria first.
- Share URL returned by the API uses the backend host; the frontend `ShareCohortModal` overrides it with `window.location.origin` to produce the correct frontend URL.
