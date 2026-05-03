<?php

declare(strict_types=1);

namespace Tests\Unit\Templates;

use App\Exceptions\Templates\TemplateRegistryException;
use App\Jobs\Templates\PollTemplateRunJob;
use App\Models\App\IngestionJob;
use App\Models\App\TemplateRun;
use App\Models\User;
use App\Services\Templates\TemplateRegistryClient;
use App\Services\Templates\TemplateRunService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Mockery;
use Tests\TestCase;

class TemplateRunServiceSubmitTest extends TestCase
{
    use RefreshDatabase;

    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }

    public function test_submit_creates_template_run_and_dispatches_job(): void
    {
        Queue::fake();
        $user = User::factory()->create();

        $registry = Mockery::mock(TemplateRegistryClient::class);
        $registry->shouldReceive('getTemplate')
            ->with('hello_cdm')
            ->andReturn(['id' => 'hello_cdm', 'manifest' => ['singleton' => false, 'meta' => ['emits_cdm' => false]]]);
        $registry->shouldReceive('submitRun')
            ->andReturn(['prefect_run_id' => '11111111-1111-1111-1111-111111111111']);

        /** @var TemplateRunService $service */
        $service = $this->app->makeWith(TemplateRunService::class, ['registry' => $registry]);

        $run = $service->submit('hello_cdm', '0.1.0', ['target_schema' => 'eunomia'], $user);

        $this->assertInstanceOf(TemplateRun::class, $run);
        $this->assertSame(TemplateRun::STATUS_QUEUED, $run->status);
        $this->assertSame('11111111-1111-1111-1111-111111111111', $run->prefect_run_id);
        $this->assertSame($user->id, $run->submitted_by);
        $this->assertSame(['target_schema' => 'eunomia'], $run->parameters);

        Queue::assertPushed(PollTemplateRunJob::class);
    }

    public function test_submit_creates_ingestion_job_when_template_emits_cdm(): void
    {
        Queue::fake();
        $user = User::factory()->create();

        $registry = Mockery::mock(TemplateRegistryClient::class);
        $registry->shouldReceive('getTemplate')->andReturn([
            'id' => 'load_synpuf',
            'manifest' => ['singleton' => false, 'meta' => ['emits_cdm' => true]],
        ]);
        $registry->shouldReceive('submitRun')->andReturn(['prefect_run_id' => '22222222-2222-2222-2222-222222222222']);

        $service = $this->app->makeWith(TemplateRunService::class, ['registry' => $registry]);
        $run = $service->submit('load_synpuf', '0.1.0', [], $user);

        $job = IngestionJob::where('template_run_id', $run->id)->firstOrFail();
        $this->assertSame('template', $job->kind);
    }

    public function test_submit_rolls_back_when_python_fails(): void
    {
        Queue::fake();
        $user = User::factory()->create();

        $registry = Mockery::mock(TemplateRegistryClient::class);
        $registry->shouldReceive('getTemplate')->andReturn([
            'id' => 'hello_cdm',
            'manifest' => ['singleton' => false, 'meta' => ['emits_cdm' => false]],
        ]);
        $registry->shouldReceive('submitRun')->andThrow(TemplateRegistryException::fromStatus(503, 'down', 'POST /runs'));

        $service = $this->app->makeWith(TemplateRunService::class, ['registry' => $registry]);

        try {
            $service->submit('hello_cdm', '0.1.0', [], $user);
            $this->fail('Expected TemplateRegistryException');
        } catch (TemplateRegistryException $e) {
            $this->assertSame(0, TemplateRun::count());
            $this->assertSame(0, IngestionJob::where('kind', 'template')->count());
        }

        Queue::assertNothingPushed();
    }
}
