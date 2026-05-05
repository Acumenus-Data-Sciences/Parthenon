<?php

declare(strict_types=1);

namespace Tests\Feature\Templates;

use App\Models\App\TemplateRun;
use App\Models\User;
use App\Services\Templates\TemplateRegistryClient;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Bus;
use Mockery;
use Tests\TestCase;

class TemplatesControllerSubmitTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolePermissionSeeder::class);
        Bus::fake();

        // Bind a default registry mock so the container can resolve the
        // controller in permission/validation negative tests; individual
        // tests override this when they need specific expectations.
        $registry = Mockery::mock(TemplateRegistryClient::class);
        $registry->shouldIgnoreMissing();
        $this->app->instance(TemplateRegistryClient::class, $registry);
    }

    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }

    public function test_submit_requires_ingestion_run_permission(): void
    {
        $user = User::factory()->create();
        $user->givePermissionTo('ingestion.view'); // not run
        $this->actingAs($user)
            ->postJson('/api/v1/ingestion/templates/hello_cdm/runs', ['version' => '0.1.0'])
            ->assertStatus(403);
    }

    public function test_invalid_version_returns_422(): void
    {
        $user = User::factory()->create();
        $user->givePermissionTo(['ingestion.view', 'ingestion.run']);
        $this->actingAs($user)
            ->postJson('/api/v1/ingestion/templates/hello_cdm/runs', ['version' => 'not-semver'])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['version']);
    }

    public function test_valid_submission_returns_201_and_payload(): void
    {
        $user = User::factory()->create();
        $user->givePermissionTo(['ingestion.view', 'ingestion.run']);

        $registry = Mockery::mock(TemplateRegistryClient::class);
        $registry->shouldReceive('getTemplate')->andReturn([
            'id' => 'hello_cdm',
            'manifest' => ['singleton' => false, 'meta' => ['emits_cdm' => true]],
        ]);
        $registry->shouldReceive('submitRun')->andReturn([
            'prefect_run_id' => '11111111-1111-1111-1111-111111111111',
        ]);
        $this->app->instance(TemplateRegistryClient::class, $registry);

        $resp = $this->actingAs($user)
            ->postJson('/api/v1/ingestion/templates/hello_cdm/runs', [
                'version' => '0.1.0',
                'parameters' => ['target_schema' => 'eunomia'],
            ])
            ->assertStatus(201)
            ->assertJsonStructure(['template_run_id', 'ingestion_job_id', 'status']);

        $this->assertSame(1, TemplateRun::count());
        $run = TemplateRun::firstOrFail();
        $this->assertSame((string) $run->id, (string) $resp->json('template_run_id'));
        $this->assertSame('queued', $resp->json('status'));
    }
}
