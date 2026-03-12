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
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

#[Group('Study Agent', weight: 216)]
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
}
