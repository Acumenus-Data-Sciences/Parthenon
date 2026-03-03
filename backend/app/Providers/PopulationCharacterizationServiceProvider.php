<?php

namespace App\Providers;

use App\Services\PopulationCharacterization\Analyses\PC001CharlsonDistribution;
use App\Services\PopulationCharacterization\Analyses\PC002PolypharmacyPrevalence;
use App\Services\PopulationCharacterization\Analyses\PC003TreatmentPathways;
use App\Services\PopulationCharacterization\Analyses\PC004ProviderPracticeVariance;
use App\Services\PopulationCharacterization\Analyses\PC005VisitComplexityScore;
use App\Services\PopulationCharacterization\Analyses\PC006CareFragmentationIndex;
use App\Services\PopulationCharacterization\PopulationCharacterizationRegistry;
use Illuminate\Support\ServiceProvider;

class PopulationCharacterizationServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(PopulationCharacterizationRegistry::class, function () {
            $registry = new PopulationCharacterizationRegistry;

            // ── Comorbidity ──────────────────────────────────────────────────
            $registry->register(new PC001CharlsonDistribution);

            // ── Medication ──────────────────────────────────────────────────
            $registry->register(new PC002PolypharmacyPrevalence);

            // ── Treatment ───────────────────────────────────────────────────
            $registry->register(new PC003TreatmentPathways);

            // ── Provider ────────────────────────────────────────────────────
            $registry->register(new PC004ProviderPracticeVariance);

            // ── Visit ────────────────────────────────────────────────────────
            $registry->register(new PC005VisitComplexityScore);

            // ── Care ─────────────────────────────────────────────────────────
            $registry->register(new PC006CareFragmentationIndex);

            return $registry;
        });
    }

    public function boot(): void {}
}
