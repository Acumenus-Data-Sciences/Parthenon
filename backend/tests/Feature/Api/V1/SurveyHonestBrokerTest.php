<?php

use App\Mail\SurveyInvitationMail;
use App\Models\Survey\SurveyAnswerOption;
use App\Models\Survey\SurveyCampaign;
use App\Models\Survey\SurveyConductRecord;
use App\Models\Survey\SurveyHonestBrokerInvitation;
use App\Models\Survey\SurveyHonestBrokerLink;
use App\Models\Survey\SurveyInstrument;
use App\Models\Survey\SurveyItem;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(RolePermissionSeeder::class);
});

function brokerUser(): User
{
    $user = User::factory()->create();
    $user->assignRole('data-steward');

    return $user;
}

function surveyResearcherUser(): User
{
    $user = User::factory()->create();
    $user->assignRole('researcher');

    return $user;
}

function brokerInstrument(): SurveyInstrument
{
    return SurveyInstrument::create([
        'name' => 'PROMIS Fatigue',
        'abbreviation' => 'PROMIS_'.str()->upper(str()->random(5)),
        'version' => '1.0',
        'domain' => 'general_health',
        'item_count' => 1,
        'scoring_method' => ['type' => 'sum'],
        'license_type' => 'public',
        'is_public_domain' => true,
        'is_active' => true,
        'omop_coverage' => 'yes',
    ]);
}

function brokerItem(SurveyInstrument $instrument): SurveyItem
{
    $item = SurveyItem::create([
        'survey_instrument_id' => $instrument->id,
        'item_number' => 1,
        'item_text' => 'How tired are you today?',
        'response_type' => 'likert',
        'display_order' => 1,
    ]);

    SurveyAnswerOption::create([
        'survey_item_id' => $item->id,
        'option_text' => 'Not at all',
        'option_value' => 0,
        'display_order' => 1,
    ]);

    SurveyAnswerOption::create([
        'survey_item_id' => $item->id,
        'option_text' => 'A little',
        'option_value' => 1,
        'display_order' => 2,
    ]);

    return $item;
}

it('allows a data steward to register a broker-linked respondent', function () {
    $user = brokerUser();
    $campaign = SurveyCampaign::create([
        'name' => 'Brokered Campaign',
        'survey_instrument_id' => brokerInstrument()->id,
        'status' => 'active',
        'publish_token' => str_repeat('c', 64),
        'requires_honest_broker' => true,
    ]);

    $this->actingAs($user)
        ->postJson("/api/v1/survey-campaigns/{$campaign->id}/honest-broker-links", [
            'respondent_identifier' => 'MRN-001',
            'person_id' => 12345,
            'notes' => 'Matched from protected roster',
        ])
        ->assertCreated()
        ->assertJsonPath('data.person_id', 12345)
        ->assertJsonPath('data.match_status', 'matched');

    $this->assertDatabaseHas('survey_honest_broker_links', [
        'survey_campaign_id' => $campaign->id,
        'person_id' => 12345,
        'match_status' => 'matched',
    ]);
});

it('blocks researchers from broker registration endpoints', function () {
    $user = surveyResearcherUser();
    $campaign = SurveyCampaign::create([
        'name' => 'Restricted Campaign',
        'survey_instrument_id' => brokerInstrument()->id,
        'status' => 'active',
    ]);

    $this->actingAs($user)
        ->postJson("/api/v1/survey-campaigns/{$campaign->id}/honest-broker-links", [
            'respondent_identifier' => 'MRN-002',
            'person_id' => 777,
        ])
        ->assertForbidden();
});

it('requires broker registration before public submission when campaign is protected', function () {
    $instrument = brokerInstrument();
    $item = brokerItem($instrument);
    $campaign = SurveyCampaign::create([
        'name' => 'Protected Survey',
        'survey_instrument_id' => $instrument->id,
        'status' => 'active',
        'publish_token' => str_repeat('d', 64),
        'requires_honest_broker' => true,
    ]);

    $this->postJson("/api/v1/survey-public/{$campaign->publish_token}/responses", [
        'respondent_identifier' => 'MRN-NOT-REGISTERED',
        'responses' => [
            [
                'survey_item_id' => $item->id,
                'value' => 'A little',
            ],
        ],
    ])->assertStatus(422)
        ->assertJsonPath('message', 'Respondent is not registered with the honest broker for this campaign.');
});

