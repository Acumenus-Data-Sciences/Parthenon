<?php

namespace App\Support\Statistics;

/**
 * Multiple-comparison corrections (Clio / ADR-0020 Phase 2).
 *
 * A comparative study that tests several outcomes against the same exposure
 * inflates the family-wise false-positive rate. Benjamini-Hochberg controls
 * the false discovery rate, which is the appropriate correction for the
 * exploratory multi-outcome designs Parthenon runs.
 */
final class Multiplicity
{
    /**
     * Benjamini-Hochberg FDR-adjusted p-values, returned in the original order.
     *
     * Null / non-finite inputs are preserved as null and excluded from the
     * correction's denominator (only the m valid p-values are corrected).
     *
     * @param  array<int, float|int|null>  $pValues
     * @return array<int, float|null>
     */
    public static function benjaminiHochberg(array $pValues): array
    {
        /** @var array<int, float> $valid */
        $valid = [];
        foreach ($pValues as $i => $p) {
            if ($p !== null && is_numeric($p) && is_finite((float) $p)) {
                $valid[$i] = (float) $p;
            }
        }

        $m = count($valid);
        if ($m === 0) {
            return array_map(fn () => null, $pValues);
        }

        // Ascending by p-value; keys are the original indices.
        asort($valid);
        $orderedIndices = array_keys($valid);

        // Step up from the largest p (rank m) to the smallest, enforcing
        // monotonic non-decreasing adjusted values.
        $adjusted = [];
        $previous = 1.0;
        $rank = $m;
        foreach (array_reverse($orderedIndices) as $originalIndex) {
            $p = $valid[$originalIndex];
            $bh = min($previous, $p * $m / $rank);
            $adjusted[$originalIndex] = $bh;
            $previous = $bh;
            $rank--;
        }

        $result = [];
        foreach ($pValues as $i => $p) {
            $result[$i] = $adjusted[$i] ?? null;
        }

        return $result;
    }
}
