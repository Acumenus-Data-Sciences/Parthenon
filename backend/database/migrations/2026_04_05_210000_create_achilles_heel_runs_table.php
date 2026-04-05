<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('achilles_heel_runs', function (Blueprint $table) {
            $table->id();
            $table->string('run_id', 64)->unique();
            $table->foreignId('source_id')->constrained('sources');
            $table->string('status', 20)->default('pending');
            $table->unsignedInteger('total_rules')->default(0);
            $table->unsignedInteger('completed_rules')->default(0);
            $table->unsignedInteger('failed_rules')->default(0);
            $table->timestampTz('started_at')->nullable();
            $table->timestampTz('completed_at')->nullable();
            $table->text('error_message')->nullable();
            $table->timestampsTz();

            $table->index('source_id');
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('achilles_heel_runs');
    }
};
