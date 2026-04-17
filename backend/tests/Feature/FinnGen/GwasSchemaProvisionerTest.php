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
});

it('is idempotent on re-provision', function () {
    $svc = app(GwasSchemaProvisioner::class);
    $svc->provision('PANCREAS');
    $svc->provision('PANCREAS'); // second call must not error
    expect(DB::selectOne("
        SELECT to_regclass('pancreas_gwas_results.summary_stats') AS t
    ")->t)->not->toBeNull();
});

it('rejects unsafe source_key values', function () {
    app(GwasSchemaProvisioner::class)->provision('foo; DROP TABLE x;--');
})->throws(InvalidArgumentException::class);

it('creates BRIN composite index on (gwas_run_id, chrom, pos) per Pitfall 2', function () {
    app(GwasSchemaProvisioner::class)->provision('PANCREAS');
    $row = DB::selectOne("
        SELECT indexdef
        FROM pg_indexes
        WHERE schemaname = 'pancreas_gwas_results'
          AND tablename  = 'summary_stats'
          AND indexname  = 'summary_stats_run_chrom_pos_brin'
    ");
    expect($row)->not->toBeNull();
    expect($row->indexdef)->toContain('USING brin');
    expect($row->indexdef)->toContain('gwas_run_id');
    expect($row->indexdef)->toContain('chrom');
    expect($row->indexdef)->toContain('pos');
});

it('creates BTREE on (cohort_definition_id, p_value)', function () {
    app(GwasSchemaProvisioner::class)->provision('PANCREAS');
    $row = DB::selectOne("
        SELECT indexdef
        FROM pg_indexes
        WHERE schemaname = 'pancreas_gwas_results'
          AND tablename  = 'summary_stats'
          AND indexname  = 'summary_stats_cohort_p_btree'
    ");
    expect($row)->not->toBeNull();
    expect($row->indexdef)->toContain('cohort_definition_id');
    expect($row->indexdef)->toContain('p_value');
});
