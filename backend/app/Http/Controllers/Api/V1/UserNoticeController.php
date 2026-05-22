<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * @group Authentication
 */
class UserNoticeController extends Controller
{
    /**
     * PUT /api/v1/user/library-notice
     *
     * Acknowledge the one-time library-lifecycle notice for the authenticated
     * user, so the introductory toast is shown at most once.
     */
    public function acknowledgeLibrary(Request $request): JsonResponse
    {
        $request->user()->update(['seen_library_lifecycle_notice' => true]);

        return response()->json(['seen_library_lifecycle_notice' => true]);
    }
}
