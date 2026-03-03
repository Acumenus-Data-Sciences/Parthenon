<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Hash;
use Spatie\Permission\Models\Role;

/**
 * Non-interactive admin creation for the Python installer.
 *
 * Usage:
 *   php artisan admin:create \
 *       --email=admin@example.com \
 *       --name="Admin" \
 *       --password=secret123 \
 *       --force
 *
 * --force: skip confirmation prompt (required for non-interactive use).
 * Safe to re-run — uses updateOrCreate on email.
 */
class CreateAdminCommand extends Command
{
    protected $signature = 'admin:create
        {--email= : Admin e-mail address}
        {--name=Admin : Display name}
        {--password= : Plaintext password (min 8 chars)}
        {--force : Skip confirmation prompt}';

    protected $description = 'Create or update a super-admin account non-interactively';

    public function handle(): int
    {
        $email    = $this->option('email');
        $name     = $this->option('name') ?: 'Admin';
        $password = $this->option('password');
        $force    = $this->option('force');

        if (empty($email)) {
            $this->error('--email is required.');
            return self::FAILURE;
        }

        if (empty($password) || strlen($password) < 8) {
            $this->error('--password is required and must be at least 8 characters.');
            return self::FAILURE;
        }

        if (!$force && !$this->confirm("Create super-admin {$email}?", true)) {
            $this->line('Aborted.');
            return self::SUCCESS;
        }

        $user = User::updateOrCreate(
            ['email' => strtolower(trim($email))],
            [
                'name'                  => trim($name),
                'password'              => Hash::make($password),
                'must_change_password'  => false,
                'onboarding_completed'  => false,
                'email_verified_at'     => now(),
            ]
        );

        // Ensure roles exist before assigning
        Role::firstOrCreate(['name' => 'super-admin', 'guard_name' => 'web']);
        Role::firstOrCreate(['name' => 'admin', 'guard_name' => 'web']);

        $user->syncRoles(['super-admin']);

        $verb = $user->wasRecentlyCreated ? 'Created' : 'Updated';
        $this->info("✓ {$verb} super-admin: {$user->email}");

        return self::SUCCESS;
    }
}
