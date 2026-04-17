<?php

declare(strict_types=1);

use App\Services\FinnGen\FinnGenConceptResolver;
use Illuminate\Support\Facades\DB;

// These tests hit the shared 'vocab' connection. When the test DB is empty
// (no vocabulary loaded), skip gracefully rather than fail. CI currently runs
// against parthenon_testing which has no vocab tables; local dev DBs typically do.
beforeEach(function () {
    try {
        $count = (int) DB::connection('vocab')->selectOne(
            "SELECT COUNT(*) AS n FROM vocab.concept WHERE vocabulary_id = 'ICD10CM'"
        )->n;
        if ($count < 1000) {
            $this->markTestSkipped('vocab.concept not populated in test DB; skipping live-vocab tests.');
        }
    } catch (Throwable) {
        $this->markTestSkipped('vocab.concept unreachable in test DB; skipping.');
    }

    $this->resolver = new FinnGenConceptResolver;
});

it('resolveIcd10 finds at least one standard concept for I21', function () {
    $r = $this->resolver->resolveIcd10(['I21']);
    expect(count($r['standard']))->toBeGreaterThanOrEqual(1);
});

it('resolveIcd10 finds standard concepts across multiple prefixes', function () {
    $r = $this->resolver->resolveIcd10(['F32', 'F33']);
    expect(count($r['standard']))->toBeGreaterThanOrEqual(2);
});

it('resolveAtc finds RxNorm-adjacent concepts for A10B prefix', function () {
    $r = $this->resolver->resolveAtc(['A10B']);
    expect(count($r['source']))->toBeGreaterThanOrEqual(1);
});

it('resolveIcd9 handles Finnish trailing-letter codes by stripping them', function () {
    $r = $this->resolver->resolveIcd9(['4019X']);
    // 4019X → 4019 / 401.9; at least one variant should hit ICD9CM.
    expect(count($r['source']))->toBeGreaterThanOrEqual(1);
});

it('resolveIcd10 returns empty arrays for genuinely unknown codes', function () {
    $r = $this->resolver->resolveIcd10(['ZZZNOTACODE']);
    expect($r['standard'])->toBe([])->and($r['source'])->toBe([]);
});

it('resolveIcd8 always returns empty (ICD-8 not loaded)', function () {
    $r = $this->resolver->resolveIcd8(['1234']);
    expect($r['standard'])->toBe([])->and($r['source'])->toBe([]);
});

it('rejects non-alphanumeric tokens (SQL injection defense)', function () {
    $r = $this->resolver->resolveIcd10(["I21'; DROP TABLE users;--"]);
    expect($r['standard'])->toBe([])->and($r['source'])->toBe([]);
});

it('resolveIcd10 inserts decimal for un-dotted Finnish ICD-10 codes (E291 → E29.1)', function () {
    // FinnGen stores ICD-10 codes without the decimal. vocab.concept stores
    // them dotted. The resolver must try both.
    $r = $this->resolver->resolveIcd10(['E291']);
    expect(count($r['source']))->toBeGreaterThanOrEqual(1)
        ->and(count($r['standard']))->toBeGreaterThanOrEqual(1);
});

it('resolveIcd10 inserts decimal for 5-char codes (K0531 → K05.31)', function () {
    $r = $this->resolver->resolveIcd10(['K0531']);
    expect(count($r['source']))->toBeGreaterThanOrEqual(1);
});

it('resolveIcd10 leaves dotted codes alone', function () {
    $r = $this->resolver->resolveIcd10(['E29.1']);
    expect(count($r['source']))->toBeGreaterThanOrEqual(1);
});

it('resolver sanitize drops single-char tokens', function () {
    // Single 'V' is a valid ICD-9 prefix but not a usable code on its own.
    // The resolver must reject it before it reaches the LIKE query.
    $r = $this->resolver->resolveIcd10(['V']);
    expect($r['source'])->toBe([])->and($r['standard'])->toBe([]);
});
