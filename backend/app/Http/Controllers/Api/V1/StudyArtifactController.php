<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\App\Study;
use App\Models\App\StudyArtifact;
use App\Models\User;
use App\Services\Shiny\ManagedShinyAppRegistry;
use App\Services\Shiny\ManagedShinyLaunchService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * @group Studies
 */
class StudyArtifactController extends Controller
{
    /** @var list<string> */
    private const PROHIBITED_ARTIFACT_TYPES = ['shiny_app_url'];

    public function __construct(
        private readonly ManagedShinyAppRegistry $shinyAppRegistry,
        private readonly ManagedShinyLaunchService $shinyLaunches,
    ) {}

    /**
     * GET /v1/studies/{study}/artifacts
     *
     * List artifacts for a study.
     */
    public function index(Request $request, Study $study): JsonResponse
    {
        try {
            $artifacts = $study->artifacts()
                ->whereNotIn('artifact_type', self::PROHIBITED_ARTIFACT_TYPES)
                ->with('uploadedBy:id,name,email')
                ->orderByDesc('created_at')
                ->get()
                ->map(fn (StudyArtifact $artifact): array => $this->presentArtifact($artifact));

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
            'artifact_type' => ['required', 'string', 'max:50', Rule::notIn(self::PROHIBITED_ARTIFACT_TYPES)],
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
                'data' => $this->presentArtifact($artifact),
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

        if (in_array($studyArtifact->artifact_type, self::PROHIBITED_ARTIFACT_TYPES, true)) {
            return response()->json(['message' => 'Legacy Shiny artifacts are not exposed.'], 404);
        }

        $validated = $request->validate([
            'artifact_type' => ['sometimes', 'required', 'string', 'max:50', Rule::notIn(self::PROHIBITED_ARTIFACT_TYPES)],
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

            $studyArtifact->refresh()->load('uploadedBy:id,name,email');

            return response()->json([
                'data' => $this->presentArtifact($studyArtifact),
                'message' => 'Study artifact updated.',
            ]);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to update study artifact', $e);
        }
    }

    /**
     * GET /v1/studies/{study}/artifacts/{studyArtifact}/download
     *
     * Download a locally stored study artifact.
     */
    public function download(Study $study, StudyArtifact $studyArtifact): JsonResponse|StreamedResponse
    {
        if ((int) $studyArtifact->study_id !== (int) $study->id) {
            return response()->json(['message' => 'Artifact does not belong to this study.'], 404);
        }

        if (in_array($studyArtifact->artifact_type, self::PROHIBITED_ARTIFACT_TYPES, true)) {
            return response()->json(['message' => 'Legacy Shiny artifacts are not exposed.'], 404);
        }

        if ($studyArtifact->file_path === null || ! Storage::disk('local')->exists($studyArtifact->file_path)) {
            return response()->json(['message' => 'Artifact file is not available.'], 404);
        }

        $extension = match ($studyArtifact->mime_type) {
            'application/zip' => 'zip',
            'application/json' => 'json',
            'text/plain' => 'txt',
            default => 'bin',
        };

        return Storage::disk('local')->download(
            $studyArtifact->file_path,
            str($studyArtifact->title)->slug()->append(".{$extension}")->toString(),
            ['Content-Type' => $studyArtifact->mime_type ?? 'application/octet-stream'],
        );
    }

    /**
     * POST /v1/studies/{study}/artifacts/{studyArtifact}/shiny-launch
     *
     * Create a short-lived launch envelope for a vetted OHDSI Shiny app.
     */
    public function launchShiny(Request $request, Study $study, StudyArtifact $studyArtifact): JsonResponse
    {
        if ((int) $studyArtifact->study_id !== (int) $study->id) {
            return response()->json(['message' => 'Artifact does not belong to this study.'], 404);
        }

        if (in_array($studyArtifact->artifact_type, self::PROHIBITED_ARTIFACT_TYPES, true)) {
            return response()->json(['message' => 'Legacy Shiny artifacts are not exposed.'], 404);
        }

        $validated = $request->validate([
            'app_key' => ['nullable', 'string', 'max:120'],
            'mode' => ['nullable', 'string', Rule::in(['embedded', 'full_page'])],
        ]);

        /** @var User $user */
        $user = $request->user();

        return response()->json([
            'data' => $this->shinyLaunches->create(
                $study,
                $studyArtifact,
                $user,
                $validated['app_key'] ?? null,
                $validated['mode'] ?? 'embedded',
            ),
        ]);
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

    /**
     * @return array<string, mixed>
     */
    private function presentArtifact(StudyArtifact $artifact): array
    {
        $payload = $artifact->toArray();
        $payload['managed_shiny_apps'] = $this->shinyAppRegistry->appsForArtifact($artifact);

        if ($artifact->relationLoaded('uploadedBy')) {
            $payload['uploaded_by_user'] = $artifact->uploadedBy?->only(['id', 'name', 'email']);
        }

        return $payload;
    }
}
