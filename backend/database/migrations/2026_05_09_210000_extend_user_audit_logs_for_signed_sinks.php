<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Plan 02-04: extend app.user_audit_logs with cryptographic-chain columns.
 *
 *   - event_id      ULID, unique — provided by AuditDispatcher; lets sinks
 *                    deduplicate a single logical event across multiple
 *                    write attempts (idempotency).
 *   - outcome       'success' | 'failure' | 'denied' — broaden the action
 *                    field to carry an explicit outcome dimension without
 *                    string-grepping action names.
 *   - prev_event_hash  Set by SignedAuditSink (EE) — references the
 *                    previous event in the per-tenant hash chain.
 *   - event_hash    Set by SignedAuditSink (EE) — HMAC over canonical
 *                    JSON + prev_event_hash. Tamper-evident chain.
 *
 * tenant_id was added by Plan 02-02 migration; this migration assumes it
 * exists.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::connection('pgsql')->table('user_audit_logs', function (Blueprint $table) {
            if (! Schema::connection('pgsql')->hasColumn('user_audit_logs', 'event_id')) {
                $table->string('event_id', 32)->nullable()->after('id');
                // Add unique index in a separate statement so a populated table can be migrated incrementally.
                $table->unique('event_id');
            }
            if (! Schema::connection('pgsql')->hasColumn('user_audit_logs', 'outcome')) {
                $table->string('outcome', 16)->default('success')->after('action');
            }
            if (! Schema::connection('pgsql')->hasColumn('user_audit_logs', 'prev_event_hash')) {
                $table->string('prev_event_hash', 64)->nullable();
            }
            if (! Schema::connection('pgsql')->hasColumn('user_audit_logs', 'event_hash')) {
                $table->string('event_hash', 64)->nullable();
            }
        });
    }

    public function down(): void
    {
        Schema::connection('pgsql')->table('user_audit_logs', function (Blueprint $table) {
            if (Schema::connection('pgsql')->hasColumn('user_audit_logs', 'event_id')) {
                $table->dropUnique(['event_id']);
                $table->dropColumn('event_id');
            }
            foreach (['outcome', 'prev_event_hash', 'event_hash'] as $col) {
                if (Schema::connection('pgsql')->hasColumn('user_audit_logs', $col)) {
                    $table->dropColumn($col);
                }
            }
        });
    }
};
