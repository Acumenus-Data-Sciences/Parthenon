<?php

namespace App\Services\Cohort\Builders;

class OccurrenceFilterBuilder
{
    /**
     * Build HAVING clause for occurrence count filtering.
     *
     * @param  array<string, mixed>  $occurrence  The Occurrence definition
     *   - Type: 0 = exactly, 1 = at most, 2 = at least
     *   - Count: the threshold count
     * @return string|null  The HAVING clause (without HAVING keyword), or null if no filter
     */
    public function build(?array $occurrence): ?string
    {
        if ($occurrence === null) {
            return null;
        }

        $type = (int) ($occurrence['Type'] ?? 2);
        $count = (int) ($occurrence['Count'] ?? 0);

        return match ($type) {
            0 => "COUNT(*) = {$count}",
            1 => "COUNT(*) <= {$count}",
            2 => "COUNT(*) >= {$count}",
            default => "COUNT(*) >= {$count}",
        };
    }

    /**
     * Build a complete HAVING clause string with the HAVING keyword.
     */
    public function buildClause(?array $occurrence): string
    {
        $having = $this->build($occurrence);

        if ($having === null) {
            return '';
        }

        return "HAVING {$having}";
    }

    /**
     * Determine if the occurrence filter is a "count distinct" type
     * (i.e., counting distinct events vs total events).
     */
    public function isDistinct(?array $occurrence): bool
    {
        if ($occurrence === null) {
            return false;
        }

        return ($occurrence['IsDistinct'] ?? false) === true;
    }
}
