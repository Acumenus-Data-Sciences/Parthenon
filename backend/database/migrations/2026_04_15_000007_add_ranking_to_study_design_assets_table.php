<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('study_design_assets', 'rank_score')) {
            return;
        }

        Schema::table('study_design_assets', function (Blueprint $table) {
            $table->decimal('rank_score', 6, 3)->nullable()->after('verified_at');
            $table->jsonb('rank_score_json')->nullable()->after('rank_score');
            $table->index(['session_id', 'rank_score'], 'study_design_assets_session_rank_idx');
        });

        if (DB::connection()->getDriverName() === 'pgsql') {
            DB::unprepared(<<<'SQL'
                DO $grants$
                BEGIN
                    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'parthenon_app') THEN
                        GRANT SELECT, INSERT, UPDATE, DELETE ON app.study_design_assets TO parthenon_app;
                    END IF;
                END
                $grants$
            SQL);
        }
    }

    public function down(): void
    {
        Schema::table('study_design_assets', function (Blueprint $table) {
            $table->dropIndex('study_design_assets_session_rank_idx');
            $table->dropColumn(['rank_score', 'rank_score_json']);
        });
    }
};
