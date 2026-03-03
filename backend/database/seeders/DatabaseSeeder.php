<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        // Roles and permissions must exist before users are assigned roles.
        $this->call(RolePermissionSeeder::class);
        $this->call(AuthProviderSeeder::class);
        $this->call(AiProviderSeeder::class);

        // ── Default super-admin ────────────────────────────────────────────
        // Credentials: login = admin   password = superuser
        // Change the password immediately after the first deployment.
        $admin = User::firstOrCreate(
            ['email' => 'admin@parthenon.local'],
            [
                'name'     => 'Administrator',
                'password' => Hash::make('superuser'),
            ],
        );

        $admin->assignRole('super-admin');
    }
}
