<?php

namespace App\Http\Controllers\Api\V1;

use App\Models\Survey\SurveyCampaign;
use App\Services\Survey\SurveyResponseService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;

class PublicSurveyController extends Controller
{
    public function show(string $token): JsonResponse
    {
        $campaign = $this->resolveActiveCampaign($token);

        if ($campaign === null) {
            return response()->json([
                'message' => 'This survey link is invalid or no longer active.',
            ], 404);
        }

        return response()->json([
            'data' => $campaign,
        ]);
    }

    public function submit(
        Request $request,
        string $token,
        SurveyResponseService $surveyResponseService,
    ): JsonResponse {
        $campaign = $this->resolveActiveCampaign($token);

        if ($campaign === null) {
            return response()->json([
                'message' => 'This survey link is invalid or no longer active.',
            ], 404);
        }

        $validated = $request->validate([
            'responses' => 'required|array|min:1',
            'responses.*.survey_item_id' => 'required|integer|exists:survey_items,id',
            'responses.*.value' => 'nullable',
            'respondent_identifier' => 'sometimes|nullable|string|max:255',
        ]);

        $conduct = $campaign->conductRecords()->create([
            'person_id' => null,
            'survey_instrument_id' => $campaign->survey_instrument_id,
            'completion_status' => 'pending',
            'survey_start_datetime' => now(),
            'source_identifier' => $validated['respondent_identifier'] ?? null,
        ]);

        $result = $surveyResponseService->storeResponses(
            $conduct,
            $validated['responses'],
            true,
        );

        return response()->json([
            'data' => [
                'conduct_id' => $conduct->id,
                ...$result,
            ],
        ], 201);
    }

    private function resolveActiveCampaign(string $token): ?SurveyCampaign
    {
        return SurveyCampaign::query()
            ->where('publish_token', $token)
            ->where('status', 'active')
            ->with([
                'instrument:id,name,abbreviation,version,description,domain',
                'instrument.items.answerOptions',
            ])
            ->first();
    }
}
