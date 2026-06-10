<?php

namespace App\Exceptions;

use App\Enums\GateStage;
use RuntimeException;

/**
 * Thrown when an operation is attempted before its prerequisite study gate has
 * cleared (ADR-0020 Phase 3). Carries the blocking stage so callers and the
 * orchestrator can surface a precise remediation.
 */
class GateBlockedException extends RuntimeException
{
    public function __construct(
        public readonly GateStage $stage,
        string $message,
    ) {
        parent::__construct($message);
    }
}
