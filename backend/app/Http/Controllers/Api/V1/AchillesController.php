<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\App\Source;
use App\Services\Achilles\AchillesResultReaderService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AchillesController extends Controller
{
    public function __construct(
        private readonly AchillesResultReaderService $reader,
    ) {}

    /**
     * GET /v1/sources/{source}/achilles/record-counts
     *
     * Returns record counts for all CDM tables.
     */
    public function recordCounts(Source $source): JsonResponse
    {
        try {
            $data = $this->reader->getRecordCounts($source);

            return response()->json(['data' => $data]);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to retrieve record counts', $e);
        }
    }

    /**
     * GET /v1/sources/{source}/achilles/demographics
     *
     * Returns demographic distributions (gender, race, ethnicity, age, year of birth).
     */
    public function demographics(Source $source): JsonResponse
    {
        try {
            $data = $this->reader->getDemographics($source);

            return response()->json(['data' => $data]);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to retrieve demographics', $e);
        }
    }

    /**
     * GET /v1/sources/{source}/achilles/observation-periods
     *
     * Returns observation period statistics and distributions.
     */
    public function observationPeriods(Source $source): JsonResponse
    {
        try {
            $data = $this->reader->getObservationPeriods($source);

            return response()->json(['data' => $data]);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to retrieve observation periods', $e);
        }
    }

    /**
     * GET /v1/sources/{source}/achilles/domains/{domain}
     *
     * Returns domain summary with top concepts by prevalence.
     * Query param: limit (default 25)
     */
    public function domainSummary(Source $source, string $domain, Request $request): JsonResponse
    {
        if (! in_array($domain, AchillesResultReaderService::ALLOWED_DOMAINS, true)) {
            return response()->json([
                'error' => 'Invalid domain',
                'message' => 'Domain must be one of: '.implode(', ', AchillesResultReaderService::ALLOWED_DOMAINS),
            ], 422);
        }

        $limit = (int) $request->input('limit', 25);
        $limit = max(1, min($limit, 1000));

        try {
            $data = $this->reader->getDomainSummary($source, $domain, $limit);

            return response()->json(['data' => $data]);
        } catch (\Throwable $e) {
            return $this->errorResponse("Failed to retrieve domain summary for {$domain}", $e);
        }
    }

    /**
     * GET /v1/sources/{source}/achilles/domains/{domain}/concepts/{conceptId}
     *
     * Returns concept drilldown detail within a domain.
     */
    public function conceptDrilldown(Source $source, string $domain, int $conceptId): JsonResponse
    {
        if (! in_array($domain, AchillesResultReaderService::ALLOWED_DOMAINS, true)) {
            return response()->json([
                'error' => 'Invalid domain',
                'message' => 'Domain must be one of: '.implode(', ', AchillesResultReaderService::ALLOWED_DOMAINS),
            ], 422);
        }

        try {
            $data = $this->reader->getConceptDrilldown($source, $domain, $conceptId);

            return response()->json(['data' => $data]);
        } catch (\Throwable $e) {
            return $this->errorResponse("Failed to retrieve concept drilldown for concept {$conceptId}", $e);
        }
    }

    /**
     * GET /v1/sources/{source}/achilles/temporal-trends?domain={domain}
     *
     * Returns temporal trends (monthly counts) for a domain.
     */
    public function temporalTrends(Source $source, Request $request): JsonResponse
    {
        $domain = $request->input('domain');

        if (! $domain || ! in_array($domain, AchillesResultReaderService::ALLOWED_DOMAINS, true)) {
            return response()->json([
                'error' => 'Invalid or missing domain parameter',
                'message' => 'Domain query parameter is required and must be one of: '.implode(', ', AchillesResultReaderService::ALLOWED_DOMAINS),
            ], 422);
        }

        try {
            $data = $this->reader->getTemporalTrends($source, $domain);

            return response()->json(['data' => $data]);
        } catch (\Throwable $e) {
            return $this->errorResponse("Failed to retrieve temporal trends for {$domain}", $e);
        }
    }

    /**
     * GET /v1/sources/{source}/achilles/analyses
     *
     * Returns list of available analyses that have results.
     */
    public function analyses(Source $source): JsonResponse
    {
        try {
            $data = $this->reader->getAvailableAnalyses();

            return response()->json(['data' => $data]);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to retrieve available analyses', $e);
        }
    }

    /**
     * GET /v1/sources/{source}/achilles/performance
     *
     * Returns Achilles performance report (elapsed seconds per analysis).
     */
    public function performance(Source $source): JsonResponse
    {
        try {
            $data = $this->reader->getPerformanceReport();

            return response()->json(['data' => $data]);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to retrieve performance report', $e);
        }
    }

    /**
     * GET /v1/sources/{source}/achilles/distributions/{analysisId}
     *
     * Returns distribution data (box plot values) for a given analysis.
     * Query param: stratum1 (optional filter)
     */
    public function distribution(Source $source, int $analysisId, Request $request): JsonResponse
    {
        $stratum1 = $request->input('stratum1');

        try {
            $data = $this->reader->getDistribution($analysisId, $stratum1);

            return response()->json(['data' => $data]);
        } catch (\Throwable $e) {
            return $this->errorResponse("Failed to retrieve distribution for analysis {$analysisId}", $e);
        }
    }

    /**
     * Build a standardized error response for database/service failures.
     */
    private function errorResponse(string $message, \Throwable $exception): JsonResponse
    {
        $response = [
            'error' => $message,
            'message' => $exception->getMessage(),
        ];

        if (config('app.debug')) {
            $response['trace'] = $exception->getTraceAsString();
        }

        return response()->json($response, 500);
    }
}
