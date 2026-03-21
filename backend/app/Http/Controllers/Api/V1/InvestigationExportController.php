<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\App\Investigation;
use App\Services\Investigation\InvestigationExportService;
use App\Services\Investigation\InvestigationVersionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class InvestigationExportController extends Controller
{
    public function __construct(
        private readonly InvestigationExportService $exportService,
        private readonly InvestigationVersionService $versionService,
    ) {}

    public function exportJson(Request $request, Investigation $investigation): JsonResponse
    {
        /** @var \App\Models\User $user */
        $user = $request->user();
        if ($investigation->owner_id !== $user->id) {
            return response()->json(['error' => 'Forbidden'], 403);
        }

        $data = $this->exportService->toJson($investigation);

        return response()->json(['data' => $data]);
    }

    public function exportPdf(Request $request, Investigation $investigation): Response|JsonResponse
    {
        /** @var \App\Models\User $user */
        $user = $request->user();
        if ($investigation->owner_id !== $user->id) {
            return response()->json(['error' => 'Forbidden'], 403);
        }

        $pdfBinary = $this->exportService->toPdf($investigation);

        if ($pdfBinary !== null) {
            $filename = 'investigation-' . $investigation->id . '-dossier.pdf';

            return response($pdfBinary, 200, [
                'Content-Type' => 'application/pdf',
                'Content-Disposition' => 'attachment; filename="' . $filename . '"',
            ]);
        }

        // DOMPDF not installed — return HTML fallback
        $html = $this->exportService->toPdfHtml($investigation);

        return response($html, 200, [
            'Content-Type' => 'text/html; charset=UTF-8',
        ]);
    }

    public function listVersions(Request $request, Investigation $investigation): JsonResponse
    {
        /** @var \App\Models\User $user */
        $user = $request->user();
        if ($investigation->owner_id !== $user->id) {
            return response()->json(['error' => 'Forbidden'], 403);
        }

        $versions = $this->versionService->listVersions($investigation->id);

        return response()->json(['data' => $versions]);
    }

    public function getVersion(Request $request, Investigation $investigation, int $versionNumber): JsonResponse
    {
        /** @var \App\Models\User $user */
        $user = $request->user();
        if ($investigation->owner_id !== $user->id) {
            return response()->json(['error' => 'Forbidden'], 403);
        }

        $version = $this->versionService->getVersion($investigation->id, $versionNumber);

        if ($version === null) {
            return response()->json(['error' => 'Version not found'], 404);
        }

        return response()->json(['data' => $version]);
    }

    public function createVersion(Request $request, Investigation $investigation): JsonResponse
    {
        /** @var \App\Models\User $user */
        $user = $request->user();
        if ($investigation->owner_id !== $user->id) {
            return response()->json(['error' => 'Forbidden'], 403);
        }

        $version = $this->versionService->createSnapshot($investigation, $user->id);

        return response()->json(['data' => $version], 201);
    }
}
