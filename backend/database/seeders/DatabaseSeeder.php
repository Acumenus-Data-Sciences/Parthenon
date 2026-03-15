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
     * SAFETY: Detects whether the database has real (non-factory) users.
     * If real users exist, only infrastructure seeders run (roles, providers).
     * Sample data seeders (cohorts, analyses, studies) are SKIPPED to prevent
     * overwriting or cascading destruction of production data.
     *
     * This was learned the hard way on 2026-03-15 when db:seed wiped 16
     * real registered users via TRUNCATE CASCADE.
     */
    public function run(): void
    {
        // ── Infrastructure seeders (ALWAYS safe to run) ──────────────────────
        // These use firstOrCreate / updateOrCreate and never truncate.
        $this->call(RolePermissionSeeder::class);
        $this->call(AuthProviderSeeder::class);
        $this->call(AiProviderSeeder::class);

        // ── Super-admin account ──────────────────────────────────────────────
        // Credentials: admin@acumenus.net / superuser
        // NEVER change this email or password.
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

        // ── Detect real users ────────────────────────────────────────────────
        // If any non-admin, non-factory users exist, skip sample data seeders.
        $realUserCount = User::query()
            ->where('email', '!=', 'admin@acumenus.net')
            ->where('email', 'NOT LIKE', '%@example.%')
            ->where('email', 'NOT LIKE', '%@parthenon.local')
            ->count();

        if ($realUserCount > 0) {
            $this->command?->info(
                "Skipping sample data seeders — {$realUserCount} real user(s) detected. "
                .'Run individual seeders with --class= if needed.'
            );

            // Only run seeders that are safe for production (no truncate, no FK risk)
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
