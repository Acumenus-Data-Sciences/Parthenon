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
     * Jaccard similarity on drug_concepts arrays.
     *
     * @param  array<string, mixed>  $patientA
     * @param  array<string, mixed>  $patientB
     */
    public function score(array $patientA, array $patientB): float
    {
        /** @var array<int> $lifetimeA */
        $lifetimeA = $patientA['drug_concepts'] ?? [];
        /** @var array<int> $lifetimeB */
        $lifetimeB = $patientB['drug_concepts'] ?? [];
        /** @var array<int> $recentA */
        $recentA = $patientA['recent_drug_concepts'] ?? [];
        /** @var array<int> $recentB */
        $recentB = $patientB['recent_drug_concepts'] ?? [];

        return ConceptSetSimilarity::blendedJaccard($lifetimeA, $lifetimeB, $recentA, $recentB);
    }
}
