<?php

declare(strict_types=1);

namespace App\Services\PatientSimilarity\Scorers;

final class ConceptSetSimilarity
{
    /**
     * Blend lifetime and recent concept overlap while preserving graceful fallback.
     *
     * @param  array<int>  $lifetimeA
     * @param  array<int>  $lifetimeB
     * @param  array<int>  $recentA
     * @param  array<int>  $recentB
     */
    public static function blendedJaccard(
        array $lifetimeA,
        array $lifetimeB,
        array $recentA,
        array $recentB,
        float $recentWeight = 0.30,
    ): float {
        $recentWeight = max(0.0, min(1.0, $recentWeight));

        $lifetimeAvailable = ! ($lifetimeA === [] && $lifetimeB === []);
        $recentAvailable = ! ($recentA === [] && $recentB === []);

        if (! $lifetimeAvailable && ! $recentAvailable) {
            return -1.0;
        }

        $lifetimeScore = $lifetimeAvailable ? self::partialAvailabilityJaccard($lifetimeA, $lifetimeB) : null;
        $recentScore = $recentAvailable ? self::partialAvailabilityJaccard($recentA, $recentB) : null;

        if ($lifetimeScore === null) {
            return $recentScore ?? -1.0;
        }

        if ($recentScore === null) {
            return $lifetimeScore;
        }

        return ((1.0 - $recentWeight) * $lifetimeScore) + ($recentWeight * $recentScore);
    }

    /**
     * @param  array<int>  $a
     * @param  array<int>  $b
     */
    private static function partialAvailabilityJaccard(array $a, array $b): float
    {
        if ($a === [] || $b === []) {
            return 0.0;
        }

        return self::jaccard($a, $b);
    }

    /**
     * @param  array<int>  $a
     * @param  array<int>  $b
     */
    private static function jaccard(array $a, array $b): float
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
