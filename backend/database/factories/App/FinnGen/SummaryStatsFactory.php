<?php

declare(strict_types=1);

namespace Database\Factories\App\FinnGen;

use Illuminate\Support\Facades\DB;

/**
 * Phase 16-01 deterministic fixture seeder for `{schema}.summary_stats`.
 *
 * There is no Eloquent model for summary_stats — Phase 14 writes rows via raw
 * SQL out of a Darkstar R worker (see GwasSchemaProvisioner::provision()). This
 * factory mirrors that contract: plain DB::table()->insert() keyed by
 * (gwas_run_id, cohort_definition_id, chrom, pos) using the exact column
 * set from the provisioner.
 *
 * Usage in unit tests (see ManhattanAggregationServiceTest):
 *
 *   (new SummaryStatsFactory)->seed(
 *       schema: 'test_thinning_gwas_results',
 *       runId: '01JAAAAAAAAAAAAAAAAAAAAAAA',
 *       rowsPerChrom: 100,
 *       chroms: ['1', '2', 'X'],
 *       gwsCount: 3,
 *   );
 *
 * Seeding is deterministic: given identical parameters the output is
 * byte-identical between calls, because positions are uniformly spread
 * via integer arithmetic and p_value is derived from `($n * 37) mod 1000`
 * normalized to (0, 1). That lets tests assert exact per-bin winners.
 *
 * `gwsCount` > 0 inserts additional rows at p_value = 1e-10 (well under the
 * 5e-8 GWS threshold) — positioned at the high end of chrom 1 so they
 * reliably land in bins that already have non-GWS representatives, proving
 * the UNION-branch gws_bypass path.
 */
final class SummaryStatsFactory
{
    /**
     * Seed `{schema}.summary_stats` with deterministic rows.
     *
     * @param  string  $schema  already-validated schema name (caller whitelisted)
     * @param  string  $runId  ULID (VARCHAR(26))
     * @param  int  $rowsPerChrom  rows to generate per chromosome
     * @param  list<string>  $chroms  e.g. ['1', '2', 'X', 'MT']
     * @param  int  $gwsCount  additional GWS-significant rows (p=1e-10) placed on chroms[0]
     * @param  int  $cohortDefinitionId  cohort_definition_id value for every row
     */
    public function seed(
        string $schema,
        string $runId,
        int $rowsPerChrom,
        array $chroms,
        int $gwsCount = 0,
        int $cohortDefinitionId = 1,
    ): void {
        $rows = [];

        foreach ($chroms as $chrom) {
            for ($i = 0; $i < $rowsPerChrom; $i++) {
                // Positions uniformly spread 1_000 … 1_000 * rowsPerChrom
                $pos = 1_000 + ($i * 10_000);

                // p_value in (0, 1) — deterministic pseudo-random via ($i*37) mod 997 + offset.
                // This guarantees each (chrom, bin) has a distinct minimum we can assert on.
                $rawP = ((($i * 37) % 997) + 1) / 1000.0;

                $rows[] = [
                    'gwas_run_id' => $runId,
                    'cohort_definition_id' => $cohortDefinitionId,
                    'chrom' => $chrom,
                    'pos' => $pos,
                    'ref' => 'A',
                    'alt' => 'G',
                    'af' => 0.25,
                    'beta' => 0.1,
                    'se' => 0.02,
                    'p_value' => $rawP,
                    'snp_id' => 'rs'.($i + 1000),
                    'case_n' => 100,
                    'control_n' => 900,
                ];
            }
        }

        // GWS bypass rows: placed at the HIGH end of chroms[0] so that they
        // land in a bin that already has a non-GWS representative. The UNION
        // semantics must emit BOTH the bin representative AND the GWS rows.
        if ($gwsCount > 0 && $chroms !== []) {
            $target = $chroms[0];
            for ($j = 0; $j < $gwsCount; $j++) {
                $rows[] = [
                    'gwas_run_id' => $runId,
                    'cohort_definition_id' => $cohortDefinitionId,
                    'chrom' => $target,
                    'pos' => 999_000 + $j, // high end; within max(pos) of the chrom
                    'ref' => 'C',
                    'alt' => 'T',
                    'af' => 0.05,
                    'beta' => 1.2,
                    'se' => 0.1,
                    'p_value' => 1.0e-10, // well under 5e-8 GWS threshold
                    'snp_id' => 'rsGWS'.$j,
                    'case_n' => 100,
                    'control_n' => 900,
                ];
            }
        }

        // Chunk inserts to avoid the PG 65k-parameter cap for very large fixtures.
        foreach (array_chunk($rows, 1_000) as $chunk) {
            DB::table("{$schema}.summary_stats")->insert($chunk);
        }
    }
}
