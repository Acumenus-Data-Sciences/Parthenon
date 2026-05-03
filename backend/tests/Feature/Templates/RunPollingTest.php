<?php

declare(strict_types=1);

namespace Tests\Feature\Templates;

use App\Jobs\Templates\PollTemplateRunJob;
use App\Models\App\TemplateRun;
use App\Models\User;
use App\Services\Templates\TemplateRegistryClient;
use App\Services\Templates\TemplateRunService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Bus;
use Mockery;
use Tests\TestCase;

class RunPollingTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config([
            'services.templates.url' => 'http://parthenon-templates:8000',
            'services.templates.internal_token' => 'test-token',
            'services.templates.timeout' => 5,
        ]);
    }

    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }

    public function test_non_terminal_status_redispatches_with_backoff(): void
    {
        Bus::fake([PollTemplateRunJob::class]);
        $user = User::factory()->create();
        $run = TemplateRun::create([
            'template_id' => 'hello_cdm', 'template_version' => '0.1.0', 'parameters' => [],
            'status' => TemplateRun::STATUS_RUNNING, 'submitted_by' => $user->id,
            'prefect_run_id' => '11111111-1111-1111-1111-111111111111',
        ]);

        $registry = Mockery::mock(TemplateRegistryClient::class);
        $registry->shouldReceive('getRun')->andReturn(['status' => 'running', 'progress' => 0.3]);
        $this->app->instance(TemplateRegistryClient::class, $registry);

        (new PollTemplateRunJob($run->id, 0))->handle($this->app->make(TemplateRunService::class));

        Bus::assertDispatched(PollTemplateRunJob::class, function (PollTemplateRunJob $job) use ($run): bool {
            return $job->templateRunId === $run->id && $job->attempt === 1;
        });
    }

    public function test_terminal_status_does_not_redispatch(): void
    {
        Bus::fake([PollTemplateRunJob::class]);
        $user = User::factory()->create();
        $run = TemplateRun::create([
            'template_id' => 'hello_cdm', 'template_version' => '0.1.0', 'parameters' => [],
            'status' => TemplateRun::STATUS_RUNNING, 'submitted_by' => $user->id,
            'prefect_run_id' => '22222222-2222-2222-2222-222222222222',
        ]);

        $registry = Mockery::mock(TemplateRegistryClient::class);
        $registry->shouldReceive('getRun')->andReturn(['status' => 'completed', 'progress' => 1.0]);
        $this->app->instance(TemplateRegistryClient::class, $registry);

        (new PollTemplateRunJob($run->id, 3))->handle($this->app->make(TemplateRunService::class));

        Bus::assertNotDispatched(PollTemplateRunJob::class);
    }

    public function test_backoff_sequence_caps_at_30s(): void
    {
        $job = new PollTemplateRunJob(1, 0);
        $this->assertSame(2, $job->delaySeconds());
        $this->assertSame(4, (new PollTemplateRunJob(1, 1))->delaySeconds());
        $this->assertSame(8, (new PollTemplateRunJob(1, 2))->delaySeconds());
        $this->assertSame(16, (new PollTemplateRunJob(1, 3))->delaySeconds());
        $this->assertSame(30, (new PollTemplateRunJob(1, 4))->delaySeconds()); // capped
        $this->assertSame(30, (new PollTemplateRunJob(1, 99))->delaySeconds());
    }

    public function test_missing_run_is_noop(): void
    {
        Bus::fake([PollTemplateRunJob::class]);
        (new PollTemplateRunJob(999_999, 0))->handle($this->app->make(TemplateRunService::class));
        Bus::assertNotDispatched(PollTemplateRunJob::class);
    }
}
