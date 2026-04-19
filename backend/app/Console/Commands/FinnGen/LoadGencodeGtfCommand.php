<?php

declare(strict_types=1);

namespace App\Console\Commands\FinnGen;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;
use RuntimeException;

/**
 * Phase 16-01 — GENCODE v46 basic annotation GFF3 ingester.
 *
 *   php artisan parthenon:load-gencode-gtf
 *   php artisan parthenon:load-gencode-gtf --force
 *   php artisan parthenon:load-gencode-gtf --file=storage/app/private/fixtures/gencode-small.gff3.gz
 *
 * Pipeline
 * --------
 *  1. Resolve source GFF3.gz path:
 *       a. --file override (SSRF-clamped under storage_path()), OR
 *       b. HTTPS GET the hard-coded ftp.ebi.ac.uk URL to a tempfile.
 *  2. Size guard: reject anything > 100 MB (D-29, threat T-16-S3) BEFORE
 *     gunzip.
 *  3. Stream via gzopen/gzgets, filter to `feature=gene` rows, parse
 *     gene_name + gene_type from GFF3 attributes.
 *  4. Normalize chromosome: strip "chr" prefix, map "M" → "MT" (Pitfall 1,
 *     D-22) so rows match summary_stats.chrom.
 *  5. Write a sorted TSV to storage/app/private/gencode/genes-v46.tsv via
 *     atomic ".tmp → rename".
 *
 * Idempotency
 * -----------
 * Without --force, the command exits SUCCESS without work if the TSV exists
 * and is younger than MAX_AGE_DAYS. --force overwrites unconditionally.
 *
 * Security (HIGHSEC §5, threat T-16-S6)
 * ------------------------------------
 * - URL is a hard-coded class constant. There is NO --url flag. SSRF cannot
 *   be introduced via CLI argument.
 * - --file is clamped with realpath() under storage_path() so a caller
 *   cannot point the command at /etc/passwd or any other host file.
 *
 * Auth posture
 * ------------
 * CLI-only (no route surface). HTTPS-only fetch to ftp.ebi.ac.uk. The
 * binary runs as whatever user invoked it (typically parthenon_migrator
 * via deploy.sh or a developer via `docker compose exec php`).
 */
final class LoadGencodeGtfCommand extends Command
{
    /** @var string */
    protected $signature = 'parthenon:load-gencode-gtf
        {--force : Re-download and re-parse even if the TSV already exists}
        {--file= : Local GFF3.gz path under storage/ (testing/dev override; bypasses the hardcoded URL)}';

    /** @var string */
    protected $description = 'Ingest GENCODE v46 basic annotation GFF3 → storage/app/private/gencode/genes-v46.tsv';

    /**
     * Hard-coded GENCODE v46 GFF3 URL. Matches D-07 + D-26.
     * Changing this to anything other than ftp.ebi.ac.uk is an HIGHSEC
     * §5 violation — modify only with explicit architectural review.
     */
    private const URL = 'https://ftp.ebi.ac.uk/pub/databases/gencode/Gencode_human/release_46/gencode.v46.basic.annotation.gff3.gz';

    /** 100 MB — D-29 / threat T-16-S3 size guard applied BEFORE gunzip. */
    private const MAX_BYTES = 100 * 1024 * 1024;

    /** TSV relative to storage_path('app/private/'). */
    private const OUTPUT_TSV = 'gencode/genes-v46.tsv';

    /** Idempotency window in days. */
    private const MAX_AGE_DAYS = 30;

    public function handle(): int
    {
        $outputPath = storage_path('app/private/'.self::OUTPUT_TSV);

        if (! $this->option('force') && is_file($outputPath)) {
            $ageDays = (time() - (int) filemtime($outputPath)) / 86400.0;
            if ($ageDays < self::MAX_AGE_DAYS) {
                $this->info(sprintf(
                    'TSV exists (%s), age %.1fd < %dd. Use --force to overwrite.',
                    $outputPath,
                    $ageDays,
                    self::MAX_AGE_DAYS,
                ));

                return self::SUCCESS;
            }
        }

        $gzPath = $this->resolveSourcePath();
        try {
            $this->assertUnderSizeLimit($gzPath);
            $parsed = $this->writeTsv($gzPath, $outputPath);
        } finally {
            // Clean up the temp download (but never the --file argument).
            if ($this->option('file') === null) {
                @unlink($gzPath);
            }
        }

        $this->info("Wrote {$parsed} gene rows to {$outputPath}");

        return self::SUCCESS;
    }

