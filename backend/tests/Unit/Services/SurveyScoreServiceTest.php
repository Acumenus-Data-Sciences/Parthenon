<?php

use App\Models\Survey\SurveyConductRecord;
use App\Models\Survey\SurveyInstrument;
use App\Models\Survey\SurveyItem;
use App\Models\Survey\SurveyResponse;
use App\Services\Survey\SurveyScoreService;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

function makeInstrumentWithResponses(array $scoringMethod, array $items): SurveyConductRecord
{
    $instrument = SurveyInstrument::create([
        'name' => 'Test Instrument',
        'abbreviation' => 'TST_'.str()->upper(str()->random(6)),
        'version' => '1.0',
        'domain' => 'mental_health',
        'item_count' => count($items),
        'scoring_method' => $scoringMethod,
        'license_type' => 'public',
        'is_public_domain' => true,
        'is_active' => true,
        'omop_coverage' => 'no',
    ]);

    $conduct = SurveyConductRecord::create([
        'person_id' => 1001,
        'survey_instrument_id' => $instrument->id,
        'completion_status' => 'complete',
    ]);

    foreach ($items as $index => $itemConfig) {
        $item = SurveyItem::create([
            'survey_instrument_id' => $instrument->id,
            'item_number' => $index + 1,
            'item_text' => 'Item '.($index + 1),
            'response_type' => 'likert',
            'subscale_name' => $itemConfig['subscale_name'] ?? null,
            'is_reverse_coded' => $itemConfig['is_reverse_coded'] ?? false,
            'min_value' => $itemConfig['min_value'] ?? 0,
            'max_value' => $itemConfig['max_value'] ?? 4,
            'display_order' => $index + 1,
        ]);

        SurveyResponse::create([
            'survey_conduct_id' => $conduct->id,
            'survey_item_id' => $item->id,
            'value_as_number' => $itemConfig['response'],
        ]);
    }

    return $conduct->fresh();
}

it('computes sum score for likert responses', function () {
    $conduct = makeInstrumentWithResponses(
        ['type' => 'sum', 'range' => [0, 12]],
        [
            ['response' => 1],
            ['response' => 2],
            ['response' => 3],
        ],
    );

    $scores = app(SurveyScoreService::class)->compute($conduct);

    expect($scores['total_score'])->toBe(6.0)
        ->and($scores['subscale_scores'])->toBe([]);
});

it('computes mean score for likert responses', function () {
    $conduct = makeInstrumentWithResponses(
        ['type' => 'mean', 'range' => [0, 4]],
        [
            ['response' => 1],
            ['response' => 2],
            ['response' => 3],
        ],
    );

    $scores = app(SurveyScoreService::class)->compute($conduct);

    expect($scores['total_score'])->toBe(2.0);
});

it('applies reverse coding using item min and max values', function () {
    $conduct = makeInstrumentWithResponses(
        ['type' => 'sum'],
        [
            ['response' => 1, 'is_reverse_coded' => true, 'min_value' => 0, 'max_value' => 4],
        ],
    );

    $scores = app(SurveyScoreService::class)->compute($conduct);

    expect($scores['total_score'])->toBe(3.0);
});

it('computes subscale scores independently', function () {
    $conduct = makeInstrumentWithResponses(
        ['type' => 'sum'],
        [
            ['response' => 1, 'subscale_name' => 'mood'],
            ['response' => 2, 'subscale_name' => 'mood'],
            ['response' => 3, 'subscale_name' => 'sleep'],
        ],
    );

    $scores = app(SurveyScoreService::class)->compute($conduct);

    expect($scores['total_score'])->toBe(6.0)
        ->and($scores['subscale_scores'])->toMatchArray([
            'mood' => 3.0,
            'sleep' => 3.0,
        ]);
});
