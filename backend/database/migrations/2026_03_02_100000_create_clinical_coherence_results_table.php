<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('clinical_coherence_results', function (Blueprint $table) {
            $table->id();
            $table->foreignId('source_id')->constrained('sources')->cascadeOnDelete();
            $table->string('analysis_id', 10);      // 'CC001' … 'CC006'
            $table->string('analysis_name', 255);
            $table->string('category', 100);
            $table->string('severity', 20)->default('informational'); // critical | major | informational
            $table->string('stratum_1', 255)->nullable();
            $table->string('stratum_2', 255)->nullable();
            $table->string('stratum_3', 255)->nullable();
            $table->bigInteger('count_value')->nullable();
            $table->bigInteger('total_value')->nullable();
            $table->decimal('ratio_value', 10, 6)->nullable();
            $table->boolean('flagged')->default(false);
            $table->text('notes')->nullable();
            $table->timestampTz('run_at');
            $table->timestamps();
        });

        // Speed up per-source queries and API grouping
        Schema::table('clinical_coherence_results', function (Blueprint $table) {
            $table->index(['source_id', 'severity']);
            $table->index(['source_id', 'analysis_id']);
            $table->index(['source_id', 'flagged']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('clinical_coherence_results');
    }
};
