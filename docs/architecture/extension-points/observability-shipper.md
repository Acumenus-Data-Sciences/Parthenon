# Extension Point: Observability Shipper

**Interface:** `App\Contracts\ObservabilityShipperInterface`
**Default shipper (CE):** `App\Observability\Shippers\LokiPrometheusShipper`
**Service provider:** `App\Providers\ObservabilityServiceProvider`
**Public API:** `App\Observability\Observer` — accessed via the global `obs()` helper
**Registry:** `App\Observability\ShipperRegistry`
**Config:** `backend/config/observability.php`
**Status:** Live since [Phase 2 #5](../../superpowers/plans/2026-05-09-ce-ee-fork-plan-02-05-observability-shipper.md)

## Purpose

Decouple Parthenon's observability emissions (structured logs, metrics, traces) from a specific backend. CE forwards through the existing Laravel logger so Loki and Prometheus continue to scrape unchanged. EE adds shippers for Datadog, Splunk HEC, and OpenTelemetry / OTLP-HTTP collectors so customers with managed observability stacks can route everything through a single contract without patching CE call sites.

Multiple shippers can be registered (fan-out); failure of one shipper does not block the others. Shippers MUST NOT throw out of `ship()` or `recordMetric()` — telemetry failures must never affect the request lifecycle.

The architecture has five collaborating pieces:

1. **Value objects** — `LogEvent`, `MetricEvent`, `SpanContext`, `TraceHandle` describe what is being shipped without leaking vendor specifics.
2. **`ObservabilityShipperInterface`** — the extension contract. Each shipper implements `name()`, `isAvailable()`, `ship()`, `recordMetric()`, `startSpan()`.
3. **`ShipperRegistry`** — singleton, ordered list of registered shippers; supports runtime registration so EE bundles plug in via their service provider.
4. **`Observer`** — public API resolved via the `obs()` helper. Builds the right value object, fans out to every available shipper, and swallows shipper exceptions.
5. **`LokiPrometheusShipper`** — the CE default. A near-no-op that forwards logs to the Laravel logger (Loki picks them up) and records metrics through `promphp/prometheus_client_php` if the package is installed.

## The contract

```php
interface ObservabilityShipperInterface
{
    public function name(): string;
    public function isAvailable(): bool;

    /** Best-effort log shipping. MUST NOT throw — return false on failure. */
    public function ship(LogEvent $event): bool;

    /** Best-effort metric recording. MUST NOT throw. */
    public function recordMetric(MetricEvent $event): bool;

    /** Returns a handle that the caller MUST finish() (typically inside try/finally). */
    public function startSpan(SpanContext $context): TraceHandle;
}
```

### Best-effort guarantee

`ship()` and `recordMetric()` must catch every exception internally, log it, and return `false`. The Observer wraps each call with a defensive `try/catch` as well — even a misbehaving third-party shipper that throws will not abort the request. This is the same pattern the audit sink uses (Plan 02-04), but stricter: while audit sinks may legitimately throw to ABORT a request under "no-audit-no-action" policies, observability shippers MUST NEVER throw — telemetry must not be load-bearing.

### Trace context propagation

`SpanContext` carries W3C-compatible identifiers (`traceId`: 32 hex chars, `spanId`: 16 hex chars). Spans returned from `Observer::span()` use the first available shipper as the source of truth for trace IDs; other shippers are notified through the `TraceHandle::finish()` callback, which lets EE's OTel shipper invariably emit OTLP/HTTP spans without CE knowing or caring.

CE's `LokiPrometheusShipper` returns a no-op `TraceHandle` — distributed tracing is opt-in and requires `opentelemetry-php` to be installed. The handle still exposes `setAttribute()` / `recordException()` / `finish()` so application code is identical regardless of whether traces are enabled.

## Value objects

```php
final readonly class LogEvent
{
    public function __construct(
        public DateTimeImmutable $occurredAt,
        public string $level,           // PSR-3 level
        public string $message,
        public array $context = [],     // structured, JSON-serializable
        public ?string $traceId = null, // W3C 32-hex
        public ?string $spanId = null,  // W3C 16-hex
        public ?int $tenantId = null,   // populated from TenantResolverInterface
    ) {}
}

final readonly class MetricEvent
{
    public function __construct(
        public string $type,            // 'counter' | 'gauge' | 'histogram'
        public string $name,            // e.g. 'parthenon.cohorts.generated.count'
        public float $value,
        public array $tags = [],        // string-keyed string-valued, low-cardinality
        public DateTimeImmutable $occurredAt = new DateTimeImmutable,
        public string $unit = '',       // R5: UCUM-style unit hint ('', 's', 'ms', 'By', '1')
    ) {}
}

final readonly class SpanContext
{
    public function __construct(
        public string $name,
        public string $traceId,
        public string $spanId,
        public ?string $parentSpanId = null,
        public array $attributes = [],
    ) {}
}
```

### Why a `unit` field on MetricEvent (R5)

OpenTelemetry, Prometheus 3+, and Datadog all want a unit annotation on every metric so dashboards can render axes correctly. Adding it here, with `''` as the default, lets EE shippers emit OTLP-correct unit annotations without forcing CE callers to migrate. UCUM-style codes are recommended (`s`, `ms`, `By`, `KiBy`, `1` for unitless counts).

## Public API

Application code emits events through the global `obs()` helper:

```php
// Structured log
obs()->log('info', 'cohort generated', ['cohort_id' => $cohort->id]);

// Counter metric (default type)
obs()->metric('parthenon.cohorts.generated.count', 1.0);

// Histogram with unit
obs()->metric('parthenon.cohort.materialize.duration', 142.0, 'histogram', [], 'ms');

// Trace span — finish() inside try/finally
$handle = obs()->span('cohort.materialize', ['cohort_id' => $cohort->id]);
try {
    $cohort->materialize();
} catch (Throwable $e) {
    $handle->recordException($e);
    throw $e;
} finally {
    $handle->finish();
}
```

`Observer::log()` automatically attaches the current tenant id via `TenantResolverInterface` (Plan 02-02) when bound, so multi-tenant deployments get tenant scoping for free.

## Configuration

```php
// backend/config/observability.php
return [
    'shippers' => [
        \App\Observability\Shippers\LokiPrometheusShipper::class,
        // EE appends \Enterprise\Observability\Shippers\DatadogShipper::class etc.
    ],
    'sampling' => [
        'logs' => env('OBS_LOG_SAMPLING', 1.0),
        'metrics' => env('OBS_METRIC_SAMPLING', 1.0),
        'traces' => env('OBS_TRACE_SAMPLING', 0.1),
    ],
];
```

Each shipper class is resolved through the container; the service provider registers the resulting instance with `ShipperRegistry`. EE's `EnterpriseObservabilityServiceProvider` calls `$registry->register($datadog)` after CE boot — the existing CE entry remains, the EE entries are appended.

## Pluggability proof

`tests/Feature/Observability/ShipperRegistryTest.php` registers a `StubDatadogShipper` at runtime (without modifying any CE config) and asserts that:

- `obs()->log()` reaches the stub
- `obs()->metric()` reaches the stub
- `MetricEvent::unit` round-trips correctly through the registry (R5)
- A shipper that throws does not break fan-out for other shippers
- `isAvailable()=false` shippers are skipped
- `obs()->span()` returns a usable, finishable handle even when no shippers are registered

These assertions are the contract every alternate shipper must satisfy.

## EE shipper sketches

### Datadog (HTTP intake)

```php
class DatadogShipper implements ObservabilityShipperInterface
{
    public function ship(LogEvent $event): bool
    {
        return $this->httpPost('https://http-intake.logs.datadoghq.com/api/v2/logs', [
            'ddsource' => 'parthenon',
            'ddtags' => 'env:'.config('app.env'),
            'service' => 'parthenon',
            'level' => $event->level,
            'message' => $event->message,
            'attributes' => $event->context,
            'trace_id' => $event->traceId,
            'span_id' => $event->spanId,
            'tenant_id' => $event->tenantId,
        ]);
    }
    // recordMetric() POSTs to /api/v2/series with $event->unit mapped to DD's unit field.
    // startSpan() uses dd-trace-php and returns a TraceHandle that finishes via that SDK.
}
```

### Splunk HEC

```php
class SplunkShipper implements ObservabilityShipperInterface
{
    public function ship(LogEvent $event): bool
    {
        return $this->httpPost($this->hecUrl.'/services/collector/event', [
            'time' => $event->occurredAt->getTimestamp(),
            'host' => gethostname(),
            'source' => 'parthenon',
            'sourcetype' => '_json',
            'event' => array_merge($event->context, [
                'message' => $event->message,
                'level' => $event->level,
                'trace_id' => $event->traceId,
                'tenant_id' => $event->tenantId,
            ]),
        ], headers: ['Authorization' => 'Splunk '.$this->hecToken]);
    }
}
```

### OpenTelemetry / OTLP-HTTP

```php
class OtelShipper implements ObservabilityShipperInterface
{
    public function ship(LogEvent $event): bool { /* OTLP-HTTP /v1/logs */ }
    public function recordMetric(MetricEvent $event): bool { /* OTLP-HTTP /v1/metrics with $event->unit */ }
    public function startSpan(SpanContext $context): TraceHandle {
        // Use opentelemetry-php to start a span backed by OTLP-HTTP /v1/traces.
    }
}
```

## Sampling

CE does not sample (sampling rates of 1.0 / 0.1 are advisory). EE shippers apply the rates from `config('observability.sampling')` because vendor backends bill by event volume. Sampling decisions happen inside the shipper, AFTER the registry hands the event off, so different shippers can sample differently (e.g., 100% logs to Loki, 10% logs to Datadog).

## Out of scope (for Plan 02-05)

- Distributed trace propagation across the AI sidecar / R sidecar — handled when those sidecars adopt the contract.
- Per-tenant routing (e.g., tenant A's logs go to Datadog, tenant B's stay on Loki) — depends on Plan 02-02 + EE.
- Adaptive sampling, head-based vs tail-based sampling.

## Anti-patterns

- ❌ Don't call `Log::*` directly from new code; use `obs()->log()` so EE shippers see the event too.
- ❌ Don't throw from a shipper to signal "telemetry backend down" — return `false` and log internally.
- ❌ Don't block the request thread on a slow shipper. EE shippers that talk to remote APIs MUST use Laravel's queue (`isAvailable()` may return false while the queue worker is unreachable, OR ship asynchronously by enqueueing a job).
- ❌ Don't include high-cardinality values in `MetricEvent::tags` (UUIDs, request IDs). Tags are for grouping; high cardinality blows up Prometheus and Datadog cost.
