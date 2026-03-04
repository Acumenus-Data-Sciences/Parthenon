<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\App\Study;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\JsonResponse;

#[Group('Studies', weight: 149)]
class StudyStatsController extends Controller
{
    /**
     * GET /v1/studies/stats
     *
     * Aggregated study statistics.
     */
    public function __invoke(): JsonResponse
    {
        $studies = Study::select('status', 'study_type', 'phase')->get();

        $byStatus = $studies->groupBy('status')->map->count();
        $byType = $studies->groupBy('study_type')->map->count();
        $byPhase = $studies->groupBy('phase')->map->count();

        return response()->json([
            'data' => [
                'total' => $studies->count(),
                'active_count' => $studies->where('phase', 'active')->count(),
                'by_status' => $byStatus,
                'by_type' => $byType,
                'by_phase' => $byPhase,
            ],
        ]);
    }
}
