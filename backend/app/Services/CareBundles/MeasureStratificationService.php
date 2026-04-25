<?php

namespace App\Services\CareBundles;

use App\Models\App\ConditionBundle;
use App\Models\App\QualityMeasure;
use App\Models\App\Source;
use Illuminate\Support\Facades\DB;

/**
 * Read-side strata service.
 *
 * Strata are pre-computed during materialization (see CohortBasedMeasureEvaluator
 * + CareBundleMaterializationService::persistStrata) and stored in
 * care_bundle_measure_strata. This service just looks them up — no
 * CDM scans, no expensive joins, sub-second responses.
 */
class MeasureStratificationService
{
    /**
     * @return array{age_band: list<array<string, mixed>>, sex: list<array<string, mixed>>}
     */
    public function stratify(ConditionBundle $bundle, QualityMeasure $measure, Source $source): array
    {
        $runId = (int) DB::table('care_bundle_current_runs')
            ->where('condition_bundle_id', $bundle->id)
            ->where('source_id', $source->id)
            ->value('care_bundle_run_id');

        if ($runId === 0) {
            return ['age_band' => [], 'sex' => []];
        }

        $rows = DB::table('care_bundle_measure_strata')
            ->where('care_bundle_run_id', $runId)
            ->where('quality_measure_id', $measure->id)
            ->orderBy('dimension')
            ->orderBy('sort_key')
            ->orderBy('stratum')
            ->get();

        $byDim = ['age_band' => [], 'sex' => []];

        foreach ($rows as $r) {
            $dim = (string) $r->dimension;
            if (! isset($byDim[$dim])) {
                continue;
            }

            $byDim[$dim][] = [
                'stratum' => (string) $r->stratum,
                'denom' => (int) $r->denominator_count,
                'numer' => (int) $r->numerator_count,
                'excl' => (int) $r->exclusion_count,
                'rate' => $r->rate !== null ? (float) $r->rate : null,
                'ci_lower' => $r->ci_lower !== null ? (float) $r->ci_lower : null,
                'ci_upper' => $r->ci_upper !== null ? (float) $r->ci_upper : null,
            ];
        }

        return $byDim;
    }
}
