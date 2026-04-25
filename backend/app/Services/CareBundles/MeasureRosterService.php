<?php

namespace App\Services\CareBundles;

use App\Enums\DaimonType;
use App\Models\App\ConditionBundle;
use App\Models\App\QualityMeasure;
use App\Models\App\Source;
use Illuminate\Support\Facades\DB;

/**
 * Read-side roster of patients who fall in a particular compliance bucket
 * for one (bundle, source, measure). Used by the Tier C drill-down — the
 * "give me the 98K BP-uncontrolled patients" workflow.
 *
 * Data lives in care_bundle_measure_person_status, populated during
 * materialization. We JOIN to the source's CDM person table to enrich with
 * minimal demographics (year of birth, gender). PHI-safe by design — only
 * person_ids and demographics, capped page size.
 *
 * Compliance buckets:
 *   non_compliant — in denominator AND NOT in numerator (i.e., NOT excl AND NOT numer)
 *   compliant     — in numerator (and by definition NOT excluded)
 *   excluded      — in the exclusion set (removed from both denom and numer)
 */
class MeasureRosterService
{
    public const BUCKETS = ['non_compliant', 'compliant', 'excluded'];

    /**
     * @return array<string, mixed>
     */
    public function roster(
        ConditionBundle $bundle,
        QualityMeasure $measure,
        Source $source,
        string $bucket = 'non_compliant',
        int $page = 1,
        int $perPage = 100,
    ): array {
        $source->load('daimons');
        $cdmSchema = $source->getTableQualifier(DaimonType::CDM);

        if ($cdmSchema === null) {
            throw new \RuntimeException('Source has no CDM daimon configured.');
        }

        if (! in_array($bucket, self::BUCKETS, true)) {
            throw new \InvalidArgumentException("Unknown compliance bucket: {$bucket}");
        }

        $runId = (int) DB::table('care_bundle_current_runs')
            ->where('condition_bundle_id', $bundle->id)
            ->where('source_id', $source->id)
            ->value('care_bundle_run_id');

        if ($runId === 0) {
            return [
                'bucket' => $bucket,
                'total' => 0,
                'page' => $page,
                'per_page' => $perPage,
                'persons' => [],
            ];
        }

        $base = DB::table('care_bundle_measure_person_status')
            ->where('care_bundle_run_id', $runId)
            ->where('quality_measure_id', $measure->id);

        match ($bucket) {
            'non_compliant' => $base->where('is_numer', false)->where('is_excl', false),
            'compliant' => $base->where('is_numer', true)->where('is_excl', false),
            'excluded' => $base->where('is_excl', true),
        };

        $total = (int) $base->count();
        $personIds = $base
            ->orderBy('person_id')
            ->offset(max(0, ($page - 1) * $perPage))
            ->limit($perPage)
            ->pluck('person_id')
            ->all();

        if (empty($personIds)) {
            return [
                'bucket' => $bucket,
                'total' => $total,
                'page' => $page,
                'per_page' => $perPage,
                'persons' => [],
            ];
        }

        $rows = DB::select(
            "
            SELECT person_id, year_of_birth, gender_concept_id
            FROM \"{$cdmSchema}\".person
            WHERE person_id IN (".implode(',', array_fill(0, count($personIds), '?')).')
        ',
            $personIds,
        );

        $byId = [];
        foreach ($rows as $row) {
            $byId[(int) $row->person_id] = [
                'year_of_birth' => (int) ($row->year_of_birth ?? 0) ?: null,
                'gender' => $this->genderLabel((int) ($row->gender_concept_id ?? 0)),
            ];
        }

        $thisYear = (int) date('Y');
        $persons = array_map(function (int $pid) use ($byId, $thisYear) {
            $info = $byId[$pid] ?? ['year_of_birth' => null, 'gender' => 'Unknown'];
            $age = $info['year_of_birth'] !== null ? $thisYear - $info['year_of_birth'] : null;

            return [
                'person_id' => $pid,
                'age' => $age,
                'gender' => $info['gender'],
            ];
        }, $personIds);

        return [
            'bucket' => $bucket,
            'total' => $total,
            'page' => $page,
            'per_page' => $perPage,
            'persons' => $persons,
            'run_id' => $runId,
        ];
    }

    /**
     * @return list<int>
     */
    public function allPersonIds(
        ConditionBundle $bundle,
        QualityMeasure $measure,
        Source $source,
        string $bucket,
    ): array {
        if (! in_array($bucket, self::BUCKETS, true)) {
            throw new \InvalidArgumentException("Unknown compliance bucket: {$bucket}");
        }

        $runId = (int) DB::table('care_bundle_current_runs')
            ->where('condition_bundle_id', $bundle->id)
            ->where('source_id', $source->id)
            ->value('care_bundle_run_id');

        if ($runId === 0) {
            return [];
        }

        $q = DB::table('care_bundle_measure_person_status')
            ->where('care_bundle_run_id', $runId)
            ->where('quality_measure_id', $measure->id);

        match ($bucket) {
            'non_compliant' => $q->where('is_numer', false)->where('is_excl', false),
            'compliant' => $q->where('is_numer', true)->where('is_excl', false),
            'excluded' => $q->where('is_excl', true),
        };

        return array_values(array_map('intval', $q->pluck('person_id')->all()));
    }

    private function genderLabel(int $conceptId): string
    {
        return match ($conceptId) {
            8507 => 'Male',
            8532 => 'Female',
            default => 'Unknown',
        };
    }
}
