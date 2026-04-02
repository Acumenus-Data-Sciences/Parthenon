<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('source_measurement_stats', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('source_id');
            $table->integer('measurement_concept_id');
            $table->double('mean');
            $table->double('stddev');
            $table->integer('n_patients');
            $table->double('percentile_25')->nullable();
            $table->double('percentile_75')->nullable();
            $table->timestampTz('computed_at')->useCurrent();
            $table->unique(['source_id', 'measurement_concept_id']);
            $table->foreign('source_id')->references('id')->on('sources')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('source_measurement_stats');
    }
};
