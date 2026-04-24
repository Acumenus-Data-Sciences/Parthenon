<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('care_bundle_current_runs', function (Blueprint $table) {
            $table->foreignId('condition_bundle_id')
                ->constrained('condition_bundles')
                ->cascadeOnDelete();
            $table->foreignId('source_id')
                ->constrained('sources')
                ->cascadeOnDelete();
            $table->foreignId('care_bundle_run_id')
                ->constrained('care_bundle_runs');
            $table->timestamp('updated_at')->useCurrent();

            $table->primary(['condition_bundle_id', 'source_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('care_bundle_current_runs');
    }
};
