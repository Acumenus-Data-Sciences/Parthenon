<?php

declare(strict_types=1);

use App\Models\App\FinnGen\GwasCovariateSet;
use App\Services\FinnGen\GwasSchemaProvisioner;
use Illuminate\Support\Facades\DB;

beforeEach(function () {
    app(GwasSchemaProvisioner::class)->provision('PANCREAS');
});

it('grants DML to parthenon_app on summary_stats', function () {
    $row = DB::selectOne("
        SELECT has_table_privilege('parthenon_app', 'pancreas_gwas_results.summary_stats', 'SELECT, INSERT, UPDATE, DELETE') AS ok
    ");
    expect($row->ok)->toBeTrue();
});

it('grants DML to parthenon_finngen_rw on summary_stats', function () {
    $row = DB::selectOne("
        SELECT has_table_privilege('parthenon_finngen_rw', 'pancreas_gwas_results.summary_stats', 'SELECT, INSERT, UPDATE, DELETE') AS ok
    ");
    expect($row->ok)->toBeTrue();
});

it('grants only SELECT to parthenon_finngen_ro on summary_stats', function () {
    $can_select = DB::selectOne("SELECT has_table_privilege('parthenon_finngen_ro', 'pancreas_gwas_results.summary_stats', 'SELECT') AS ok")->ok;
    $can_insert = DB::selectOne("SELECT has_table_privilege('parthenon_finngen_ro', 'pancreas_gwas_results.summary_stats', 'INSERT') AS ok")->ok;
    expect($can_select)->toBeTrue();
    expect($can_insert)->toBeFalse();
});

it('observer recomputes covariate_columns_hash on save', function () {
    $columns = [['source' => 'x', 'column_name' => 'x']];
    $expected = hash('sha256', json_encode(
        $columns,
        JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE
    ));
    $set = GwasCovariateSet::create([
        'name' => 'Hash-Observer-Test-'.uniqid(),
        'description' => null,
        'owner_user_id' => null,
        'covariate_columns' => $columns,
        'is_default' => false,
    ]);
    expect($set->covariate_columns_hash)->toBe($expected);
    $set->delete();
});
