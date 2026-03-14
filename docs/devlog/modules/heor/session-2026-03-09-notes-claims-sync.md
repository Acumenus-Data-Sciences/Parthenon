# Session Devlog — 2026-03-09

**Date:** 2026-03-09

## What Was Built

### 1. Clinical Notes Tab (Patient Profiles)

Added a **Notes** tab to Patient Profiles between Visits and Precision Medicine, surfacing the OMOP CDM `note` table (52.6M clinical notes).

**Backend:**
- `PatientProfileService::getNotes()` — Paginated query against `{cdmSchema}.note` with LEFT JOINs to concept for note_type, note_class, encoding, language. Index-forced scans with 10s timeout.
- `PatientProfileController::notes()` — `GET /sources/{source}/profiles/{personId}/notes?page=&per_page=`
- Route registered before the catch-all `show` route in `api.php`

**Frontend:**
- `ClinicalNote` type, `getPatientNotes()` API function, `usePatientNotes()` hook
- `PatientNotesTab` component — expandable note cards with type/class badges, pagination, metadata
- `PatientProfilePage` — added `"notes"` to ViewMode union and VIEW_BUTTONS array

### 2. COVID-19 Chest Imaging Cohort

Created a plausible cohort definition for COVID-19 patients with imaging data:
- **COVID-19 concept:** 37311061 (SNOMED 840539006)
- **Imaging concepts:** 4163872 (Plain chest X-ray), 4167549 (CT chest/abdomen/pelvis), 4302356 (CT chest and abdomen), 36713048 (HRCT chest)
- Full OHDSI `expression_json` with ConceptSets, PrimaryCriteria, and AdditionalCriteria
- Populated `achilles_results.cohort` with matching patients
- Accessible from the Cohort Definitions page (not just Patient Profiles)

### 3. Claims Explorer (HEOR Page)

Added a **Claims Explorer** tab to the HEOR page:
- `ClaimsSearchService` — Solr-backed faceted search with financial analytics
- `ClaimsSearchController` — REST API at `GET /v1/claims/search`
- `ClaimsExplorer` React component — search, facets, stats, pagination
- Claims Solr core with 24-field schema and clinical notes indexing support

### 4. Local PG ↔ Docker PG Database Sync

Built `php artisan db:sync` command to keep the app databases synchronized:
- **Pure PHP/PDO** — no external pg_dump dependency
- **Three-phase approach:** truncate all targets → bulk-copy data → reset sequences
- Column-intersect for schema drift tolerance
- Auto-runs migrations on target if schema is missing
- Flags: `--reverse`, `--tables=`, `--dry-run`, `--force`
- Skips transient tables (sessions, cache, jobs, tokens)
- `docker_pg` connection added to `config/database.php`

**Key bug fixed:** CASCADE truncate during alphabetical sync was wiping already-inserted child data. Solved by separating truncation (phase 1) from insertion (phase 2).

### 5. Automated Sync Hook

Configured a Claude Code `PostToolUse` hook to auto-run `db:sync --force` after every `./deploy.sh` execution, keeping Docker PG perpetually in sync with local PG.

**Config:** `~/.claude/settings.json` → `hooks.PostToolUse` with `matcher: "Bash"`, `pattern: "./deploy.sh"`

### 6. Miscellaneous
- Added `*.txt` to `.gitignore`
- Fixed admin credentials on local PG (`admin@acumenus.net` / `superuser`)
- Seeded missing Acumenus CDM source + daimons on local PG `app.sources`

## Files Changed

| Area | Files |
|------|-------|
| Backend | `PatientProfileService.php`, `PatientProfileController.php`, `routes/api.php`, `config/database.php`, `SyncDatabaseCommand.php`, `ClaimsSearchService.php`, `ClaimsSearchController.php` |
| Frontend | `profile.ts`, `profileApi.ts`, `useProfiles.ts`, `PatientNotesTab.tsx`, `PatientProfilePage.tsx`, `claimsApi.ts`, `useClaims.ts`, `ClaimsExplorer.tsx`, `HeorPage.tsx` |
| Config | `.gitignore`, `~/.claude/settings.json` (hook) |
| Docs | `clinical-notes-tab.md`, `claims-solr-core-and-notes-indexing.md` |

## Gotchas & Lessons

- **CASCADE truncate order matters:** Truncating parent tables with CASCADE wipes already-inserted child data. Always truncate ALL tables first, then insert.
- **Docker PG networking:** PHP container must use `postgres:5432` (Docker DNS), not `127.0.0.1:5480` (host port).
- **`session_replication_role = replica`** disables FK triggers during bulk operations — essential for unordered inserts.
- **Rate limiting bites during testing:** `throttle:5,15` on auth routes means 5 requests per 15 minutes per IP. Clear cache if hit: `php artisan cache:clear`.
