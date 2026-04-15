<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\StudyAgent\CohortLintRequest;
use App\Http\Requests\StudyAgent\ConceptSetReviewRequest;
use App\Http\Requests\StudyAgent\IntentSplitRequest;
use App\Http\Requests\StudyAgent\LintCohortRequest;
use App\Http\Requests\StudyAgent\PhenotypeImproveRequest;
use App\Http\Requests\StudyAgent\PhenotypeRecommendRequest;
use App\Http\Requests\StudyAgent\PhenotypeSearchRequest;
use App\Http\Requests\StudyAgent\RecommendPhenotypesRequest;
use App\Services\StudyAgent\CommunityWorkbenchSdkDemoService;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * @group Study Agent
 */
class StudyAgentController extends Controller
{
    private string $aiServiceUrl;

    public function __construct()
    {
        $this->aiServiceUrl = rtrim(config('services.ai.url', 'http://python-ai:8000'), '/');
    }

    /**
     * Check StudyAgent health.
     */
    public function health(): JsonResponse
    {
        $response = Http::timeout(10)->get("{$this->aiServiceUrl}/study-agent/health");

        if ($response->failed()) {
            return response()->json(['status' => 'unavailable'], 503);
        }

        return response()->json(['data' => $response->json()]);
    }

    /**
     * List available StudyAgent tools.
     */
    public function tools(): JsonResponse
    {
        $response = Http::timeout(10)->get("{$this->aiServiceUrl}/study-agent/tools");

        if ($response->failed()) {
            return response()->json(['error' => 'StudyAgent unavailable'], 503);
        }

        return response()->json(['data' => $response->json()]);
    }

    public function services(CommunityWorkbenchSdkDemoService $demoService): JsonResponse
    {
        $services = [];
        $warnings = [];

        try {
            $response = Http::timeout(10)->get("{$this->aiServiceUrl}/study-agent/services");
            if ($response->successful()) {
                $payload = $response->json();
                $services = is_array($payload['services'] ?? null) ? $payload['services'] : [];
                $warnings = is_array($payload['warnings'] ?? null) ? $payload['warnings'] : [];
            } else {
                $warnings[] = 'StudyAgent service registry proxy was unavailable; using Laravel fallback service registry.';
            }
        } catch (\Throwable $e) {
            $warnings[] = 'StudyAgent service registry proxy was unavailable; using Laravel fallback service registry.';
        }

        if ($services === []) {
            $services = $this->fallbackFinnGenServices();
        }

        $services = $this->appendServiceEntry($services, $demoService->serviceEntry());

        return response()->json([
            'data' => [
                'services' => array_values($services),
                'warnings' => $warnings,
            ],
        ]);
    }

    public function communityWorkbenchSdkDemo(CommunityWorkbenchSdkDemoService $demoService): JsonResponse
    {
        return response()->json(['data' => $demoService->payload()]);
    }

    /**
     * Search the OHDSI PhenotypeLibrary.
     *
     * Uses hybrid dense+sparse retrieval to find relevant phenotypes.
     */
    public function phenotypeSearch(PhenotypeSearchRequest $request): JsonResponse
    {
        $validated = $request->validated();

        $response = Http::timeout(30)->post("{$this->aiServiceUrl}/study-agent/phenotype/search", $validated);

        if ($response->failed()) {
            Log::error('Phenotype search failed', ['status' => $response->status()]);

            return response()->json(['error' => 'Phenotype search failed'], $response->status());
        }

        return response()->json(['data' => $response->json()]);
    }

    /**
     * Get AI-ranked phenotype recommendations.
     *
     * Ranks phenotype search results by relevance to a study intent.
     */
    public function phenotypeRecommend(PhenotypeRecommendRequest $request): JsonResponse
    {
        $validated = $request->validated();

        $response = Http::timeout(120)->post("{$this->aiServiceUrl}/study-agent/phenotype/recommend", $validated);

        if ($response->failed()) {
            Log::error('Phenotype recommend failed', ['status' => $response->status()]);

            return response()->json(['error' => 'Phenotype recommendation failed'], $response->status());
        }

        return response()->json(['data' => $response->json()]);
    }

    /**
     * Get AI-suggested improvements for a cohort definition.
     */
    public function phenotypeImprove(PhenotypeImproveRequest $request): JsonResponse
    {
        $validated = $request->validated();

        $response = Http::timeout(120)->post("{$this->aiServiceUrl}/study-agent/phenotype/improve", $validated);

        if ($response->failed()) {
            Log::error('Phenotype improve failed', ['status' => $response->status()]);

            return response()->json(['error' => 'Phenotype improvement failed'], $response->status());
        }

        return response()->json(['data' => $response->json()]);
    }

