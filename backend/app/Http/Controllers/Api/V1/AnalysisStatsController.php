<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\App\Characterization;
use App\Models\App\EstimationAnalysis;
use App\Models\App\EvidenceSynthesisAnalysis;
use App\Models\App\IncidenceRateAnalysis;
use App\Models\App\PathwayAnalysis;
use App\Models\App\PredictionAnalysis;
use App\Models\App\SccsAnalysis;
use Illuminate\Http\JsonResponse;

/**
 * @group Analyses
 */
class AnalysisStatsController extends Controller
{
    public function __invoke(): JsonResponse
    {
        $stats = [
            'characterizations' => [
                'total' => Characterization::count(),
                'executed' => Characterization::whereHas('executions')->count(),
            ],
            'incidence_rates' => [
                'total' => IncidenceRateAnalysis::count(),
                'executed' => IncidenceRateAnalysis::whereHas('executions')->count(),
            ],
            'pathways' => [
                'total' => PathwayAnalysis::count(),
                'executed' => PathwayAnalysis::whereHas('executions')->count(),
            ],
            'estimations' => [
                'total' => EstimationAnalysis::count(),
                'executed' => EstimationAnalysis::whereHas('executions')->count(),
            ],
            'predictions' => [
                'total' => PredictionAnalysis::count(),
                'executed' => PredictionAnalysis::whereHas('executions')->count(),
            ],
            'sccs' => [
                'total' => SccsAnalysis::count(),
                'executed' => SccsAnalysis::whereHas('executions')->count(),
            ],
            'evidence_synthesis' => [
                'total' => EvidenceSynthesisAnalysis::count(),
                'executed' => EvidenceSynthesisAnalysis::whereHas('executions')->count(),
            ],
        ];

        $stats['grand_total'] = collect($stats)->sum('total');

        return response()->json(['data' => $stats]);
    }
}
