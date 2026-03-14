<?php

namespace App\Support;

final class SccsResultNormalizer
{
    /**
     * @param  array<string, mixed>  $result
     * @return array<string, mixed>
     */
    public static function normalize(array $result): array
    {
        $summary = is_array($result['summary'] ?? null) ? $result['summary'] : [];
        $population = is_array($result['population'] ?? null) ? $result['population'] : [];

        return [
            ...$result,
            'status' => self::stringValue($result['status'] ?? ''),
            'message' => isset($result['message']) ? self::stringValue($result['message']) : null,
            'estimates' => self::normalizeEstimates($result['estimates'] ?? []),
            'population' => [
                'cases' => self::intValue($population['cases'] ?? $summary['cases'] ?? 0),
                'outcomes' => self::intValue($population['outcomes'] ?? $summary['outcomes'] ?? $summary['events'] ?? 0),
                'observation_periods' => self::intValue($population['observation_periods'] ?? 0),
            ],
            'eras' => self::listValue($result['eras'] ?? []),
        ];
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private static function normalizeEstimates(mixed $value): array
    {
        if (! is_array($value)) {
            return [];
        }

        return array_values(array_map(function (mixed $row, int $index): array {
            $data = is_array($row) ? $row : [];

            return [
                ...$data,
                'covariate' => self::stringValue($data['covariate'] ?? $data['name'] ?? "Covariate ".($index + 1)),
                'irr' => self::floatValue($data['irr'] ?? 0),
                'ci_lower' => self::floatValue($data['ci_lower'] ?? 0),
                'ci_upper' => self::floatValue($data['ci_upper'] ?? 0),
                'log_rr' => self::floatValue($data['log_rr'] ?? 0),
                'se_log_rr' => self::floatValue($data['se_log_rr'] ?? 0),
            ];
        }, $value, array_keys($value)));
    }

    /**
     * @return array<int, mixed>
     */
    private static function listValue(mixed $value): array
    {
        return is_array($value) ? array_values($value) : [];
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
