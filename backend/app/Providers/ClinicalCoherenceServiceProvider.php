<?php

namespace App\Providers;

use App\Services\ClinicalCoherence\Analyses\CC001SexConditionPlausibility;
use App\Services\ClinicalCoherence\Analyses\CC002AgeConditionPlausibility;
use App\Services\ClinicalCoherence\Analyses\CC003DrugIndicationConcordance;
use App\Services\ClinicalCoherence\Analyses\CC004DrugDrugInteraction;
use App\Services\ClinicalCoherence\Analyses\CC005LabValuePlausibility;
use App\Services\ClinicalCoherence\Analyses\CC006ComorbidityCoherence;
use App\Services\ClinicalCoherence\ClinicalCoherenceAnalysisRegistry;
use Illuminate\Support\ServiceProvider;

class ClinicalCoherenceServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(ClinicalCoherenceAnalysisRegistry::class, function () {
            $registry = new ClinicalCoherenceAnalysisRegistry;

            foreach ([
                new CC001SexConditionPlausibility,
                new CC002AgeConditionPlausibility,
                new CC003DrugIndicationConcordance,
                new CC004DrugDrugInteraction,
                new CC005LabValuePlausibility,
                new CC006ComorbidityCoherence,
            ] as $analysis) {
                $registry->register($analysis);
            }

            return $registry;
        });
    }

    public function boot(): void {}
}
