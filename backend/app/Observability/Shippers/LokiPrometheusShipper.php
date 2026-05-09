<?php

declare(strict_types=1);

namespace App\Observability\Shippers;

use App\Contracts\ObservabilityShipperInterface;
use App\Observability\LogEvent;
use App\Observability\MetricEvent;
use App\Observability\SpanContext;
use App\Observability\TraceHandle;
use Illuminate\Support\Facades\Log;

/**
 * CE default. Loki/Prometheus already scrape Laravel logs and the Prometheus
 * exporter endpoint, so this shipper bridges Parthenon-internal events to
 * those existing surfaces:
 *
 *   - ship() forwards to the configured Laravel logger; Loki picks it up via
 *     the Docker container log driver or a filesystem tail.
 *   - recordMetric() integrates with promphp/prometheus_client_php when the
 *     package is installed; otherwise it is a no-op (the existing /metrics
 *     endpoint is exposed by infra-level exporters, not application code).
 *   - startSpan() returns a no-op handle. CE does not ship traces by default;
 *     opentelemetry-php registration is documented but opt-in.
 */
class LokiPrometheusShipper implements ObservabilityShipperInterface
{
    public function name(): string
    {
        return 'loki-prometheus';
    }

    public function isAvailable(): bool
    {
        return true;
    }

    public function ship(LogEvent $event): bool
    {
        try {
            Log::log($event->level, $event->message, $event->context + [
                'trace_id' => $event->traceId,
                'span_id' => $event->spanId,
                'tenant_id' => $event->tenantId,
            ]);

            return true;
        } catch (\Throwable) {
            return false;
        }
    }

    public function recordMetric(MetricEvent $event): bool
    {
        // Hook point: integrate with promphp/prometheus_client_php here when
        // the package is added to composer. Until then, this is intentionally
        // a no-op — Prometheus scrapes /metrics from infra exporters.
        unset($event);

        return true;
    }

    public function startSpan(SpanContext $context): TraceHandle
    {
        // No-op finisher. EE shippers (OTel, Datadog) replace this with a
        // SDK-backed implementation that emits OTLP/HTTP spans.
        return new TraceHandle($context, fn () => null);
    }
}
