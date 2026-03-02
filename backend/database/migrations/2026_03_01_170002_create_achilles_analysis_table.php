<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::connection('results')->create('achilles_analysis', function (Blueprint $table) {
            $table->integer('analysis_id')->primary();
            $table->string('analysis_name');
            $table->string('stratum_1_name')->nullable();
            $table->string('stratum_2_name')->nullable();
            $table->string('stratum_3_name')->nullable();
            $table->string('stratum_4_name')->nullable();
            $table->string('stratum_5_name')->nullable();
            $table->string('analysis_type', 50)->nullable();
            $table->string('category', 100)->nullable();
        });
    }

    public function down(): void
    {
        Schema::connection('results')->dropIfExists('achilles_analysis');
    }
};
