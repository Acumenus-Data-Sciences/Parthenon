<?php

declare(strict_types=1);

namespace App\Services\FinnGen;

use Illuminate\Support\Facades\Http;
use InvalidArgumentException;
use RuntimeException;
use Throwable;

/**
 * Phase 17 GENOMICS-06 — fetches a PGS Catalog score:
 *
 *   1. REST metadata from https://www.pgscatalog.org/rest/score/{id}/
 *   2. Streams the harmonized GRCh38 .txt.gz via Http::withOptions(['sink' => $tmp])
 *   3. Parses ## metadata header + TSV body, returning {header_meta, columns, variants}.
 *
 * Harmonized columns (hm_chr, hm_pos, hm_rsID) take precedence over primary
 * (chr_name, chr_position, rsID) per 17-RESEARCH.md §Pitfall 7. The fetcher
 * never interprets genotype data — it is purely an I/O layer. PgsScoreIngester
 * owns the DB upsert side.
 *
 * Security (HIGHSEC T-17-SSRF, T-17-S1, T-17-S4):
 *   - score_id is regex-validated BEFORE any URL construction.
 *   - downloadToTemp refuses non-HTTPS URLs (raises InvalidArgumentException).
 *   - MAX_GZ_BYTES = 100MB zip-bomb / DoS guard after sink completes.
 *   - parseGzip skips malformed rows rather than aborting (resilient to mid-file junk).
 */
final class PgsCatalogFetcher
{
    /** PGS Catalog score_id format: PGSxxxxxx (6+ digits). */
    private const SCORE_ID_REGEX = '/^PGS\d{6,}$/';

    private const REST_BASE = 'https://www.pgscatalog.org/rest/score/';

    /** T-17-S4 DoS guard — real PGS files are 100KB–5MB; 100MB is generous. */
    private const MAX_GZ_BYTES = 100 * 1024 * 1024;

    /** HTTP timeout in seconds for REST metadata. */
    private const METADATA_TIMEOUT = 30;

    /** HTTP timeout in seconds for file download. */
    private const DOWNLOAD_TIMEOUT = 600;

    public function validateScoreId(string $scoreId): void
    {
        if (preg_match(self::SCORE_ID_REGEX, $scoreId) !== 1) {
            throw new InvalidArgumentException(
                "Invalid PGS Catalog score_id: '{$scoreId}' (expected /^PGS\\d{6,}$/)."
            );
        }
    }

    /**
     * Fetch JSON metadata from PGS Catalog REST API.
     *
     * @return array{meta: array<string, mixed>, harmonized_url: string|null, primary_url: string}
     */
    public function fetchMetadata(string $scoreId): array
    {
        $this->validateScoreId($scoreId);

        $response = Http::timeout(self::METADATA_TIMEOUT)
            ->acceptJson()
            ->get(self::REST_BASE.$scoreId.'/')
            ->throw();

        $json = $response->json();
        if (! is_array($json)) {
            throw new RuntimeException(
                "PGS Catalog REST returned non-JSON payload for {$scoreId}."
            );
        }

        $harmonized = null;
        if (isset($json['ftp_harmonized_scoring_files']['GRCh38']['positions'])
            && is_string($json['ftp_harmonized_scoring_files']['GRCh38']['positions'])) {
            $harmonized = $json['ftp_harmonized_scoring_files']['GRCh38']['positions'];
        }

        if (! isset($json['ftp_scoring_file']) || ! is_string($json['ftp_scoring_file'])) {
            throw new RuntimeException(
                "PGS Catalog response missing ftp_scoring_file for {$scoreId}."
            );
        }
        $primary = $json['ftp_scoring_file'];

        return [
            'meta' => $json,
            'harmonized_url' => $harmonized,
            'primary_url' => $primary,
        ];
    }

    /**
     * Download a PGS Catalog .txt.gz to a temp file. Caller is responsible
     * for @unlink after parseGzip().
     */
    public function downloadToTemp(string $url): string
    {
        if (! str_starts_with($url, 'https://')) {
            throw new InvalidArgumentException("PGS download URL must be HTTPS: {$url}.");
        }

        $tmp = tempnam(sys_get_temp_dir(), 'pgs_');
        if ($tmp === false) {
            throw new RuntimeException('Unable to allocate temp file for PGS download.');
        }
        // tempnam returns a path with no extension; rename with .txt.gz for clarity.
        $target = $tmp.'.txt.gz';
        if (! rename($tmp, $target)) {
            @unlink($tmp);
            throw new RuntimeException("Unable to rename temp file to {$target}.");
        }

        try {
            $response = Http::timeout(self::DOWNLOAD_TIMEOUT)
                ->withOptions(['sink' => $target])
                ->get($url);
        } catch (Throwable $e) {
            @unlink($target);
            throw new RuntimeException(
                "PGS Catalog download failed for {$url}: ".$e->getMessage(),
                previous: $e,
            );
        }

        if ($response->failed()) {
            $status = $response->status();
            @unlink($target);
            throw new RuntimeException("PGS Catalog download failed: HTTP {$status} for {$url}.");
        }

        $size = filesize($target);
        if ($size === false || $size > self::MAX_GZ_BYTES) {
            @unlink($target);
            throw new RuntimeException(
                'PGS Catalog download exceeded 100MB cap (zip-bomb guard, T-17-S4).'
            );
        }

        return $target;
    }

