<?php

declare(strict_types=1);

use App\Models\App\Study;
use App\Models\App\StudyArtifact;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(RolePermissionSeeder::class);
});

it('does not expose legacy Shiny study artifacts', function () {
    $user = User::factory()->create();
    $user->assignRole('researcher');

    $study = Study::factory()->create(['created_by' => $user->id]);

    StudyArtifact::create([
        'study_id' => $study->id,
        'artifact_type' => 'shiny_app_url',
        'title' => 'Legacy Shiny Explorer',
        'version' => '1.0',
        'url' => 'https://example.test/shiny',
        'uploaded_by' => $user->id,
        'is_current' => true,
    ]);

    StudyArtifact::create([
        'study_id' => $study->id,
        'artifact_type' => 'results_report',
        'title' => 'Native Results Report',
        'version' => '1.0',
        'uploaded_by' => $user->id,
        'is_current' => true,
    ]);

    $this->actingAs($user)
        ->getJson("/api/v1/studies/{$study->slug}/artifacts")
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.artifact_type', 'results_report')
        ->assertJsonMissing(['artifact_type' => 'shiny_app_url']);
});

it('rejects creation of legacy Shiny study artifacts', function () {
    $user = User::factory()->create();
    $user->assignRole('researcher');

    $study = Study::factory()->create(['created_by' => $user->id]);

    $this->actingAs($user)
        ->postJson("/api/v1/studies/{$study->slug}/artifacts", [
            'artifact_type' => 'shiny_app_url',
            'title' => 'Legacy Shiny Explorer',
            'version' => '1.0',
            'url' => 'https://example.test/shiny',
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['artifact_type']);
});
