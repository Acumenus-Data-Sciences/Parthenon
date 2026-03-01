<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('concept_set_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('concept_set_id')->constrained()->cascadeOnDelete();
            $table->integer('concept_id');
            $table->boolean('is_excluded')->default(false);
            $table->boolean('include_descendants')->default(true);
            $table->boolean('include_mapped')->default(false);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('concept_set_items');
    }
};
