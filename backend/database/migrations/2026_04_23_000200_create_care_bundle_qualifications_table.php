<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Grant REFERENCES on sources and condition_bundles to parthenon_owner so
        // the FK constraints below can be added when running as that role.
        // Use SAVEPOINTs so a failed GRANT (role absent in CI) rolls back only to
        // the savepoint and does NOT poison the outer migration transaction.
        DB::unprepared('SAVEPOINT grant_refs_1');
        try {
            DB::statement('GRANT REFERENCES ON TABLE app.sources TO parthenon_owner');
            DB::unprepared('RELEASE SAVEPOINT grant_refs_1');
        } catch (Exception $e) {
            DB::unprepared('ROLLBACK TO SAVEPOINT grant_refs_1');
        }

        DB::unprepared('SAVEPOINT grant_refs_2');
        try {
            DB::statement('GRANT REFERENCES ON TABLE app.condition_bundles TO parthenon_owner');
            DB::unprepared('RELEASE SAVEPOINT grant_refs_2');
        } catch (Exception $e) {
            DB::unprepared('ROLLBACK TO SAVEPOINT grant_refs_2');
        }

        // Conditional SET ROLE — skips gracefully when parthenon_owner is absent
        // (CI fresh DB, bare test envs) so the superuser caller proceeds directly.
        DB::statement("
            DO \$\$
            BEGIN
                IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'parthenon_owner') THEN
                    SET ROLE parthenon_owner;
                END IF;
            END
            \$\$
        ");

        Schema::create('care_bundle_qualifications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('care_bundle_run_id')
                ->constrained('care_bundle_runs')
                ->cascadeOnDelete();
            $table->foreignId('condition_bundle_id')
                ->constrained('condition_bundles');
            $table->foreignId('source_id')
                ->constrained('sources');
            $table->bigInteger('person_id');
            // CDM person_id, NOT app.users.id
            $table->boolean('qualifies')->default(true);
            $table->jsonb('measure_summary')->nullable();
            // { "<measure_id>": {"denom": true, "numer": false}, ... }
            $table->timestamp('created_at')->useCurrent();

            $table->unique(['care_bundle_run_id', 'person_id'], 'uq_cbq_run_person');
            $table->index(['source_id', 'condition_bundle_id'], 'idx_cbq_source_bundle');
            $table->index(['person_id', 'source_id'], 'idx_cbq_person_source');
            $table->index('care_bundle_run_id', 'idx_cbq_run');
        });

        // Restore the original session role so subsequent statements execute as
        // the connecting user, not parthenon_owner.
        DB::statement('RESET ROLE');
    }

    public function down(): void
    {
        Schema::dropIfExists('care_bundle_qualifications');
    }
};
