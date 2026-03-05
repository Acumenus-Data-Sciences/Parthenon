<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Jobs\Fhir\RunFhirSyncJob;
use App\Models\App\FhirConnection;
use App\Models\App\FhirSyncRun;
use App\Services\Fhir\FhirAuthService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class FhirConnectionController extends Controller
{
    public function __construct(
        private readonly FhirAuthService $authService,
    ) {}

    // ──────────────────────────────────────────────────────────────────────────
    // CRUD
    // ──────────────────────────────────────────────────────────────────────────

    public function index(): JsonResponse
    {
        $connections = FhirConnection::with('targetSource:id,source_name')
            ->withCount('syncRuns')
            ->orderBy('site_name')
            ->get();

        return response()->json(['data' => $connections]);
    }

    public function show(FhirConnection $fhirConnection): JsonResponse
    {
        $fhirConnection->load('targetSource:id,source_name', 'creator:id,name');
        $fhirConnection->loadCount('syncRuns');

        return response()->json(['data' => $fhirConnection]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'site_name'             => 'required|string|max:200',
            'site_key'              => ['required', 'string', 'max:50', 'regex:/^[a-z0-9-]+$/', Rule::unique('fhir_connections')],
            'ehr_vendor'            => 'required|string|in:epic,cerner,other',
            'fhir_base_url'         => 'required|url|max:500',
            'token_endpoint'        => 'required|url|max:500',
            'client_id'             => 'required|string|max:200',
            'private_key_pem'       => 'nullable|string',
            'jwks_url'              => 'nullable|url|max:500',
            'scopes'                => 'nullable|string|max:500',
            'group_id'              => 'nullable|string|max:100',
            'export_resource_types' => 'nullable|string|max:500',
            'target_source_id'      => 'nullable|integer|exists:sources,id',
            'sync_config'           => 'nullable|array',
            'is_active'             => 'nullable|boolean',
            'incremental_enabled'   => 'nullable|boolean',
        ]);

        if (!empty($validated['private_key_pem'])) {
            $this->validatePem($validated['private_key_pem']);
        }

        $connection = FhirConnection::create([
            ...$validated,
            'scopes'     => $validated['scopes'] ?? 'system/*.read',
            'created_by' => Auth::id(),
        ]);

        return response()->json(['data' => $connection], 201);
    }

    public function update(Request $request, FhirConnection $fhirConnection): JsonResponse
    {
        $validated = $request->validate([
            'site_name'             => 'sometimes|string|max:200',
            'site_key'              => ['sometimes', 'string', 'max:50', 'regex:/^[a-z0-9-]+$/', Rule::unique('fhir_connections')->ignore($fhirConnection->id)],
            'ehr_vendor'            => 'sometimes|string|in:epic,cerner,other',
            'fhir_base_url'         => 'sometimes|url|max:500',
            'token_endpoint'        => 'sometimes|url|max:500',
            'client_id'             => 'sometimes|string|max:200',
            'private_key_pem'       => 'nullable|string',
            'jwks_url'              => 'nullable|url|max:500',
            'scopes'                => 'nullable|string|max:500',
            'group_id'              => 'nullable|string|max:100',
            'export_resource_types' => 'nullable|string|max:500',
            'target_source_id'      => 'nullable|integer|exists:sources,id',
            'sync_config'           => 'nullable|array',
            'is_active'             => 'nullable|boolean',
            'incremental_enabled'   => 'nullable|boolean',
        ]);

        if (!empty($validated['private_key_pem'])) {
            $this->validatePem($validated['private_key_pem']);
        }

        $fhirConnection->update($validated);

        return response()->json(['data' => $fhirConnection->fresh()]);
    }

    public function destroy(FhirConnection $fhirConnection): JsonResponse
    {
        $fhirConnection->delete();

        return response()->json(null, 204);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Test connection
    // ──────────────────────────────────────────────────────────────────────────

    public function testConnection(FhirConnection $fhirConnection): JsonResponse
    {
        if (!$fhirConnection->has_private_key) {
            return response()->json([
                'success' => false,
                'message' => 'No private key configured. Upload a PEM key first.',
            ], 422);
        }

        $start = microtime(true);
        $steps = [];

        try {
            // Step 1: Build JWT assertion
            $this->authService->buildClientAssertion($fhirConnection);
            $steps[] = ['step' => 'jwt_assertion', 'status' => 'ok'];

            // Step 2: Exchange for access token
            $token = $this->authService->getAccessToken($fhirConnection);
            $steps[] = [
                'step'   => 'token_exchange',
                'status' => 'ok',
                'detail' => 'Token obtained (expires in ' . $token['expires_in'] . 's)',
            ];

            // Step 3: Fetch FHIR metadata (CapabilityStatement)
            $metadataResponse = Http::timeout(15)
                ->withHeaders([
                    'Authorization' => "Bearer {$token['access_token']}",
                    'Accept'        => 'application/fhir+json',
                ])
                ->get(rtrim($fhirConnection->fhir_base_url, '/') . '/metadata');

            if ($metadataResponse->successful()) {
                $meta = $metadataResponse->json();
                $steps[] = [
                    'step'   => 'metadata',
                    'status' => 'ok',
                    'detail' => ($meta['software']['name'] ?? 'Unknown') . ' — FHIR ' . ($meta['fhirVersion'] ?? '?'),
                ];
            } else {
                $steps[] = [
                    'step'   => 'metadata',
                    'status' => 'warning',
                    'detail' => 'HTTP ' . $metadataResponse->status() . ' (auth worked but metadata unavailable)',
                ];
            }
        } catch (\Throwable $e) {
            $steps[] = [
                'step'   => 'exception',
                'status' => 'failed',
                'detail' => $e->getMessage(),
            ];

            return response()->json([
                'success'    => false,
                'message'    => $e->getMessage(),
                'steps'      => $steps,
                'elapsed_ms' => round((microtime(true) - $start) * 1000),
            ]);
        }

        return response()->json([
            'success'    => true,
            'message'    => 'Connection verified',
            'steps'      => $steps,
            'elapsed_ms' => round((microtime(true) - $start) * 1000),
        ]);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Sync operations
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * POST /admin/fhir-connections/{id}/sync
     *
     * Trigger a bulk data sync for this connection. Creates a FhirSyncRun
     * and dispatches the RunFhirSyncJob to the queue.
     */
    public function startSync(Request $request, FhirConnection $fhirConnection): JsonResponse
    {
        if (!$fhirConnection->is_active) {
            return response()->json([
                'message' => 'Connection is not active. Enable it before syncing.',
            ], 422);
        }

        if (!$fhirConnection->has_private_key) {
            return response()->json([
                'message' => 'No private key configured. Upload a PEM key first.',
            ], 422);
        }

        // Prevent concurrent syncs
        $running = $fhirConnection->syncRuns()
            ->whereIn('status', ['pending', 'exporting', 'downloading', 'processing'])
            ->exists();

        if ($running) {
            return response()->json([
                'message' => 'A sync is already in progress for this connection.',
            ], 409);
        }

        $forceFull = (bool) $request->input('force_full', false);

        $run = FhirSyncRun::create([
            'fhir_connection_id' => $fhirConnection->id,
            'status'             => 'pending',
            'triggered_by'       => Auth::id(),
        ]);

        $fhirConnection->update(['last_sync_status' => 'pending']);

        RunFhirSyncJob::dispatch($fhirConnection, $run, $forceFull);

        return response()->json(['data' => $run->load('triggeredBy:id,name')], 202);
    }

    /**
     * GET /admin/fhir-connections/{id}/sync-runs
     */
    public function syncRuns(FhirConnection $fhirConnection): JsonResponse
    {
        $runs = $fhirConnection->syncRuns()
            ->with('triggeredBy:id,name')
            ->orderByDesc('created_at')
            ->paginate(20);

        return response()->json($runs);
    }

    /**
     * GET /admin/fhir-connections/{id}/sync-runs/{syncRun}
     */
    public function syncRunDetail(FhirConnection $fhirConnection, FhirSyncRun $syncRun): JsonResponse
    {
        if ($syncRun->fhir_connection_id !== $fhirConnection->id) {
            abort(404);
        }

        $syncRun->load('triggeredBy:id,name', 'connection:id,site_name,site_key,ehr_vendor');

        return response()->json(['data' => $syncRun]);
    }

    /**
     * GET /admin/fhir-sync/dashboard
     *
     * Aggregate stats across all connections for the monitoring dashboard.
     */
    public function syncDashboard(): JsonResponse
    {
        $connections = FhirConnection::withCount('syncRuns')->get();

        $totalConnections = $connections->count();
        $activeConnections = $connections->where('is_active', true)->count();

        // Aggregate sync run stats
        $allRuns = FhirSyncRun::query();
        $totalRuns = (clone $allRuns)->count();
        $completedRuns = (clone $allRuns)->where('status', 'completed')->count();
        $failedRuns = (clone $allRuns)->where('status', 'failed')->count();
        $activeRuns = (clone $allRuns)->whereIn('status', ['pending', 'exporting', 'downloading', 'processing'])->count();

        // Records totals (from completed runs)
        $completedQuery = FhirSyncRun::where('status', 'completed');
        $totalExtracted = (clone $completedQuery)->sum('records_extracted');
        $totalMapped = (clone $completedQuery)->sum('records_mapped');
        $totalWritten = (clone $completedQuery)->sum('records_written');
        $totalFailed = (clone $completedQuery)->sum('records_failed');
        $avgCoverage = (clone $completedQuery)->whereNotNull('mapping_coverage')->avg('mapping_coverage');

        // Recent runs (last 20 across all connections)
        $recentRuns = FhirSyncRun::with('triggeredBy:id,name', 'connection:id,site_name,site_key')
            ->orderByDesc('created_at')
            ->limit(20)
            ->get();

        // Per-connection summary
        $connectionSummaries = $connections->map(fn (FhirConnection $c) => [
            'id'               => $c->id,
            'site_name'        => $c->site_name,
            'site_key'         => $c->site_key,
            'ehr_vendor'       => $c->ehr_vendor,
            'is_active'        => $c->is_active,
            'last_sync_at'     => $c->last_sync_at,
            'last_sync_status' => $c->last_sync_status,
            'last_sync_records' => $c->last_sync_records,
            'total_runs'       => $c->sync_runs_count,
        ]);

        // Sync timeline (last 30 days, runs per day)
        $timeline = FhirSyncRun::where('created_at', '>=', now()->subDays(30))
            ->selectRaw("DATE(created_at) as date, status, COUNT(*) as count")
            ->groupByRaw('DATE(created_at), status')
            ->orderBy('date')
            ->get()
            ->groupBy('date')
            ->map(fn ($group) => [
                'date'      => $group->first()->date,
                'completed' => $group->where('status', 'completed')->sum('count'),
                'failed'    => $group->where('status', 'failed')->sum('count'),
                'total'     => $group->sum('count'),
            ])
            ->values();

        return response()->json([
            'data' => [
                'summary' => [
                    'total_connections'  => $totalConnections,
                    'active_connections' => $activeConnections,
                    'total_runs'         => $totalRuns,
                    'completed_runs'     => $completedRuns,
                    'failed_runs'        => $failedRuns,
                    'active_runs'        => $activeRuns,
                    'total_extracted'    => (int) $totalExtracted,
                    'total_mapped'       => (int) $totalMapped,
                    'total_written'      => (int) $totalWritten,
                    'total_failed'       => (int) $totalFailed,
                    'avg_coverage'       => $avgCoverage ? round((float) $avgCoverage, 2) : null,
                ],
                'connections' => $connectionSummaries,
                'recent_runs' => $recentRuns,
                'timeline'    => $timeline,
            ],
        ]);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Helpers
    // ──────────────────────────────────────────────────────────────────────────

    private function validatePem(string $pem): void
    {
        $key = openssl_pkey_get_private($pem);
        if ($key === false) {
            throw new \Illuminate\Validation\ValidationException(
                validator([], [])->after(function ($v) {
                    $v->errors()->add('private_key_pem', 'Invalid PEM private key. Ensure it is RSA or EC format.');
                })
            );
        }
    }
}
