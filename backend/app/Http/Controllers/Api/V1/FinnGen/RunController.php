<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\FinnGen;

use App\Http\Controllers\Controller;
use App\Http\Requests\FinnGen\CreateRunRequest;
use App\Models\App\FinnGen\Run;
use App\Services\FinnGen\FinnGenRunService;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RunController extends Controller
{
    use AuthorizesRequests;

    public function __construct(
        private readonly FinnGenRunService $svc,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $query = Run::query();

        // Admins see all runs; everyone else sees only their own.
        if ($user === null || ! $user->hasAnyRole(['admin', 'super-admin'])) {
            $query->where('user_id', $user?->id);
        }

        foreach (['status', 'analysis_type', 'source_key'] as $f) {
            if ($request->filled($f)) {
                $query->where($f, (string) $request->string($f));
            }
        }
        if ($request->filled('pinned')) {
            $query->where('pinned', $request->boolean('pinned'));
        }

        $perPage = min(100, max(1, (int) $request->input('per_page', 25)));
        $paginator = $query->orderByDesc('created_at')->paginate($perPage);

        return response()->json([
            'data' => $paginator->items(),
            'meta' => [
                'page' => $paginator->currentPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
            ],
        ]);
    }

    public function store(CreateRunRequest $request): JsonResponse
    {
        $user = $request->user();
        abort_if($user === null, 401);

        $run = $this->svc->create(
            userId: $user->id,
            sourceKey: (string) $request->string('source_key'),
            analysisType: (string) $request->string('analysis_type'),
            params: (array) $request->input('params', []),
        );

        return response()->json($run, 201);
    }

    public function show(Request $request, Run $run): JsonResponse
    {
        $this->authorize('view', $run);

        return response()->json($run);
    }

    public function cancel(Request $request, Run $run): JsonResponse
    {
        $this->authorize('cancel', $run);

        return response()->json($this->svc->requestCancel($run), 202);
    }

    public function pin(Request $request, Run $run): JsonResponse
    {
        $this->authorize('pin', $run);

        return response()->json($this->svc->pin($run));
    }

    public function unpin(Request $request, Run $run): JsonResponse
    {
        $this->authorize('pin', $run);

        return response()->json($this->svc->unpin($run));
    }
}
