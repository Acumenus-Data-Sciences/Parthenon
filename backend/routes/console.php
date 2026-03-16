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

// Sync OHDSI Discourse RSS to the Commons Announcement Board every 15 minutes.
// Public feed — no API key required. Announcements expire after 30 days.
Schedule::command('commons:sync-ohdsi-announcements')
    ->everyFifteenMinutes()
    ->withoutOverlapping()
    ->runInBackground()
    ->onFailure(function () {
        \Illuminate\Support\Facades\Log::error('commons:sync-ohdsi-announcements scheduled run failed.');
    });
