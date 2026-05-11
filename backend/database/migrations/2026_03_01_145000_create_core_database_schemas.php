<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Keep schema creation inside migrations so external PostgreSQL installs
     * behave the same way as the Docker init script.
     */
    public function up(): void
    {
        foreach (['app', 'omop', 'vocab', 'results', 'php'] as $schema) {
            DB::statement("CREATE SCHEMA IF NOT EXISTS {$schema}");
        }

        $this->grantIfRoleExists('parthenon', 'ALL');
        $this->grantIfRoleExists('parthenon_app', 'USAGE');
        $this->grantIfRoleExists('parthenon_migrator', 'ALL');
        $this->grantIfRoleExists('parthenon_finngen_ro', 'USAGE');
        $this->grantIfRoleExists('parthenon_finngen_rw', 'USAGE');
    }

    public function down(): void
    {
        // Intentional no-op: these schemas are shared deployment primitives.
    }

    private function grantIfRoleExists(string $role, string $privilege): void
    {
        try {
            DB::statement("
                DO \$\$
                BEGIN
                    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '{$role}') THEN
                        GRANT {$privilege} ON SCHEMA app, omop, vocab, results, php TO {$role};
                    END IF;
                END
                \$\$
            ");
        } catch (Throwable) {
            // Existing managed databases may keep schemas DBA-owned. Later,
            // feature-specific grant migrations still fail loudly if a role
            // lacks required access.
        }
    }
};
