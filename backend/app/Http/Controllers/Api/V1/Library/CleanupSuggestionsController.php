<?php

namespace App\Http\Controllers\Api\V1\Library;

use App\Http\Controllers\Controller;
use App\Models\App\LibraryCleanupSuggestion;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CleanupSuggestionsController extends Controller
{
    /**
     * GET /v1/library/cleanup
     *
     * Returns the current user's stale-item suggestions, computed nightly by
     * SuggestLibraryCleanupJob and cached in library_cleanup_suggestions.
     */
    public function index(Request $request): JsonResponse
    {
        $rows = LibraryCleanupSuggestion::query()
            ->where('user_id', $request->user()->id)
            ->orderBy('last_activity_at')
            ->get();

        return response()->json(['data' => $rows]);
    }
}
