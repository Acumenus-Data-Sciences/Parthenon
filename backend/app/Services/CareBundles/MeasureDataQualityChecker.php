<?php

namespace App\Services\CareBundles;

use App\Models\App\CareBundleMeasureResult;
use App\Models\App\CareBundleRun;
use App\Models\App\QualityMeasure;
use App\Models\App\Source;
use Illuminate\Support\Facades\DB;

/**
 * Compute data-quality flags for a (measure, source, run) triple.
 *
 * Quality researchers need to distinguish "this rate is real" from "this rate
 * is an artifact of incomplete coding or undercollection." Flags surface
 * common problems before a researcher cites a number that won't survive review.
 *
 * Flag levels:
 *   info     — informational only, no action needed
 *   warning  — researcher should investigate before publishing
 *   critical — measure is unreliable for this CDM, do not use as-is
 */
class MeasureDataQualityChecker
{
    /**
     * @return list<array{level: string, code: string, message: string}>
     */
    public function check(
        QualityMeasure $measure,
        Source $source,
        string $cdmSchema,
        ?CareBundleRun $run = null,
        ?CareBundleMeasureResult $result = null,
    ): array {
        $flags = [];

        $flags = array_merge($flags, $this->checkDomainCoverage($measure, $cdmSchema));

        if ($result !== null) {
            $flags = array_merge($flags, $this->checkResultShape($result));
        }

        return array_values($flags);
    }

    /**
     * @return list<array{level: string, code: string, message: string}>
     */
    private function checkDomainCoverage(QualityMeasure $measure, string $cdmSchema): array
    {
        $flags = [];
        $appConn = DB::connection();

        // 1. Does the measure's domain table even have rows in this CDM?
        //    pg_class.reltuples is the planner's estimate (kept fresh by
        //    autovacuum/ANALYZE) — instant lookup from the catalog. A bad
        //    answer of 0 here only matters when the table is genuinely empty,
        //    in which case any honest stats would also report 0.
        try {
            $table = $this->resolveTableName($measure->domain);
            $col = $this->resolveConceptColumn($measure->domain);
            $countRow = $appConn->selectOne(
                'SELECT reltuples::bigint AS c FROM pg_class WHERE oid = ?::regclass',
                ["{$cdmSchema}.{$table}"],
            );
            $totalRows = $countRow ? (int) $countRow->c : 0;

            if ($totalRows === 0) {
                $flags[] = [
                    'level' => 'critical',
                    'code' => 'domain_empty',
                    'message' => "Source CDM has no rows in {$cdmSchema}.{$table}. "
                        ."Numerator cannot be evaluated for {$measure->domain}-domain measures.",
                ];

                return $flags;
            }

            // 2. Are any of the numerator concepts (or their descendants) actually
            //    present in the source data? EXISTS short-circuits on first
            //    match — sub-100ms instead of a full COUNT(*) scan.
            /** @var list<int> $numerIds */
            $numerIds = is_array($measure->numerator_criteria['concept_ids'] ?? null)
                ? array_values(array_map('intval', $measure->numerator_criteria['concept_ids']))
                : [];

            if (! empty($numerIds)) {
                $ph = implode(',', array_fill(0, count($numerIds), '?'));
                $hitRow = $appConn->selectOne(
                    "
                    SELECT EXISTS (
                        SELECT 1
                        FROM \"{$cdmSchema}\".{$table} t
                        WHERE t.{$col} IN (
                            SELECT ca.descendant_concept_id
                            FROM vocab.concept_ancestor ca
                            WHERE ca.ancestor_concept_id IN ({$ph})
                        )
                    ) AS has_match
                ",
                    $numerIds,
                );
                $hasMatch = (bool) ($hitRow->has_match ?? false);

                if (! $hasMatch) {
                    $flags[] = [
                        'level' => 'critical',
                        'code' => 'numerator_concepts_unused',
                        'message' => 'No rows in '.$cdmSchema.'.'.$table.' match the measure\'s '
                            .'numerator concepts (with descendants). The 0% rate is not a quality '
                            ."finding — it indicates the source does not code this measure's domain.",
                    ];
                }
            }
        } catch (\Throwable $e) {
            $flags[] = [
                'level' => 'warning',
                'code' => 'domain_check_failed',
                'message' => 'Could not verify domain coverage: '.$e->getMessage(),
            ];
        }

        return $flags;
    }

    /**
     * @return list<array{level: string, code: string, message: string}>
     */
    private function checkResultShape(CareBundleMeasureResult $result): array
    {
        $flags = [];
        $denom = (int) $result->denominator_count;
        $numer = (int) $result->numerator_count;
        $excl = (int) $result->exclusion_count;

        if ($denom < 30) {
            $flags[] = [
                'level' => 'critical',
                'code' => 'denominator_below_30',
                'message' => "Denominator is {$denom}. Quality measure rates "
                    .'below N=30 are not statistically defensible.',
            ];
        }

        if ($denom > 0) {
            $rate = $numer / $denom;

            if ($denom >= 1000 && $rate < 0.001) {
                $flags[] = [
                    'level' => 'warning',
                    'code' => 'rate_near_zero',
                    'message' => 'Rate is below 0.1% with a large denominator. '
                        .'Likely indicates documentation gap rather than care delivery — '
                        .'verify that numerator concepts are routinely recorded in this source.',
                ];
            }

            if ($denom >= 1000 && $rate > 0.999) {
                $flags[] = [
                    'level' => 'warning',
                    'code' => 'rate_near_one',
                    'message' => 'Rate is above 99.9% with a large denominator. '
                        .'Possible measure logic error or data issue — verify '
                        .'denominator and exclusion criteria are correctly specified.',
                ];
            }

            $ci = WilsonCI::compute($numer, $denom);
            if ($ci !== null && ($ci['upper'] - $ci['lower']) > 0.05) {
                $flags[] = [
                    'level' => 'info',
                    'code' => 'wide_confidence_interval',
                    'message' => 'Wilson 95% CI width exceeds 5 percentage points. '
                        .'Result has limited precision; exercise caution in publication.',
                ];
            }
        }

        $eligible = $denom + $excl;
        if ($eligible > 0 && ($excl / $eligible) > 0.20) {
            $flags[] = [
                'level' => 'info',
                'code' => 'high_exclusion_rate',
                'message' => sprintf(
                    'Exclusions remove %.1f%% of qualified persons. Verify '
                    .'exclusion criteria match the measure intent.',
                    100.0 * $excl / $eligible,
                ),
            ];
        }

        return $flags;
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
}
