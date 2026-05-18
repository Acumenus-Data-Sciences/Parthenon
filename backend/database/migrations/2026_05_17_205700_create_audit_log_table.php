<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Phase D · §6.7 — generic audit_log table for library admin actions
 * (hard_delete, reassign, restore). Separate from user_audit_logs which
 * is the signed/HMAC-chained sink for auth/user lifecycle events.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('audit_log', function (Blueprint $table) {
            $table->id();
            $table->foreignId('actor_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('action', 100);
            $table->string('subject_type', 100);
            $table->unsignedBigInteger('subject_id');
            $table->jsonb('snapshot')->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->index(['subject_type', 'subject_id'], 'audit_log_subject_idx');
            $table->index(['actor_id', 'created_at'], 'audit_log_actor_time_idx');
            $table->index(['action', 'created_at'], 'audit_log_action_time_idx');
        });

        // Reassign ownership so default privileges grant DML to parthenon_app.
        // Wrap in a SAVEPOINT so a missing role in test/local DBs does not
        // poison the migration transaction (PG SQLSTATE 25P02) and roll back
        // the CREATE TABLE above.
        if (DB::connection()->getDriverName() === 'pgsql') {
            try {
                DB::transaction(function (): void {
                    DB::statement('ALTER TABLE app.audit_log OWNER TO parthenon_owner');
                    DB::statement('GRANT SELECT, INSERT, UPDATE, DELETE ON app.audit_log TO parthenon_app');
                    DB::statement('GRANT USAGE, SELECT, UPDATE ON SEQUENCE app.audit_log_id_seq TO parthenon_app');
                });
            } catch (Throwable) {
                // Test/local environments without the role hierarchy: skip.
            }
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('audit_log');
    }
};
