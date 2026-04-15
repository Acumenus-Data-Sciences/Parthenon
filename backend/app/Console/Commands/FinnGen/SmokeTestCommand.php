<?php

declare(strict_types=1);

namespace App\Console\Commands\FinnGen;

use App\Services\FinnGen\FinnGenClient;
use Illuminate\Console\Command;
use Throwable;

/**
 * Post-deploy smoke test. Hits Darkstar /health and verifies the finngen
 * block reports packages loaded with no load errors.
 */
class SmokeTestCommand extends Command
{
    protected $signature = 'finngen:smoke-test';

    protected $description = 'Verify Darkstar FinnGen runtime is reachable and healthy';

    public function handle(FinnGenClient $client): int
    {
        try {
            $health = $client->health();
        } catch (Throwable $e) {
            $this->error('Darkstar /health unreachable: '.$e->getMessage());

            return self::FAILURE;
        }

        $finngen = $health['finngen'] ?? null;
        if (! is_array($finngen)) {
            $this->error('Darkstar /health does not expose finngen block — image may be out of date');

            return self::FAILURE;
        }

        $loaded = $finngen['packages_loaded'] ?? [];
        $errors = $finngen['load_errors'] ?? [];

        $required = ['ROMOPAPI', 'HadesExtras', 'CO2AnalysisModules'];
        $loadedList = is_array($loaded) ? $loaded : [];
        $missing = array_diff($required, $loadedList);

        $this->info('Darkstar /health:');
        $this->line('  packages_loaded: '.implode(', ', $loadedList));
        $this->line('  load_errors:     '.implode(', ', is_array($errors) ? $errors : []));

        if ($missing) {
            $this->error('Missing FinnGen packages: '.implode(', ', $missing));

            return self::FAILURE;
        }
        if (! empty($errors)) {
            $this->error('Darkstar reports package load errors — failing smoke test');

            return self::FAILURE;
        }

        $this->info('FinnGen runtime healthy');

        return self::SUCCESS;
    }
}
