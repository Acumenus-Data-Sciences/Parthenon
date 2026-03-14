<?php

namespace App\Support;

final class EstimationResultNormalizer
{
    /**
     * @param  array<string, mixed>  $result
     * @return array<string, mixed>
     */
    public static function normalize(array $result): array
    {
        $summary = is_array($result['summary'] ?? null) ? $result['summary'] : [];
        $ps = is_array($result['propensity_score'] ?? null) ? $result['propensity_score'] : null;
        $km = is_array($result['kaplan_meier'] ?? null) ? $result['kaplan_meier'] : null;
        $negativeControls = $result['negative_controls'] ?? [];

        if (is_array($negativeControls) && array_key_exists('estimates', $negativeControls)) {
            $negativeControls = $negativeControls['estimates'];
        }

        return [
            ...$result,
            'summary' => [
                'target_count' => self::intValue($summary['target_count'] ?? 0),
                'comparator_count' => self::intValue($summary['comparator_count'] ?? 0),
                'outcome_counts' => is_array($summary['outcome_counts'] ?? null)
                    ? $summary['outcome_counts']
                    : [],
            ],
            'estimates' => self::listValue($result['estimates'] ?? []),
            'propensity_score' => $ps === null ? null : [
                ...$ps,
                'distribution' => is_array($ps['distribution'] ?? null)
                    ? [
                        'target' => self::listValue($ps['distribution']['target'] ?? []),
                        'comparator' => self::listValue($ps['distribution']['comparator'] ?? []),
                    ]
                    : null,
            ],
            'covariate_balance' => self::listValue($result['covariate_balance'] ?? []),
            'kaplan_meier' => $km === null ? null : [
                'target' => self::listValue($km['target'] ?? []),
                'comparator' => self::listValue($km['comparator'] ?? []),
            ],
            'attrition' => self::listValue($result['attrition'] ?? []),
            'mdrr' => self::assocValue($result['mdrr'] ?? []),
            'negative_controls' => self::listValue($negativeControls),
            'power_analysis' => self::listValue($result['power_analysis'] ?? []),
        ];
    }

    private static function intValue(mixed $value): int
    {
        return is_numeric($value) ? (int) $value : 0;
    }

    /**
     * @return array<int, mixed>
     */
    private static function listValue(mixed $value): array
    {
        return is_array($value) ? array_values($value) : [];
    }

    /**
     * @return array<string, mixed>
     */
    private static function assocValue(mixed $value): array
    {
        return is_array($value) ? $value : [];
    }
}
