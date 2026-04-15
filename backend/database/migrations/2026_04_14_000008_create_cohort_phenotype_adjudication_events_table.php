<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('cohort_phenotype_adjudication_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('phenotype_validation_id')
                ->constrained('cohort_phenotype_validations')
                ->cascadeOnDelete();
            $table->foreignId('adjudication_id')
                ->constrained('cohort_phenotype_adjudications')
                ->cascadeOnDelete();
            $table->foreignId('actor_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('event_type', 64);
            $table->jsonb('before_json')->nullable();
            $table->jsonb('after_json')->nullable();
            $table->timestamps();

            $table->index(['phenotype_validation_id', 'created_at']);
            $table->index(['adjudication_id', 'created_at']);
        });

        if (DB::connection()->getDriverName() === 'pgsql') {
            DB::unprepared(<<<'SQL'
                DO $grants$
                BEGIN
                    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'parthenon_app') THEN
                        GRANT SELECT, INSERT, UPDATE, DELETE ON app.cohort_phenotype_adjudication_events TO parthenon_app;
                        GRANT USAGE, SELECT ON SEQUENCE app.cohort_phenotype_adjudication_events_id_seq TO parthenon_app;
                    END IF;
                END
                $grants$
            SQL);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('cohort_phenotype_adjudication_events');
    }
};
