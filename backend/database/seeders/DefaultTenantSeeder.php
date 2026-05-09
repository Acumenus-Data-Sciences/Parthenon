<?php

namespace Database\Seeders;

use App\Tenancy\Tenant;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * Idempotent insert of Tenant#1 ('default'). Required for SingleTenantResolver
 * to function on every install. Run early in DatabaseSeeder so any seeder that
 * touches tenant-scoped tables can rely on Tenant#1 existing.
 *
 * Bumps the Postgres sequence after the explicit id=1 insert so subsequent
 * auto-increment inserts (e.g. EE creating additional tenants) start at id=2.
 */
class DefaultTenantSeeder extends Seeder
{
    public function run(): void
    {
        Tenant::updateOrCreate(
            ['id' => 1],
            [
                'slug' => 'default',
                'display_name' => 'Default Tenant',
                'billing_status' => 'active',
            ],
        );

        // Bump sequence past id=1 so auto-increment inserts get id=2+.
        // Postgres-only; safe and idempotent.
        DB::connection('pgsql')->statement(
            "SELECT setval(pg_get_serial_sequence('tenants', 'id'), GREATEST((SELECT MAX(id) FROM tenants), 1))"
        );
    }
}
