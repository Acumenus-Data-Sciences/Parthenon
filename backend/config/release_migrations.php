<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Approved Release Migration Paths
    |--------------------------------------------------------------------------
    |
    | Production upgrades must not run a bare `php artisan migrate --force`.
    | Operators can pass --path repeatedly to parthenon:migrations:release, or
    | set this comma-separated env var during a controlled release window.
    |
    */
    'approved_paths' => array_values(array_filter(array_map(
        static fn (string $path): string => trim($path),
        explode(',', (string) env('PARTHENON_APPROVED_MIGRATION_PATHS', '')),
    ))),

    /*
    |--------------------------------------------------------------------------
    | Classified Historical Pending Migrations
    |--------------------------------------------------------------------------
    |
    | These entries are not permission to ignore live drift. They explain known
    | superseded migrations so the release planner can produce a useful error
    | and direct operators to the repair migration instead of a bare migrate.
    |
    */
    'ignored_pending' => [
        '2026_03_15_230000_create_finngen_runs_table' => 'Superseded by the 2026-04-13 FinnGen runtime schema replacement; run database/migrations/2026_05_11_220000_mark_superseded_finngen_studyagent_migrations.php on upgraded rc9-era databases.',
        '2026_03_20_030221_add_investigation_id_to_finngen_runs' => 'Superseded by the 2026-04-13 FinnGen runtime schema replacement; run database/migrations/2026_05_11_220000_mark_superseded_finngen_studyagent_migrations.php on upgraded rc9-era databases.',
    ],
];
