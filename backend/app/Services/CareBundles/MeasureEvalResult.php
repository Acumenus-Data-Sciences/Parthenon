<?php

namespace App\Services\CareBundles;

/**
 * Result of evaluating a single QualityMeasure against a bundle's denominator
 * for one source. Returned from CareBundleMeasureEvaluator::evaluate().
 */
final class MeasureEvalResult
{
    public function __construct(
        public readonly int $denominatorCount,
        public readonly int $numeratorCount,
        public readonly int $exclusionCount,
    ) {}

    public function rate(): ?float
    {
        if ($this->denominatorCount === 0) {
            return null;
        }

        return round($this->numeratorCount / $this->denominatorCount, 4);
    }
}
