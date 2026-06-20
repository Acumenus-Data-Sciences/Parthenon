<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Aligns the phenotype-adjudication and promotion schema with the multi-reviewer
 * adjudication contract (PhenotypeValidationController). The reviewer column on
 * adjudications becomes `reviewer_id` to match the reviews table, and the
 * promotion record gains an explicit approver, the promoted tier, and a quality
 * summary snapshot. The feature surface is gated behind the (previously skipped)
 * contract tests, so these tables carry no production data.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('cohort_phenotype_adjudications', function (Blueprint $table) {
            $table->renameColumn('reviewed_by', 'reviewer_id');
        });

        Schema::table('cohort_phenotype_promotions', function (Blueprint $table) {
            $table->renameColumn('validation_id', 'phenotype_validation_id');
            $table->renameColumn('promoted_by', 'approver_id');
        });

        Schema::table('cohort_phenotype_promotions', function (Blueprint $table) {
            $table->string('promoted_quality_tier', 40)->nullable()->after('status');
            $table->jsonb('quality_summary_json')->nullable()->after('promoted_quality_tier');
        });
    }

    public function down(): void
    {
        Schema::table('cohort_phenotype_promotions', function (Blueprint $table) {
            $table->dropColumn(['promoted_quality_tier', 'quality_summary_json']);
        });

        Schema::table('cohort_phenotype_promotions', function (Blueprint $table) {
            $table->renameColumn('phenotype_validation_id', 'validation_id');
            $table->renameColumn('approver_id', 'promoted_by');
        });

        Schema::table('cohort_phenotype_adjudications', function (Blueprint $table) {
            $table->renameColumn('reviewer_id', 'reviewed_by');
        });
    }
};
