<?php

namespace App\Services\CareBundles;

/**
 * Wilson score confidence interval for a proportion.
 *
 * Preferred over the Normal-approximation (aka Wald) interval because it
 * behaves well for small samples and proportions near 0 or 1 — important
 * for rare quality measures and tight-window denominators.
 *
 * Reference: Wilson, E. B. (1927). Probable inference, the law of succession,
 * and statistical inference. JASA 22, 209–212.
 */
final class WilsonCI
{
    /**
     * @return array{lower: float, upper: float}|null null if denominator is 0
     */
    public static function compute(int $numerator, int $denominator, float $z = 1.96): ?array
    {
        if ($denominator <= 0) {
            return null;
        }

        $n = (float) $denominator;
        $p = $numerator / $n;
        $zSq = $z * $z;

        $denomFactor = 1.0 + $zSq / $n;
        $center = ($p + $zSq / (2.0 * $n)) / $denomFactor;
        $margin = ($z / $denomFactor)
            * sqrt(($p * (1.0 - $p) + $zSq / (4.0 * $n)) / $n);

        return [
            'lower' => max(0.0, $center - $margin),
            'upper' => min(1.0, $center + $margin),
        ];
    }
}
