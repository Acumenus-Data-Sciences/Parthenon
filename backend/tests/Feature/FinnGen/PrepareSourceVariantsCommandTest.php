<?php

declare(strict_types=1);

use App\Models\App\FinnGen\SourceVariantIndex;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;

it('creates a source_variant_indexes row on happy path', function () {
    $exit = Artisan::call('finngen:prepare-source-variants', [
        '--source' => 'PANCREAS',
        '--dry-run' => true,
    ]);
    expect($exit)->toBe(0);
    expect(SourceVariantIndex::where('source_key', 'pancreas')->exists())->toBeTrue();
})->skip('Wave 0 skeleton — implementation lands in Wave 3 Plan 14-04');

it('is idempotent on re-run (updates existing row, no duplicate)', function () {
    Artisan::call('finngen:prepare-source-variants', ['--source' => 'PANCREAS', '--dry-run' => true]);
    Artisan::call('finngen:prepare-source-variants', ['--source' => 'PANCREAS', '--dry-run' => true]);
    expect(SourceVariantIndex::where('source_key', 'pancreas')->count())->toBe(1);
})->skip('Wave 0 skeleton — implementation lands in Wave 3 Plan 14-04');

it('returns non-zero exit for unknown source', function () {
    $exit = Artisan::call('finngen:prepare-source-variants', ['--source' => 'DOES_NOT_EXIST']);
    expect($exit)->not->toBe(0);
})->skip('Wave 0 skeleton — implementation lands in Wave 3 Plan 14-04');

it('creates per-source gwas_results schema + summary_stats table', function () {
    Artisan::call('finngen:prepare-source-variants', ['--source' => 'PANCREAS', '--dry-run' => true]);
    $exists = DB::selectOne("SELECT to_regclass('pancreas_gwas_results.summary_stats') AS t")->t;
    expect($exists)->not->toBeNull();
})->skip('Wave 0 skeleton — implementation lands in Wave 3 Plan 14-04');
