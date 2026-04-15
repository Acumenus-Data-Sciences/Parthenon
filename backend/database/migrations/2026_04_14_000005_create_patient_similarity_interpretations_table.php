<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('patient_similarity_interpretations', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id');
            $table->foreignId('patient_similarity_run_id')
                ->nullable()
                ->constrained('patient_similarity_runs')
                ->nullOnDelete();
            $table->foreignId('patient_similarity_run_step_id')
                ->nullable()
                ->constrained('patient_similarity_run_steps')
                ->nullOnDelete();
            $table->string('mode', 16);
            $table->string('step_id', 32);
            $table->unsignedBigInteger('source_id')->nullable();
            $table->unsignedBigInteger('target_cohort_id')->nullable();
            $table->unsignedBigInteger('comparator_cohort_id')->nullable();
            $table->string('result_hash', 64);
            $table->string('provider')->nullable();
            $table->string('model')->nullable();
            $table->string('status', 24);
            $table->text('summary')->nullable();
            $table->text('interpretation')->nullable();
            $table->jsonb('clinical_implications')->nullable();
            $table->jsonb('methodologic_cautions')->nullable();
            $table->jsonb('recommended_next_steps')->nullable();
            $table->decimal('confidence', 4, 3)->default(0);
            $table->jsonb('sanitized_result')->nullable();
            $table->text('error')->nullable();
            $table->text('raw_response')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'mode', 'step_id', 'result_hash'], 'ps_interp_user_step_hash_idx');
            $table->index(['patient_similarity_run_id', 'step_id'], 'ps_interp_run_step_idx');
        });

        if (DB::connection()->getDriverName() === 'pgsql') {
            DB::unprepared(<<<'SQL'
                DO $grants$
                BEGIN
                    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'parthenon_app') THEN
                        GRANT SELECT, INSERT, UPDATE, DELETE ON app.patient_similarity_interpretations TO parthenon_app;
                        GRANT USAGE, SELECT ON SEQUENCE app.patient_similarity_interpretations_id_seq TO parthenon_app;
                    END IF;
                END
                $grants$
            SQL);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('patient_similarity_interpretations');
    }
};
