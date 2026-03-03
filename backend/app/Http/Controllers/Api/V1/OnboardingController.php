<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class OnboardingController extends Controller
{
    /**
     * PUT /api/v1/user/onboarding
     *
     * Mark the authenticated user's onboarding as completed.
     */
    public function complete(Request $request): JsonResponse
    {
        $request->user()->update(['onboarding_completed' => true]);

        return response()->json(['onboarding_completed' => true]);
    }
}
