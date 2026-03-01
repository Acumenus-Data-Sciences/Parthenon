<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::connection('vocab')->create('relationships', function (Blueprint $table) {
            $table->string('relationship_id', 20)->primary();
            $table->string('relationship_name', 255);
            $table->string('is_hierarchical', 1);
            $table->string('defines_ancestry', 1);
            $table->string('reverse_relationship_id', 20);
            $table->integer('relationship_concept_id');
        });
    }

    public function down(): void
    {
        Schema::connection('vocab')->dropIfExists('relationships');
    }
};
