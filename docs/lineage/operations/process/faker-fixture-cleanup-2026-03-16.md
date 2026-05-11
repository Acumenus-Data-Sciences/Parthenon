---
doc_type: lineage
status: historical
date: 2026-03-16
owner: acumenus
module: testing
lineage_anchor: true
supersedes: []
superseded_by: null
related_code: []
related_prs: []
---
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

---

## Production Database Cleanup (Late Session)

### Problem

Despite the Fort Knox export fix above, **faker-generated test data was still present in the production `ohdsi` database** on `pgsql.acumenus.net`. The app's Cohort Definitions and Concept Sets pages were full of Latin gibberish entries.

### Scope

| Table | Faker Rows | IDs Deleted | Legitimate Rows Kept |
|-------|-----------|-------------|---------------------|
| `app.cohort_definitions` | 64 | 85–148 | 19 (including study cohorts 70–84, COVID-19 #19) |
| `app.concept_sets` | 42 | 92–133 | 37 (including study concept sets 67–91) |

All faker rows shared the timestamp `2026-03-15 20:43:17–18`, indicating a single Pest test run leaked factory data into production.

### Root Cause

Pest tests using Laravel factories ran against the production `ohdsi` database instead of `parthenon_testing`. The `RefreshDatabase` or `DatabaseTransactions` traits either weren't used or didn't roll back properly.

### Actions Taken

1. Backed up prod DB: `backups/ohdsi-app-20260316-230033.sql`
2. Verified no FK dependencies (study_cohorts, concept_set_items) on faker rows
3. Deleted 64 faker cohort_definitions and 42 faker concept_sets via direct SQL
4. Verified 19 cohorts and 37 concept sets remain (all legitimate)
5. Added high-priority memory note to prevent recurrence

### Prevention

- `.env.testing` must always point to `parthenon_testing`, never `ohdsi`
- All test factories must use `RefreshDatabase` or `DatabaseTransactions` traits
- Spot-check prod tables for Latin faker names after any test run
