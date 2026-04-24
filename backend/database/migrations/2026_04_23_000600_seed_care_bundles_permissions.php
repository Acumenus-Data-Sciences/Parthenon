<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Spatie\Permission\Exceptions\RoleDoesNotExist;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

/**
 * Seed the `care-bundles.*` permission domain for the CareBundles Workbench
 * (Phase 2). Three actions:
 *
 *   - view           : coverage matrix, qualifications, intersections, runs
 *   - materialize    : dispatch MaterializeCareBundleJob / MaterializeAllCareBundlesJob
 *   - create-cohort  : convert an intersection into a first-class CohortDefinition
 *
 * Role mapping:
 *   - viewer       → view
 *   - researcher   → view + create-cohort
 *   - data-steward → view + materialize
 *   - admin        → (workbench not in their scope — left to super-admin)
 *   - super-admin  → all
 *
 * Pattern mirrors the finngen.prs.compute seeding migration: idempotent, safe
 * to run before or after RolePermissionSeeder.
 */
return new class extends Migration
{
    public function up(): void
    {
        $view = Permission::firstOrCreate(
            ['name' => 'care-bundles.view', 'guard_name' => 'web'],
        );
        $materialize = Permission::firstOrCreate(
            ['name' => 'care-bundles.materialize', 'guard_name' => 'web'],
        );
        $createCohort = Permission::firstOrCreate(
            ['name' => 'care-bundles.create-cohort', 'guard_name' => 'web'],
        );

        try {
            Role::findByName('viewer', 'web')->givePermissionTo($view);
            Role::findByName('researcher', 'web')->givePermissionTo([$view, $createCohort]);
            Role::findByName('data-steward', 'web')->givePermissionTo([$view, $materialize]);
            Role::findByName('super-admin', 'web')->givePermissionTo([$view, $materialize, $createCohort]);
        } catch (RoleDoesNotExist) {
            // Fresh environments will pick this up when RolePermissionSeeder runs.
        }
    }

    public function down(): void
    {
        Permission::whereIn('name', [
            'care-bundles.view',
            'care-bundles.materialize',
            'care-bundles.create-cohort',
        ])
            ->where('guard_name', 'web')
            ->delete();
    }
};
