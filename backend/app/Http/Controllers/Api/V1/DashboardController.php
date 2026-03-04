<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\App\CohortDefinition;
use App\Models\App\ConceptSet;
use App\Models\App\DqdResult;
use App\Models\App\Source;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

#[Group('Dashboard', weight: 5)]
class DashboardController extends Controller
{
    /**
     * Unified dashboard statistics — single endpoint replaces 3+N frontend calls.
     */
    public function stats(Request $request): JsonResponse
    {
        /** @var \App\Models\User $user */
        $user = $request->user();

        // All queries run against the app DB — fast
        $sources = Source::visibleToUser($user)->get();
        $cohortCount = CohortDefinition::count();
        $conceptSetCount = ConceptSet::count();

        $recentCohorts = CohortDefinition::orderByDesc('updated_at')
            ->limit(5)
            ->get(['id', 'name', 'tags', 'updated_at'])
            ->map(fn ($c) => [
                'id' => $c->id,
                'name' => $c->name,
                'tags' => $c->tags,
                'updated_at' => $c->updated_at,
            ]);

        // Aggregate DQD failures: get latest run per source, count failures
        $dqdFailures = 0;
        foreach ($sources as $source) {
            $latestRunId = DqdResult::where('source_id', $source->id)
                ->orderByDesc('created_at')
                ->value('run_id');

            if ($latestRunId) {
                $dqdFailures += (int) DqdResult::where('run_id', $latestRunId)
                    ->where('passed', false)
                    ->count();
            }
        }

        return response()->json([
            'data' => [
                'sources' => $sources,
                'cohort_count' => $cohortCount,
                'concept_set_count' => $conceptSetCount,
                'dqd_failures' => $dqdFailures,
                'active_job_count' => 0, // TODO: wire when job tracking is built
                'recent_cohorts' => $recentCohorts,
                'recent_jobs' => [],
            ],
        ]);
    }
}
