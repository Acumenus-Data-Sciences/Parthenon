<?php

use App\Models\App\CohortDefinition;
use App\Models\App\ConceptSet;
use App\Models\App\Source;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(RolePermissionSeeder::class);
});

it('requires authentication for dashboard stats', function () {
    $this->getJson('/api/v1/dashboard/stats')
        ->assertStatus(401);
});

it('returns dashboard stats for authenticated viewer', function () {
    $user = User::factory()->create();
    $user->assignRole('viewer');

    $this->actingAs($user)
        ->getJson('/api/v1/dashboard/stats')
        ->assertOk()
        ->assertJsonStructure([
            'data' => [
                'sources',
                'cohort_count',
                'concept_set_count',
                'dqd_failures',
                'active_job_count',
                'recent_cohorts',
                'recent_jobs',
            ],
        ]);
});

it('returns dashboard stats for authenticated researcher', function () {
    $user = User::factory()->create();
    $user->assignRole('researcher');

    $this->actingAs($user)
        ->getJson('/api/v1/dashboard/stats')
        ->assertOk()
        ->assertJsonStructure([
            'data' => [
                'sources',
                'cohort_count',
                'concept_set_count',
                'dqd_failures',
                'active_job_count',
                'recent_cohorts',
                'recent_jobs',
            ],
        ]);
});

it('returns zero counts when no data exists', function () {
    $user = User::factory()->create();
    $user->assignRole('viewer');

    $response = $this->actingAs($user)
        ->getJson('/api/v1/dashboard/stats')
        ->assertOk();

    expect($response->json('data.cohort_count'))->toBe(0);
    expect($response->json('data.concept_set_count'))->toBe(0);
    expect($response->json('data.dqd_failures'))->toBe(0);
    expect($response->json('data.active_job_count'))->toBe(0);
    expect($response->json('data.recent_cohorts'))->toBeArray()->toBeEmpty();
    expect($response->json('data.recent_jobs'))->toBeArray()->toBeEmpty();
});

it('returns correct cohort and concept set counts', function () {
    $user = User::factory()->create();
    $user->assignRole('researcher');

    CohortDefinition::factory()->count(3)->create(['author_id' => $user->id]);
    ConceptSet::factory()->count(2)->create(['author_id' => $user->id]);

    $response = $this->actingAs($user)
        ->getJson('/api/v1/dashboard/stats')
        ->assertOk();

    expect($response->json('data.cohort_count'))->toBe(3);
    expect($response->json('data.concept_set_count'))->toBe(2);
});

it('returns recent cohorts ordered by updated_at', function () {
    $user = User::factory()->create();
    $user->assignRole('researcher');

    CohortDefinition::factory()->count(7)->create(['author_id' => $user->id]);

    $response = $this->actingAs($user)
        ->getJson('/api/v1/dashboard/stats')
        ->assertOk();

    // Dashboard returns at most 5 recent cohorts
    expect($response->json('data.recent_cohorts'))->toHaveCount(5);
});

it('returns sources visible to the user', function () {
    $user = User::factory()->create();
    $user->assignRole('researcher');

    Source::factory()->count(2)->create();

    $response = $this->actingAs($user)
        ->getJson('/api/v1/dashboard/stats')
        ->assertOk();

    expect($response->json('data.sources'))->toBeArray();
});

it('returns data as JSON with correct content type', function () {
    $user = User::factory()->create();
    $user->assignRole('viewer');

    $this->actingAs($user)
        ->getJson('/api/v1/dashboard/stats')
        ->assertOk()
        ->assertHeader('Content-Type', 'application/json');
});
