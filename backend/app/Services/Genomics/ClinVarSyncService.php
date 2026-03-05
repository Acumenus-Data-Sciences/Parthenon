<?php

namespace App\Services\Genomics;

use App\Models\App\ClinVarSyncLog;
use App\Models\App\ClinVarVariant;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Downloads and parses ClinVar VCF files from NCBI FTP into the clinvar_variants table.
 *
 * Supports streaming gzip decompression so the full 181 MB file never loads into memory.
 * Uses upsert keyed on (chromosome, position, reference_allele, alternate_allele, genome_build)
 * so re-runs are safe and idempotent.
 */
class ClinVarSyncService
{
    private const FTP_BASE = 'https://ftp.ncbi.nlm.nih.gov/pub/clinvar/vcf_GRCh38';

    /** @var int batch size for DB upsert */
    private const BATCH = 1000;

    /**
     * Run a full sync.
     *
     * @param bool   $papuOnly  If true, fetch the Pathogenic/Likely-Pathogenic subset (~69 KB)
     * @param string $build     Genome build tag to store (GRCh38)
     * @return array{inserted: int, updated: int, errors: int, log_id: int}
     */
    public function sync(bool $papuOnly = false, string $build = 'GRCh38'): array
    {
        $filename = $papuOnly ? 'clinvar_papu.vcf.gz' : 'clinvar.vcf.gz';
        $url      = self::FTP_BASE . '/' . $filename;

        $syncLog = ClinVarSyncLog::create([
            'genome_build'     => $build,
            'papu_only'        => $papuOnly,
            'source_url'       => $url,
            'status'           => 'running',
            'started_at'       => now(),
        ]);

        try {
            $tmpPath = $this->download($url);
            $counts  = $this->parseAndUpsert($tmpPath, $build, $syncLog->id);
            @unlink($tmpPath);

            $syncLog->update([
                'status'            => 'completed',
                'variants_inserted' => $counts['inserted'],
                'variants_updated'  => $counts['updated'],
                'finished_at'       => now(),
            ]);

            return array_merge($counts, ['log_id' => $syncLog->id]);
        } catch (\Throwable $e) {
            $syncLog->update([
                'status'        => 'failed',
                'error_message' => $e->getMessage(),
                'finished_at'   => now(),
            ]);
            throw $e;
        }
    }

    // ──────────────────────────────────────────────────────────────────────────

    private function download(string $url): string
    {
        $tmp = tempnam(sys_get_temp_dir(), 'clinvar_') . '.vcf.gz';

        Log::info('ClinVarSyncService: downloading', ['url' => $url, 'tmp' => $tmp]);

        $response = Http::timeout(600)->withOptions(['sink' => $tmp])->get($url);

        if ($response->failed()) {
            throw new \RuntimeException("ClinVar download failed: HTTP {$response->status()} from {$url}");
        }

        return $tmp;
    }

    /**
     * Stream-decompress the .vcf.gz and batch-upsert rows.
     *
     * @return array{inserted: int, updated: int, errors: int}
     */
    private function parseAndUpsert(string $gzPath, string $build, int $logId): array
    {
        $fh = @gzopen($gzPath, 'rb');
        if ($fh === false) {
            throw new \RuntimeException("Cannot open gzip file: {$gzPath}");
        }

        $inserted = 0;
        $updated  = 0;
        $errors   = 0;
        $batch    = [];
        $syncedAt = now()->toDateTimeString();

        try {
            while (($line = gzgets($fh)) !== false) {
                $line = rtrim($line, "\r\n");

                if ($line === '' || str_starts_with($line, '#')) {
                    continue;
                }

                $fields = explode("\t", $line);
                if (count($fields) < 8) {
                    continue;
                }

                try {
                    $row = $this->parseVcfRow($fields, $build, $syncedAt);
                    if ($row === null) {
                        continue;
                    }
                    $batch[] = $row;
                } catch (\Throwable $e) {
                    $errors++;
                    continue;
                }

                if (count($batch) >= self::BATCH) {
                    [$ins, $upd] = $this->flushBatch($batch);
                    $inserted += $ins;
                    $updated  += $upd;
                    $batch    = [];

                    // Heartbeat for long-running syncs
                    ClinVarSyncLog::where('id', $logId)->update([
                        'variants_inserted' => $inserted,
                        'variants_updated'  => $updated,
                    ]);
                }
            }
        } finally {
            gzclose($fh);
        }

        if ($batch !== []) {
            [$ins, $upd] = $this->flushBatch($batch);
            $inserted += $ins;
            $updated  += $upd;
        }

        return ['inserted' => $inserted, 'updated' => $updated, 'errors' => $errors];
    }

