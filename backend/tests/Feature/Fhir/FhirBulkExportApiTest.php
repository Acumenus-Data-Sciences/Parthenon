<?php

declare(strict_types=1);

namespace Tests\Feature\Fhir;

use App\Jobs\Fhir\RunFhirExportJob;
use App\Models\App\FhirExportJob;
use App\Models\App\Source;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class FhirBulkExportApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RolePermissionSeeder::class);
    }

    public function test_start_export_requires_authentication(): void
    {
        $this->postJson('/api/v1/fhir/$export', [])
            ->assertStatus(401);
    }

    public function test_start_export_validates_source_and_resource_types(): void
    {
        Bus::fake();
        $user = $this->userWithRole('researcher');

        $this->actingAs($user)
            ->postJson('/api/v1/fhir/$export', [
                'source_id' => 999999,
                'resource_types' => ['Patient', 'UnsupportedResource'],
                'patient_ids' => [1, 1, 0],
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors([
                'source_id',
                'resource_types.1',
                'patient_ids.1',
                'patient_ids.2',
            ]);

        Bus::assertNotDispatched(RunFhirExportJob::class);
    }

    public function test_start_export_denies_sources_hidden_from_user_role(): void
    {
        Bus::fake();
        $user = $this->userWithRole('researcher');
        $source = Source::factory()->create([
            'restricted_to_roles' => ['admin'],
        ]);

        $this->actingAs($user)
            ->postJson('/api/v1/fhir/$export', [
                'source_id' => $source->id,
                'resource_types' => ['Patient'],
            ])
            ->assertStatus(403);

        Bus::assertNotDispatched(RunFhirExportJob::class);
    }

    public function test_start_export_creates_owned_job_for_visible_source(): void
    {
        Bus::fake();
        $user = $this->userWithRole('researcher');
        $source = Source::factory()->create();

        $response = $this->actingAs($user)
            ->postJson('/api/v1/fhir/$export', [
                'source_id' => $source->id,
                'resource_types' => ['Patient'],
                'patient_ids' => [123],
            ])
            ->assertStatus(202);

        $job = FhirExportJob::findOrFail($response->json('id'));

        $this->assertSame($source->id, $job->source_id);
        $this->assertSame($user->id, $job->user_id);
        $this->assertSame(['Patient'], $job->resource_types);
        $this->assertSame([123], $job->patient_ids);

        $response->assertHeader('Content-Location', "/api/v1/fhir/\$export/{$job->id}");
        Bus::assertDispatched(RunFhirExportJob::class);
    }

    public function test_export_status_is_owner_or_super_admin_only(): void
    {
        $owner = $this->userWithRole('researcher');
        $stranger = $this->userWithRole('researcher');
        $superAdmin = $this->userWithRole('super-admin');
        $job = $this->createExportJob($owner);

        $this->actingAs($stranger)
            ->getJson("/api/v1/fhir/\$export/{$job->id}")
            ->assertStatus(403);

        $this->actingAs($owner)
            ->getJson("/api/v1/fhir/\$export/{$job->id}")
            ->assertStatus(200)
            ->assertJsonPath('id', $job->id);

        $this->actingAs($superAdmin)
            ->getJson("/api/v1/fhir/\$export/{$job->id}")
            ->assertStatus(200)
            ->assertJsonPath('id', $job->id);
    }

    public function test_download_returns_only_listed_export_file_for_owner(): void
    {
        Storage::fake('local');
        $owner = $this->userWithRole('researcher');
        $job = $this->createExportJob($owner);
        $path = "fhir-exports/{$job->id}/Patient.ndjson";
        $body = '{"resourceType":"Patient","id":"1"}'."\n";

        $job->update([
            'files' => [[
                'resource_type' => 'Patient',
                'url' => $path,
                'count' => 1,
            ]],
        ]);
        Storage::disk('local')->put($path, $body);

        $response = $this->actingAs($owner)
            ->get("/api/v1/fhir/\$export/{$job->id}/download/Patient")
            ->assertStatus(200);

        $this->assertSame($body, $response->streamedContent());
    }

    public function test_download_rejects_unlisted_export_files(): void
    {
        Storage::fake('local');
        $owner = $this->userWithRole('researcher');
        $job = $this->createExportJob($owner);
        $path = "fhir-exports/{$job->id}/Observation.ndjson";

        $job->update([
            'files' => [[
                'resource_type' => 'Patient',
                'url' => "fhir-exports/{$job->id}/Patient.ndjson",
                'count' => 1,
            ]],
        ]);
        Storage::disk('local')->put($path, '{"resourceType":"Observation"}'."\n");

        $this->actingAs($owner)
            ->get("/api/v1/fhir/\$export/{$job->id}/download/Observation")
            ->assertStatus(404);
    }

    private function userWithRole(string $role): User
    {
        $user = User::factory()->create();
        $user->assignRole($role);

        return $user;
    }

    private function createExportJob(User $user): FhirExportJob
    {
        $source = Source::factory()->create();

        return FhirExportJob::create([
            'source_id' => $source->id,
            'status' => 'completed',
            'resource_types' => ['Patient'],
            'user_id' => $user->id,
        ]);
    }
}
