<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('cohort_definitions', function (Blueprint $table) {
            $table->jsonb('tags')->nullable()->after('is_public');
            $table->string('share_token', 64)->nullable()->unique()->after('tags');
            $table->timestamp('share_expires_at')->nullable()->after('share_token');
        });

        DB::statement('CREATE INDEX idx_cohort_definitions_share_token ON cohort_definitions(share_token)');
    }

    public function down(): void
    {
        Schema::table('cohort_definitions', function (Blueprint $table) {
            $table->dropIndex('idx_cohort_definitions_share_token');
            $table->dropColumn(['tags', 'share_token', 'share_expires_at']);
        });
    }
};
