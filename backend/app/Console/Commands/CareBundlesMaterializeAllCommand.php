<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Jobs\CareBundles\MaterializeAllCareBundlesJob;
use Illuminate\Console\Command;

class CareBundlesMaterializeAllCommand extends Command
{
    protected $signature = 'care-bundles:materialize-all';

    protected $description = 'Dispatch MaterializeAllCareBundlesJob (fan-out per bundle × source). Used by the nightly scheduler.';

    public function handle(): int
    {
        MaterializeAllCareBundlesJob::dispatch(null, 'scheduled');
        $this->info('Dispatched MaterializeAllCareBundlesJob (trigger=scheduled).');

        return self::SUCCESS;
    }
}
