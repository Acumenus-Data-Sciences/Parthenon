<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\App\Study;
use App\Services\Publication\ManuscriptComposer;
use App\Services\Publication\PublicationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Assembles a STROBE/RECORD manuscript from a study's calibrated results,
 * gate-ledger decisions, and provenance (ADR-0020 Phase 6), and exports it via
 * the existing publication exporters.
 *
 * @group Studies
 */
class StudyManuscriptController extends Controller
{
    public function __construct(
        private readonly ManuscriptComposer $composer,
        private readonly PublicationService $publication,
    ) {}

    /**
     * GET /v1/studies/{study}/manuscript
     */
    public function compose(Study $study): JsonResponse
    {
        try {
            return response()->json(['data' => $this->composer->compose($study)]);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to compose manuscript', $e);
        }
    }

    /**
     * POST /v1/studies/{study}/manuscript/export
     */
    public function export(Request $request, Study $study): JsonResponse|StreamedResponse
    {
        $validated = $request->validate([
            'format' => ['required', 'string', Rule::in(['docx', 'pdf'])],
        ]);

        try {
            $document = $this->composer->compose($study);

            return $this->publication->export([...$document, 'format' => $validated['format']]);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to export manuscript', $e);
        }
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
