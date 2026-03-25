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
        DB::statement('ALTER TABLE field_profiles ALTER COLUMN column_index DROP NOT NULL');
        DB::statement('ALTER TABLE field_profiles ALTER COLUMN inferred_type DROP NOT NULL');
        DB::statement('ALTER TABLE field_profiles ALTER COLUMN non_null_count DROP NOT NULL');
        DB::statement('ALTER TABLE field_profiles ALTER COLUMN null_count DROP NOT NULL');
        DB::statement('ALTER TABLE field_profiles ALTER COLUMN null_percentage DROP NOT NULL');
        DB::statement('ALTER TABLE field_profiles ALTER COLUMN distinct_count DROP NOT NULL');
        DB::statement('ALTER TABLE field_profiles ALTER COLUMN distinct_percentage DROP NOT NULL');

        // Add new columns
        Schema::table('field_profiles', function (Blueprint $table) {
            $table->string('table_name', 255)->nullable()->after('source_profile_id');
            $table->bigInteger('row_count')->nullable()->after('table_name');

            $table->index(['source_profile_id', 'table_name']);
        });
    }

    public function down(): void
    {
        Schema::table('field_profiles', function (Blueprint $table) {
            $table->dropIndex(['source_profile_id', 'table_name']);
            $table->dropColumn(['table_name', 'row_count']);
        });

        // Restore NOT NULL constraints
        DB::statement('ALTER TABLE field_profiles ALTER COLUMN column_index SET NOT NULL');
        DB::statement('ALTER TABLE field_profiles ALTER COLUMN inferred_type SET NOT NULL');
        DB::statement('ALTER TABLE field_profiles ALTER COLUMN non_null_count SET NOT NULL');
        DB::statement('ALTER TABLE field_profiles ALTER COLUMN null_count SET NOT NULL');
        DB::statement('ALTER TABLE field_profiles ALTER COLUMN null_percentage SET NOT NULL');
        DB::statement('ALTER TABLE field_profiles ALTER COLUMN distinct_count SET NOT NULL');
        DB::statement('ALTER TABLE field_profiles ALTER COLUMN distinct_percentage SET NOT NULL');
    }
};
