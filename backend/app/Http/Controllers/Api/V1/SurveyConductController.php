<?php

namespace App\Http\Controllers\Api\V1;

use App\Models\Survey\SurveyCampaign;
use App\Models\Survey\SurveyConductRecord;
use App\Services\Survey\SurveyResponseService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;

class SurveyConductController extends Controller
{
    public function index(Request $request, SurveyCampaign $campaign): JsonResponse
    {
        $query = $campaign->conductRecords()
            ->with('honestBrokerLink:id,survey_conduct_id,blinded_participant_id')
            ->orderBy('person_id');

        if ($request->filled('status')) {
            $query->where('completion_status', $request->string('status'));
        }

        return response()->json([
            'data' => $query->get()->map(function (SurveyConductRecord $conduct): array {
                return [
                    ...$conduct->toArray(),
                    'blinded_participant_id' => $conduct->honestBrokerLink?->blinded_participant_id,
                ];
            }),
        ]);
    }

    public function storeResponses(
        Request $request,
        SurveyConductRecord $conduct,
        SurveyResponseService $surveyResponseService,
    ): JsonResponse {
        $validated = $request->validate([
            'responses' => 'required|array|min:1',
            'responses.*.survey_item_id' => 'required|integer|exists:survey_items,id',
            'responses.*.value' => 'nullable',
            'replace_existing' => 'sometimes|boolean',
        ]);

        $result = $surveyResponseService->storeResponses(
            $conduct,
            $validated['responses'],
            (bool) ($validated['replace_existing'] ?? true),
        );

        return response()->json([
            'data' => [
                'conduct_id' => $conduct->id,
                ...$result,
            ],
        ]);
    }
}
