<?php

namespace App\Services\Survey;

use App\Enums\DaimonType;
use App\Mail\SurveyInvitationMail;
use App\Models\Survey\SurveyCampaign;
use App\Models\Survey\SurveyConductRecord;
use App\Models\Survey\SurveyHonestBrokerAuditLog;
use App\Models\Survey\SurveyHonestBrokerContact;
use App\Models\Survey\SurveyHonestBrokerInvitation;
use App\Models\Survey\SurveyHonestBrokerLink;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;

class HonestBrokerService
{
    public function registerParticipant(
        SurveyCampaign $campaign,
        string $respondentIdentifier,
        ?int $personId,
        ?User $actor = null,
        ?string $notes = null,
    ): SurveyHonestBrokerLink {
        $campaign->loadMissing('instrument:id');

        $normalizedIdentifier = $this->normalizeIdentifier($respondentIdentifier);
        $identifierHash = $this->hashIdentifier($normalizedIdentifier);
        $resolvedPersonId = $personId ?? $this->resolvePersonId($campaign, $normalizedIdentifier);
        $now = now();

        $link = SurveyHonestBrokerLink::query()->updateOrCreate(
            [
                'survey_campaign_id' => $campaign->id,
                'respondent_identifier_hash' => $identifierHash,
            ],
            [
                'person_id' => $resolvedPersonId,
                'source_id' => $campaign->cohortGeneration?->source_id,
                'cohort_generation_id' => $campaign->cohort_generation_id,
                'respondent_identifier' => $normalizedIdentifier,
                'match_status' => $resolvedPersonId !== null ? 'matched' : 'unmatched',
                'notes' => $notes,
                'updated_by' => $actor?->id,
                'created_by' => $actor?->id,
                'blinded_participant_id' => SurveyHonestBrokerLink::query()
                    ->where('survey_campaign_id', $campaign->id)
                    ->where('respondent_identifier_hash', $identifierHash)
                    ->value('blinded_participant_id') ?: $this->generateBlindedParticipantId(),
                'updated_at' => $now,
            ],
        );

        $this->audit(
            'participant_registered',
            $campaign,
            $actor,
            $link,
            null,
            [
                'person_id' => $resolvedPersonId,
                'match_status' => $link->match_status,
            ],
        );

        return $link->fresh();
    }

    public function registerContact(
        SurveyHonestBrokerLink $link,
        array $payload,
        ?User $actor = null,
    ): SurveyHonestBrokerContact {
        $email = $this->normalizeEmail($payload['delivery_email'] ?? null);
        $phone = $this->normalizePhone($payload['delivery_phone'] ?? null);
        $preferredChannel = $payload['preferred_channel'] ?? ($email !== null ? 'email' : 'sms');
        $destination = $preferredChannel === 'sms' ? $phone : $email;

        $contact = SurveyHonestBrokerContact::query()->updateOrCreate(
            ['survey_honest_broker_link_id' => $link->id],
            [
                'preferred_channel' => $preferredChannel,
                'delivery_email' => $email,
                'delivery_phone' => $phone,
                'destination_hash' => $destination !== null ? $this->hashIdentifier($destination) : null,
                'updated_by' => $actor?->id,
                'created_by' => $actor?->id,
            ],
        );

        $this->audit(
            'contact_registered',
            $link->campaign,
            $actor,
            $link,
            null,
            [
                'preferred_channel' => $preferredChannel,
                'has_email' => $email !== null,
                'has_phone' => $phone !== null,
            ],
        );

        return $contact->fresh();
    }

