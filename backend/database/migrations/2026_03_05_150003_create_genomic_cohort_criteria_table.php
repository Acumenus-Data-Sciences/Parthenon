<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Stores saved genomic criteria blocks that can be referenced in cohort definitions.
     * Each record represents one genomic filter (e.g. "EGFR L858R present").
     */
    public function up(): void
    {
        Schema::create('genomic_cohort_criteria', function (Blueprint $table) {
            $table->id();
            $table->foreignId('created_by')->constrained('users');
            $table->string('name', 200);
            $table->string('criteria_type', 50); // gene_mutation, tmb, msi, fusion, pathogenicity, treatment_episode
            $table->jsonb('criteria_definition'); // structured spec for the criterion
            $table->string('description')->nullable();
            $table->boolean('is_shared')->default(false);
            $table->timestamps();

            $table->index(['criteria_type']);
            $table->index('created_by');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('genomic_cohort_criteria');
    }
};
