<?php

declare(strict_types=1);

namespace App\Observability;

/**
 * W3C-compatible span context. Fields follow the W3C Trace Context spec:
 * traceId is a 32-character lowercase hex string, spanId is 16-character lowercase hex.
 *
 * @see https://www.w3.org/TR/trace-context/
 */
final readonly class SpanContext
{
    /**
     * @param  string  $name  Logical span name, e.g. 'cohort.materialize'
     * @param  string  $traceId  W3C 32-hex trace id
     * @param  string  $spanId  W3C 16-hex span id
     * @param  string|null  $parentSpanId  W3C 16-hex parent span id, or null for root spans
     * @param  array<string, mixed>  $attributes  Span attributes (OTel-style)
     */
    public function __construct(
        public string $name,
        public string $traceId,
        public string $spanId,
        public ?string $parentSpanId = null,
        public array $attributes = [],
    ) {}
}
