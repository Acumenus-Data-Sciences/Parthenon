<?php

use App\Jobs\Fhir\RunFhirSyncJob;
use App\Models\App\FhirConnection;
use App\Models\App\FhirSyncRun;
use App\Models\App\IngestionProject;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Bus;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(RolePermissionSeeder::class);
    Bus::fake();
});

function fhirProjectUser(string $role = 'data-steward'): User
{
    $user = User::factory()->create();
    $user->assignRole($role);

    return $user;
}

function makeFhirProject(User $user): IngestionProject
{
    return IngestionProject::create([
        'name' => 'Project Vulcan',
        'status' => 'draft',
        'created_by' => $user->id,
        'file_count' => 0,
        'total_size_bytes' => 0,
    ]);
}

function makeFhirConnection(User $user, array $overrides = []): FhirConnection
{
    return FhirConnection::create(array_merge([
        'site_name' => 'Johns Hopkins Epic',
        'site_key' => 'jhu-epic',
        'ehr_vendor' => 'epic',
        'fhir_base_url' => 'https://example.test/fhir',
        'token_endpoint' => 'https://example.test/token',
        'client_id' => 'client-123',
        'private_key_pem' => "-----BEGIN PRIVATE KEY-----\nkey\n-----END PRIVATE KEY-----",
        'scopes' => 'system/*.read',
        'is_active' => true,
        'incremental_enabled' => true,
        'created_by' => $user->id,
    ], $overrides));
}

test('project fhir workspace returns available connections and project linkage', function () {
    $user = fhirProjectUser();
    $project = makeFhirProject($user);
    $connection = makeFhirConnection($user);

    $project->update([
        'fhir_connection_id' => $connection->id,
        'fhir_sync_mode' => 'bulk_group',
    ]);

    $this->actingAs($user)
        ->getJson("/api/v1/ingestion-projects/{$project->id}/fhir")
        ->assertOk()
        ->assertJsonPath('data.project.id', $project->id)
        ->assertJsonPath('data.fhir_connection.id', $connection->id)
        ->assertJsonPath('data.available_connections.0.id', $connection->id);
});

test('user can attach fhir connection to project', function () {
    $user = fhirProjectUser();
    $project = makeFhirProject($user);
    $connection = makeFhirConnection($user);

    $this->actingAs($user)
        ->postJson("/api/v1/ingestion-projects/{$project->id}/fhir/attach-connection", [
            'fhir_connection_id' => $connection->id,
            'fhir_sync_mode' => 'bulk_group',
            'fhir_config' => [
                'resource_types' => ['Patient', 'Encounter', 'Observation'],
            ],
        ])
        ->assertOk()
        ->assertJsonPath('data.project.fhir_connection_id', $connection->id)
        ->assertJsonPath('data.project.fhir_sync_mode', 'bulk_group')
        ->assertJsonPath('data.fhir_connection.id', $connection->id);

    $this->assertDatabaseHas('ingestion_projects', [
        'id' => $project->id,
        'fhir_connection_id' => $connection->id,
        'fhir_sync_mode' => 'bulk_group',
    ]);
});

test('starting project fhir sync creates run and dispatches job', function () {
    $user = fhirProjectUser();
    $project = makeFhirProject($user);
    $connection = makeFhirConnection($user, ['site_key' => 'mgh-epic']);

    $project->update([
        'fhir_connection_id' => $connection->id,
        'fhir_sync_mode' => 'bulk_group',
    ]);

    $response = $this->actingAs($user)
        ->postJson("/api/v1/ingestion-projects/{$project->id}/fhir/sync", [
            'force_full' => true,
        ]);

    $response->assertStatus(202)
        ->assertJsonPath('data.fhir_connection_id', $connection->id)
        ->assertJsonPath('data.ingestion_project_id', $project->id)
        ->assertJsonPath('data.status', 'pending');

    Bus::assertDispatched(RunFhirSyncJob::class, function (RunFhirSyncJob $job) use ($project, $connection) {
        return $job->fhirConnection->is($connection)
            && $job->syncRun->ingestion_project_id === $project->id
            && $job->forceFull === true;
    });

    $project->refresh();
    expect($project->last_fhir_sync_status)->toBe('pending');
    expect($project->status)->toBe('profiling');
});

test('project fhir sync runs list is scoped to the project', function () {
    $user = fhirProjectUser();
    $other = fhirProjectUser();
    $project = makeFhirProject($user);
    $otherProject = makeFhirProject($other);
    $connection = makeFhirConnection($user, ['site_key' => 'duke-epic']);

    $run = FhirSyncRun::create([
        'fhir_connection_id' => $connection->id,
        'ingestion_project_id' => $project->id,
        'status' => 'completed',
        'records_written' => 42,
        'triggered_by' => $user->id,
        'started_at' => now()->subMinute(),
        'finished_at' => now(),
    ]);

    FhirSyncRun::create([
        'fhir_connection_id' => $connection->id,
        'ingestion_project_id' => $otherProject->id,
        'status' => 'failed',
        'triggered_by' => $other->id,
    ]);

    $this->actingAs($user)
        ->getJson("/api/v1/ingestion-projects/{$project->id}/fhir/sync-runs")
        ->assertOk()
        ->assertJsonPath('data.0.id', $run->id)
        ->assertJsonCount(1, 'data');
});

test('viewer cannot access project fhir workspace', function () {
    $owner = fhirProjectUser();
    $viewer = fhirProjectUser('viewer');
    $project = makeFhirProject($owner);

    $this->actingAs($viewer)
        ->getJson("/api/v1/ingestion-projects/{$project->id}/fhir")
        ->assertForbidden();
});
