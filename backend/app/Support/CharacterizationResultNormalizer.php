<?php

namespace App\Support;

final class CharacterizationResultNormalizer
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
            'results' => self::normalizeLegacyTargetComparatorFormat($result),
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
    private static function normalizeLegacyTargetComparatorFormat(array $result): array
    {
        $results = [];

        foreach (['targetCohorts', 'comparatorCohorts'] as $bucket) {
            $cohorts = is_array($result[$bucket] ?? null) ? $result[$bucket] : [];

            foreach ($cohorts as $cohortId => $domainData) {
                if (! is_array($domainData)) {
                    continue;
                }

                $features = [];
                $personCount = 0;

                foreach ($domainData as $domain => $rows) {
                    $normalizedRows = self::normalizeFeatureRows(
                        is_array($rows) ? $rows : [],
                        (string) $domain,
                        (int) $cohortId,
                    );

                    $features[(string) $domain] = $normalizedRows;

                    foreach ($normalizedRows as $row) {
                        $personCount = max($personCount, self::intValue($row['count'] ?? 0));
                    }
                }

                $results[] = [
                    'cohort_id' => (int) $cohortId,
                    'cohort_name' => "Cohort #{$cohortId}",
                    'person_count' => $personCount,
                    'features' => $features,
                ];
            }
        }

        return array_values($results);
    }

    /**
     * @return array<string, mixed>
     */
    private static function normalizeResultRow(mixed $row, int $index): array
    {
        $data = is_array($row) ? $row : [];
        $features = is_array($data['features'] ?? null) ? $data['features'] : [];

        $normalizedFeatures = [];
        foreach ($features as $featureType => $featureRows) {
            $normalizedFeatures[(string) $featureType] = self::normalizeFeatureRows(
                is_array($featureRows) ? $featureRows : [],
                (string) $featureType,
                self::intValue($data['cohort_id'] ?? $index),
            );
        }

        return [
            ...$data,
            'cohort_id' => self::intValue($data['cohort_id'] ?? $index),
            'cohort_name' => self::stringValue($data['cohort_name'] ?? 'Cohort #'.self::intValue($data['cohort_id'] ?? $index)),
            'person_count' => self::intValue($data['person_count'] ?? 0),
            'features' => $normalizedFeatures,
        ];
    }

    /**
     * @param  array<int, mixed>  $rows
     * @return array<int, array<string, mixed>>
     */
    private static function normalizeFeatureRows(array $rows, string $featureType, int $cohortId): array
    {
        return array_values(array_map(function (mixed $row, int $index) use ($featureType, $cohortId): array {
            $data = is_array($row) ? $row : [];

            return [
                ...$data,
                'feature_name' => self::stringValue(
                    $data['feature_name']
                    ?? $data['covariate_name']
                    ?? $data['concept_name']
                    ?? 'Feature '.($index + 1)
                ),
                'category' => self::stringValue($data['category'] ?? $featureType),
                'count' => self::intValue($data['count'] ?? $data['person_count'] ?? $data['count_value'] ?? 0),
                'percent' => self::floatValue($data['percent'] ?? $data['percent_value'] ?? 0),
                'avg_value' => self::nullableFloatValue($data['avg_value'] ?? $data['mean'] ?? null),
                'std_dev' => self::nullableFloatValue($data['std_dev'] ?? null),
                'cohort_id' => self::intValue($data['cohort_id'] ?? $cohortId),
                'cohort_name' => isset($data['cohort_name']) ? self::stringValue($data['cohort_name']) : null,
            ];
        }, $rows, array_keys($rows)));
    }

    private static function intValue(mixed $value): int
    {
        return is_numeric($value) ? (int) $value : 0;
    }

    private static function floatValue(mixed $value): float
    {
        return is_numeric($value) ? (float) $value : 0.0;
    }

    private static function nullableFloatValue(mixed $value): ?float
    {
        return is_numeric($value) ? (float) $value : null;
    }

    private static function stringValue(mixed $value): string
    {
        return is_string($value) ? $value : '';
    }
}
