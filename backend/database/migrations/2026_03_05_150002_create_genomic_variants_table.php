<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('genomic_variants', function (Blueprint $table) {
            $table->id();
            $table->foreignId('upload_id')->constrained('genomic_uploads')->cascadeOnDelete();
            $table->foreignId('source_id')->constrained('sources')->cascadeOnDelete();
            $table->bigInteger('person_id')->nullable(); // matched OMOP person_id
            $table->string('sample_id')->nullable();

            // Variant coordinates
            $table->string('chromosome', 10);
            $table->bigInteger('position');
            $table->string('reference_allele', 500);
            $table->string('alternate_allele', 500);
            $table->string('genome_build', 20)->nullable(); // GRCh38, GRCh37

            // Gene / functional annotation (from SnpEff/VEP or MAF)
            $table->string('gene_symbol', 100)->nullable();
            $table->string('hgvs_c', 500)->nullable(); // coding change c.2369C>T
            $table->string('hgvs_p', 500)->nullable(); // protein change p.Ala790Val
            $table->string('variant_type', 50)->nullable(); // SNP, INS, DEL, CNV, FUSION
            $table->string('variant_class', 50)->nullable(); // missense, nonsense, frameshift, splice_site
            $table->string('consequence', 100)->nullable(); // VEP consequence term

            // Quality
            $table->decimal('quality', 10, 2)->nullable();
            $table->string('filter_status', 50)->nullable(); // PASS, FAIL, etc.
            $table->string('zygosity', 20)->nullable(); // heterozygous, homozygous, unknown
            $table->decimal('allele_frequency', 8, 6)->nullable();
            $table->integer('read_depth')->nullable();

            // Clinical annotation
            $table->string('clinvar_id', 50)->nullable();
            $table->string('clinvar_significance', 100)->nullable(); // Pathogenic, Likely pathogenic, VUS
            $table->string('cosmic_id', 50)->nullable();
            $table->decimal('tmb_contribution', 8, 4)->nullable();
            $table->boolean('is_msi_marker')->default(false);

            // OMOP mapping
            $table->bigInteger('measurement_concept_id')->default(0);
            $table->string('measurement_source_value', 500)->nullable();
            $table->bigInteger('value_as_concept_id')->nullable();
            $table->string('mapping_status', 30)->default('unmapped'); // mapped, unmapped, review
            $table->bigInteger('omop_measurement_id')->nullable(); // FK to omop.measurement

            // Raw record
            $table->jsonb('raw_info')->nullable();
            $table->timestamps();

            $table->index(['source_id', 'gene_symbol']);
            $table->index(['source_id', 'person_id']);
            $table->index(['upload_id', 'mapping_status']);
            $table->index('clinvar_significance');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('genomic_variants');
    }
};
