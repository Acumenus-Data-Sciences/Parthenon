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
     * Jaccard similarity on procedure_concepts arrays.
     *
     * @param  array<string, mixed>  $patientA
     * @param  array<string, mixed>  $patientB
     */
    public function score(array $patientA, array $patientB): float
    {
        /** @var array<int> $lifetimeA */
        $lifetimeA = $patientA['procedure_concepts'] ?? [];
        /** @var array<int> $lifetimeB */
        $lifetimeB = $patientB['procedure_concepts'] ?? [];
        /** @var array<int> $recentA */
        $recentA = $patientA['recent_procedure_concepts'] ?? [];
        /** @var array<int> $recentB */
        $recentB = $patientB['recent_procedure_concepts'] ?? [];

        return ConceptSetSimilarity::blendedJaccard($lifetimeA, $lifetimeB, $recentA, $recentB);
    }
}
