# Clinical Notes Tab — Patient Profiles

**Date:** 2026-03-09

## What Was Built

Added a **Notes** tab to Patient Profiles, positioned between Visits and Precision Medicine in the tab navigation. This surfaces the OMOP CDM `note` table (52.6M clinical notes) through a paginated, on-demand UI.

## Changes

### Backend
- **`PatientProfileService::getNotes()`** — Paginated query against `{cdmSchema}.note` with LEFT JOINs to concept table for note_type, note_class, encoding, and language resolution. Uses index-forced scans (`SET enable_seqscan = off`) with 10s timeout. Returns `{data: [...], meta: {current_page, last_page, per_page, total}}`.
- **`PatientProfileController::notes()`** — `GET /sources/{source}/profiles/{personId}/notes?page=&per_page=` endpoint. Max 100 per page, defaults to 50.
- **Route** registered before the catch-all `show` route in `api.php`.

### Frontend
- **`ClinicalNote` type** — Full OMOP note fields plus resolved concept names.
- **`getPatientNotes()` API function** + `NotesPaginatedResponse` type.
- **`usePatientNotes()` hook** — TanStack Query with page/perPage params.
- **`PatientNotesTab` component** — Expandable note cards with:
  - Note title, type badge (purple), class badge (blue)
  - Date, provider ID, visit ID, language metadata
  - Collapsible note text in monospace with 300-char preview
  - Top + bottom pagination controls
  - Empty/loading/error states
- **`PatientProfilePage`** — Added `"notes"` to `ViewMode` union and `VIEW_BUTTONS` array between Visits and Eras.

## Design Decisions

- **On-demand loading** (like Precision Medicine tab) — notes are NOT loaded with the main profile to avoid slowing the initial load.
- **Pagination** over the 52M row table rather than loading all notes for a patient.
- **Index-forced scans** — the `idx_note_person_id` index is critical for per-patient lookups on a 52M row table.

## Verification
- TypeScript: `npx tsc --noEmit` — clean
- PHPStan L8: `vendor/bin/phpstan analyse` — clean
