<?php

use App\Enums\ExecutionStatus;
use App\Enums\IngestionStep;
use App\Jobs\Ingestion\ProfileSourceJob;
use App\Models\App\AnalysisExecution;
use App\Models\App\Characterization;
use App\Models\App\FhirConnection;
use App\Models\App\FhirSyncRun;
use App\Models\App\IngestionJob;
use App\Models\App\PoseidonRun;
use App\Models\App\Source;
use App\Models\Results\AchillesHeelRun;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Queue;

uses(DatabaseTransactions::class);

it('lists analysis execution jobs for the authenticated user', function () {
    $user = User::factory()->create();
    $otherUser = User::factory()->create();

    $source = Source::factory()->create(['source_name' => 'Acumenus CDM']);
    $characterization = Characterization::factory()->create([
        'author_id' => $user->id,
        'name' => 'Baseline Characterization',
    ]);
    $otherCharacterization = Characterization::factory()->create([
        'author_id' => $otherUser->id,
        'name' => 'Other Characterization',
    ]);

    AnalysisExecution::factory()->create([
        'analysis_type' => Characterization::class,
        'analysis_id' => $characterization->id,
        'source_id' => $source->id,
        'status' => ExecutionStatus::Queued,
    ]);

    AnalysisExecution::factory()->create([
        'analysis_type' => Characterization::class,
        'analysis_id' => $otherCharacterization->id,
        'source_id' => $source->id,
        'status' => ExecutionStatus::Failed,
    ]);

    $response = $this->actingAs($user)->getJson('/api/v1/jobs');

    $response->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.name', 'Baseline Characterization')
        ->assertJsonPath('data.0.type', 'characterization')
        ->assertJsonPath('data.0.source_name', 'Acumenus CDM')
        ->assertJsonPath('data.0.actions.retry', false)
        ->assertJsonPath('data.0.actions.cancel', true);
});

it('shows a single failed analysis job with log output and supported actions', function () {
    $user = User::factory()->create();
    $source = Source::factory()->create();
    $characterization = Characterization::factory()->create([
        'author_id' => $user->id,
        'name' => 'Drug Characterization',
    ]);

    $execution = AnalysisExecution::factory()->failed()->create([
        'analysis_type' => Characterization::class,
        'analysis_id' => $characterization->id,
        'source_id' => $source->id,
    ]);

    $execution->logs()->create([
        'level' => 'error',
        'message' => 'Characterization execution failed',
        'context' => ['detail' => 'boom'],
    ]);

    $response = $this->actingAs($user)->getJson("/api/v1/jobs/{$execution->id}?type=characterization");

    $response->assertOk()
        ->assertJsonPath('name', 'Drug Characterization')
        ->assertJsonPath('status', 'failed')
        ->assertJsonPath('actions.retry', true)
        ->assertJsonPath('actions.cancel', false);

    expect($response->json('log_output'))->toContain('Characterization execution failed');
});

it('normalizes poseidon success jobs to completed', function () {
    $user = User::factory()->create();
    $source = Source::factory()->create(['source_name' => 'Poseidon Source']);

    PoseidonRun::create([
        'dagster_run_id' => 'dagster-success-1',
        'source_id' => $source->id,
        'run_type' => 'incremental',
        'status' => 'success',
        'started_at' => now()->subMinutes(5),
        'completed_at' => now(),
        'created_by' => $user->id,
    ]);

    $response = $this->actingAs($user)->getJson('/api/v1/jobs?type=poseidon');

    $response->assertOk()
        ->assertJsonPath('data.0.status', 'completed')
        ->assertJsonPath('data.0.progress', 100)
        ->assertJsonPath('data.0.actions.retry', false)
        ->assertJsonPath('data.0.actions.cancel', false);
});

