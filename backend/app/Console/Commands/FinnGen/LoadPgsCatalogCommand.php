<?php

declare(strict_types=1);

namespace App\Console\Commands\FinnGen;

use App\Services\FinnGen\PgsCatalogFetcher;
use App\Services\FinnGen\PgsScoreIngester;
use Illuminate\Console\Command;
use InvalidArgumentException;
use Throwable;

/**
 * Phase 17 GENOMICS-06 — Artisan ingestion entry point.
 *
 *   php artisan parthenon:load-pgs-catalog --score-id=PGS000001
 *
 * Pipeline:
 *   1. validate score_id regex /^PGS\d{6,}$/ (T-17-S1, T-17-SSRF)
 *   2. GET https://www.pgscatalog.org/rest/score/{id}/ → {harmonized_url, primary_url}
 *   3. download harmonized GRCh38 .txt.gz (fall back to primary if absent)
 *   4. stream-parse ## header + TSV body via gzopen/gzgets
 *   5. upsert vocab.pgs_scores row (loaded_at refreshed each run)
 *   6. insertOrIgnore per-variant weights in batches of 1000 against
 *      the composite PK — idempotent on re-run
 *
 * --fixture=PATH is a test-only escape hatch that skips steps 2–3 and parses
 * a local .txt.gz instead. Used by LoadPgsCatalogCommandTest to assert
 * idempotency without hitting the network.
 *
 * Auth posture: command is CLI-only (no route surface, T-17-S3). HIGHSEC
 * permission seeding in Plan 01 created finngen.prs.compute for the dispatch
 * API; this Artisan runs as whatever shell invoked it (typically
 * parthenon_migrator via deploy.sh).
 */
final class LoadPgsCatalogCommand extends Command
{
    protected $signature = 'parthenon:load-pgs-catalog
        {--score-id= : PGS Catalog score_id, e.g. PGS000001}
        {--fixture= : Local .txt.gz path to parse instead of downloading (testing only)}';

    protected $description = 'Ingest a PGS Catalog score into vocab.pgs_scores + vocab.pgs_score_variants (Phase 17 GENOMICS-06).';

    public function __construct(
        private readonly PgsCatalogFetcher $fetcher,
        private readonly PgsScoreIngester $ingester,
    ) {
        parent::__construct();
    }

    public function handle(): int
    {
        $scoreId = (string) ($this->option('score-id') ?? '');
        if ($scoreId === '') {
            $this->error('Missing --score-id (e.g. --score-id=PGS000001)');

            return self::INVALID;
        }

        try {
            $this->fetcher->validateScoreId($scoreId);
        } catch (InvalidArgumentException $e) {
            $this->error($e->getMessage());

            return self::INVALID;
        }

        $fixturePath = (string) ($this->option('fixture') ?? '');
        $parsed = null;

        if ($fixturePath !== '') {
            if (! is_file($fixturePath)) {
                $this->error("Fixture not found: {$fixturePath}");

                return self::FAILURE;
            }
            $this->warn("Using local fixture: {$fixturePath} (no PGS Catalog REST fetch)");
            $parsed = $this->fetcher->parseGzip($fixturePath);
            $meta = $this->buildMetaFromFixture($scoreId, $parsed);
        } else {
            try {
                $this->info("Fetching PGS Catalog metadata for {$scoreId} ...");
                $fetchResult = $this->fetcher->fetchMetadata($scoreId);
                $downloadUrl = $fetchResult['harmonized_url'] ?? $fetchResult['primary_url'];
                if ($fetchResult['harmonized_url'] === null) {
                    $this->warn('GRCh38 harmonized file not available; falling back to primary scoring file.');
                }
                $this->info("Downloading weights file from: {$downloadUrl}");
                $tmp = $this->fetcher->downloadToTemp($downloadUrl);
                try {
                    $parsed = $this->fetcher->parseGzip($tmp);
                } finally {
                    @unlink($tmp);
                }
                $meta = $this->buildMetaFromRest($scoreId, $fetchResult, $parsed);
            } catch (Throwable $e) {
                $this->error('PGS Catalog fetch failed: '.$e->getMessage());

                return self::FAILURE;
            }
        }

        $this->ingester->upsertScore($meta);
        $this->info("Upserted vocab.pgs_scores for {$scoreId}");

        $result = $this->ingester->upsertVariants($scoreId, $parsed['variants']);
        $this->info(sprintf(
            'Inserted %d new variants (skipped %d duplicates) into vocab.pgs_score_variants.',
            $result['inserted'],
            $result['skipped_duplicate'],
        ));
        if ($result['missing_rsid'] > 0) {
            $this->warn(sprintf(
                '%d variants missing rsid (will match by chr:pos:ref:alt at PRS compute time per Pitfall 8).',
                $result['missing_rsid'],
            ));
        }

        return self::SUCCESS;
    }

