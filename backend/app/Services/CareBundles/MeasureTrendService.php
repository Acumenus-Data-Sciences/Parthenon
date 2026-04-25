<?php

namespace App\Services\CareBundles;

use App\Models\App\ConditionBundle;
use App\Models\App\QualityMeasure;
use App\Models\App\Source;
use Illuminate\Support\Facades\DB;

/**
 * Time-trend points for one (bundle, source, measure): the last N completed
 * runs, oldest first, with rate + Wilson CI per point. Each materialization
 * snapshot becomes a trend point.
 */
class MeasureTrendService
{
    public function trend(
        ConditionBundle $bundle,
        QualityMeasure $measure,
        Source $source,
        int $limit = 24,
    ): array {
        $rows = DB::table('care_bundle_runs as run')
            ->join('care_bundle_measure_results as r', 'r.care_bundle_run_id', '=', 'run.id')
            ->where('run.condition_bundle_id', $bundle->id)
            ->where('run.source_id', $source->id)
            ->where('run.status', 'completed')
            ->where('r.quality_measure_id', $measure->id)
            ->orderBy('run.completed_at', 'desc')
            ->limit($limit)
            ->select(
                'run.id as run_id',
                'run.completed_at',
                'run.qualified_person_count',
                'r.denominator_count',
                'r.numerator_count',
                'r.exclusion_count',
                'r.rate',
            )
            ->get()
            ->reverse()
            ->values();

        $points = $rows->map(function ($r) {
            $denom = (int) $r->denominator_count;
            $numer = (int) $r->numerator_count;
            $ci = WilsonCI::compute($numer, $denom);

            return [
                'run_id' => (int) $r->run_id,
                'completed_at' => $r->completed_at,
                'qualified_person_count' => (int) $r->qualified_person_count,
                'denominator_count' => $denom,
                'numerator_count' => $numer,
                'exclusion_count' => (int) $r->exclusion_count,
                'rate' => $r->rate !== null ? (float) $r->rate : null,
                'ci_lower' => $ci['lower'] ?? null,
                'ci_upper' => $ci['upper'] ?? null,
            ];
        })->all();

        return [
            'bundle_id' => $bundle->id,
            'source_id' => $source->id,
            'measure_id' => $measure->id,
            'points' => $points,
        ];
    }
}
