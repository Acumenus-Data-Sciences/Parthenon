<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Grant runtime DML privileges on a family of app tables that were created by
 * parthenon_migrator without GRANTing to the runtime role.
 *
 * Surfaced 2026-06-11 while running the Abby protocol-to-publication pipeline
 * (ADR-0020) for Hypertension v4: POST /studies/{study}/gates/evaluate and
 * POST /studies/{study}/package both 500'd with "permission denied for table
 * study_gates / study_packages". An audit found 8 further app tables in the
 * same state (agent_sessions, consent_decisions, note_nlp_audit,
 * parthenon_concept_map, parthenon_mapping_review_queue,
 * study_design_agent_sessions, study_packages, unmapped_concepts_queue).
 *
 * Per HIGHSEC §4.1 / project_parthenon_pg_roles: parthenon_migrator owns DDL;
 * parthenon_app holds runtime DML only and needs explicit GRANTs. Idempotent
 * and guarded so it is safe on fresh deploys and re-runs.
 */
return new class extends Migration
{
    /** @var list<string> */
    private array $tables = [
        'study_gates',
        'study_packages',
        'study_design_agent_sessions',
        'agent_sessions',
        'consent_decisions',
        'note_nlp_audit',
        'parthenon_concept_map',
        'parthenon_mapping_review_queue',
        'unmapped_concepts_queue',
    ];

    public function up(): void
    {
        foreach ($this->tables as $table) {
            DB::statement(<<<SQL
                DO \$\$
                BEGIN
                    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'parthenon_app')
                       AND EXISTS (SELECT 1 FROM information_schema.tables
                                   WHERE table_schema='app' AND table_name='{$table}') THEN
                        GRANT SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRIGGER ON app.{$table} TO parthenon_app;
                        IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
                                   WHERE n.nspname='app' AND c.relname='{$table}_id_seq' AND c.relkind='S') THEN
                            GRANT USAGE ON SEQUENCE app.{$table}_id_seq TO parthenon_app;
                        END IF;
                    END IF;
                END \$\$;
            SQL);
        }
    }

    public function down(): void
    {
        foreach ($this->tables as $table) {
            DB::statement(<<<SQL
                DO \$\$
                BEGIN
                    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'parthenon_app')
                       AND EXISTS (SELECT 1 FROM information_schema.tables
                                   WHERE table_schema='app' AND table_name='{$table}') THEN
                        REVOKE SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRIGGER ON app.{$table} FROM parthenon_app;
                        IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
                                   WHERE n.nspname='app' AND c.relname='{$table}_id_seq' AND c.relkind='S') THEN
                            REVOKE USAGE ON SEQUENCE app.{$table}_id_seq FROM parthenon_app;
                        END IF;
                    END IF;
                END \$\$;
            SQL);
        }
    }
};
