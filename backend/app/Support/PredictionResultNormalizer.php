<?php

namespace App\Support;

final class PredictionResultNormalizer
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
            'summary' => [
                'target_count' => self::intValue($result['summary']['target_count'] ?? 0),
                'outcome_count' => self::intValue($result['summary']['outcome_count'] ?? 0),
                'outcome_rate' => self::floatValue($result['summary']['outcome_rate'] ?? 0),
            ],
            'performance' => [
                'auc' => self::floatValue($result['performance']['auc'] ?? 0),
                'auc_ci_lower' => self::floatValue($result['performance']['auc_ci_lower'] ?? 0),
                'auc_ci_upper' => self::floatValue($result['performance']['auc_ci_upper'] ?? 0),
                'brier_score' => self::floatValue($result['performance']['brier_score'] ?? 0),
                'calibration_slope' => self::floatValue($result['performance']['calibration_slope'] ?? 0),
                'calibration_intercept' => self::floatValue($result['performance']['calibration_intercept'] ?? 0),
                'auprc' => isset($result['performance']['auprc']) && is_numeric($result['performance']['auprc'])
                    ? (float) $result['performance']['auprc']
                    : null,
            ],
            'top_predictors' => self::normalizePredictors($result['top_predictors'] ?? []),
            'roc_curve' => self::listValue($result['roc_curve'] ?? []),
            'precision_recall_curve' => self::listValue($result['precision_recall_curve'] ?? []),
            'calibration' => self::listValue($result['calibration'] ?? []),
            'discrimination' => self::normalizeDiscrimination($result['discrimination'] ?? null),
            'net_benefit' => self::listValue($result['net_benefit'] ?? []),
            'prediction_distribution' => self::listValue($result['prediction_distribution'] ?? []),
            'external_validation' => self::listValue($result['external_validation'] ?? []),
        ];
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private static function normalizePredictors(mixed $value): array
    {
        if (! is_array($value)) {
            return [];
        }

        return array_values(array_map(function (mixed $row, int $index): array {
            $data = is_array($row) ? $row : [];

            return [
                ...$data,
                'covariate_name' => self::stringValue($data['covariate_name'] ?? "Predictor ".($index + 1)),
                'coefficient' => self::floatValue($data['coefficient'] ?? 0),
                'importance' => self::floatValue($data['importance'] ?? 0),
            ];
        }, $value, array_keys($value)));
    }

    /**
     * @return array<string, array<string, float>>|null
     */
    private static function normalizeDiscrimination(mixed $value): ?array
    {
        if (! is_array($value)) {
            return null;
        }

        return [
            'outcome_group' => self::normalizeBoxPlotStats($value['outcome_group'] ?? []),
            'no_outcome_group' => self::normalizeBoxPlotStats($value['no_outcome_group'] ?? []),
        ];
    }

    /**
     * @return array<string, float>
     */
    private static function normalizeBoxPlotStats(mixed $value): array
    {
        $data = is_array($value) ? $value : [];

        return [
            'min' => self::floatValue($data['min'] ?? 0),
            'q1' => self::floatValue($data['q1'] ?? 0),
            'median' => self::floatValue($data['median'] ?? 0),
            'q3' => self::floatValue($data['q3'] ?? 0),
            'max' => self::floatValue($data['max'] ?? 0),
            'mean' => self::floatValue($data['mean'] ?? 0),
        ];
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
