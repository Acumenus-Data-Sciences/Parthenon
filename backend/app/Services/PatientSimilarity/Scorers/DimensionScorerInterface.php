<?php

declare(strict_types=1);

namespace App\Services\PatientSimilarity\Scorers;

interface DimensionScorerInterface
{
    public function key(): string;

    /**
     * Score similarity between two patients for this dimension.
     *
     * @param  array<string, mixed>  $patientA  Feature vector data
     * @param  array<string, mixed>  $patientB  Feature vector data
     * @return float Score in [0, 1], or -1 if dimension not available
     */
    public function score(array $patientA, array $patientB): float;
}
