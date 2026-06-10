<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Clio provenance spine (ADR-0020, Phase 1).
 *
 * Capture the exact compiled SQL and the vocabulary / CDM release a cohort was
 * generated against, plus the definition hash at generation time. This is what
 * makes a generated cohort reproducible: you can recompile, re-pin, and verify
 * the definition did not mutate after the fact. Additive + nullable.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('cohort_generations', function (Blueprint $table) {
            $table->text('compiled_sql')->nullable();
            $table->string('expression_sha256', 64)->nullable();
            $table->string('vocabulary_version', 64)->nullable();
            $table->string('cdm_source_release', 64)->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('cohort_generations', function (Blueprint $table) {
            $table->dropColumn([
                'compiled_sql',
                'expression_sha256',
                'vocabulary_version',
                'cdm_source_release',
            ]);
        });
    }
};
