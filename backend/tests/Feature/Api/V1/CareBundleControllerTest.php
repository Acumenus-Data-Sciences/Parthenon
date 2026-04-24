<?php

declare(strict_types=1);

use App\Jobs\CareBundles\MaterializeAllCareBundlesJob;
use App\Jobs\CareBundles\MaterializeCareBundleJob;
use App\Models\App\CareBundleMeasureResult;
use App\Models\App\CareBundleRun;
use App\Models\App\ConditionBundle;
use App\Models\App\QualityMeasure;
use App\Models\App\Source;
use App\Models\User;
use App\Services\CareBundles\CareBundleMeasureEvaluator;
use App\Services\CareBundles\Evaluators\CohortBasedMeasureEvaluator;
use App\Services\CareBundles\Evaluators\CqlMeasureEvaluator;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(RolePermissionSeeder::class);
});

function makeBundleWithMeasures(): ConditionBundle
{
    $bundle = ConditionBundle::create([
        'bundle_code' => 'HTN',
        'condition_name' => 'Hypertension',
        'description' => 'Essential hypertension care bundle',
        'icd10_patterns' => ['I10'],
        'omop_concept_ids' => [320128, 316866],
        'bundle_size' => 2,
        'disease_category' => 'cardiovascular',
        'is_active' => true,
    ]);

    $measure = QualityMeasure::create([
        'measure_code' => 'HTN-01',
        'measure_name' => 'BP Control <140/90',
        'measure_type' => 'chronic',
        'domain' => 'measurement',
        'numerator_criteria' => ['concept_ids' => [3004249], 'lookback_days' => 365],
        'denominator_criteria' => null,
        'exclusion_criteria' => null,
        'frequency' => 'annually',
        'is_active' => true,
    ]);

    $bundle->measures()->attach($measure->id, ['ordinal' => 0]);

    return $bundle->fresh(['measures']);
}

it('requires authentication to view coverage matrix', function () {
    $this->getJson('/api/v1/care-bundles/coverage')
        ->assertStatus(401);
});

it('returns an empty coverage matrix before any runs exist', function () {
    $user = User::factory()->create();
    $user->assignRole('viewer');

    $this->actingAs($user)
        ->getJson('/api/v1/care-bundles/coverage')
        ->assertStatus(200)
        ->assertJsonPath('data', []);
});

it('dispatches MaterializeCareBundleJob on materialize', function () {
    Queue::fake();

    $user = User::factory()->create();
    $user->assignRole('data-steward');

    $bundle = makeBundleWithMeasures();
    $source = Source::factory()->create();

    $this->actingAs($user)
        ->postJson("/api/v1/care-bundles/{$bundle->id}/materialize", [
            'source_id' => $source->id,
        ])
        ->assertStatus(202)
        ->assertJsonPath('data.status', 'queued');

    Queue::assertPushed(MaterializeCareBundleJob::class, function ($job) use ($bundle, $source) {
        return $job->bundle->id === $bundle->id
            && $job->source->id === $source->id
            && $job->trigger === 'manual';
    });
});

it('denies materialize to researchers (not their scope)', function () {
    Queue::fake();

    $user = User::factory()->create();
    $user->assignRole('researcher');

    $bundle = makeBundleWithMeasures();
    $source = Source::factory()->create();

    $this->actingAs($user)
        ->postJson("/api/v1/care-bundles/{$bundle->id}/materialize", [
            'source_id' => $source->id,
        ])
        ->assertStatus(403);

    Queue::assertNothingPushed();
});

it('dispatches MaterializeAllCareBundlesJob on materialize-all', function () {
    Queue::fake();

    $user = User::factory()->create();
    $user->assignRole('data-steward');

    $this->actingAs($user)
        ->postJson('/api/v1/care-bundles/materialize-all')
        ->assertStatus(202)
        ->assertJsonPath('data.status', 'queued');

    Queue::assertPushed(MaterializeAllCareBundlesJob::class);
});

it('returns qualification shell with zeros when no run exists', function () {
    $user = User::factory()->create();
    $user->assignRole('viewer');

    $bundle = makeBundleWithMeasures();
    $source = Source::factory()->create();

    $this->actingAs($user)
        ->getJson("/api/v1/care-bundles/{$bundle->id}/qualifications?source_id={$source->id}")
        ->assertStatus(200)
        ->assertJsonPath('data.bundle_id', $bundle->id)
        ->assertJsonPath('data.source_id', $source->id)
        ->assertJsonPath('data.qualified_person_count', 0)
        ->assertJsonPath('data.run', null)
        ->assertJsonPath('data.measures', []);
});

