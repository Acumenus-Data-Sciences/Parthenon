<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\PacsConnectionRequest;
use App\Models\App\PacsConnection;
use App\Services\Imaging\PacsConnectionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * @group Administration
 */
class PacsConnectionController extends Controller
{
    public function __construct(
        private readonly PacsConnectionService $pacsService,
    ) {}

    // ── CRUD ──────────────────────────────────────────────────────────────────

    public function index(): JsonResponse
    {
        $connections = PacsConnection::with('source:id,source_name')
            ->orderByDesc('is_default')
            ->orderBy('name')
            ->get();

        return response()->json(['data' => $connections]);
    }

    public function show(PacsConnection $pacsConnection): JsonResponse
    {
        $pacsConnection->load('source:id,source_name');

        return response()->json(['data' => $pacsConnection]);
    }

    public function store(PacsConnectionRequest $request): JsonResponse
    {
        /** @var array<string, mixed> $validated */
        $validated = $request->validated();

        $connection = PacsConnection::create($validated);

        return response()->json(['data' => $connection], 201);
    }

    public function update(PacsConnectionRequest $request, PacsConnection $pacsConnection): JsonResponse
    {
        /** @var array<string, mixed> $validated */
        $validated = $request->validated();

        $pacsConnection->update($validated);

        return response()->json(['data' => $pacsConnection->fresh()]);
    }

    public function destroy(PacsConnection $pacsConnection): JsonResponse
    {
        $pacsConnection->update(['is_active' => false]);

        return response()->json(null, 204);
    }

    // ── Actions ───────────────────────────────────────────────────────────────

    public function test(PacsConnection $pacsConnection): JsonResponse
    {
        $result = $this->pacsService->testConnection($pacsConnection);

        return response()->json(['data' => $result]);
    }

    public function refreshStats(PacsConnection $pacsConnection): JsonResponse
    {
        $result = $this->pacsService->refreshStats($pacsConnection);

        return response()->json(['data' => $result]);
    }

    public function studies(Request $request, PacsConnection $pacsConnection): JsonResponse
    {
        $filters = $request->validate([
            'PatientName' => 'nullable|string|max:255',
            'PatientID' => 'nullable|string|max:255',
            'Modality' => 'nullable|string|max:50',
            'StudyDate' => 'nullable|string|max:50',
            'limit' => 'nullable|integer|min:1|max:500',
            'offset' => 'nullable|integer|min:0',
        ]);

        $result = $this->pacsService->browseStudies($pacsConnection, $filters);

        return response()->json(['data' => $result]);
    }

    public function setDefault(PacsConnection $pacsConnection): JsonResponse
    {
        DB::transaction(function () use ($pacsConnection) {
            PacsConnection::query()->update(['is_default' => false]);
            $pacsConnection->update(['is_default' => true]);
        });

        return response()->json(['data' => $pacsConnection->fresh()]);
    }
}
