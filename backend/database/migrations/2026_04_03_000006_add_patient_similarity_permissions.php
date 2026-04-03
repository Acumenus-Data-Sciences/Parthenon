<?php

use Illuminate\Database\Migrations\Migration;
use Spatie\Permission\Exceptions\RoleDoesNotExist;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

return new class extends Migration
{
    public function up(): void
    {
        $view = Permission::firstOrCreate(
            ['name' => 'patient-similarity.view', 'guard_name' => 'web'],
        );

        $compute = Permission::firstOrCreate(
            ['name' => 'patient-similarity.compute', 'guard_name' => 'web'],
        );

        // Assign to roles if they exist (roles may not be seeded yet in CI)
        try {
            Role::findByName('researcher', 'web')->givePermissionTo($view);
            Role::findByName('viewer', 'web')->givePermissionTo($view);
            Role::findByName('data-steward', 'web')->givePermissionTo($compute);
        } catch (RoleDoesNotExist $e) {
            // Roles will be assigned when RolePermissionSeeder runs
        }
    }

    public function down(): void
    {
        Permission::where('name', 'like', 'patient-similarity.%')
            ->where('guard_name', 'web')
            ->delete();
    }
};
