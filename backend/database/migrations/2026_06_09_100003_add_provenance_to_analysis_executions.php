<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Abby provenance spine (ADR-0020, Phase 1).
 *
 * Pin each analysis execution to the hash of the design it ran and the
 * vocabulary / CDM release of its source. Additive + nullable.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('analysis_executions', function (Blueprint $table) {
            $table->string('design_sha256', 64)->nullable();
            $table->string('vocabulary_version', 64)->nullable();
            $table->string('cdm_source_release', 64)->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('analysis_executions', function (Blueprint $table) {
            $table->dropColumn([
                'design_sha256',
                'vocabulary_version',
                'cdm_source_release',
            ]);
        });
    }
};
