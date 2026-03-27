<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\App\Study;
use App\Models\App\StudyArtifact;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * @group Studies
 */
class StudyArtifactController extends Controller
{
    /**
     * GET /v1/studies/{study}/artifacts
     *
     * List artifacts for a study.
     */
    public function index(Request $request, Study $study): JsonResponse
    {
        try {
            $artifacts = $study->artifacts()
                ->with('uploadedBy:id,name,email')
                ->orderByDesc('created_at')
                ->get();

            return response()->json([
                'data' => $artifacts,
            ]);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to retrieve study artifacts', $e);
        }
    }

    /**
     * POST /v1/studies/{study}/artifacts
     *
     * Add an artifact to a study.
     */
    public function store(Request $request, Study $study): JsonResponse
    {
        $validated = $request->validate([
            'artifact_type' => 'required|string|max:50',
            'title' => 'required|string|max:255',
            'description' => 'nullable|string',
            'version' => 'nullable|string|max:50',
            'file_path' => 'nullable|string|max:1000',
            'file_size_bytes' => 'nullable|integer|min:0',
            'mime_type' => 'nullable|string|max:100',
            'url' => 'nullable|string|max:2000',
            'metadata' => 'nullable|array',
            'is_current' => 'sometimes|boolean',
        ]);

        try {
            $artifact = StudyArtifact::create([
                ...$validated,
                'study_id' => $study->id,
                'uploaded_by' => $request->user()->id,
            ]);

            $artifact->load('uploadedBy:id,name,email');

            return response()->json([
                'data' => $artifact,
                'message' => 'Study artifact added.',
            ], 201);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to add study artifact', $e);
        }
    }

    /**
     * PUT /v1/studies/{study}/artifacts/{studyArtifact}
     *
     * Update a study artifact.
     */
    public function update(Request $request, Study $study, StudyArtifact $studyArtifact): JsonResponse
    {
        if ((int) $studyArtifact->study_id !== (int) $study->id) {
            return response()->json(['message' => 'Artifact does not belong to this study.'], 404);
        }

        $validated = $request->validate([
            'artifact_type' => 'sometimes|required|string|max:50',
            'title' => 'sometimes|required|string|max:255',
            'description' => 'nullable|string',
            'version' => 'nullable|string|max:50',
            'file_path' => 'nullable|string|max:1000',
            'file_size_bytes' => 'nullable|integer|min:0',
            'mime_type' => 'nullable|string|max:100',
            'url' => 'nullable|string|max:2000',
            'metadata' => 'nullable|array',
            'is_current' => 'sometimes|boolean',
        ]);

        try {
            $studyArtifact->update($validated);

            return response()->json([
                'data' => $studyArtifact->fresh('uploadedBy:id,name,email'),
                'message' => 'Study artifact updated.',
            ]);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to update study artifact', $e);
        }
    }

    /**
     * DELETE /v1/studies/{study}/artifacts/{studyArtifact}
     *
     * Remove an artifact from a study.
     */
    public function destroy(Study $study, StudyArtifact $studyArtifact): JsonResponse
    {
        if ((int) $studyArtifact->study_id !== (int) $study->id) {
            return response()->json(['message' => 'Artifact does not belong to this study.'], 404);
        }

        try {
            $studyArtifact->delete();

            return response()->json([
                'message' => 'Study artifact removed.',
            ]);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to remove study artifact', $e);
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
