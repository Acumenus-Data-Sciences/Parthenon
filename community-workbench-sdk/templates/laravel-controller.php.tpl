<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\Workbench\__CLASS_NAME__Service;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class __CLASS_NAME__Controller extends Controller
{
    public function __construct(
        private readonly __CLASS_NAME__Service $service,
    ) {}

    public function run(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'source_key' => ['nullable', 'string'],
            'payload' => ['array'],
        ]);

        return response()->json([
            'data' => $this->service->run(
                sourceKey: $validated['source_key'] ?? null,
                payload: $validated['payload'] ?? [],
            ),
        ]);
    }
}
