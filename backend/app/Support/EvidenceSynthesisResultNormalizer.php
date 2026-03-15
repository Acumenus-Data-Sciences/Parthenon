<?php

namespace App\Support;

final class EvidenceSynthesisResultNormalizer
{
    /**
     * @param  array<string, mixed>  $result
     * @return array<string, mixed>
     */
    public static function normalize(array $result): array
    {
        return [
            ...$result,
            'status' => self::stringValue($result['status'] ?? ''),
            'message' => isset($result['message']) ? self::stringValue($result['message']) : null,
            'method' => self::stringValue($result['method'] ?? ''),
            'pooled' => self::normalizePooled($result['pooled'] ?? []),
            'per_site' => self::normalizePerSite($result['per_site'] ?? []),
        ];
    }

    /**
     * @return array<string, float>
     */
    private static function normalizePooled(mixed $value): array
    {
        $data = is_array($value) ? $value : [];

        return [
            'log_rr' => self::floatValue($data['log_rr'] ?? 0),
            'se_log_rr' => self::floatValue($data['se_log_rr'] ?? 0),
            'hr' => self::floatValue($data['hr'] ?? 0),
            'ci_lower' => self::floatValue($data['ci_lower'] ?? 0),
            'ci_upper' => self::floatValue($data['ci_upper'] ?? 0),
            'tau' => self::floatValue($data['tau'] ?? 0),
        ];
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private static function normalizePerSite(mixed $value): array
    {
        if (! is_array($value)) {
            return [];
        }

        return array_values(array_map(function (mixed $row, int $index): array {
            $data = is_array($row) ? $row : [];

            return [
                ...$data,
                'site_name' => self::stringValue($data['site_name'] ?? 'Site '.($index + 1)),
                'log_rr' => self::floatValue($data['log_rr'] ?? 0),
                'se_log_rr' => self::floatValue($data['se_log_rr'] ?? 0),
                'hr' => self::floatValue($data['hr'] ?? 0),
                'ci_lower' => self::floatValue($data['ci_lower'] ?? 0),
                'ci_upper' => self::floatValue($data['ci_upper'] ?? 0),
            ];
        }, $value, array_keys($value)));
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
