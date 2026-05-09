<?php

namespace App\Contracts;

use App\Audit\AuditEvent;

/**
 * Sink for audit events. Implementations can be synchronous (e.g.
 * DatabaseAuditSink) or queue work (e.g. SignedAuditSink ships to S3
 * via Horizon).
 *
 * Sinks MUST NOT throw on write failure. They MUST log internally and
 * return false; the dispatcher records partial-failure state. The only
 * exception: a sink can throw to ABORT the request (e.g. EE's
 * SignedAuditSink can refuse to allow a request if WORM storage is
 * unreachable, depending on customer policy).
 */
interface AuditSinkInterface
{
    public function name(): string;

    /** Whether this sink is currently functional. */
    public function isAvailable(): bool;

    /** Persist or transmit the event. Return true on success, false on failure (do not throw). */
    public function write(AuditEvent $event): bool;

    /** Whether this sink runs synchronously in-request. False = queued. */
    public function isSynchronous(): bool;
}
