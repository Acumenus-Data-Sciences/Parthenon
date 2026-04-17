<?php

namespace App\Support;

final class SelfControlledCohortResultNormalizer
{
    /**
     * @param  array<string, mixed>  $result
     * @return array<string, mixed>
     */
    public static function normalize(array $result): array
    {
        $summary = is_array($result['summary'] ?? null) ? $result['summary'] : [];
        $estimates = is_array($result['estimates'] ?? null) ? $result['estimates'] : [];

        $normalized = $result;
        $normalized['population'] = [
            'cases' => self::intValue($summary['cases'] ?? null),
            'outcomes' => self::intValue($summary['outcomes'] ?? null),
        ];
        $normalized['estimates'] = array_values(array_map(
            fn (mixed $row): array => self::normalizeEstimate($row),
            $estimates,
        ));

        return $normalized;
    }

    /**
     * @return array<string, mixed>
     */
    private static function normalizeEstimate(mixed $row): array
    {
        $data = is_array($row) ? $row : [];

        return [
            ...$data,
            'covariate' => self::stringValue($data['covariate'] ?? $data['name'] ?? ''),
            'irr' => self::floatValue($data['irr'] ?? null),
            'ci_lower' => self::floatValue($data['ci_lower'] ?? null),
            'ci_upper' => self::floatValue($data['ci_upper'] ?? null),
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
