<?php

declare(strict_types=1);

namespace Tests\Feature\Templates;

use App\Jobs\Templates\PollTemplateRunJob;
use App\Models\App\IngestionJob;
use App\Models\App\TemplateRun;
use App\Models\User;
use App\Services\Templates\TemplateRegistryClient;
use App\Services\Templates\TemplateRunService;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Bus;
use Mockery;
use Tests\TestCase;

class TemplateRunEndToEndTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolePermissionSeeder::class);
        // Defer the PollTemplateRunJob so we can drive the polling steps
        // explicitly in the test rather than letting the sync queue chain
        // them all the way to a terminal state during submit().
        Bus::fake([PollTemplateRunJob::class]);
    }

    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }

    public function test_full_submit_to_completion_flow(): void
    {
        $user = User::factory()->create();
        $user->givePermissionTo(['ingestion.view', 'ingestion.run']);

        $registry = Mockery::mock(TemplateRegistryClient::class);
        $registry->shouldReceive('getTemplate')->andReturn([
            'id' => 'hello_cdm',
            'manifest' => ['singleton' => false, 'meta' => ['emits_cdm' => true]],
        ]);
        $registry->shouldReceive('submitRun')->andReturn(['prefect_run_id' => 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa']);
        $registry->shouldReceive('getRun')->andReturnUsing(function (): array {
            static $calls = 0;
            $calls++;
            if ($calls === 1) {
                return ['status' => 'running', 'progress' => 0.3, 'current_node' => 'load_csv'];
            }

            return ['status' => 'completed', 'progress' => 1.0, 'finished_at' => '2026-05-02T01:30:00Z'];
        });
        $this->app->instance(TemplateRegistryClient::class, $registry);

        // 1. Submit
        $resp = $this->actingAs($user)
            ->postJson('/api/v1/ingestion/templates/hello_cdm/runs', [
                'version' => '0.1.0',
                'parameters' => ['target_schema' => 'eunomia'],
            ])
            ->assertStatus(201);

        $runId = (int) $resp->json('template_run_id');
        $this->assertGreaterThan(0, $runId);
        $run = TemplateRun::findOrFail($runId);
        $this->assertSame(TemplateRun::STATUS_QUEUED, $run->status);
        $this->assertSame(1, IngestionJob::where('template_run_id', $runId)->count());
        Bus::assertDispatched(PollTemplateRunJob::class);

        // 2. First poll → still running
        $service = $this->app->make(TemplateRunService::class);
        (new PollTemplateRunJob($runId, 0))->handle($service);
        $run->refresh();
        $this->assertSame(TemplateRun::STATUS_RUNNING, $run->status);

        // 3. Second poll → completed
        (new PollTemplateRunJob($runId, 1))->handle($service);
        $run->refresh();
        $this->assertSame(TemplateRun::STATUS_COMPLETED, $run->status);

        // 4. Show endpoint reflects terminal state.
        // Contract change (2026-05-08): showRun returns the flat TemplateRun
        // payload (no template_run/ingestion_jobs envelope) — see
        // TemplatePresenter::run.
        $this->actingAs($user)
            ->getJson('/api/v1/ingestion/templates/runs/'.$runId)
            ->assertOk()
            ->assertJsonPath('id', $runId)
            ->assertJsonPath('status', TemplateRun::STATUS_COMPLETED);
    }
}
