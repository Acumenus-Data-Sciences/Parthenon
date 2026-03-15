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
     * Fully idempotent — safe to re-run on every deploy.
     */
    public function run(): void
    {
        // Roles and permissions must exist before users are assigned roles.
        $this->call(RolePermissionSeeder::class);
        $this->call(AuthProviderSeeder::class);
        $this->call(AiProviderSeeder::class);

        // ── Default super-admin ────────────────────────────────────────────
        // Credentials: login = admin@acumenus.net   password = superuser
        // NEVER change this email or password — see MEMORY.md highest priority
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

        // ── Condition bundles ──────────────────────────────────────────────
        // Data sources are NOT seeded here — Eunomia is seeded by the installer
        // via `php artisan eunomia:seed-source` after pg_restore. Customer CDM
        // sources are added through the admin UI or WebAPI import.
        $this->call(ConditionBundleSeeder::class);

        // ── Sample cohort definitions ────────────────────────────────────
        $this->call(CohortDefinitionSeeder::class);

        // ── Sample concept sets (matching cohort definitions) ────────────
        $this->call(ConceptSetSeeder::class);

        // ── Sample analyses (referencing cohorts + concept sets) ────────
        $this->call(AnalysisSeeder::class);
        $this->call(QueryLibrarySeeder::class);

        // ── HEOR analyses with scenarios, parameters, and value contracts ──
        $this->call(HeorSeeder::class);

        // ── PACS connections ────────────────────────────────────────────
        $this->call(PacsConnectionSeeder::class);

        // ── Sample studies ────────────────────────────────────────────
        $this->call(StudySeeder::class);

        // ── GIS boundary levels ─────────────────────────────────────────
        $this->call(GisBoundaryLevelSeeder::class);

        // ── Commons workspace channels ───────────────────────────────────
        $this->call(CommonsChannelSeeder::class);
    }
}
