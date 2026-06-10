<?php

namespace App\Support;

final class IncidenceRateResultNormalizer
{
    /**
     * @param  array<string, mixed>  $result
     * @return array<string, mixed>
     */
    public static function normalize(array $result): array
    {
        if (isset($result['results']) && is_array($result['results'])) {
            return [
                ...$result,
                'results' => self::normalizeResultsList($result['results']),
            ];
        }

        return [
            ...$result,
            'results' => self::normalizeLegacyOutcomeMap($result),
        ];
    }

    /**
     * @param  array<int, mixed>  $results
     * @return array<int, array<string, mixed>>
     */
    private static function normalizeResultsList(array $results): array
    {
        return array_values(array_map(
            fn (mixed $row, int $index): array => self::normalizeResultRow($row, $index),
            $results,
            array_keys($results),
        ));
    }

    /**
     * @param  array<string, mixed>  $result
     * @return array<int, array<string, mixed>>
     */
    private static function normalizeLegacyOutcomeMap(array $result): array
    {
        $outcomes = is_array($result['outcomes'] ?? null) ? $result['outcomes'] : [];
        $normalized = [];

        foreach ($outcomes as $outcomeId => $outcomeData) {
            if (! is_array($outcomeData)) {
                continue;
            }

            $overall = is_array($outcomeData['overall'] ?? null) ? $outcomeData['overall'] : [];
            $strata = is_array($outcomeData['strata'] ?? null) ? $outcomeData['strata'] : [];
            $flattenedStrata = [];

            foreach ($strata as $stratumName => $rows) {
                if (! is_array($rows)) {
                    continue;
                }

                foreach ($rows as $row) {
                    $rowData = is_array($row) ? $row : [];
                    $flattenedStrata[] = self::withRateCi([
                        'stratum_name' => self::stringValue($rowData['stratum_name'] ?? $stratumName),
                        'stratum_value' => self::stringValue($rowData['stratum_value'] ?? $rowData['gender'] ?? $rowData['age_group'] ?? ''),
                        'persons_at_risk' => self::intValue($rowData['persons_at_risk'] ?? $rowData['subject_count'] ?? 0),
                        'persons_with_outcome' => self::intValue($rowData['persons_with_outcome'] ?? $rowData['outcome_count'] ?? 0),
                        'person_years' => self::floatValue($rowData['person_years'] ?? $rowData['person_years_at_risk'] ?? 0),
                        'incidence_rate' => self::floatValue($rowData['incidence_rate'] ?? $rowData['incidence_rate_per_1000py'] ?? 0),
                        'rate_95_ci_lower' => self::floatValue($rowData['rate_95_ci_lower'] ?? 0),
                        'rate_95_ci_upper' => self::floatValue($rowData['rate_95_ci_upper'] ?? 0),
                    ]);
                }
            }

            $normalized[] = self::withRateCi([
                'outcome_cohort_id' => self::intValue($overall['outcome_cohort_id'] ?? $outcomeId),
                'outcome_cohort_name' => self::stringValue($overall['outcome_cohort_name'] ?? "Outcome #{$outcomeId}"),
                'persons_at_risk' => self::intValue($overall['persons_at_risk'] ?? $overall['subject_count'] ?? 0),
                'persons_with_outcome' => self::intValue($overall['persons_with_outcome'] ?? $overall['outcome_count'] ?? 0),
                'person_years' => self::floatValue($overall['person_years'] ?? $overall['person_years_at_risk'] ?? 0),
                'incidence_rate' => self::floatValue($overall['incidence_rate'] ?? $overall['incidence_rate_per_1000py'] ?? 0),
                'rate_95_ci_lower' => self::floatValue($overall['rate_95_ci_lower'] ?? 0),
                'rate_95_ci_upper' => self::floatValue($overall['rate_95_ci_upper'] ?? 0),
                'strata' => $flattenedStrata,
            ]);
        }

        return $normalized;
    }

