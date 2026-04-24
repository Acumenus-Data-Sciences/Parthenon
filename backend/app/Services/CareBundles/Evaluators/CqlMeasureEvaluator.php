<?php

namespace App\Services\CareBundles\Evaluators;

use App\Models\App\CareBundleRun;
use App\Models\App\QualityMeasure;
use App\Models\App\Source;
use App\Services\CareBundles\CareBundleMeasureEvaluator;
use App\Services\CareBundles\MeasureEvalResult;

/**
 * Phase 3b placeholder — wires to an external CQL engine (cqf-ruler or a
 * Python CQL runtime) once that service is deployed.
 *
 * Kept as a first-class class (not a stub file) so that the container binding
 * at config('care_bundles.evaluator')='cql' resolves cleanly and fails with a
 * clear, actionable error at evaluation time rather than at boot.
 *
 * Contract: identical to CohortBasedMeasureEvaluator — returns a
 * MeasureEvalResult and updates care_bundle_qualifications.measure_summary
 * per person. Swapping implementations requires no schema change.
 */
final class CqlMeasureEvaluator implements CareBundleMeasureEvaluator
{
    public function evaluate(
        CareBundleRun $run,
        QualityMeasure $measure,
        Source $source,
        string $cdmSchema,
    ): MeasureEvalResult {
        $engineUrl = config('care_bundles.cql.engine_url');

        throw new \RuntimeException(
            'CqlMeasureEvaluator is not yet wired to a CQL runtime. '.
            ($engineUrl
                ? "Configured engine_url={$engineUrl} but no client is implemented — Phase 3b work."
                : 'Set CARE_BUNDLES_CQL_ENGINE_URL and implement the HTTP client — Phase 3b work.').
            ' For now, leave CARE_BUNDLES_EVALUATOR=cohort_based.'
        );
    }
}
