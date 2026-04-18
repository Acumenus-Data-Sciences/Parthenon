<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    /**
     * Additional connections RefreshDatabase/DatabaseTransactions should wrap
     * in a transaction so per-connection writes roll back between tests.
     *
     * Default-connection (`pgsql_testing`) is always transacted by the trait
     * and does NOT need to be listed here.
     *
     * Phase 13.2-06: `finngen_testing` registered so FinnGen model writes
     * (routed via config('finngen.connection')) roll back cleanly. Mirrors
     * the `inpatient_testing` pattern established by the Morpheus subsystem.
     *
     * @var list<string>
     */
    protected $connectionsToTransact = ['inpatient_testing', 'finngen_testing'];
}
