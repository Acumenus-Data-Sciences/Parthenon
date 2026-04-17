<?php

declare(strict_types=1);

use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;

/**
 * Phase 13.1 Wave 0 — SC 8.
 *
 * Expected state: RED until Plan 13.1-02 migration lands (the test glob
 * first has to find the migration file, which doesn't exist yet) AND
 * Plan 13.1-04 verifies the functional down() path round-trips cleanly.
 *
 * Round-trip: migrate → rollback → re-migrate. Asserts the finngen schema
 * disappears on rollback and app.cohort_definitions.coverage_profile is
 * restored; then both flip back on re-migrate.
 *
 * @note RED until Plan 13.1-02 migration + Plan 13.1-04 rollback verification ship.
 */
it('migrate:rollback restores app.cohort_definitions.coverage_profile and drops finngen schema', function (): void {
    // Find the Phase 13.1 migration file dynamically.
    $files = glob(base_path('database/migrations/*isolate_finngen_schema*.php'));
    expect($files)->not->toBeEmpty('13.1 migration file not found');
    $path = 'database/migrations/'.basename($files[0]);

    // Sanity: schema exists at the start (RefreshDatabase/migrate ran it in prior setup).
    $beforeSchema = DB::selectOne("SELECT 1 FROM pg_namespace WHERE nspname = 'finngen'");
    expect($beforeSchema)->not->toBeNull();

    // Roll back.
    Artisan::call('migrate:rollback', ['--path' => $path, '--force' => true]);

    $afterRollback = DB::selectOne("SELECT 1 FROM pg_namespace WHERE nspname = 'finngen'");
    expect($afterRollback)->toBeNull('finngen schema should be dropped after rollback');

    $col = DB::selectOne(
        'SELECT column_name FROM information_schema.columns '.
        "WHERE table_schema='app' AND table_name='cohort_definitions' AND column_name='coverage_profile'"
    );
    expect($col)->not->toBeNull('coverage_profile should be restored on app.cohort_definitions');

    // Re-migrate.
    Artisan::call('migrate', ['--path' => $path, '--force' => true]);

    $afterRemigrate = DB::selectOne("SELECT 1 FROM pg_namespace WHERE nspname = 'finngen'");
    expect($afterRemigrate)->not->toBeNull('finngen schema should exist again after re-migrate');
});
