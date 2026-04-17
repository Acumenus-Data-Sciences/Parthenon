<?php

declare(strict_types=1);

use App\Services\FinnGen\GwasSchemaProvisioner;
use Illuminate\Support\Facades\DB;

it('creates pancreas_gwas_results.summary_stats with all 13 columns', function () {
    app(GwasSchemaProvisioner::class)->provision('PANCREAS');
    $cols = DB::select("
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'pancreas_gwas_results'
          AND table_name   = 'summary_stats'
        ORDER BY ordinal_position
    ");
    $names = array_map(fn ($r) => $r->column_name, $cols);
    expect($names)->toEqual([
        'chrom', 'pos', 'ref', 'alt', 'snp_id', 'af', 'beta', 'se',
        'p_value', 'case_n', 'control_n', 'cohort_definition_id', 'gwas_run_id',
    ]);
})->skip('Wave 0 skeleton — implementation lands in Wave 2 Plan 14-03');

it('is idempotent on re-provision', function () {
    $svc = app(GwasSchemaProvisioner::class);
    $svc->provision('PANCREAS');
    $svc->provision('PANCREAS'); // second call must not error
    expect(DB::selectOne("
        SELECT to_regclass('pancreas_gwas_results.summary_stats') AS t
    ")->t)->not->toBeNull();
})->skip('Wave 0 skeleton — implementation lands in Wave 2 Plan 14-03');

it('rejects unsafe source_key values', function () {
    app(GwasSchemaProvisioner::class)->provision('foo; DROP TABLE x;--');
})->throws(InvalidArgumentException::class)->skip('Wave 0 skeleton — implementation lands in Wave 2 Plan 14-03');
