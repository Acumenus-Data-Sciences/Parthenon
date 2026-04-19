<?php

declare(strict_types=1);

namespace App\Services\FinnGen;

use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

/**
 * Phase 17 GENOMICS-08 D-05 — aggregates per-cohort PRS distributions server-side
 * so the frontend never sees raw per-subject scores (T-17-S2 Information-Disclosure
 * mitigation). Uses PG width_bucket + percentile_cont per 17-RESEARCH §Pattern 3.
 *
 * Aggregation is exact (percentile_cont, not percentile_disc). Histogram uses
 * width_bucket against MIN/MAX bounds of the matching rows, folding the upper-tail
 * edge into the last bin via LEAST(bin, :bins).
 *
 * Threat surface:
 *   - T-17-S1 (Tampering): schema + score_id are regex-allowlisted BEFORE
 *     interpolation; all other bindings are parameterized.
 *   - T-17-S2 (Information Disclosure): output contains ONLY aggregates
 *     (counts, percentiles, summary stats). No per-subject fields.
 */
final class PrsAggregationService
{
    private const SAFE_SCHEMA_REGEX = '/^[a-z][a-z0-9_]*$/';

    private const SAFE_SCORE_ID_REGEX = '/^PGS\d{6,}$/';

    public const MIN_BINS = 10;

    public const MAX_BINS = 200;

    public const DEFAULT_BINS = 50;

    /**
     * @return array{
     *     subject_count: int,
     *     summary: array{mean: float|null, stddev: float|null, min: float|null, max: float|null, median: float|null, iqr_q1: float|null, iqr_q3: float|null},
     *     quintiles: array{q20: float|null, q40: float|null, q60: float|null, q80: float|null},
     *     histogram: list<array{bin: int, bin_lo: float, bin_hi: float, n: int}>
     * }
     */
    public function aggregate(string $schema, string $scoreId, int $cohortDefinitionId, int $bins = self::DEFAULT_BINS): array
    {
        if (preg_match(self::SAFE_SCHEMA_REGEX, $schema) !== 1) {
            throw new InvalidArgumentException("Unsafe schema: {$schema}");
        }
        if (preg_match(self::SAFE_SCORE_ID_REGEX, $scoreId) !== 1) {
            throw new InvalidArgumentException("Unsafe score_id: {$scoreId}");
        }

        $bins = max(self::MIN_BINS, min(self::MAX_BINS, $bins));

        // Summary + quintiles in one query (D-05 + RESEARCH §Pattern 3 verbatim).
        // Default connection (`pgsql` in prod, `pgsql_testing` under Pest) — same
        // physical DB, different search_path. Cross-schema references are fully
        // qualified so search_path is irrelevant.
        $summaryRow = DB::connection()->selectOne(
            "SELECT
                AVG(raw_score)::float AS mean,
                STDDEV(raw_score)::float AS stddev,
                MIN(raw_score)::float AS min,
                MAX(raw_score)::float AS max,
                percentile_cont(0.20) WITHIN GROUP (ORDER BY raw_score)::float AS q20,
                percentile_cont(0.40) WITHIN GROUP (ORDER BY raw_score)::float AS q40,
                percentile_cont(0.50) WITHIN GROUP (ORDER BY raw_score)::float AS median,
                percentile_cont(0.60) WITHIN GROUP (ORDER BY raw_score)::float AS q60,
                percentile_cont(0.80) WITHIN GROUP (ORDER BY raw_score)::float AS q80,
                percentile_cont(0.25) WITHIN GROUP (ORDER BY raw_score)::float AS iqr_q1,
                percentile_cont(0.75) WITHIN GROUP (ORDER BY raw_score)::float AS iqr_q3,
                COUNT(*)::int AS subject_count
              FROM {$schema}.prs_subject_scores
             WHERE score_id = ? AND cohort_definition_id = ?",
            [$scoreId, $cohortDefinitionId]
        );

        $subjectCount = (int) ($summaryRow->subject_count ?? 0);
        if ($subjectCount === 0) {
            return [
                'subject_count' => 0,
                'summary' => [
                    'mean' => null, 'stddev' => null, 'min' => null, 'max' => null,
                    'median' => null, 'iqr_q1' => null, 'iqr_q3' => null,
                ],
                'quintiles' => ['q20' => null, 'q40' => null, 'q60' => null, 'q80' => null],
                'histogram' => [],
            ];
        }

        // Histogram — width_bucket folds values < lo → 0 and > hi → (bins+1).
        // We fold the upper-tail edge (the MAX value ends up in bin = bins+1)
        // by clamping in a subquery so GROUP BY sees a single expression.
        $histogramRows = DB::connection()->select(
            "WITH
             bounds AS (
                 SELECT MIN(raw_score) AS lo, MAX(raw_score) AS hi
                   FROM {$schema}.prs_subject_scores
                  WHERE score_id = ? AND cohort_definition_id = ?
             ),
             binned AS (
                 SELECT LEAST(width_bucket(raw_score, bounds.lo, bounds.hi, ?), ?)::int AS bin,
                        raw_score
                   FROM {$schema}.prs_subject_scores, bounds
                  WHERE score_id = ? AND cohort_definition_id = ?
             )
             SELECT bin,
                    COUNT(*)::int AS n,
                    MIN(raw_score)::float AS bin_lo,
                    MAX(raw_score)::float AS bin_hi
               FROM binned
              GROUP BY bin
              ORDER BY bin",
            [$scoreId, $cohortDefinitionId, $bins, $bins, $scoreId, $cohortDefinitionId]
        );

        $histogram = array_map(static function ($r): array {
            return [
                'bin' => (int) $r->bin,
                'bin_lo' => (float) $r->bin_lo,
                'bin_hi' => (float) $r->bin_hi,
                'n' => (int) $r->n,
            ];
        }, $histogramRows);

        return [
            'subject_count' => $subjectCount,
            'summary' => [
                'mean' => $summaryRow->mean !== null ? (float) $summaryRow->mean : null,
                'stddev' => $summaryRow->stddev !== null ? (float) $summaryRow->stddev : null,
                'min' => $summaryRow->min !== null ? (float) $summaryRow->min : null,
                'max' => $summaryRow->max !== null ? (float) $summaryRow->max : null,
                'median' => $summaryRow->median !== null ? (float) $summaryRow->median : null,
                'iqr_q1' => $summaryRow->iqr_q1 !== null ? (float) $summaryRow->iqr_q1 : null,
                'iqr_q3' => $summaryRow->iqr_q3 !== null ? (float) $summaryRow->iqr_q3 : null,
            ],
            'quintiles' => [
                'q20' => $summaryRow->q20 !== null ? (float) $summaryRow->q20 : null,
                'q40' => $summaryRow->q40 !== null ? (float) $summaryRow->q40 : null,
                'q60' => $summaryRow->q60 !== null ? (float) $summaryRow->q60 : null,
                'q80' => $summaryRow->q80 !== null ? (float) $summaryRow->q80 : null,
            ],
            'histogram' => $histogram,
        ];
    }
}
