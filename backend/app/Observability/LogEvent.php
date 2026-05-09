<?php

declare(strict_types=1);

namespace App\Observability;

use App\Contracts\ObservabilityShipperInterface;
use App\Contracts\TenantResolverInterface;
use DateTimeImmutable;

/**
 * Immutable value object describing a single log event emitted by Parthenon.
 *
 * Shipped through {@see ObservabilityShipperInterface::ship()}.
 */
final readonly class LogEvent
{
    /**
     * @param  string  $level  PSR-3 level: 'debug'|'info'|'notice'|'warning'|'error'|'critical'|'alert'|'emergency'
     * @param  array<string, mixed>  $context  Arbitrary structured context (must be JSON-serializable)
     * @param  string|null  $traceId  W3C 32-hex trace id (optional)
     * @param  string|null  $spanId  W3C 16-hex span id (optional)
     * @param  int|null  $tenantId  Tenant id from {@see TenantResolverInterface}
     */
    public function __construct(
        public DateTimeImmutable $occurredAt,
        public string $level,
        public string $message,
        public array $context = [],
        public ?string $traceId = null,
        public ?string $spanId = null,
        public ?int $tenantId = null,
    ) {}
}
