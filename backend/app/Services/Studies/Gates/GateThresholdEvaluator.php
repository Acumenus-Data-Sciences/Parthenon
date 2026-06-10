<?php

namespace App\Services\Studies\Gates;

use App\Enums\GateStage;
use App\Enums\GateStatus;

/**
 * Pure, deterministic gate-threshold logic (ADR-0020 Phase 3). Given a stage's
 * computed metrics and its thresholds, returns the gate status plus the precise
 * reasons it failed. No I/O — every branch is unit-testable, and the study-114
 * failures (PS separation, too-few negative controls) are encoded directly.
 */
final class GateThresholdEvaluator
{
    /**
     * @param  array<string, mixed>  $metrics
     * @param  array<string, mixed>  $thresholds
     * @return array{status: GateStatus, reasons: list<string>}
     */
    public static function evaluate(GateStage $stage, array $metrics, array $thresholds): array
    {
        $reasons = match ($stage) {
            GateStage::DataQuality => self::dataQuality($metrics, $thresholds),
            GateStage::CohortDiagnostics => self::cohortDiagnostics($metrics, $thresholds),
            GateStage::StudyDiagnostics => self::studyDiagnostics($metrics, $thresholds),
            GateStage::EstimationCalibration => self::calibration($metrics, $thresholds),
            default => [],
        };

        return [
            'status' => $reasons === [] ? GateStatus::Passed : GateStatus::Failed,
            'reasons' => $reasons,
        ];
    }

    /**
     * @param  array<string, mixed>  $m
     * @param  array<string, mixed>  $t
     * @return list<string>
     */
    private static function dataQuality(array $m, array $t): array
    {
        $severe = self::num($m['severe_failed_checks'] ?? 0);
        $max = self::num($t['max_severe_failed_checks'] ?? 0);

        if ($severe > $max) {
            return [sprintf('%d severe DQD failure(s) exceed the maximum of %d.', (int) $severe, (int) $max)];
        }

        return [];
    }

    /**
     * @param  array<string, mixed>  $m
     * @param  array<string, mixed>  $t
     * @return list<string>
     */
    private static function cohortDiagnostics(array $m, array $t): array
    {
        $subjects = self::num($m['distinct_persons'] ?? $m['subjects'] ?? 0);
        $min = self::num($t['min_subjects'] ?? 1);

        if ($subjects < $min) {
            return [sprintf('Cohort has %d subject(s); the minimum is %d.', (int) $subjects, (int) $min)];
        }

        return [];
    }

    /**
     * @param  array<string, mixed>  $m
     * @param  array<string, mixed>  $t
     * @return list<string>
     */
    private static function studyDiagnostics(array $m, array $t): array
    {
        $reasons = [];

        $auc = self::nullableNum($m['ps_auc'] ?? $m['auc'] ?? null);
        $maxAuc = self::num($t['max_ps_auc'] ?? 0.80);
        if ($auc !== null && $auc > $maxAuc) {
            $reasons[] = sprintf('Propensity-score AUC %.3f exceeds %.2f — groups are too separable (near-complete separation).', $auc, $maxAuc);
        }

        $smd = self::nullableNum($m['max_smd_after'] ?? null);
        $maxSmd = self::num($t['max_smd_after'] ?? 0.10);
        if ($smd !== null && $smd > $maxSmd) {
            $reasons[] = sprintf('Max post-adjustment SMD %.3f exceeds %.2f — residual covariate imbalance.', $smd, $maxSmd);
        }

        $equipoise = self::nullableNum($m['equipoise'] ?? null);
        $minEquipoise = self::num($t['min_equipoise'] ?? 0.30);
        if ($equipoise !== null && $equipoise < $minEquipoise) {
            $reasons[] = sprintf('Equipoise %.3f is below %.2f — insufficient clinical equipoise.', $equipoise, $minEquipoise);
        }

        return $reasons;
    }

    /**
     * @param  array<string, mixed>  $m
     * @param  array<string, mixed>  $t
     * @return list<string>
     */
    private static function calibration(array $m, array $t): array
    {
        $status = is_string($m['status'] ?? null) ? $m['status'] : null;
        $informative = self::num($m['informative_negative_controls'] ?? 0);
        $min = self::num($t['min_informative_negative_controls'] ?? 5);

        if ($status === 'insufficient_controls' || $informative < $min) {
            return [sprintf(
                'Only %d informative negative control(s); empirical calibration needs at least %d.',
                (int) $informative,
                (int) $min,
            )];
        }

        return [];
    }

    private static function num(mixed $value): float
    {
        return is_numeric($value) ? (float) $value : 0.0;
    }

    private static function nullableNum(mixed $value): ?float
    {
        return is_numeric($value) ? (float) $value : null;
    }
}
