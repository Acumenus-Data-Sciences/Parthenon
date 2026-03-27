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
        if (! Schema::hasTable('ingestion_projects')) {
            return;
        }

        Schema::table('ingestion_projects', function (Blueprint $table) {
            if (! Schema::hasColumn('ingestion_projects', 'db_connection_config')) {
                $table->text('db_connection_config')->nullable()->after('notes');
            }
            if (! Schema::hasColumn('ingestion_projects', 'selected_tables')) {
                $table->jsonb('selected_tables')->nullable()->after('db_connection_config');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (! Schema::hasTable('ingestion_projects')) {
            return;
        }

        Schema::table('ingestion_projects', function (Blueprint $table) {
            $table->dropColumn(['db_connection_config', 'selected_tables']);
        });
    }
};
