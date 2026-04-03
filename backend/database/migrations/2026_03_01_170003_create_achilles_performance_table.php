<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::connection('results')->hasTable('achilles_performance')) {
            return; // Table already exists — preserve data
        }

        Schema::connection('results')->create('achilles_performance', function (Blueprint $table) {
            $table->id();
            $table->integer('analysis_id');
            $table->decimal('elapsed_seconds', 10, 2)->nullable();
            $table->text('query_text')->nullable();
            $table->timestamp('executed_at')->useCurrent();

            $table->index('analysis_id', 'idx_achilles_perf_analysis');
        });
    }

    public function down(): void
    {
        // NEVER drop results.achilles_performance — contains computed analytics data.
    }
};
