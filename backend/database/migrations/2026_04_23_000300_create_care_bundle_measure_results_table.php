<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Grant REFERENCES on tables created before parthenon_owner pattern was
        // adopted; needed when running as parthenon_owner. Idempotent. Skipped
        // gracefully if role is absent (CI fresh DB, bare test envs).
        try {
            DB::statement('GRANT REFERENCES ON TABLE app.quality_measures TO parthenon_owner');
        } catch (Exception $e) {
            // Role may not exist in all environments; FK will succeed as superuser.
        }

        try {
            DB::statement('GRANT REFERENCES ON TABLE app.cohort_definitions TO parthenon_owner');
        } catch (Exception $e) {
            // Role may not exist in all environments; FK will succeed as superuser.
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

        Schema::create('care_bundle_measure_results', function (Blueprint $table) {
            $table->id();
            $table->foreignId('care_bundle_run_id')
                ->constrained('care_bundle_runs')
                ->cascadeOnDelete();
            $table->foreignId('quality_measure_id')
                ->constrained('quality_measures');
            $table->unsignedBigInteger('denominator_count')->default(0);
            $table->unsignedBigInteger('numerator_count')->default(0);
            $table->unsignedBigInteger('exclusion_count')->default(0);
            $table->decimal('rate', 6, 4)->nullable();
            $table->foreignId('denominator_cohort_definition_id')
                ->nullable()
                ->constrained('cohort_definitions')
                ->nullOnDelete();
            $table->foreignId('numerator_cohort_definition_id')
                ->nullable()
                ->constrained('cohort_definitions')
                ->nullOnDelete();
            $table->timestamp('computed_at')->useCurrent();

            $table->unique(['care_bundle_run_id', 'quality_measure_id'], 'uq_cbmr_run_measure');
            $table->index('care_bundle_run_id', 'idx_cbmr_run');
            $table->index('quality_measure_id', 'idx_cbmr_measure');
        });

        // Restore the original session role so subsequent statements execute as
        // the connecting user, not parthenon_owner.
        DB::statement('RESET ROLE');
    }

    public function down(): void
    {
        Schema::dropIfExists('care_bundle_measure_results');
    }
};
