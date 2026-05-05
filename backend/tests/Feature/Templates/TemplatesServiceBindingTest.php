<?php

declare(strict_types=1);

namespace Tests\Feature\Templates;

use App\Services\Templates\TemplateRegistryClient;
use Tests\TestCase;

class TemplatesServiceBindingTest extends TestCase
{
    public function test_container_resolves_template_registry_client(): void
    {
        config([
            'services.templates.url' => 'http://parthenon-templates:8000',
            'services.templates.internal_token' => 'test-token',
            'services.templates.timeout' => 5,
        ]);

        $client = $this->app->make(TemplateRegistryClient::class);
        $this->assertInstanceOf(TemplateRegistryClient::class, $client);
    }

    public function test_missing_internal_token_throws_clear_error(): void
    {
        config(['services.templates.internal_token' => null]);

        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessageMatches('/TEMPLATES_INTERNAL_TOKEN/');

        $this->app->make(TemplateRegistryClient::class);
    }
}