it('filters fhir sync running jobs across all raw running statuses', function () {
    $user = User::factory()->create();
    $source = Source::factory()->create();

    $connection = FhirConnection::create([
        'site_name' => 'Epic Test',
        'site_key' => 'epic-test',
        'ehr_vendor' => 'epic',
        'fhir_base_url' => 'https://example.test/fhir',
        'token_endpoint' => 'https://example.test/token',
        'client_id' => 'client-1',
        'private_key_pem' => null,
        'scopes' => 'system/*.read',
        'target_source_id' => $source->id,
        'created_by' => $user->id,
    ]);

    foreach (['exporting', 'downloading', 'processing'] as $index => $status) {
        FhirSyncRun::create([
            'fhir_connection_id' => $connection->id,
            'status' => $status,
            'started_at' => now()->subMinutes(5 - $index),
            'triggered_by' => $user->id,
        ]);
    }

    FhirSyncRun::create([
        'fhir_connection_id' => $connection->id,
        'status' => 'completed',
        'started_at' => now()->subMinutes(10),
        'finished_at' => now()->subMinutes(8),
        'triggered_by' => $user->id,
    ]);

    $response = $this->actingAs($user)->getJson('/api/v1/jobs?type=fhir_sync&status=running');

    $response->assertOk()
        ->assertJsonCount(3, 'data');

    expect(collect($response->json('data'))->pluck('status')->unique()->all())->toBe(['running']);
});

it('retries failed ingestion jobs through the unified jobs endpoint', function () {
    Queue::fake();

    $user = User::factory()->create();
    $source = Source::factory()->create(['source_name' => 'Retry Source']);

    $job = IngestionJob::create([
        'source_id' => $source->id,
        'status' => ExecutionStatus::Failed,
        'current_step' => IngestionStep::Profiling,
        'progress_percentage' => 85,
        'error_message' => 'boom',
        'created_by' => $user->id,
        'started_at' => now()->subMinutes(10),
        'completed_at' => now()->subMinute(),
    ]);

    $response = $this->actingAs($user)->postJson("/api/v1/jobs/{$job->id}/retry", [
        'type' => 'ingestion',
    ]);

    $response->assertOk()
        ->assertJsonPath('status', 'pending')
        ->assertJsonPath('actions.retry', false)
        ->assertJsonPath('actions.cancel', false);

    expect($job->fresh()->status)->toBe(ExecutionStatus::Pending);
    expect($job->fresh()->error_message)->toBeNull();
    Queue::assertPushed(ProfileSourceJob::class);
});

it('lists heel runs even when there are no stored violation rows', function () {
    $user = User::factory()->create();
    $source = Source::factory()->create(['source_name' => 'Heel Source']);

    $run = AchillesHeelRun::create([
        'run_id' => '11111111-1111-1111-1111-111111111111',
        'source_id' => $source->id,
        'status' => 'completed',
        'total_rules' => 12,
        'completed_rules' => 12,
        'failed_rules' => 0,
        'started_at' => now()->subMinutes(15),
        'completed_at' => now()->subMinutes(5),
    ]);

    $list = $this->actingAs($user)->getJson('/api/v1/jobs?type=heel');
    $list->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.id', $run->id)
        ->assertJsonPath('data.0.status', 'completed');

    $detail = $this->actingAs($user)->getJson("/api/v1/jobs/{$run->id}?type=heel");
    $detail->assertOk()
        ->assertJsonPath('details.total_rules', 12)
        ->assertJsonPath('details.total_violations', 0);
});

it('paginates the merged jobs list beyond the first 50 rows', function () {
    $user = User::factory()->create();
    $source = Source::factory()->create();
    $characterization = Characterization::factory()->create([
        'author_id' => $user->id,
    ]);

    foreach (range(1, 60) as $i) {
        AnalysisExecution::factory()->completed()->create([
            'analysis_type' => Characterization::class,
            'analysis_id' => $characterization->id,
            'source_id' => $source->id,
            'created_at' => now()->subMinutes($i),
        ]);
    }

    $pageOne = $this->actingAs($user)->getJson('/api/v1/jobs?per_page=50&page=1');
    $pageOne->assertOk()
        ->assertJsonCount(50, 'data')
        ->assertJsonPath('meta.total', 60)
        ->assertJsonPath('meta.last_page', 2);

    $pageTwo = $this->actingAs($user)->getJson('/api/v1/jobs?per_page=50&page=2');
    $pageTwo->assertOk()
        ->assertJsonCount(10, 'data')
        ->assertJsonPath('meta.current_page', 2);
});
