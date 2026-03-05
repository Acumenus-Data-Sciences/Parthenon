<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('genomic_uploads', function (Blueprint $table) {
            $table->id();
            $table->foreignId('source_id')->constrained('sources')->cascadeOnDelete();
            $table->foreignId('created_by')->constrained('users');
            $table->string('filename');
            $table->string('file_format', 20); // vcf, maf, fhir_genomics, cbio_maf
            $table->bigInteger('file_size_bytes')->default(0);
            $table->string('status', 30)->default('pending'); // pending, parsing, mapped, review, imported, failed
            $table->string('genome_build', 20)->nullable(); // GRCh38, GRCh37
            $table->string('sample_id')->nullable();
            $table->integer('total_variants')->default(0);
            $table->integer('mapped_variants')->default(0);
            $table->integer('review_required')->default(0);
            $table->text('error_message')->nullable();
            $table->string('storage_path')->nullable();
            $table->timestamp('parsed_at')->nullable();
            $table->timestamp('imported_at')->nullable();
            $table->timestamps();

            $table->index(['source_id', 'status']);
            $table->index('created_by');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('genomic_uploads');
    }
};
