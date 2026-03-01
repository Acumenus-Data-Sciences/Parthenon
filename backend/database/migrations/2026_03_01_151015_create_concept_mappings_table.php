<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('concept_mappings', function (Blueprint $table) {
            $table->id();
            $table->string('source_code', 50);
            $table->text('source_description')->nullable();
            $table->string('source_vocabulary_id', 20)->nullable();
            $table->integer('target_concept_id')->nullable();
            $table->decimal('confidence', 5, 4)->nullable();
            $table->string('strategy')->nullable();
            $table->boolean('is_reviewed')->default(false);
            $table->foreignId('reviewer_id')->nullable()->constrained('users');
            $table->timestamps();

            $table->index('source_code');
            $table->index('target_concept_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('concept_mappings');
    }
};
