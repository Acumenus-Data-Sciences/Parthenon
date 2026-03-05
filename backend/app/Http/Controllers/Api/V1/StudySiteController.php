<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\App\Study;
use App\Models\App\StudySite;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

#[Group('Studies', weight: 150)]
class StudySiteController extends Controller
{
    /**
     * GET /v1/studies/{study}/sites
     *
     * List sites for a study.
     */
    public function index(Request $request, Study $study): JsonResponse
    {
        try {
            $sites = $study->sites()
                ->with(['source', 'siteContact:id,name,email'])
                ->get();

            return response()->json([
                'data' => $sites,
            ]);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to retrieve study sites', $e);
        }
    }

    /**
     * POST /v1/studies/{study}/sites
     *
     * Add a site to a study.
     */
    public function store(Request $request, Study $study): JsonResponse
    {
        $validated = $request->validate([
            'source_id' => 'required|integer|exists:sources,id',
            'site_role' => 'nullable|string|max:50',
            'status' => 'nullable|string|max:50',
            'irb_protocol_number' => 'nullable|string|max:100',
            'irb_approval_date' => 'nullable|date',
            'irb_expiry_date' => 'nullable|date',
            'irb_type' => 'nullable|string|max:50',
            'dua_signed_at' => 'nullable|date',
            'site_contact_user_id' => 'nullable|integer|exists:users,id',
            'cdm_version' => 'nullable|string|max:20',
            'vocabulary_version' => 'nullable|string|max:50',
            'data_freshness_date' => 'nullable|date',
            'patient_count_estimate' => 'nullable|integer|min:0',
            'notes' => 'nullable|string',
        ]);

        try {
            $site = StudySite::create([
                ...$validated,
                'study_id' => $study->id,
            ]);

            $site->load(['source', 'siteContact:id,name,email']);

            return response()->json([
                'data' => $site,
                'message' => 'Study site added.',
            ], 201);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to add study site', $e);
        }
    }

    /**
     * GET /v1/studies/{study}/sites/{studySite}
     *
     * Show a single study site.
     */
    public function show(Study $study, StudySite $studySite): JsonResponse
    {
        if ((int) $studySite->study_id !== (int) $study->id) {
            return response()->json(['message' => 'Site does not belong to this study.'], 404);
        }

        try {
            $studySite->load(['source', 'siteContact:id,name,email', 'teamMembers.user:id,name,email']);

            return response()->json([
                'data' => $studySite,
            ]);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to retrieve study site', $e);
        }
    }

    /**
     * PUT /v1/studies/{study}/sites/{studySite}
     *
     * Update a study site.
     */
    public function update(Request $request, Study $study, StudySite $studySite): JsonResponse
    {
        if ((int) $studySite->study_id !== (int) $study->id) {
            return response()->json(['message' => 'Site does not belong to this study.'], 404);
        }

        $validated = $request->validate([
            'source_id' => 'sometimes|required|integer|exists:sources,id',
            'site_role' => 'nullable|string|max:50',
            'status' => 'nullable|string|max:50',
            'irb_protocol_number' => 'nullable|string|max:100',
            'irb_approval_date' => 'nullable|date',
            'irb_expiry_date' => 'nullable|date',
            'irb_type' => 'nullable|string|max:50',
            'dua_signed_at' => 'nullable|date',
            'site_contact_user_id' => 'nullable|integer|exists:users,id',
            'cdm_version' => 'nullable|string|max:20',
            'vocabulary_version' => 'nullable|string|max:50',
            'data_freshness_date' => 'nullable|date',
            'patient_count_estimate' => 'nullable|integer|min:0',
            'notes' => 'nullable|string',
        ]);

        try {
            $studySite->update($validated);

            return response()->json([
                'data' => $studySite->fresh(['source', 'siteContact:id,name,email']),
                'message' => 'Study site updated.',
            ]);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to update study site', $e);
        }
    }

    /**
     * DELETE /v1/studies/{study}/sites/{studySite}
     *
     * Soft delete a study site.
     */
    public function destroy(Study $study, StudySite $studySite): JsonResponse
    {
        if ((int) $studySite->study_id !== (int) $study->id) {
            return response()->json(['message' => 'Site does not belong to this study.'], 404);
        }

        try {
            $studySite->delete();

            return response()->json([
                'message' => 'Study site removed.',
            ]);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to remove study site', $e);
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
