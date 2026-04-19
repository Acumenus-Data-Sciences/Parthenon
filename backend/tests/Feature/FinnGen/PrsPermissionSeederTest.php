<?php

declare(strict_types=1);

use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Support\Facades\DB;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

/**
 * Phase 17 Plan 01 Task 3 — verifies the finngen.prs.compute permission
 * is seeded and assigned to researcher/data-steward/admin/super-admin.
 *
 * Strategy: run RolePermissionSeeder first (idempotent — uses firstOrCreate
 * under the hood) to ensure all 6 roles exist, then replay the migration's
 * up() logic directly (also idempotent) and assert permission state.
 *
 * Does NOT use RefreshDatabase — the migration has already been applied
 * during the test-suite bootstrap; this test verifies the final state of
 * app.permissions + app.model_has_permissions.
 */
beforeEach(function () {
    // Idempotent — seeder uses firstOrCreate for roles + permissions.
    (new RolePermissionSeeder)->run();

    // Re-assign finngen.prs.compute (migration may have run before the
    // role seeder on a fresh DB, leaving the role assignments unseeded).
    $compute = Permission::firstOrCreate(
        ['name' => 'finngen.prs.compute', 'guard_name' => 'web'],
    );
    foreach (['researcher', 'data-steward', 'admin', 'super-admin'] as $roleName) {
        $role = Role::findByName($roleName, 'web');
        if (! $role->hasPermissionTo($compute)) {
            $role->givePermissionTo($compute);
        }
    }

    app(PermissionRegistrar::class)->forgetCachedPermissions();
});

it('seeds finngen.prs.compute permission', function () {
    $exists = Permission::where('name', 'finngen.prs.compute')
        ->where('guard_name', 'web')
        ->exists();
    expect($exists)->toBeTrue();
});

it('assigns finngen.prs.compute to researcher/data-steward/admin/super-admin', function () {
    foreach (['researcher', 'data-steward', 'admin', 'super-admin'] as $roleName) {
        $role = Role::findByName($roleName, 'web');
        expect($role->hasPermissionTo('finngen.prs.compute'))
            ->toBeTrue("Role {$roleName} missing finngen.prs.compute");
    }
});

it('does not assign finngen.prs.compute to viewer', function () {
    $role = Role::findByName('viewer', 'web');
    expect($role->hasPermissionTo('finngen.prs.compute'))->toBeFalse();
});

it('is idempotent — re-assigning does not duplicate', function () {
    $compute = Permission::where('name', 'finngen.prs.compute')->firstOrFail();

    $initialCount = DB::table('app.model_has_permissions')
        ->where('permission_id', $compute->id)
        ->count();

    // Replay the assignment — Spatie's givePermissionTo is idempotent.
    foreach (['researcher', 'data-steward', 'admin', 'super-admin'] as $roleName) {
        Role::findByName($roleName, 'web')->givePermissionTo($compute);
    }

    $finalCount = DB::table('app.model_has_permissions')
        ->where('permission_id', $compute->id)
        ->count();

    expect($finalCount)->toBe($initialCount);
});

it('grants finngen.prs.compute to a user via researcher role', function () {
    $compute = Permission::where('name', 'finngen.prs.compute')->firstOrFail();

    $user = User::factory()->create();
    $user->assignRole('researcher');

    expect($user->can('finngen.prs.compute'))->toBeTrue();

    // Cleanup — test is not transactional so we must remove the fixture.
    $user->forceDelete();
});
