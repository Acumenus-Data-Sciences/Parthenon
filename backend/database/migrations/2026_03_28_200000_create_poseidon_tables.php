<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('poseidon_schedules', function (Blueprint $table) {
            $table->id();
            $table->foreignId('source_id')->constrained('sources');
            $table->string('schedule_type', 20)->default('manual'); // manual, cron, sensor
            $table->string('cron_expr', 100)->nullable();
            $table->jsonb('sensor_config')->nullable();
            $table->boolean('is_active')->default(false);
            $table->string('dbt_selector', 255)->nullable();
            $table->timestampTz('last_run_at')->nullable();
            $table->timestampTz('next_run_at')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users');
            $table->timestampsTz();
            $table->softDeletesTz();
        });

        Schema::create('poseidon_runs', function (Blueprint $table) {
            $table->id();
            $table->string('dagster_run_id', 64)->unique();
            $table->foreignId('source_id')->nullable()->constrained('sources');
            $table->foreignId('schedule_id')->nullable()->constrained('poseidon_schedules');
            $table->string('run_type', 20); // incremental, full_refresh, vocabulary
            $table->string('status', 20)->default('pending'); // pending, running, success, failed, cancelled
            $table->timestampTz('started_at')->nullable();
            $table->timestampTz('completed_at')->nullable();
            $table->jsonb('stats')->nullable();
            $table->text('error_message')->nullable();
            $table->string('triggered_by', 20)->default('manual'); // manual, schedule, sensor
            $table->foreignId('created_by')->nullable()->constrained('users');
            $table->timestampsTz();

            $table->index('source_id', 'idx_poseidon_runs_source');
            $table->index('status', 'idx_poseidon_runs_status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('poseidon_runs');
        Schema::dropIfExists('poseidon_schedules');
    }
};
