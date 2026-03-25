<?php

declare(strict_types=1);

use App\Models\App\Source;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(RolePermissionSeeder::class);
    $this->user = User::factory()->create();
    $this->user->assignRole('researcher');
    Source::factory()->count(2)->create();
});

// ── Authentication ───────────────────────────────────────────────────────

it('requires authentication for overview', function () {
    $this->getJson('/api/v1/network/ares/overview')
        ->assertStatus(401);
});

it('requires authentication for feasibility POST', function () {
    $this->postJson('/api/v1/network/ares/feasibility', [
        'name' => 'Test',
        'criteria' => ['required_domains' => ['condition']],
    ])->assertStatus(401);
});

// ── Overview ─────────────────────────────────────────────────────────────

it('returns aggregated KPIs from overview', function () {
    $this->actingAs($this->user)
        ->getJson('/api/v1/network/ares/overview')
        ->assertOk()
        ->assertJsonStructure(['data' => ['source_count', 'avg_dq_score', 'total_unmapped_codes']]);
});

// ── Concept Comparison ───────────────────────────────────────────────────

it('returns per-source data for concept comparison', function () {
    $this->actingAs($this->user)
        ->getJson('/api/v1/network/ares/compare?concept_id=201826')
        ->assertOk()
        ->assertJsonStructure(['data']);
});

it('returns 422 when concept_id is missing', function () {
    $this->actingAs($this->user)
        ->getJson('/api/v1/network/ares/compare')
        ->assertStatus(422);
});

it('returns results for batch comparison', function () {
    $this->actingAs($this->user)
        ->getJson('/api/v1/network/ares/compare/batch?concept_ids=201826,320128')
        ->assertOk();
});

it('returns 422 when batch has no concept_ids', function () {
    $this->actingAs($this->user)
        ->getJson('/api/v1/network/ares/compare/batch')
        ->assertStatus(422);
});

it('returns results for concept search', function () {
    $this->actingAs($this->user)
        ->getJson('/api/v1/network/ares/compare/search?q=diabetes')
        ->assertOk();
});

// ── Coverage ─────────────────────────────────────────────────────────────

it('returns coverage matrix', function () {
    $this->actingAs($this->user)
        ->getJson('/api/v1/network/ares/coverage')
        ->assertOk()
        ->assertJsonStructure(['data' => ['sources', 'domains', 'matrix']]);
});

// ── Diversity ────────────────────────────────────────────────────────────

it('returns diversity demographics', function () {
    $this->actingAs($this->user)
        ->getJson('/api/v1/network/ares/diversity')
        ->assertOk()
        ->assertJsonStructure(['data']);
});

// ── Feasibility ──────────────────────────────────────────────────────────

it('validates feasibility input', function () {
    $this->actingAs($this->user)
        ->postJson('/api/v1/network/ares/feasibility', [])
        ->assertStatus(422);
});

it('creates feasibility assessment with valid input', function () {
    $this->actingAs($this->user)
        ->postJson('/api/v1/network/ares/feasibility', [
            'name' => 'Diabetes Study',
            'criteria' => [
                'required_domains' => ['condition', 'drug'],
                'min_patients' => 100,
            ],
        ])
        ->assertStatus(201)
        ->assertJsonPath('data.name', 'Diabetes Study');
});

it('lists feasibility assessments', function () {
    $this->actingAs($this->user)
        ->getJson('/api/v1/network/ares/feasibility')
        ->assertOk();
});

// ── DQ Summary ───────────────────────────────────────────────────────────

it('returns DQ summary per source', function () {
    $this->actingAs($this->user)
        ->getJson('/api/v1/network/ares/dq-summary')
        ->assertOk();
});

// ── Annotations ──────────────────────────────────────────────────────────

it('returns network annotations', function () {
    $this->actingAs($this->user)
        ->getJson('/api/v1/network/ares/annotations')
        ->assertOk();
});

// ── Cost (Placeholder) ──────────────────────────────────────────────────

it('returns cost placeholder', function () {
    $this->actingAs($this->user)
        ->getJson('/api/v1/network/ares/cost')
        ->assertOk();
});
