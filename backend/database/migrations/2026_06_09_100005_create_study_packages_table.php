<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Clio provenance spine (ADR-0020, Phase 1).
 *
 * An atomic, exportable snapshot of a study: concept-set + cohort hashes,
 * compiled SQL fingerprints, analysis designs, results, vocabulary / CDM
 * release, and (from Phase 3) the gate-ledger decision trail. This is the unit
 * a collaborator re-runs or a reviewer audits. `bundle_sha256` fingerprints the
 * whole snapshot for tamper-evidence.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('study_packages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('study_id')->constrained()->cascadeOnDelete();
            $table->integer('version')->default(1);
            $table->jsonb('bundle_json');
            $table->string('bundle_sha256', 64);
            $table->string('vocabulary_version', 64)->nullable();
            $table->string('cdm_source_release', 64)->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('tenant_id')->nullable();
            $table->timestamps();

            $table->foreign('created_by')->references('id')->on('users')->nullOnDelete();
            $table->unique(['study_id', 'version']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('study_packages');
    }
};
