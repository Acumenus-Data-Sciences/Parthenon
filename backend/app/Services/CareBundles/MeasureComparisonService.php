<?php

namespace App\Services\CareBundles;

use App\Models\App\ConditionBundle;
use Illuminate\Support\Facades\DB;

/**
 * Side-by-side comparison of all measures within a bundle across every
 * qualifying source. Reads from already-materialized runs — no CDM scans.
 */
class MeasureComparisonService
{
    public function __construct(
        private readonly CareBundleSourceService $sourceService,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function compare(ConditionBundle $bundle): array
    {
        $sources = $this->sourceService->listWithPopulation();
        // Comparison is only meaningful across sources that meet the gate
        // and have a current run for this bundle.
        $eligibleSourceIds = array_values(array_filter(
            array_map(fn ($s) => $s['qualifies'] ? (int) $s['id'] : null, $sources),
        ));

        $sourcesById = [];
        foreach ($sources as $s) {
            if ($s['qualifies']) {
                $sourcesById[$s['id']] = $s;
            }
        }

        if (empty($eligibleSourceIds)) {
            return [
                'bundle_id' => $bundle->id,
                'sources' => [],
                'measures' => [],
            ];
        }

        $currentRuns = DB::table('care_bundle_current_runs as cbcr')
            ->join('care_bundle_runs as cbr', 'cbr.id', '=', 'cbcr.care_bundle_run_id')
            ->where('cbcr.condition_bundle_id', $bundle->id)
            ->whereIn('cbcr.source_id', $eligibleSourceIds)
            ->select(
                'cbcr.source_id',
                'cbcr.care_bundle_run_id',
                'cbcr.updated_at',
                'cbr.qualified_person_count',
                'cbr.completed_at',
            )
            ->get()
            ->keyBy('source_id');

        if ($currentRuns->isEmpty()) {
            return [
                'bundle_id' => $bundle->id,
                'sources' => array_values($sourcesById),
                'measures' => [],
            ];
        }

        $runIds = $currentRuns->pluck('care_bundle_run_id')->all();

        $resultsByMeasure = DB::table('care_bundle_measure_results as r')
            ->join('care_bundle_runs as run', 'run.id', '=', 'r.care_bundle_run_id')
            ->join('quality_measures as qm', 'qm.id', '=', 'r.quality_measure_id')
            ->whereIn('r.care_bundle_run_id', $runIds)
            ->select(
                'qm.id as measure_id',
                'qm.measure_code',
                'qm.measure_name',
                'qm.domain',
                'run.source_id',
                'r.denominator_count',
                'r.numerator_count',
                'r.exclusion_count',
                'r.rate',
                'r.computed_at',
            )
            ->orderBy('qm.measure_code')
            ->get()
            ->groupBy('measure_id');

        $measures = [];
        foreach ($resultsByMeasure as $measureId => $rows) {
            $first = $rows->first();
            $bySource = [];
            foreach ($rows as $row) {
                $denom = (int) $row->denominator_count;
                $numer = (int) $row->numerator_count;
                $ci = WilsonCI::compute($numer, $denom);
                $bySource[(string) $row->source_id] = [
                    'denominator_count' => $denom,
                    'numerator_count' => $numer,
                    'exclusion_count' => (int) $row->exclusion_count,
                    'rate' => $row->rate !== null ? (float) $row->rate : null,
                    'ci_lower' => $ci['lower'] ?? null,
                    'ci_upper' => $ci['upper'] ?? null,
                    'computed_at' => $row->computed_at,
                ];
            }

            $measures[] = [
                'measure_id' => (int) $measureId,
                'measure_code' => $first->measure_code,
                'measure_name' => $first->measure_name,
                'domain' => $first->domain,
                'by_source' => $bySource,
            ];
        }

        $sourceMeta = [];
        foreach ($sourcesById as $sid => $src) {
            $run = $currentRuns->get($sid);
            $sourceMeta[] = [
                'id' => $src['id'],
                'source_name' => $src['source_name'],
                'person_count' => $src['person_count'],
                'qualifies' => $src['qualifies'],
                'run_id' => $run ? (int) $run->care_bundle_run_id : null,
                'qualified_person_count' => $run ? (int) $run->qualified_person_count : null,
                'completed_at' => $run?->completed_at,
            ];
        }

        return [
            'bundle_id' => $bundle->id,
            'sources' => $sourceMeta,
            'measures' => $measures,
        ];
    }
}