it('returns measure results when a completed run exists', function () {
    $user = User::factory()->create();
    $user->assignRole('viewer');

    $bundle = makeBundleWithMeasures();
    $source = Source::factory()->create();
    $measure = $bundle->measures->first();

    $run = CareBundleRun::create([
        'condition_bundle_id' => $bundle->id,
        'source_id' => $source->id,
        'status' => 'completed',
        'started_at' => now()->subMinutes(5),
        'completed_at' => now(),
        'trigger_kind' => 'manual',
        'qualified_person_count' => 1200,
        'measure_count' => 1,
        'bundle_version' => 'v1',
    ]);

    CareBundleMeasureResult::create([
        'care_bundle_run_id' => $run->id,
        'quality_measure_id' => $measure->id,
        'denominator_count' => 1200,
        'numerator_count' => 840,
        'exclusion_count' => 0,
        'rate' => 0.7,
        'computed_at' => now(),
    ]);

    DB::table('care_bundle_current_runs')->insert([
        'condition_bundle_id' => $bundle->id,
        'source_id' => $source->id,
        'care_bundle_run_id' => $run->id,
        'updated_at' => now(),
    ]);

    $this->actingAs($user)
        ->getJson("/api/v1/care-bundles/{$bundle->id}/qualifications?source_id={$source->id}")
        ->assertStatus(200)
        ->assertJsonPath('data.qualified_person_count', 1200)
        ->assertJsonPath('data.run.id', $run->id)
        ->assertJsonPath('data.measures.0.denominator_count', 1200)
        ->assertJsonPath('data.measures.0.numerator_count', 840)
        ->assertJsonPath('data.measures.0.rate', 0.7);
});

it('lists recent runs for a bundle', function () {
    $user = User::factory()->create();
    $user->assignRole('viewer');

    $bundle = makeBundleWithMeasures();
    $source = Source::factory()->create();

    CareBundleRun::create([
        'condition_bundle_id' => $bundle->id,
        'source_id' => $source->id,
        'status' => 'completed',
        'trigger_kind' => 'manual',
        'qualified_person_count' => 500,
    ]);

    $this->actingAs($user)
        ->getJson("/api/v1/care-bundles/{$bundle->id}/runs")
        ->assertStatus(200)
        ->assertJsonPath('data.0.condition_bundle_id', $bundle->id)
        ->assertJsonPath('data.0.qualified_person_count', 500);
});

// ── Phase 2: Intersections ─────────────────────────────────────────────────

/**
 * Stage two completed runs (one per bundle) for the same source, each with
 * its own qualification rows. Returns [bundleA, bundleB, source, runA, runB].
 *
 * Person overlap layout:
 *   persons 1..5    → only bundle A
 *   persons 6..10   → only bundle B
 *   persons 11..15  → both A and B (intersection cells)
 */
function stageTwoBundleIntersectionFixture(): array
{
    $bundleA = makeBundleWithMeasures();

    $bundleB = ConditionBundle::create([
        'bundle_code' => 'T2DM',
        'condition_name' => 'Type 2 Diabetes',
        'icd10_patterns' => ['E11'],
        'omop_concept_ids' => [201826],
        'bundle_size' => 1,
        'is_active' => true,
    ]);

    $source = Source::factory()->create();

    $runA = CareBundleRun::create([
        'condition_bundle_id' => $bundleA->id,
        'source_id' => $source->id,
        'status' => 'completed',
        'trigger_kind' => 'manual',
        'qualified_person_count' => 10,
    ]);
    $runB = CareBundleRun::create([
        'condition_bundle_id' => $bundleB->id,
        'source_id' => $source->id,
        'status' => 'completed',
        'trigger_kind' => 'manual',
        'qualified_person_count' => 10,
    ]);

    $insert = function (int $runId, int $bundleId, int $sourceId, array $personIds): void {
        $now = now();
        foreach ($personIds as $pid) {
            DB::table('care_bundle_qualifications')->insert([
                'care_bundle_run_id' => $runId,
                'condition_bundle_id' => $bundleId,
                'source_id' => $sourceId,
                'person_id' => $pid,
                'qualifies' => true,
                'measure_summary' => '{}',
                'created_at' => $now,
            ]);
        }
    };

    $insert($runA->id, $bundleA->id, $source->id, array_merge(range(1, 5), range(11, 15)));
    $insert($runB->id, $bundleB->id, $source->id, array_merge(range(6, 10), range(11, 15)));

    DB::table('care_bundle_current_runs')->insert([
        ['condition_bundle_id' => $bundleA->id, 'source_id' => $source->id, 'care_bundle_run_id' => $runA->id, 'updated_at' => now()],
        ['condition_bundle_id' => $bundleB->id, 'source_id' => $source->id, 'care_bundle_run_id' => $runB->id, 'updated_at' => now()],
    ]);

    return [$bundleA, $bundleB, $source, $runA, $runB];
}

