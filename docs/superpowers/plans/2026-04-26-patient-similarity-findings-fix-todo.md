# Patient Similarity Findings Fix TODO

> **Purpose:** Turn the April 26, 2026 Patient Similarity page review into an executable repair list. This file tracks the user-facing failures found in the workspace, API contract, and analysis pipeline.

**Goal:** Make the Patient Similarity workflow behave as advertised: settings affect searches, empty cohorts fail gracefully, cohort-seeded results can be exported, downstream analysis receives the selected patient set, and head-to-head/temporal links route to real endpoints.

---

## Priority 1: Request and response contract fixes

- [x] Wire workspace settings into API requests:
  - Send selected `mode` from the header toggle to cohort similarity search.
  - Send demographic filters from the settings drawer to cohort similarity search.
  - Keep weight overrides in the same payload as filters and mode.
  - Avoid sending default all-age filters unless the user narrows the range.

- [x] Normalize settings gender values:
  - Use the same `MALE` / `FEMALE` inputs as existing patient/cohort search forms.
  - Keep backend support for canonical `gender_concept_id` intact.

- [x] Guard against malformed search payloads:
  - Treat non-object or array responses as empty search results with metadata.
  - Show a failed pipeline step rather than crashing when a cohort has no generated members.

## Priority 2: Export and cohort result persistence

- [x] Make cohort-seeded similarity results exportable:
  - Cache centroid search results using `patient_similarity_cache`.
  - Include `cache_id` in `data.metadata`.
  - Preserve query metadata such as weights, filters, mode, and cohort identifiers.

- [x] Keep export behavior scoped:
  - Export only returned similar patients above the optional threshold.
  - Do not export seed cohort members unless they appear in the cached result set.

## Priority 3: Pipeline step handoff

- [x] Preserve selected patient IDs between steps:
  - Landscape should receive the PSM matched-pair patient IDs in compare mode.
  - Landscape should receive returned similar patient IDs in expand mode.
  - The AI projection call should mark those IDs as cohort members.

- [x] Make downstream steps operate on the step output when available:
  - Phenotype discovery should accept explicit `person_ids` / `cohort_person_ids`.
  - SNF should accept explicit `person_ids` / `cohort_person_ids`.
  - Fall back to the original cohort only when no step output exists.

## Priority 4: Head-to-head and temporal comparison

- [x] Repair profile links:
  - Use `/profiles/{personId}?sourceId={sourceId}` rather than stale `/patient-profiles`.

- [x] Repair temporal comparison:
  - Align frontend argument order with `fetchTemporalSimilarity(personA, personB, sourceId)`.
  - Add or expose a backend `/patient-similarity/temporal-compare` route.
  - Proxy the request to the AI service `/patient-similarity/temporal-similarity` endpoint.

- [ ] Decide whether to surface the drawer or keep the comparison page as canonical:
  - If keeping the drawer, add a working open path.
  - If not, remove dead drawer state from the workspace in a follow-up cleanup.

## Priority 5: Individual patient similarity entrypoint

- [x] Restore the Patient Profile launch path:
  - Read `person_id` and `source_id` query params on `/patient-similarity`.
  - Trigger patient-seeded search or show a clear single-patient search surface.
  - Ensure the result table receives `seedPersonId` so compare links are enabled.

## Verification checklist

- [ ] Frontend tests for:
  - Settings payload includes mode/filters/weights.
  - Empty cohort result does not crash.
  - Cohort result with `cache_id` enables export.
  - Profile launch query params render or trigger patient search.
  - [x] Temporal comparison calls the correct client signature.

- [ ] Backend tests for:
  - Empty cohort response shape is stable.
  - Cohort search creates a cache row and returns `metadata.cache_id`.
  - Landscape proxy forwards both `person_ids` and `cohort_person_ids`.
  - Temporal route validates and proxies expected payload.

- [x] Commands:
  - [x] `npm run test:run -- src/features/patient-similarity`
  - [x] `npx eslint src/features/patient-similarity`
  - [x] `php -l backend/app/Http/Controllers/Api/V1/PatientSimilarityController.php`
  - [x] `php -l backend/app/Services/PatientSimilarity/PatientSimilarityService.php`
  - [x] `php -l backend/routes/api.php`
  - [x] `npx tsc -b`
  - [x] `./vendor/bin/pest --filter='CareBundle|PatientSimilarity'`
  - [x] `git diff --check`
