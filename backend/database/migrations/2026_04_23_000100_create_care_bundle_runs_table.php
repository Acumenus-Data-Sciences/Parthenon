<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Grant REFERENCES on condition_bundles to parthenon_owner so the FK
        // constraint below can be added when running as parthenon_owner.
        // condition_bundles was created in an earlier migration (2026_03_02)
        // before the parthenon_owner pattern was adopted; its REFERENCES
        // privilege must be granted explicitly. This statement is idempotent.
        // Skipped gracefully if the role does not exist (e.g. bare test envs).
        try {
            DB::statement('GRANT REFERENCES ON TABLE app.condition_bundles TO parthenon_owner');
        } catch (Exception $e) {
            // Role may not exist in all environments (CI fresh DB, local dev);
            // the FK will still succeed when running as a superuser.
        }

        // Ensure tables are owned by parthenon_owner so default privileges
        // fire and parthenon_app receives DML grants automatically.
        DB::statement('SET ROLE parthenon_owner');

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
    }

    public function down(): void
    {
        Schema::dropIfExists('care_bundle_runs');
    }
};
