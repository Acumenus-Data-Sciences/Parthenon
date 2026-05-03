<?php

declare(strict_types=1);

namespace Tests\Feature\Templates;

use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Permission;
use Tests\TestCase;

class PermissionsExistTest extends TestCase
{
    use RefreshDatabase;

    public function test_required_ingestion_permissions_exist(): void
    {
        $this->seed(RolePermissionSeeder::class);

        $this->assertTrue(Permission::where('name', 'ingestion.view')->exists());
        $this->assertTrue(Permission::where('name', 'ingestion.run')->exists());
        $this->assertTrue(Permission::where('name', 'ingestion.delete')->exists());
    }
}