    /**
     * Stream-parse a PGS Catalog .txt.gz. Returns header metadata and a list
     * of normalized variant rows with harmonized columns preferred.
     *
     * @return array{
     *   header_meta: array<string, string>,
     *   columns: list<string>,
     *   variants: list<array{
     *     rsid: string|null,
     *     chrom: string,
     *     pos_grch38: int,
     *     pos_grch37: int|null,
     *     effect_allele: string,
     *     other_allele: string|null,
     *     effect_weight: float,
     *     frequency_effect_allele: float|null,
     *     allele_frequency: float|null
     *   }>
     * }
     */
    public function parseGzip(string $gzPath): array
    {
        $fh = @gzopen($gzPath, 'rb');
        if ($fh === false) {
            throw new RuntimeException("Cannot open gzip: {$gzPath}.");
        }

        $headerMeta = [];
        $columns = [];
        $variants = [];

        try {
            // Pass 1: consume '##' header comment lines until the column header row.
            while (($line = gzgets($fh)) !== false) {
                $line = rtrim($line, "\r\n");
                if ($line === '') {
                    continue;
                }
                if (str_starts_with($line, '##')) {
                    $trimmed = substr($line, 2);
                    if (str_contains($trimmed, '=')) {
                        [$k, $v] = explode('=', $trimmed, 2);
                        $headerMeta[trim($k)] = trim($v);
                    }

                    continue;
                }
                // First non-## line is the column header row.
                $columns = explode("\t", $line);
                break;
            }

            if ($columns === []) {
                return ['header_meta' => $headerMeta, 'columns' => [], 'variants' => []];
            }

            // Pass 2: variant rows.
            while (($line = gzgets($fh)) !== false) {
                $line = rtrim($line, "\r\n");
                if ($line === '' || str_starts_with($line, '#')) {
                    continue;
                }
                $fields = explode("\t", $line);
                if (count($fields) !== count($columns)) {
                    continue; // skip malformed row defensively
                }
                /** @var array<string, string> $row */
                $row = array_combine($columns, $fields);

                $normalized = $this->normalizeVariantRow($row);
                if ($normalized === null) {
                    continue; // unmappable row
                }
                $variants[] = $normalized;
            }
        } finally {
            gzclose($fh);
        }

        return ['header_meta' => $headerMeta, 'columns' => $columns, 'variants' => $variants];
    }

    /**
     * Apply Pitfall 7 precedence rules: hm_* harmonized columns win over
     * primary. Returns null for rows we cannot land (missing chrom or both
     * positions).
     *
     * @param  array<string, string>  $row
     * @return array{
     *   rsid: string|null,
     *   chrom: string,
     *   pos_grch38: int,
     *   pos_grch37: int|null,
     *   effect_allele: string,
     *   other_allele: string|null,
     *   effect_weight: float,
     *   frequency_effect_allele: float|null,
     *   allele_frequency: float|null
     * }|null
     */
    private function normalizeVariantRow(array $row): ?array
    {
        $rsid = $row['hm_rsID'] ?? $row['rsID'] ?? null;
        $chrom = $row['hm_chr'] ?? $row['chr_name'] ?? null;

        $hmPos = $row['hm_pos'] ?? '';
        $primaryPos = $row['chr_position'] ?? '';
        $posGrch38 = ($hmPos !== '' && $hmPos !== '.') ? (int) $hmPos : null;
        $posGrch37 = ($primaryPos !== '' && $primaryPos !== '.') ? (int) $primaryPos : null;

        if ($chrom === null || $chrom === '' || $chrom === '.') {
            return null;
        }
        if ($posGrch38 === null && $posGrch37 === null) {
            return null;
        }

        $effectAllele = (string) ($row['effect_allele'] ?? '');
        if ($effectAllele === '') {
            return null;
        }

        $otherAllele = $row['other_allele'] ?? '';
        $freqEffect = $row['allelefrequency_effect'] ?? '';
        $alleleFreq = $row['allele_frequency'] ?? '';

        return [
            'rsid' => (is_string($rsid) && $rsid !== '' && $rsid !== '.') ? $rsid : null,
            'chrom' => (string) $chrom,
            // Schema requires NOT NULL pos_grch38; fall back to GRCh37 if harmonized missing.
            'pos_grch38' => $posGrch38 ?? (int) $posGrch37,
            'pos_grch37' => $posGrch37,
            'effect_allele' => $effectAllele,
            'other_allele' => $otherAllele !== '' ? (string) $otherAllele : null,
            'effect_weight' => (float) ($row['effect_weight'] ?? 0.0),
            'frequency_effect_allele' => $freqEffect !== '' ? (float) $freqEffect : null,
            'allele_frequency' => $alleleFreq !== '' ? (float) $alleleFreq : null,
        ];
    }
}
