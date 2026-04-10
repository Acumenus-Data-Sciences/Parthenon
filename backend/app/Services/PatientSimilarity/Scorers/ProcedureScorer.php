<?php

declare(strict_types=1);

namespace App\Services\PatientSimilarity\Scorers;

final class ProcedureScorer implements DimensionScorerInterface
{
    public function key(): string
    {
        return 'procedures';
    }

    /**
     * Hierarchical weighted Jaccard similarity on procedure_concepts arrays.
     *
     * @param  array<string, mixed>  $patientA
     * @param  array<string, mixed>  $patientB
     */
    public function score(array $patientA, array $patientB): float
    {
        /** @var array<int, int> $lifetimeA */
        $lifetimeA = $patientA['procedure_concepts'] ?? [];
        /** @var array<int, int> $lifetimeB */
        $lifetimeB = $patientB['procedure_concepts'] ?? [];
        /** @var array<int, int> $recentA */
        $recentA = $patientA['recent_procedure_concepts'] ?? [];
        /** @var array<int, int> $recentB */
        $recentB = $patientB['recent_procedure_concepts'] ?? [];

        return ConceptSetSimilarity::hierarchicalBlendedJaccard($lifetimeA, $lifetimeB, $recentA, $recentB);
    }
}
