<?php

declare(strict_types=1);

namespace App\Contracts;

use App\Observability\LogEvent;
use App\Observability\MetricEvent;
use App\Observability\ShipperRegistry;
use App\Observability\Shippers\LokiPrometheusShipper;
use App\Observability\SpanContext;
use App\Observability\TraceHandle;

/**
 * Extension contract for shipping observability events to a backend
 * (Loki, Prometheus, Datadog, Splunk, OpenTelemetry collector, etc.).
 *
 * Implementations MUST be best-effort: ship() and recordMetric() must NEVER
 * throw — telemetry failures must not affect the request lifecycle. Log
 * internally and return false on failure.
 *
 * CE default: {@see LokiPrometheusShipper}.
 *
 * @see docs/lineage/design/architecture/extension-points/observability-shipper.md
 */
interface ObservabilityShipperInterface
{
    /**
     * Stable identifier used in logs/diagnostics ('loki-prometheus',
     * 'datadog', 'splunk', 'otel'). Lowercase kebab-case.
     */
    public function name(): string;

    /**
     * Whether the shipper can currently accept events (e.g. config present,
     * dependent SDK installed). Used by {@see ShipperRegistry}
     * to skip unavailable shippers without failing the dispatch.
     */
    public function isAvailable(): bool;

    /**
     * Best-effort log shipping. MUST NOT throw — log internally, return false on failure.
     */
    public function ship(LogEvent $event): bool;

    /**
     * Best-effort metric recording. MUST NOT throw — return false on failure.
     */
    public function recordMetric(MetricEvent $event): bool;

    /**
     * Start a trace span. The returned handle MUST be finish()ed by the caller
     * (typically inside a try/finally block).
     */
    public function startSpan(SpanContext $context): TraceHandle;
}
