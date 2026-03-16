# Faker Fixture Cleanup — 2026-03-16

## Problem

The Fort Knox `parthenon:export-designs` command was exporting **faker-generated test cohort definitions** alongside real clinical designs. 11 files with Latin lorem ipsum names (e.g., `ut-doloremque.json`, `alias-occaecati-tempora.json`) appeared as untracked files in git.

These were created when Laravel factories generated test cohorts in the database (likely via `commons:seed-demo` or test runs), and the design exporter blindly serialized everything.

## Root Cause

`DesignFixtureExporter::exportAll()` had no filtering — it exported every row from every design entity table, including factory-generated test data with Faker Lorem text.

## Fix

1. **Deleted 11 faker-generated fixture files** from `database/fixtures/designs/cohort_definitions/`.

2. **Added faker detection filter** to `DesignFixtureExporter`:
   - `FAKER_LATIN_WORDS` constant: 40 common words from PHP Faker's Lorem provider.
   - `isFakerGenerated(name, description)`: returns true when name+description contain >= 3 Latin faker words. Threshold of 3 avoids false positives on real clinical names.
   - `exportEntity()` checks the filter before writing, logs skips, now returns `bool`.
   - `exportAll()` tracks skipped count.

3. **Updated `ExportSummary`** with `skipped` property and `addSkipped()`/`withSkipped()` methods.

4. **Updated `ExportDesigns` command** output to report skipped count.

## Files Changed

- `backend/app/Services/DesignProtection/DesignFixtureExporter.php` — faker filter + return type
- `backend/app/Services/DesignProtection/ExportSummary.php` — skipped counter
- `backend/app/Console/Commands/ExportDesigns.php` — output message

## Verification

- Existing callers (`DesignAuditObserver`, test file) discard return value, so `void` -> `bool` is backward-compatible.
- Test assertions on `$summary->written` and `$summary->errors` unaffected by new `skipped` field.
