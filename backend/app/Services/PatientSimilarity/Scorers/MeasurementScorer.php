<?php

declare(strict_types=1);

namespace App\Services\PatientSimilarity\Scorers;

final class MeasurementScorer implements DimensionScorerInterface
{
    public function key(): string
    {
        return 'measurements';
    }

    /**
     * Inverse Euclidean on z-scored lab_vector (only shared measurement types).
     *
     * Formula: 1 / (1 + sqrt(mean_squared_diff))
     *
     * @param  array<string, mixed>  $patientA
     * @param  array<string, mixed>  $patientB
     */
    public function score(array $patientA, array $patientB): float
    {
        /** @var array<string, float> $vecA */
        $vecA = $patientA['lab_vector'] ?? [];
        /** @var array<string, float> $vecB */
        $vecB = $patientB['lab_vector'] ?? [];

        if ($vecA === [] && $vecB === []) {
            return -1.0;
        }

        // Find shared measurement keys
        $sharedKeys = array_keys(array_intersect_key($vecA, $vecB));

        if ($sharedKeys === []) {
            return 0.0;
        }

        // Compute mean squared difference over shared keys
        $sumSquaredDiff = 0.0;
        foreach ($sharedKeys as $key) {
            $diff = (float) $vecA[$key] - (float) $vecB[$key];
            $sumSquaredDiff += $diff * $diff;
        }

        $meanSquaredDiff = $sumSquaredDiff / count($sharedKeys);

        return 1.0 / (1.0 + sqrt($meanSquaredDiff));
    }
}
