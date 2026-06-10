<?php

namespace App\Support;

use App\Support\Statistics\Multiplicity;

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

        $estimates = self::withAdjustedP(self::listValue($result['estimates'] ?? []));
        $calibration = self::normalizeCalibration($result['calibration'] ?? null);

        return [
            ...$result,
            'summary' => [
                'target_count' => self::intValue($summary['target_count'] ?? 0),
                'comparator_count' => self::intValue($summary['comparator_count'] ?? 0),
                'outcome_counts' => is_array($summary['outcome_counts'] ?? null)
                    ? $summary['outcome_counts']
                    : [],
            ],
            'estimates' => $estimates,
            'calibration' => $calibration,
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

    /**
     * Annotate each row with a Benjamini-Hochberg FDR-adjusted p-value.
     *
     * @param  array<int, mixed>  $rows
     * @return array<int, mixed>
     */
    private static function withAdjustedP(array $rows, string $pKey = 'p_value', string $outKey = 'adjusted_p'): array
    {
        $pValues = array_map(
            static fn ($row) => is_array($row) && isset($row[$pKey]) && is_numeric($row[$pKey])
                ? (float) $row[$pKey]
                : null,
            $rows
        );

        $adjusted = Multiplicity::benjaminiHochberg($pValues);

        $out = [];
        foreach ($rows as $i => $row) {
            if (is_array($row)) {
                $row[$outKey] = $adjusted[$i] ?? null;
            }
            $out[] = $row;
        }

        return $out;
    }

    /**
     * Normalize the empirical-calibration block returned by the R sidecar.
     *
     * @return array<string, mixed>|null
     */
    private static function normalizeCalibration(mixed $calibration): ?array
    {
        if (! is_array($calibration) || $calibration === []) {
            return null;
        }

        $calibratedEstimates = self::withAdjustedP(
            self::listValue($calibration['calibrated_estimates'] ?? []),
            'calibrated_p',
            'calibrated_adjusted_p'
        );

        return [
            'status' => is_string($calibration['status'] ?? null) ? $calibration['status'] : 'unknown',
            'min_negative_controls' => self::intValue($calibration['min_negative_controls'] ?? 0),
            'informative_negative_controls' => self::intValue($calibration['informative_negative_controls'] ?? 0),
            'message' => is_string($calibration['message'] ?? null) ? $calibration['message'] : null,
            'ease' => isset($calibration['ease']) && is_numeric($calibration['ease']) ? (float) $calibration['ease'] : null,
            'systematic_error_model' => self::assocValue($calibration['systematic_error_model'] ?? []),
            'calibrated_estimates' => $calibratedEstimates,
            'calibration_plot' => self::assocValue($calibration['calibration_plot'] ?? []),
        ];
    }
}
