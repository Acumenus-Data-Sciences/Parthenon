# CE/EE Fork — Plan 02-05: ObservabilityShipper Extension Point

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development or superpowers:executing-plans. See [Plan 02-01](2026-05-08-ce-ee-fork-plan-02-01-auth-driver.md) for the canonical TDD pattern.

**Goal:** Add an `ObservabilityShipperInterface` so logs / metrics / traces emitted by Parthenon route through a pluggable shipper. CE default ships to Loki + Prometheus (existing setup unchanged). EE shippers send to Datadog, Splunk, OpenTelemetry collectors via HTTP.

**Architecture:** Three-method interface — `ship(LogEvent)`, `recordMetric(MetricEvent)`, `startSpan(SpanContext): TraceHandle`. CE default `LokiPrometheusShipper` is a no-op adapter — Loki/Prometheus already scrape via existing exporters and the Laravel/PHP-FPM access logs, so the shipper just bridges Parthenon-internal events to those existing endpoints. EE shippers actively push to vendor APIs via HTTP. Multiple shippers can be registered (fan-out); failure of one does not block others.

**Tech Stack:** PHP 8.4, Laravel logging, PSR-3, Prometheus client (existing), Pest 3.

**Spec reference:** Spec §5 row 5.

**Umbrella:** [Plan 02 umbrella](2026-05-08-ce-ee-fork-plan-02-extension-points-umbrella.md).

**Prerequisites:** Plan 01 merged. Independent of 02-01..02-04.

---

## File structure

| Path | Purpose | LOC |
|---|---|---|
| `backend/app/Contracts/ObservabilityShipperInterface.php` | Extension contract | ~70 |
| `backend/app/Observability/LogEvent.php` | Value object | ~70 |
| `backend/app/Observability/MetricEvent.php` | Value object | ~60 |
| `backend/app/Observability/SpanContext.php` | Trace context (W3C-compatible) | ~80 |
| `backend/app/Observability/TraceHandle.php` | Returned from startSpan | ~40 |
| `backend/app/Observability/Shippers/LokiPrometheusShipper.php` | CE default | ~120 |
| `backend/app/Observability/Shippers/NullShipper.php` | Test/disabled fixture | ~30 |
| `backend/app/Observability/ShipperRegistry.php` | Fan-out coordinator | ~70 |
| `backend/app/Observability/Observer.php` | Public API: `obs()->log(...)`, `obs()->metric(...)`, `obs()->span(...)` | ~80 |
| `backend/app/Providers/ObservabilityServiceProvider.php` | Wires registry + default shipper | ~50 |
| `backend/config/observability.php` | Active shippers list, sampling rates | ~50 |
| `backend/tests/Feature/Observability/LokiPrometheusShipperTest.php` | Default tests | ~120 |
| `backend/tests/Feature/Observability/StubDatadogShipper.php` | Pluggability fixture | ~80 |
| `backend/tests/Feature/Observability/ShipperRegistryTest.php` | Fan-out tests | ~80 |
| `docs/architecture/extension-points/observability-shipper.md` | Detail doc | ~250 |

**Modified files:**
- `backend/bootstrap/providers.php` — register `ObservabilityServiceProvider`
- `backend/app/Providers/AppServiceProvider.php` — bind global `obs()` helper if not using a Facade
- `docs/architecture/extension-points.md` — mark row 5 done

---

## Task 1: Value objects

```php
<?php
namespace App\Observability;

final readonly class LogEvent
{
    public function __construct(
        public \DateTimeImmutable $occurredAt,
        public string $level,           // 'debug'|'info'|'warning'|'error'|'critical'
        public string $message,
        /** @var array<string, mixed> */
        public array $context = [],
        public ?string $traceId = null,
        public ?string $spanId = null,
        public ?int $tenantId = null,
    ) {}
}

final readonly class MetricEvent
{
    public function __construct(
        public string $type,            // 'counter' | 'gauge' | 'histogram'
        public string $name,            // e.g. 'parthenon.cohorts.generated.count'
        public float $value,
        /** @var array<string, string> */
        public array $tags = [],
        public \DateTimeImmutable $occurredAt = new \DateTimeImmutable(),
    ) {}
}

final readonly class SpanContext
{
    public function __construct(
        public string $name,            // e.g. 'cohort.materialize'
        public string $traceId,         // W3C 32-hex
        public string $spanId,          // W3C 16-hex
        public ?string $parentSpanId = null,
        /** @var array<string, mixed> */
        public array $attributes = [],
    ) {}
}

final class TraceHandle
{
    public function __construct(public readonly SpanContext $context, private \Closure $finisher) {}
    public function setAttribute(string $key, mixed $value): void { /* impl */ }
    public function recordException(\Throwable $e): void { /* impl */ }
    public function finish(string $status = 'ok'): void { ($this->finisher)($this->context, $status); }
}
```

---

## Task 2: ObservabilityShipperInterface

