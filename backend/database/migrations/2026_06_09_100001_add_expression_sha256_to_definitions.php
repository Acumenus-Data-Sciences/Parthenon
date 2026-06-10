<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Abby provenance spine (ADR-0020, Phase 1).
 *
 * Content-addressable hash of the canonicalized definition expression. Lets a
 * cohort / study record exactly which version of a concept set or cohort
 * definition it was built from, and detects silent post-hoc mutation.
 * Additive + nullable: no behaviour change to existing reads.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('concept_sets', function (Blueprint $table) {
            $table->string('expression_sha256', 64)->nullable()->index();
        });

        Schema::table('cohort_definitions', function (Blueprint $table) {
            $table->string('expression_sha256', 64)->nullable()->index();
        });
    }

    public function down(): void
    {
        Schema::table('concept_sets', function (Blueprint $table) {
            $table->dropColumn('expression_sha256');
        });

        Schema::table('cohort_definitions', function (Blueprint $table) {
            $table->dropColumn('expression_sha256');
        });
    }
};
