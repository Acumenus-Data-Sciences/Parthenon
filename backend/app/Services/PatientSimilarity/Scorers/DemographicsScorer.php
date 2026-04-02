<?php

declare(strict_types=1);

namespace App\Services\PatientSimilarity\Scorers;

final class DemographicsScorer implements DimensionScorerInterface
{
    private const int MAX_AGE_SPAN = 20;

    public function key(): string
    {
        return 'demographics';
    }

    /**
     * Score demographic similarity.
     *
     * Formula: 0.4*(1 - |age_bucket_diff*5|/MAX_AGE_SPAN) + 0.4*gender_match + 0.2*race_match
     *
     * @param  array<string, mixed>  $patientA
     * @param  array<string, mixed>  $patientB
     */
    public function score(array $patientA, array $patientB): float
    {
        $ageBucketA = $patientA['age_bucket'] ?? null;
        $ageBucketB = $patientB['age_bucket'] ?? null;

        // Return -1 if both age_buckets are null (dimension unavailable)
        if ($ageBucketA === null && $ageBucketB === null) {
            return -1.0;
        }

        // Age component: bucket difference * 5 years per bucket
        $ageDiff = abs((int) ($ageBucketA ?? 0) - (int) ($ageBucketB ?? 0)) * 5;
        $ageScore = max(0.0, 1.0 - $ageDiff / self::MAX_AGE_SPAN);

        // Gender match: exact concept_id match
        $genderA = $patientA['gender_concept_id'] ?? null;
        $genderB = $patientB['gender_concept_id'] ?? null;
        $genderMatch = ($genderA !== null && $genderB !== null && $genderA === $genderB) ? 1.0 : 0.0;

        // Race match: exact concept_id match
        $raceA = $patientA['race_concept_id'] ?? null;
        $raceB = $patientB['race_concept_id'] ?? null;
        $raceMatch = ($raceA !== null && $raceB !== null && $raceA === $raceB) ? 1.0 : 0.0;

        return 0.4 * $ageScore + 0.4 * $genderMatch + 0.2 * $raceMatch;
    }
}
