<?php

namespace App\Enums;

/**
 * The seven scientific gates of the Clio protocol-to-publication pipeline
 * (ADR-0020). Each stage ends in a human-in-the-loop decision recorded in
 * `study_gates`.
 */
enum GateStage: string
{
    case Design = 'design';
    case Phenotype = 'phenotype';
    case CohortDiagnostics = 'cohort_diagnostics';
    case DataQuality = 'data_quality';
    case StudyDiagnostics = 'study_diagnostics';
    case EstimationCalibration = 'estimation_calibration';
    case Publication = 'publication';
}
