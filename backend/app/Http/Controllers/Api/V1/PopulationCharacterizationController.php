<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\App\Source;
use App\Services\PopulationCharacterization\PopulationCharacterizationEngineService;
use App\Services\PopulationCharacterization\PopulationCharacterizationRegistry;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\JsonResponse;
use Throwable;

#[Group('Population Analytics', weight: 170)]
class PopulationCharacterizationController extends Controller
{
    public function __construct(
        private readonly PopulationCharacterizationEngineService $engine,
        private readonly PopulationCharacterizationRegistry $registry,
    ) {}

    /**
     * GET /api/v1/sources/{source}/population-insights
     * Summary of all analyses with last-run metadata.
     */
    public function index(Source $source): JsonResponse
    {
        return response()->json([
            'data' => $this->engine->getSummary($source),
        ]);
    }

    /**
     * GET /api/v1/sources/{source}/population-insights/{analysisId}
     * Detailed results for one analysis, grouped for charting.
     */
    public function show(Source $source, string $analysisId): JsonResponse
    {
        try {
            $results = $this->engine->getResults($source, $analysisId);
        } catch (Throwable) {
            return response()->json(['message' => "Analysis '{$analysisId}' not found."], 404);
        }

        return response()->json($results);
    }

    /**
     * POST /api/v1/sources/{source}/population-insights/run
     * Execute all 6 population characterization analyses against the source CDM.
     */
    public function run(Source $source): JsonResponse
    {
        $source->load('daimons');

        $result = $this->engine->run($source);

        return response()->json([
            'message' => 'Population characterization complete.',
            'summary' => $result,
        ]);
    }

    /**
     * GET /api/v1/sources/{source}/population-insights/catalogue
     * Static metadata for all registered analyses (no CDM access).
     */
    public function catalogue(): JsonResponse
    {
        $catalogue = array_map(fn ($a) => [
            'analysis_id' => $a->analysisId(),
            'analysis_name' => $a->analysisName(),
            'category' => $a->category(),
            'description' => $a->description(),
            'requires_optional' => $a->requiresOptionalTables(),
            'required_tables' => $a->requiredTables(),
        ], $this->registry->all());

        return response()->json([
            'data' => $catalogue,
            'total' => count($catalogue),
        ]);
    }
}