    /**
     * @return array<string, mixed>
     */
    private static function normalizeResultRow(mixed $row, int $index): array
    {
        $data = is_array($row) ? $row : [];
        $strata = is_array($data['strata'] ?? null) ? $data['strata'] : [];

        return self::withRateCi([
            ...$data,
            'outcome_cohort_id' => self::intValue($data['outcome_cohort_id'] ?? $index),
            'outcome_cohort_name' => self::stringValue($data['outcome_cohort_name'] ?? 'Outcome #'.self::intValue($data['outcome_cohort_id'] ?? $index)),
            'persons_at_risk' => self::intValue($data['persons_at_risk'] ?? 0),
            'persons_with_outcome' => self::intValue($data['persons_with_outcome'] ?? 0),
            'person_years' => self::floatValue($data['person_years'] ?? 0),
            'incidence_rate' => self::floatValue($data['incidence_rate'] ?? 0),
            'rate_95_ci_lower' => self::floatValue($data['rate_95_ci_lower'] ?? 0),
            'rate_95_ci_upper' => self::floatValue($data['rate_95_ci_upper'] ?? 0),
            'strata' => array_values(array_map(function (mixed $stratum): array {
                $rowData = is_array($stratum) ? $stratum : [];

                return self::withRateCi([
                    'stratum_name' => self::stringValue($rowData['stratum_name'] ?? 'Unknown stratum'),
                    'stratum_value' => self::stringValue($rowData['stratum_value'] ?? ''),
                    'persons_at_risk' => self::intValue($rowData['persons_at_risk'] ?? 0),
                    'persons_with_outcome' => self::intValue($rowData['persons_with_outcome'] ?? 0),
                    'person_years' => self::floatValue($rowData['person_years'] ?? 0),
                    'incidence_rate' => self::floatValue($rowData['incidence_rate'] ?? 0),
                    'rate_95_ci_lower' => self::floatValue($rowData['rate_95_ci_lower'] ?? 0),
                    'rate_95_ci_upper' => self::floatValue($rowData['rate_95_ci_upper'] ?? 0),
                ]);
            }, $strata)),
        ]);
    }

    /**
     * Populate the 95% incidence-rate confidence interval when the upstream
     * SQL did not compute one (it emits 0/0 placeholders).
     *
     * The interval is only filled when both bounds are currently zero, the
     * event count is non-negative (i.e. not min-cell-count masked to -1), and
     * person-time is positive. Any interval already provided (e.g. by a future
     * SQL/R upgrade) is preserved untouched.
     *
     * @param  array<string, mixed>  $row
     * @return array<string, mixed>
     */
    private static function withRateCi(array $row): array
    {
        $lower = self::floatValue($row['rate_95_ci_lower'] ?? 0);
        $upper = self::floatValue($row['rate_95_ci_upper'] ?? 0);

        if ($lower !== 0.0 || $upper !== 0.0) {
            return $row;
        }

        $events = self::intValue($row['persons_with_outcome'] ?? 0);
        $personYears = self::floatValue($row['person_years'] ?? 0);

        if ($events < 0 || $personYears <= 0.0) {
            return $row;
        }

        $ci = self::poissonRateCi($events, $personYears);
        $row['rate_95_ci_lower'] = $ci['lower'];
        $row['rate_95_ci_upper'] = $ci['upper'];

        return $row;
    }

    /**
     * 95% confidence interval for a Poisson incidence rate using Byar's
     * approximation to the exact (Garwood) interval. Bounds are returned on the
     * same per-N person-time scale as the point estimate (default per 1,000
     * person-years).
     *
     * Byar's method is accurate for small event counts and, unlike the
     * log-normal approximation, is well-defined at zero events — important for
     * the negative-control outcomes that legitimately observe no events.
     *
     * @return array{lower: float, upper: float}
     */
    private static function poissonRateCi(int $events, float $personYears, float $per = 1000.0): array
    {
        if ($personYears <= 0.0 || $events < 0) {
            return ['lower' => 0.0, 'upper' => 0.0];
        }

        $scale = $per / $personYears;

        // Zero events: lower bound is 0, upper bound uses the exact one-sided
        // Poisson result chi2(0.975, 2)/2 = 3.6888794541139363 expected events.
        if ($events === 0) {
            return ['lower' => 0.0, 'upper' => round(3.6888794541139363 * $scale, 4)];
        }

        $z = 1.959963984540054; // 97.5th percentile of the standard normal

        $lowerCount = $events * (1 - 1 / (9 * $events) - $z / (3 * sqrt($events))) ** 3;
        $up = $events + 1;
        $upperCount = $up * (1 - 1 / (9 * $up) + $z / (3 * sqrt($up))) ** 3;

        return [
            'lower' => round(max(0.0, $lowerCount) * $scale, 4),
            'upper' => round($upperCount * $scale, 4),
        ];
    }

    private static function intValue(mixed $value): int
    {
        return is_numeric($value) ? (int) $value : 0;
    }

    private static function floatValue(mixed $value): float
    {
        return is_numeric($value) ? (float) $value : 0.0;
    }

    private static function stringValue(mixed $value): string
    {
        return is_string($value) ? $value : '';
    }
}
