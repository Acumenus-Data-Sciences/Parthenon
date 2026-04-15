<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('cohort_authoring_artifacts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('cohort_definition_id')->nullable()
                ->constrained('cohort_definitions')
                ->nullOnDelete();
            $table->foreignId('author_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('direction', 16);
            $table->string('format', 32);
            $table->jsonb('artifact_json');
            $table->jsonb('metadata_json')->nullable();
            $table->timestamps();

            $table->index(['cohort_definition_id', 'created_at']);
            $table->index(['direction', 'format']);
        });

        if (DB::connection()->getDriverName() === 'pgsql') {
            DB::unprepared(<<<'SQL'
                DO $grants$
                BEGIN
                    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'parthenon_app') THEN
                        GRANT SELECT, INSERT, UPDATE, DELETE ON app.cohort_authoring_artifacts TO parthenon_app;
                        GRANT USAGE, SELECT ON SEQUENCE app.cohort_authoring_artifacts_id_seq TO parthenon_app;
                    END IF;
                END
                $grants$
            SQL);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('cohort_authoring_artifacts');
    }
};
