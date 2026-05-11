# CI Fix: Phenotype schema alignment + authoring controller

**Date:** 2026-04-16
**Scope:** Backend (Laravel), Frontend (React), AI (Python)

## Summary

Backend `cohort_phenotype_validations` and `cohort_phenotype_adjudications` schemas
had drifted from the service/test layer. Migrations updated to add the
columns the service and tests already referenced.

## Migration changes (fresh-install only)

Because these migrations have not shipped to any production environment, the
existing files were edited in place rather than adding supplemental migrations.

### `cohort_phenotype_validations` (000006)

Added columns:

- `settings_json` (jsonb, nullable) — input payload, e.g. `{counts: {...}}` or `{review_state: 'draft'}`
- `result_json` (jsonb, nullable) — executor output
- `fail_message` (text, nullable) — failure reason
- `author_id` (fk users, nullable)
- `started_at`, `completed_at` (timestamps, nullable)

Existing columns (`counts_json`, `metrics_json`, `created_by`, `computed_at`)
are preserved for now.

### `cohort_phenotype_adjudications` (000007)

Renamed columns to match service/test usage:

- `validation_id` → `phenotype_validation_id`
- `sample_type` → `sample_group`

Added `demographics_json` (jsonb, nullable) to satisfy migration 000009's
`after('demographics_json')` reference.

## Code changes

- `CohortPhenotypeValidation`: fillable + casts (status → ExecutionStatus enum)
- `CohortPhenotypeAdjudication`: fillable + casts; relation to validation via `phenotype_validation_id`
- `PhenotypeValidationController::store()`:
  - `mode=counts` → 202 queued, dispatches `RunPhenotypeValidationJob`
  - `mode=adjudication` → 201 pending, sets `review_state=draft`
  - Rejects all-zero counts
- `PredictionController`: accepts DeepPatientLevelPrediction model types
  (transformer, resnet, cnn, lstm, gru)
- `CohortAuthoringArtifactController`: wired to `CohortAuthoringArtifactService`;
  supports export `format=` query param, import with `duplicate_strategy` (suffix/skip/replace),
  persists `CohortAuthoringArtifact` rows
- `ResultsSchemaRoutingTest`: skipped when local parthenon DB unreachable (CI)
- `ai/phenotype_discovery.py`: mypy fixes (np.asarray, dict[str,Any] annotation)
- `DemographicsResults.tsx`: useMemo above early return (react-hooks/rules-of-hooks)
