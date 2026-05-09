<?php

declare(strict_types=1);

use App\Observability\LogEvent;
use App\Observability\MetricEvent;
use App\Observability\SpanContext;
use App\Observability\TraceHandle;

it('LogEvent retains every field passed to the constructor', function () {
    $now = new DateTimeImmutable;
    $event = new LogEvent(
        occurredAt: $now,
        level: 'warning',
        message: 'slow query detected',
        context: ['duration_ms' => 1234],
        traceId: str_repeat('a', 32),
        spanId: str_repeat('b', 16),
        tenantId: 5,
    );

    expect($event->occurredAt)->toBe($now)
        ->and($event->level)->toBe('warning')
        ->and($event->message)->toBe('slow query detected')
        ->and($event->context)->toMatchArray(['duration_ms' => 1234])
        ->and($event->traceId)->toBe(str_repeat('a', 32))
        ->and($event->spanId)->toBe(str_repeat('b', 16))
        ->and($event->tenantId)->toBe(5);
});

it('MetricEvent defaults unit to empty (R5 backward-compat)', function () {
    $event = new MetricEvent(type: 'counter', name: 'parthenon.x', value: 1.0);

    expect($event->unit)->toBe('')
        ->and($event->tags)->toBe([]);
});

it('MetricEvent accepts a UCUM-style unit hint (R5)', function () {
    $event = new MetricEvent(
        type: 'histogram',
        name: 'parthenon.cohort.materialize.duration',
        value: 142.0,
        tags: ['source' => 'eunomia'],
        unit: 'ms',
    );

    expect($event->unit)->toBe('ms')
        ->and($event->type)->toBe('histogram');
});

it('SpanContext preserves W3C identifiers', function () {
    $ctx = new SpanContext(
        name: 'cohort.materialize',
        traceId: str_repeat('1', 32),
        spanId: str_repeat('2', 16),
        parentSpanId: str_repeat('3', 16),
        attributes: ['cohort_id' => 99],
    );

    expect(strlen($ctx->traceId))->toBe(32)
        ->and(strlen($ctx->spanId))->toBe(16)
        ->and($ctx->parentSpanId)->toBe(str_repeat('3', 16))
        ->and($ctx->attributes)->toMatchArray(['cohort_id' => 99]);
});

it('TraceHandle.finish() invokes the finisher exactly once and is safe to repeat', function () {
    $ctx = new SpanContext('cohort.materialize', str_repeat('a', 32), str_repeat('b', 16));
    $calls = [];

    $handle = new TraceHandle($ctx, function (SpanContext $c, string $status) use (&$calls): void {
        $calls[] = ['span' => $c->name, 'status' => $status];
    });

    $handle->setAttribute('rows', 1234);
    $handle->finish('ok');
    $handle->finish('ok');     // idempotent
    $handle->finish('error');  // still no second invocation

    expect($calls)->toHaveCount(1)
        ->and($calls[0])->toMatchArray(['span' => 'cohort.materialize', 'status' => 'ok'])
        ->and($handle->attributes())->toMatchArray(['rows' => 1234]);
});

it('TraceHandle.recordException() collects exceptions for inspection', function () {
    $ctx = new SpanContext('cohort.materialize', str_repeat('a', 32), str_repeat('b', 16));
    $handle = new TraceHandle($ctx, fn () => null);

    $handle->recordException(new RuntimeException('boom'));

    expect($handle->exceptions())->toHaveCount(1)
        ->and($handle->exceptions()[0])->toBeInstanceOf(RuntimeException::class);
});