```php
<?php
namespace App\Contracts;

use App\Observability\LogEvent;
use App\Observability\MetricEvent;
use App\Observability\SpanContext;
use App\Observability\TraceHandle;

interface ObservabilityShipperInterface
{
    public function name(): string;
    public function isAvailable(): bool;

    /** Best-effort log shipping. MUST NOT throw — log internally, return false on failure. */
    public function ship(LogEvent $event): bool;

    /** Best-effort metric recording. */
    public function recordMetric(MetricEvent $event): bool;

    /** Start a trace span. The returned handle MUST be finish()ed (use try/finally). */
    public function startSpan(SpanContext $context): TraceHandle;
}
```

---

## Task 3: LokiPrometheusShipper (CE default — no-op-ish)

```php
<?php
namespace App\Observability\Shippers;

use App\Contracts\ObservabilityShipperInterface;
use App\Observability\LogEvent;
use App\Observability\MetricEvent;
use App\Observability\SpanContext;
use App\Observability\TraceHandle;
use Illuminate\Support\Facades\Log;

/**
 * CE default. Loki/Prometheus already scrape Laravel logs and the
 * Prometheus exporter endpoint; this shipper bridges Parthenon-internal
 * events to those existing surfaces:
 *   - ship() forwards to the configured Laravel logger (Loki picks up
 *     via the docker container log driver or filesystem).
 *   - recordMetric() registers with the Prometheus client library if
 *     the prometheus_client_php package is available.
 *   - startSpan() returns a no-op handle (CE doesn't ship traces by
 *     default; opentelemetry-php registration is documented but opt-in).
 */
class LokiPrometheusShipper implements ObservabilityShipperInterface
{
    public function name(): string { return 'loki-prometheus'; }
    public function isAvailable(): bool { return true; }

    public function ship(LogEvent $event): bool {
        Log::log($event->level, $event->message, $event->context + [
            'trace_id' => $event->traceId,
            'span_id' => $event->spanId,
            'tenant_id' => $event->tenantId,
        ]);
        return true;
    }

    public function recordMetric(MetricEvent $event): bool {
        // Optional: integrate with promphp/prometheus_client_php if pulled in.
        // For CE default, swallow silently — the existing /metrics endpoint
        // is exposed by infrastructure-level exporters, not application code.
        return true;
    }

    public function startSpan(SpanContext $context): TraceHandle {
        return new TraceHandle($context, fn() => null);   // no-op finisher
    }
}
```

---

## Task 4: TDD — LokiPrometheusShipperTest

```php
<?php
use App\Observability\LogEvent;
use App\Observability\MetricEvent;
use App\Observability\Shippers\LokiPrometheusShipper;
use App\Observability\SpanContext;
use App\Observability\TraceHandle;
use Illuminate\Support\Facades\Log;

beforeEach(fn() => $this->shipper = app(LokiPrometheusShipper::class));

it('has the expected name and reports available', function () {
    expect($this->shipper->name())->toBe('loki-prometheus')
        ->and($this->shipper->isAvailable())->toBeTrue();
});

it('forwards ship() to the Laravel logger', function () {
    Log::spy();
    $event = new LogEvent(
        occurredAt: new \DateTimeImmutable(),
        level: 'info',
        message: 'hello',
        context: ['foo' => 'bar'],
        traceId: 'a1', spanId: 'b2', tenantId: 1,
    );
    expect($this->shipper->ship($event))->toBeTrue();
    Log::shouldHaveReceived('log')->once()
        ->with('info', 'hello', \Mockery::on(fn($c) =>
            $c['foo'] === 'bar' && $c['trace_id'] === 'a1' && $c['tenant_id'] === 1));
});

it('returns true for recordMetric (CE default has no-op metric impl)', function () {
    $m = new MetricEvent('counter', 'parthenon.test.count', 1.0, ['env' => 'test']);
    expect($this->shipper->recordMetric($m))->toBeTrue();
});

it('startSpan returns a usable handle that finishes cleanly', function () {
    $ctx = new SpanContext('cohort.materialize', str_repeat('a', 32), str_repeat('b', 16));
    $h = $this->shipper->startSpan($ctx);
    expect($h)->toBeInstanceOf(TraceHandle::class)
        ->and(fn() => $h->finish('ok'))->not->toThrow(\Throwable::class);
});
```

---

## Task 5: ShipperRegistry + Observer

```php
<?php
namespace App\Observability;

use App\Contracts\ObservabilityShipperInterface;

class ShipperRegistry
{
    /** @var array<int, ObservabilityShipperInterface> */
    private array $shippers = [];
    public function register(ObservabilityShipperInterface $s): void { $this->shippers[] = $s; }
    /** @return array<int, ObservabilityShipperInterface> */
    public function shippers(): array { return $this->shippers; }
    public function names(): array { return array_map(fn($s) => $s->name(), $this->shippers); }
}
```

