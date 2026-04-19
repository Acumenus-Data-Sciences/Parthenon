<?php

declare(strict_types=1);

use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;

/**
 * Phase 17 GENOMICS-06 SC-1 — end-to-end idempotency contract.
 *
 *   php artisan parthenon:load-pgs-catalog --score-id=PGS000001 --fixture=...
 *
 * When invoked twice with the same fixture, the command MUST exit 0 both times
 * and produce exactly 1 row in vocab.pgs_scores + N rows in vocab.pgs_score_variants
 * (N = 5 for the stub fixture). Zero duplicate-key errors, zero silent drops.
 *
 * Does NOT use RefreshDatabase — per GwasDispatchTest.php, RefreshDatabase
 * collides with Phase 13.1's isolate_finngen_schema ALTER TABLE...SET SCHEMA.
 * Clean up via manual delete in beforeEach/afterEach against the sentinel id.
 */
beforeEach(function (): void {
    $this->scoreId = 'PGS000001';
    $this->fixturePath = base_path('tests/Fixtures/pgs/PGS000001_hmPOS_GRCh38_stub.txt.gz');
    expect(is_file($this->fixturePath))->toBeTrue(
        "Fixture missing: {$this->fixturePath}"
    );

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

it('loads PGS000001 idempotently from the fixture (exit 0 twice, same row count)', function (): void {
    $exit1 = Artisan::call('parthenon:load-pgs-catalog', [
        '--score-id' => $this->scoreId,
        '--fixture' => $this->fixturePath,
    ]);
    expect($exit1)->toBe(0);

    $scoreCount1 = DB::connection('omop')->table('vocab.pgs_scores')
        ->where('score_id', $this->scoreId)->count();
    $variantCount1 = DB::connection('omop')->table('vocab.pgs_score_variants')
        ->where('score_id', $this->scoreId)->count();

    expect($scoreCount1)->toBe(1);
    expect($variantCount1)->toBe(5);  // fixture has 5 variants

    // Second run — must also exit 0 and leave counts unchanged.
    $exit2 = Artisan::call('parthenon:load-pgs-catalog', [
        '--score-id' => $this->scoreId,
        '--fixture' => $this->fixturePath,
    ]);
    expect($exit2)->toBe(0);

    $scoreCount2 = DB::connection('omop')->table('vocab.pgs_scores')
        ->where('score_id', $this->scoreId)->count();
    $variantCount2 = DB::connection('omop')->table('vocab.pgs_score_variants')
        ->where('score_id', $this->scoreId)->count();

    expect($scoreCount2)->toBe(1);
    expect($variantCount2)->toBe(5);
});

it('refreshes loaded_at on re-run (metadata upsert contract)', function (): void {
    Artisan::call('parthenon:load-pgs-catalog', [
        '--score-id' => $this->scoreId,
        '--fixture' => $this->fixturePath,
    ]);
    $first = DB::connection('omop')->table('vocab.pgs_scores')
        ->where('score_id', $this->scoreId)->value('loaded_at');
    expect($first)->not->toBeNull();

    sleep(1);

    Artisan::call('parthenon:load-pgs-catalog', [
        '--score-id' => $this->scoreId,
        '--fixture' => $this->fixturePath,
    ]);
    $second = DB::connection('omop')->table('vocab.pgs_scores')
        ->where('score_id', $this->scoreId)->value('loaded_at');
    expect($second)->not->toBeNull();

    expect(strtotime((string) $second))
        ->toBeGreaterThan(strtotime((string) $first));
});

it('populates header metadata into vocab.pgs_scores from the ## comments', function (): void {
    Artisan::call('parthenon:load-pgs-catalog', [
        '--score-id' => $this->scoreId,
        '--fixture' => $this->fixturePath,
    ]);

    $row = DB::connection('omop')->table('vocab.pgs_scores')
        ->where('score_id', $this->scoreId)->first();

    expect($row)->not->toBeNull();
    expect($row->pgs_name)->toBe('PRS77_BC');
    expect($row->trait_reported)->toBe('Breast Cancer');
    expect($row->variants_number)->toBe(5);
    expect($row->genome_build)->toBe('GRCh38');  // HmPOS_build wins over genome_build
});

it('rejects an invalid --score-id with exit code INVALID', function (): void {
    $exit = Artisan::call('parthenon:load-pgs-catalog', [
        '--score-id' => 'NOT_PGS',
        '--fixture' => $this->fixturePath,
    ]);
    // Illuminate\Console\Command::INVALID === 2
    expect($exit)->toBe(2);
});

it('returns INVALID when --score-id is missing', function (): void {
    $exit = Artisan::call('parthenon:load-pgs-catalog', []);
    expect($exit)->toBe(2);
});

it('fails cleanly when --fixture path does not exist', function (): void {
    $exit = Artisan::call('parthenon:load-pgs-catalog', [
        '--score-id' => $this->scoreId,
        '--fixture' => '/nonexistent/path.txt.gz',
    ]);
    // Command::FAILURE === 1
    expect($exit)->toBe(1);
});
