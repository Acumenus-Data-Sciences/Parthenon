<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('publication_drafts', function (Blueprint $table) {
            $table->string('visibility', 16)->default('private')->after('status');
            $table->foreignId('updated_by_user_id')->nullable()->after('visibility')
                ->constrained('users')->nullOnDelete();
            $table->index(['study_id', 'visibility'], 'publication_drafts_study_visibility_idx');
        });

        // Backfill existing rows explicitly (DEFAULT already handles new rows)
        DB::table('publication_drafts')->whereNull('visibility')->update(['visibility' => 'private']);
    }

    public function down(): void
    {
        Schema::table('publication_drafts', function (Blueprint $table) {
            $table->dropIndex('publication_drafts_study_visibility_idx');
            $table->dropConstrainedForeignId('updated_by_user_id');
            $table->dropColumn('visibility');
        });
    }
};
