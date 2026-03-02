<?php

namespace App\Services\Dqd\Checks;

use App\Contracts\DqdCheckInterface;

abstract class AbstractDqdCheck implements DqdCheckInterface
{
    /**
     * Default severity is "error" — override in subclasses for warning/info checks.
     */
    public function severity(): string
    {
        return 'error';
    }

    /**
     * Default threshold is 0.0 (zero tolerance) — override for checks that allow a percentage of violations.
     */
    public function threshold(): float
    {
        return 0.0;
    }

    /**
     * Default to null (table-level check) — override for column-specific checks.
     */
    public function cdmColumn(): ?string
    {
        return null;
    }
}
