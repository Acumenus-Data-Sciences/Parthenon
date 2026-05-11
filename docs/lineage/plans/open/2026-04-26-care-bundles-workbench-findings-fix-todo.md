# CareBundles Workbench Findings Fix TODO

> **Purpose:** Turn the April 26, 2026 CareBundles Workbench review into an executable repair list. This pass builds on the April 25 audit/follow-up and focuses on workflow correctness, stale UI state, source scoping, API contract hardening, and confidence interval resilience.

**Goal:** Keep the workbench trustworthy during repeated analyst workflows: source changes should scope the visible run history, modals should not leak state between measures, long-running/export actions should report success or failure, route-level measure actions should only operate on measures in the selected bundle, and Wilson intervals should never emit `NaN` into API responses.

---

## Priority 1: Source-scoped workflow correctness

- [x] Scope recent runs to the selected source on the bundle detail page:
  - Pass `source_id` to `GET /care-bundles/{bundle}/runs`.
  - Include `source_id` in the React Query key.
  - Keep invalidation broad enough that a materialize dispatch refreshes all run views for the bundle.
  - Update the Recent Runs subtitle so users know they are looking at the active source.

- [x] Surface materialization dispatch feedback:
  - Show the API `message` after a single-bundle dispatch.
  - Preserve and display `below_population_threshold` for research-only sources.
  - Show a clear inline error if the dispatch fails.
  - Add equivalent success/error feedback for `Materialize all`.

## Priority 2: Modal state and export UX

- [x] Prevent roster modal state leaks:
  - Unmount the roster modal when it is closed.
  - Reset bucket, page, save form, name, description, public flag, saved cohort id, and mutation error between measures/sources.
  - Avoid leaving global Escape handlers attached while the modal is closed.

- [x] Prevent methodology modal global Escape leakage:
  - Unmount the methodology modal while closed.
  - Keep query execution disabled until a measure/source is actually selected.

- [x] Harden FHIR Measure download feedback:
  - Track export pending/error state.
  - Disable the button while a download is in progress.
  - Catch failed downloads instead of allowing an unhandled promise rejection.

## Priority 3: Backend contract hardening

- [x] Enforce bundle-measure membership on measure-specific endpoints:
  - `roster`
  - `roster/to-cohort`
  - `trend`
  - `methodology`
  - `strata`

- [x] Return an explicit 404 JSON error when a route measure is not part of the route bundle.

- [x] Add tests for the membership guard so mixed bundle/measure route IDs do not silently return empty or misleading data.

## Priority 4: Wilson confidence interval resilience

- [x] Harden `WilsonCI::compute` against invalid historical counts:
  - Return `null` for negative numerator/denominator inputs.
  - Clamp numerator to denominator when the stored numerator exceeds denominator so API serialization cannot emit `NaN`.
  - Preserve the existing denominator-zero behavior.

- [x] Add focused tests for zero denominator, normal proportions, and numerator-greater-than-denominator.

## Priority 5: Follow-up improvements

- [x] Fix local Pest host drift:
  - Pin PHPUnit's test database host/port to `127.0.0.1:5432` so local test runs do not hang on remote or container-only hostnames from dotenv files.

- [ ] Decide whether intersection source selection should use `/care-bundles/sources` instead of generic `/sources`:
  - This would allow the same research-only labeling and population-gate explanation as the detail page.
  - Keep intersection available for research-only sources if that is intentional.

- [ ] Consider limiting Venn mode to 2–3 selected bundles:
  - The component already explains the limit, but the chart toggle remains enabled for 4+ bundles.

- [ ] Add frontend tests around the workbench detail page once a test harness for `useBundles`, `useBundle`, and workbench hooks is in place.

## Verification checklist

- [x] Frontend:
  - [x] `npx eslint src/features/carebundles-workbench`
  - [x] `npm run test:run -- src/features/carebundles-workbench src/features/patient-similarity`
  - [ ] Focused Vitest coverage for roster modal reset/export feedback if feasible.
  - [x] Focused Vitest coverage for source-scoped run query.

- [x] Backend:
  - [x] `php -l backend/app/Http/Controllers/Api/V1/CareBundleController.php`
  - [x] `php -l backend/app/Services/CareBundles/WilsonCI.php`
  - [x] `php -l backend/tests/Feature/Api/V1/CareBundleControllerTest.php`
  - [x] `php -l backend/tests/Unit/Services/CareBundles/WilsonCITest.php`
  - [x] `./vendor/bin/pest --filter=CareBundle`
  - [x] `./vendor/bin/pest --filter='CareBundle|PatientSimilarity'`

- [x] Whole-project caveats:
  - [x] `npx tsc -b`
  - [x] `npm run i18n:report`
  - [x] `git diff --check`
