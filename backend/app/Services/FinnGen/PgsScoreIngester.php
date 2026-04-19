<?php

declare(strict_types=1);

namespace App\Services\FinnGen;

use App\Models\App\PgsScore;
use Illuminate\Support\Facades\DB;

/**
 * Phase 17 GENOMICS-06 — idempotent upsert of PGS Catalog data into
 * vocab.pgs_scores + vocab.pgs_score_variants.
 *
 * Design contracts (per 17-02-PLAN.md):
 *   - upsertScore() uses firstOrNew + fill for metadata so loaded_at refreshes
 *     on every run while other fields only overwrite when provided.
 *   - upsertVariants() writes via raw DB insertOrIgnore in batches of 1000,
 *     relying on the composite PK (score_id, chrom, pos_grch38, effect_allele)
 *     from Plan 01 migration to provide idempotent ON CONFLICT DO NOTHING.
 *
 * Running the command twice on the same fixture must produce exactly one
 * row in pgs_scores and N rows in pgs_score_variants with zero DUPLICATE
 * KEY errors — the Pest feature test asserts this end-to-end.
 */
final class PgsScoreIngester
{
    /**
     * Batch size for DB::insertOrIgnore — balances round-trip cost against
     * PG statement-parse cost on very large PGS files.
     */
    public const BATCH_SIZE = 1000;

    /**
     * Upsert (or refresh) a vocab.pgs_scores row.
     *
     * @param  array{
     *   score_id: string,
     *   pgs_name?: string|null,
     *   trait_reported?: string|null,
     *   trait_efo_ids?: list<string>|null,
     *   variants_number?: int|null,
     *   ancestry_distribution?: array<string, mixed>|null,
     *   publication_doi?: string|null,
     *   license?: string|null,
     *   weights_file_url?: string|null,
     *   harmonized_file_url?: string|null,
     *   genome_build?: string|null
     * }  $meta
     */
    public function upsertScore(array $meta): PgsScore
    {
        /** @var PgsScore $row */
        $row = PgsScore::firstOrNew(['score_id' => $meta['score_id']]);

        // Preserve existing values when the caller didn't supply one; avoids
        // wiping earlier metadata when running against the minimal --fixture path.
        $row->fill([
            'pgs_name' => $meta['pgs_name'] ?? $row->pgs_name,
            'trait_reported' => $meta['trait_reported'] ?? $row->trait_reported,
            'trait_efo_ids' => $meta['trait_efo_ids'] ?? $row->trait_efo_ids,
            'variants_number' => $meta['variants_number'] ?? $row->variants_number,
            'ancestry_distribution' => $meta['ancestry_distribution'] ?? $row->ancestry_distribution,
            'publication_doi' => $meta['publication_doi'] ?? $row->publication_doi,
            'license' => $meta['license'] ?? $row->license,
            'weights_file_url' => $meta['weights_file_url'] ?? $row->weights_file_url,
            'harmonized_file_url' => $meta['harmonized_file_url'] ?? $row->harmonized_file_url,
            'genome_build' => $meta['genome_build'] ?? $row->genome_build,
            'loaded_at' => now(),
        ]);
        $row->save();

        return $row;
    }

    /**
     * Bulk idempotent insert of per-variant weights via DB::insertOrIgnore.
     *
     * Uses the composite PK (score_id, chrom, pos_grch38, effect_allele) as
     * the conflict target — duplicate rows on re-run are silently skipped.
     *
     * @param  list<array{
     *   rsid: string|null,
     *   chrom: string,
     *   pos_grch38: int,
     *   pos_grch37: int|null,
     *   effect_allele: string,
     *   other_allele: string|null,
     *   effect_weight: float,
     *   frequency_effect_allele?: float|null,
     *   allele_frequency?: float|null
     * }>  $variants
     * @return array{inserted: int, skipped_duplicate: int, missing_rsid: int}
     */
    public function upsertVariants(string $scoreId, array $variants): array
    {
        if ($variants === []) {
            return ['inserted' => 0, 'skipped_duplicate' => 0, 'missing_rsid' => 0];
        }

        $inserted = 0;
        $missingRsid = 0;
        $batches = array_chunk($variants, self::BATCH_SIZE);

        foreach ($batches as $batch) {
            $rows = [];
            foreach ($batch as $v) {
                if ($v['rsid'] === null) {
                    $missingRsid++;
                }
                $rows[] = [
                    'score_id' => $scoreId,
                    'rsid' => $v['rsid'],
                    'chrom' => $v['chrom'],
                    'pos_grch38' => $v['pos_grch38'],
                    'pos_grch37' => $v['pos_grch37'],
                    'effect_allele' => $v['effect_allele'],
                    'other_allele' => $v['other_allele'],
                    'effect_weight' => $v['effect_weight'],
                    'frequency_effect_allele' => $v['frequency_effect_allele'] ?? null,
                    'allele_frequency' => $v['allele_frequency'] ?? null,
                ];
            }
            $inserted += DB::connection('omop')
                ->table('vocab.pgs_score_variants')
                ->insertOrIgnore($rows);
        }

        $skippedDuplicate = max(0, count($variants) - $inserted);

        return [
            'inserted' => $inserted,
            'skipped_duplicate' => $skippedDuplicate,
            'missing_rsid' => $missingRsid,
        ];
    }
}
