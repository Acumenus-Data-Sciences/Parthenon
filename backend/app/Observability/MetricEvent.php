<?php

declare(strict_types=1);

namespace App\Observability;

use App\Contracts\ObservabilityShipperInterface;
use DateTimeImmutable;

/**
 * Immutable value object describing a single metric emission.
 *
 * Shipped through {@see ObservabilityShipperInterface::recordMetric()}.
 */
final readonly class MetricEvent
{
    /**
     * @param  string  $type  'counter' | 'gauge' | 'histogram'
     * @param  string  $name  Dotted metric name, e.g. 'parthenon.cohorts.generated.count'
     * @param  array<string, string>  $tags  Low-cardinality string-only tags
     * @param  string  $unit  UCUM-style unit hint ('', 's', 'ms', 'By', 'KiBy', '1' for unitless count) — Cross-Plan Revision R5
     */
    public function __construct(
        public string $type,
        public string $name,
        public float $value,
        public array $tags = [],
        public DateTimeImmutable $occurredAt = new DateTimeImmutable,
        public string $unit = '',
    ) {}
}
