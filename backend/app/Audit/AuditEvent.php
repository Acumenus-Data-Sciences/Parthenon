<?php

namespace App\Audit;

use DateTimeImmutable;

/**
 * Immutable value object describing one auditable event. Sinks
 * receive these and persist/transmit them. Field set is intentionally
 * superset of what UserAuditLog stores today, plus optional
 * cryptographic chaining fields the SignedAuditSink uses.
 */
final readonly class AuditEvent
{
    /**
     * @param  array<string, mixed>  $metadata
     */
    public function __construct(
        public string $eventId,                       // ULID (sortable, unique)
        public DateTimeImmutable $occurredAt,
        public string $action,                        // e.g. 'auth.login', 'cohort.create'
        public ?int $actorUserId,                     // null for system / anonymous
        public ?string $actorRole,
        public int $tenantId,                         // resolved from TenantResolver
        public ?string $resourceType = null,          // e.g. 'cohort'
        public ?string $resourceId = null,            // e.g. '42'
        public ?string $sourceKey = null,             // CDM source if applicable (e.g. 'omop')
        public ?string $ipAddress = null,
        public ?string $userAgent = null,
        public ?string $route = null,
        public string $outcome = 'success',           // 'success' | 'failure' | 'denied'
        public array $metadata = [],
        public ?string $prevEventHash = null,         // for signed-chain sinks (set by sink, not caller)
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        return [
            'event_id' => $this->eventId,
            'occurred_at' => $this->occurredAt->format('Y-m-d\\TH:i:s.uP'),
            'action' => $this->action,
            'actor_user_id' => $this->actorUserId,
            'actor_role' => $this->actorRole,
            'tenant_id' => $this->tenantId,
            'resource_type' => $this->resourceType,
            'resource_id' => $this->resourceId,
            'source_key' => $this->sourceKey,
            'ip_address' => $this->ipAddress,
            'user_agent' => $this->userAgent,
            'route' => $this->route,
            'outcome' => $this->outcome,
            'metadata' => $this->metadata,
        ];
    }

    /**
     * Canonical JSON form for HMAC chain signing (R4).
     *
     * Two implementations of an AuditSink (e.g. CE's DatabaseAuditSink
     * and EE's SignedAuditSink) must compute IDENTICAL canonical forms
     * for the same event so a signed-chain verifier can independently
     * recompute event_hash. The recipe:
     *   1. toArray() to get the field map
     *   2. Sort top-level keys lexicographically
     *   3. Sort any nested array keys lexicographically (deterministic
     *      metadata ordering)
     *   4. JSON encode with UNESCAPED_SLASHES + UNESCAPED_UNICODE +
     *      THROW_ON_ERROR
     *
     * See RFC 8785 (JSON Canonicalization Scheme) for background.
     * Implementations MUST NOT change this method's output without a
     * coordinated migration of historical audit chains.
     */
    public function canonicalJson(): string
    {
        $arr = $this->toArray();
        ksort($arr);
        foreach ($arr as &$v) {
            if (is_array($v)) {
                ksort($v);
            }
        }
        unset($v);

        return json_encode(
            $arr,
            JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR,
        );
    }
}
