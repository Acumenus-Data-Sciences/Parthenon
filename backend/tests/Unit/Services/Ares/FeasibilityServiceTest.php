<?php

declare(strict_types=1);

use App\Enums\DaimonType;
use App\Models\App\Source;
use App\Models\App\SourceDaimon;
use App\Models\User;
use App\Services\Ares\FeasibilityService;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->service = app(FeasibilityService::class);
});

function createSourceWithDaimon(): Source
{
    $source = Source::factory()->create();
    SourceDaimon::create([
        'source_id' => $source->id,
        'daimon_type' => DaimonType::Results->value,
        'table_qualifier' => 'results',
        'priority' => 1,
    ]);

    return $source;
}

it('creates an assessment and stores results', function () {
    $user = User::factory()->create();
    createSourceWithDaimon();
    createSourceWithDaimon();

    $criteria = [
        'required_domains' => ['condition', 'drug'],
        'min_patients' => 100,
    ];

    $assessment = $this->service->assess($user, 'Test Study', $criteria);

    expect($assessment->name)->toBe('Test Study');
    expect($assessment->sources_assessed)->toBe(2);
    $this->assertDatabaseHas('feasibility_assessments', [
        'name' => 'Test Study',
        'created_by' => $user->id,
    ]);
});

it('stores per-source results for each source', function () {
    $user = User::factory()->create();
    createSourceWithDaimon();
    createSourceWithDaimon();
    createSourceWithDaimon();

    $criteria = [
        'required_domains' => ['condition'],
    ];

    $assessment = $this->service->assess($user, 'Domain Check', $criteria);

    expect($assessment->sources_assessed)->toBe(3);
    $this->assertDatabaseCount('feasibility_assessment_results', 3);
});

it('returns assessment with results when loaded', function () {
    $user = User::factory()->create();
    createSourceWithDaimon();

    $assessment = $this->service->assess($user, 'Test', ['required_domains' => ['condition']]);
    $loaded = $this->service->getAssessment($assessment->id);

    expect($loaded)->not->toBeNull();
    expect($loaded->name)->toBe('Test');
    expect($loaded->results)->toHaveCount(1);
});

it('returns null for nonexistent assessment', function () {
    $loaded = $this->service->getAssessment(99999);

    expect($loaded)->toBeNull();
});

it('lists assessments ordered by most recent first', function () {
    $user = User::factory()->create();
    createSourceWithDaimon();

    $this->service->assess($user, 'First', ['required_domains' => ['condition']]);
    // Ensure different timestamps
    $this->travel(1)->seconds();
    $this->service->assess($user, 'Second', ['required_domains' => ['drug']]);

    $list = $this->service->listAssessments();

    expect($list)->toHaveCount(2);
    expect($list[0]->name)->toBe('Second');
});
