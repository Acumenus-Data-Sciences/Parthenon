<?php

declare(strict_types=1);

use App\Exceptions\AiProviderNotConfiguredException;
use App\Models\App\Source;
use App\Models\User;
use App\Services\AI\DataInterrogationService;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(RolePermissionSeeder::class);
});

it('requires authentication to ask a data-interrogation question', function () {
    $this->postJson('/api/v1/data-interrogation/ask', [])
        ->assertStatus(401);
});

it('requires analyses.view permission to ask', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->postJson('/api/v1/data-interrogation/ask', [
            'question' => 'How many persons are in the cohort?',
            'source_id' => Source::factory()->create()->id,
        ])
        ->assertStatus(403);
});

it('validates that a question and an existing source are provided', function () {
    $user = User::factory()->create();
    $user->assignRole('researcher');

    // Missing question + non-existent source → 422 (missing-source recovery).
    $this->actingAs($user)
        ->postJson('/api/v1/data-interrogation/ask', [
            'source_id' => 999999,
        ])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['question', 'source_id']);
});

it('binds the answer to the selected source and returns the result shape', function () {
    $user = User::factory()->create();
    $user->assignRole('researcher');
    $source = Source::factory()->create();

    $this->mock(DataInterrogationService::class)
        ->shouldReceive('ask')
        ->once()
        ->withArgs(fn (string $question, Source $askedSource): bool => $question === 'How many persons?'
            && $askedSource->id === $source->id)
        ->andReturn([
            'answer' => 'There are 42 persons.',
            'tables' => [],
            'queries' => ['SELECT count(*) FROM person'],
            'iterations' => 1,
        ]);

    $this->actingAs($user)
        ->postJson('/api/v1/data-interrogation/ask', [
            'question' => 'How many persons?',
            'source_id' => $source->id,
        ])
        ->assertStatus(200)
        ->assertJsonPath('answer', 'There are 42 persons.')
        ->assertJsonPath('iterations', 1)
        ->assertJsonPath('queries.0', 'SELECT count(*) FROM person');
});

it('returns a 422 envelope when the AI provider is not configured', function () {
    $user = User::factory()->create();
    $user->assignRole('researcher');
    $source = Source::factory()->create();

    $this->mock(DataInterrogationService::class)
        ->shouldReceive('ask')
        ->once()
        ->andThrow(new AiProviderNotConfiguredException('AI provider is not configured.'));

    $this->actingAs($user)
        ->postJson('/api/v1/data-interrogation/ask', [
            'question' => 'How many persons?',
            'source_id' => $source->id,
        ])
        ->assertStatus(422)
        ->assertJsonPath('answer', '')
        ->assertJsonPath('error', 'AI provider is not configured.')
        ->assertJsonPath('iterations', 0);
});
