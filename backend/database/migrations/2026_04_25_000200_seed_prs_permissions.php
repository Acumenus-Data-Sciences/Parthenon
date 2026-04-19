<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Spatie\Permission\Exceptions\RoleDoesNotExist;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

/**
 * Phase 17 D-17 — Seed `finngen.prs.compute` permission and assign it to the
 * 4 roles authorized to dispatch polygenic-risk-score computations:
 *
 *   - researcher     (primary user)
 *   - data-steward   (pipeline operations)
 *   - admin          (administrative oversight)
 *   - super-admin    (wildcard)
 *
 * The `viewer` role is intentionally excluded. Viewers can still read the PRS
 * histogram in the cohort-detail drawer via the existing `profiles.view`
 * permission — they just cannot trigger new PRS compute jobs.
 *
 * Pattern mirrors 2026_04_03_000006_add_patient_similarity_permissions.php:
 * Permission::firstOrCreate is idempotent, and RoleDoesNotExist is caught so
 * this migration applies cleanly on CI/fresh environments where the
 * RolePermissionSeeder has not yet run (those environments pick up the
 * assignment when the seeder runs afterward).
 */
return new class extends Migration
{
    public function up(): void
    {
        $compute = Permission::firstOrCreate(
            ['name' => 'finngen.prs.compute', 'guard_name' => 'web'],
        );

        try {
            Role::findByName('researcher', 'web')->givePermissionTo($compute);
            Role::findByName('data-steward', 'web')->givePermissionTo($compute);
            Role::findByName('admin', 'web')->givePermissionTo($compute);
            Role::findByName('super-admin', 'web')->givePermissionTo($compute);
        } catch (RoleDoesNotExist) {
            // Roles will be assigned when RolePermissionSeeder runs on a
            // fresh bootstrap. Spatie's givePermissionTo is idempotent so
            // re-running after the seeder is safe.
        }
    }

    public function down(): void
    {
        Permission::where('name', 'finngen.prs.compute')
            ->where('guard_name', 'web')
            ->delete();
    }
};
