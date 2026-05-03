<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\SubmitTemplateRunRequest;
use App\Services\Templates\TemplateRegistryClient;
use App\Services\Templates\TemplateRunService;
use Illuminate\Http\JsonResponse;

class TemplatesController extends Controller
{
    public function __construct(
        private readonly TemplateRegistryClient $registry,
        private readonly TemplateRunService $runService,
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

        $run = $this->runService->submit(
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
}
