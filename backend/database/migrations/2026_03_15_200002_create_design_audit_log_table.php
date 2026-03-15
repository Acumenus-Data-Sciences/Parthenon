<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('design_audit_log', function (Blueprint $table) {
            $table->id();
            $table->string('entity_type', 50);
            $table->unsignedBigInteger('entity_id');
            $table->string('entity_name', 500);
            $table->string('action', 20);
            $table->unsignedBigInteger('actor_id')->nullable();
            $table->string('actor_email', 255)->nullable();
            $table->jsonb('old_json')->nullable();
            $table->jsonb('new_json')->nullable();
            $table->jsonb('changed_fields')->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->timestamp('created_at')->useCurrent();
            // NO updated_at — this table is immutable
        });

        // Indexes
        DB::statement('CREATE INDEX dal_entity_idx  ON app.design_audit_log (entity_type, entity_id)');
        DB::statement('CREATE INDEX dal_actor_idx   ON app.design_audit_log (actor_id)');
        DB::statement('CREATE INDEX dal_action_idx  ON app.design_audit_log (action)');
        DB::statement('CREATE INDEX dal_created_idx ON app.design_audit_log (created_at)');

        // FK to users (nullable for seeder/system changes)
        DB::statement('ALTER TABLE app.design_audit_log ADD CONSTRAINT fk_dal_actor
            FOREIGN KEY (actor_id) REFERENCES app.users(id) ON DELETE SET NULL');

        // Immutability trigger — any UPDATE or DELETE raises an exception at DB level
        DB::statement("
            CREATE OR REPLACE FUNCTION app.design_audit_log_immutable()
            RETURNS trigger LANGUAGE plpgsql AS \$\$
            BEGIN
                RAISE EXCEPTION 'design_audit_log rows are immutable';
            END;
            \$\$
        ");

        DB::statement("
            CREATE TRIGGER design_audit_log_no_update_delete
            BEFORE UPDATE OR DELETE ON app.design_audit_log
            FOR EACH ROW EXECUTE FUNCTION app.design_audit_log_immutable()
        ");
    }

    public function down(): void
    {
        DB::statement('DROP TRIGGER IF EXISTS design_audit_log_no_update_delete ON app.design_audit_log');
        DB::statement('DROP FUNCTION IF EXISTS app.design_audit_log_immutable()');
        Schema::dropIfExists('design_audit_log');
    }
};
