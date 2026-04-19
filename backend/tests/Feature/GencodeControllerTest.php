<?php

declare(strict_types=1);

use App\Models\User;
use App\Services\FinnGen\GencodeService;
use Database\Seeders\Testing\FinnGenTestingSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;

/**
 * Phase 16-02 — GencodeController HTTP contract coverage.
 *
 * Exercises `GET /api/v1/gencode/genes?chrom=&start=&end=`:
 *   - requires auth + cohorts.view permission (D-16)
 *   - chrom regex whitelist
 *   - returns GENCODE gene rows overlapping the window
 *   - pseudogene filter default-off; include_pseudogenes=1 flips
 *
 * Test fixture: writes a minimal TSV with 2 rows (1 protein-coding +
 * 1 pseudogene) to `storage/app/private/gencode/genes-v46.tsv` in
 * beforeEach, cleans it up in afterEach, resets GencodeService's
 * static memoization to force a fresh load.
 */
uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(FinnGenTestingSeeder::class);
    $this->researcher = User::where('email', 'finngen-test-researcher@test.local')->firstOrFail();
    $this->viewer = User::where('email', 'finngen-test-viewer@test.local')->firstOrFail();

    $dir = storage_path('app/private/gencode');
    if (! is_dir($dir)) {
        mkdir($dir, 0o775, true);
    }
    $this->tsvPath = $dir.'/genes-v46.tsv';
    $this->tsvBackup = is_file($this->tsvPath) ? file_get_contents($this->tsvPath) : null;

    // Minimal 3-row fixture:
    // - TP53 (protein_coding) on chr17: 7_668_421–7_687_490
    // - PSEUDO1 (pseudogene)  on chr17: 7_000_000–7_001_000
    // - BRCA1 (protein_coding) on chr17: 43_044_295–43_125_483
    file_put_contents(
        $this->tsvPath,
        "TP53\t17\t7668421\t7687490\t+\tprotein_coding\n"
        ."PSEUDO1\t17\t7000000\t7001000\t-\tpseudogene\n"
        ."BRCA1\t17\t43044295\t43125483\t-\tprotein_coding\n"
    );

    GencodeService::resetCache();
    Cache::flush();
});

afterEach(function () {
    if ($this->tsvBackup !== null) {
        file_put_contents($this->tsvPath, $this->tsvBackup);
    } else {
        @unlink($this->tsvPath);
    }
    GencodeService::resetCache();
});

it('returns 401 for unauthenticated', function () {
    $this->getJson('/api/v1/gencode/genes?chrom=17&start=7000000&end=8000000')
        ->assertStatus(401);
});

it('returns 200 for viewer (has cohorts.view)', function () {
    $this->actingAs($this->viewer)
        ->getJson('/api/v1/gencode/genes?chrom=17&start=7000000&end=8000000')
        ->assertOk();
});

it('rejects chrom="chr17" (with chr prefix) with 422', function () {
    $this->actingAs($this->researcher)
        ->getJson('/api/v1/gencode/genes?chrom=chr17&start=1&end=1000')
        ->assertStatus(422);
});

it('returns genes in range — default excludes pseudogenes', function () {
    $resp = $this->actingAs($this->researcher)
        ->getJson('/api/v1/gencode/genes?chrom=17&start=7000000&end=8000000');

    $resp->assertOk();
    $names = collect($resp->json('genes'))->pluck('gene_name')->all();
    expect($names)->toContain('TP53');
    expect($names)->not->toContain('PSEUDO1');
});

it('returns pseudogenes when include_pseudogenes=1', function () {
    $resp = $this->actingAs($this->researcher)
        ->getJson('/api/v1/gencode/genes?chrom=17&start=7000000&end=8000000&include_pseudogenes=1');

    $resp->assertOk();
    $names = collect($resp->json('genes'))->pluck('gene_name')->all();
    expect($names)->toContain('TP53');
    expect($names)->toContain('PSEUDO1');
});

it('returns empty array when no gene overlaps', function () {
    $resp = $this->actingAs($this->researcher)
        ->getJson('/api/v1/gencode/genes?chrom=1&start=1&end=1000');

    $resp->assertOk();
    expect($resp->json('genes'))->toBeArray()->toBeEmpty();
});

it('rejects window > 5 Mb with 422', function () {
    $this->actingAs($this->researcher)
        ->getJson('/api/v1/gencode/genes?chrom=17&start=1&end=10000000')
        ->assertStatus(422);
});
