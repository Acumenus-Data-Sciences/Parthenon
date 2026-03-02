<?php

namespace App\Services\Cohort\Builders;

class EndStrategyBuilder
{
    /**
     * Build the end date SQL expression based on the EndStrategy configuration.
     *
     * Supported strategies:
     * - DateOffset: cohort_end_date = DATEADD(start_date|end_date, offset_days)
     * - null: defaults to the event end_date
     *
     * @param  array<string, mixed>|null  $endStrategy  The EndStrategy configuration
     * @param  string  $startDateExpr  The SQL expression for event start_date
     * @param  string  $endDateExpr  The SQL expression for event end_date
     * @return string  SQL expression for cohort_end_date
     */
    public function build(?array $endStrategy, string $startDateExpr, string $endDateExpr): string
    {
        if ($endStrategy === null) {
            // Default: use the event end_date, constrained to observation period
            return "LEAST({$endDateExpr}, ie.op_end_date)";
        }

        // DateOffset strategy
        if (isset($endStrategy['DateOffset'])) {
            $dateOffset = $endStrategy['DateOffset'];
            $dateField = $dateOffset['DateField'] ?? 'StartDate';
            $offset = (int) ($dateOffset['Offset'] ?? 0);

            $baseDateExpr = match ($dateField) {
                'EndDate' => $endDateExpr,
                default => $startDateExpr,
            };

            if ($offset === 0) {
                return "LEAST({$baseDateExpr}, ie.op_end_date)";
            }

            return "LEAST(DATEADD({$baseDateExpr}, {$offset}), ie.op_end_date)";
        }

        // CustomEra strategy (v1: not fully implemented, fall back to end_date)
        if (isset($endStrategy['CustomEra'])) {
            return "LEAST({$endDateExpr}, ie.op_end_date)";
        }

        // Fallback
        return "LEAST({$endDateExpr}, ie.op_end_date)";
    }
}
