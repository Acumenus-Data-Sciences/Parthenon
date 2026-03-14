<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('commons_object_references', function (Blueprint $table) {
            $table->id();
            $table->foreignId('message_id')->constrained('commons_messages')->cascadeOnDelete();
            $table->string('referenceable_type', 50); // 'cohort_definition' | 'concept_set' | 'study' | 'source'
            $table->unsignedBigInteger('referenceable_id');
            $table->string('display_name', 255); // Cached name for rendering
            $table->timestamp('created_at')->useCurrent();

            $table->index('message_id');
            $table->index(['referenceable_type', 'referenceable_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('commons_object_references');
    }
};
