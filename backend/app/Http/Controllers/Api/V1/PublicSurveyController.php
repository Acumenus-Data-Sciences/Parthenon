<?php

namespace App\Http\Controllers\Api\V1;

use App\Models\Survey\SurveyCampaign;
use App\Models\Survey\SurveyHonestBrokerInvitation;
use App\Services\Survey\HonestBrokerService;
use App\Services\Survey\SurveyResponseService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;

class PublicSurveyController extends Controller
{
    public function show(string $token): JsonResponse
    {
        $invitation = $this->resolveInvitation($token);
        $campaign = $invitation?->campaign ?? $this->resolveActiveCampaign($token);

        if ($campaign === null) {
            return response()->json([
                'message' => 'This survey link is invalid or no longer active.',
            ], 404);
        }

        if ($invitation !== null) {
            app(HonestBrokerService::class)->markOpened($invitation);
        }

        return response()->json([
            'data' => [
                ...$campaign->toArray(),
                'requires_respondent_identifier' => $invitation === null && $campaign->requires_honest_broker,
                'blinded_participant_id' => $invitation?->link?->blinded_participant_id,
                'delivery_status' => $invitation?->delivery_status,
            ],
        ]);
    }

    public function submit(
        Request $request,
        string $token,
        HonestBrokerService $honestBrokerService,
        SurveyResponseService $surveyResponseService,
    ): JsonResponse {
        $invitation = $this->resolveInvitation($token);
        $campaign = $invitation?->campaign ?? $this->resolveActiveCampaign($token);

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

        $respondentIdentifier = $validated['respondent_identifier'] ?? null;
        $brokerLink = null;

        if ($invitation !== null) {
            if ($invitation->revoked_at !== null || ($invitation->expires_at !== null && $invitation->expires_at->isPast())) {
                return response()->json([
                    'message' => 'This survey invitation is invalid or expired.',
                ], 422);
            }

            if ($invitation->submitted_at !== null || in_array($invitation->delivery_status, ['submitted', 'revoked'], true)) {
                return response()->json([
                    'message' => 'This survey invitation has already been used.',
                ], 422);
            }

            $brokerLink = $invitation->link;
        } elseif ($campaign->requires_honest_broker) {
            if ($respondentIdentifier === null || trim($respondentIdentifier) === '') {
                return response()->json([
                    'message' => 'This survey requires honest broker registration before submission.',
                ], 422);
            }

            $brokerLink = $honestBrokerService->resolveCampaignParticipant($campaign, $respondentIdentifier);

            if ($brokerLink === null || $brokerLink->person_id === null) {
                return response()->json([
                    'message' => 'Respondent is not registered with the honest broker for this campaign.',
                ], 422);
            }

            if ($brokerLink->survey_conduct_id !== null) {
                $existingConduct = $brokerLink->conduct;
                if ($existingConduct !== null && $existingConduct->completion_status === 'complete') {
                    return response()->json([
                        'message' => 'A response has already been submitted for this participant.',
                    ], 422);
                }
            }
        }

        $conduct = $brokerLink !== null
            ? $honestBrokerService->findOrCreateConductRecord($campaign, $brokerLink)
            : $campaign->conductRecords()->create([
                'person_id' => null,
                'survey_instrument_id' => $campaign->survey_instrument_id,
                'completion_status' => 'pending',
                'survey_start_datetime' => now(),
            ]);

        if ($brokerLink !== null && $conduct->completion_status === 'complete') {
            return response()->json([
                'message' => 'A response has already been submitted for this participant.',
            ], 422);
        }

        $result = $surveyResponseService->storeResponses(
            $conduct,
            $validated['responses'],
            true,
        );

        if ($brokerLink !== null) {
            $honestBrokerService->markSubmitted($brokerLink, $conduct, $invitation);
        }

        return response()->json([
            'data' => [
                'conduct_id' => $conduct->id,
                'blinded_participant_id' => $brokerLink?->blinded_participant_id,
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

    private function resolveInvitation(string $token): ?SurveyHonestBrokerInvitation
    {
        $invitation = app(HonestBrokerService::class)->resolveInvitation($token);

        if ($invitation === null) {
            return null;
        }

        if ($invitation->campaign?->status !== 'active') {
            return null;
        }

        return $invitation;
    }
}
