<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('ingestion_jobs', function (Blueprint $table) {
            $table->string('current_step', 30)->nullable();
            $table->unsignedTinyInteger('progress_percentage')->default(0);
            $table->text('error_message')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users');
        });
    }

    public function down(): void
    {
        Schema::table('ingestion_jobs', function (Blueprint $table) {
            $table->dropForeign(['created_by']);
            $table->dropColumn(['current_step', 'progress_percentage', 'error_message', 'created_by']);
        });
    }
};
