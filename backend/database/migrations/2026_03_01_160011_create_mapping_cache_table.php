<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('mapping_cache', function (Blueprint $table) {
            $table->id();
            $table->string('source_code', 50);
            $table->text('source_description')->nullable();
            $table->string('source_vocabulary_id', 20)->nullable();
            $table->integer('target_concept_id');
            $table->decimal('confidence', 5, 4);
            $table->string('strategy', 30);
            $table->unsignedInteger('times_confirmed')->default(1);
            $table->timestamp('last_confirmed_at');
            $table->timestamps();

            $table->index('source_code');
            $table->index(['source_code', 'source_vocabulary_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('mapping_cache');
    }
};
