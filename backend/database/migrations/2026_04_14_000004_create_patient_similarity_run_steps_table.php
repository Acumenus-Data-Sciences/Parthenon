<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('patient_similarity_run_steps', function (Blueprint $table) {
            $table->id();
            $table->foreignId('patient_similarity_run_id')
                ->constrained('patient_similarity_runs')
                ->cascadeOnDelete();
            $table->string('step_id', 32);
            $table->string('status', 24)->default('completed');
            $table->text('summary')->nullable();
            $table->jsonb('result_json');
            $table->string('result_hash', 64);
            $table->unsignedInteger('execution_time_ms')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();

            $table->unique(['patient_similarity_run_id', 'step_id'], 'ps_run_steps_unique');
            $table->index(['step_id', 'result_hash'], 'ps_run_steps_step_hash_idx');
        });

        if (DB::connection()->getDriverName() === 'pgsql') {
            DB::unprepared(<<<'SQL'
                DO $grants$
                BEGIN
                    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'parthenon_app') THEN
                        GRANT SELECT, INSERT, UPDATE, DELETE ON app.patient_similarity_run_steps TO parthenon_app;
                        GRANT USAGE, SELECT ON SEQUENCE app.patient_similarity_run_steps_id_seq TO parthenon_app;
                    END IF;
                END
                $grants$
            SQL);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('patient_similarity_run_steps');
    }
};
