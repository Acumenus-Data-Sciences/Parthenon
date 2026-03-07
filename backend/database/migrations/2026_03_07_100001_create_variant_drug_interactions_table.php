<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('variant_drug_interactions', function (Blueprint $table) {
            $table->id();
            $table->string('gene_symbol', 100);
            $table->string('hgvs_p', 200)->nullable();
            $table->string('variant_class', 50)->nullable(); // missense, nonsense, rearrangement, amplification
            $table->bigInteger('drug_concept_id')->nullable();
            $table->string('drug_name', 255);
            $table->string('relationship', 50); // sensitive, resistant, partial_response
            $table->text('mechanism')->nullable();
            $table->string('evidence_level', 50)->default('clinical_trial'); // fda_approved, nccn_guideline, clinical_trial, case_report, preclinical
            $table->string('confidence', 20)->default('medium'); // high, medium, low
            $table->text('evidence_summary')->nullable();
            $table->string('source_url')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->unique(['gene_symbol', 'hgvs_p', 'drug_name'], 'vdi_gene_variant_drug_unique');
            $table->index('gene_symbol');
            $table->index('drug_name');
            $table->index('relationship');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('variant_drug_interactions');
    }
};
