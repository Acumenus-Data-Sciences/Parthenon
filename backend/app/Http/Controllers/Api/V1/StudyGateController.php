<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\App\EstimationAnalysis;
use App\Models\App\Study;
use App\Models\App\StudyAnalysis;
use App\Models\App\StudyGate;
use App\Models\User;
use App\Services\Studies\Gates\StudyGateService;
use App\Support\EstimationResultNormalizer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Study gate ledger API (ADR-0020 Phase 3). Read the gate timeline, evaluate
 * the estimation-derived gates, and record human approvals / justified
 * overrides. Gate decisions are restricted to the study's PI or lead
 * statistician (or an admin).
 *
 * @group Studies
 */
class StudyGateController extends Controller
{
    public function __construct(
        private readonly StudyGateService $gates,
    ) {}

    /**
     * GET /v1/studies/{study}/gates
     */
    public function index(Study $study): JsonResponse
    {
        try {
            $rows = $study->gates()->orderBy('stage')->get();

            return response()->json([
                'data' => $rows,
                'gating_enabled' => $this->gates->gatingEnabled(),
            ]);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to retrieve study gates', $e);
        }
    }

    /**
     * POST /v1/studies/{study}/gates/evaluate
     *
     * Evaluate the S5 (study diagnostics) and S6 (calibration) gates from each
     * linked estimation analysis's latest completed execution.
     */
    public function evaluate(Study $study): JsonResponse
    {
        try {
            $study->load('analyses');
            $evaluated = [];

            foreach ($study->analyses as $studyAnalysis) {
                if (! $studyAnalysis instanceof StudyAnalysis
                    || $studyAnalysis->analysis_type !== EstimationAnalysis::class) {
                    continue;
                }

                /** @var EstimationAnalysis|null $analysis */
                $analysis = $studyAnalysis->analysis;
                $execution = $analysis?->executions()
                    ->where('status', 'completed')
                    ->orderByDesc('created_at')
                    ->first();

                if ($execution === null || ! is_array($execution->result_json)) {
                    continue;
                }

                $normalized = EstimationResultNormalizer::normalize($execution->result_json);
                foreach ($this->gates->evaluateEstimationGates($study, $normalized) as $gate) {
                    $evaluated[] = $gate;
                }
            }

            return response()->json([
                'data' => $evaluated,
                'message' => $evaluated !== []
                    ? 'Gates evaluated from estimation diagnostics.'
                    : 'No completed estimation executions to evaluate.',
            ]);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to evaluate study gates', $e);
        }
    }

    /**
     * POST /v1/studies/{study}/gates/{studyGate}/approve
     */
    public function approve(Request $request, Study $study, StudyGate $studyGate): JsonResponse
    {
        if ((int) $studyGate->study_id !== (int) $study->id) {
            return response()->json(['message' => 'Gate does not belong to this study.'], 404);
        }

        /** @var User $user */
        $user = $request->user();
        if (! $this->canDecide($user, $study)) {
            return $this->forbidden();
        }

        try {
            return response()->json([
                'data' => $this->gates->approve($studyGate, $user),
                'message' => 'Gate approved.',
            ]);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to approve gate', $e);
        }
    }

    /**
     * POST /v1/studies/{study}/gates/{studyGate}/override
     */
    public function override(Request $request, Study $study, StudyGate $studyGate): JsonResponse
    {
        if ((int) $studyGate->study_id !== (int) $study->id) {
            return response()->json(['message' => 'Gate does not belong to this study.'], 404);
        }

        $validated = $request->validate([
            'rationale' => 'required|string|min:10|max:2000',
        ]);

        /** @var User $user */
        $user = $request->user();
        if (! $this->canDecide($user, $study)) {
            return $this->forbidden();
        }

        try {
            return response()->json([
                'data' => $this->gates->override($studyGate, $user, $validated['rationale']),
                'message' => 'Gate overridden with rationale.',
            ]);
        } catch (\InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to override gate', $e);
        }
    }

    private function canDecide(User $user, Study $study): bool
    {
        return (int) $study->principal_investigator_id === (int) $user->id
            || (int) $study->lead_statistician_id === (int) $user->id
            || $user->hasRole(['admin', 'super-admin']);
    }

    private function forbidden(): JsonResponse
    {
        return response()->json([
            'message' => 'Only the principal investigator or lead statistician may decide study gates.',
        ], 403);
    }

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
