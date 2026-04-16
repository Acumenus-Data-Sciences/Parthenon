<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Guard: 000004 already creates these columns in a fresh DB (test env).
        // This migration only runs on prod where the table existed before 000004.
        if (Schema::hasColumn('study_design_assets', 'verification_status')) {
            return;
        }

        Schema::table('study_design_assets', function (Blueprint $table) {
            $table->string('verification_status', 32)->default('unverified')->after('provenance_json');
            $table->jsonb('verification_json')->nullable()->after('verification_status');
            $table->timestamp('verified_at')->nullable()->after('verification_json');
            $table->index(['session_id', 'verification_status'], 'study_design_assets_session_verification_idx');
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
            $table->dropIndex('study_design_assets_session_verification_idx');
            $table->dropColumn(['verification_status', 'verification_json', 'verified_at']);
        });
    }
};
