<?php

use App\Models\App\CohortDefinition;
use App\Models\App\ConceptSet;
use App\Models\App\ConceptSetItem;
use App\Models\User;
use App\Services\DesignProtection\DesignFixtureExporter;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    // Point exporter to a temp directory for tests
    config(['design_fixtures.path' => sys_get_temp_dir().'/parthenon-fixtures-test-'.uniqid()]);
    mkdir(config('design_fixtures.path'), 0755, true);
});

afterEach(function () {
    // Clean up temp dir
    $path = config('design_fixtures.path');
    if (is_dir($path)) {
        array_map('unlink', glob("$path/**/*.json") ?: []);
        array_map('rmdir', glob("$path/*") ?: []);
        rmdir($path);
    }
});

it('creates a fixture file when a cohort is exported', function () {
    $user = User::factory()->create();
    $cohort = CohortDefinition::create([
        'name' => 'NSAID Users',
        'expression_json' => ['PrimaryCriteria' => []],
        'author_id' => $user->id,
        'is_public' => false,
    ]);

    $exporter = app(DesignFixtureExporter::class);
    $exporter->exportEntity('cohort_definition', $cohort->id);

    $path = config('design_fixtures.path').'/cohort_definitions/nsaid-users.json';
    expect(file_exists($path))->toBeTrue();

    $data = json_decode(file_get_contents($path), true);
    expect($data['name'])->toBe('NSAID Users')
        ->and($data['id'])->toBe($cohort->id);
});

it('includes concept_set_items in concept set fixtures', function () {
    $user = User::factory()->create();
    $cs = ConceptSet::create([
        'name' => 'Diabetes Drugs',
        'author_id' => $user->id,
        'is_public' => false,
    ]);
    ConceptSetItem::create([
        'concept_set_id' => $cs->id,
        'concept_id' => 1567956,
        'is_excluded' => false,
        'include_descendants' => true,
        'include_mapped' => false,
    ]);

    $exporter = app(DesignFixtureExporter::class);
    $exporter->exportEntity('concept_set', $cs->id);

    $path = config('design_fixtures.path').'/concept_sets/diabetes-drugs.json';
    $data = json_decode(file_get_contents($path), true);

    expect($data['items'])->toHaveCount(1)
        ->and($data['items'][0]['concept_id'])->toBe(1567956);
});

it('handles name collision by appending id to filename', function () {
    $user = User::factory()->create();

    $c1 = CohortDefinition::create(['name' => 'Same Name', 'expression_json' => [], 'author_id' => $user->id, 'is_public' => false]);
    $c2 = CohortDefinition::create(['name' => 'Same Name', 'expression_json' => [], 'author_id' => $user->id, 'is_public' => false]);

    $exporter = app(DesignFixtureExporter::class);
    $exporter->exportEntity('cohort_definition', $c1->id);
    $exporter->exportEntity('cohort_definition', $c2->id);

    expect(file_exists(config('design_fixtures.path').'/cohort_definitions/same-name.json'))->toBeTrue();
    expect(file_exists(config('design_fixtures.path').'/cohort_definitions/same-name-'.$c2->id.'.json'))->toBeTrue();
});

it('exportAll returns correct written count', function () {
    $user = User::factory()->create();
    CohortDefinition::create(['name' => 'A', 'expression_json' => [], 'author_id' => $user->id, 'is_public' => false]);
    CohortDefinition::create(['name' => 'B', 'expression_json' => [], 'author_id' => $user->id, 'is_public' => false]);

    $exporter = app(DesignFixtureExporter::class);
    $summary = $exporter->exportAll();

    expect($summary->written)->toBeGreaterThanOrEqual(2)
        ->and($summary->errors)->toBeEmpty();
});

it('preserves underscores as word boundaries in slugs', function () {
    $user = User::factory()->create();
    $cohort = CohortDefinition::create([
        'name' => 'AB1_AFRICAN_TRYPANOSOMIASIS_WIDE',
        'expression_json' => [],
        'author_id' => $user->id,
        'is_public' => false,
    ]);

    $exporter = app(DesignFixtureExporter::class);
    $exporter->exportEntity('cohort_definition', $cohort->id);

    expect(file_exists(config('design_fixtures.path').'/cohort_definitions/ab1-african-trypanosomiasis-wide.json'))
        ->toBeTrue();
});

it('exportAll prunes orphan fixture files whose id is no longer in the DB', function () {
    $user = User::factory()->create();
    $live = CohortDefinition::create(['name' => 'Live', 'expression_json' => [], 'author_id' => $user->id, 'is_public' => false]);

    $exporter = app(DesignFixtureExporter::class);
    $exporter->exportEntity('cohort_definition', $live->id);

    // Plant an orphan file with a fake id that does not exist in the DB
    $dir = config('design_fixtures.path').'/cohort_definitions';
    $orphanPath = $dir.'/orphan-from-old-table.json';
    file_put_contents($orphanPath, json_encode(['id' => 999_999, 'name' => 'Orphan']));
    $malformedPath = $dir.'/malformed-no-id.json';
    file_put_contents($malformedPath, json_encode(['name' => 'No ID Field']));

    $summary = $exporter->exportAll();

    expect(file_exists($orphanPath))->toBeFalse()
        ->and(file_exists($malformedPath))->toBeFalse()
        ->and($summary->deleted)->toBeGreaterThanOrEqual(2)
        ->and(file_exists($dir.'/live.json'))->toBeTrue();
});

it('removes stale alias files when a row is renamed or its id is recycled', function () {
    $user = User::factory()->create();
    $cohort = CohortDefinition::create([
        'name' => 'Current Name',
        'expression_json' => [],
        'author_id' => $user->id,
        'is_public' => false,
    ]);

    // Plant a stale file pointing at the same id under a different name
    // (simulates a rename or recycled auto-increment id from a prior occupant).
    $dir = config('design_fixtures.path').'/cohort_definitions';
    mkdir($dir, 0755, true);
    $stale = $dir.'/old-name-from-prior-occupant.json';
    file_put_contents($stale, json_encode(['id' => $cohort->id, 'name' => 'Old Name']));

    $exporter = app(DesignFixtureExporter::class);
    $exporter->exportEntity('cohort_definition', $cohort->id);

    expect(file_exists($stale))->toBeFalse()
        ->and(file_exists($dir.'/current-name.json'))->toBeTrue();
});

it('exportAll does not prune when DB returns zero rows for an entity type', function () {
    // No cohort_definitions in DB. Plant a file that would normally look orphaned.
    $dir = config('design_fixtures.path').'/cohort_definitions';
    mkdir($dir, 0755, true);
    $survivor = $dir.'/should-survive.json';
    file_put_contents($survivor, json_encode(['id' => 42, 'name' => 'Survivor']));

    $exporter = app(DesignFixtureExporter::class);
    $summary = $exporter->exportAll();

    expect(file_exists($survivor))->toBeTrue()
        ->and($summary->deleted)->toBe(0);
});
