<?php

namespace App\Http\Controllers\Api\V1;

use App\Models\Survey\SurveyCampaign;
use App\Models\Survey\SurveyHonestBrokerInvitation;
use App\Models\Survey\SurveyHonestBrokerLink;
use App\Services\Survey\HonestBrokerService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;

class SurveyHonestBrokerController extends Controller
{
    public function index(SurveyCampaign $campaign): JsonResponse
    {
        $links = $campaign->honestBrokerLinks()
            ->with(['contact', 'invitations' => fn ($query) => $query->latest()->limit(1)])
            ->orderByDesc('created_at')
            ->get()
            ->map(fn ($link) => $this->transformLink($link));

        return response()->json([
            'data' => $links,
        ]);
    }

    public function upsertContact(
        Request $request,
        SurveyCampaign $campaign,
        SurveyHonestBrokerLink $link,
        HonestBrokerService $honestBrokerService,
    ): JsonResponse {
        if ($link->survey_campaign_id !== $campaign->id) {
            abort(404);
        }

        $validated = $request->validate([
            'delivery_email' => 'nullable|email|max:255',
            'delivery_phone' => 'nullable|string|max:40',
            'preferred_channel' => 'nullable|string|in:email,sms',
        ]);

        $contact = $honestBrokerService->registerContact(
            $link->loadMissing('campaign'),
            $validated,
            $request->user(),
        );

        return response()->json([
            'data' => $this->transformContact($contact),
        ]);
    }

    public function invitations(SurveyCampaign $campaign): JsonResponse
    {
        $invitations = $campaign->honestBrokerInvitations()
            ->with(['link', 'contact'])
            ->latest()
            ->get()
            ->map(fn ($invitation) => $this->transformInvitation($invitation));

        return response()->json([
            'data' => $invitations,
        ]);
    }

    public function auditLogs(
        SurveyCampaign $campaign,
        HonestBrokerService $honestBrokerService,
    ): JsonResponse {
        $logs = $honestBrokerService->listAuditLogs($campaign)
            ->map(fn ($log) => $this->transformAuditLog($log));

        return response()->json([
            'data' => $logs,
        ]);
    }

    public function sendInvitation(
        Request $request,
        SurveyCampaign $campaign,
        HonestBrokerService $honestBrokerService,
    ): JsonResponse {
        $validated = $request->validate([
            'survey_honest_broker_link_id' => 'required|integer|exists:survey_honest_broker_links,id',
            'delivery_email' => 'nullable|email|max:255',
            'delivery_phone' => 'nullable|string|max:40',
            'preferred_channel' => 'nullable|string|in:email,sms',
        ]);

        /** @var SurveyHonestBrokerLink $link */
        $link = $campaign->honestBrokerLinks()
            ->with(['contact', 'campaign'])
            ->findOrFail($validated['survey_honest_broker_link_id']);

        $result = $honestBrokerService->issueInvitation(
            $campaign,
            $link,
            $validated,
            $request->user(),
        );

        return response()->json([
            'data' => [
                'invitation' => $this->transformInvitation($result['invitation']),
                'survey_url' => $result['survey_url'],
            ],
        ], 201);
    }

    public function resendInvitation(
        Request $request,
        SurveyCampaign $campaign,
        SurveyHonestBrokerInvitation $invitation,
        HonestBrokerService $honestBrokerService,
    ): JsonResponse {
        if ($invitation->survey_campaign_id !== $campaign->id) {
            abort(404);
        }

        $result = $honestBrokerService->resendInvitation(
            $invitation->loadMissing('campaign', 'link.contact', 'contact'),
            $request->user(),
        );

        return response()->json([
            'data' => [
                'invitation' => $this->transformInvitation($result['invitation']),
                'survey_url' => $result['survey_url'],
            ],
        ]);
    }

    public function revokeInvitation(
        Request $request,
        SurveyCampaign $campaign,
        SurveyHonestBrokerInvitation $invitation,
        HonestBrokerService $honestBrokerService,
    ): JsonResponse {
        if ($invitation->survey_campaign_id !== $campaign->id) {
            abort(404);
        }

        $updated = $honestBrokerService->revokeInvitation(
            $invitation->loadMissing('contact', 'link'),
            $request->user(),
        );

        return response()->json([
            'data' => $this->transformInvitation($updated),
        ]);
    }

