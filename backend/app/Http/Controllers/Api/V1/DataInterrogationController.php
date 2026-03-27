<?php

namespace App\Http\Controllers\Api\V1;

use App\Exceptions\AiProviderNotConfiguredException;
use App\Exceptions\AiProviderRequestException;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\DataInterrogationRequest;
use App\Models\App\Source;
use App\Services\AI\DataInterrogationService;
use Illuminate\Http\JsonResponse;

class DataInterrogationController extends Controller
{
    public function __construct(
        private readonly DataInterrogationService $interrogationService,
    ) {}

    public function ask(DataInterrogationRequest $request): JsonResponse
    {
        $source = Source::findOrFail($request->validated('source_id'));

        try {
            $result = $this->interrogationService->ask(
                question: $request->validated('question'),
                source: $source,
                user: $request->user(),
            );

            return response()->json($result);
        } catch (AiProviderNotConfiguredException $e) {
            return response()->json([
                'answer' => '',
                'error' => $e->getMessage(),
                'tables' => [],
                'queries' => [],
                'iterations' => 0,
            ], 422);
        } catch (AiProviderRequestException $e) {
            return response()->json([
                'answer' => '',
                'error' => "AI provider error: {$e->getMessage()}",
                'tables' => [],
                'queries' => [],
                'iterations' => 0,
            ], 502);
        }
    }
}
