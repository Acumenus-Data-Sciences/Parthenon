<?php

declare(strict_types=1);

use Illuminate\Support\Facades\DB;

/**
 * Phase 13.1 Wave 0 — SC 10.
 *
 * Expected state: RED until Plan 13.1-02 migration runs against the
 * parthenon_testing DB (migrations are applied per-test via RefreshDatabase
 * in other tests; this one hits the connection directly without seeding).
 *
 * Confirms the finngen schema is visible through the finngen_ro connection
 * — i.e. the parthenon_finngen_ro role's USAGE grant on the schema landed
 * in the test DB bootstrap.
 *
 * @note RED until Plan 13.1-02 migration ships.
 */
it('finngen schema exists in parthenon_testing DB via the finngen_ro connection', function (): void {
    $row = DB::connection('finngen_ro')->selectOne(
        "SELECT 1 AS ok FROM pg_namespace WHERE nspname = 'finngen'"
    );
    expect($row)->not->toBeNull();
});