    /**
     * Pick source path per --file vs hardcoded URL.
     *
     * --file is CLAMPED: realpath() must resolve under storage_path() (SSRF
     * guard T-16-S6). Any attempt to escape via relative or symlink paths
     * yields a RuntimeException naming "SSRF guard".
     */
    private function resolveSourcePath(): string
    {
        $localFile = $this->option('file');
        if ($localFile !== null) {
            $real = realpath((string) $localFile);
            if ($real === false) {
                throw new RuntimeException("--file not found: {$localFile}");
            }
            $allowedRoot = realpath(storage_path()) ?: storage_path();
            if (! str_starts_with($real, $allowedRoot)) {
                throw new RuntimeException(
                    '--file must live under storage_path() (SSRF guard T-16-S6): '.$real
                );
            }

            return $real;
        }

        $this->info('Downloading GENCODE v46 GFF3 from '.self::URL);
        $tmp = tempnam(sys_get_temp_dir(), 'gencode_');
        if ($tmp === false) {
            throw new RuntimeException('tempnam() failed');
        }
        $resp = Http::timeout(600)
            ->withOptions(['sink' => $tmp, 'verify' => true])
            ->get(self::URL);
        if (! $resp->successful()) {
            @unlink($tmp);
            throw new RuntimeException('GENCODE fetch failed: HTTP '.$resp->status());
        }

        return $tmp;
    }

    /**
     * D-29 size guard — reject anything larger than 100 MB before we spend
     * CPU on gunzip. Threat T-16-S3 DoS mitigation.
     */
    private function assertUnderSizeLimit(string $gzPath): void
    {
        $size = filesize($gzPath);
        if ($size === false) {
            throw new RuntimeException("Cannot stat: {$gzPath}");
        }
        if ($size > self::MAX_BYTES) {
            throw new RuntimeException(sprintf(
                'GFF3 exceeds %d-byte D-29 limit (got %d bytes)',
                self::MAX_BYTES,
                $size,
            ));
        }
    }

    /**
     * Stream-parse the GFF3.gz into the TSV via a ".tmp → rename" atomic
     * swap so partial writes cannot corrupt a previous good file.
     */
    private function writeTsv(string $gzPath, string $outputPath): int
    {
        @mkdir(dirname($outputPath), 0o755, recursive: true);
        $tmp = $outputPath.'.tmp';
        $out = fopen($tmp, 'wb');
        if ($out === false) {
            throw new RuntimeException("Cannot open TSV for write: {$tmp}");
        }

        $fh = @gzopen($gzPath, 'rb');
        if ($fh === false) {
            fclose($out);
            @unlink($tmp);
            throw new RuntimeException("Cannot gzopen: {$gzPath}");
        }

        $parsed = 0;
        try {
            while (($line = gzgets($fh)) !== false) {
                if ($line === '' || $line[0] === '#') {
                    continue;
                }
                $cols = explode("\t", rtrim($line, "\r\n"));
                // GFF3 columns: seqid, source, type, start, end, score,
                // strand, phase, attributes (9 fields total).
                if (count($cols) < 9) {
                    continue;
                }
                if ($cols[2] !== 'gene') {
                    continue;
                }

                $name = $this->parseAttr($cols[8], 'gene_name');
                if ($name === null) {
                    continue;
                }
                $type = $this->parseAttr($cols[8], 'gene_type') ?? '';

                // Pitfall 1 — normalize to summary_stats convention:
                //   "chr17" → "17", "chrM" → "MT", "chrX" → "X".
                $chrom = ltrim($cols[0], 'chr');
                if ($chrom === 'M') {
                    $chrom = 'MT';
                }

                fwrite($out, implode("\t", [
                    $name,
                    $chrom,
                    $cols[3],
                    $cols[4],
                    $cols[6],
                    $type,
                ])."\n");
                $parsed++;
            }
        } finally {
            gzclose($fh);
            fclose($out);
        }

        if (! rename($tmp, $outputPath)) {
            @unlink($tmp);
            throw new RuntimeException("Atomic rename failed: {$tmp} → {$outputPath}");
        }

        return $parsed;
    }

    /**
     * Extract a single attribute value from a GFF3 attributes column. GFF3
     * syntax is `key=val;key2=val2`. Returns null when the key is absent.
     */
    private function parseAttr(string $attrs, string $key): ?string
    {
        if (preg_match('/(?:^|;)\s*'.preg_quote($key, '/').'=([^;]+)/', $attrs, $m) === 1) {
            return trim($m[1]);
        }

        return null;
    }
}
