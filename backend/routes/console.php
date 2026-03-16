<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

/*
|--------------------------------------------------------------------------
| Scheduled Commands
|--------------------------------------------------------------------------
*/

// Sync @OHDSI X/Twitter posts to #announcements every 15 minutes.
// Requires X_BEARER_TOKEN in .env. Exits silently when token is absent.
Schedule::command('commons:sync-ohdsi-announcements')
    ->everyFifteenMinutes()
    ->withoutOverlapping()
    ->runInBackground()
    ->onFailure(function () {
        \Illuminate\Support\Facades\Log::error('commons:sync-ohdsi-announcements scheduled run failed.');
    });
