<?php

declare(strict_types=1);

namespace Database\Seeders\Testing;

use App\Models\App\Source;
use App\Models\User;
use Database\Seeders\FinnGenAnalysisModuleSeeder;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Role;

/**
 * FinnGen SP1 testing fixtures — consumed by Pest feature tests and Playwright
 * E2E runs. Provides:
 *   - Two sources: "EUNOMIA" (active) and "FINNGEN_TEST_DISABLED" (soft-deleted = disabled)
 *   - One user per role: viewer, researcher, admin, super-admin
 *   - The production analysis module seeder for a populated registry
 *
 * Idempotent. Safe to run multiple times.
 *
 * NOTE: Parthenon's source registry lives in app.sources + app.source_daimons.
 * This seeder creates minimal rows; real CDM ingestion is NOT performed here.
 * Tests that need actual CDM data must run against a real Eunomia seed
 * (e.g. `php artisan eunomia:seed-source` after `parthenon:load-eunomia`).
 *
 * "Disabled" is modeled via Laravel's SoftDeletes trait on the Source model:
 * a non-null `deleted_at` signals the source is inactive. FinnGenSourceContextBuilder
 * (Task C4) filters these out.
 */
class FinnGenTestingSeeder extends Seeder
{
    public function run(): void
    {
        // Role→permission matrix must be in place before we sync roles onto users.
        // Parthenon's production RolePermissionSeeder is idempotent.
        (new RolePermissionSeeder)->run();

        (new FinnGenAnalysisModuleSeeder)->run();

        $this->seedSources();
        $this->seedUsers();
    }

    private function seedSources(): void
    {
        // Active Eunomia source (idempotent — real seeder may have already created it).
        Source::withTrashed()->updateOrCreate(
            ['source_key' => 'EUNOMIA'],
            [
                'source_name' => 'Eunomia (demo)',
                'source_dialect' => 'postgresql',
                'source_connection' => 'eunomia',
                'is_cache_enabled' => false,
                'deleted_at' => null,
            ]
        );

        // Disabled source fixture — soft-deleted so FinnGenSourceContextBuilder
        // tests can verify the disabled-source path.
        $disabled = Source::withTrashed()->updateOrCreate(
            ['source_key' => 'FINNGEN_TEST_DISABLED'],
            [
                'source_name' => 'Disabled source (testing)',
                'source_dialect' => 'postgresql',
                'source_connection' => 'eunomia',
                'is_cache_enabled' => false,
            ]
        );

        if ($disabled->deleted_at === null) {
            $disabled->delete(); // soft delete
        }
    }

    private function seedUsers(): void
    {
        $roles = ['viewer', 'researcher', 'admin', 'super-admin'];

        foreach ($roles as $roleName) {
            Role::findOrCreate($roleName, 'web');

            $email = "finngen-test-{$roleName}@test.local";
            $user = User::firstOrCreate(
                ['email' => $email],
                [
                    'name' => "FinnGen Test {$roleName}",
                    'password' => bcrypt('finngen-test-password'),
                    'must_change_password' => false,
                    'onboarding_completed' => true,
                ]
            );
            $user->syncRoles([$roleName]);
        }
    }
}
