<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('patient_similarity_runs', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id');
            $table->string('mode', 16);
            $table->string('name');
            $table->unsignedBigInteger('source_id')->nullable();
            $table->unsignedBigInteger('target_cohort_id')->nullable();
            $table->unsignedBigInteger('comparator_cohort_id')->nullable();
            $table->string('similarity_mode', 32)->default('auto');
            $table->jsonb('settings_json')->nullable();
            $table->string('status', 24)->default('draft');
            $table->timestamp('last_opened_at')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'mode', 'last_opened_at'], 'ps_runs_user_mode_opened_idx');
            $table->index(['source_id', 'target_cohort_id', 'comparator_cohort_id'], 'ps_runs_context_idx');
        });

        if (DB::connection()->getDriverName() === 'pgsql') {
            DB::unprepared(<<<'SQL'
                DO $grants$
                BEGIN
                    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'parthenon_app') THEN
                        GRANT SELECT, INSERT, UPDATE, DELETE ON app.patient_similarity_runs TO parthenon_app;
                        GRANT USAGE, SELECT ON SEQUENCE app.patient_similarity_runs_id_seq TO parthenon_app;
                    END IF;
                END
                $grants$
            SQL);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('patient_similarity_runs');
    }
};
