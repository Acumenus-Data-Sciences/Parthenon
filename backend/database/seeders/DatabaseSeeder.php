<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     *
     * SAFETY HISTORY:
     * - 2026-03-15: db:seed wiped 16 real production users TWICE because
     *   deploy.sh was calling this seeder on every push.
     * - db:seed has been PERMANENTLY REMOVED from deploy.sh.
     * - This seeder now hard-blocks in production environment.
     * - Sample data seeders only run on fresh/demo databases with no real users.
     */
    public function run(): void
    {
        // ── Hard production block ────────────────────────────────────────────
        // The production APP_ENV must be 'local' or 'testing' for seeders to run.
        // If you are seeing this message in production, do NOT force past it.
        // Use individual artisan commands instead:
        //   php artisan db:seed --class=RolePermissionSeeder
        //   php artisan admin:seed
        if (app()->environment('production')) {
            $this->command?->error(
                'BLOCKED: DatabaseSeeder refuses to run in production. '
                .'Use individual --class= seeders explicitly.'
            );

            return;
        }

        // ── Infrastructure seeders (always safe — use firstOrCreate, never truncate) ─
        $this->call(RolePermissionSeeder::class);
        $this->call(AuthProviderSeeder::class);
        $this->call(AiProviderSeeder::class);
        $this->call(AchillesAnalysisSeeder::class);

        // ── Super-admin account ──────────────────────────────────────────────
        // Credentials: admin@acumenus.net / superuser
        $admin = User::firstOrCreate(
            ['email' => 'admin@acumenus.net'],
            [
                'name' => 'Administrator',
                'password' => Hash::make('superuser'),
                'must_change_password' => false,
                'onboarding_completed' => true,
            ],
        );

        $admin->assignRole('super-admin');

        // ── FinnGen infrastructure seeders (Phase 14 D-18) ───────────────────
        // Runs AFTER admin creation so the default covariate set can be owned
        // by admin@acumenus.net on fresh databases. Idempotent via
        // updateOrInsert on `name`.
        $this->call(FinnGenGwasCovariateSetSeeder::class);

        // ── Detect real users ────────────────────────────────────────────────
        // Skip sample data if any non-admin, non-factory users exist.
        $realUserCount = User::query()
            ->where('email', '!=', 'admin@acumenus.net')
            ->where('email', 'NOT LIKE', '%@example.%')
            ->where('email', 'NOT LIKE', '%@parthenon.local')
            ->where('email', 'NOT LIKE', 'test-%')
            ->count();

        if ($realUserCount > 0) {
            $this->command?->info(
                "Skipping sample data seeders — {$realUserCount} real user(s) detected."
            );
            $this->call(ConditionBundleSeeder::class);
            $this->call(GisBoundaryLevelSeeder::class);

            return;
        }

        // ── Sample data seeders (ONLY on fresh/demo databases) ───────────────
        $this->command?->info('No real users detected — running full sample data seeders.');

        $this->call(ConditionBundleSeeder::class);
        $this->call(CohortDefinitionSeeder::class);
        $this->call(ConceptSetSeeder::class);
        $this->call(AnalysisSeeder::class);
        $this->call(QueryLibrarySeeder::class);
        $this->call(HeorSeeder::class);
        $this->call(PacsConnectionSeeder::class);
        $this->call(StudySeeder::class);
        $this->call(GisBoundaryLevelSeeder::class);
        $this->call(CommonsChannelSeeder::class);
    }
}
