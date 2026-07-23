<?php

declare(strict_types=1);

use Illuminate\Support\Facades\DB;

it('binds logical clinical connections to the isolated test database', function (): void {
    $masterDatabase = (string) DB::connection('pgsql_testing')
        ->selectOne('SELECT current_database() AS database_name')
        ->database_name;

    expect($masterDatabase)->toStartWith('parthenon_testing');

    foreach (['pgsql', 'omop', 'vocab', 'results'] as $connectionName) {
        $database = (string) DB::connection($connectionName)
            ->selectOne('SELECT current_database() AS database_name')
            ->database_name;

        expect($database)
            ->toBe($masterDatabase)
            ->not->toBe('parthenon');
    }
});
