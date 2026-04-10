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
     * Hierarchical weighted Jaccard similarity on condition_concepts arrays.
     *
     * @param  array<string, mixed>  $patientA
     * @param  array<string, mixed>  $patientB
     */
    public function score(array $patientA, array $patientB): float
    {
        /** @var array<int, int> $lifetimeA */
        $lifetimeA = $patientA['condition_concepts'] ?? [];
        /** @var array<int, int> $lifetimeB */
        $lifetimeB = $patientB['condition_concepts'] ?? [];
        /** @var array<int, int> $recentA */
        $recentA = $patientA['recent_condition_concepts'] ?? [];
        /** @var array<int, int> $recentB */
        $recentB = $patientB['recent_condition_concepts'] ?? [];

        return ConceptSetSimilarity::hierarchicalBlendedJaccard($lifetimeA, $lifetimeB, $recentA, $recentB);
    }
}