it('computes an ALL intersection across two bundles', function () {
    $user = User::factory()->create();
    $user->assignRole('viewer');

    [$bundleA, $bundleB, $source] = stageTwoBundleIntersectionFixture();

    $response = $this->actingAs($user)
        ->postJson('/api/v1/care-bundles/intersections', [
            'source_id' => $source->id,
            'bundle_ids' => [$bundleA->id, $bundleB->id],
            'mode' => 'all',
        ])
        ->assertStatus(200);

    expect($response->json('data.count'))->toBe(5);
    expect($response->json('data.bundle_ids'))->toEqual([$bundleA->id, $bundleB->id]);
    expect($response->json('data.sample_person_ids'))->toHaveCount(5);
    expect($response->json('data.upset_cells'))->toBeArray();
});

it('computes ANY (union) intersection correctly', function () {
    $user = User::factory()->create();
    $user->assignRole('viewer');

    [$bundleA, $bundleB, $source] = stageTwoBundleIntersectionFixture();

    $this->actingAs($user)
        ->postJson('/api/v1/care-bundles/intersections', [
            'source_id' => $source->id,
            'bundle_ids' => [$bundleA->id, $bundleB->id],
            'mode' => 'any',
        ])
        ->assertStatus(200)
        ->assertJsonPath('data.count', 15);
});

it('returns 403 when intersection-to-cohort caller lacks create-cohort permission', function () {
    $user = User::factory()->create();
    $user->assignRole('viewer');

    [$bundleA, $bundleB, $source] = stageTwoBundleIntersectionFixture();

    $this->actingAs($user)
        ->postJson('/api/v1/care-bundles/intersections/to-cohort', [
            'source_id' => $source->id,
            'bundle_ids' => [$bundleA->id, $bundleB->id],
            'mode' => 'all',
            'name' => 'HTN ∩ T2DM',
        ])
        ->assertStatus(403);
});

// ── Phase 3a: FHIR Measure export + evaluator switching ───────────────────

it('exports a bundle as a FHIR R4 Measure resource', function () {
    $user = User::factory()->create();
    $user->assignRole('viewer');

    $bundle = makeBundleWithMeasures();

    $response = $this->actingAs($user)
        ->getJson("/api/v1/care-bundles/{$bundle->id}/fhir/measure")
        ->assertStatus(200);

    $response->assertHeader('Content-Type', 'application/fhir+json');

    // Structural shape checks — cardinalities per FHIR R4 Measure spec.
    $response->assertJsonPath('resourceType', 'Measure');
    $response->assertJsonPath('id', 'htn');
    $response->assertJsonPath('status', 'active');
    $response->assertJsonPath('title', 'Hypertension');
    $response->assertJsonPath('scoring.coding.0.code', 'proportion');
    $response->assertJsonPath('type.0.coding.0.code', 'process');

    // Groups: one per QualityMeasure in the bundle.
    expect($response->json('group'))->toHaveCount(1);
    $response->assertJsonPath('group.0.code.coding.0.code', 'HTN-01');

    // Populations: initial-population, denominator, numerator (plus optional
    // exclusion — not present since our test measure has no exclusion_criteria).
    $populations = $response->json('group.0.population');
    expect($populations)->toHaveCount(3);

    $codes = array_map(
        fn ($p) => $p['code']['coding'][0]['code'],
        $populations,
    );
    expect($codes)->toEqual(['initial-population', 'denominator', 'numerator']);

    // Criteria uses our custom OMOP dialect until Phase 3b emits executable CQL.
    $response->assertJsonPath('group.0.population.2.criteria.language', 'text/omop-concept-set-ids');
});

it('marks retired bundles as status=retired in FHIR export', function () {
    $user = User::factory()->create();
    $user->assignRole('viewer');

    $bundle = makeBundleWithMeasures();
    $bundle->update(['is_active' => false]);

    $this->actingAs($user)
        ->getJson("/api/v1/care-bundles/{$bundle->id}/fhir/measure")
        ->assertStatus(200)
        ->assertJsonPath('status', 'retired');
});

it('falls back to CohortBasedMeasureEvaluator when config is default', function () {
    config(['care_bundles.evaluator' => 'cohort_based']);
    $evaluator = app(CareBundleMeasureEvaluator::class);
    expect($evaluator)->toBeInstanceOf(
        CohortBasedMeasureEvaluator::class,
    );
});

it('binds CqlMeasureEvaluator when config selects cql', function () {
    config(['care_bundles.evaluator' => 'cql']);
    $evaluator = app(CareBundleMeasureEvaluator::class);
    expect($evaluator)->toBeInstanceOf(
        CqlMeasureEvaluator::class,
    );
});
