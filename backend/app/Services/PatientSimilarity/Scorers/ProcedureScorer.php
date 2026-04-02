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
        /** @var array<int> $setA */
        $setA = $patientA['procedure_concepts'] ?? [];
        /** @var array<int> $setB */
        $setB = $patientB['procedure_concepts'] ?? [];

        if ($setA === [] && $setB === []) {
            return -1.0;
        }

        if ($setA === [] || $setB === []) {
            return 0.0;
        }

        return $this->jaccard($setA, $setB);
    }

    /**
     * Efficient Jaccard similarity using array_flip + array_intersect_key.
     *
     * @param  array<int>  $a
     * @param  array<int>  $b
     */
    private function jaccard(array $a, array $b): float
    {
        $flipA = array_flip($a);
        $flipB = array_flip($b);

        $intersection = count(array_intersect_key($flipA, $flipB));
        $union = count($flipA + $flipB);

        if ($union === 0) {
            return 0.0;
        }

        return $intersection / $union;
    }
}
