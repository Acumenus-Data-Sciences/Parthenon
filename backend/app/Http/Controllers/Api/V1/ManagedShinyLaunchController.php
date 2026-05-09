<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\Shiny\ManagedShinyLaunchService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class ManagedShinyLaunchController extends Controller
{
    public function __construct(private readonly ManagedShinyLaunchService $launches) {}

    public function resolve(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'launch_token' => ['required', 'string'],
        ]);

        try {
            return response()->json([
                'data' => $this->launches->resolve($validated['launch_token']),
            ]);
        } catch (ValidationException $exception) {
            return response()->json([
                'message' => 'Managed Shiny launch token is invalid.',
                'errors' => $exception->errors(),
            ], 401);
        }
    }
}
