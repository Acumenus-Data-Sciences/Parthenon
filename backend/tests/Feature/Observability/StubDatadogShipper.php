<?php

declare(strict_types=1);

namespace Tests\Feature\Observability;

use App\Contracts\ObservabilityShipperInterface;
use App\Observability\LogEvent;
use App\Observability\MetricEvent;
use App\Observability\SpanContext;
use App\Observability\TraceHandle;

/**
 * Test fixture proving an EE shipper can plug into the registry without any
 * CE code modification. Captures every event for assertion in pluggability
 * tests.
 */
class StubDatadogShipper implements ObservabilityShipperInterface
{
    /** @var array<int, LogEvent> */
    public array $logs = [];

    /** @var array<int, MetricEvent> */
    public array $metrics = [];

    /** @var array<int, SpanContext> */
    public array $startedSpans = [];

    /** @var array<int, array{context: SpanContext, status: string}> */
    public array $finishedSpans = [];

    public function __construct(public bool $available = true) {}

    public function name(): string
    {
        return 'stub-datadog';
    }

    public function isAvailable(): bool
    {
        return $this->available;
    }

    public function ship(LogEvent $event): bool
    {
        $this->logs[] = $event;

        return true;
    }

    public function recordMetric(MetricEvent $event): bool
    {
        $this->metrics[] = $event;

        return true;
    }

    public function startSpan(SpanContext $context): TraceHandle
    {
        $this->startedSpans[] = $context;

        return new TraceHandle($context, function (SpanContext $ctx, string $status): void {
            $this->finishedSpans[] = ['context' => $ctx, 'status' => $status];
        });
    }
}
