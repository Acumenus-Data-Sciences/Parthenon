<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\App\Study;
use App\Models\App\StudyTeamMember;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

#[Group('Studies', weight: 150)]
class StudyTeamController extends Controller
{
    /**
     * GET /v1/studies/{study}/team
     *
     * List team members for a study.
     */
    public function index(Request $request, Study $study): JsonResponse
    {
        try {
            $members = $study->teamMembers()
                ->with(['user:id,name,email', 'site:id,source_id,site_role'])
                ->get();

            return response()->json([
                'data' => $members,
            ]);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to retrieve study team members', $e);
        }
    }

    /**
     * POST /v1/studies/{study}/team
     *
     * Add a team member to a study.
     */
    public function store(Request $request, Study $study): JsonResponse
    {
        $validated = $request->validate([
            'user_id' => 'required|integer|exists:users,id',
            'role' => 'required|string|max:100',
            'site_id' => 'nullable|integer|exists:study_sites,id',
            'permissions' => 'nullable|array',
        ]);

        try {
            $member = StudyTeamMember::create([
                ...$validated,
                'study_id' => $study->id,
                'joined_at' => now(),
                'is_active' => true,
            ]);

            $member->load(['user:id,name,email', 'site:id,source_id,site_role']);

            return response()->json([
                'data' => $member,
                'message' => 'Team member added.',
            ], 201);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to add team member', $e);
        }
    }

    /**
     * PUT /v1/studies/{study}/team/{studyTeamMember}
     *
     * Update a study team member.
     */
    public function update(Request $request, Study $study, StudyTeamMember $studyTeamMember): JsonResponse
    {
        if ((int) $studyTeamMember->study_id !== (int) $study->id) {
            return response()->json(['message' => 'Team member does not belong to this study.'], 404);
        }

        $validated = $request->validate([
            'role' => 'sometimes|required|string|max:100',
            'site_id' => 'nullable|integer|exists:study_sites,id',
            'permissions' => 'nullable|array',
            'is_active' => 'sometimes|boolean',
        ]);

        try {
            $studyTeamMember->update($validated);

            return response()->json([
                'data' => $studyTeamMember->fresh(['user:id,name,email', 'site:id,source_id,site_role']),
                'message' => 'Team member updated.',
            ]);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to update team member', $e);
        }
    }

    /**
     * DELETE /v1/studies/{study}/team/{studyTeamMember}
     *
     * Remove a team member from a study.
     */
    public function destroy(Study $study, StudyTeamMember $studyTeamMember): JsonResponse
    {
        if ((int) $studyTeamMember->study_id !== (int) $study->id) {
            return response()->json(['message' => 'Team member does not belong to this study.'], 404);
        }

        try {
            $studyTeamMember->delete();

            return response()->json([
                'message' => 'Team member removed.',
            ]);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to remove team member', $e);
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
