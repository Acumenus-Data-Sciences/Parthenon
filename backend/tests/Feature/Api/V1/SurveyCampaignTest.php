<?php

use App\Models\Survey\SurveyCampaign;
use App\Models\Survey\SurveyConductRecord;
use App\Models\Survey\SurveyInstrument;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(RolePermissionSeeder::class);
});

function researcherUser(): User
{
    $user = User::factory()->create();
    $user->assignRole('researcher');

    return $user;
}

function surveyAdminUser(): User
{
    $user = User::factory()->create();
    $user->assignRole('admin');

    return $user;
}

function surveyInstrument(): SurveyInstrument
{
    return SurveyInstrument::create([
        'name' => 'PHQ-9',
        'abbreviation' => 'PHQ9_'.str()->upper(str()->random(5)),
        'version' => '1.0',
        'domain' => 'mental_health',
        'item_count' => 9,
        'scoring_method' => ['type' => 'sum'],
        'license_type' => 'public',
        'is_public_domain' => true,
        'is_active' => true,
        'omop_coverage' => 'yes',
    ]);
}

function makeCampaignWithStats(SurveyInstrument $instrument): SurveyCampaign
{
    $campaign = SurveyCampaign::create([
        'name' => 'Spring PHQ-9',
        'survey_instrument_id' => $instrument->id,
        'status' => 'draft',
    ]);

    SurveyConductRecord::create([
        'person_id' => 101,
        'survey_instrument_id' => $instrument->id,
        'campaign_id' => $campaign->id,
        'completion_status' => 'complete',
    ]);

    SurveyConductRecord::create([
        'person_id' => 102,
        'survey_instrument_id' => $instrument->id,
        'campaign_id' => $campaign->id,
        'completion_status' => 'pending',
    ]);

    SurveyConductRecord::create([
        'person_id' => null,
        'survey_instrument_id' => $instrument->id,
        'campaign_id' => $campaign->id,
        'completion_status' => 'complete',
    ]);

    return $campaign;
}

it('lists campaigns', function () {
    $user = researcherUser();
    $instrument = surveyInstrument();
    SurveyCampaign::create([
        'name' => 'List Me',
        'survey_instrument_id' => $instrument->id,
        'created_by' => $user->id,
    ]);

    $response = $this->actingAs($user)->getJson('/api/v1/survey-campaigns');

    $response->assertOk()
        ->assertJsonPath('data.0.name', 'List Me');
});

it('creates a campaign', function () {
    $user = researcherUser();
    $instrument = surveyInstrument();

    $response = $this->actingAs($user)->postJson('/api/v1/survey-campaigns', [
        'name' => 'New Campaign',
        'survey_instrument_id' => $instrument->id,
        'description' => 'Quarterly administration',
    ]);

    $response->assertCreated()
        ->assertJsonPath('name', 'New Campaign')
        ->assertJsonPath('created_by', $user->id);

    $this->assertDatabaseHas('survey_campaigns', [
        'name' => 'New Campaign',
        'survey_instrument_id' => $instrument->id,
    ]);
});

it('shows a campaign with stats', function () {
    $user = researcherUser();
    $campaign = makeCampaignWithStats(surveyInstrument());

    $response = $this->actingAs($user)->getJson("/api/v1/survey-campaigns/{$campaign->id}");

    $response->assertOk()
        ->assertJsonPath('name', 'Spring PHQ-9')
        ->assertJsonPath('stats.seeded_total', 2)
        ->assertJsonPath('stats.complete', 1)
        ->assertJsonPath('stats.pending', 1)
        ->assertJsonPath('stats.anonymous', 1)
        ->assertJsonPath('stats.completion_rate', 50);
});

it('updates a draft campaign', function () {
    $user = researcherUser();
    $campaign = SurveyCampaign::create([
        'name' => 'Initial Name',
        'survey_instrument_id' => surveyInstrument()->id,
        'status' => 'draft',
    ]);

    $this->actingAs($user)->putJson("/api/v1/survey-campaigns/{$campaign->id}", [
        'name' => 'Updated Name',
        'survey_instrument_id' => $campaign->survey_instrument_id,
        'description' => 'Updated description',
    ])->assertOk()
        ->assertJsonPath('name', 'Updated Name');
});

it('deletes a campaign', function () {
    $user = surveyAdminUser();
    $campaign = SurveyCampaign::create([
        'name' => 'Delete Me',
        'survey_instrument_id' => surveyInstrument()->id,
    ]);

    $this->actingAs($user)
        ->deleteJson("/api/v1/survey-campaigns/{$campaign->id}")
        ->assertNoContent();

    $this->assertDatabaseMissing('survey_campaigns', ['id' => $campaign->id]);
});

it('activates a draft campaign and generates a publish token', function () {
    $user = researcherUser();
    $campaign = SurveyCampaign::create([
        'name' => 'Activate Me',
        'survey_instrument_id' => surveyInstrument()->id,
        'status' => 'draft',
    ]);

    $response = $this->actingAs($user)
        ->postJson("/api/v1/survey-campaigns/{$campaign->id}/activate");

    $response->assertOk()
        ->assertJsonPath('status', 'active');

    expect($response->json('publish_token'))->toBeString()->toHaveLength(64);
});

it('closes an active campaign', function () {
    $user = researcherUser();
    $campaign = SurveyCampaign::create([
        'name' => 'Close Me',
        'survey_instrument_id' => surveyInstrument()->id,
        'status' => 'active',
        'publish_token' => str_repeat('a', 64),
    ]);

    $this->actingAs($user)
        ->postJson("/api/v1/survey-campaigns/{$campaign->id}/close")
        ->assertOk()
        ->assertJsonPath('status', 'closed');

    expect(SurveyCampaign::find($campaign->id)?->closed_at)->not->toBeNull();
});

it('returns campaign stats with completion counts', function () {
    $user = researcherUser();
    $campaign = makeCampaignWithStats(surveyInstrument());

    $this->actingAs($user)
        ->getJson("/api/v1/survey-campaigns/{$campaign->id}/stats")
        ->assertOk()
        ->assertJsonPath('seeded_total', 2)
        ->assertJsonPath('complete', 1)
        ->assertJsonPath('pending', 1)
        ->assertJsonPath('anonymous', 1)
        ->assertJsonPath('completion_rate', 50);
});

it('rejects activation of already active campaign', function () {
    $user = researcherUser();
    $campaign = SurveyCampaign::create([
        'name' => 'Already Active',
        'survey_instrument_id' => surveyInstrument()->id,
        'status' => 'active',
        'publish_token' => str_repeat('b', 64),
    ]);

    $this->actingAs($user)
        ->postJson("/api/v1/survey-campaigns/{$campaign->id}/activate")
        ->assertStatus(422)
        ->assertJsonPath('message', 'Only draft campaigns can be activated.');
});
