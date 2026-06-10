<?php

namespace App\Enums;

/**
 * Lifecycle of a single study gate (ADR-0020). A gate that `clears()` permits
 * the work behind it to proceed; `Overridden` requires a written rationale.
 */
enum GateStatus: string
{
    case Pending = 'pending';
    case Passed = 'passed';
    case Failed = 'failed';
    case Overridden = 'overridden';
    case Approved = 'approved';

    /**
     * Whether work gated behind this status may proceed (auto-pass, human
     * approval, or a justified override).
     */
    public function clears(): bool
    {
        return in_array($this, [self::Passed, self::Overridden, self::Approved], true);
    }
}
