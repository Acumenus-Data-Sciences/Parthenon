<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class AbbySetupAnalyst extends Command
{
    protected $signature = 'abby:setup-analyst';

    protected $description = 'Create the abby_analyst Postgres role and temp_abby schema for data interrogation';

    public function handle(): int
    {
        $password = env('ABBY_ANALYST_PASSWORD');

        if (empty($password)) {
            $this->error('ABBY_ANALYST_PASSWORD environment variable is not set.');

            return self::FAILURE;
        }

        $this->info('Setting up abby_analyst role...');

        $conn = DB::connection('pgsql');

        // Create role if not exists
        $roleExists = $conn->selectOne(
            "SELECT 1 FROM pg_roles WHERE rolname = 'abby_analyst'"
        );

        if (! $roleExists) {
            $conn->statement(
                'CREATE ROLE abby_analyst LOGIN PASSWORD '
                .$conn->getPdo()->quote($password)
            );
            $this->info('Created role abby_analyst.');
        } else {
            // Update password
            $conn->statement(
                'ALTER ROLE abby_analyst PASSWORD '
                .$conn->getPdo()->quote($password)
            );
            $this->info('Role abby_analyst already exists, updated password.');
        }

        // Grant read-only on CDM schemas
        $conn->statement('GRANT USAGE ON SCHEMA omop TO abby_analyst');
        $conn->statement('GRANT SELECT ON ALL TABLES IN SCHEMA omop TO abby_analyst');
        $conn->statement(
            'ALTER DEFAULT PRIVILEGES IN SCHEMA omop GRANT SELECT ON TABLES TO abby_analyst'
        );

        $conn->statement('GRANT USAGE ON SCHEMA results TO abby_analyst');
        $conn->statement('GRANT SELECT ON ALL TABLES IN SCHEMA results TO abby_analyst');
        $conn->statement(
            'ALTER DEFAULT PRIVILEGES IN SCHEMA results GRANT SELECT ON TABLES TO abby_analyst'
        );

        // Create scratch schema
        $schemaExists = $conn->selectOne(
            "SELECT 1 FROM information_schema.schemata WHERE schema_name = 'temp_abby'"
        );

        if (! $schemaExists) {
            $conn->statement('CREATE SCHEMA temp_abby AUTHORIZATION abby_analyst');
            $this->info('Created schema temp_abby.');
        } else {
            $this->info('Schema temp_abby already exists.');
        }

        $conn->statement('GRANT ALL ON SCHEMA temp_abby TO abby_analyst');

        // Set statement timeout
        $conn->statement("ALTER ROLE abby_analyst SET statement_timeout = '30s'");

        $this->info('abby_analyst setup complete.');

        return self::SUCCESS;
    }
}
