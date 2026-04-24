<?php

namespace App\Services\CareBundles\Evaluators;

use App\Models\App\CareBundleRun;
use App\Models\App\QualityMeasure;
use App\Models\App\Source;
use App\Services\CareBundles\CareBundleMeasureEvaluator;
use App\Services\CareBundles\MeasureEvalResult;
use Illuminate\Database\Connection;
use Illuminate\Support\Facades\DB;

/**
 * Direct-SQL measure evaluator.
 *
 * For each qualified person in the run, sets measure_summary JSONB with
 * {denom:true, numer:bool} for this measure via an EXISTS subquery against
 * the CDM domain table. Aggregate counts are returned afterward.
 *
 * Mirrors CareGapRefreshService's pure-SQL approach — no PHP-side patient loops,
 * idempotent on re-run, debuggable by any PostgreSQL engineer.
 */
final class CohortBasedMeasureEvaluator implements CareBundleMeasureEvaluator
{
    public function evaluate(
        CareBundleRun $run,
        QualityMeasure $measure,
        Source $source,
        string $cdmSchema,
    ): MeasureEvalResult {
        $numerator = $measure->numerator_criteria ?? [];
        $conceptIds = $numerator['concept_ids'] ?? [];
        $lookbackDays = (int) ($numerator['lookback_days'] ?? 365);

        $appConn = DB::connection();

        if (empty($conceptIds)) {
            $this->markDenomOnly($run, $measure, $appConn);
            $denom = $this->countQualified($run, $appConn);

            return new MeasureEvalResult($denom, 0, 0);
        }

        $tableName = $this->resolveTableName($measure->domain);
        $conceptCol = $this->resolveConceptColumn($measure->domain);
        $dateCol = $this->resolveDateColumn($measure->domain);
        $conceptPh = implode(',', array_fill(0, count($conceptIds), '?'));

        $sql = "
            UPDATE care_bundle_qualifications cbq
            SET measure_summary = COALESCE(cbq.measure_summary, '{}'::jsonb)
                || jsonb_build_object(
                    ?::text,
                    jsonb_build_object(
                        'denom', true,
                        'numer', EXISTS (
                            SELECT 1
                            FROM \"{$cdmSchema}\".{$tableName} t
                            WHERE t.person_id = cbq.person_id
                              AND t.{$conceptCol} IN ({$conceptPh})
                              AND t.{$dateCol} >= CURRENT_DATE - INTERVAL '{$lookbackDays} days'
                        )
                    )
                )
            WHERE cbq.care_bundle_run_id = ?
        ";

        $bindings = array_merge(
            [(string) $measure->id],
            $conceptIds,
            [$run->id],
        );
        $appConn->statement($sql, $bindings);

        $counts = $appConn->selectOne(
            "
            SELECT
                COUNT(*) AS denom,
                SUM(CASE WHEN (measure_summary -> ? ->> 'numer')::boolean THEN 1 ELSE 0 END) AS numer
            FROM care_bundle_qualifications
            WHERE care_bundle_run_id = ?
        ",
            [(string) $measure->id, $run->id]
        );

        return new MeasureEvalResult(
            denominatorCount: (int) ($counts->denom ?? 0),
            numeratorCount: (int) ($counts->numer ?? 0),
            exclusionCount: 0,
        );
    }

    private function markDenomOnly(
        CareBundleRun $run,
        QualityMeasure $measure,
        Connection $appConn,
    ): void {
        $appConn->statement(
            "
            UPDATE care_bundle_qualifications
            SET measure_summary = COALESCE(measure_summary, '{}'::jsonb)
                || jsonb_build_object(?::text, jsonb_build_object('denom', true, 'numer', false))
            WHERE care_bundle_run_id = ?
        ",
            [(string) $measure->id, $run->id]
        );
    }

    private function countQualified(
        CareBundleRun $run,
        Connection $appConn,
    ): int {
        return (int) $appConn->table('care_bundle_qualifications')
            ->where('care_bundle_run_id', $run->id)
            ->count();
    }

    private function resolveTableName(string $domain): string
    {
        return match ($domain) {
            'measurement' => 'measurement',
            'drug' => 'drug_exposure',
            'procedure' => 'procedure_occurrence',
            'condition' => 'condition_occurrence',
            'observation' => 'observation',
            default => throw new \RuntimeException("Unknown measure domain: {$domain}"),
        };
    }

    private function resolveConceptColumn(string $domain): string
    {
        return match ($domain) {
            'measurement' => 'measurement_concept_id',
            'drug' => 'drug_concept_id',
            'procedure' => 'procedure_concept_id',
            'condition' => 'condition_concept_id',
            'observation' => 'observation_concept_id',
            default => throw new \RuntimeException("Unknown measure domain: {$domain}"),
        };
    }

    private function resolveDateColumn(string $domain): string
    {
        return match ($domain) {
            'measurement' => 'measurement_date',
            'drug' => 'drug_exposure_start_date',
            'procedure' => 'procedure_date',
            'condition' => 'condition_start_date',
            'observation' => 'observation_date',
            default => throw new \RuntimeException("Unknown measure domain: {$domain}"),
        };
    }
}
