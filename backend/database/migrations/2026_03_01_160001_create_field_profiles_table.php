<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('field_profiles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('source_profile_id')->constrained()->cascadeOnDelete();
            $table->string('column_name');
            $table->integer('column_index');
            $table->string('inferred_type', 20);
            $table->integer('non_null_count');
            $table->integer('null_count');
            $table->decimal('null_percentage', 5, 2);
            $table->integer('distinct_count');
            $table->decimal('distinct_percentage', 5, 2);
            $table->jsonb('top_values')->nullable();
            $table->jsonb('sample_values')->nullable();
            $table->jsonb('statistics')->nullable();
            $table->boolean('is_potential_pii')->default(false);
            $table->string('pii_type', 20)->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('field_profiles');
    }
};
