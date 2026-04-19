<?php

declare(strict_types=1);

namespace App\Services\FinnGen;

use App\Models\App\FinnGen\Run;
use App\Models\App\Source;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

/**
 * Phase 16-01 — Manhattan aggregation service.
 *
 * Responsibilities:
 *   - `resolveSchemaForRun(Run)`   → {source}_gwas_results via whitelist
 *   - `thin(schema, runId, bins, threshold)`
 *                                  → per-(chrom, bin) winner + GWS bypass
 *   - `region(schema, runId, chrom, start, end)`
 *                                  → full-precision window for regional view
 *   - `topVariants(schema, runId, sort, dir, limit, ?cohortDefinitionId)`
 *                                  → Top-N for variants table
 *
 * Security (HIGHSEC §2, §3 + threat model T-16-S1, T-16-S13):
 *   - Schema name is validated against `^[a-z][a-z0-9_]*$` at every public
 *     entry point AND re-validated inside each method (defense in depth).
 *   - Schema name is NEVER built from request input — only from
 *     `Source::source_key` (registered app-level sources).
 *   - Schema existence is confirmed via `information_schema.schemata` BEFORE
 *     any `{schema}.summary_stats` SELECT to avoid SQLSTATE 25P02 transaction
 *     poisoning (Pitfall 2).
 *
 * Q6 RESOLUTION (grep against GwasRunService.php): the case-cohort
 * identifier in `runs.params` is keyed `cohort_definition_id` — confirmed
 * at multiple dispatch sites (dispatchStep1 L89, dispatchStep2 L120,
 * dispatchStep2AfterStep1 L167 — uses $caseCohortId). `topVariants()`
 * accepts an optional `$cohortDefinitionId` so callers can opt into the
 * (cohort_definition_id, p_value) BTREE fast-path when the key is
 * available on the Run model.
 */
final class ManhattanAggregationService
{
    /**
     * Q6 RESOLVED — the Run.params JSONB key carrying the case-cohort id.
     * Confirmed in:
     *   - GwasRunService::dispatchStep1 (L89)
     *   - GwasRunService::dispatchStep2 (L120)
     *   - GwasRunService::dispatchStep2AfterStep1 (L167)
     */
    public const CASE_COHORT_PARAM_KEY = 'cohort_definition_id';

    /**
     * Whitelist regex for schema names. Mirrors
     * CohortPrsController::SAFE_SOURCE_KEY_REGEX and
     * GwasSchemaProvisioner::SAFE_SOURCE_REGEX so a schema that passed
     * provisioning passes this gate.
     */
    private const SCHEMA_WHITELIST_RE = '/^[a-z][a-z0-9_]*$/';

    /**
     * Resolve the `{source}_gwas_results` schema for a given Run.
     *
     * Returns null when the run's source_key is not a registered Source,
     * the whitelist regex rejects the derived schema name, or PostgreSQL
     * reports no such schema. Callers should treat null as a 404.
     */
    public function resolveSchemaForRun(Run $run): ?string
    {
        $sourceKey = (string) $run->source_key;

        // Whitelist: the source must be a known app-level Source. Prevents
        // an attacker from coaxing a synthetic run (e.g. via JSON injection
        // upstream) into naming a non-approved schema.
        if (! Source::query()->where('source_key', $sourceKey)->exists()) {
            return null;
        }

        $schema = strtolower($sourceKey).'_gwas_results';

        if (preg_match(self::SCHEMA_WHITELIST_RE, $schema) !== 1) {
            return null;
        }

        // Pitfall 2 — existence check before any {schema}.summary_stats
        // SELECT avoids transaction poisoning if the Provisioner hasn't
        // run for this source.
        $hasSchema = DB::selectOne(
            'SELECT 1 AS ok FROM information_schema.schemata WHERE schema_name = ? LIMIT 1',
            [$schema]
        );

        return $hasSchema === null ? null : $schema;
    }

