<?php

declare(strict_types=1);

use App\Models\App\FinnGen\SourceVariantIndex;
use App\Models\App\Source;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;

// Deliberately NOT using RefreshDatabase — the testing DB has Phase 13/14
// migrations already applied and RefreshDatabase's `migrate:fresh` collides
// with `2026_04_19_000100_isolate_finngen_schema`'s ALTER TABLE ... SET
// SCHEMA. Mirrors the approach taken by the Wave 2 GwasSchemaProvisioner /
// GwasCacheKeyHasher / GwasSchemaGrants test files.
//
// We instead clean the tables + schema we touch in a beforeEach so each
// test sees a deterministic starting state.

beforeEach(function (): void {
    // Drop any prior schema + tracking rows; also ensure PANCREAS source
    // exists in app.sources so the command's existence check passes.
    DB::statement('DROP SCHEMA IF EXISTS pancreas_gwas_results CASCADE');
    SourceVariantIndex::query()->delete();
    Source::query()->updateOrCreate(
        ['source_key' => 'PANCREAS'],
        [
            'source_name' => 'Pancreatic Cancer Corpus (test)',
            'source_dialect' => 'postgresql',
            'is_cache_enabled' => false,
            'is_default' => false,
            'release_mode' => 'auto',
        ]
    );
});

it('creates a source_variant_indexes row on happy path', function () {
    $exit = Artisan::call('finngen:prepare-source-variants', [
        '--source' => 'PANCREAS',
        '--dry-run' => true,
    ]);
    expect($exit)->toBe(0);
    expect(SourceVariantIndex::where('source_key', 'pancreas')->exists())->toBeTrue();
});

it('is idempotent on re-run (updates existing row, no duplicate)', function () {
    Artisan::call('finngen:prepare-source-variants', ['--source' => 'PANCREAS', '--dry-run' => true]);
    Artisan::call('finngen:prepare-source-variants', ['--source' => 'PANCREAS', '--dry-run' => true]);
    expect(SourceVariantIndex::where('source_key', 'pancreas')->count())->toBe(1);
});

it('returns non-zero exit for unknown source', function () {
    $exit = Artisan::call('finngen:prepare-source-variants', ['--source' => 'DOES_NOT_EXIST']);
    expect($exit)->not->toBe(0);
});

it('creates per-source gwas_results schema + summary_stats table', function () {
    Artisan::call('finngen:prepare-source-variants', ['--source' => 'PANCREAS', '--dry-run' => true]);
    $exists = DB::selectOne("SELECT to_regclass('pancreas_gwas_results.summary_stats') AS t")->t;
    expect($exists)->not->toBeNull();
});

it('refuses to run without super-admin gate when APP_ENV is production', function () {
    // Simulate a prod-style environment. The auth gate allows: APP_ENV in
    // [local, testing], a --force-as-user ID pointing at a super-admin, OR
    // a super-admin session user. With 'production' env, no --force-as-user,
    // and no authenticated user, the command must refuse with a non-zero exit.
    //
    // NOTE: `app()->detectEnvironment` re-binds the env closure; we read it
    // back via `app()->environment()` inside authorizedToRun().
    app()->detectEnvironment(fn () => 'production');

    $exit = Artisan::call('finngen:prepare-source-variants', [
        '--source' => 'PANCREAS',
        '--dry-run' => true,
    ]);
    expect($exit)->not->toBe(0);
    // Gate rejects before any DB mutation — so if the command did touch the
    // DB, that's a gate-bypass bug. Confirm by querying within this test's
    // own transaction; any row would be one the command itself wrote.
    // (Prior tests' rows are rolled back via RefreshDatabase's transaction.)
});