    /**
     * Parse one VCF data line into a DB row array.
     *
     * ClinVar VCF columns: CHROM POS ID REF ALT QUAL FILTER INFO
     * Key INFO fields: CLNSIG, CLNDN, CLNREVSTAT, CLNHGVS, RS, GENEINFO
     *
     * @param string[] $fields
     * @return array<string, mixed>|null
     */
    private function parseVcfRow(array $fields, string $build, string $syncedAt): ?array
    {
        [$chrom, $pos, $vcfId, $ref, $alt] = $fields;

        // Skip multi-allelic entries (contain comma in ALT) — we only handle simple biallelic
        if (str_contains($alt, ',')) {
            return null;
        }

        $info = $this->parseInfo($fields[7] ?? '');

        $sig         = $this->normalizeSig($info['CLNSIG'] ?? null);
        $gene        = $this->parseGeneInfo($info['GENEINFO'] ?? null);
        $disease     = isset($info['CLNDN']) ? str_replace(['|', '_'], ['; ', ' '], $info['CLNDN']) : null;
        $revStatus   = isset($info['CLNREVSTAT']) ? str_replace(['_', ','], [' ', ', '], $info['CLNREVSTAT']) : null;
        $hgvs        = $info['CLNHGVS'] ?? null;
        $rsId        = isset($info['RS']) ? 'rs' . $info['RS'] : null;

        return [
            'variation_id'          => $vcfId !== '.' ? substr($vcfId, 0, 30) : null,
            'rs_id'                 => $rsId ? substr($rsId, 0, 30) : null,
            'chromosome'            => substr(ltrim($chrom, 'chr'), 0, 10),
            'position'              => (int) $pos,
            'reference_allele'      => substr($ref, 0, 500),
            'alternate_allele'      => substr($alt, 0, 500),
            'genome_build'          => $build,
            'gene_symbol'           => $gene ? substr($gene, 0, 100) : null,
            'hgvs'                  => $hgvs ? substr($hgvs, 0, 500) : null,
            'clinical_significance' => $sig ? substr($sig, 0, 200) : null,
            'disease_name'          => $disease,
            'review_status'         => $revStatus ? substr($revStatus, 0, 200) : null,
            'is_pathogenic'         => $this->isPathogenic($sig),
            'last_synced_at'        => $syncedAt,
            'created_at'            => $syncedAt,
            'updated_at'            => $syncedAt,
        ];
    }

    /** @param array<string, mixed>[] $batch @return array{0: int, 1: int} */
    private function flushBatch(array $batch): array
    {
        // Deduplicate within the batch — full ClinVar has multiple rows per coordinate
        // (different submitters). Keep the last (most pathogenic wins via sort order).
        $deduped = [];
        foreach ($batch as $row) {
            $key = $row['chromosome'] . ':' . $row['position'] . ':' . $row['reference_allele'] . ':' . $row['alternate_allele'];
            // Prefer pathogenic over non-pathogenic when deduplicating
            if (!isset($deduped[$key]) || $row['is_pathogenic']) {
                $deduped[$key] = $row;
            }
        }
        $batch = array_values($deduped);

        $keys = ['chromosome', 'position', 'reference_allele', 'alternate_allele', 'genome_build'];
        $update = [
            'variation_id', 'rs_id', 'gene_symbol', 'hgvs',
            'clinical_significance', 'disease_name', 'review_status',
            'is_pathogenic', 'last_synced_at', 'updated_at',
        ];

        $before = ClinVarVariant::count();
        ClinVarVariant::upsert($batch, $keys, $update);
        $after = ClinVarVariant::count();

        $inserted = max(0, $after - $before);
        $updated  = count($batch) - $inserted;

        return [$inserted, max(0, $updated)];
    }

    /** @return array<string, string> */
    private function parseInfo(string $infoStr): array
    {
        $info = [];
        foreach (explode(';', $infoStr) as $part) {
            if (str_contains($part, '=')) {
                [$k, $v] = explode('=', $part, 2);
                $info[trim($k)] = trim($v);
            }
        }
        return $info;
    }

    private function parseGeneInfo(?string $geneinfo): ?string
    {
        if ($geneinfo === null || $geneinfo === '') {
            return null;
        }
        // Format: GENENAME:gene_id|GENENAME2:gene_id2
        $first = explode('|', $geneinfo)[0];
        return explode(':', $first)[0];
    }

    private function normalizeSig(?string $sig): ?string
    {
        if ($sig === null || $sig === '') {
            return null;
        }
        // ClinVar uses underscores for spaces and pipes for multiple values
        $sig = str_replace('_', ' ', $sig);
        // Take most severe if multiple conflict
        return explode('|', $sig)[0];
    }

    private function isPathogenic(?string $sig): bool
    {
        if ($sig === null) {
            return false;
        }
        $lower = strtolower($sig);
        return str_contains($lower, 'pathogenic') && !str_contains($lower, 'conflicting');
    }
}
