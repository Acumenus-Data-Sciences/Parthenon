<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\App\Source;
use App\Models\Results\PopulationRiskScoreResult;
use App\Services\PopulationRisk\PopulationRiskScoreEngineService;
use App\Services\PopulationRisk\PopulationRiskScoreRegistry;
use Illuminate\Http\JsonResponse;

/**
 * @group Population Analytics
 */
class PopulationRiskScoreController extends Controller
{
    public function __construct(
        private readonly PopulationRiskScoreEngineService $engine,
        private readonly PopulationRiskScoreRegistry $registry,
    ) {}

    /**
     * GET /api/v1/sources/{source}/risk-scores
     *
     * Population-level summary of all risk scores, grouped by clinical category.
     */
    public function index(Source $source): JsonResponse
    {
        $summary = $this->engine->getSummary($source);
        $grouped = $this->engine->getResults($source);
        $lastRun = PopulationRiskScoreResult::where('source_id', $source->id)->max('run_at');

        return response()->json([
            'source_id' => $source->id,
            'last_run' => $lastRun,
            'scores_computed' => count($summary),
            'summary' => $summary,
            'by_category' => $grouped,
        ]);
    }

    /**
     * POST /api/v1/sources/{source}/risk-scores/run
     *
     * Execute all 20 risk score analyses and persist population summaries.
     */
    public function run(Source $source): JsonResponse
    {
        $outcome = $this->engine->run($source);

        return response()->json([
            'source_id' => $source->id,
            'completed' => $outcome['completed'],
            'failed' => $outcome['failed'],
            'scores' => $outcome['results'],
        ]);
    }

    /**
     * GET /api/v1/sources/{source}/risk-scores/{scoreId}
     *
     * Detailed tier breakdown for a single risk score with confidence and missing data.
     */
    public function show(Source $source, string $scoreId): JsonResponse
    {
        $scoreId = strtoupper($scoreId);
        $score = $this->registry->get($scoreId);

        $rows = PopulationRiskScoreResult::where('source_id', $source->id)
            ->where('score_id', $scoreId)
            ->orderByRaw("CASE risk_tier WHEN 'very_high' THEN 0 WHEN 'high' THEN 1 WHEN 'intermediate' THEN 2 WHEN 'low' THEN 3 ELSE 4 END")
            ->get();

        if ($rows->isEmpty()) {
            return response()->json([
                'message' => "No results for {$scoreId}. Run the risk scoring analysis first.",
            ], 404);
        }

        $totalEligible = $rows->first()->total_eligible;
        $totalComputable = $rows->where('risk_tier', '!=', 'uncomputable')->sum('patient_count');

        return response()->json([
            'score_id' => $scoreId,
            'score_name' => $score?->scoreName() ?? $rows->first()->score_name,
            'category' => $rows->first()->category,
            'description' => $score?->description(),
            'eligible_population' => $score?->eligiblePopulation(),
            'required_components' => $score?->requiredComponents() ?? [],
            'risk_tiers_defined' => $score?->riskTiers() ?? [],
            'total_eligible' => $totalEligible,
            'total_computable' => $totalComputable,
            'completeness_rate' => $totalEligible > 0
                ? round($totalComputable / $totalEligible, 4)
                : null,
            'mean_confidence' => round($rows->avg('mean_confidence') ?? 0, 4),
            'mean_completeness' => round($rows->avg('mean_completeness') ?? 0, 4),
            'last_run' => $rows->max('run_at'),
            'tiers' => $rows->map(fn ($r) => [
                'risk_tier' => $r->risk_tier,
                'patient_count' => $r->patient_count,
                'tier_fraction' => $totalEligible > 0
                    ? round($r->patient_count / $totalEligible, 4) : null,
                'mean_score' => $r->mean_score,
                'p25_score' => $r->p25_score,
                'median_score' => $r->median_score,
                'p75_score' => $r->p75_score,
                'mean_confidence' => $r->mean_confidence,
                'mean_completeness' => $r->mean_completeness,
                'missing_components' => json_decode($r->missing_components ?? '{}', true),
            ])->values(),
        ]);
    }

    /**
     * GET /api/v1/sources/{source}/risk-scores/catalogue
     *
     * Metadata for all registered scores (no CDM required — static).
     */
    public function catalogue(): JsonResponse
    {
        $scores = array_map(fn ($s) => [
            'score_id' => $s->scoreId(),
            'score_name' => $s->scoreName(),
            'category' => $s->category(),
            'description' => $s->description(),
            'eligible_population' => $s->eligiblePopulation(),
            'required_components' => $s->requiredComponents(),
            'risk_tiers' => $s->riskTiers(),
            'required_tables' => $s->requiredTables(),
        ], $this->registry->all());

        return response()->json(['scores' => $scores]);
    }
}