    /**
     * Execute the D-02 thinning query + D-04 payload shape.
     *
     * @return array{
     *     variants: list<array{chrom:string,pos:int,neg_log_p:float,snp_id:?string}>,
     *     genome: array{chrom_offsets: array<string,int>},
     *     thinning: array{bins:int,threshold:float,variant_count_before:int,variant_count_after:int}
     * }
     */
    public function thin(string $schema, string $runId, int $binCount, float $threshold): array
    {
        $this->assertSchemaSafe($schema);

        $countBefore = (int) (DB::scalar(
            "SELECT COUNT(*) FROM {$schema}.summary_stats WHERE gwas_run_id = ?",
            [$runId]
        ) ?? 0);

        // RESEARCH §Pattern 1 — per-chromosome width_bucket + ROW_NUMBER
        // representative, UNION-ed with an unconditional GWS bypass. The
        // outer ORDER BY keeps output deterministic for cache stability.
        $sql = <<<SQL
WITH per_chrom_bounds AS (
    SELECT chrom,
           MIN(pos)::bigint AS chrom_start,
           MAX(pos)::bigint AS chrom_end
      FROM {$schema}.summary_stats
     WHERE gwas_run_id = ?
  GROUP BY chrom
),
binned AS (
    SELECT ss.chrom,
           ss.pos,
           ss.p_value,
           ss.snp_id,
           ROW_NUMBER() OVER (
               PARTITION BY ss.chrom,
                            width_bucket(ss.pos, b.chrom_start, b.chrom_end + 1, ?)
               ORDER BY ss.p_value ASC NULLS LAST, ss.pos ASC
           ) AS rnk
      FROM {$schema}.summary_stats ss
      JOIN per_chrom_bounds b ON b.chrom = ss.chrom
     WHERE ss.gwas_run_id = ?
),
thin_reps AS (
    SELECT chrom, pos, p_value, snp_id
      FROM binned
     WHERE rnk = 1
),
gws_bypass AS (
    SELECT chrom, pos, p_value, snp_id
      FROM {$schema}.summary_stats
     WHERE gwas_run_id = ?
       AND p_value < ?
       AND p_value IS NOT NULL
)
SELECT chrom, pos, p_value, snp_id FROM thin_reps
UNION
SELECT chrom, pos, p_value, snp_id FROM gws_bypass
ORDER BY chrom, pos
SQL;

        /** @var list<object{chrom:string,pos:int|string,p_value:?float,snp_id:?string}> $rows */
        $rows = DB::select($sql, [$runId, $binCount, $runId, $runId, $threshold]);

        $variants = array_map(
            /** @return array{chrom:string,pos:int,neg_log_p:float,snp_id:?string} */
            static function (object $r): array {
                $p = $r->p_value !== null ? (float) $r->p_value : null;

                return [
                    'chrom' => (string) $r->chrom,
                    'pos' => (int) $r->pos,
                    'neg_log_p' => ($p !== null && $p > 0.0) ? -log10($p) : 0.0,
                    'snp_id' => $r->snp_id !== null ? (string) $r->snp_id : null,
                ];
            },
            $rows
        );

        // chrom_offsets: cumulative chrom-end offsets so the frontend can
        // map (chrom, pos) → genome-wide x coordinate without re-querying.
        /** @var array<string,int> $offsets */
        $offsets = [];
        $cum = 0;
        $bounds = DB::select(
            "SELECT chrom, MAX(pos)::bigint AS chrom_end
               FROM {$schema}.summary_stats
              WHERE gwas_run_id = ?
           GROUP BY chrom
           ORDER BY chrom",
            [$runId]
        );
        foreach ($bounds as $o) {
            $offsets[(string) $o->chrom] = $cum;
            $cum += (int) $o->chrom_end;
        }

        return [
            'variants' => $variants,
            'genome' => ['chrom_offsets' => $offsets],
            'thinning' => [
                'bins' => $binCount,
                'threshold' => $threshold,
                'variant_count_before' => $countBefore,
                'variant_count_after' => count($variants),
            ],
        ];
    }

    /**
     * Full-precision variant rows for a regional view window.
     *
     * @return array{variants: list<array<string,mixed>>, chrom: string, start: int, end: int}
     */
    public function region(string $schema, string $runId, string $chrom, int $start, int $end): array
    {
        $this->assertSchemaSafe($schema);

        /** @var list<object> $rows */
        $rows = DB::select(
            "SELECT chrom, pos, ref, alt, af, beta, se, p_value, snp_id
               FROM {$schema}.summary_stats
              WHERE gwas_run_id = ?
                AND chrom = ?
                AND pos BETWEEN ? AND ?
           ORDER BY pos ASC",
            [$runId, $chrom, $start, $end]
        );

        return [
            'variants' => array_map(static fn (object $r): array => (array) $r, $rows),
            'chrom' => $chrom,
            'start' => $start,
            'end' => $end,
        ];
    }

    /**
     * Top-N variants sorted by a whitelisted column. Optionally scopes by
     * `cohort_definition_id` to exploit the (cohort_definition_id, p_value)
     * BTREE index (Pitfall 6).
     *
     * @return array{rows: list<array<string,mixed>>, total: int}
     */
    public function topVariants(
        string $schema,
        string $runId,
        string $sort,
        string $dir,
        int $limit,
        ?int $cohortDefinitionId = null,
    ): array {
        $this->assertSchemaSafe($schema);

        $allowedSorts = ['chrom', 'pos', 'af', 'beta', 'se', 'p_value', 'snp_id'];
        if (! in_array($sort, $allowedSorts, true)) {
            throw new InvalidArgumentException("Invalid sort column: {$sort}");
        }
        $direction = strtoupper($dir) === 'DESC' ? 'DESC' : 'ASC';

        $cohortClause = $cohortDefinitionId !== null ? 'AND cohort_definition_id = ?' : '';
        $params = $cohortDefinitionId !== null
            ? [$runId, $cohortDefinitionId, $limit]
            : [$runId, $limit];

        /** @var list<object> $rows */
        $rows = DB::select(
            "SELECT chrom, pos, ref, alt, af, beta, se, p_value, snp_id, gwas_run_id
               FROM {$schema}.summary_stats
              WHERE gwas_run_id = ? {$cohortClause}
           ORDER BY {$sort} {$direction} NULLS LAST, pos ASC
              LIMIT ?",
            $params
        );

        return [
            'rows' => array_map(static fn (object $r): array => (array) $r, $rows),
            'total' => count($rows),
        ];
    }

    /**
     * Re-validate schema name at each method boundary. Throws so callers
     * fail loudly instead of silently emitting an empty result set.
     */
    private function assertSchemaSafe(string $schema): void
    {
        if (preg_match(self::SCHEMA_WHITELIST_RE, $schema) !== 1) {
            throw new InvalidArgumentException("Invalid schema name: {$schema}");
        }
    }
}
