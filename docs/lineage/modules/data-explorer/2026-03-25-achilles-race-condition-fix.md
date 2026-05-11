# Achilles Race Condition Fix & Data Pipeline Hardening

**Date:** 2026-03-25
**Module:** Data Explorer / Achilles Engine
**Impact:** Critical — production dashboard was blank due to data loss from concurrent runs

## Problem

After a successful 127/127 Achilles run, the CDM Characterization dashboard showed blank data. Investigation revealed a chain of failures:

1. **Concurrent Achilles runs** — Multiple runs (IDs 1, 4, 5, 6, 8) were dispatched for the same source overlapping in time. Each analysis SQL does `DELETE FROM achilles_results WHERE analysis_id = X; INSERT INTO ...`, so concurrent runs deleted each other's results.

2. **Resume logic masked the data loss** — Run 8 (the "successful" one) found step records from prior runs marked "completed" and skipped 112 of 127 analyses. Only 15 cost-related analyses actually executed, while the core analyses (person counts, demographics, domain counts) were never re-run. Their data had been wiped by the concurrent runs.

3. **Auto-release duplicate key crash** — After analyses completed, `CreateAutoRelease` tried to create a `SourceRelease` with a key that already existed from a prior attempt, throwing `UniqueConstraintViolationException`. This prevented the `ReleaseCreated` event from firing.

4. **Incomplete cache invalidation** — Even when the event did fire, `ComputeDqDeltas` only invalidated 5 of 8+ Redis cache keys. Three keys added during Ares v2 (`coverage:extended`, `geographic-diversity`, `cost-compare`) were never added to the invalidation list.

5. **Missing Analysis 10** — The age distribution pyramid (year of birth × gender cross-tabulation) was never registered in the analysis registry, so it never ran. The `getDemographics()` method depended on it for the age pyramid display.

## Root Cause

No concurrency guard existed on Achilles job dispatch. The UI, artisan command, and queue system all allowed multiple runs for the same source simultaneously. Combined with the destructive DELETE+INSERT pattern of each analysis, this created a race condition where runs would destroy each other's output.

## Fixes

### 1. Concurrent Run Prevention (3 layers)

**`RunAchillesJob.php`** — Added `ShouldBeUnique` interface keyed per source (`uniqueId = achilles-source-{id}`) with 4-hour lock TTL. Also added a runtime guard that aborts if another run is already in `running` status for the same source.

**`AchillesController.php`** — API endpoint returns **409 Conflict** with active run details if a run is already pending/running for the requested source.

**`RunAchillesCommand.php`** — Artisan command rejects with error message if a run is already active.

### 2. Release Service Idempotency

**`ReleaseService.php`** — Changed `autoSnapshot()` from `SourceRelease::create()` to `SourceRelease::firstOrCreate()`. This makes the auto-snapshot creation idempotent — safe for retries and duplicate event dispatches.

### 3. Complete Cache Invalidation

**`ComputeDqDeltas.php`** — Added missing cache keys:
- `ares:network:coverage:extended`
- `ares:network:geographic-diversity`
- `ares:network:cost-compare`
- `ares:network:cost-compare-detailed:*` (wildcard flush via Redis SCAN)

### 4. Analysis 10 Registration

**`Analysis10.php`** — Created new analysis class for OHDSI Analysis 10 (Number of all persons by year of birth by gender). Registered in `AchillesServiceProvider`. Registry now has 128 analyses.

## Data Recovery

- Deleted 4 old failed runs and 635 orphaned step records
- Triggered fresh Achilles run with `fresh: true` to repopulate all results
- Run completed 128/128 (including new Analysis 10)
- Manually ran Analysis 10 to populate age distribution immediately
- Created `synpuf_results` schema with all required tables for upcoming SynPUF characterization

## Files Changed

| File | Change |
|------|--------|
| `backend/app/Jobs/Achilles/RunAchillesJob.php` | `ShouldBeUnique` + runtime concurrency guard |
| `backend/app/Http/Controllers/Api/V1/AchillesController.php` | 409 Conflict guard on dispatch |
| `backend/app/Console/Commands/RunAchillesCommand.php` | CLI concurrency guard |
| `backend/app/Services/Ares/ReleaseService.php` | `firstOrCreate` for idempotent snapshots |
| `backend/app/Listeners/ComputeDqDeltas.php` | Complete cache invalidation + wildcard flush |
| `backend/app/Services/Achilles/Analyses/Person/Analysis10.php` | New: YOB × gender cross-tab |
| `backend/app/Providers/AchillesServiceProvider.php` | Register Analysis 10 |

## Verification

- Dashboard shows 1M+ persons, demographics with 10 age decile groups
- Attempting a second concurrent run returns 409 with active run details
- Cache invalidation covers all Ares v2 network aggregate keys
- SynPUF source ready for characterization (synpuf_results schema provisioned)
