<?php

namespace App\Services\CareBundles;

use App\Models\App\CareBundleRun;
use App\Models\App\QualityMeasure;
use App\Models\App\Source;

/**
 * Contract for evaluating one quality measure against a bundle's qualified
 * population for a given source.
 *
 * Implementations update care_bundle_qualifications.measure_summary in place
 * for each qualified person and return aggregate counts.
 *
 * MVP: CohortBasedMeasureEvaluator (direct analytical SQL over CDM).
 * Phase 3: CqlMeasureEvaluator (CQL runtime — same interface, no schema change).
 */
interface CareBundleMeasureEvaluator
{
    /**
     * @return MeasureEvalResult denominator/numerator/exclusion counts
     */
    public function evaluate(
        CareBundleRun $run,
        QualityMeasure $measure,
        Source $source,
        string $cdmSchema,
    ): MeasureEvalResult;
}
