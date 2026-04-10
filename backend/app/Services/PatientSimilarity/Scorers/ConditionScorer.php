<?php

declare(strict_types=1);

namespace App\Services\PatientSimilarity\Scorers;

final class ConditionScorer implements DimensionScorerInterface
{
    public function key(): string
    {
        return 'conditions';
    }

    /**
     * Jaccard similarity on condition_concepts arrays.
     *
     * @param  array<string, mixed>  $patientA
     * @param  array<string, mixed>  $patientB
     */
    public function score(array $patientA, array $patientB): float
    {
        /** @var array<int> $lifetimeA */
        $lifetimeA = $patientA['condition_concepts'] ?? [];
        /** @var array<int> $lifetimeB */
        $lifetimeB = $patientB['condition_concepts'] ?? [];
        /** @var array<int> $recentA */
        $recentA = $patientA['recent_condition_concepts'] ?? [];
        /** @var array<int> $recentB */
        $recentB = $patientB['recent_condition_concepts'] ?? [];

        return ConceptSetSimilarity::blendedJaccard($lifetimeA, $lifetimeB, $recentA, $recentB);
    }
}
