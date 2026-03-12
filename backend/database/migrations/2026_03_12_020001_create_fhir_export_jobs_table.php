<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('fhir_export_jobs', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->unsignedBigInteger('source_id');
            $table->string('status', 20)->default('pending');
            $table->jsonb('resource_types');
            $table->timestamp('since')->nullable();
            $table->jsonb('patient_ids')->nullable();
            $table->jsonb('files')->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('finished_at')->nullable();
            $table->text('error_message')->nullable();
            $table->unsignedBigInteger('user_id');
            $table->timestamps();

            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('fhir_export_jobs');
    }
};
