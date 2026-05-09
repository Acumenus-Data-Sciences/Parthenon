<?php

declare(strict_types=1);

namespace Tests\Unit\Templates;

use App\Models\App\IngestionJob;
use App\Models\App\TemplateRun;
use App\Models\User;
use App\Services\Templates\TemplateRegistryClient;
use App\Services\Templates\TemplateRunService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery;
use Tests\TestCase;

class TemplateRunServicePollTest extends TestCase
{
    use RefreshDatabase;

    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }

    public function test_poll_updates_status_and_progress_and_current_node(): void
    {
        $user = User::factory()->create();
        $run = TemplateRun::create([
            'template_id' => 'hello_cdm', 'template_version' => '0.1.0', 'parameters' => [],
            'status' => TemplateRun::STATUS_QUEUED, 'submitted_by' => $user->id,
            'prefect_run_id' => '11111111-1111-1111-1111-111111111111',
        ]);

        $registry = Mockery::mock(TemplateRegistryClient::class);
        $registry->shouldReceive('getRun')->with('11111111-1111-1111-1111-111111111111')->andReturn([
            'status' => 'running',
            'progress' => 0.42,
            'current_node' => 'load_csv',
            'started_at' => '2026-05-02T01:00:00Z',
        ]);

        $service = $this->app->makeWith(TemplateRunService::class, ['registry' => $registry]);
        $service->pollAndUpdate($run);

        $run->refresh();
        $this->assertSame(TemplateRun::STATUS_RUNNING, $run->status);
        $this->assertEqualsWithDelta(0.42, $run->progress, 0.001);
        $this->assertSame('load_csv', $run->current_node);
    }

    public function test_poll_marks_completed_and_propagates_to_ingestion_job(): void
    {
        $user = User::factory()->create();
        $run = TemplateRun::create([
            'template_id' => 'load_synpuf', 'template_version' => '0.1.0', 'parameters' => [],
            'status' => TemplateRun::STATUS_RUNNING, 'submitted_by' => $user->id,
            'prefect_run_id' => '22222222-2222-2222-2222-222222222222',
        ]);
        $job = IngestionJob::create([
            'kind' => 'template', 'status' => 'pending',
            'template_run_id' => $run->id, 'created_by' => $user->id,
        ]);

        $registry = Mockery::mock(TemplateRegistryClient::class);
        $registry->shouldReceive('getRun')->andReturn([
            'status' => 'completed',
            'progress' => 1.0,
            'finished_at' => '2026-05-02T01:30:00Z',
            'post_conditions' => [['kind' => 'row_count', 'status' => 'pass']],
        ]);

        $service = $this->app->makeWith(TemplateRunService::class, ['registry' => $registry]);
        $service->pollAndUpdate($run);

        $run->refresh();
        $job->refresh();
        $this->assertSame(TemplateRun::STATUS_COMPLETED, $run->status);
        $this->assertSame('completed', (string) $job->status->value ?? $job->status);
        $this->assertNotEmpty($run->post_conditions);
    }

    public function test_poll_marks_failed_and_captures_error(): void
    {
        $user = User::factory()->create();
        $run = TemplateRun::create([
            'template_id' => 'hello_cdm', 'template_version' => '0.1.0', 'parameters' => [],
            'status' => TemplateRun::STATUS_RUNNING, 'submitted_by' => $user->id,
            'prefect_run_id' => '33333333-3333-3333-3333-333333333333',
        ]);

        $registry = Mockery::mock(TemplateRegistryClient::class);
        $registry->shouldReceive('getRun')->andReturn([
            'status' => 'failed',
            'progress' => 0.5,
            'error' => 'node csv_reader: file not found',
            'finished_at' => '2026-05-02T01:05:00Z',
        ]);

        $service = $this->app->makeWith(TemplateRunService::class, ['registry' => $registry]);
        $service->pollAndUpdate($run);

        $run->refresh();
        $this->assertSame(TemplateRun::STATUS_FAILED, $run->status);
        $this->assertStringContainsString('csv_reader', (string) $run->error_message);
    }

    public function test_cancel_calls_python_and_marks_cancelled(): void
    {
        $user = User::factory()->create();
        $run = TemplateRun::create([
            'template_id' => 'hello_cdm', 'template_version' => '0.1.0', 'parameters' => [],
            'status' => TemplateRun::STATUS_RUNNING, 'submitted_by' => $user->id,
            'prefect_run_id' => '44444444-4444-4444-4444-444444444444',
        ]);

        $registry = Mockery::mock(TemplateRegistryClient::class);
        $registry->shouldReceive('cancelRun')->with('44444444-4444-4444-4444-444444444444')->andReturn(['status' => 'cancelled']);
        // After cancel, the service polls upstream once to reconcile state.
        // A non-terminal upstream status (or unreachable) means we keep the
        // optimistic CANCELLED.
        $registry->shouldReceive('getRun')->with('44444444-4444-4444-4444-444444444444')->andReturn(['status' => 'cancelled']);

        $service = $this->app->makeWith(TemplateRunService::class, ['registry' => $registry]);
        $service->cancel($run);

        $this->assertSame(TemplateRun::STATUS_CANCELLED, $run->refresh()->status);
    }

    public function test_cancel_is_noop_for_terminal_run(): void
    {
        $user = User::factory()->create();
        $run = TemplateRun::create([
            'template_id' => 'hello_cdm', 'template_version' => '0.1.0', 'parameters' => [],
            'status' => TemplateRun::STATUS_COMPLETED, 'submitted_by' => $user->id,
            'prefect_run_id' => '55555555-5555-5555-5555-555555555555',
        ]);

        $registry = Mockery::mock(TemplateRegistryClient::class);
        $registry->shouldNotReceive('cancelRun');

        $service = $this->app->makeWith(TemplateRunService::class, ['registry' => $registry]);
        $service->cancel($run);

        $this->assertSame(TemplateRun::STATUS_COMPLETED, $run->refresh()->status);
    }
}
