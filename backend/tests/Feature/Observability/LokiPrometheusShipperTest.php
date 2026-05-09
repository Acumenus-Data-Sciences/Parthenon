<?php

declare(strict_types=1);

use App\Observability\LogEvent;
use App\Observability\MetricEvent;
use App\Observability\Shippers\LokiPrometheusShipper;
use App\Observability\SpanContext;
use App\Observability\TraceHandle;
use Illuminate\Log\LogManager;
use Illuminate\Support\Facades\Log;

beforeEach(function () {
    $this->shipper = app(LokiPrometheusShipper::class);
});

it('has the expected name and reports as available', function () {
    expect($this->shipper->name())->toBe('loki-prometheus')
        ->and($this->shipper->isAvailable())->toBeTrue();
});

it('forwards ship() to the Laravel logger with merged trace context', function () {
    $captured = [];

    Log::swap(new class($captured) extends LogManager
    {
        /** @param  array<int, array{level: string, message: string, context: array<string, mixed>}>  $sink */
        public function __construct(private array &$sink)
        {
            // Bypass parent constructor — we only proxy log().
        }

        public function log($level, $message, array $context = []): void
        {
            $this->sink[] = ['level' => (string) $level, 'message' => (string) $message, 'context' => $context];
        }
    });

    $event = new LogEvent(
        occurredAt: new DateTimeImmutable,
        level: 'info',
        message: 'cohort generated',
        context: ['cohort_id' => 42],
        traceId: str_repeat('a', 32),
        spanId: str_repeat('b', 16),
        tenantId: 7,
    );

    expect($this->shipper->ship($event))->toBeTrue()
        ->and($captured)->toHaveCount(1)
        ->and($captured[0]['level'])->toBe('info')
        ->and($captured[0]['message'])->toBe('cohort generated')
        ->and($captured[0]['context'])->toMatchArray([
            'cohort_id' => 42,
            'trace_id' => str_repeat('a', 32),
            'span_id' => str_repeat('b', 16),
            'tenant_id' => 7,
        ]);
});

it('returns true for recordMetric (CE default has a no-op metric impl)', function () {
    $metric = new MetricEvent(
        type: 'counter',
        name: 'parthenon.test.count',
        value: 1.0,
        tags: ['env' => 'test'],
        unit: '1',
    );

    expect($this->shipper->recordMetric($metric))->toBeTrue();
});

it('startSpan returns a usable handle that finishes cleanly', function () {
    $ctx = new SpanContext(
        name: 'cohort.materialize',
        traceId: str_repeat('a', 32),
        spanId: str_repeat('b', 16),
    );

    $handle = $this->shipper->startSpan($ctx);

    expect($handle)->toBeInstanceOf(TraceHandle::class)
        ->and($handle->context)->toBe($ctx);

    // Must not throw, must be idempotent.
    $handle->finish('ok');
    $handle->finish('ok');

    expect(true)->toBeTrue();
});

it('returns false from ship() when the underlying logger explodes', function () {
    Log::swap(new class extends LogManager
    {
        public function __construct() {}

        public function log($level, $message, array $context = []): void
        {
            throw new RuntimeException('logger boom');
        }
    });

    $event = new LogEvent(
        occurredAt: new DateTimeImmutable,
        level: 'error',
        message: 'simulated logger failure',
    );

    // CE shipper guarantees ship() never throws.
    expect($this->shipper->ship($event))->toBeFalse();
});
