<?php

declare(strict_types=1);

namespace Tests\Unit\Templates;

use App\Models\App\TemplateRun;
use App\Models\User;
use App\Services\Templates\TemplateRegistryClient;
use App\Services\Templates\TemplateRunService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Mockery;
use RuntimeException;
use Tests\TestCase;

class TemplateRunServiceSingletonTest extends TestCase
{
    use RefreshDatabase;

    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }

    public function test_singleton_blocks_when_active_run_exists(): void
    {
        Queue::fake();
        $user = User::factory()->create();

        TemplateRun::create([
            'template_id' => 'load_synpuf',
            'template_version' => '0.1.0',
            'parameters' => [],
            'status' => TemplateRun::STATUS_RUNNING,
            'submitted_by' => $user->id,
        ]);

        $registry = Mockery::mock(TemplateRegistryClient::class);
        $registry->shouldReceive('getTemplate')->andReturn([
            'id' => 'load_synpuf',
            'manifest' => ['singleton' => true, 'meta' => ['emits_cdm' => true]],
        ]);
        // submitRun must NOT be called.
        $registry->shouldNotReceive('submitRun');

        $service = $this->app->makeWith(TemplateRunService::class, ['registry' => $registry]);

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessageMatches('/Singleton template already running/');
        $service->submit('load_synpuf', '0.1.0', [], $user);
    }

    public function test_singleton_allows_when_prior_run_is_terminal(): void
    {
        Queue::fake();
        $user = User::factory()->create();

        TemplateRun::create([
            'template_id' => 'load_synpuf',
            'template_version' => '0.1.0',
            'parameters' => [],
            'status' => TemplateRun::STATUS_COMPLETED,
            'submitted_by' => $user->id,
        ]);

        $registry = Mockery::mock(TemplateRegistryClient::class);
        $registry->shouldReceive('getTemplate')->andReturn([
            'id' => 'load_synpuf',
            'manifest' => ['singleton' => true, 'meta' => ['emits_cdm' => true]],
        ]);
        $registry->shouldReceive('submitRun')->andReturn(['prefect_run_id' => '33333333-3333-3333-3333-333333333333']);

        $service = $this->app->makeWith(TemplateRunService::class, ['registry' => $registry]);
        $run = $service->submit('load_synpuf', '0.1.0', [], $user);
        $this->assertSame(TemplateRun::STATUS_QUEUED, $run->status);
    }
}
