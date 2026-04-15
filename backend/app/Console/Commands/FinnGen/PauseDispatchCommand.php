<?php

declare(strict_types=1);

namespace App\Console\Commands\FinnGen;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Cache;

/**
 * Toggle the finngen dispatch pause flag. Spec §7.3.
 *
 *   php artisan finngen:pause-dispatch         # pause (set to true)
 *   php artisan finngen:pause-dispatch --clear # resume
 *   php artisan finngen:pause-dispatch --status # show current value
 *
 * The flag is read by FinnGenRunService::create() via
 * config('finngen.pause_dispatch'), which in turn consults Cache.
 */
class PauseDispatchCommand extends Command
{
    protected $signature = 'finngen:pause-dispatch {--clear : Resume dispatch} {--status : Print current state and exit}';

    protected $description = 'Toggle the FinnGen dispatch-pause feature flag';

    private const CACHE_KEY = 'finngen.pause_dispatch';

    public function handle(): int
    {
        if ($this->option('status')) {
            $current = (bool) Cache::get(self::CACHE_KEY, false);
            $this->info('finngen.pause_dispatch = '.($current ? 'PAUSED' : 'ACTIVE'));

            return self::SUCCESS;
        }

        if ($this->option('clear')) {
            Cache::forget(self::CACHE_KEY);
            $this->info('FinnGen dispatch RESUMED');

            return self::SUCCESS;
        }

        Cache::forever(self::CACHE_KEY, true);
        $this->warn('FinnGen dispatch PAUSED — POST /api/v1/finngen/runs will 503');

        return self::SUCCESS;
    }
}
