<?php

namespace App\Services\StudyAgent;

use App\Models\App\Source;

/**
 * Thin orchestrator that delegates to domain-specific FinnGen services.
 *
 * Previously 3,486 lines. Refactored into:
 *  - FinnGenCohortService     — cohort operations
 *  - FinnGenCo2Service        — CO2 analysis
 *  - FinnGenCo2FamilyBuilder  — CO2 family views/details
 *  - FinnGenHadesService      — HADES extras
 *  - FinnGenRomopapiService   — ROMOP API
 *  - FinnGenSharedHelpers     — shared trait (sourceSummary, runtimeMetadata, mergeAdapterRuntime)
 */
class FinnGenWorkbenchService
{
    public function __construct(
        private readonly FinnGenCohortService $cohortService,
        private readonly FinnGenCo2Service $co2Service,
        private readonly FinnGenHadesService $hadesService,
        private readonly FinnGenRomopapiService $romopapiService,
    ) {}

    public function cohortOperations(
        Source $source,
        array $cohortDefinition,
        string $executionMode = 'preview',
        array $options = [],
    ): array {
        return $this->cohortService->cohortOperations($source, $cohortDefinition, $executionMode, $options);
    }

    public function co2Analysis(
        Source $source,
        string $moduleKey,
        string $cohortLabel = '',
        string $outcomeName = '',
        array $options = [],
    ): array {
        return $this->co2Service->co2Analysis($source, $moduleKey, $cohortLabel, $outcomeName, $options);
    }

    public function hadesExtras(
        Source $source,
        string $sqlTemplate,
        string $packageName = '',
        string $renderTarget = '',
        array $options = [],
    ): array {
        return $this->hadesService->hadesExtras($source, $sqlTemplate, $packageName, $renderTarget, $options);
    }

    public function romopapi(
        Source $source,
        string $schemaScope = '',
        string $queryTemplate = '',
        array $options = [],
    ): array {
        return $this->romopapiService->romopapi($source, $schemaScope, $queryTemplate, $options);
    }

    public function buildTemporalCovariateHelpers(string $cohortTable, string $cdmSchema): array
    {
        return $this->hadesService->buildTemporalCovariateHelpers($cohortTable, $cdmSchema);
    }
}
