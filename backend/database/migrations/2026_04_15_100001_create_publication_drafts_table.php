<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('publication_drafts', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id');
            $table->unsignedBigInteger('study_id')->nullable();
            $table->string('title');
            $table->string('template', 80)->default('generic-ohdsi');
            $table->jsonb('document_json');
            $table->string('status', 24)->default('draft');
            $table->timestamp('last_opened_at')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'last_opened_at'], 'publication_drafts_user_opened_idx');
            $table->index(['study_id', 'updated_at'], 'publication_drafts_study_updated_idx');
        });

        if (DB::connection()->getDriverName() === 'pgsql') {
            DB::unprepared(<<<'SQL'
                DO $grants$
                BEGIN
                    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'parthenon_app') THEN
                        GRANT SELECT, INSERT, UPDATE, DELETE ON app.publication_drafts TO parthenon_app;
                        GRANT USAGE, SELECT ON SEQUENCE app.publication_drafts_id_seq TO parthenon_app;
                    END IF;
                END
                $grants$
            SQL);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('publication_drafts');
    }
};
