<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\App\Study;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * @group Studies
 */
class StudyActivityController extends Controller
{
    /**
     * GET /v1/studies/{study}/activity
     *
     * List activity log for a study (paginated, newest first).
     */
    public function index(Request $request, Study $study): JsonResponse
    {
        try {
            $activities = $study->activityLog()
                ->with('user:id,name,email')
                ->orderByDesc('occurred_at')
                ->paginate($request->integer('per_page', 25));

            return response()->json($activities);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to retrieve study activity log', $e);
        }
    }

    /**
     * Build a standardized error response for database/service failures.
     */
    private function errorResponse(string $message, \Throwable $exception): JsonResponse
    {
        $response = [
            'error' => $message,
            'message' => $exception->getMessage(),
        ];

        if (config('app.debug')) {
            $response['trace'] = $exception->getTraceAsString();
        }

        return response()->json($response, 500);
    }
}
