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
                    $flattenedStrata[] = [
                        'stratum_name' => self::stringValue($rowData['stratum_name'] ?? $stratumName),
                        'stratum_value' => self::stringValue($rowData['stratum_value'] ?? $rowData['gender'] ?? $rowData['age_group'] ?? ''),
                        'persons_at_risk' => self::intValue($rowData['persons_at_risk'] ?? $rowData['subject_count'] ?? 0),
                        'persons_with_outcome' => self::intValue($rowData['persons_with_outcome'] ?? $rowData['outcome_count'] ?? 0),
                        'person_years' => self::floatValue($rowData['person_years'] ?? 0),
                        'incidence_rate' => self::floatValue($rowData['incidence_rate'] ?? 0),
                        'rate_95_ci_lower' => self::floatValue($rowData['rate_95_ci_lower'] ?? 0),
                        'rate_95_ci_upper' => self::floatValue($rowData['rate_95_ci_upper'] ?? 0),
                    ];
                }
            }

            $normalized[] = [
                'outcome_cohort_id' => self::intValue($overall['outcome_cohort_id'] ?? $outcomeId),
                'outcome_cohort_name' => self::stringValue($overall['outcome_cohort_name'] ?? "Outcome #{$outcomeId}"),
                'persons_at_risk' => self::intValue($overall['persons_at_risk'] ?? $overall['subject_count'] ?? 0),
                'persons_with_outcome' => self::intValue($overall['persons_with_outcome'] ?? $overall['outcome_count'] ?? 0),
                'person_years' => self::floatValue($overall['person_years'] ?? 0),
                'incidence_rate' => self::floatValue($overall['incidence_rate'] ?? 0),
                'rate_95_ci_lower' => self::floatValue($overall['rate_95_ci_lower'] ?? 0),
                'rate_95_ci_upper' => self::floatValue($overall['rate_95_ci_upper'] ?? 0),
                'strata' => $flattenedStrata,
            ];
        }

        return array_values($normalized);
    }

    /**
     * @param  mixed  $row
     * @return array<string, mixed>
     */
    private static function normalizeResultRow(mixed $row, int $index): array
    {
        $data = is_array($row) ? $row : [];
        $strata = is_array($data['strata'] ?? null) ? $data['strata'] : [];

        return [
            ...$data,
            'outcome_cohort_id' => self::intValue($data['outcome_cohort_id'] ?? $index),
            'outcome_cohort_name' => self::stringValue($data['outcome_cohort_name'] ?? "Outcome #".self::intValue($data['outcome_cohort_id'] ?? $index)),
            'persons_at_risk' => self::intValue($data['persons_at_risk'] ?? 0),
            'persons_with_outcome' => self::intValue($data['persons_with_outcome'] ?? 0),
            'person_years' => self::floatValue($data['person_years'] ?? 0),
            'incidence_rate' => self::floatValue($data['incidence_rate'] ?? 0),
            'rate_95_ci_lower' => self::floatValue($data['rate_95_ci_lower'] ?? 0),
            'rate_95_ci_upper' => self::floatValue($data['rate_95_ci_upper'] ?? 0),
            'strata' => array_values(array_map(function (mixed $stratum): array {
                $rowData = is_array($stratum) ? $stratum : [];

                return [
                    'stratum_name' => self::stringValue($rowData['stratum_name'] ?? 'Unknown stratum'),
                    'stratum_value' => self::stringValue($rowData['stratum_value'] ?? ''),
                    'persons_at_risk' => self::intValue($rowData['persons_at_risk'] ?? 0),
                    'persons_with_outcome' => self::intValue($rowData['persons_with_outcome'] ?? 0),
                    'person_years' => self::floatValue($rowData['person_years'] ?? 0),
                    'incidence_rate' => self::floatValue($rowData['incidence_rate'] ?? 0),
                    'rate_95_ci_lower' => self::floatValue($rowData['rate_95_ci_lower'] ?? 0),
                    'rate_95_ci_upper' => self::floatValue($rowData['rate_95_ci_upper'] ?? 0),
                ];
            }, $strata)),
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
