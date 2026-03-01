<?php

namespace App\Enums;

enum AnalysisType: string
{
    case Characterization = 'characterization';
    case IncidenceRate = 'incidence_rate';
    case Pathway = 'pathway';
    case Estimation = 'estimation';
    case Prediction = 'prediction';
    case Feature = 'feature';
}