it('attaches public responses to the broker-linked person without exposing raw identifiers', function () {
    $instrument = brokerInstrument();
    $item = brokerItem($instrument);
    $campaign = SurveyCampaign::create([
        'name' => 'Linked Survey',
        'survey_instrument_id' => $instrument->id,
        'status' => 'active',
        'publish_token' => str_repeat('e', 64),
        'requires_honest_broker' => true,
    ]);

    $conduct = SurveyConductRecord::create([
        'person_id' => 98765,
        'survey_instrument_id' => $instrument->id,
        'campaign_id' => $campaign->id,
        'completion_status' => 'pending',
    ]);

    $link = SurveyHonestBrokerLink::create([
        'survey_campaign_id' => $campaign->id,
        'survey_conduct_id' => $conduct->id,
        'person_id' => 98765,
        'blinded_participant_id' => 'HB-TEST-0001',
        'respondent_identifier_hash' => hash('sha256', 'mrn-123'),
        'respondent_identifier' => 'mrn-123',
        'match_status' => 'matched',
    ]);

    $this->postJson("/api/v1/survey-public/{$campaign->publish_token}/responses", [
        'respondent_identifier' => 'MRN-123',
        'responses' => [
            [
                'survey_item_id' => $item->id,
                'value' => 'A little',
            ],
        ],
    ])->assertCreated()
        ->assertJsonPath('data.conduct_id', $conduct->id)
        ->assertJsonPath('data.blinded_participant_id', 'HB-TEST-0001');

    $conduct->refresh();
    $link->refresh();

    expect($conduct->person_id)->toBe(98765)
        ->and($conduct->completion_status)->toBe('complete')
        ->and($conduct->source_identifier)->toBeNull()
        ->and($link->survey_conduct_id)->toBe($conduct->id)
        ->and($link->match_status)->toBe('submitted');
});

it('sends a broker-managed email invitation and records the invitation ledger', function () {
    Mail::fake();

    $user = brokerUser();
    $campaign = SurveyCampaign::create([
        'name' => 'Invitation Campaign',
        'survey_instrument_id' => brokerInstrument()->id,
        'status' => 'active',
        'publish_token' => str_repeat('f', 64),
        'requires_honest_broker' => true,
    ]);

    $link = SurveyHonestBrokerLink::create([
        'survey_campaign_id' => $campaign->id,
        'person_id' => 24680,
        'blinded_participant_id' => 'HB-INVITE-0001',
        'respondent_identifier_hash' => hash('sha256', 'mrn-24680'),
        'respondent_identifier' => 'mrn-24680',
        'match_status' => 'matched',
    ]);

    $response = $this->actingAs($user)
        ->postJson("/api/v1/survey-campaigns/{$campaign->id}/honest-broker-invitations", [
            'survey_honest_broker_link_id' => $link->id,
            'delivery_email' => 'patient@example.org',
            'preferred_channel' => 'email',
        ])
        ->assertCreated()
        ->assertJsonPath('data.invitation.delivery_status', 'sent')
        ->assertJsonPath('data.invitation.link.blinded_participant_id', 'HB-INVITE-0001');

    $invitationId = $response->json('data.invitation.id');

    expect($invitationId)->not->toBeNull();

    Mail::assertSent(SurveyInvitationMail::class);

    $this->assertDatabaseHas('survey_honest_broker_contacts', [
        'survey_honest_broker_link_id' => $link->id,
        'preferred_channel' => 'email',
    ]);

    $this->assertDatabaseHas('survey_honest_broker_invitations', [
        'id' => $invitationId,
        'survey_campaign_id' => $campaign->id,
        'survey_honest_broker_link_id' => $link->id,
        'delivery_status' => 'sent',
    ]);
});

