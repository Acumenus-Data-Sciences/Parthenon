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
     * Hierarchical blended Jaccard with depth-weighted partial credit.
     *
     * Instead of binary match/no-match, each concept contributes a weight
     * based on how it appears in the other set:
     * - Exact match (level 0): weight = 1.0
     * - Ancestor match at level N: weight = decayFactor^N
     *
     * @param  array<int, int>  $lifetimeA  concept_id => min_levels_of_separation (0 for leaf concepts)
     * @param  array<int, int>  $lifetimeB  same
     * @param  array<int, int>  $recentA  same
     * @param  array<int, int>  $recentB  same
     * @param  float  $recentWeight  blend weight for recent (default 0.30)
     * @param  float  $decayFactor  per-level decay (default 0.5)
     */
    public static function hierarchicalBlendedJaccard(
        array $lifetimeA,
        array $lifetimeB,
        array $recentA,
        array $recentB,
        float $recentWeight = 0.30,
        float $decayFactor = 0.5,
    ): float {
        $recentWeight = max(0.0, min(1.0, $recentWeight));

        $lifetimeAvailable = ! ($lifetimeA === [] && $lifetimeB === []);
        $recentAvailable = ! ($recentA === [] && $recentB === []);

        if (! $lifetimeAvailable && ! $recentAvailable) {
            return -1.0;
        }

        $lifetimeScore = $lifetimeAvailable
            ? self::weightedJaccard($lifetimeA, $lifetimeB, $decayFactor)
            : null;

        $recentScore = $recentAvailable
            ? self::weightedJaccard($recentA, $recentB, $decayFactor)
            : null;

        if ($lifetimeScore === null) {
            return $recentScore ?? -1.0;
        }

        if ($recentScore === null) {
            return $lifetimeScore;
        }

        return ((1.0 - $recentWeight) * $lifetimeScore) + ($recentWeight * $recentScore);
    }

    /**
     * Weighted Jaccard using depth-based decay weights.
     *
     * For each concept in the union:
     *   weight = decayFactor ^ min_levels_of_separation
     * Intersection weight = sum of min(weightA, weightB) for shared concepts
     * Union weight = sum of max(weightA, weightB) for all concepts
     *
     * @param  array<int, int>  $a  concept_id => min_levels_of_separation
     * @param  array<int, int>  $b  concept_id => min_levels_of_separation
     */
    private static function weightedJaccard(array $a, array $b, float $decayFactor): float
    {
        if ($a === [] || $b === []) {
            return 0.0;
        }

        $intersectionWeight = 0.0;
        $unionWeight = 0.0;

        $allConceptIds = array_keys($a + $b);

        foreach ($allConceptIds as $conceptId) {
            $weightA = isset($a[$conceptId]) ? ($decayFactor ** $a[$conceptId]) : 0.0;
            $weightB = isset($b[$conceptId]) ? ($decayFactor ** $b[$conceptId]) : 0.0;

            $intersectionWeight += min($weightA, $weightB);
            $unionWeight += max($weightA, $weightB);
        }

        if ($unionWeight <= 0.0) {
            return 0.0;
        }

        return $intersectionWeight / $unionWeight;
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
