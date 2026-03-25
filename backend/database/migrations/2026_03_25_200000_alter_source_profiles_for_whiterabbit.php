<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Drop NOT NULL constraints using raw SQL (no doctrine/dbal needed)
        DB::statement('ALTER TABLE source_profiles ALTER COLUMN ingestion_job_id DROP NOT NULL');
        DB::statement('ALTER TABLE source_profiles ALTER COLUMN file_name DROP NOT NULL');
        DB::statement('ALTER TABLE source_profiles ALTER COLUMN file_format DROP NOT NULL');
        DB::statement('ALTER TABLE source_profiles ALTER COLUMN file_size DROP NOT NULL');
        DB::statement('ALTER TABLE source_profiles ALTER COLUMN storage_path DROP NOT NULL');

        // Drop existing FK on ingestion_job_id and recreate with nullOnDelete
        Schema::table('source_profiles', function (Blueprint $table) {
            $table->dropForeign(['ingestion_job_id']);
            $table->foreign('ingestion_job_id')
                ->references('id')
                ->on('ingestion_jobs')
                ->nullOnDelete();
        });

        // Add new columns
        Schema::table('source_profiles', function (Blueprint $table) {
            $table->foreignId('source_id')->nullable()->after('ingestion_job_id')
                ->constrained('sources')->nullOnDelete();
            $table->string('scan_type', 20)->default('whiterabbit')->after('source_id');
            $table->float('scan_time_seconds')->nullable()->after('scan_type');
            $table->string('overall_grade', 2)->nullable()->after('scan_time_seconds');
            $table->integer('table_count')->nullable()->after('overall_grade');
            $table->bigInteger('total_rows')->nullable()->after('table_count');
            $table->jsonb('summary_json')->nullable()->after('total_rows');

            $table->index('source_id');
            $table->index('scan_type');
        });
    }

    public function down(): void
    {
        Schema::table('source_profiles', function (Blueprint $table) {
            $table->dropForeign(['source_id']);
            $table->dropIndex(['source_id']);
            $table->dropIndex(['scan_type']);
            $table->dropColumn([
                'source_id',
                'scan_type',
                'scan_time_seconds',
                'overall_grade',
                'table_count',
                'total_rows',
                'summary_json',
            ]);
        });

        // Restore original FK (cascadeOnDelete)
        Schema::table('source_profiles', function (Blueprint $table) {
            $table->dropForeign(['ingestion_job_id']);
            $table->foreign('ingestion_job_id')
                ->references('id')
                ->on('ingestion_jobs')
                ->cascadeOnDelete();
        });

        // Restore NOT NULL constraints
        DB::statement('ALTER TABLE source_profiles ALTER COLUMN ingestion_job_id SET NOT NULL');
        DB::statement('ALTER TABLE source_profiles ALTER COLUMN file_name SET NOT NULL');
        DB::statement('ALTER TABLE source_profiles ALTER COLUMN file_format SET NOT NULL');
        DB::statement('ALTER TABLE source_profiles ALTER COLUMN file_size SET NOT NULL');
        DB::statement('ALTER TABLE source_profiles ALTER COLUMN storage_path SET NOT NULL');
    }
};
