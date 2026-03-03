<?php

namespace Database\Seeders;

use App\Enums\DaimonType;
use App\Models\App\Source;
use App\Models\App\SourceDaimon;
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
        // Credentials: login = admin@parthenon.local   password = superuser
        // Change the password immediately after the first deployment.
        $admin = User::firstOrCreate(
            ['email' => 'admin@parthenon.local'],
            [
                'name'                 => 'Administrator',
                'password'             => Hash::make('superuser'),
                'must_change_password' => false,
            ],
        );

        $admin->assignRole('super-admin');

        // ── OHDSI Acumenus data source ─────────────────────────────────────
        // Points to the local PG 17 ohdsi database (omop schema for CDM+vocab,
        // achilles_results schema for Achilles/DQD). Idempotent via updateOrCreate.
        $source = Source::updateOrCreate(
            ['source_key' => 'ohdsi-acumenus'],
            [
                'source_name'       => 'OHDSI Acumenus',
                'source_dialect'    => 'postgresql',
                'source_connection' => 'cdm',
                'is_cache_enabled'  => false,
            ],
        );

        $daimons = [
            ['daimon_type' => DaimonType::CDM->value,        'table_qualifier' => 'omop',             'priority' => 0],
            ['daimon_type' => DaimonType::Vocabulary->value,  'table_qualifier' => 'omop',             'priority' => 0],
            ['daimon_type' => DaimonType::Results->value,     'table_qualifier' => 'achilles_results', 'priority' => 0],
        ];

        foreach ($daimons as $daimon) {
            SourceDaimon::updateOrCreate(
                ['source_id' => $source->id, 'daimon_type' => $daimon['daimon_type']],
                ['table_qualifier' => $daimon['table_qualifier'], 'priority' => $daimon['priority']],
            );
        }

        // ── Condition bundles ──────────────────────────────────────────────
        $this->call(ConditionBundleSeeder::class);
    }
}