```php
<?php
namespace App\Observability;

use App\Contracts\TenantResolverInterface;

class Observer
{
    public function __construct(
        private readonly ShipperRegistry $registry,
        private readonly ?TenantResolverInterface $tenants = null,
    ) {}

    public function log(string $level, string $message, array $context = []): void {
        $event = new LogEvent(
            occurredAt: new \DateTimeImmutable(),
            level: $level,
            message: $message,
            context: $context,
            tenantId: $this->tenants?->currentId(),
        );
        foreach ($this->registry->shippers() as $s) {
            if ($s->isAvailable()) $s->ship($event);
        }
    }

    public function metric(string $name, float $value, string $type = 'counter', array $tags = []): void {
        $event = new MetricEvent($type, $name, $value, $tags);
        foreach ($this->registry->shippers() as $s) {
            if ($s->isAvailable()) $s->recordMetric($event);
        }
    }

    public function span(string $name, array $attributes = []): TraceHandle {
        $ctx = new SpanContext(
            name: $name,
            traceId: bin2hex(random_bytes(16)),
            spanId: bin2hex(random_bytes(8)),
            attributes: $attributes,
        );
        // Return the first shipper's span; others are notified via finish callback if needed.
        $primary = $this->registry->shippers()[0] ?? null;
        return $primary?->startSpan($ctx) ?? new TraceHandle($ctx, fn() => null);
    }
}
```

---

## Task 6: Service provider, config, helper

- [ ] **`config/observability.php`**

```php
<?php

use App\Observability\Shippers\LokiPrometheusShipper;

return [
    'shippers' => [
        LokiPrometheusShipper::class,
        // EE registers DatadogShipper / SplunkShipper / OtelShipper here.
    ],
    'sampling' => [
        'logs' => env('OBS_LOG_SAMPLING', 1.0),
        'metrics' => env('OBS_METRIC_SAMPLING', 1.0),
        'traces' => env('OBS_TRACE_SAMPLING', 0.1),
    ],
];
```

- [ ] **ObservabilityServiceProvider**

```php
<?php
namespace App\Providers;

use App\Observability\Observer;
use App\Observability\ShipperRegistry;
use Illuminate\Support\ServiceProvider;

class ObservabilityServiceProvider extends ServiceProvider {
    public function register(): void {
        $this->app->singleton(ShipperRegistry::class);
        $this->app->singleton(Observer::class);
    }
    public function boot(): void {
        $registry = $this->app->make(ShipperRegistry::class);
        foreach (config('observability.shippers', []) as $class) {
            $registry->register($this->app->make($class));
        }
    }
}
```

- [ ] **Helper** — `backend/app/Support/helpers.php` (add to autoload if not already)

```php
if (!function_exists('obs')) {
    function obs(): \App\Observability\Observer {
        return app(\App\Observability\Observer::class);
    }
}
```

- [ ] Register in `bootstrap/providers.php`.

---

## Task 7: Pluggability proof

```php
<?php
namespace Tests\Feature\Observability;

use App\Contracts\ObservabilityShipperInterface;
use App\Observability\LogEvent;
use App\Observability\MetricEvent;
use App\Observability\SpanContext;
use App\Observability\TraceHandle;

class StubDatadogShipper implements ObservabilityShipperInterface {
    /** @var array<int, LogEvent> */ public array $logs = [];
    /** @var array<int, MetricEvent> */ public array $metrics = [];
    public function name(): string { return 'stub-datadog'; }
    public function isAvailable(): bool { return true; }
    public function ship(LogEvent $event): bool { $this->logs[] = $event; return true; }
    public function recordMetric(MetricEvent $event): bool { $this->metrics[] = $event; return true; }
    public function startSpan(SpanContext $ctx): TraceHandle { return new TraceHandle($ctx, fn() => null); }
}
```

```php
<?php
use App\Observability\Observer;
use App\Observability\ShipperRegistry;
use Tests\Feature\Observability\StubDatadogShipper;

it('fans out to a runtime-registered shipper', function () {
    $stub = new StubDatadogShipper();
    app(ShipperRegistry::class)->register($stub);
    obs()->log('info', 'test event', ['k' => 'v']);
    obs()->metric('parthenon.cohorts.created', 1.0);
    expect($stub->logs)->toHaveCount(1)
        ->and($stub->logs[0]->message)->toBe('test event')
        ->and($stub->metrics)->toHaveCount(1)
        ->and($stub->metrics[0]->name)->toBe('parthenon.cohorts.created');
});
```

---

## Task 8: Documentation + PR

- [ ] Doc page covers: Shipper contract, LogEvent/MetricEvent/SpanContext semantics, registration, sampling configuration, EE shipper examples (Datadog HTTP intake, Splunk HEC, OTel OTLP/HTTP).
- [ ] PR title: "feat(observability): ObservabilityShipper extension point (Phase 2 #5 of 8)"

---

## Plan 02-05 completion checklist

- [ ] Interface + value objects + LokiPrometheusShipper in place
- [ ] Existing log calls keep working; new `obs()->log()/metric()/span()` API available
- [ ] Stub shipper test proves pluggability
- [ ] Doc page published
- [ ] PR merged

## Out of scope

- EE Datadog/Splunk/OTel shippers — Plan 04
- Distributed trace propagation across the AI sidecar / R sidecar — future
- Trace sampling strategies beyond simple ratio — future
- Per-tenant observability routing — future (depends on 02-02 + EE)

*End of Plan 02-05.*
