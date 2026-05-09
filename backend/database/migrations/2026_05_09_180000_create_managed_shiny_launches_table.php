<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement('CREATE SCHEMA IF NOT EXISTS app');
        DB::statement('SET search_path TO app, public');

        Schema::create('app.managed_shiny_launches', function (Blueprint $table) {
            $table->id();
            $table->uuid('workspace_id')->unique();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('study_id')->nullable()->constrained('studies')->nullOnDelete();
            $table->foreignId('study_artifact_id')->nullable()->constrained('study_artifacts')->nullOnDelete();
            $table->string('study_slug', 255)->nullable();
            $table->string('artifact_type', 50)->nullable();
            $table->string('app_key', 120)->index();
            $table->string('runtime', 50)->default('shinyproxy');
            $table->string('mode', 30)->default('embedded');
            $table->string('status', 30)->default('issued')->index();
            $table->string('token_hash', 64)->nullable()->index();
            $table->timestampTz('expires_at')->nullable()->index();
            $table->timestampTz('resolved_at')->nullable();
            $table->timestampTz('failed_at')->nullable();
            $table->string('failure_reason', 500)->nullable();
            $table->jsonb('metadata')->nullable();
            $table->timestamps();
        });

        DB::statement(<<<'SQL'
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'parthenon_app') THEN
                    GRANT SELECT, INSERT, UPDATE, DELETE ON app.managed_shiny_launches TO parthenon_app;
                    GRANT USAGE, SELECT, UPDATE ON SEQUENCE app.managed_shiny_launches_id_seq TO parthenon_app;
                END IF;
            END $$;
        SQL);
    }

    public function down(): void
    {
        DB::statement(<<<'SQL'
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'parthenon_app') THEN
                    REVOKE SELECT, INSERT, UPDATE, DELETE ON app.managed_shiny_launches FROM parthenon_app;
                    REVOKE USAGE, SELECT, UPDATE ON SEQUENCE app.managed_shiny_launches_id_seq FROM parthenon_app;
                END IF;
            END $$;
        SQL);

        Schema::dropIfExists('app.managed_shiny_launches');
    }
};
