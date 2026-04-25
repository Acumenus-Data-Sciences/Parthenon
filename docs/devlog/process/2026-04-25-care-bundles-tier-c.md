# Care Bundles — Phase 3 Tier C: Patient Roster Drill-Down + Help Content

**Date:** 2026-04-25

## What shipped

### Migration: care_bundle_measure_person_status

New table storing per-person compliance flags for every (run, measure) pair.
Written during materialization alongside aggregate counts. Powers paginated
roster queries without hitting CDM at click time.

Columns: `care_bundle_run_id`, `quality_measure_id`, `person_id`, `is_numer`, `is_excl`.
Composite primary key; secondary index on flags for fast bucket filters.

### Backend

- **CohortBasedMeasureEvaluator** — writes person-status rows after each
  measure evaluation using existing temp tables (`cb_eval_numer_pp`,
  `cb_eval_excl_pp`). One `INSERT...SELECT` while temp tables are still in scope.
- **MeasureRosterService** — paginated patient roster by compliance bucket
  (`non_compliant` / `compliant` / `excluded`). JOINs CDM `person` table for
  age and sex. PHI-safe: no dates, names, or identifiers.
- **MeasureCohortExportService** — materializes a compliance bucket into a
  first-class `CohortDefinition` with members written to `results.cohort`.
  Mirrors the `IntersectionCohortService` pattern.
- Two new routes: `GET /{bundle}/measures/{measure}/roster` and
  `POST .../roster/to-cohort`. Both require `care-bundles.view` /
  `care-bundles.create-cohort` permissions respectively.

### Frontend

- **MeasureRosterModal** — paginated patient table, bucket tabs
  (Non-compliant / Compliant / Excluded), and inline "Save as cohort" form
  with name, description, and public/private toggle. Success banner links to
  the new cohort ID.
- **CareBundleDetailPage** — `Users` icon button on each measure row opens the
  roster modal for that measure.
- Types, API functions, and TanStack Query hooks added for roster and export.

### Help content

8 contextual help files covering all CareBundles Workbench pages:

| Key | Page |
|-----|------|
| `workbench.care-bundles` | Home / coverage matrix |
| `workbench.care-bundles.detail` | Bundle detail with measures |
| `workbench.care-bundles.compare` | Cross-source delta comparison |
| `workbench.care-bundles.intersect` | UpSet/Venn intersection explorer |
| `workbench.care-bundles.value-sets` | VSAC value set library |
| `workbench.care-bundles.value-set` | Individual value set detail |
| `workbench.care-bundles.measures` | CMS eCQM catalog |
| `workbench.care-bundles.measure` | Individual CMS measure detail |

`HelpButton` wired into all 8 page headers.
