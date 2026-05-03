<?php

declare(strict_types=1);

namespace Tests\Feature\Templates;

use App\Exceptions\Templates\TemplateRegistryException;
use App\Services\Templates\TemplateRegistryClient;
use Illuminate\Support\Facades\Cache;
use Mockery;
use Tests\TestCase;

class SyncCatalogCommandTest extends TestCase
{
    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }

    public function test_sync_writes_digest_log_and_caches_catalog(): void
    {
        $registry = Mockery::mock(TemplateRegistryClient::class);
        $registry->shouldReceive('listTemplates')->once()->andReturn([
            ['id' => 'hello_cdm', 'version' => '0.1.0'],
            ['id' => 'load_synpuf', 'version' => '0.1.0'],
        ]);
        $this->app->instance(TemplateRegistryClient::class, $registry);

        $this->artisan('templates:sync')
            ->expectsOutputToContain('templates synced: 2')
            ->assertSuccessful();

        $cached = Cache::get('templates:catalog');
        $this->assertIsArray($cached);
        $this->assertCount(2, $cached);
    }

    public function test_sync_handles_registry_failure(): void
    {
        $registry = Mockery::mock(TemplateRegistryClient::class);
        $registry->shouldReceive('listTemplates')->andThrow(new TemplateRegistryException('down', 503));
        $this->app->instance(TemplateRegistryClient::class, $registry);

        $this->artisan('templates:sync')
            ->expectsOutputToContain('templates sync failed')
            ->assertFailed();
    }
}
