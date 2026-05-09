<?php

namespace App\Audit;

use App\Contracts\TenantResolverInterface;
use DateTimeImmutable;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;

/**
 * Public API for application code to record audit events.
 *
 * Builds an AuditEvent from the current auth + tenant context, then
 * fans out via AuditSinkRegistry. Replaces direct UserAuditLog::create
 * calls scattered across controllers/middleware/observers.
 */
class AuditDispatcher
{
    public function __construct(
        private readonly AuditSinkRegistry $registry,
        private readonly TenantResolverInterface $tenants,
    ) {}

    /**
     * Record an audit event.
     *
     * @param  array<string, mixed>  $metadata
     * @return array<string, bool> per-sink success/failure map
     */
    public function record(
        string $action,
        ?Request $request = null,
        array $metadata = [],
        string $outcome = 'success',
        ?string $resourceType = null,
        ?string $resourceId = null,
    ): array {
        $user = Auth::user();
        $actorRole = null;
        if ($user !== null && method_exists($user, 'getRoleNames')) {
            $actorRole = $user->getRoleNames()->first();
        }

        $event = new AuditEvent(
            eventId: (string) Str::ulid(),
            occurredAt: new DateTimeImmutable,
            action: $action,
            actorUserId: $user?->id,
            actorRole: $actorRole,
            tenantId: $this->tenants->currentId(),
            resourceType: $resourceType,
            resourceId: $resourceId,
            ipAddress: $request?->ip(),
            userAgent: $request?->userAgent(),
            route: $request?->path(),
            outcome: $outcome,
            metadata: $metadata,
        );

        return $this->registry->dispatch($event);
    }
}
