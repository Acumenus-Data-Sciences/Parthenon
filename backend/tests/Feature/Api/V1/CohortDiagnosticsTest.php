<?php

declare(strict_types=1);

use App\Models\App\CohortDefinition;
use App\Models\App\Source;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(RolePermissionSeeder::class);
});

it('requires authentication to run cohort diagnostics', function () {
    $this->postJson('/api/v1/cohort-diagnostics/run')
        ->assertStatus(401);
});

it('validates required fields for cohort diagnostics', function () {
    $user = User::factory()->create();
    $user->assignRole('researcher');

    $this->actingAs($user)
        ->postJson('/api/v1/cohort-diagnostics/run', [])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['cohort_definition_ids', 'source_id']);
});

it('validates cohort_definition_ids must be an array', function () {
    $user = User::factory()->create();
    $user->assignRole('researcher');

    $source = Source::factory()->create();

    $this->actingAs($user)
        ->postJson('/api/v1/cohort-diagnostics/run', [
            'cohort_definition_ids' => 'not-an-array',
            'source_id' => $source->id,
        ])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['cohort_definition_ids']);
});

it('validates source_id exists', function () {
    $user = User::factory()->create();
    $user->assignRole('researcher');

    $cohort = CohortDefinition::factory()->create(['author_id' => $user->id]);

    $this->actingAs($user)
        ->postJson('/api/v1/cohort-diagnostics/run', [
            'cohort_definition_ids' => [$cohort->id],
            'source_id' => 99999,
        ])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['source_id']);
});

it('runs cohort diagnostics successfully via R proxy', function () {
    $user = User::factory()->create();
    $user->assignRole('researcher');

    $source = Source::factory()->create();
    $cohort = CohortDefinition::factory()->create(['author_id' => $user->id]);

    Http::fake([
        '*/analysis/cohort-diagnostics/run' => Http::response([
            'status' => 'success',
            'results' => ['incidence_rate' => 0.05],
        ], 200),
    ]);

    $response = $this->actingAs($user)
        ->postJson('/api/v1/cohort-diagnostics/run', [
            'cohort_definition_ids' => [$cohort->id],
            'source_id' => $source->id,
            'run_incidence_rate' => true,
            'run_temporal_characterization' => false,
            'min_cell_count' => 5,
        ])
        ->assertStatus(200);

    $response->assertJsonStructure(['data']);
});

it('handles R runtime failure gracefully', function () {
    $user = User::factory()->create();
    $user->assignRole('researcher');

    $source = Source::factory()->create();
    $cohort = CohortDefinition::factory()->create(['author_id' => $user->id]);

    Http::fake([
        '*/analysis/cohort-diagnostics/run' => Http::response([
            'message' => 'R execution error',
        ], 500),
    ]);

    $this->actingAs($user)
        ->postJson('/api/v1/cohort-diagnostics/run', [
            'cohort_definition_ids' => [$cohort->id],
            'source_id' => $source->id,
        ])
        ->assertStatus(500);
});

it('validates min_cell_count bounds', function () {
    $user = User::factory()->create();
    $user->assignRole('researcher');

    $source = Source::factory()->create();
    $cohort = CohortDefinition::factory()->create(['author_id' => $user->id]);

    $this->actingAs($user)
        ->postJson('/api/v1/cohort-diagnostics/run', [
            'cohort_definition_ids' => [$cohort->id],
            'source_id' => $source->id,
            'min_cell_count' => 999,
        ])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['min_cell_count']);
});

it('accepts multiple cohort definition ids', function () {
    $user = User::factory()->create();
    $user->assignRole('researcher');

    $source = Source::factory()->create();
    $cohorts = CohortDefinition::factory()->count(3)->create(['author_id' => $user->id]);

    Http::fake([
        '*/analysis/cohort-diagnostics/run' => Http::response([
            'status' => 'success',
        ], 200),
    ]);

    $this->actingAs($user)
        ->postJson('/api/v1/cohort-diagnostics/run', [
            'cohort_definition_ids' => $cohorts->pluck('id')->toArray(),
            'source_id' => $source->id,
        ])
        ->assertStatus(200);
});
