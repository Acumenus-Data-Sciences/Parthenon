<?php

declare(strict_types=1);

namespace App\Observability\Shippers;

use App\Contracts\ObservabilityShipperInterface;
use App\Observability\LogEvent;
use App\Observability\MetricEvent;
use App\Observability\SpanContext;
use App\Observability\TraceHandle;

/**
 * Discards every event. Useful in test environments where logger doubles
 * are stricter than Parthenon's defaults, or when observability shipping
 * must be disabled entirely (e.g. air-gapped EE deployments waiting for an
 * outbound proxy to come up).
 */
final class NullShipper implements ObservabilityShipperInterface
{
    public function name(): string
    {
        return 'null';
    }

    public function isAvailable(): bool
    {
        return true;
    }

    public function ship(LogEvent $event): bool
    {
        unset($event);

        return true;
    }

    public function recordMetric(MetricEvent $event): bool
    {
        unset($event);

        return true;
    }

    public function startSpan(SpanContext $context): TraceHandle
    {
        return new TraceHandle($context, fn () => null);
    }
}
