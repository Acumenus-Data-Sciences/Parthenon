<?php

use App\Audit\Sinks\DatabaseAuditSink;

return [

    /*
    |--------------------------------------------------------------------------
    | Audit sinks
    |--------------------------------------------------------------------------
    |
    | Ordered list of classes implementing App\Contracts\AuditSinkInterface.
    | Each sink receives every audit event (fan-out). Sinks fail silently
    | (return false) — partial failures don't abort the request.
    |
    | CE default: DatabaseAuditSink — writes to app.user_audit_logs.
    | EE additionally registers SignedAuditSink (HMAC chain + S3 WORM)
    | via its own service provider.
    |
    */
    'sinks' => [
        DatabaseAuditSink::class,
    ],

    /*
    |--------------------------------------------------------------------------
    | Queue connection
    |--------------------------------------------------------------------------
    | Used by async sinks (e.g. EE SignedAuditSink ships to S3 via Horizon).
    | DatabaseAuditSink is synchronous and ignores this setting.
    */
    'queue_connection' => env('AUDIT_QUEUE', 'redis'),

];
