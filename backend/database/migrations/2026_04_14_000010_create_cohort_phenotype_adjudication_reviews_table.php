<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('cohort_phenotype_adjudication_reviews', function (Blueprint $table) {
            $table->id();
            $table->foreignId('phenotype_validation_id')
                ->constrained('cohort_phenotype_validations')
                ->cascadeOnDelete();
            $table->foreignId('adjudication_id')
                ->constrained('cohort_phenotype_adjudications')
                ->cascadeOnDelete();
            $table->foreignId('reviewer_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('label', 32)->nullable();
            $table->text('notes')->nullable();
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamps();

            $table->unique(['adjudication_id', 'reviewer_id']);
            $table->index(['phenotype_validation_id', 'label']);
            $table->index(['phenotype_validation_id', 'reviewer_id']);
        });

        if (DB::connection()->getDriverName() === 'pgsql') {
            DB::unprepared(<<<'SQL'
                DO $grants$
                BEGIN
                    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'parthenon_app') THEN
                        GRANT SELECT, INSERT, UPDATE, DELETE ON app.cohort_phenotype_adjudication_reviews TO parthenon_app;
                        GRANT USAGE, SELECT ON SEQUENCE app.cohort_phenotype_adjudication_reviews_id_seq TO parthenon_app;
                    END IF;
                END
                $grants$
            SQL);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('cohort_phenotype_adjudication_reviews');
    }
};