    /**
     * @return array{invitation: SurveyHonestBrokerInvitation, survey_url: string}
     */
    public function issueInvitation(
        SurveyCampaign $campaign,
        SurveyHonestBrokerLink $link,
        array $payload,
        ?User $actor = null,
    ): array {
        $contact = $link->contact;

        if ($contact === null) {
            $contact = $this->registerContact($link, $payload, $actor);
        } elseif (isset($payload['delivery_email']) || isset($payload['delivery_phone']) || isset($payload['preferred_channel'])) {
            $contact = $this->registerContact($link, $payload, $actor);
        }

        $deliveryChannel = $payload['preferred_channel'] ?? $contact->preferred_channel;
        $destination = $deliveryChannel === 'sms'
            ? $this->normalizePhone($payload['delivery_phone'] ?? $contact->delivery_phone)
            : $this->normalizeEmail($payload['delivery_email'] ?? $contact->delivery_email);

        if ($deliveryChannel !== 'email') {
            throw new \InvalidArgumentException('Only email invitations are currently supported.');
        }

        if ($destination === null) {
            throw new \InvalidArgumentException('A delivery email is required before sending an invitation.');
        }

        $plainToken = Str::random(64);
        $tokenHash = $this->hashIdentifier($plainToken);

        $invitation = SurveyHonestBrokerInvitation::create([
            'survey_campaign_id' => $campaign->id,
            'survey_honest_broker_link_id' => $link->id,
            'survey_honest_broker_contact_id' => $contact->id,
            'delivery_channel' => $deliveryChannel,
            'destination_hash' => $this->hashIdentifier($destination),
            'one_time_token_hash' => $tokenHash,
            'token_last_four' => substr($plainToken, -4),
            'delivery_status' => 'pending',
            'expires_at' => now()->addDays(14),
            'message_subject' => $campaign->name.' survey invitation',
            'created_by' => $actor?->id,
            'updated_by' => $actor?->id,
        ]);

        $surveyUrl = rtrim((string) config('app.url'), '/').'/survey/'.$plainToken;

        try {
            Mail::to($destination)->send(new SurveyInvitationMail($campaign, $invitation, $surveyUrl));

            $invitation->update([
                'delivery_status' => 'sent',
                'sent_at' => now(),
                'updated_by' => $actor?->id,
            ]);

            $contact->update([
                'last_sent_at' => now(),
                'destination_hash' => $this->hashIdentifier($destination),
                'updated_by' => $actor?->id,
            ]);

            $this->audit(
                'invitation_sent',
                $campaign,
                $actor,
                $link,
                $invitation,
                [
                    'delivery_channel' => $deliveryChannel,
                    'token_last_four' => $invitation->token_last_four,
                ],
            );
        } catch (\Throwable $exception) {
            $invitation->update([
                'delivery_status' => 'failed',
                'last_error' => $exception->getMessage(),
                'updated_by' => $actor?->id,
            ]);

            $this->audit(
                'invitation_failed',
                $campaign,
                $actor,
                $link,
                $invitation,
                [
                    'delivery_channel' => $deliveryChannel,
                    'error' => $exception->getMessage(),
                ],
            );

            throw $exception;
        }

        return [
            'invitation' => $invitation->fresh(['contact', 'link']),
            'survey_url' => $surveyUrl,
        ];
    }

    public function resolveCampaignParticipant(
        SurveyCampaign $campaign,
        string $respondentIdentifier,
    ): ?SurveyHonestBrokerLink {
        return SurveyHonestBrokerLink::query()
            ->where('survey_campaign_id', $campaign->id)
            ->where('respondent_identifier_hash', $this->hashIdentifier($this->normalizeIdentifier($respondentIdentifier)))
            ->first();
    }

    public function resolveInvitation(string $token): ?SurveyHonestBrokerInvitation
    {
        return SurveyHonestBrokerInvitation::query()
            ->where('one_time_token_hash', $this->hashIdentifier($token))
            ->with([
                'campaign.instrument.items.answerOptions',
                'link.contact',
                'link.conduct',
            ])
            ->first();
    }

    public function markOpened(SurveyHonestBrokerInvitation $invitation): SurveyHonestBrokerInvitation
    {
        if ($invitation->opened_at === null) {
            $invitation->update([
                'opened_at' => now(),
                'delivery_status' => $invitation->delivery_status === 'sent' ? 'opened' : $invitation->delivery_status,
            ]);

            $this->audit(
                'invitation_opened',
                $invitation->campaign,
                null,
                $invitation->link,
                $invitation,
                [
                    'token_last_four' => $invitation->token_last_four,
                ],
            );
        }

        return $invitation->fresh(['campaign.instrument.items.answerOptions', 'link.contact', 'link.conduct']);
    }

    public function revokeInvitation(
        SurveyHonestBrokerInvitation $invitation,
        ?User $actor = null,
    ): SurveyHonestBrokerInvitation {
        if ($invitation->submitted_at !== null) {
            throw new \InvalidArgumentException('Submitted invitations cannot be revoked.');
        }

        if ($invitation->revoked_at === null) {
            $invitation->update([
                'revoked_at' => now(),
                'delivery_status' => 'revoked',
                'updated_by' => $actor?->id,
            ]);

            $this->audit(
                'invitation_revoked',
                $invitation->campaign,
                $actor,
                $invitation->link,
                $invitation,
                [
                    'token_last_four' => $invitation->token_last_four,
                ],
            );
        }

        return $invitation->fresh(['contact', 'link']);
    }

