<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::dropIfExists('gis_datasets');

        Schema::create('gis_imports', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained();
            $table->string('filename', 500);
            $table->string('import_mode', 50);
            $table->string('status', 50)->default('pending');
            $table->jsonb('column_mapping')->default('{}');
            $table->jsonb('abby_suggestions')->default('{}');
            $table->jsonb('config')->default('{}');
            $table->jsonb('summary_snapshot')->default('{}');
            $table->integer('row_count')->nullable();
            $table->integer('progress_percentage')->default(0);
            $table->jsonb('error_log')->default('[]');
            $table->text('log_output')->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('gis_imports');
    }
};
