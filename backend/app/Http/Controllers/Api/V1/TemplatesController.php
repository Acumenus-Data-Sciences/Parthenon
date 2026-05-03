<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\SubmitTemplateRunRequest;
use App\Models\App\TemplateRun;
use App\Services\Templates\TemplateRegistryClient;
use App\Services\Templates\TemplateRunService;
use Illuminate\Http\JsonResponse;

class TemplatesController extends Controller
{
    public function __construct(
        private readonly TemplateRegistryClient $registry,
    ) {}

    public function index(): JsonResponse
    {
        return response()->json($this->registry->listTemplates());
    }

    public function show(string $id): JsonResponse
    {
        return response()->json($this->registry->getTemplate($id));
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

        return response()->json([
            'template_run_id' => $run->id,
            'ingestion_job_id' => $jobId,
            'status' => $run->status,
        ], 201);
    }

    public function showRun(TemplateRun $run): JsonResponse
    {
        $run->loadMissing('ingestionJobs');

        return response()->json([
            'template_run' => $run,
            'ingestion_jobs' => $run->ingestionJobs,
        ]);
    }

    public function runLogs(TemplateRun $run): JsonResponse
    {
        if ($run->prefect_run_id === null) {
            return response()->json(['lines' => []]);
        }

        return response()->json($this->registry->getLogs((string) $run->prefect_run_id));
    }

    public function runArtifacts(TemplateRun $run): JsonResponse
    {
        if ($run->prefect_run_id === null) {
            return response()->json(['artifacts' => []]);
        }

        return response()->json($this->registry->getArtifacts((string) $run->prefect_run_id));
    }
}
