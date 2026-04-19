<?php

declare(strict_types=1);

use App\Services\FinnGen\PgsScoreIngester;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Phase 17 GENOMICS-06 — PgsScoreIngester idempotency tests.
 *
 * Uses a unique sentinel score_id per test; cleans up in beforeEach/afterEach
 * to avoid RefreshDatabase (which trips on the Phase 13.1 isolate_finngen_schema
 * migration's ALTER TABLE...SET SCHEMA on replay — see GwasDispatchTest.php).
 */
uses(TestCase::class);

beforeEach(function (): void {
    $this->ingester = new PgsScoreIngester;
    $this->scoreId = 'PGS999001';  // sentinel — outside real PGS Catalog range
    DB::connection('omop')->table('vocab.pgs_score_variants')
        ->where('score_id', $this->scoreId)->delete();
    DB::connection('omop')->table('vocab.pgs_scores')
        ->where('score_id', $this->scoreId)->delete();
});

afterEach(function (): void {
    DB::connection('omop')->table('vocab.pgs_score_variants')
        ->where('score_id', $this->scoreId)->delete();
    DB::connection('omop')->table('vocab.pgs_scores')
        ->where('score_id', $this->scoreId)->delete();
});

it('upsertScore writes one row and refreshes loaded_at on re-run', function (): void {
    $meta = [
        'score_id' => $this->scoreId,
        'pgs_name' => 'INGESTER_TEST_1',
        'trait_reported' => 'Test trait',
        'variants_number' => 5,
        'genome_build' => 'GRCh38',
    ];

    $row1 = $this->ingester->upsertScore($meta);
    $loaded1 = $row1->loaded_at;
    expect($row1->score_id)->toBe($this->scoreId);
    expect($row1->pgs_name)->toBe('INGESTER_TEST_1');

    // Sleep 1 second so the refreshed loaded_at is observably different.
    sleep(1);

    $row2 = $this->ingester->upsertScore($meta);

    // Exactly one row total after two upserts.
    $count = DB::connection('omop')->table('vocab.pgs_scores')
        ->where('score_id', $this->scoreId)->count();
    expect($count)->toBe(1);

    // loaded_at advanced.
    expect($row2->loaded_at->greaterThan($loaded1))->toBeTrue(
        "loaded_at should refresh on re-run: first={$loaded1}, second={$row2->loaded_at}"
    );
});

it('upsertVariants inserts the full batch on first run then 0 duplicates on re-run', function (): void {
    // First insert parent score row to satisfy the FK.
    $this->ingester->upsertScore(['score_id' => $this->scoreId]);

    $variants = [
        [
            'rsid' => 'rs1', 'chrom' => '1', 'pos_grch38' => 100, 'pos_grch37' => 100,
            'effect_allele' => 'A', 'other_allele' => 'G', 'effect_weight' => 0.1,
            'frequency_effect_allele' => null, 'allele_frequency' => null,
        ],
        [
            'rsid' => 'rs2', 'chrom' => '2', 'pos_grch38' => 200, 'pos_grch37' => 200,
            'effect_allele' => 'C', 'other_allele' => 'T', 'effect_weight' => 0.2,
            'frequency_effect_allele' => null, 'allele_frequency' => null,
        ],
        [
            'rsid' => null, 'chrom' => '3', 'pos_grch38' => 300, 'pos_grch37' => 300,
            'effect_allele' => 'G', 'other_allele' => 'C', 'effect_weight' => -0.05,
            'frequency_effect_allele' => null, 'allele_frequency' => null,
        ],
    ];

    $r1 = $this->ingester->upsertVariants($this->scoreId, $variants);
    expect($r1['inserted'])->toBe(3);
    expect($r1['skipped_duplicate'])->toBe(0);
    expect($r1['missing_rsid'])->toBe(1);

    $r2 = $this->ingester->upsertVariants($this->scoreId, $variants);
    // Composite PK blocks all 3 inserts → inserted=0, skipped=3.
    expect($r2['inserted'])->toBe(0);
    expect($r2['skipped_duplicate'])->toBe(3);

    $count = DB::connection('omop')->table('vocab.pgs_score_variants')
        ->where('score_id', $this->scoreId)->count();
    expect($count)->toBe(3);
});

it('upsertVariants batches writes in chunks of BATCH_SIZE (verifies total row count on 2500 variants)', function (): void {
    $this->ingester->upsertScore(['score_id' => $this->scoreId]);

    // Build 2500 unique variants — same chrom+allele, varying pos → unique composite PK.
    $variants = [];
    for ($i = 1; $i <= 2500; $i++) {
        $variants[] = [
            'rsid' => "rs{$i}", 'chrom' => '1', 'pos_grch38' => $i, 'pos_grch37' => $i,
            'effect_allele' => 'A', 'other_allele' => 'G', 'effect_weight' => 0.001 * $i,
            'frequency_effect_allele' => null, 'allele_frequency' => null,
        ];
    }

    $r = $this->ingester->upsertVariants($this->scoreId, $variants);
    expect($r['inserted'])->toBe(2500);
    expect($r['skipped_duplicate'])->toBe(0);

    $count = DB::connection('omop')->table('vocab.pgs_score_variants')
        ->where('score_id', $this->scoreId)->count();
    expect($count)->toBe(2500);
});

it('upsertVariants is a no-op on empty input', function (): void {
    $r = $this->ingester->upsertVariants($this->scoreId, []);
    expect($r)->toMatchArray([
        'inserted' => 0,
        'skipped_duplicate' => 0,
        'missing_rsid' => 0,
    ]);
});
