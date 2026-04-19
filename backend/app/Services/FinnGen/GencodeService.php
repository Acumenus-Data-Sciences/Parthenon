<?php

declare(strict_types=1);

namespace App\Services\FinnGen;

/**
 * Phase 16-01 — GENCODE gene-range service.
 *
 * Singleton service backing the regional-view gene track (Plan 03). Loads
 * `storage/app/private/gencode/genes-v46.tsv` once per PHP-FPM worker via
 * a static class-level cache and answers range queries with an O(n) linear
 * scan over ~60k gene rows (<1ms per query).
 *
 * Data format (see LoadGencodeGtfCommand):
 *   gene_name\tchrom\tstart\tend\tstrand\tgene_type
 *
 *   chrom: normalized, no "chr" prefix ("1"…"22","X","Y","MT")
 *   gene_type: GENCODE biotype (protein_coding, lncRNA, miRNA, pseudogene, …)
 *
 * Default biotype filter excludes pseudogenes and noise (Pitfall 7).
 * Callers can pass `includePseudogenes=true` to override when auditing.
 */
final class GencodeService
{
    /**
     * Biotypes surfaced by default. A 1 Mb regional view typically has
     * ~20-40 genes of these types — dense enough to be clinically useful
     * without cluttering the track with pseudogenes (~14k genome-wide).
     *
     * @var list<string>
     */
    public const DEFAULT_TYPES = [
        'protein_coding',
        'lincRNA',
        'lncRNA',
        'miRNA',
    ];

    /**
     * Static cache keyed on the worker lifetime. Populated lazily on the
     * first findGenesInRange() call.
     *
     * @var list<array{gene_name:string,chrom:string,start:int,end:int,strand:string,gene_type:string}>|null
     */
    private static ?array $genes = null;

    /**
     * Return all genes overlapping [chrom, start..end].
     *
     * @return list<array{gene_name:string,chrom:string,start:int,end:int,strand:string,gene_type:string}>
     */
    public function findGenesInRange(
        string $chrom,
        int $start,
        int $end,
        bool $includePseudogenes = false,
    ): array {
        self::$genes ??= $this->load();

        /** @var list<array{gene_name:string,chrom:string,start:int,end:int,strand:string,gene_type:string}> $out */
        $out = [];
        foreach (self::$genes as $g) {
            if ($g['chrom'] !== $chrom) {
                continue;
            }
            // Overlap test: gene [start, end] overlaps query [s, e] iff
            //   gene.start <= e AND gene.end >= s
            if ($g['start'] > $end || $g['end'] < $start) {
                continue;
            }
            if (! $includePseudogenes && ! in_array($g['gene_type'], self::DEFAULT_TYPES, true)) {
                continue;
            }
            $out[] = $g;
        }

        return $out;
    }

    /**
     * Reset the static cache. Test-only helper — clears the in-process
     * memoization so successive tests can exercise a fresh TSV.
     */
    public static function resetCache(): void
    {
        self::$genes = null;
    }

    /**
     * Load the TSV into memory. Returns an empty list when the file is
     * missing (allowing staged rollouts where the Artisan command runs
     * after the deploy).
     *
     * @return list<array{gene_name:string,chrom:string,start:int,end:int,strand:string,gene_type:string}>
     */
    private function load(): array
    {
        $path = storage_path('app/private/gencode/genes-v46.tsv');
        if (! is_file($path)) {
            return [];
        }

        /** @var list<array{gene_name:string,chrom:string,start:int,end:int,strand:string,gene_type:string}> $rows */
        $rows = [];
        $fh = fopen($path, 'rb');
        if ($fh === false) {
            return [];
        }
        try {
            while (($line = fgets($fh)) !== false) {
                $c = explode("\t", rtrim($line, "\r\n"));
                if (count($c) < 6) {
                    continue;
                }
                $rows[] = [
                    'gene_name' => $c[0],
                    'chrom' => $c[1],
                    'start' => (int) $c[2],
                    'end' => (int) $c[3],
                    'strand' => $c[4],
                    'gene_type' => $c[5],
                ];
            }
        } finally {
            fclose($fh);
        }

        return $rows;
    }
}
