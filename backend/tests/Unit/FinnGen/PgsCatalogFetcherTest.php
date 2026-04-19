<?php

declare(strict_types=1);

use App\Services\FinnGen\PgsCatalogFetcher;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/**
 * Phase 17 GENOMICS-06 — offline unit tests for PgsCatalogFetcher.
 *
 * All DB-free + network-free. The harmonized GRCh38 fixture lives at
 * backend/tests/Fixtures/pgs/PGS000001_hmPOS_GRCh38_stub.txt.gz (5 variants,
 * real PGS000001 header format).
 *
 * Extends TestCase so Http::fake() has the facade bindings it needs;
 * tests/Pest.php only auto-extends a few Unit subdirs, not Unit/FinnGen.
 */
uses(TestCase::class);

beforeEach(function (): void {
    $this->fetcher = new PgsCatalogFetcher;
    $this->fixturePath = __DIR__.'/../../Fixtures/pgs/PGS000001_hmPOS_GRCh38_stub.txt.gz';
    expect(is_file($this->fixturePath))->toBeTrue(
        'PGS fixture missing at '.$this->fixturePath
    );
});

it('parses the ## metadata header from the harmonized fixture', function (): void {
    $parsed = $this->fetcher->parseGzip($this->fixturePath);

    expect($parsed['header_meta'])->toMatchArray([
        'pgs_id' => 'PGS000001',
        'pgs_name' => 'PRS77_BC',
        'trait_reported' => 'Breast Cancer',
        'genome_build' => 'GRCh37',
        'HmPOS_build' => 'GRCh38',
        'variants_number' => '5',
    ]);
    expect($parsed['columns'])->toContain('rsID', 'hm_chr', 'hm_pos', 'hm_rsID');
});

it('parses variant rows with harmonized hm_* columns taking precedence', function (): void {
    $parsed = $this->fetcher->parseGzip($this->fixturePath);

    expect($parsed['variants'])->toHaveCount(5);

    // First row: rs3757318 chr6 hm_pos=151520328 (differs from chr_position=151948366)
    $first = $parsed['variants'][0];
    expect($first['rsid'])->toBe('rs3757318');
    expect($first['chrom'])->toBe('6');
    expect($first['pos_grch38'])->toBe(151520328);   // hm_pos wins
    expect($first['pos_grch37'])->toBe(151948366);   // chr_position preserved
    expect($first['effect_allele'])->toBe('T');
    expect($first['other_allele'])->toBe('C');
    expect($first['effect_weight'])->toBe(0.05853);

    // rs889312 is the case where hm_pos == chr_position (identity mapping).
    $third = $parsed['variants'][2];
    expect($third['rsid'])->toBe('rs889312');
    expect($third['pos_grch38'])->toBe(56067641);
    expect($third['pos_grch37'])->toBe(56067641);
});

it('rejects non-PGS score_id values via validateScoreId', function (): void {
    expect(fn () => $this->fetcher->validateScoreId('BAD'))
        ->toThrow(InvalidArgumentException::class);

    expect(fn () => $this->fetcher->validateScoreId('PGS123'))
        ->toThrow(InvalidArgumentException::class);  // needs 6+ digits

    // Valid cases should not throw.
    $this->fetcher->validateScoreId('PGS000001');
    $this->fetcher->validateScoreId('PGS1234567');
    expect(true)->toBeTrue();  // sanity marker — no exception above
});

it('fetchMetadata returns harmonized + primary URLs from the REST response', function (): void {
    Http::fake([
        'www.pgscatalog.org/rest/score/PGS000001/' => Http::response([
            'id' => 'PGS000001',
            'name' => 'PRS77_BC',
            'trait_reported' => 'Breast Cancer',
            'trait_efo' => [['id' => 'EFO_0000305']],
            'variants_number' => 77,
            'variants_genomebuild' => 'GRCh37',
            'publication' => ['doi' => '10.1371/journal.pgen.1007329'],
            'license' => 'Creative Commons',
            'ftp_scoring_file' => 'https://ftp.ebi.ac.uk/pub/databases/spot/pgs/scores/PGS000001/ScoringFiles/PGS000001.txt.gz',
            'ftp_harmonized_scoring_files' => [
                'GRCh38' => [
                    'positions' => 'https://ftp.ebi.ac.uk/pub/databases/spot/pgs/scores/PGS000001/ScoringFiles/Harmonized/PGS000001_hmPOS_GRCh38.txt.gz',
                ],
            ],
            'ancestry_distribution' => ['EUR' => 45000],
        ], 200),
    ]);

    $result = $this->fetcher->fetchMetadata('PGS000001');

    expect($result['meta']['id'])->toBe('PGS000001');
    expect($result['harmonized_url'])->toContain('hmPOS_GRCh38.txt.gz');
    expect($result['primary_url'])->toContain('PGS000001.txt.gz');
});

it('downloadToTemp refuses non-HTTPS URLs', function (): void {
    expect(fn () => $this->fetcher->downloadToTemp('http://insecure.example/pgs.gz'))
        ->toThrow(InvalidArgumentException::class);
    expect(fn () => $this->fetcher->downloadToTemp('ftp://ftp.ebi.ac.uk/foo'))
        ->toThrow(InvalidArgumentException::class);
});

it('handles a primary-only (non-harmonized) file where hm_* columns are missing', function (): void {
    // Construct a second fixture in-memory: same data but with the hm_* columns
    // stripped. Verifies Pitfall 7 fallback behavior.
    $txt = "##format_version=2.0\n".
        "##pgs_id=PGS999999\n".
        "##genome_build=GRCh37\n".
        "rsID\tchr_name\tchr_position\teffect_allele\tother_allele\teffect_weight\n".
        "rs111\t1\t1000\tA\tG\t0.1\n".
        "rs222\t2\t2000\tC\tT\t0.2\n";
    $path = tempnam(sys_get_temp_dir(), 'pgs_primary_').'.txt.gz';
    file_put_contents($path, gzencode($txt));

    try {
        $parsed = $this->fetcher->parseGzip($path);
        expect($parsed['header_meta']['pgs_id'])->toBe('PGS999999');
        expect($parsed['variants'])->toHaveCount(2);

        $first = $parsed['variants'][0];
        expect($first['rsid'])->toBe('rs111');
        expect($first['chrom'])->toBe('1');
        // hm_pos missing → falls back to chr_position for BOTH GRCh38 and GRCh37 keys
        // (schema requires NOT NULL pos_grch38).
        expect($first['pos_grch38'])->toBe(1000);
        expect($first['pos_grch37'])->toBe(1000);
    } finally {
        @unlink($path);
    }
});
