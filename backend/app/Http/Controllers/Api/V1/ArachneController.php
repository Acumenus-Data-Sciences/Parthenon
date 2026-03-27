<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\ArachneDistributeRequest;
use App\Models\App\Study;
use App\Models\App\StudyExecution;
use App\Services\ArachneService;
use Illuminate\Http\JsonResponse;
use RuntimeException;

/**
 * @group Studies
 */
class ArachneController extends Controller
{
    public function __construct(
        private readonly ArachneService $arachne,
    ) {}

    /**
     * List available Arachne Data Nodes.
     */
    public function nodes(): JsonResponse
    {
        try {
            $nodes = $this->arachne->listNodes();

            return response()->json(['data' => $nodes]);
        } catch (RuntimeException $e) {
            return response()->json(
                ['error' => $e->getMessage()],
                $this->errorStatus($e),
            );
        }
    }

    /**
     * Distribute a study's analysis spec to selected Arachne data nodes.
     */
    public function distribute(ArachneDistributeRequest $request): JsonResponse
    {
        try {
            $study = Study::where('slug', $request->validated('study_slug'))->firstOrFail();

            // Build spec: use provided spec or fall back to study's first analysis spec
            /** @var array<string, mixed>|null $spec */
            $spec = $request->validated('analysis_spec');

            if ($spec === null) {
                $firstAnalysis = $study->analyses()->first();
                $spec = $firstAnalysis?->analysis?->execution_settings ?? [];
            }

            // Create analysis entry in Arachne Central
            $arachneAnalysis = $this->arachne->createAnalysis(
                title: $study->title,
                description: $study->description ?? '',
                strategusSpec: $spec,
            );

            $arachneAnalysisId = (int) ($arachneAnalysis['id'] ?? 0);

            // Distribute to selected nodes
            /** @var array<int> $nodeIds */
            $nodeIds = $request->validated('node_ids');
            $distribution = $this->arachne->distribute($arachneAnalysisId, $nodeIds, $spec);

            // Create local StudyExecution records for tracking
            $submissions = $distribution['submissions'] ?? [];
            foreach ($submissions as $submission) {
                StudyExecution::create([
                    'study_id' => $study->id,
                    'execution_engine' => 'arachne',
                    'status' => 'submitted',
                    'execution_params' => [
                        'arachne_analysis_id' => $arachneAnalysisId,
                        'node_id' => $submission['node_id'] ?? null,
                        'submission_id' => $submission['id'] ?? null,
                    ],
                ]);
            }

            return response()->json([
                'data' => [
                    'arachne_analysis_id' => $arachneAnalysisId,
                    'submissions' => $submissions,
                ],
            ]);
        } catch (RuntimeException $e) {
            return response()->json(
                ['error' => $e->getMessage()],
                $this->errorStatus($e),
            );
        }
    }

    /**
     * Get federated execution status for a study's Arachne executions.
     */
    public function status(string $studySlug): JsonResponse
    {
        try {
            $study = Study::where('slug', $studySlug)->firstOrFail();

            $executions = StudyExecution::where('study_id', $study->id)
                ->where('execution_engine', 'arachne')
                ->get();

            $results = [];
            $checkedAnalyses = [];

            foreach ($executions as $execution) {
                /** @var array<string, mixed> $params */
                $params = $execution->execution_params ?? [];
                $arachneAnalysisId = (int) ($params['arachne_analysis_id'] ?? 0);

                // Fetch remote status once per Arachne analysis
                $remoteSubmissions = [];
                if ($arachneAnalysisId > 0 && ! isset($checkedAnalyses[$arachneAnalysisId])) {
                    $remoteSubmissions = $this->arachne->getStatus($arachneAnalysisId);
                    $checkedAnalyses[$arachneAnalysisId] = $remoteSubmissions;
                } else {
                    $remoteSubmissions = $checkedAnalyses[$arachneAnalysisId] ?? [];
                }

                $results[] = [
                    'id' => $execution->id,
                    'execution_engine' => $execution->execution_engine,
                    'status' => $execution->status,
                    'arachne_analysis_id' => $arachneAnalysisId,
                    'submissions' => $remoteSubmissions,
                ];
            }

            return response()->json(['data' => ['executions' => $results]]);
        } catch (RuntimeException $e) {
            return response()->json(
                ['error' => $e->getMessage()],
                $this->errorStatus($e),
            );
        }
    }

    /**
     * Retrieve results for a specific Arachne execution.
     */
    public function results(string $studySlug, int $executionId): JsonResponse
    {
        try {
            $study = Study::where('slug', $studySlug)->firstOrFail();

            $execution = StudyExecution::where('id', $executionId)
                ->where('study_id', $study->id)
                ->where('execution_engine', 'arachne')
                ->firstOrFail();

            /** @var array<string, mixed> $params */
            $params = $execution->execution_params ?? [];
            $arachneAnalysisId = (int) ($params['arachne_analysis_id'] ?? 0);
            $submissionId = (int) ($params['submission_id'] ?? 0);

            if ($arachneAnalysisId === 0 || $submissionId === 0) {
                return response()->json(
                    ['error' => 'Missing Arachne tracking IDs on this execution record.'],
                    422,
                );
            }

            $resultData = $this->arachne->getResults($arachneAnalysisId, $submissionId);

            return response()->json(['data' => $resultData]);
        } catch (RuntimeException $e) {
            return response()->json(
                ['error' => $e->getMessage()],
                $this->errorStatus($e),
            );
        }
    }

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------

    private function errorStatus(RuntimeException $e): int
    {
        $code = $e->getCode();

        return ($code >= 400 && $code < 600) ? $code : 502;
    }
}
