<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Grant REFERENCES on condition_bundles, sources, and users to parthenon_owner
        // so the FK constraints below can be added when running as parthenon_owner.
        // Use SAVEPOINTs so a failed GRANT (role absent in CI) rolls back only to
        // the savepoint and does NOT poison the outer migration transaction.
        DB::unprepared('SAVEPOINT grant_refs_1');
        try {
            DB::statement('GRANT REFERENCES ON TABLE app.condition_bundles TO parthenon_owner');
            DB::unprepared('RELEASE SAVEPOINT grant_refs_1');
        } catch (Exception $e) {
            DB::unprepared('ROLLBACK TO SAVEPOINT grant_refs_1');
        }

        DB::unprepared('SAVEPOINT grant_refs_2');
        try {
            DB::statement('GRANT REFERENCES ON TABLE app.sources TO parthenon_owner');
            DB::unprepared('RELEASE SAVEPOINT grant_refs_2');
        } catch (Exception $e) {
            DB::unprepared('ROLLBACK TO SAVEPOINT grant_refs_2');
        }

        DB::unprepared('SAVEPOINT grant_refs_3');
        try {
            DB::statement('GRANT REFERENCES ON TABLE app.users TO parthenon_owner');
            DB::unprepared('RELEASE SAVEPOINT grant_refs_3');
        } catch (Exception $e) {
            DB::unprepared('ROLLBACK TO SAVEPOINT grant_refs_3');
        }

        // Ensure tables are owned by parthenon_owner so default privileges
        // fire and parthenon_app receives DML grants automatically.
        // Use a DO block so the SET ROLE is skipped gracefully when
        // parthenon_owner does not exist (CI fresh DB, bare test envs).
        DB::statement("
            DO \$\$
            BEGIN
                IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'parthenon_owner') THEN
                    SET ROLE parthenon_owner;
                END IF;
            END
            \$\$
        ");

        Schema::create('care_bundle_runs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('condition_bundle_id')
                ->constrained('condition_bundles')
                ->cascadeOnDelete();
            $table->foreignId('source_id')
                ->constrained('sources')
                ->cascadeOnDelete();
            $table->string('status', 32)->default('pending');
            // pending | running | completed | failed | stale
            $table->timestamp('started_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->foreignId('triggered_by')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();
            $table->string('trigger_kind', 16)->default('manual');
            // manual | scheduled | api
            $table->unsignedBigInteger('qualified_person_count')->nullable();
            $table->integer('measure_count')->nullable();
            $table->string('bundle_version', 32)->nullable();
            $table->string('cdm_fingerprint', 64)->nullable();
            $table->text('fail_message')->nullable();
            $table->timestamps();

            $table->index(['condition_bundle_id', 'source_id'], 'idx_cbr_bundle_source');
            $table->index('status', 'idx_cbr_status');
        });

        // Restore the original session role so subsequent statements (e.g. the
        // Laravel migrations recorder inserting into php.migrations) execute as
        // the connecting user, not parthenon_owner.
        DB::statement('RESET ROLE');
    }

    public function down(): void
    {
        Schema::dropIfExists('care_bundle_runs');
    }
};
