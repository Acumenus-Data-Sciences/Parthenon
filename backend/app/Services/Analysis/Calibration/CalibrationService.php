<?php

namespace App\Services\Analysis\Calibration;

use App\Services\RService;

/**
 * Empirical calibration via the darkstar R sidecar (Clio / ADR-0020 Phase 2).
 *
 * Turns a study's negative-control estimates into a systematic-error model and
 * returns calibrated confidence intervals, calibrated p-values, and the EASE
 * metric. Runs as cheap post-processing on estimation output — it does not
 * re-run CohortMethod.
 */
class CalibrationService
{
    /** Minimum informative negative controls for a defensible calibration. */
    public const MIN_CONTROLS = 5;

    public function __construct(
        private readonly RService $r,
    ) {}

    /**
     * Calibrate outcome estimates against negative controls.
     *
     * @param  array<int, array<string, mixed>>  $estimates  outcome estimates carrying log_hr/se_log_hr
     * @param  array<int, array<string, mixed>>  $negativeControls  controls carrying log_rr/se_log_rr
     * @return array<string, mixed>
     */
    public function calibrate(array $estimates, array $negativeControls, int $minControls = self::MIN_CONTROLS): array
    {
        return $this->r->runCalibration([
            'estimates' => array_values($estimates),
            'negative_controls' => array_values($negativeControls),
            'min_controls' => $minControls,
        ]);
    }
}
