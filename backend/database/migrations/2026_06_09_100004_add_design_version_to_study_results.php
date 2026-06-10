<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Abby provenance spine (ADR-0020, Phase 1).
 *
 * Bind a study result to the study-design version that produced it — the
 * weakest provenance link today. Additive + nullable; FK nulls on delete so it
 * never blocks a design-version cleanup.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('study_results', function (Blueprint $table) {
            $table->unsignedBigInteger('study_design_version_id')->nullable();
            $table->foreign('study_design_version_id')
                ->references('id')->on('study_design_versions')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('study_results', function (Blueprint $table) {
            $table->dropForeign(['study_design_version_id']);
            $table->dropColumn('study_design_version_id');
        });
    }
};
