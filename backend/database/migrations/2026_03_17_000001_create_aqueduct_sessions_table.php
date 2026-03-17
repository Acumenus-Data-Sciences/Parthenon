<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('aqueduct_sessions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('source_id')->nullable()->constrained('sources')->nullOnDelete();
            $table->string('name', 255);
            $table->string('cdm_version', 10)->default('5.4');
            $table->string('scan_report_name', 255)->nullable();
            $table->string('scan_report_path', 500)->nullable();
            $table->jsonb('source_schema')->default('[]');
            $table->jsonb('mapping_config')->default('{}');
            $table->string('status', 20)->default('draft');
            $table->timestamps();
            $table->softDeletes();

            $table->index('user_id');
            $table->index('source_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('aqueduct_sessions');
    }
};
