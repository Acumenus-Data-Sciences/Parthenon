<?php

declare(strict_types=1);

namespace App\Services\PatientSimilarity\Scorers;

final class DrugScorer implements DimensionScorerInterface
{
    public function key(): string
    {
        return 'drugs';
    }

    /**
     * Hierarchical weighted Jaccard similarity on drug_concepts arrays.
     *
     * @param  array<string, mixed>  $patientA
     * @param  array<string, mixed>  $patientB
     */
    public function score(array $patientA, array $patientB): float
    {
        /** @var array<int, int> $lifetimeA */
        $lifetimeA = $patientA['drug_concepts'] ?? [];
        /** @var array<int, int> $lifetimeB */
        $lifetimeB = $patientB['drug_concepts'] ?? [];
        /** @var array<int, int> $recentA */
        $recentA = $patientA['recent_drug_concepts'] ?? [];
        /** @var array<int, int> $recentB */
        $recentB = $patientB['recent_drug_concepts'] ?? [];

        return ConceptSetSimilarity::hierarchicalBlendedJaccard($lifetimeA, $lifetimeB, $recentA, $recentB);
    }
}
