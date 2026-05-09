<?php

namespace App\Audit;

use App\Contracts\AuditSinkInterface;

/**
 * Fan-out coordinator for audit sinks.
 *
 * CE registers DatabaseAuditSink at boot. EE additionally registers
 * SignedAuditSink (S3/Azure WORM with HMAC chain). Every audit event
 * is dispatched to all registered sinks in order; partial failures
 * are recorded but do not abort the request (sinks return false rather
 * than throwing on failure).
 */
class AuditSinkRegistry
{
    /** @var array<int, AuditSinkInterface> */
    private array $sinks = [];

    public function register(AuditSinkInterface $sink): void
    {
        $this->sinks[] = $sink;
    }

    /** @return array<int, AuditSinkInterface> */
    public function sinks(): array
    {
        return $this->sinks;
    }

    /** @return array<int, string> */
    public function names(): array
    {
        return array_map(fn (AuditSinkInterface $s) => $s->name(), $this->sinks);
    }

    /**
     * Fan-out write. Returns map of sink name → success bool.
     *
     * @return array<string, bool>
     */
    public function dispatch(AuditEvent $event): array
    {
        $results = [];
        foreach ($this->sinks as $sink) {
            $results[$sink->name()] = $sink->isAvailable() ? $sink->write($event) : false;
        }

        return $results;
    }
}
