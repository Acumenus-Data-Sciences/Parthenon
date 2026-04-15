<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('study_design_assets', function (Blueprint $table) {
            $table->string('materialized_type', 128)->nullable()->after('rank_score_json');
            $table->unsignedBigInteger('materialized_id')->nullable()->after('materialized_type');
            $table->timestamp('materialized_at')->nullable()->after('materialized_id');
            $table->index(['materialized_type', 'materialized_id'], 'study_design_assets_materialized_idx');
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
            $table->dropIndex('study_design_assets_materialized_idx');
            $table->dropColumn(['materialized_type', 'materialized_id', 'materialized_at']);
        });
    }
};
