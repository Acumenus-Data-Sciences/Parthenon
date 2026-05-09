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
        ->assertJsonPath('data.0.managed_shiny_apps.0.key', 'ohdsi-report')
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

it('creates managed Shiny launch envelopes for vetted study artifacts', function () {
    config()->set('services.shiny_proxy.base_url', 'https://shiny.example.test');
    config()->set('services.shiny_proxy.launch_ttl_minutes', 10);

    $user = User::factory()->create();
    $user->assignRole('researcher');

    $study = Study::factory()->create(['created_by' => $user->id]);

    $artifact = StudyArtifact::create([
        'study_id' => $study->id,
        'artifact_type' => 'results_report',
        'title' => 'OHDSI Report Generator Bundle',
        'version' => '1.0',
        'metadata' => ['result_type' => 'OhdsiReportGenerator'],
        'uploaded_by' => $user->id,
        'is_current' => true,
    ]);

    $response = $this->actingAs($user)
        ->postJson("/api/v1/studies/{$study->slug}/artifacts/{$artifact->id}/shiny-launch", [
            'app_key' => 'ohdsi-report',
            'mode' => 'embedded',
        ])
        ->assertOk()
        ->assertJsonPath('data.app.key', 'ohdsi-report')
        ->assertJsonPath('data.status', 'ready')
        ->assertJsonPath('data.embedding.allowed', true);

    expect($response->json('data.launch_url'))->toStartWith('https://shiny.example.test/app/ohdsi-report?');
    expect($response->json('data.launch_url'))->toContain('parthenon_launch=');
});

it('reports managed Shiny runtime configuration gaps without exposing arbitrary app URLs', function () {
    config()->set('services.shiny_proxy.base_url', '');

    $user = User::factory()->create();
    $user->assignRole('researcher');

    $study = Study::factory()->create(['created_by' => $user->id]);

    $artifact = StudyArtifact::create([
        'study_id' => $study->id,
        'artifact_type' => 'results_report',
        'title' => 'OHDSI Report Generator Bundle',
        'version' => '1.0',
        'metadata' => ['managed_shiny_apps' => ['ohdsi-report']],
        'uploaded_by' => $user->id,
        'is_current' => true,
    ]);

    $this->actingAs($user)
        ->postJson("/api/v1/studies/{$study->slug}/artifacts/{$artifact->id}/shiny-launch", [
            'app_key' => 'ohdsi-report',
        ])
        ->assertOk()
        ->assertJsonPath('data.status', 'runtime_unconfigured')
        ->assertJsonPath('data.launch_url', null)
        ->assertJsonPath('data.setup.required', true);
});

it('rejects managed Shiny launches for unsupported artifact types', function () {
    config()->set('services.shiny_proxy.base_url', 'https://shiny.example.test');

    $user = User::factory()->create();
    $user->assignRole('researcher');

    $study = Study::factory()->create(['created_by' => $user->id]);

    $artifact = StudyArtifact::create([
        'study_id' => $study->id,
        'artifact_type' => 'protocol',
        'title' => 'Protocol',
        'version' => '1.0',
        'uploaded_by' => $user->id,
        'is_current' => true,
    ]);

    $this->actingAs($user)
        ->postJson("/api/v1/studies/{$study->slug}/artifacts/{$artifact->id}/shiny-launch", [
            'app_key' => 'ohdsi-report',
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['app_key']);
});
