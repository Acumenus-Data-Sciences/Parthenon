<?php

use App\Enums\ExecutionStatus;
use App\Models\App\AnalysisExecution;
use App\Models\App\Characterization;
use App\Models\App\Source;
use App\Models\User;

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
        ->assertJsonPath('data.0.source_name', 'Acumenus CDM');
});

it('shows a single job with log output', function () {
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
        ->assertJsonPath('status', 'failed');

    expect($response->json('log_output'))->toContain('Characterization execution failed');
});
