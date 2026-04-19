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
            // Set session-level search_path so finngen.* tables resolve first,
            // then fall through to app.* (users, sources, etc.)
            DB::statement('SET search_path TO finngen,vocab,php,app');
        } catch (\Throwable) {
            // If finngen connection isn't configured, skip silently
        }
    }
}