    /**
     * @return array{invitation: SurveyHonestBrokerInvitation, survey_url: string}
     */
    public function resendInvitation(
        SurveyHonestBrokerInvitation $invitation,
        ?User $actor = null,
    ): array {
        if ($invitation->submitted_at !== null) {
            throw new \InvalidArgumentException('Submitted invitations cannot be resent.');
        }

        $payload = [
            'preferred_channel' => $invitation->delivery_channel,
            'delivery_email' => $invitation->contact?->delivery_email,
            'delivery_phone' => $invitation->contact?->delivery_phone,
        ];

        return $this->issueInvitation(
            $invitation->campaign->loadMissing('instrument:id'),
            $invitation->link->loadMissing('contact', 'campaign'),
            $payload,
            $actor,
        );
    }

    /**
     * @return Collection<int, SurveyHonestBrokerAuditLog>
     */
    public function listAuditLogs(SurveyCampaign $campaign)
    {
        return $campaign->honestBrokerAuditLogs()
            ->with(['actor:id,name,email', 'link:id,blinded_participant_id', 'invitation:id,token_last_four'])
            ->latest('occurred_at')
            ->get();
    }

    public function markSubmitted(
        SurveyHonestBrokerLink $link,
        SurveyConductRecord $conduct,
        ?SurveyHonestBrokerInvitation $invitation = null,
    ): SurveyHonestBrokerLink {
        $link->update([
            'survey_conduct_id' => $conduct->id,
            'match_status' => $link->person_id !== null ? 'submitted' : $link->match_status,
            'submitted_at' => now(),
        ]);

        if ($invitation !== null) {
            $invitation->update([
                'submitted_at' => now(),
                'delivery_status' => 'submitted',
            ]);
        }

        $this->audit(
            'response_submitted',
            $link->campaign,
            null,
            $link,
            $invitation,
            [
                'conduct_id' => $conduct->id,
            ],
        );

        return $link->fresh(['contact', 'invitations']);
    }

    public function findOrCreateConductRecord(
        SurveyCampaign $campaign,
        SurveyHonestBrokerLink $link,
    ): SurveyConductRecord {
        $existing = SurveyConductRecord::query()
            ->where('campaign_id', $campaign->id)
            ->where('person_id', $link->person_id)
            ->orderByDesc('id')
            ->first();

        if ($existing !== null) {
            return $existing;
        }

        return $campaign->conductRecords()->create([
            'person_id' => $link->person_id,
            'survey_instrument_id' => $campaign->survey_instrument_id,
            'completion_status' => 'pending',
            'survey_start_datetime' => now(),
        ]);
    }

    private function resolvePersonId(SurveyCampaign $campaign, string $normalizedIdentifier): ?int
    {
        $campaign->loadMissing('cohortGeneration.source.daimons');

        $generation = $campaign->cohortGeneration;
        $source = $generation?->source;
        $cdmSchema = $source?->getTableQualifier(DaimonType::CDM);
        $connectionName = $source?->source_connection;

        if ($source === null || $cdmSchema === null || $connectionName === null) {
            return null;
        }

        $row = DB::connection($connectionName)
            ->table("{$cdmSchema}.person")
            ->select('person_id')
            ->whereRaw('LOWER(COALESCE(person_source_value, \'\')) = ?', [mb_strtolower($normalizedIdentifier)])
            ->first();

        return $row?->person_id !== null ? (int) $row->person_id : null;
    }

    private function audit(
        string $action,
        ?SurveyCampaign $campaign,
        ?User $actor = null,
        ?SurveyHonestBrokerLink $link = null,
        ?SurveyHonestBrokerInvitation $invitation = null,
        ?array $metadata = null,
    ): void {
        SurveyHonestBrokerAuditLog::create([
            'survey_campaign_id' => $campaign?->id,
            'survey_honest_broker_link_id' => $link?->id,
            'survey_honest_broker_invitation_id' => $invitation?->id,
            'actor_id' => $actor?->id,
            'action' => $action,
            'metadata' => $metadata,
            'occurred_at' => now(),
        ]);
    }

    private function generateBlindedParticipantId(): string
    {
        return 'HB-'.Str::upper(Str::random(12));
    }

    private function normalizeIdentifier(string $respondentIdentifier): string
    {
        return trim(mb_strtolower($respondentIdentifier));
    }

    private function normalizeEmail(?string $email): ?string
    {
        if ($email === null) {
            return null;
        }

        $trimmed = trim(mb_strtolower($email));

        return $trimmed !== '' ? $trimmed : null;
    }

    private function normalizePhone(?string $phone): ?string
    {
        if ($phone === null) {
            return null;
        }

        $trimmed = preg_replace('/[^0-9+]/', '', $phone);

        return $trimmed !== '' ? $trimmed : null;
    }

    private function hashIdentifier(string $normalizedIdentifier): string
    {
        return hash('sha256', $normalizedIdentifier);
    }
}
