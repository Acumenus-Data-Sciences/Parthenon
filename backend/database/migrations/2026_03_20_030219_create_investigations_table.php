<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('investigations', function (Blueprint $table) {
            $table->id();
            $table->string('title', 255);
            $table->text('research_question')->nullable();
            $table->string('status', 20)->default('draft');
            $table->foreignId('owner_id')->constrained('users')->cascadeOnDelete();
            $table->jsonb('phenotype_state')->default('{}');
            $table->jsonb('clinical_state')->default('{}');
            $table->jsonb('genomic_state')->default('{}');
            $table->jsonb('synthesis_state')->default('{}');
            $table->timestamp('completed_at')->nullable();
            $table->foreignId('last_modified_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index('owner_id');
            $table->index('status');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('investigations');
    }
};
