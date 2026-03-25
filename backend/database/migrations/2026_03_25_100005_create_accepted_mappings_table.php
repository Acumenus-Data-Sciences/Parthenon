<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('accepted_mappings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('source_id')->constrained('app.sources')->cascadeOnDelete();
            $table->string('source_code', 255);
            $table->string('source_vocabulary_id', 50);
            $table->integer('target_concept_id');
            $table->string('target_concept_name', 500)->nullable();
            $table->string('mapping_method', 50)->default('manual');
            $table->decimal('confidence', 5, 4)->nullable();
            $table->foreignId('reviewed_by')->nullable()->constrained('app.users');
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamps();
            $table->unique(['source_id', 'source_code', 'source_vocabulary_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('accepted_mappings');
    }
};
