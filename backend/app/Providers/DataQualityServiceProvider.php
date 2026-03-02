<?php

namespace App\Providers;

use App\Services\Dqd\Checks\Completeness\CompletenessCheckFactory;
use App\Services\Dqd\Checks\Conformance\ConformanceCheckFactory;
use App\Services\Dqd\Checks\Plausibility\PlausibilityCheckFactory;
use App\Services\Dqd\DqdCheckRegistry;
use App\Services\Dqd\DqdEngineService;
use Illuminate\Support\ServiceProvider;

class DataQualityServiceProvider extends ServiceProvider
{
    /**
     * Register DQD services.
     */
    public function register(): void
    {
        // Register the check registry as a singleton, pre-loaded with all check instances.
        $this->app->singleton(DqdCheckRegistry::class, function () {
            $registry = new DqdCheckRegistry;

            // Register completeness checks (~77 checks)
            foreach (CompletenessCheckFactory::create() as $check) {
                $registry->register($check);
            }

            // Register conformance checks (~54 checks)
            foreach (ConformanceCheckFactory::create() as $check) {
                $registry->register($check);
            }

            // Register plausibility checks (~39 checks)
            foreach (PlausibilityCheckFactory::create() as $check) {
                $registry->register($check);
            }

            return $registry;
        });

        // Register the engine service (auto-resolved with DqdCheckRegistry dependency).
        $this->app->singleton(DqdEngineService::class);
    }

    /**
     * Bootstrap DQD services.
     */
    public function boot(): void
    {
        //
    }
}
