<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Tests\Concerns\SharesPdoAcrossTestConnections;

abstract class TestCase extends BaseTestCase
{
    use SharesPdoAcrossTestConnections;

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
     * tests.
     *
     * Phase 13.2-07: cross-connection FK checks (finngen.runs.user_id →
     * app.users.id) now resolve because the shared-PDO trait rebinds the
     * sibling *_testing PDOs to pgsql_testing's PDO — one backend, one
     * transaction scope, one visibility frame.
     *
     * @var list<string>
     */
    protected $connectionsToTransact = ['pgsql_testing', 'inpatient_testing', 'finngen_testing'];
}
