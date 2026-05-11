# Recent Profiles & Default CDM Source

**Date:** 2026-03-07
**Scope:** Patient Profiles, Data Sources, cross-app source selection

---

## What Was Built

### 1. Recent Profiles (Frontend)

- **Zustand store** (`stores/profileStore.ts`) with `persist` middleware tracks last 15 viewed patient profiles in localStorage
- Each entry stores: personId, sourceId, sourceName, gender, yearOfBirth, viewedAt timestamp
- Duplicates (same person + source) are de-duped, most recent view wins
- **PatientProfilePage landing** shows a "Recent Profiles" grid above the cohort browser
  - Clickable cards with patient ID, age, gender, source name, relative time
  - "Clear" button to reset history
- Profile is recorded when data loads successfully (not on navigation, preventing empty records)

### 2. Default CDM Source (Backend + Frontend)

#### Backend
- Migration: `is_default` boolean on `sources` table (default false)
- Source model: added to fillable + casts
- SourceController:
  - `PUT /sources/{source}/set-default` — clears all others, sets one as default
  - `DELETE /sources/default` — clears any default

#### Frontend
- **SourcesListPage**: Star button on each source row to toggle default. Gold star badge on default source.
- **SourceSelector**: Auto-selects default source when `value` is null and sources load. Shows gold star icon for default. Option labels prefixed with star character.
- **PatientProfilePage**: Auto-selects default source when no `?sourceId` param present
- **DashboardPage**: Prefers default source over first-in-list for auto-selection
- **sourceStore.ts**: Global Zustand store caching the default source ID

### 3. Multi-Expand on Data Sources Page

- Changed from single `expandedId` to `expandedIds: Set<number>` so multiple source cards can be expanded simultaneously

## Analysis Designer Defensive Fixes (from prior session)

- CovariateSettingsPanel: nullish coalescing for `timeWindows` array
- All analysis designers (SCCS, Estimation, Prediction, Incidence Rate, Characterization): deep-merge with default design objects to prevent crashes on missing nested keys
- Evidence Synthesis and SCCS detail pages: defensive guards for undefined properties

## Key Decisions

- **localStorage over database** for recent profiles — per-browser, no server roundtrip, HIPAA-friendly (only stores person IDs, not PHI)
- **Single default source** — only one source can be default at a time (toggle semantics: click again to clear)
- **Auto-select is non-intrusive** — only fires when value is null, doesn't override explicit user selection

## Files Changed

### New
- `backend/database/migrations/2026_03_07_200001_add_is_default_to_sources_table.php`
- `frontend/src/stores/profileStore.ts`
- `frontend/src/stores/sourceStore.ts`

### Modified
- `backend/app/Models/App/Source.php` — is_default field
- `backend/app/Http/Controllers/Api/V1/SourceController.php` — setDefault/clearDefault
- `backend/routes/api.php` — new routes
- `frontend/src/types/models.ts` — is_default on Source interface
- `frontend/src/features/data-sources/api/sourcesApi.ts` — setDefaultSource/clearDefaultSource
- `frontend/src/features/data-sources/hooks/useSources.ts` — mutation hooks
- `frontend/src/features/data-sources/pages/SourcesListPage.tsx` — star toggle + multi-expand
- `frontend/src/features/data-explorer/components/SourceSelector.tsx` — auto-select + star icon
- `frontend/src/features/profiles/pages/PatientProfilePage.tsx` — recent profiles + auto-select
- `frontend/src/features/dashboard/pages/DashboardPage.tsx` — prefer default source
- Multiple analysis designer/detail pages — defensive null guards
