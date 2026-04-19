<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Support\Facades\DB;

abstract class TestCase extends BaseTestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        // Share the default connection's PDO with cross-schema connections so
        // RefreshDatabase's open transaction is visible for FK checks.
        // The combined search_path lets both connections resolve their tables
        // correctly within the single PG session.
        try {
            $pdo = DB::connection()->getPdo();
            DB::connection('finngen')->setPdo($pdo);
            // Phase 15 Plan 08: the Phase 15 controllers use `DB::connection('pgsql')`
            // explicitly for cross-connection reads (eligible-controls joins onto
            // app.cohort_definitions + {source}.cohort). Share PDO here so those
            // reads see the RefreshDatabase transaction's seeded fixtures.
            DB::connection('pgsql')->setPdo($pdo);
            // Set session-level search_path so finngen.* tables resolve first,
            // then fall through to app.* (users, sources, etc.)
            DB::statement('SET search_path TO finngen,vocab,php,app');

            // DB::connection('finngen')->transaction(...) inside the controller
            // would otherwise call BEGIN on a PDO that already has an active
            // transaction (RefreshDatabase's outer tx) and PG rejects it. Mirror
            // the transaction counter so Laravel issues a SAVEPOINT instead.
            // Works because all three connections share the same PDO handle.
            $this->syncTransactionCounter();
        } catch (\Throwable) {
            // If finngen connection isn't configured, skip silently
        }
    }

    private function syncTransactionCounter(): void
    {
        $defaultConn = DB::connection();
        $reflection = new \ReflectionObject($defaultConn);
        if (! $reflection->hasProperty('transactions')) {
            return;
        }
        $prop = $reflection->getProperty('transactions');
        $prop->setAccessible(true);
        $outer = (int) $prop->getValue($defaultConn);
        if ($outer < 1) {
            return;
        }
        foreach (['finngen', 'pgsql'] as $name) {
            $conn = DB::connection($name);
            $refConn = new \ReflectionObject($conn);
            if ($refConn->hasProperty('transactions')) {
                $p = $refConn->getProperty('transactions');
                $p->setAccessible(true);
                $p->setValue($conn, $outer);
            }
        }
    }
}
