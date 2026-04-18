<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    /**
     * Connections RefreshDatabase/DatabaseTransactions wrap in a transaction
     * so per-connection writes roll back between tests.
     *
     * Laravel's trait uses `[null]` by default (= the default connection
     * only), so setting this property REPLACES that default. When we add
     * extra connections here we MUST also explicitly include the default
     * (`pgsql_testing`) or writes through it leak across tests.
     *
     * Phase 13.2-06: `finngen_testing` registered so FinnGen model writes
     * (routed via config('finngen.connection')) roll back cleanly between
     * tests. Cross-connection FK checks (finngen.runs.user_id → app.users.id)
     * fail between separate PDOs+transactions; tests that require that FK
     * must seed the user explicitly on finngen_testing OR rely on a
     * fixture user committed outside RefreshDatabase (documented per-test).
     * Mirrors the `inpatient_testing` pattern established by Morpheus.
     *
     * @var list<string>
     */
    protected $connectionsToTransact = ['pgsql_testing', 'inpatient_testing', 'finngen_testing'];
}