    /**
     * Build the pgs_scores meta payload when running against a local fixture
     * (no REST call). We only have the file header to work from, so fields
     * like trait_efo_ids, publication_doi, license, and ancestry_distribution
     * are left null.
     *
     * @param  array{header_meta: array<string, string>, columns: list<string>, variants: list<array<string, mixed>>}  $parsed
     * @return array{
     *   score_id: string,
     *   pgs_name: string|null,
     *   trait_reported: string|null,
     *   variants_number: int|null,
     *   genome_build: string|null,
     *   harmonized_file_url: string|null,
     *   weights_file_url: string|null
     * }
     */
    private function buildMetaFromFixture(string $scoreId, array $parsed): array
    {
        $headerMeta = $parsed['header_meta'];

        return [
            'score_id' => $scoreId,
            'pgs_name' => $headerMeta['pgs_name'] ?? null,
            'trait_reported' => $headerMeta['trait_reported'] ?? null,
            'variants_number' => isset($headerMeta['variants_number'])
                ? (int) $headerMeta['variants_number']
                : null,
            'genome_build' => $headerMeta['HmPOS_build'] ?? $headerMeta['genome_build'] ?? null,
            'harmonized_file_url' => null,
            'weights_file_url' => null,
        ];
    }

    /**
     * Build the pgs_scores meta payload from the REST JSON response plus the
     * parsed file header (genome_build sourced from file when possible).
     *
     * @param  array{meta: array<string, mixed>, harmonized_url: string|null, primary_url: string}  $fetchResult
     * @param  array{header_meta: array<string, string>, columns: list<string>, variants: list<array<string, mixed>>}  $parsed
     * @return array{
     *   score_id: string,
     *   pgs_name: string|null,
     *   trait_reported: string|null,
     *   trait_efo_ids: list<string>,
     *   variants_number: int,
     *   ancestry_distribution: array<string, mixed>,
     *   publication_doi: string|null,
     *   license: string|null,
     *   weights_file_url: string,
     *   harmonized_file_url: string|null,
     *   genome_build: string
     * }
     */
    private function buildMetaFromRest(string $scoreId, array $fetchResult, array $parsed): array
    {
        $remote = $fetchResult['meta'];

        $traitEfoIds = [];
        if (isset($remote['trait_efo']) && is_array($remote['trait_efo'])) {
            foreach ($remote['trait_efo'] as $efo) {
                if (is_array($efo) && isset($efo['id']) && is_string($efo['id'])) {
                    $traitEfoIds[] = $efo['id'];
                }
            }
        }

        $pgsName = (isset($remote['name']) && is_string($remote['name'])) ? $remote['name'] : null;
        $traitReported = (isset($remote['trait_reported']) && is_string($remote['trait_reported']))
            ? $remote['trait_reported']
            : null;
        $license = (isset($remote['license']) && is_string($remote['license']))
            ? $remote['license']
            : null;
        $doi = null;
        if (isset($remote['publication']['doi']) && is_string($remote['publication']['doi'])) {
            $doi = $remote['publication']['doi'];
        }
        $ancestry = (isset($remote['ancestry_distribution']) && is_array($remote['ancestry_distribution']))
            ? $remote['ancestry_distribution']
            : [];

        return [
            'score_id' => $scoreId,
            'pgs_name' => $pgsName,
            'trait_reported' => $traitReported,
            'trait_efo_ids' => $traitEfoIds,
            'variants_number' => (int) ($remote['variants_number'] ?? 0),
            'ancestry_distribution' => $ancestry,
            'publication_doi' => $doi,
            'license' => $license,
            'weights_file_url' => $fetchResult['primary_url'],
            'harmonized_file_url' => $fetchResult['harmonized_url'],
            'genome_build' => $parsed['header_meta']['HmPOS_build']
                ?? $parsed['header_meta']['genome_build']
                ?? 'GRCh38',
        ];
    }
}
