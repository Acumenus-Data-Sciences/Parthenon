<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('etl_table_mappings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('etl_project_id')->constrained('etl_projects')->cascadeOnDelete();
            $table->string('source_table', 255);
            $table->string('target_table', 255);
            $table->text('logic')->nullable();
            $table->boolean('is_completed')->default(false);
            $table->boolean('is_stem')->default(false);
            $table->integer('sort_order')->default(0);
            $table->timestamps();

            $table->unique(['etl_project_id', 'source_table', 'target_table']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('etl_table_mappings');
    }
};
