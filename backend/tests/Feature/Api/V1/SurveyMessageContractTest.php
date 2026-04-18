<?php

use App\Models\Survey\SurveyAnswerOption;
use App\Models\Survey\SurveyCampaign;
use App\Models\Survey\SurveyInstrument;
use App\Models\Survey\SurveyItem;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(RolePermissionSeeder::class);
});

function surveyContractUser(string $locale = 'en-US'): User
{
    $user = User::factory()->create(['locale' => $locale]);
    $user->assignRole('researcher');

    return $user;
}

function surveyContractInstrument(): SurveyInstrument
{
    return SurveyInstrument::create([
        'name' => 'PROMIS Fatigue',
        'abbreviation' => 'PROMIS_CONTRACT_'.str()->upper(str()->random(5)),
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

function surveyContractItem(SurveyInstrument $instrument): SurveyItem
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
        'option_text' => 'A little',
        'option_value' => 1,
        'display_order' => 1,
    ]);

    return $item;
}

it('localizes public survey inactive-link errors from locale headers', function () {
    $this->withHeader('X-Parthenon-Locale', 'ko-KR')
        ->getJson('/api/v1/survey-public/not-a-real-token')
        ->assertNotFound()
        ->assertJsonPath('message_key', 'survey.public.link_inactive')
        ->assertJsonPath('message_meta.requested_locale', 'ko-KR')
        ->assertJsonPath('message_meta.message_locale', 'ko-KR')
        ->assertJsonPath('message_meta.fallback_used', false);
});

it('localizes protected public survey submission errors', function () {
    $instrument = surveyContractInstrument();
    $item = surveyContractItem($instrument);
    $campaign = SurveyCampaign::create([
        'name' => 'Protected Survey',
        'survey_instrument_id' => $instrument->id,
        'status' => 'active',
        'publish_token' => str_repeat('s', 64),
        'requires_honest_broker' => true,
    ]);

    $this->withHeader('X-Parthenon-Locale', 'es-ES')
        ->postJson("/api/v1/survey-public/{$campaign->publish_token}/responses", [
            'respondent_identifier' => 'MRN-NOT-REGISTERED',
            'responses' => [
                [
                    'survey_item_id' => $item->id,
                    'value' => 'A little',
                ],
            ],
        ])
        ->assertStatus(422)
        ->assertJsonPath('message', 'La persona encuestada no está registrada con el intermediario honesto para esta campaña.')
        ->assertJsonPath('message_key', 'survey.public.respondent_not_registered')
        ->assertJsonPath('message_meta.requested_locale', 'es-ES')
        ->assertJsonPath('message_meta.message_locale', 'es-ES')
        ->assertJsonPath('message_meta.fallback_used', false);
});

it('localizes authenticated survey campaign state errors from user preference', function () {
    $user = surveyContractUser('ko-KR');
    $token = $user->createToken('survey-contract-test')->plainTextToken;
    $campaign = SurveyCampaign::create([
        'name' => 'Already Active',
        'survey_instrument_id' => surveyContractInstrument()->id,
        'status' => 'active',
        'publish_token' => str_repeat('t', 64),
    ]);

    $this->withHeader('Authorization', "Bearer {$token}")
        ->postJson("/api/v1/survey-campaigns/{$campaign->id}/activate")
        ->assertStatus(422)
        ->assertJsonPath('message', '초안 상태의 캠페인만 활성화할 수 있습니다.')
        ->assertJsonPath('message_key', 'survey.campaigns.activate_draft_only')
        ->assertJsonPath('message_meta.requested_locale', 'ko-KR')
        ->assertJsonPath('message_meta.message_locale', 'ko-KR')
        ->assertJsonPath('message_meta.fallback_used', false);
});
