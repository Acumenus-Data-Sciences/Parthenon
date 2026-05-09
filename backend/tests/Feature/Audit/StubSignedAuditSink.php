<?php

namespace Tests\Feature\Audit;

use App\Audit\AuditEvent;
use App\Contracts\AuditSinkInterface;

/**
 * Test fixture: alternate sink demonstrating fan-out pluggability.
 * Captures written events in-memory for assertion.
 */
class StubSignedAuditSink implements AuditSinkInterface
{
    /** @var array<int, AuditEvent> */
    public array $written = [];

    public function name(): string
    {
        return 'stub-signed';
    }

    public function isAvailable(): bool
    {
        return true;
    }

    public function isSynchronous(): bool
    {
        return false;
    }

    public function write(AuditEvent $event): bool
    {
        $this->written[] = $event;

        return true;
    }
}
