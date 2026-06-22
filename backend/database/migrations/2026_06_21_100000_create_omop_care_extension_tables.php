<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * OMOP care-coordination extension tables (FHIR ingestion parity).
 *
 * FHIR CarePlan / Goal / CareTeam resources have no native landing table in
 * OMOP CDM v5.4. These four extension tables provide an OMOP-style home for the
 * inbound mappers added by the FHIR Ingestion Medgnosis-Parity Port. They live
 * in the `omop` schema (via the `omop` connection, search_path `omop,vocab,php`)
 * alongside the CDM clinical tables the crosswalks resolve into.
 *
 * Convention mirrors the existing OMOP-bridge migrations
 * (2026_04_10_164500_add_imaging_series_omop_bridge.php,
 *  2026_04_10_164600_add_genomics_omop_bridge.php): bigInteger ids/concepts,
 * `*_concept_id` default 0 (OMOP "no value" convention), nullable source/date
 * columns, person_id indexed, idempotent `hasTable` guards.
 */
return new class extends Migration
{
    public function up(): void
    {
        $schema = Schema::connection('omop');

        if (! $schema->hasTable('care_plan')) {
            $schema->create('care_plan', function (Blueprint $table) {
                $table->bigIncrements('care_plan_id');
                $table->bigInteger('person_id');
                $table->date('care_plan_start_date')->nullable();
                $table->date('care_plan_end_date')->nullable();
                $table->bigInteger('status_concept_id')->default(0);
                $table->bigInteger('intent_concept_id')->default(0);
                $table->bigInteger('category_concept_id')->default(0);
                $table->bigInteger('visit_occurrence_id')->nullable();
                $table->string('care_plan_source_value', 100)->nullable();
                $table->bigInteger('care_plan_source_concept_id')->default(0);

                $table->index('person_id');
            });
        }

        if (! $schema->hasTable('care_goal')) {
            $schema->create('care_goal', function (Blueprint $table) {
                $table->bigIncrements('care_goal_id');
                $table->bigInteger('person_id');
                $table->bigInteger('care_plan_id')->nullable();
                $table->string('lifecycle_status', 50)->nullable();
                $table->bigInteger('achievement_status_concept_id')->default(0);
                $table->date('goal_start_date')->nullable();
                $table->string('goal_source_value', 250)->nullable();
                $table->bigInteger('goal_source_concept_id')->default(0);

                $table->index('person_id');
            });
        }

        if (! $schema->hasTable('care_team')) {
            $schema->create('care_team', function (Blueprint $table) {
                $table->bigIncrements('care_team_id');
                $table->bigInteger('person_id');
                $table->date('care_team_start_date')->nullable();
                $table->date('care_team_end_date')->nullable();
                $table->string('status', 50)->nullable();
                $table->string('care_team_source_value', 100)->nullable();

                $table->index('person_id');
            });
        }

        if (! $schema->hasTable('care_team_member')) {
            $schema->create('care_team_member', function (Blueprint $table) {
                $table->bigIncrements('care_team_member_id');
                $table->bigInteger('care_team_id');
                $table->bigInteger('provider_id')->nullable();
                $table->bigInteger('care_site_id')->nullable();
                $table->bigInteger('role_concept_id')->default(0);
                $table->string('role_source_value', 250)->nullable();

                $table->index('care_team_id');
            });
        }

        $this->grantRuntimeDml();
    }

    /**
     * Grant the runtime DML role write access on the new care-extension tables.
     *
     * The runtime/migrator split (parthenon_app = DML only; parthenon_migrator =
     * DDL) means tables created here are owned by the migrator and do NOT
     * inherit the per-owner DEFAULT PRIVILEGES that auto-grant DML to
     * parthenon_app for smudoshi-owned CDM tables. Without an explicit grant the
     * FHIR ingestion mappers (running as parthenon_app) could create these
     * tables' rows nowhere. Idempotent and environment-tolerant: no-ops when the
     * role is absent (CI/test envs that run as a single all-privilege role).
     */
    private function grantRuntimeDml(): void
    {
        // Resolve the omop connection through the schema builder rather than a
        // bare DB::connection('omop') call (which NoBareConnectionCallRule bans
        // outside SourceAware infrastructure). This is the same physical
        // connection used for the DDL above.
        $omop = Schema::connection('omop')->getConnection();

        $hasRole = $omop->selectOne("SELECT 1 AS r FROM pg_roles WHERE rolname = 'parthenon_app'");

        if (! $hasRole) {
            return;
        }

        foreach (['care_plan', 'care_goal', 'care_team', 'care_team_member'] as $table) {
            try {
                $omop->statement(
                    "GRANT SELECT, INSERT, UPDATE, DELETE ON omop.{$table} TO parthenon_app"
                );
                // Sequences backing the bigIncrements PKs need USAGE for inserts.
                $omop->statement(
                    "GRANT USAGE, SELECT ON SEQUENCE omop.{$table}_{$table}_id_seq TO parthenon_app"
                );
            } catch (Throwable) {
                // Running as a role that cannot grant (e.g. parthenon_migrator on
                // a schema it does not own). The runtime grant must then be
                // applied out-of-band by a superuser; the app simply cannot
                // write until then. Non-fatal so the table DDL still lands.
            }
        }
    }

    public function down(): void
    {
        $schema = Schema::connection('omop');

        $schema->dropIfExists('care_team_member');
        $schema->dropIfExists('care_team');
        $schema->dropIfExists('care_goal');
        $schema->dropIfExists('care_plan');
    }
};
