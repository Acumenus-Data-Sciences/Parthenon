<?php

declare(strict_types=1);

use App\Models\App\Characterization;
use App\Models\App\Source;
use App\Models\App\Study;
use App\Models\App\StudyAnalysis;
use App\Models\App\StudyResult;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(RolePermissionSeeder::class);
});

/**
 * The reproject endpoint backs the Abby copilot's approval-gated
 * `reproject_results` action: it refreshes curated study_results from the latest
 * completed executions and the current gate ledger, idempotently.
 */
it('reprojects curated study_results from the latest completed execution', function () {
    $user = User::factory()->create();
    $user->assignRole('researcher'); // carries studies.execute

    $study = Study::factory()->create(['created_by' => $user->id]);
    $source = Source::create(['source_name' => 'Test CDM', 'source_key' => 'TEST']);

    $analysis = Characterization::create(['name' => 'Baseline', 'author_id' => $user->id, 'design_json' => []]);
    StudyAnalysis::create([
        'study_id' => $study->id,
        'analysis_type' => Characterization::class,
        'analysis_id' => $analysis->id,
    ]);
    $analysis->executions()->create([
        'source_id' => $source->id,
        'status' => 'completed',
        'result_json' => [
            'results' => [[
                'cohort_id' => 5441, 'cohort_name' => 'Target', 'person_count' => 109763,
                'features' => ['demographics' => []],
            ]],
        ],
    ]);

    // Prove the endpoint — not the observer — populates the row.
    StudyResult::where('study_id', $study->id)->delete();

    $this->actingAs($user)
        ->postJson("/api/v1/studies/{$study->slug}/results/reproject")
        ->assertOk()
        ->assertJsonPath('data.reprojected', 1);

    expect(
        StudyResult::where('study_id', $study->id)->where('result_type', 'characterization')->count()
    )->toBe(1);
});

it('forbids reproject without the studies.execute permission', function () {
    $user = User::factory()->create();
    $user->assignRole('viewer'); // read-only — no studies.execute

    $study = Study::factory()->create(['created_by' => $user->id]);

    $this->actingAs($user)
        ->postJson("/api/v1/studies/{$study->slug}/results/reproject")
        ->assertForbidden();
});
