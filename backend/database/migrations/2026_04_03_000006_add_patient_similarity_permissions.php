<?php

use Illuminate\Database\Migrations\Migration;
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

        // Assign view to researcher and viewer roles
        $researcher = Role::findByName('researcher', 'web');
        $researcher->givePermissionTo($view);

        $viewer = Role::findByName('viewer', 'web');
        $viewer->givePermissionTo($view);

        // Assign compute to data-steward role
        $dataSteward = Role::findByName('data-steward', 'web');
        $dataSteward->givePermissionTo($compute);
    }

    public function down(): void
    {
        Permission::where('name', 'like', 'patient-similarity.%')
            ->where('guard_name', 'web')
            ->delete();
    }
};
