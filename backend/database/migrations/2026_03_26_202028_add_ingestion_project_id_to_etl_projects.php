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
        Schema::table('etl_projects', function (Blueprint $table) {
            $table->unsignedBigInteger('ingestion_project_id')->nullable()->after('source_id');
            $table->foreign('ingestion_project_id')
                ->references('id')
                ->on('ingestion_projects')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('etl_projects', function (Blueprint $table) {
            $table->dropForeign(['ingestion_project_id']);
            $table->dropColumn('ingestion_project_id');
        });
    }
};
