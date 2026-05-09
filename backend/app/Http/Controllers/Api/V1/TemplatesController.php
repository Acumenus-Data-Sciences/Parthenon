<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\SubmitTemplateRunRequest;
use App\Models\App\TemplateRun;
use App\Services\Templates\TemplatePresenter;
use App\Services\Templates\TemplateRegistryClient;
use App\Services\Templates\TemplateRunService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TemplatesController extends Controller
{
    public function __construct(
        private readonly TemplateRegistryClient $registry,
    ) {}

    public function index(): JsonResponse
    {
        $items = array_map(
            static fn (array $t): array => TemplatePresenter::summary($t),
            $this->registry->listTemplates(),
        );

        return response()->json($items);
    }

    public function show(string $id): JsonResponse
    {
        $manifest = $this->registry->getTemplate($id);

        return response()->json(TemplatePresenter::manifest($manifest));
    }

    public function submitRun(SubmitTemplateRunRequest $request, string $id): JsonResponse
    {
        $user = $request->user();
        if ($user === null) {
            abort(401);
        }

        $run = app(TemplateRunService::class)->submit(
            $id,
            $request->validatedVersion(),
            $request->validatedParameters(),
            $user,
        );

        $jobId = $run->ingestionJobs()->value('id');

        // Frontend reads `id` (not `template_run_id`); we keep the legacy
        // `template_run_id` field to preserve backwards compatibility with
        // any external callers.
        return response()->json([
            'id' => $run->id,
            'template_run_id' => $run->id,
            'ingestion_job_id' => $jobId,
            'status' => $run->status,
        ], 201);
    }

    /**
     * GET /ingestion/templates/runs
     *
     * Paginated list of template runs, optionally filtered by status[].
     */
    public function listRuns(Request $request): JsonResponse
    {
        $perPage = (int) $request->query('per_page', '20');
        $perPage = max(1, min($perPage, 100));

        $statuses = (array) $request->query('status', []);
        $statuses = array_values(array_filter($statuses, 'is_string'));

        $query = TemplateRun::query()->orderByDesc('id');
        if ($statuses !== []) {
            $query->whereIn('status', $statuses);
        }

        $page = $query->paginate($perPage)->appends($request->query());

        return response()->json([
            'data' => array_map(
                static fn (TemplateRun $run): array => TemplatePresenter::run($run),
                $page->items(),
            ),
            'meta' => [
                'total' => $page->total(),
                'page' => $page->currentPage(),
                'per_page' => $page->perPage(),
            ],
        ]);
    }

    public function showRun(TemplateRun $run): JsonResponse
    {
        return response()->json(TemplatePresenter::run($run));
    }

    public function runLogs(TemplateRun $run): JsonResponse
    {
        if ($run->prefect_run_id === null) {
            return response()->json(['lines' => []]);
        }

        $upstream = $this->registry->getLogs((string) $run->prefect_run_id);
        $lines = is_array($upstream['lines'] ?? null) ? $upstream['lines'] : [];

        return response()->json([
            'lines' => TemplatePresenter::logLines($lines),
        ]);
    }

    public function runArtifacts(TemplateRun $run): JsonResponse
    {
        if ($run->prefect_run_id === null) {
            return response()->json(['artifacts' => []]);
        }

        $upstream = $this->registry->getArtifacts((string) $run->prefect_run_id);
        $artifacts = is_array($upstream['artifacts'] ?? null) ? $upstream['artifacts'] : [];

        return response()->json([
            'artifacts' => TemplatePresenter::artifacts($artifacts),
        ]);
    }

    public function cancelRun(TemplateRun $run): JsonResponse
    {
        app(TemplateRunService::class)->cancel($run);

        return response()->json([
            'ok' => true,
            'id' => $run->id,
            'template_run_id' => $run->id,
            'status' => $run->refresh()->status,
        ]);
    }
}
