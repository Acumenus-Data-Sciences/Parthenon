<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Abby gated pipeline (ADR-0020)
    |--------------------------------------------------------------------------
    |
    | Master switch for the scientific gate layer. When false, no gate is
    | evaluated or enforced and estimation results are NEVER blinded — existing
    | study behaviour is completely unchanged. Enable per-environment once the
    | gate UX has been reviewed on a real study.
    |
    */

    'gating_enabled' => (bool) env('STUDIES_GATING_ENABLED', false),

    /*
    |--------------------------------------------------------------------------
    | Default gate thresholds
    |--------------------------------------------------------------------------
    |
    | Block-by-default thresholds for the auto-evaluated gates. A study may
    | override any failed gate with a written rationale (see StudyGateService).
    |
    */

    'gate_thresholds' => [

        // S4 — Data Quality: no severe DQD failures before any estimation.
        'data_quality' => [
            'max_severe_failed_checks' => (int) env('STUDIES_GATE_MAX_SEVERE_DQD', 0),
        ],

        // S3 — Cohort Diagnostics: cohorts must be non-empty and plausible.
        'cohort_diagnostics' => [
            'min_subjects' => (int) env('STUDIES_GATE_MIN_SUBJECTS', 1),
        ],

        // S5 — Study Diagnostics: equipoise + balance gate before unblinding.
        'study_diagnostics' => [
            'max_ps_auc' => (float) env('STUDIES_GATE_MAX_PS_AUC', 0.80),
            'max_smd_after' => (float) env('STUDIES_GATE_MAX_SMD_AFTER', 0.10),
            'min_equipoise' => (float) env('STUDIES_GATE_MIN_EQUIPOISE', 0.30),
        ],

        // S6 — Empirical Calibration: enough informative negative controls.
        'estimation_calibration' => [
            'min_informative_negative_controls' => (int) env('STUDIES_GATE_MIN_CONTROLS', 5),
        ],
    ],
];
