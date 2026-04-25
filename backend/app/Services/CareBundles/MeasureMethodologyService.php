<?php

namespace App\Services\CareBundles;

use App\Enums\DaimonType;
use App\Models\App\CareBundleMeasureResult;
use App\Models\App\CareBundleRun;
use App\Models\App\ConditionBundle;
use App\Models\App\QualityMeasure;
use App\Models\App\Source;
use Illuminate\Support\Facades\DB;

/**
 * Build a researcher-grade methodology card for one (bundle, measure, source).
 *
 * Returns the exact concept lists used (with names + descendant counts via
 * concept_ancestor), CDM provenance (schema, max date per domain), the
 * latest run pointer, and data-quality flags.
 *
 * Pure read-only assembly over existing tables — no schema changes.
 */
class MeasureMethodologyService
{
    public function __construct(
        private readonly MeasureDataQualityChecker $dq,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function build(ConditionBundle $bundle, QualityMeasure $measure, Source $source): array
    {
        $source->load('daimons');
        $cdmSchema = $source->getTableQualifier(DaimonType::CDM);

        if ($cdmSchema === null) {
            throw new \RuntimeException('Source has no CDM daimon configured.');
        }

        $runId = DB::table('care_bundle_current_runs')
            ->where('condition_bundle_id', $bundle->id)
            ->where('source_id', $source->id)
            ->value('care_bundle_run_id');

        $run = $runId ? CareBundleRun::find($runId) : null;
        $result = $run
            ? CareBundleMeasureResult::where('care_bundle_run_id', $run->id)
                ->where('quality_measure_id', $measure->id)
                ->first()
            : null;

        return [
            'bundle' => $this->describeBundle($bundle),
            'measure' => $this->describeMeasure($measure),
            'source' => $this->describeSource($source, $cdmSchema, $measure),
            'run' => $run ? $this->describeRun($run) : null,
            'data_quality_flags' => $this->dq->check($measure, $source, $cdmSchema, $run, $result),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function describeBundle(ConditionBundle $bundle): array
    {
        /** @var list<int> $ids */
        $ids = is_array($bundle->omop_concept_ids) ? array_values(array_map('intval', $bundle->omop_concept_ids)) : [];

        return [
            'id' => $bundle->id,
            'bundle_code' => $bundle->bundle_code,
            'condition_name' => $bundle->condition_name,
            'qualification' => [
                'domain' => 'condition',
                'concepts' => $this->enrichConcepts($ids),
                'total_descendants' => $this->countDescendants($ids),
            ],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function describeMeasure(QualityMeasure $measure): array
    {
        /** @var array<string, mixed> $numerator */
        $numerator = $measure->numerator_criteria ?? [];
        /** @var list<int> $numerIds */
        $numerIds = is_array($numerator['concept_ids'] ?? null)
            ? array_values(array_map('intval', $numerator['concept_ids']))
            : [];

        $exclusions = [];
        /** @var array<string, mixed> $excCriteria */
        $excCriteria = $measure->exclusion_criteria ?? [];
        if (is_array($excCriteria['exclusions'] ?? null)) {
            foreach ($excCriteria['exclusions'] as $ex) {
                /** @var list<int> $exIds */
                $exIds = is_array($ex['concept_ids'] ?? null)
                    ? array_values(array_map('intval', $ex['concept_ids']))
                    : [];

                $exclusions[] = [
                    'label' => (string) ($ex['label'] ?? 'Exclusion'),
                    'domain' => (string) ($ex['domain'] ?? 'condition'),
                    'lookback_days' => (int) ($ex['lookback_days'] ?? 365),
                    'vsac_oid' => $ex['vsac_oid'] ?? null,
                    'concepts' => $this->enrichConcepts($exIds),
                    'total_descendants' => $this->countDescendants($exIds),
                ];
            }
        }

        return [
            'id' => $measure->id,
            'measure_code' => $measure->measure_code,
            'measure_name' => $measure->measure_name,
            'domain' => $measure->domain,
            'frequency' => $measure->frequency,
            'numerator' => [
                'lookback_days' => (int) ($numerator['lookback_days'] ?? 365),
                'concepts' => $this->enrichConcepts($numerIds),
                'total_descendants' => $this->countDescendants($numerIds),
            ],
            'exclusions' => $exclusions,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function describeSource(Source $source, string $cdmSchema, QualityMeasure $measure): array
    {
        $domains = ['condition_occurrence' => 'condition_start_date'];
        $domainTable = match ($measure->domain) {
            'measurement' => 'measurement',
            'drug' => 'drug_exposure',
            'procedure' => 'procedure_occurrence',
            'condition' => 'condition_occurrence',
            'observation' => 'observation',
            default => null,
        };
        $domainDateCol = match ($measure->domain) {
            'measurement' => 'measurement_date',
            'drug' => 'drug_exposure_start_date',
            'procedure' => 'procedure_date',
            'condition' => 'condition_start_date',
            'observation' => 'observation_date',
            default => null,
        };
        if ($domainTable && $domainDateCol) {
            $domains[$domainTable] = $domainDateCol;
        }

        $maxDates = [];
        foreach ($domains as $table => $dateCol) {
            try {
                $row = DB::selectOne("SELECT MAX({$dateCol}) AS max_date FROM \"{$cdmSchema}\".{$table}");
                $maxDates[$table] = $row->max_date ?? null;
            } catch (\Throwable) {
                $maxDates[$table] = null;
            }
        }

        return [
            'id' => $source->id,
            'source_name' => $source->source_name,
            'cdm_schema' => $cdmSchema,
            'cdm_max_dates' => $maxDates,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function describeRun(CareBundleRun $run): array
    {
        return [
            'id' => $run->id,
            'status' => $run->status,
            'started_at' => $run->started_at,
            'completed_at' => $run->completed_at,
            'qualified_person_count' => $run->qualified_person_count,
            'measure_count' => $run->measure_count,
            'bundle_version' => $run->bundle_version,
            'cdm_fingerprint' => $run->cdm_fingerprint,
            'trigger_kind' => $run->trigger_kind,
        ];
    }

    /**
     * @param  list<int>  $conceptIds
     * @return list<array{concept_id: int, concept_name: string, vocabulary_id: string, descendant_count: int}>
     */
    private function enrichConcepts(array $conceptIds): array
    {
        if (empty($conceptIds)) {
            return [];
        }

        /** @var list<\stdClass> $rows */
        $rows = DB::table('vocab.concept as c')
            ->leftJoinSub(
                DB::table('vocab.concept_ancestor')
                    ->select('ancestor_concept_id', DB::raw('COUNT(DISTINCT descendant_concept_id) AS descendant_count'))
                    ->whereIn('ancestor_concept_id', $conceptIds)
                    ->groupBy('ancestor_concept_id'),
                'd',
                'd.ancestor_concept_id',
                '=',
                'c.concept_id',
            )
            ->whereIn('c.concept_id', $conceptIds)
            ->select('c.concept_id', 'c.concept_name', 'c.vocabulary_id', DB::raw('COALESCE(d.descendant_count, 1) AS descendant_count'))
            ->orderBy('c.concept_name')
            ->get()
            ->all();

        return array_map(
            fn ($r) => [
                'concept_id' => (int) $r->concept_id,
                'concept_name' => (string) $r->concept_name,
                'vocabulary_id' => (string) $r->vocabulary_id,
                'descendant_count' => (int) $r->descendant_count,
            ],
            $rows,
        );
    }

    /**
     * @param  list<int>  $conceptIds
     */
    private function countDescendants(array $conceptIds): int
    {
        if (empty($conceptIds)) {
            return 0;
        }

        $row = DB::table('vocab.concept_ancestor')
            ->whereIn('ancestor_concept_id', $conceptIds)
            ->select(DB::raw('COUNT(DISTINCT descendant_concept_id) AS c'))
            ->first();

        return $row ? (int) $row->c : 0;
    }
}
