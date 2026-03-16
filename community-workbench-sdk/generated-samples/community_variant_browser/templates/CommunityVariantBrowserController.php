<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\Workbench\CommunityVariantBrowserService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CommunityVariantBrowserController extends Controller
{
    public function __construct(
        private readonly CommunityVariantBrowserService $service,
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
