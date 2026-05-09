<?php

declare(strict_types=1);

namespace App\Observability;

use App\Contracts\ObservabilityShipperInterface;
use Closure;
use Throwable;

/**
 * Handle returned from {@see ObservabilityShipperInterface::startSpan()}.
 *
 * Callers MUST call {@see finish()} to mark the span complete — typically inside
 * a try/finally block so the span is finished even when the work throws.
 */
final class TraceHandle
{
    private bool $finished = false;

    /** @var array<string, mixed> */
    private array $attributes = [];

    /** @var array<int, Throwable> */
    private array $exceptions = [];

    /**
     * @param  Closure(SpanContext, string): void  $finisher  Invoked once when the span is finished
     */
    public function __construct(
        public readonly SpanContext $context,
        private readonly Closure $finisher,
    ) {}

    public function setAttribute(string $key, mixed $value): void
    {
        $this->attributes[$key] = $value;
    }

    /**
     * Capture an exception against this span without finishing it.
     */
    public function recordException(Throwable $e): void
    {
        $this->exceptions[] = $e;
    }

    /**
     * Finish the span. Safe to call multiple times — subsequent calls are no-ops.
     *
     * @param  string  $status  'ok' | 'error' | 'cancelled' (free-form, but these three are conventional)
     */
    public function finish(string $status = 'ok'): void
    {
        if ($this->finished) {
            return;
        }
        $this->finished = true;
        ($this->finisher)($this->context, $status);
    }

    /**
     * @return array<string, mixed>
     */
    public function attributes(): array
    {
        return $this->attributes;
    }

    /**
     * @return array<int, Throwable>
     */
    public function exceptions(): array
    {
        return $this->exceptions;
    }
}
