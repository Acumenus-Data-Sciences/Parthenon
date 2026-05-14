<?php

namespace Tests\Unit\Concerns;

use App\Concerns\HasLibraryLifecycle;
use App\Models\App\CohortDefinition;
use App\Models\App\ConceptSet;
use App\Models\App\EstimationAnalysis;
use App\Models\App\EvidenceSynthesisAnalysis;
use App\Models\App\FeatureAnalysis;
use App\Models\App\IncidenceRateAnalysis;
use App\Models\App\PathwayAnalysis;
use App\Models\App\PredictionAnalysis;
use App\Models\App\SccsAnalysis;
use App\Models\App\SelfControlledCohortAnalysis;
use Tests\TestCase;

class HasLibraryLifecycleTraitAppliedTest extends TestCase
{
    /**
     * @dataProvider models
     */
    public function test_model_uses_trait(string $class): void
    {
        $traits = class_uses_recursive($class);
        $this->assertContains(
            HasLibraryLifecycle::class,
            $traits,
            "{$class} missing HasLibraryLifecycle trait",
        );
    }

    /**
     * @return array<int, array<int, class-string>>
     */
    public static function models(): array
    {
        return [
            [ConceptSet::class],
            [CohortDefinition::class],
            [IncidenceRateAnalysis::class],
            [PathwayAnalysis::class],
            [EstimationAnalysis::class],
            [PredictionAnalysis::class],
            [FeatureAnalysis::class],
            [SccsAnalysis::class],
            [EvidenceSynthesisAnalysis::class],
            [SelfControlledCohortAnalysis::class],
        ];
    }
}
