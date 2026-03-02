<?php

namespace App\Services\Cohort\Builders;

class TemporalWindowBuilder
{
    /**
     * Build temporal window SQL constraints.
     *
     * A window has Start and End boundaries, each with Days and Coeff.
     * Coeff: -1 = before the index date, 1 = after the index date.
     * Days: always positive, represents the number of days offset.
     *
     * The resulting SQL constrains `$eventDateExpr` relative to `$indexDateExpr`.
     *
     * @param  array<string, mixed>  $window  The window definition with Start/End
     * @param  string  $eventDateExpr  The date expression of the correlated event
     * @param  string  $indexDateExpr  The date expression of the index event
     * @return list<string>  SQL WHERE clause fragments
     */
    public function build(array $window, string $eventDateExpr, string $indexDateExpr): array
    {
        $clauses = [];

        // Start boundary
        if (isset($window['Start'])) {
            $start = $window['Start'];
            $days = (int) ($start['Days'] ?? 0);
            $coeff = (int) ($start['Coeff'] ?? 1);
            $offset = $days * $coeff;

            $useEventEnd = ($start['UseEventEnd'] ?? false) === true;
            $dateExpr = $useEventEnd ? str_replace('start_date', 'end_date', $eventDateExpr) : $eventDateExpr;

            $clauses[] = "{$dateExpr} >= DATEADD({$indexDateExpr}, {$offset})";
        }

        // End boundary
        if (isset($window['End'])) {
            $end = $window['End'];
            $days = (int) ($end['Days'] ?? 0);
            $coeff = (int) ($end['Coeff'] ?? 1);
            $offset = $days * $coeff;

            $useEventEnd = ($end['UseEventEnd'] ?? false) === true;
            $dateExpr = $useEventEnd ? str_replace('start_date', 'end_date', $eventDateExpr) : $eventDateExpr;

            $clauses[] = "{$dateExpr} <= DATEADD({$indexDateExpr}, {$offset})";
        }

        return $clauses;
    }

    /**
     * Check if a window definition is present and has meaningful boundaries.
     */
    public function hasWindow(?array $window): bool
    {
        if ($window === null) {
            return false;
        }

        return isset($window['Start']) || isset($window['End']);
    }
}
