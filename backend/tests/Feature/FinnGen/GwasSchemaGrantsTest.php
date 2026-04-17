<?php

declare(strict_types=1);

use App\Services\FinnGen\GwasSchemaProvisioner;
use Illuminate\Support\Facades\DB;

beforeEach(function () {
    // Wave 0 skeleton: the service class does not exist yet. Skip
    // provisioning in beforeEach() so per-test ->skip() annotations are
    // the sole signal when the suite runs against an un-implemented
    // codebase. Wave 2 (Plan 14-03) removes this guard + the skip calls.
    if (! class_exists(GwasSchemaProvisioner::class)) {
        return;
    }
    app(GwasSchemaProvisioner::class)->provision('PANCREAS');
});

it('grants DML to parthenon_app on summary_stats', function () {
    $row = DB::selectOne("
        SELECT has_table_privilege('parthenon_app', 'pancreas_gwas_results.summary_stats', 'SELECT, INSERT, UPDATE, DELETE') AS ok
    ");
    expect($row->ok)->toBeTrue();
})->skip('Wave 0 skeleton — implementation lands in Wave 2 Plan 14-03');

it('grants DML to parthenon_finngen_rw on summary_stats', function () {
    $row = DB::selectOne("
        SELECT has_table_privilege('parthenon_finngen_rw', 'pancreas_gwas_results.summary_stats', 'SELECT, INSERT, UPDATE, DELETE') AS ok
    ");
    expect($row->ok)->toBeTrue();
})->skip('Wave 0 skeleton — implementation lands in Wave 2 Plan 14-03');

it('grants only SELECT to parthenon_finngen_ro on summary_stats', function () {
    $can_select = DB::selectOne("SELECT has_table_privilege('parthenon_finngen_ro', 'pancreas_gwas_results.summary_stats', 'SELECT') AS ok")->ok;
    $can_insert = DB::selectOne("SELECT has_table_privilege('parthenon_finngen_ro', 'pancreas_gwas_results.summary_stats', 'INSERT') AS ok")->ok;
    expect($can_select)->toBeTrue();
    expect($can_insert)->toBeFalse();
})->skip('Wave 0 skeleton — implementation lands in Wave 2 Plan 14-03');
