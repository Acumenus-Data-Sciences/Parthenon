<?php

declare(strict_types=1);

namespace Tests\Feature\Templates;

use App\Models\App\TemplateRun;
use App\Models\User;
use App\Services\Templates\TemplateRegistryClient;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery;
use Tests\TestCase;

class TemplatesControllerRunReadTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolePermissionSeeder::class);

        // Default registry mock so the controller can resolve from the
        // container even on permission-denied paths; tests override.
        $registry = Mockery::mock(TemplateRegistryClient::class);
        $registry->shouldIgnoreMissing();
        $this->app->instance(TemplateRegistryClient::class, $registry);
    }

    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }

    private function makeRun(User $user): TemplateRun
    {
        return TemplateRun::create([
            'template_id' => 'hello_cdm',
            'template_version' => '0.1.0',
            'parameters' => [],
            'status' => TemplateRun::STATUS_RUNNING,
            'submitted_by' => $user->id,
            'prefect_run_id' => '11111111-1111-1111-1111-111111111111',
        ]);
    }

    public function test_show_run_returns_row_and_linked_jobs(): void
    {
        $user = User::factory()->create();
        $user->givePermissionTo('ingestion.view');
        $run = $this->makeRun($user);

        $this->actingAs($user)
            ->getJson('/api/v1/ingestion/templates/runs/'.$run->id)
            ->assertOk()
            ->assertJsonPath('template_run.id', $run->id)
            ->assertJsonPath('template_run.status', TemplateRun::STATUS_RUNNING);
    }

    public function test_run_logs_proxies_to_python(): void
    {
        $user = User::factory()->create();
        $user->givePermissionTo('ingestion.view');
        $run = $this->makeRun($user);

        $registry = Mockery::mock(TemplateRegistryClient::class);
        $registry->shouldReceive('getLogs')->with('11111111-1111-1111-1111-111111111111')
            ->andReturn(['lines' => [['ts' => '2026-05-02T00:00:00Z', 'level' => 'info', 'message' => 'started']]]);
        $this->app->instance(TemplateRegistryClient::class, $registry);

        $this->actingAs($user)
            ->getJson('/api/v1/ingestion/templates/runs/'.$run->id.'/logs')
            ->assertOk()
            ->assertJsonPath('lines.0.message', 'started');
    }

    public function test_run_artifacts_proxies_to_python(): void
    {
        $user = User::factory()->create();
        $user->givePermissionTo('ingestion.view');
        $run = $this->makeRun($user);

        $registry = Mockery::mock(TemplateRegistryClient::class);
        $registry->shouldReceive('getArtifacts')->andReturn([
            'artifacts' => [['name' => 'summary.json', 'size' => 100]],
        ]);
        $this->app->instance(TemplateRegistryClient::class, $registry);

        $this->actingAs($user)
            ->getJson('/api/v1/ingestion/templates/runs/'.$run->id.'/artifacts')
            ->assertOk()
            ->assertJsonPath('artifacts.0.name', 'summary.json');
    }

    public function test_run_endpoints_require_view_permission(): void
    {
        $user = User::factory()->create();
        $run = $this->makeRun($user);

        $this->actingAs($user)
            ->getJson('/api/v1/ingestion/templates/runs/'.$run->id)
            ->assertStatus(403);
    }
}
