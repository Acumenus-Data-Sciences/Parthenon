<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

/*
|--------------------------------------------------------------------------
| Scheduled Commands
|--------------------------------------------------------------------------
*/

// Sync OHDSI Discourse RSS to the Commons Announcement Board every 15 minutes.
// Public feed — no API key required. Announcements expire after 30 days.
Schedule::command('commons:sync-ohdsi-announcements')
    ->everyFifteenMinutes()
    ->withoutOverlapping()
    ->runInBackground()
    ->onFailure(function () {
        Log::error('commons:sync-ohdsi-announcements scheduled run failed.');
    });

// CareBundles Workbench — nightly fan-out materialization (03:00 UTC).
// Dispatches one MaterializeCareBundleJob per (active bundle × active source).
// Each per-bundle job is idempotent and records its own CareBundleRun,
// so retries and partial failures are safe.
Schedule::command('care-bundles:materialize-all')
    ->dailyAt('03:00')
    ->withoutOverlapping()
    ->runInBackground()
    ->onFailure(function () {
        Log::error('care-bundles:materialize-all scheduled run failed.');
    });

// Phase 18 D-11 — warm recently-accessed endpoint profiles daily at 02:00 local.
// Reads finngen.endpoint_profile_access for (endpoint, source) pairs touched in
// the last 14 days and dispatches a fresh compute whenever the cached row is
// missing or its expression_hash is stale (D-10 invalidation).
Schedule::command('finngen:warm-endpoint-profiles --source=PANCREAS --since=14d')
    ->dailyAt('02:00')
    ->withoutOverlapping()
    ->runInBackground()
    ->onFailure(function () {
        Log::error('finngen:warm-endpoint-profiles scheduled run failed.');
    });
