<?php

namespace App\Audit\Sinks;

use App\Audit\AuditEvent;
use App\Contracts\AuditSinkInterface;
use App\Models\App\UserAuditLog;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * CE default audit sink — persists events to app.user_audit_logs.
 * Synchronous (in-request); idempotent on event_id (unique).
 */
class DatabaseAuditSink implements AuditSinkInterface
{
    public function name(): string
    {
        return 'database';
    }

    public function isAvailable(): bool
    {
        return true;
    }

    public function isSynchronous(): bool
    {
        return true;
    }

    public function write(AuditEvent $event): bool
    {
        try {
            UserAuditLog::firstOrCreate(
                ['event_id' => $event->eventId],
                [
                    'user_id' => $event->actorUserId,
                    'tenant_id' => $event->tenantId,
                    'action' => $event->action,
                    'outcome' => $event->outcome,
                    'ip_address' => $event->ipAddress,
                    'user_agent' => $event->userAgent,
                    'metadata' => $event->metadata,
                    'occurred_at' => $event->occurredAt,
                ],
            );

            return true;
        } catch (Throwable $e) {
            Log::error('DatabaseAuditSink write failed', [
                'event_id' => $event->eventId,
                'action' => $event->action,
                'error' => $e->getMessage(),
            ]);

            return false;
        }
    }
}