it('accepts one-time invitation tokens without requiring respondent identifiers', function () {
    $instrument = brokerInstrument();
    $item = brokerItem($instrument);
    $campaign = SurveyCampaign::create([
        'name' => 'Invite Token Survey',
        'survey_instrument_id' => $instrument->id,
        'status' => 'active',
        'publish_token' => str_repeat('g', 64),
        'requires_honest_broker' => true,
    ]);

    $conduct = SurveyConductRecord::create([
        'person_id' => 54321,
        'survey_instrument_id' => $instrument->id,
        'campaign_id' => $campaign->id,
        'completion_status' => 'pending',
    ]);

    $link = SurveyHonestBrokerLink::create([
        'survey_campaign_id' => $campaign->id,
        'survey_conduct_id' => $conduct->id,
        'person_id' => 54321,
        'blinded_participant_id' => 'HB-INVITE-0002',
        'respondent_identifier_hash' => hash('sha256', 'mrn-54321'),
        'respondent_identifier' => 'mrn-54321',
        'match_status' => 'matched',
    ]);

    $plainToken = str_repeat('t', 64);
    $invitation = SurveyHonestBrokerInvitation::create([
        'survey_campaign_id' => $campaign->id,
        'survey_honest_broker_link_id' => $link->id,
        'delivery_channel' => 'email',
        'destination_hash' => hash('sha256', 'patient@example.org'),
        'one_time_token_hash' => hash('sha256', $plainToken),
        'token_last_four' => substr($plainToken, -4),
        'delivery_status' => 'sent',
        'sent_at' => now(),
        'expires_at' => now()->addDay(),
    ]);

    $this->getJson("/api/v1/survey-public/{$plainToken}")
        ->assertOk()
        ->assertJsonPath('data.requires_respondent_identifier', false)
        ->assertJsonPath('data.blinded_participant_id', 'HB-INVITE-0002');

    $this->postJson("/api/v1/survey-public/{$plainToken}/responses", [
        'responses' => [
            [
                'survey_item_id' => $item->id,
                'value' => 'A little',
            ],
        ],
    ])->assertCreated()
        ->assertJsonPath('data.conduct_id', $conduct->id)
        ->assertJsonPath('data.blinded_participant_id', 'HB-INVITE-0002');

    $invitation->refresh();
    $link->refresh();

    expect($invitation->delivery_status)->toBe('submitted')
        ->and($invitation->submitted_at)->not->toBeNull()
        ->and($link->match_status)->toBe('submitted');
});

it('allows resending and revoking broker invitations and exposes the audit log', function () {
    Mail::fake();

    $user = brokerUser();
    $campaign = SurveyCampaign::create([
        'name' => 'Lifecycle Campaign',
        'survey_instrument_id' => brokerInstrument()->id,
        'status' => 'active',
        'publish_token' => str_repeat('h', 64),
        'requires_honest_broker' => true,
    ]);

    $link = SurveyHonestBrokerLink::create([
        'survey_campaign_id' => $campaign->id,
        'person_id' => 112233,
        'blinded_participant_id' => 'HB-LIFECYCLE-0001',
        'respondent_identifier_hash' => hash('sha256', 'mrn-112233'),
        'respondent_identifier' => 'mrn-112233',
        'match_status' => 'matched',
    ]);

    $sendResponse = $this->actingAs($user)
        ->postJson("/api/v1/survey-campaigns/{$campaign->id}/honest-broker-invitations", [
            'survey_honest_broker_link_id' => $link->id,
            'delivery_email' => 'patient2@example.org',
            'preferred_channel' => 'email',
        ])
        ->assertCreated();

    $invitationId = $sendResponse->json('data.invitation.id');

    Mail::assertSent(SurveyInvitationMail::class, 1);

    $this->actingAs($user)
        ->postJson("/api/v1/survey-campaigns/{$campaign->id}/honest-broker-invitations/{$invitationId}/resend")
        ->assertOk()
        ->assertJsonPath('data.invitation.delivery_status', 'sent');

    Mail::assertSent(SurveyInvitationMail::class, 2);

    $this->actingAs($user)
        ->postJson("/api/v1/survey-campaigns/{$campaign->id}/honest-broker-invitations/{$invitationId}/revoke")
        ->assertOk()
        ->assertJsonPath('data.delivery_status', 'revoked');

    $logs = $this->actingAs($user)
        ->getJson("/api/v1/survey-campaigns/{$campaign->id}/honest-broker-audit-logs")
        ->assertOk()
        ->json('data');

    expect(collect($logs)->pluck('action')->all())
        ->toContain('invitation_sent')
        ->toContain('invitation_revoked');
});
