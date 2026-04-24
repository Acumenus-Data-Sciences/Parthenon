<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('care_bundle_qualifications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('care_bundle_run_id')
                ->constrained('care_bundle_runs')
                ->cascadeOnDelete();
            $table->foreignId('condition_bundle_id')
                ->constrained('condition_bundles');
            $table->foreignId('source_id')
                ->constrained('sources');
            $table->bigInteger('person_id');
            // CDM person_id, NOT app.users.id
            $table->boolean('qualifies')->default(true);
            $table->jsonb('measure_summary')->nullable();
            // { "<measure_id>": {"denom": true, "numer": false}, ... }
            $table->timestamp('created_at')->useCurrent();

            $table->unique(['care_bundle_run_id', 'person_id'], 'uq_cbq_run_person');
            $table->index(['source_id', 'condition_bundle_id'], 'idx_cbq_source_bundle');
            $table->index(['person_id', 'source_id'], 'idx_cbq_person_source');
            $table->index('care_bundle_run_id', 'idx_cbq_run');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('care_bundle_qualifications');
    }
};
