<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * @group Authentication
 */
class NotificationPreferenceController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        $user = $request->user();

        return response()->json([
            'notification_email' => $user->notification_email,
            'notification_sms' => $user->notification_sms,
            'phone_number' => $user->phone_number,
            'notification_preferences' => array_merge([
                'analysis_completed' => true,
                'analysis_failed' => true,
                'cohort_generated' => true,
                'study_completed' => true,
                'daily_digest' => true,
                'daily_digest_mode' => 'always',
            ], $user->notification_preferences ?? []),
        ]);
    }

    public function update(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'notification_email' => 'sometimes|boolean',
            'notification_sms' => 'sometimes|boolean',
            'phone_number' => 'sometimes|nullable|string|max:20',
            'notification_preferences' => 'sometimes|array',
            'notification_preferences.analysis_completed' => 'sometimes|boolean',
            'notification_preferences.analysis_failed' => 'sometimes|boolean',
            'notification_preferences.cohort_generated' => 'sometimes|boolean',
            'notification_preferences.study_completed' => 'sometimes|boolean',
            'notification_preferences.daily_digest' => 'sometimes|boolean',
            'notification_preferences.daily_digest_mode' => 'sometimes|string|in:always,alerts_only',
        ]);

        $request->user()->update($validated);

        return response()->json($request->user()->only([
            'notification_email',
            'notification_sms',
            'phone_number',
            'notification_preferences',
        ]));
    }
}
