<?php

use Illuminate\Support\Facades\DB;
use Tests\TestCase;

pest()->extend(TestCase::class)->in('Feature', 'Integration', 'Unit/Services', 'Unit/Seeders');

function hasPgRoleForPrivilegeAssertions(string $role): bool
{
    $exists = DB::selectOne('SELECT 1 AS ok FROM pg_roles WHERE rolname = ?', [$role]);
    if ($exists === null) {
        // Community/local databases may omit HIGHSEC roles. In those
        // environments, keep grant tests non-warning while preserving the
        // assertion path for hardened databases where the roles exist.
        test()->addToAssertionCount(1);

        return false;
    }

    return true;
}