    /**
     * Split study intent into target and outcome.
     *
     * Parses a free-text study intent into structured target population
     * and outcome statements.
     */
    public function intentSplit(IntentSplitRequest $request): JsonResponse
    {
        $validated = $request->validated();

        $response = Http::timeout(60)->post("{$this->aiServiceUrl}/study-agent/intent/split", $validated);

        if ($response->failed()) {
            Log::error('Intent split failed', ['status' => $response->status()]);

            return response()->json(['error' => 'Intent splitting failed'], $response->status());
        }

        return response()->json(['data' => $response->json()]);
    }

    /**
     * Lint a cohort definition for design issues.
     *
     * Checks for empty concept sets, missing washout periods,
     * inverted time windows, and other design problems.
     */
    public function cohortLint(CohortLintRequest $request): JsonResponse
    {
        $validated = $request->validated();

        $response = Http::timeout(60)->post("{$this->aiServiceUrl}/study-agent/cohort/lint", $validated);

        if ($response->failed()) {
            Log::error('Cohort lint failed', ['status' => $response->status()]);

            return response()->json(['error' => 'Cohort linting failed'], $response->status());
        }

        return response()->json(['data' => $response->json()]);
    }

    /**
     * Review a concept set and propose improvements.
     */
    public function conceptSetReview(ConceptSetReviewRequest $request): JsonResponse
    {
        $validated = $request->validated();

        $response = Http::timeout(60)->post("{$this->aiServiceUrl}/study-agent/concept-set/review", $validated);

        if ($response->failed()) {
            Log::error('Concept set review failed', ['status' => $response->status()]);

            return response()->json(['error' => 'Concept set review failed'], $response->status());
        }

        return response()->json(['data' => $response->json()]);
    }

    /**
     * Combined lint: cohort critique + concept set review.
     */
    public function lintCohortCombined(LintCohortRequest $request): JsonResponse
    {
        $validated = $request->validated();

        $response = Http::timeout(120)->post(
            "{$this->aiServiceUrl}/study-agent/lint-cohort",
            $validated
        );

        if ($response->failed()) {
            Log::error('Combined lint failed', ['status' => $response->status()]);

            return response()->json(['error' => 'Combined lint failed'], $response->status());
        }

        return response()->json(['data' => $response->json()]);
    }

    /**
     * Convenience: phenotype recommendations from study description.
     */
    public function recommendPhenotypes(RecommendPhenotypesRequest $request): JsonResponse
    {
        $validated = $request->validated();

        $response = Http::timeout(120)->post(
            "{$this->aiServiceUrl}/study-agent/recommend-phenotypes",
            $validated
        );

        if ($response->failed()) {
            Log::error('Recommend phenotypes failed', ['status' => $response->status()]);

            return response()->json(['error' => 'Phenotype recommendation failed'], $response->status());
        }

        return response()->json(['data' => $response->json()]);
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function fallbackFinnGenServices(): array
    {
        return [
            [
                'name' => 'finngen_romopapi',
                'endpoint' => '/study-agent/finngen/romopapi',
                'description' => 'OMOP hierarchy and code count exploration.',
                'implemented' => true,
                'ui_hints' => ['title' => 'ROMOPAPI', 'summary' => 'OMOP query exploration.', 'repository' => 'https://github.com/FinnGen/ROMOPAPI'],
            ],
            [
                'name' => 'finngen_hades_extras',
                'endpoint' => '/study-agent/finngen/hades-extras',
                'description' => 'Shared OHDSI/HADES utility workflows.',
                'implemented' => true,
                'ui_hints' => ['title' => 'HADES Extras', 'summary' => 'SQL rendering and package workflows.', 'repository' => 'https://github.com/FinnGen/HadesExtras'],
            ],
            [
                'name' => 'finngen_cohort_operations',
                'endpoint' => '/study-agent/finngen/cohort-operations',
                'description' => 'Cohort import, operations, matching, and export.',
                'implemented' => true,
                'ui_hints' => ['title' => 'Cohort Operations', 'summary' => 'Cohort workbench and matching.', 'repository' => 'https://github.com/FinnGen/CohortOperations2'],
            ],
            [
                'name' => 'finngen_co2_analysis',
                'endpoint' => '/study-agent/finngen/co2-analysis',
                'description' => 'CO2 modular analysis workbench.',
                'implemented' => true,
                'ui_hints' => ['title' => 'CO2 Analysis Modules', 'summary' => 'CodeWAS, burden, demographics, utilization, and subgroup analysis.', 'repository' => 'https://github.com/FinnGen/CO2AnalysisModules'],
            ],
        ];
    }

    /**
     * @param  list<array<string,mixed>>  $services
     * @param  array<string,mixed>  $entry
     * @return list<array<string,mixed>>
     */
    private function appendServiceEntry(array $services, array $entry): array
    {
        foreach ($services as $service) {
            if (($service['name'] ?? null) === ($entry['name'] ?? null)) {
                return $services;
            }
        }

        $services[] = $entry;

        return $services;
    }
}
