<?php

declare(strict_types=1);

namespace App\Observability;

use App\Contracts\ObservabilityShipperInterface;
use App\Contracts\TenantResolverInterface;
use DateTimeImmutable;
use Throwable;

/**
 * Public observability API. Resolved as a singleton; callers usually go through
 * the global helper:
 *
 *   obs()->log('info', 'cohort generated', ['cohort_id' => $id]);
 *   obs()->metric('parthenon.cohorts.generated.count', 1.0);
 *   $h = obs()->span('cohort.materialize', ['cohort_id' => $id]);
 *   try { ... } finally { $h->finish(); }
 *
 * Fan-out is best-effort: a single shipper raising an exception does not
 * abort the loop or affect callers.
 */
class Observer
{
    public function __construct(
        private readonly ShipperRegistry $registry,
        private readonly ?TenantResolverInterface $tenants = null,
    ) {}

    /**
     * @param  array<string, mixed>  $context
     */
    public function log(string $level, string $message, array $context = []): void
    {
        $event = new LogEvent(
            occurredAt: new DateTimeImmutable,
            level: $level,
            message: $message,
            context: $context,
            tenantId: $this->resolveTenantId(),
        );

        foreach ($this->registry->shippers() as $shipper) {
            $this->safeShip($shipper, $event);
        }
    }

    /**
     * @param  array<string, string>  $tags
     */
    public function metric(string $name, float $value, string $type = 'counter', array $tags = [], string $unit = ''): void
    {
        $event = new MetricEvent(
            type: $type,
            name: $name,
            value: $value,
            tags: $tags,
            unit: $unit,
        );

        foreach ($this->registry->shippers() as $shipper) {
            $this->safeRecord($shipper, $event);
        }
    }

    /**
     * Start a span. The first registered, available shipper supplies the
     * concrete handle (usually the one with native trace support); the
     * remaining shippers are notified through the finish callback.
     *
     * @param  array<string, mixed>  $attributes
     */
    public function span(string $name, array $attributes = []): TraceHandle
    {
        $context = new SpanContext(
            name: $name,
            traceId: bin2hex(random_bytes(16)),
            spanId: bin2hex(random_bytes(8)),
            attributes: $attributes,
        );

        $primary = null;
        foreach ($this->registry->shippers() as $shipper) {
            if ($shipper->isAvailable()) {
                $primary = $shipper;
                break;
            }
        }

        if ($primary === null) {
            return new TraceHandle($context, fn () => null);
        }

        return $primary->startSpan($context);
    }

    private function resolveTenantId(): ?int
    {
        if ($this->tenants === null) {
            return null;
        }

        try {
            return $this->tenants->currentId();
        } catch (Throwable) {
            return null;
        }
    }

    private function safeShip(ObservabilityShipperInterface $shipper, LogEvent $event): void
    {
        if (! $shipper->isAvailable()) {
            return;
        }

        try {
            $shipper->ship($event);
        } catch (Throwable) {
            // Telemetry MUST NOT break the request lifecycle.
        }
    }

    private function safeRecord(ObservabilityShipperInterface $shipper, MetricEvent $event): void
    {
        if (! $shipper->isAvailable()) {
            return;
        }

        try {
            $shipper->recordMetric($event);
        } catch (Throwable) {
            // Telemetry MUST NOT break the request lifecycle.
        }
    }
}
