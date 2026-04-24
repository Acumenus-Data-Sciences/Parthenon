<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('care_bundle_runs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('condition_bundle_id')
                ->constrained('condition_bundles')
                ->cascadeOnDelete();
            $table->foreignId('source_id')
                ->constrained('sources')
                ->cascadeOnDelete();
            $table->string('status', 32)->default('pending');
            // pending | running | completed | failed | stale
            $table->timestamp('started_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->foreignId('triggered_by')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();
            $table->string('trigger_kind', 16)->default('manual');
            // manual | scheduled | api
            $table->unsignedBigInteger('qualified_person_count')->nullable();
            $table->integer('measure_count')->nullable();
            $table->string('bundle_version', 32)->nullable();
            $table->string('cdm_fingerprint', 64)->nullable();
            $table->text('fail_message')->nullable();
            $table->timestamps();

            $table->index(['condition_bundle_id', 'source_id'], 'idx_cbr_bundle_source');
            $table->index('status', 'idx_cbr_status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('care_bundle_runs');
    }
};
