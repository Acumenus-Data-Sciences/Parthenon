<?php

declare(strict_types=1);

use App\Contracts\ObservabilityShipperInterface;
use App\Observability\LogEvent;
use App\Observability\MetricEvent;
use App\Observability\Observer;
use App\Observability\ShipperRegistry;
use App\Observability\Shippers\LokiPrometheusShipper;
use App\Observability\SpanContext;
use App\Observability\TraceHandle;
use Tests\Feature\Observability\StubDatadogShipper;

it('boots with the CE default LokiPrometheusShipper registered', function () {
    /** @var ShipperRegistry $registry */
    $registry = app(ShipperRegistry::class);

    expect($registry->names())->toContain('loki-prometheus')
        ->and($registry->shippers()[0])->toBeInstanceOf(LokiPrometheusShipper::class);
});

it('fans out logs and metrics to a runtime-registered shipper (pluggability proof)', function () {
    $stub = new StubDatadogShipper;

    /** @var ShipperRegistry $registry */
    $registry = app(ShipperRegistry::class);
    $registry->register($stub);

    obs()->log('info', 'plug-in event', ['k' => 'v']);
    obs()->metric('parthenon.cohorts.created', 3.0, 'counter', ['source' => 'eunomia'], '1');

    expect($stub->logs)->toHaveCount(1)
        ->and($stub->logs[0]->message)->toBe('plug-in event')
        ->and($stub->logs[0]->context)->toMatchArray(['k' => 'v'])
        ->and($stub->metrics)->toHaveCount(1)
        ->and($stub->metrics[0]->name)->toBe('parthenon.cohorts.created')
        ->and($stub->metrics[0]->value)->toBe(3.0)
        ->and($stub->metrics[0]->unit)->toBe('1')
        ->and($stub->metrics[0]->tags)->toMatchArray(['source' => 'eunomia']);
});

it('skips shippers reporting isAvailable=false', function () {
    $offline = new StubDatadogShipper(available: false);

    /** @var ShipperRegistry $registry */
    $registry = app(ShipperRegistry::class);
    $registry->register($offline);

    obs()->log('warning', 'should not reach offline shipper');

    expect($offline->logs)->toBeEmpty();
});

it('keeps fanning out when one shipper throws', function () {
    $boom = new class implements ObservabilityShipperInterface
    {
        public function name(): string
        {
            return 'boom';
        }

        public function isAvailable(): bool
        {
            return true;
        }

        public function ship(LogEvent $event): bool
        {
            throw new RuntimeException('shipper exploded');
        }

        public function recordMetric(MetricEvent $event): bool
        {
            throw new RuntimeException('shipper exploded');
        }

        public function startSpan(SpanContext $context): TraceHandle
        {
            return new TraceHandle($context, fn () => null);
        }
    };

    $survivor = new StubDatadogShipper;

    /** @var ShipperRegistry $registry */
    $registry = app(ShipperRegistry::class);
    $registry->register($boom);
    $registry->register($survivor);

    // Must not throw out of obs()->log()/metric().
    obs()->log('error', 'fan-out resilience test');
    obs()->metric('parthenon.test.gauge', 1.0, 'gauge');

    expect($survivor->logs)->toHaveCount(1)
        ->and($survivor->metrics)->toHaveCount(1);
});

it('span() returns a finishable handle even with no shippers registered', function () {
    /** @var ShipperRegistry $registry */
    $registry = app(ShipperRegistry::class);
    $registry->clear();

    $observer = new Observer($registry);

    $handle = $observer->span('cohort.materialize', ['cohort_id' => 1]);

    expect($handle)->toBeInstanceOf(TraceHandle::class)
        ->and($handle->context->name)->toBe('cohort.materialize')
        ->and($handle->context->attributes)->toMatchArray(['cohort_id' => 1]);

    $handle->finish('ok');
    expect(true)->toBeTrue();
});
