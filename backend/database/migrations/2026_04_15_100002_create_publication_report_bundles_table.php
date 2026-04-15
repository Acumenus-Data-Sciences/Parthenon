<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('publication_report_bundles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('publication_draft_id')->nullable()
                ->constrained('publication_drafts')
                ->nullOnDelete();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('direction', 16);
            $table->string('format', 40);
            $table->jsonb('bundle_json');
            $table->jsonb('metadata_json')->nullable();
            $table->timestamps();

            $table->index(['publication_draft_id', 'created_at'], 'publication_report_bundles_draft_created_idx');
            $table->index(['user_id', 'created_at'], 'publication_report_bundles_user_created_idx');
            $table->index(['direction', 'format'], 'publication_report_bundles_direction_format_idx');
        });

        if (DB::connection()->getDriverName() === 'pgsql') {
            DB::unprepared(<<<'SQL'
                DO $grants$
                BEGIN
                    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'parthenon_app') THEN
                        GRANT SELECT, INSERT, UPDATE, DELETE ON app.publication_report_bundles TO parthenon_app;
                        GRANT USAGE, SELECT ON SEQUENCE app.publication_report_bundles_id_seq TO parthenon_app;
                    END IF;
                END
                $grants$
            SQL);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('publication_report_bundles');
    }
};
