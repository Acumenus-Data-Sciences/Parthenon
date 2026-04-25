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
 * Aggregate-and-stratify evaluator using session-scope temp tables.
 *
 * Per measure we:
 *   1. Materialize numer_pp_t and excl_pp_t — small (thousands of rows max)
 *      person-set tables with ON COMMIT DROP. Each scan happens ONCE.
 *   2. Run a single GROUPING SETS aggregate joining qualifications to person
 *      and the two temp tables, producing the headline rate plus age and sex
 *      strata in one pass.
 *
 * The qualification × person × small-temp-table join is fast (PG hashes the
 * temps and probes); the heavy CDM scans happen exactly once each. This
 * replaces the prior pattern that re-evaluated the CTEs three times (once
 * for the headline aggregate, once per strata dimension) on the click path.
 *
 * Semantics follow standard eCQM:
 *   denom = qualified persons NOT in the exclusion set
 *   numer = qualified persons in the numerator set AND NOT excluded
 *   excl  = qualified persons in the exclusion set (removed from both)
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

        $this->materializePersonSet(
            $appConn,
            'cb_eval_numer_pp',
            $this->buildNumeratorSelect($measure, $cdmSchema),
        );
        $this->materializePersonSet(
            $appConn,
            'cb_eval_excl_pp',
            $this->buildExclusionSelect($measure, $cdmSchema),
        );

        // Persist a "hit" flag per qualified person via a tiny bridging temp
        // table so the GROUPING SETS aggregate has a clean shape regardless
        // of whether numerator / exclusion concept lists were empty.
        $sql = "
            WITH q AS (
                SELECT cbq.person_id,
                       p.year_of_birth,
                       p.gender_concept_id
                FROM care_bundle_qualifications cbq
                JOIN \"{$cdmSchema}\".person p ON p.person_id = cbq.person_id
                WHERE cbq.care_bundle_run_id = ?
            ),
            classified AS (
                SELECT
                    (n.person_id IS NOT NULL) AS is_numer,
                    (e.person_id IS NOT NULL) AS is_excl,
                    CASE
                        WHEN (EXTRACT(YEAR FROM CURRENT_DATE)::int - q.year_of_birth) BETWEEN 18 AND 44 THEN '18\xE2\x80\x9344'
                        WHEN (EXTRACT(YEAR FROM CURRENT_DATE)::int - q.year_of_birth) BETWEEN 45 AND 64 THEN '45\xE2\x80\x9364'
                        WHEN (EXTRACT(YEAR FROM CURRENT_DATE)::int - q.year_of_birth) BETWEEN 65 AND 74 THEN '65\xE2\x80\x9374'
                        WHEN (EXTRACT(YEAR FROM CURRENT_DATE)::int - q.year_of_birth) >= 75 THEN '75+'
                        ELSE 'Under 18 / Unknown'
                    END AS age_band,
                    CASE
                        WHEN (EXTRACT(YEAR FROM CURRENT_DATE)::int - q.year_of_birth) BETWEEN 18 AND 44 THEN 0
                        WHEN (EXTRACT(YEAR FROM CURRENT_DATE)::int - q.year_of_birth) BETWEEN 45 AND 64 THEN 1
                        WHEN (EXTRACT(YEAR FROM CURRENT_DATE)::int - q.year_of_birth) BETWEEN 65 AND 74 THEN 2
                        WHEN (EXTRACT(YEAR FROM CURRENT_DATE)::int - q.year_of_birth) >= 75 THEN 3
                        ELSE 99
                    END AS age_sort,
                    CASE q.gender_concept_id
                        WHEN 8507 THEN 'Male'
                        WHEN 8532 THEN 'Female'
                        ELSE 'Unknown'
                    END AS sex_cat
                FROM q
                LEFT JOIN cb_eval_numer_pp n ON n.person_id = q.person_id
                LEFT JOIN cb_eval_excl_pp  e ON e.person_id = q.person_id
            )
            SELECT
                CASE GROUPING(age_band, sex_cat)
                    WHEN 3 THEN 'all'
                    WHEN 1 THEN 'age_band'
                    WHEN 2 THEN 'sex'
                END AS dimension,
                CASE GROUPING(age_band, sex_cat)
                    WHEN 3 THEN 'All'
                    WHEN 1 THEN age_band
                    WHEN 2 THEN sex_cat
                END AS stratum,
                COALESCE(MIN(age_sort), 0) AS sort_key,
                COUNT(*) FILTER (WHERE NOT is_excl) AS denom,
                COUNT(*) FILTER (WHERE is_numer AND NOT is_excl) AS numer,
                COUNT(*) FILTER (WHERE is_excl) AS excl
            FROM classified
            GROUP BY GROUPING SETS ((), (age_band), (sex_cat))
            ORDER BY dimension, sort_key, stratum
        ";

        $rows = $appConn->select($sql, [$run->id]);

        $denom = 0;
        $numer = 0;
        $excl = 0;
        $strata = [];

        foreach ($rows as $r) {
            $rowDenom = (int) ($r->denom ?? 0);
            $rowNumer = (int) ($r->numer ?? 0);
            $rowExcl = (int) ($r->excl ?? 0);
            $dim = (string) ($r->dimension ?? '');

            if ($dim === 'all') {
                $denom = $rowDenom;
                $numer = $rowNumer;
                $excl = $rowExcl;

                continue;
            }

            $strata[] = [
                'dimension' => $dim,
                'stratum' => (string) ($r->stratum ?? 'Unknown'),
                'sort_key' => (int) ($r->sort_key ?? 0),
                'denom' => $rowDenom,
                'numer' => $rowNumer,
                'excl' => $rowExcl,
            ];
        }

        // Persist per-person compliance status for this measure. Powers
        // Tier C drill-down + cohort export (non-compliant roster). The
        // temp tables are still in scope, so this is one INSERT...SELECT.
        $appConn->statement(
            '
            DELETE FROM care_bundle_measure_person_status
            WHERE care_bundle_run_id = ? AND quality_measure_id = ?
        ',
            [$run->id, $measure->id]
        );
        $appConn->statement(
            '
            INSERT INTO care_bundle_measure_person_status
                (care_bundle_run_id, quality_measure_id, person_id, is_numer, is_excl)
            SELECT ?, ?, cbq.person_id,
                   (n.person_id IS NOT NULL),
                   (e.person_id IS NOT NULL)
            FROM care_bundle_qualifications cbq
            LEFT JOIN cb_eval_numer_pp n ON n.person_id = cbq.person_id
            LEFT JOIN cb_eval_excl_pp  e ON e.person_id = cbq.person_id
            WHERE cbq.care_bundle_run_id = ?
        ',
            [$run->id, $measure->id, $run->id]
        );

        // Drop the per-measure temp tables so the next measure's call gets a
        // clean slate; ON COMMIT DROP would only fire when the outer
        // materialization transaction commits.
        $appConn->statement('DROP TABLE IF EXISTS cb_eval_numer_pp');
        $appConn->statement('DROP TABLE IF EXISTS cb_eval_excl_pp');

        return new MeasureEvalResult(
            denominatorCount: $denom,
            numeratorCount: $numer,
            exclusionCount: $excl,
            strata: $strata,
        );
    }

    /**
     * @param  array{0: string, 1: list<mixed>}  $select
     */
    private function materializePersonSet(Connection $conn, string $tempName, array $select): void
    {
        [$selectSql, $bindings] = $select;
        $conn->statement("DROP TABLE IF EXISTS {$tempName}");
        $conn->statement("CREATE TEMP TABLE {$tempName} ON COMMIT DROP AS {$selectSql}", $bindings);
        $conn->statement("CREATE INDEX ON {$tempName} (person_id)");
        $conn->statement("ANALYZE {$tempName}");
    }

    /**
     * @return array{0: string, 1: list<mixed>}
     */
    private function buildNumeratorSelect(QualityMeasure $measure, string $cdmSchema): array
    {
        /** @var array<string, mixed> $numerator */
        $numerator = $measure->numerator_criteria ?? [];
        /** @var list<int> $ids */
        $ids = is_array($numerator['concept_ids'] ?? null)
            ? array_values(array_map('intval', $numerator['concept_ids']))
            : [];

        if (empty($ids)) {
            return ['SELECT NULL::bigint AS person_id WHERE FALSE', []];
        }

        $lookback = (int) ($numerator['lookback_days'] ?? 365);
        $table = $this->resolveTableName($measure->domain);
        $col = $this->resolveConceptColumn($measure->domain);
        $date = $this->resolveDateColumn($measure->domain);
        $ph = implode(',', array_fill(0, count($ids), '?'));

        // INTERVAL literals can't be parameterized directly in PG; multiply
        // a parameterized integer by `INTERVAL '1 day'` to keep $lookback off
        // the SQL string. Cast to int already enforced above — this is
        // defense-in-depth for future widening of lookback_days storage.
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
            ) - (? * INTERVAL '1 day')
        ";

        return [$sql, [...$ids, $lookback]];
    }

    /**
     * @return array{0: string, 1: list<mixed>}
     */
    private function buildExclusionSelect(QualityMeasure $measure, string $cdmSchema): array
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
                ) - (? * INTERVAL '1 day')
            ";
            $bindings = array_merge($bindings, $ids, [$lookback]);
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
