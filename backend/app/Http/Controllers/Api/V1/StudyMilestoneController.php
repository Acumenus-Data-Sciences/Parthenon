<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\App\Study;
use App\Models\App\StudyMilestone;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

#[Group('Studies', weight: 150)]
class StudyMilestoneController extends Controller
{
    /**
     * GET /v1/studies/{study}/milestones
     *
     * List milestones for a study.
     */
    public function index(Request $request, Study $study): JsonResponse
    {
        try {
            $milestones = $study->milestones()
                ->with('assignedTo:id,name,email')
                ->orderBy('sort_order')
                ->get();

            return response()->json([
                'data' => $milestones,
            ]);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to retrieve study milestones', $e);
        }
    }

    /**
     * POST /v1/studies/{study}/milestones
     *
     * Add a milestone to a study.
     */
    public function store(Request $request, Study $study): JsonResponse
    {
        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'description' => 'nullable|string',
            'milestone_type' => 'nullable|string|max:50',
            'target_date' => 'nullable|date',
            'actual_date' => 'nullable|date',
            'status' => 'nullable|string|max:50',
            'assigned_to' => 'nullable|integer|exists:users,id',
            'sort_order' => 'nullable|integer|min:0',
        ]);

        try {
            $milestone = StudyMilestone::create([
                ...$validated,
                'study_id' => $study->id,
            ]);

            $milestone->load('assignedTo:id,name,email');

            return response()->json([
                'data' => $milestone,
                'message' => 'Study milestone added.',
            ], 201);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to add study milestone', $e);
        }
    }

    /**
     * PUT /v1/studies/{study}/milestones/{studyMilestone}
     *
     * Update a study milestone.
     */
    public function update(Request $request, Study $study, StudyMilestone $studyMilestone): JsonResponse
    {
        if ((int) $studyMilestone->study_id !== (int) $study->id) {
            return response()->json(['message' => 'Milestone does not belong to this study.'], 404);
        }

        $validated = $request->validate([
            'title' => 'sometimes|required|string|max:255',
            'description' => 'nullable|string',
            'milestone_type' => 'nullable|string|max:50',
            'target_date' => 'nullable|date',
            'actual_date' => 'nullable|date',
            'status' => 'nullable|string|max:50',
            'assigned_to' => 'nullable|integer|exists:users,id',
            'sort_order' => 'nullable|integer|min:0',
        ]);

        try {
            $studyMilestone->update($validated);

            return response()->json([
                'data' => $studyMilestone->fresh('assignedTo:id,name,email'),
                'message' => 'Study milestone updated.',
            ]);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to update study milestone', $e);
        }
    }

    /**
     * DELETE /v1/studies/{study}/milestones/{studyMilestone}
     *
     * Remove a milestone from a study.
     */
    public function destroy(Study $study, StudyMilestone $studyMilestone): JsonResponse
    {
        if ((int) $studyMilestone->study_id !== (int) $study->id) {
            return response()->json(['message' => 'Milestone does not belong to this study.'], 404);
        }

        try {
            $studyMilestone->delete();

            return response()->json([
                'message' => 'Study milestone removed.',
            ]);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to remove study milestone', $e);
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
