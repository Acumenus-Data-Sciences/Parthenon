<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Hash;
use Spatie\Permission\Models\Role;

/**
 * Create or update the primary super-admin account.
 *
 * Usage: php artisan admin:seed
 *
 * Safe to re-run — uses updateOrCreate so existing email is updated.
 * Admin users are created with must_change_password=false (no forced change flow).
 */
class SeedAdminCommand extends Command
{
    protected $signature = 'admin:seed';

    protected $description = 'Create or update the super-admin user account';

    public function handle(): int
    {
        $this->info('Parthenon — Admin Account Setup');
        $this->line('─────────────────────────────────');

        $email = $this->ask('Admin email');
        $name  = $this->ask('Admin name', 'Super Admin');

        $password = $this->secret('Password (min 8 chars)');
        if (strlen($password) < 8) {
            $this->error('Password must be at least 8 characters.');
            return self::FAILURE;
        }

        $confirm = $this->secret('Confirm password');
        if ($password !== $confirm) {
            $this->error('Passwords do not match.');
            return self::FAILURE;
        }

        $user = User::updateOrCreate(
            ['email' => strtolower(trim($email))],
            [
                'name'                 => trim($name),
                'password'             => Hash::make($password),
                'must_change_password' => false,
                'email_verified_at'    => now(),
            ]
        );

        // Ensure the super-admin role exists
        $role = Role::firstOrCreate(['name' => 'super-admin', 'guard_name' => 'web']);

        // Also ensure the admin role exists
        Role::firstOrCreate(['name' => 'admin', 'guard_name' => 'web']);

        $user->syncRoles(['super-admin']);

        $verb = $user->wasRecentlyCreated ? 'Created' : 'Updated';
        $this->info("✓ {$verb} super-admin: {$user->email}");

        return self::SUCCESS;
    }
}
