<?php

declare(strict_types=1);

use App\Models\App\FinnGen\EndpointDefinition;
use App\Models\User;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;

/**
 * Phase 13.1 Wave 0 — SC 8 (expanded in Wave 3 per Plan 13.1-04 Task 2).
 *
 * Full round-trip: migrate → rollback → re-migrate. Asserts schema existence,
 * the `app.cohort_definitions.coverage_profile` column round-trip, AND row
 * counts at each boundary.
 *
 * This test DELIBERATELY does NOT use the `RefreshDatabase` trait — the trait
 * would wrap the body in a transaction, and `migrate:rollback` cannot be
 * exercised inside a transaction (Postgres rejects DDL-rollback interleaving).
 *
 * Because the test leaves the DB in a non-standard state (the rollback
 * inverts the migration chain), it provides its own `afterAll` cleanup hook
 * that runs `migrate:fresh`. Without this hook, running any subsequent
 * FinnGen Pest test in the same process would silently corrupt fixtures.
 *
 * @note RED until Plan 13.1-02 migration + Plan 13.1-05 deploy choreography ship.
 */
it('migrate→rollback→migrate preserves schema and round-trips row counts', function (): void {
    // Find the 13.1 migration.
    $files = glob(base_path('database/migrations/*isolate_finngen_schema*.php'));
    expect($files)->toBeArray();
    expect($files)->not->toBeEmpty('13.1 migration file not found');
    /** @var list<string> $files */
    $path = 'database/migrations/'.basename($files[0]);

    // Ensure the admin@acumenus.net user exists — the rollback INSERT uses
    // `COALESCE((SELECT id FROM app.users WHERE email='admin@acumenus.net'), 1)`
    // as the author_id fallback. Without a user at id=1 or the admin row,
    // the FK to users(id) would fail. RefreshDatabase-style bootstrap runs
    // before this test, so re-create the admin idempotently if missing.
    if (User::where('email', 'admin@acumenus.net')->doesntExist()) {
        User::factory()->create([
            'email' => 'admin@acumenus.net',
            'name' => 'Rollback Test Admin',
        ]);
    }

    // ─── Phase A: Post-migrate baseline ─────────────────────────────────
    // By the time this test runs, the full migration chain (including the
    // 13.1 isolate_finngen_schema migration) has already been applied — the
    // test bootstrap runs `migrate` before the suite executes. We seed N
    // fixtures so the rollback has something to rehydrate back into
    // app.cohort_definitions.
    $fixtures = EndpointDefinition::factory()->count(5)->create();
    $fixtureNames = $fixtures->pluck('name')->all();

    // Manually populate the snapshot table so down() has rows to rehydrate
    // from. In production this happens during the Phase 13 `--overwrite`
    // import run; in tests we seed it directly. The snapshot shape
    // (cohort_definition_id PK, name, expression_json, coverage_bucket,
    // created_at, snapshotted_at) was established by the Phase 13 migration
    // 2026_04_18_000200_create_finngen_endpoint_expressions_pre_phase13_table.php
    // and moved to finngen.* by the 13.1 migration.
    foreach ($fixtures as $idx => $fx) {
        DB::connection(config('finngen.connection', 'finngen'))->table('endpoint_expressions_pre_phase13')->insert([
            // Unique bigint PK per row — real Phase 13 data used cohort_definitions.id.
            'cohort_definition_id' => 9_000_000 + $idx,
            'name' => $fx->name,
            'expression_json' => json_encode([
                'longname' => $fx->longname,
                'source_codes' => [],
            ]),
            'coverage_bucket' => 'FULLY_MAPPED',
            'created_at' => now(),
            'snapshotted_at' => now(),
        ]);
    }

    $preSchemaExists = DB::selectOne("SELECT 1 AS ok FROM pg_namespace WHERE nspname = 'finngen'");
    $preEndpointCount = EndpointDefinition::count();
    expect($preSchemaExists)->not->toBeNull('finngen schema should exist post-migrate');
    expect($preEndpointCount)->toBe(5);

    $preCoverageCol = DB::selectOne(
        'SELECT column_name FROM information_schema.columns '.
        "WHERE table_schema='app' AND table_name='cohort_definitions' AND column_name='coverage_profile'"
    );
    expect($preCoverageCol)->toBeNull('coverage_profile should NOT exist on app.cohort_definitions after the up() migration');

    // ─── Phase B: Rollback ───────────────────────────────────────────────
    Artisan::call('migrate:rollback', ['--path' => $path, '--force' => true]);

    $postRollbackSchema = DB::selectOne("SELECT 1 AS ok FROM pg_namespace WHERE nspname = 'finngen'");
    expect($postRollbackSchema)->toBeNull('finngen schema should be dropped after rollback');

    $postRollbackCol = DB::selectOne(
        'SELECT column_name FROM information_schema.columns '.
        "WHERE table_schema='app' AND table_name='cohort_definitions' AND column_name='coverage_profile'"
    );
    expect($postRollbackCol)->not->toBeNull('coverage_profile column should be restored on app.cohort_definitions');

    // Verify rehydrated rows: the 5 fixtures should now live in
    // app.cohort_definitions with domain='finngen-endpoint' (the down()
    // INSERT joins the snapshot + endpoint_definitions and lands them back
    // with their original cohort_definition_id bigints as id).
    $rehydratedCount = DB::table('app.cohort_definitions')
        ->where('domain', 'finngen-endpoint')
        ->count();
    expect($rehydratedCount)->toBe(5);

    // Verify the rehydrated rows carry the original names — tightens the
    // assertion so a down() regression that drops rows wouldn't be caught
    // by a raw count alone.
    $rehydratedNames = DB::table('app.cohort_definitions')
        ->where('domain', 'finngen-endpoint')
        ->pluck('name')
        ->all();
    expect($rehydratedNames)->toEqualCanonicalizing($fixtureNames);

    // ─── Phase C: Re-migrate ─────────────────────────────────────────────
    Artisan::call('migrate', ['--path' => $path, '--force' => true]);

    $postRemigrateSchema = DB::selectOne("SELECT 1 AS ok FROM pg_namespace WHERE nspname = 'finngen'");
    expect($postRemigrateSchema)->not->toBeNull('finngen schema should be re-created after re-migrate');

    $postRemigrateCol = DB::selectOne(
        'SELECT column_name FROM information_schema.columns '.
        "WHERE table_schema='app' AND table_name='cohort_definitions' AND column_name='coverage_profile'"
    );
    expect($postRemigrateCol)->toBeNull('coverage_profile column should be dropped again after re-migrate');

    // The 5 rehydrated rows should now live back in
    // finngen.endpoint_definitions at the same count.
    $postRemigrateCount = EndpointDefinition::count();
    expect($postRemigrateCount)->toBe(5);
});

/**
 * Mandatory suite-level cleanup — non-negotiable per Plan 13.1-04 Task 2
 * acceptance criteria. Without this hook, running this test before other
 * FinnGen tests in the same process would leave the DB in a state that
 * silently corrupts their fixtures (the rollback + re-migrate chain leaves
 * residue in app.cohort_definitions, and the snapshot table contains test
 * data that looks production-like).
 *
 * `migrate:fresh` drops everything and re-runs the full migration chain,
 * restoring the suite baseline.
 */
afterAll(function () {
    Artisan::call('migrate:fresh', ['--force' => true]);
});
