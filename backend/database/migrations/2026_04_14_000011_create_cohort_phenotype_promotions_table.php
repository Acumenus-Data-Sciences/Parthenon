<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('cohort_phenotype_promotions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('cohort_definition_id')->constrained('cohort_definitions')->cascadeOnDelete();
            $table->foreignId('validation_id')->nullable()->constrained('cohort_phenotype_validations')->nullOnDelete();
            $table->foreignId('promoted_cohort_definition_id')->nullable()->constrained('cohort_definitions')->nullOnDelete();
            $table->string('status', 40)->default('promoted');
            $table->text('notes')->nullable();
            $table->foreignId('promoted_by')->nullable()->constrained('users');
            $table->timestamp('promoted_at')->nullable();
            $table->timestamps();

            $table->index(['cohort_definition_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cohort_phenotype_promotions');
    }
};
