<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Plan 02-02: add nullable tenant_id (default 1) to 8 core app.* tables.
 *
 * Adapted from Plan 02-02 model list. Real table names verified:
 *   - users, sources, cohort_definitions, concept_sets, analysis_executions,
 *     studies, user_audit_logs, ingestion_jobs
 * (Plan 02-02 had said cohorts/analyses/audit_logs which don't exist — those
 * names were guesses; this migration uses the real ones.)
 *
 * default=1 means existing rows resolve to Tenant#1 ('default'), so single-
 * tenant deployments see no behavior change.
 */
return new class extends Migration
{
    /** @var array<int, string> */
    private array $tables = [
        'users',
        'sources',
        'cohort_definitions',
        'concept_sets',
        'analysis_executions',
        'studies',
        'user_audit_logs',
        'ingestion_jobs',
    ];

    public function up(): void
    {
        foreach ($this->tables as $tableName) {
            if (Schema::connection('pgsql')->hasColumn($tableName, 'tenant_id')) {
                continue;
            }

            Schema::connection('pgsql')->table($tableName, function (Blueprint $table) {
                $table->unsignedBigInteger('tenant_id')->nullable()->default(1)->index();
                $table->foreign('tenant_id')
                    ->references('id')
                    ->on('tenants')
                    ->nullOnDelete();
            });
        }
    }

    public function down(): void
    {
        foreach ($this->tables as $tableName) {
            if (! Schema::connection('pgsql')->hasColumn($tableName, 'tenant_id')) {
                continue;
            }

            Schema::connection('pgsql')->table($tableName, function (Blueprint $table) use ($tableName) {
                $table->dropForeign("{$tableName}_tenant_id_foreign");
                $table->dropColumn('tenant_id');
            });
        }
    }
};