    public function store(
        Request $request,
        SurveyCampaign $campaign,
        HonestBrokerService $honestBrokerService,
    ): JsonResponse {
        $validated = $request->validate([
            'respondent_identifier' => 'required|string|max:255',
            'person_id' => 'nullable|integer|min:1',
            'notes' => 'nullable|string',
        ]);

        $link = $honestBrokerService->registerParticipant(
            $campaign->loadMissing('cohortGeneration.source.daimons'),
            $validated['respondent_identifier'],
            $validated['person_id'] ?? null,
            $request->user(),
            $validated['notes'] ?? null,
        );

        return response()->json([
            'data' => $this->transformLink($link),
        ], 201);
    }

    /**
     * @return array<string, mixed>
     */
    private function transformLink(mixed $link): array
    {
        return [
            'id' => $link->id,
            'survey_campaign_id' => $link->survey_campaign_id,
            'survey_conduct_id' => $link->survey_conduct_id,
            'person_id' => $link->person_id,
            'blinded_participant_id' => $link->blinded_participant_id,
            'match_status' => $link->match_status,
            'submitted_at' => $link->submitted_at,
            'notes' => $link->notes,
            'contact' => $link->contact ? $this->transformContact($link->contact) : null,
            'latest_invitation' => $link->invitations->first() ? $this->transformInvitation($link->invitations->first()) : null,
            'created_at' => $link->created_at,
            'updated_at' => $link->updated_at,
        ];
    }

    private function transformContact(mixed $contact): array
    {
        return [
            'id' => $contact->id,
            'survey_honest_broker_link_id' => $contact->survey_honest_broker_link_id,
            'preferred_channel' => $contact->preferred_channel,
            'delivery_email' => $contact->delivery_email,
            'delivery_phone' => $contact->delivery_phone,
            'last_sent_at' => $contact->last_sent_at,
            'created_at' => $contact->created_at,
            'updated_at' => $contact->updated_at,
        ];
    }

    private function transformInvitation(SurveyHonestBrokerInvitation $invitation): array
    {
        return [
            'id' => $invitation->id,
            'survey_campaign_id' => $invitation->survey_campaign_id,
            'survey_honest_broker_link_id' => $invitation->survey_honest_broker_link_id,
            'survey_honest_broker_contact_id' => $invitation->survey_honest_broker_contact_id,
            'delivery_channel' => $invitation->delivery_channel,
            'delivery_status' => $invitation->delivery_status,
            'token_last_four' => $invitation->token_last_four,
            'sent_at' => $invitation->sent_at,
            'opened_at' => $invitation->opened_at,
            'submitted_at' => $invitation->submitted_at,
            'expires_at' => $invitation->expires_at,
            'revoked_at' => $invitation->revoked_at,
            'last_error' => $invitation->last_error,
            'message_subject' => $invitation->message_subject,
            'created_at' => $invitation->created_at,
            'updated_at' => $invitation->updated_at,
            'link' => $invitation->relationLoaded('link') && $invitation->link
                ? [
                    'id' => $invitation->link->id,
                    'blinded_participant_id' => $invitation->link->blinded_participant_id,
                    'person_id' => $invitation->link->person_id,
                ]
                : null,
            'contact' => $invitation->relationLoaded('contact') && $invitation->contact
                ? $this->transformContact($invitation->contact)
                : null,
        ];
    }

    private function transformAuditLog(mixed $log): array
    {
        return [
            'id' => $log->id,
            'survey_campaign_id' => $log->survey_campaign_id,
            'survey_honest_broker_link_id' => $log->survey_honest_broker_link_id,
            'survey_honest_broker_invitation_id' => $log->survey_honest_broker_invitation_id,
            'action' => $log->action,
            'metadata' => $log->metadata,
            'occurred_at' => $log->occurred_at,
            'actor' => $log->actor ? [
                'id' => $log->actor->id,
                'name' => $log->actor->name,
                'email' => $log->actor->email,
            ] : null,
            'link' => $log->link ? [
                'id' => $log->link->id,
                'blinded_participant_id' => $log->link->blinded_participant_id,
            ] : null,
            'invitation' => $log->invitation ? [
                'id' => $log->invitation->id,
                'token_last_four' => $log->invitation->token_last_four,
            ] : null,
        ];
    }
}
