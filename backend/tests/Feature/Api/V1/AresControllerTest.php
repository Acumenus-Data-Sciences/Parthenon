<?php

declare(strict_types=1);

use App\Models\App\ChartAnnotation;
use App\Models\App\Source;
use App\Models\App\SourceRelease;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(RolePermissionSeeder::class);
});

// ── Release Routes ──────────────────────────────────────────────────────────

it('requires authentication to list releases', function () {
    $source = Source::factory()->create();

    $this->getJson("/api/v1/sources/{$source->id}/ares/releases")
        ->assertStatus(401);
});

it('lists releases for a source', function () {
    $user = User::factory()->create();
    $user->assignRole('researcher');

    $source = Source::factory()->create();
    SourceRelease::factory()->count(3)->create(['source_id' => $source->id]);

    $response = $this->actingAs($user)
        ->getJson("/api/v1/sources/{$source->id}/ares/releases")
        ->assertStatus(200);

    expect($response->json('data'))->toHaveCount(3);
});

it('creates a release with valid data', function () {
    $user = User::factory()->create();
    $user->assignRole('researcher');

    $source = Source::factory()->create();

    $payload = [
        'release_name' => 'ETL 2026-Q1',
        'release_type' => 'scheduled_etl',
        'cdm_version' => '5.4',
        'vocabulary_version' => 'v5.0 2025-07-01',
        'notes' => 'Quarterly ETL refresh',
    ];

    $response = $this->actingAs($user)
        ->postJson("/api/v1/sources/{$source->id}/ares/releases", $payload)
        ->assertStatus(201);

    $response->assertJsonPath('data.release_name', 'ETL 2026-Q1');
    $response->assertJsonPath('data.release_type', 'scheduled_etl');
    $this->assertDatabaseHas('source_releases', ['release_name' => 'ETL 2026-Q1']);
});

it('fails to create release with missing release_name', function () {
    $user = User::factory()->create();
    $user->assignRole('researcher');

    $source = Source::factory()->create();

    $this->actingAs($user)
        ->postJson("/api/v1/sources/{$source->id}/ares/releases", [
            'release_type' => 'snapshot',
        ])
        ->assertStatus(422)
        ->assertJsonValidationErrors('release_name');
});

it('updates a release', function () {
    $user = User::factory()->create();
    $user->assignRole('researcher');

    $source = Source::factory()->create();
    $release = SourceRelease::factory()->create(['source_id' => $source->id]);

    $response = $this->actingAs($user)
        ->putJson("/api/v1/sources/{$source->id}/ares/releases/{$release->id}", [
            'release_name' => 'Updated Name',
        ])
        ->assertStatus(200);

    $response->assertJsonPath('data.release_name', 'Updated Name');
});

it('deletes a release as super-admin', function () {
    $user = User::factory()->create();
    $user->assignRole('super-admin');

    $source = Source::factory()->create();
    $release = SourceRelease::factory()->create(['source_id' => $source->id]);

    $this->actingAs($user)
        ->deleteJson("/api/v1/sources/{$source->id}/ares/releases/{$release->id}")
        ->assertStatus(200);

    $this->assertDatabaseMissing('source_releases', ['id' => $release->id]);
});

// ── Annotation Routes ───────────────────────────────────────────────────────

it('creates an annotation', function () {
    $user = User::factory()->create();
    $user->assignRole('researcher');

    $source = Source::factory()->create();

    $payload = [
        'chart_type' => 'demographics',
        'chart_context' => ['domain' => 'person'],
        'x_value' => '2020',
        'y_value' => 42.5,
        'annotation_text' => 'Notable spike in this year',
    ];

    $response = $this->actingAs($user)
        ->postJson("/api/v1/sources/{$source->id}/ares/annotations", $payload)
        ->assertStatus(201);

    $response->assertJsonPath('data.chart_type', 'demographics');
    $response->assertJsonPath('data.annotation_text', 'Notable spike in this year');
    $this->assertDatabaseHas('chart_annotations', ['annotation_text' => 'Notable spike in this year']);
});

it('prevents non-creator from updating annotation', function () {
    $creator = User::factory()->create();
    $creator->assignRole('researcher');

    $otherUser = User::factory()->create();
    $otherUser->assignRole('researcher');

    $source = Source::factory()->create();
    $annotation = ChartAnnotation::factory()->create([
        'source_id' => $source->id,
        'created_by' => $creator->id,
    ]);

    $this->actingAs($otherUser)
        ->putJson("/api/v1/sources/{$source->id}/ares/annotations/{$annotation->id}", [
            'annotation_text' => 'Hijacked annotation',
        ])
        ->assertStatus(403);
});

it('allows creator to delete annotation', function () {
    $user = User::factory()->create();
    $user->assignRole('super-admin');

    $source = Source::factory()->create();
    $annotation = ChartAnnotation::factory()->create([
        'source_id' => $source->id,
        'created_by' => $user->id,
    ]);

    $this->actingAs($user)
        ->deleteJson("/api/v1/sources/{$source->id}/ares/annotations/{$annotation->id}")
        ->assertStatus(200);

    $this->assertDatabaseMissing('chart_annotations', ['id' => $annotation->id]);
});
