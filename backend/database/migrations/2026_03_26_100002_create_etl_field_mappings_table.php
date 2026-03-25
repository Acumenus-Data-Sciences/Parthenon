<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('etl_field_mappings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('etl_table_mapping_id')->constrained('etl_table_mappings')->cascadeOnDelete();
            $table->string('source_column', 255)->nullable();
            $table->string('target_column', 255);
            $table->string('mapping_type', 20)->default('direct');
            $table->text('logic')->nullable();
            $table->boolean('is_required')->default(false);
            $table->float('confidence')->nullable();
            $table->boolean('is_ai_suggested')->default(false);
            $table->boolean('is_reviewed')->default(false);
            $table->timestamps();

            $table->unique(['etl_table_mapping_id', 'target_column']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('etl_field_mappings');
    }
};
