<?php

declare(strict_types=1);

use App\Models\App\ManagedShinyLaunch;
use App\Models\App\Study;
use App\Models\App\StudyAnalysis;
use App\Models\App\StudyExecution;
use App\Models\App\StudyResult;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(RolePermissionSeeder::class);
    config()->set('services.shiny_proxy.base_url', '/shiny');
});

it('exposes managed Shiny viewer actions for launchable native study results', function () {
    Storage::fake('local');
    Storage::disk('local')->put('testing/plp-results.sqlite', 'sqlite fixture bytes');

    $user = User::factory()->create();
    $user->assignRole('researcher');

    [$study, $result] = managedShinyStudyResultFixture($user, [
        'result_type' => 'prediction_performance',
        'result_file_path' => 'testing/plp-results.sqlite',
        'summary_data' => [
            'title' => 'PLP smoke result',
            'result_type' => 'PatientLevelPrediction',
        ],
    ]);

    $this->actingAs($user)
        ->getJson("/api/v1/studies/{$study->slug}/results")
        ->assertOk()
        ->assertJsonPath('data.0.id', $result->id)
        ->assertJsonPath('data.0.managed_shiny_apps.0.key', 'plp-results')
        ->assertJsonPath('data.0.managed_shiny_apps.0.label', 'PatientLevelPrediction Results');
});

it('launches a managed Shiny viewer directly from a native study result', function () {
    Storage::fake('local');
    Storage::disk('local')->put('testing/plp-results.sqlite', 'sqlite fixture bytes');

    config()->set('services.shiny_proxy.base_url', '/shiny');
    config()->set('services.shiny_proxy.workspace_root', storage_path('framework/testing/result-shiny-workspaces'));
    config()->set('services.shiny_proxy.container_workspace_root', '/srv/parthenon-shiny');

    $user = User::factory()->create();
    $user->assignRole('researcher');

    [$study, $result] = managedShinyStudyResultFixture($user, [
        'result_type' => 'prediction_performance',
        'result_file_path' => 'testing/plp-results.sqlite',
        'summary_data' => [
            'title' => 'PLP smoke result',
            'result_type' => 'PatientLevelPrediction',
            'managed_shiny_app' => 'plp-results',
        ],
    ]);

    $launch = $this->actingAs($user)
        ->postJson("/api/v1/studies/{$study->slug}/results/{$result->id}/shiny-launch", [
            'app_key' => 'plp-results',
        ])
        ->assertOk()
        ->assertJsonPath('data.context_type', 'result')
        ->assertJsonPath('data.app.key', 'plp-results')
        ->assertJsonPath('data.artifact.artifact_type', 'study_result')
        ->assertJsonPath('data.artifact.title', 'PLP smoke result')
        ->assertJsonPath('data.workspace.artifact_file', fn (string $path): bool => str_ends_with($path, '/artifact/plp-smoke-result.sqlite'))
        ->json('data');

    expect($launch['launch_url'])->toContain('result='.$result->id);

    $audit = ManagedShinyLaunch::query()
        ->where('workspace_id', $launch['workspace']['id'])
        ->firstOrFail();

    expect($audit->study_artifact_id)->toBeNull()
        ->and($audit->artifact_type)->toBe('study_result')
        ->and($audit->metadata['context_type'] ?? null)->toBe('result')
        ->and($audit->metadata['study_result_id'] ?? null)->toBe($result->id);
});

it('hides managed Shiny actions when a result has no materialized bundle path', function () {
    $user = User::factory()->create();
    $user->assignRole('researcher');

    [$study] = managedShinyStudyResultFixture($user, [
        'result_type' => 'prediction_performance',
        'result_file_path' => null,
        'summary_data' => ['title' => 'Summary-only PLP result'],
    ]);

    $this->actingAs($user)
        ->getJson("/api/v1/studies/{$study->slug}/results")
        ->assertOk()
        ->assertJsonPath('data.0.managed_shiny_apps', []);
});

/**
 * @param  array<string, mixed>  $overrides
 * @return array{Study, StudyResult}
 */
function managedShinyStudyResultFixture(User $user, array $overrides = []): array
{
    $study = Study::factory()->create(['created_by' => $user->id]);
    $analysis = StudyAnalysis::create([
        'study_id' => $study->id,
        'analysis_type' => 'prediction',
        'analysis_id' => 1,
    ]);
    $execution = StudyExecution::create([
        'study_id' => $study->id,
        'study_analysis_id' => $analysis->id,
        'status' => 'completed',
        'submitted_by' => $user->id,
        'execution_engine' => 'hades_r',
        'result_file_path' => $overrides['result_file_path'] ?? null,
    ]);

    $result = StudyResult::create([
        'execution_id' => $execution->id,
        'study_id' => $study->id,
        'study_analysis_id' => $analysis->id,
        'result_type' => $overrides['result_type'] ?? 'prediction_performance',
        'summary_data' => $overrides['summary_data'] ?? [],
        'diagnostics' => $overrides['diagnostics'] ?? null,
        'is_primary' => true,
        'is_publishable' => false,
    ]);

    return [$study, $result];
}
