<?php

namespace App\Services\CareBundles\Evaluators;

use App\Models\App\CareBundleRun;
use App\Models\App\QualityMeasure;
use App\Models\App\Source;
use App\Services\CareBundles\CareBundleMeasureEvaluator;
use App\Services\CareBundles\MeasureEvalResult;
use Illuminate\Support\Facades\DB;

/**
 * Aggregate-first measure evaluator.
 *
 * Returns denominator / numerator / exclusion counts via a single CTE-based
 * aggregate query per measure. No per-person UPDATEs to care_bundle_qualifications,
 * no jsonb mutation — a prior per-row UPDATE design caused 15+ minute runs on
 * 370K-person bundles. This approach is seconds per measure.
 *
 * Semantics follow standard eCQM:
 *   denom = qualified persons who are NOT in the exclusion set
 *   numer = qualified persons who meet numerator criteria AND are NOT excluded
 *   excl  = qualified persons who are in the exclusion set
 *
 * Descendants via vocab.concept_ancestor. Lookback anchored on MAX(date_col)
 * of the relevant CDM domain so historical corpora (SynPUF 2010 etc.) still
 * return usable windows.
 */
final class CohortBasedMeasureEvaluator implements CareBundleMeasureEvaluator
{
    public function evaluate(
        CareBundleRun $run,
        QualityMeasure $measure,
        Source $source,
        string $cdmSchema,
    ): MeasureEvalResult {
        $appConn = DB::connection();

        [$numerCte, $numerBindings] = $this->buildNumeratorCte($measure, $cdmSchema);
        [$exclCte, $exclBindings] = $this->buildExclusionCte($measure, $cdmSchema);

        $sql = "
            WITH
                q AS (
                    SELECT person_id
                    FROM care_bundle_qualifications
                    WHERE care_bundle_run_id = ?
                ),
                numer_pp AS ({$numerCte}),
                excl_pp AS ({$exclCte})
            SELECT
                COUNT(*) FILTER (WHERE excl_pp.person_id IS NULL) AS denom,
                COUNT(*) FILTER (
                    WHERE numer_pp.person_id IS NOT NULL
                      AND excl_pp.person_id IS NULL
                ) AS numer,
                COUNT(*) FILTER (WHERE excl_pp.person_id IS NOT NULL) AS excl
            FROM q
            LEFT JOIN numer_pp ON numer_pp.person_id = q.person_id
            LEFT JOIN excl_pp  ON excl_pp.person_id  = q.person_id
        ";

        $bindings = array_merge([$run->id], $numerBindings, $exclBindings);
        $row = $appConn->selectOne($sql, $bindings);

        return new MeasureEvalResult(
            denominatorCount: (int) ($row->denom ?? 0),
            numeratorCount: (int) ($row->numer ?? 0),
            exclusionCount: (int) ($row->excl ?? 0),
        );
    }

    /**
     * @return array{0: string, 1: list<mixed>}
     */
    private function buildNumeratorCte(QualityMeasure $measure, string $cdmSchema): array
    {
        /** @var array<string, mixed> $numerator */
        $numerator = $measure->numerator_criteria ?? [];
        /** @var list<int> $ids */
        $ids = is_array($numerator['concept_ids'] ?? null)
            ? array_values(array_map('intval', $numerator['concept_ids']))
            : [];

        if (empty($ids)) {
            // Empty numerator set → no one ever flips to numer:true.
            // Selecting NULL::bigint yields a 0-row CTE with correct column type.
            return ['SELECT NULL::bigint AS person_id WHERE FALSE', []];
        }

        $lookback = (int) ($numerator['lookback_days'] ?? 365);
        $table = $this->resolveTableName($measure->domain);
        $col = $this->resolveConceptColumn($measure->domain);
        $date = $this->resolveDateColumn($measure->domain);
        $ph = implode(',', array_fill(0, count($ids), '?'));

        $sql = "
            SELECT DISTINCT t.person_id
            FROM \"{$cdmSchema}\".{$table} t
            WHERE t.{$col} IN (
                SELECT ca.descendant_concept_id
                FROM vocab.concept_ancestor ca
                WHERE ca.ancestor_concept_id IN ({$ph})
            )
            AND t.{$date} >= (
                SELECT MAX({$date}) FROM \"{$cdmSchema}\".{$table}
            ) - INTERVAL '{$lookback} days'
        ";

        return [$sql, $ids];
    }

    /**
     * @return array{0: string, 1: list<mixed>}
     */
    private function buildExclusionCte(QualityMeasure $measure, string $cdmSchema): array
    {
        /** @var array<string, mixed> $criteria */
        $criteria = $measure->exclusion_criteria ?? [];
        /** @var list<array<string, mixed>> $exclusions */
        $exclusions = is_array($criteria['exclusions'] ?? null) ? $criteria['exclusions'] : [];

        /** @var list<string> $parts */
        $parts = [];
        /** @var list<mixed> $bindings */
        $bindings = [];

        foreach ($exclusions as $ex) {
            $domain = (string) ($ex['domain'] ?? 'condition');
            /** @var list<int> $ids */
            $ids = is_array($ex['concept_ids'] ?? null)
                ? array_values(array_map('intval', $ex['concept_ids']))
                : [];

            if (empty($ids)) {
                continue;
            }

            $lookback = (int) ($ex['lookback_days'] ?? 365);
            $table = $this->resolveTableName($domain);
            $col = $this->resolveConceptColumn($domain);
            $date = $this->resolveDateColumn($domain);
            $ph = implode(',', array_fill(0, count($ids), '?'));

            $parts[] = "
                SELECT DISTINCT t.person_id
                FROM \"{$cdmSchema}\".{$table} t
                WHERE t.{$col} IN (
                    SELECT ca.descendant_concept_id
                    FROM vocab.concept_ancestor ca
                    WHERE ca.ancestor_concept_id IN ({$ph})
                )
                AND t.{$date} >= (
                    SELECT MAX({$date}) FROM \"{$cdmSchema}\".{$table}
                ) - INTERVAL '{$lookback} days'
            ";
            $bindings = array_merge($bindings, $ids);
        }

        if (empty($parts)) {
            return ['SELECT NULL::bigint AS person_id WHERE FALSE', []];
        }

        return [implode(' UNION ', $parts), $bindings];
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
