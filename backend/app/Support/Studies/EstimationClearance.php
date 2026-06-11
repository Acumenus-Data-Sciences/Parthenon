<?php

namespace App\Support\Studies;

use App\Models\App\Study;
use App\Models\App\StudyGate;

/**
 * Single source of truth for whether an estimation contrast is "estimable" —
 * i.e. its calibrated effect estimates may be reported rather than withheld
 * (blinded). Shared by the StudyResultProjector (to set is_publishable) and the
 * ManuscriptComposer (to decide what to print), so the Results tab, the gate
 * ledger, and the manuscript can never disagree about a contrast's status.
 */
final class EstimationClearance
{
    /**
     * A contrast is cleared when its own propensity diagnostics meet the
     * pre-specified thresholds, OR a human has overridden/approved the
     * study-diagnostics gate. An explicit gate failure blinds every contrast.
     *
     * @param  array<string, mixed>  $result  a normalized estimation result_json
     */
    public static function isCleared(array $result, Study $study): bool
    {
        foreach ($study->gates as $gate) {
            if ($gate instanceof StudyGate && $gate->stage->value === 'study_diagnostics') {
                if (in_array($gate->status->value, ['overridden', 'approved'], true)) {
                    return true;
                }
                if ($gate->status->value === 'failed') {
                    return false;
                }
                break;
            }
        }

        $ps = is_array($result['propensity_score'] ?? null) ? $result['propensity_score'] : [];
        $auc = $ps['auc'] ?? null;
        $smd = $ps['max_smd_after'] ?? null;
        $eq = $ps['equipoise'] ?? null;
        if (! is_numeric($auc) || ! is_numeric($smd) || ! is_numeric($eq)) {
            return false;
        }

        $t = config('studies.gate_thresholds.study_diagnostics', []);
        $t = is_array($t) ? $t : [];

        return (float) $auc < (float) ($t['max_ps_auc'] ?? 0.80)
            && (float) $smd < (float) ($t['max_smd_after'] ?? 0.10)
            && (float) $eq >= (float) ($t['min_equipoise'] ?? 0.30);
    }

    /**
     * Whether a normalized estimation result carries a completed empirical
     * calibration block (calibrated estimates are present and trustworthy).
     *
     * @param  array<string, mixed>  $result
     */
    public static function isCalibrated(array $result): bool
    {
        $calibration = is_array($result['calibration'] ?? null) ? $result['calibration'] : null;

        return $calibration !== null && ($calibration['status'] ?? null) === 'completed';
    }
}
