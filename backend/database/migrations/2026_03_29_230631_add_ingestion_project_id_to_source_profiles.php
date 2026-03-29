<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('source_profiles', function (Blueprint $table) {
            $table->unsignedBigInteger('ingestion_project_id')->nullable()->after('source_id');
            $table->index('ingestion_project_id');
            $table->foreign('ingestion_project_id')
                ->references('id')
                ->on('ingestion_projects')
                ->nullOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('source_profiles', function (Blueprint $table) {
            $table->dropForeign(['ingestion_project_id']);
            $table->dropIndex(['ingestion_project_id']);
            $table->dropColumn('ingestion_project_id');
        });
    }
};
