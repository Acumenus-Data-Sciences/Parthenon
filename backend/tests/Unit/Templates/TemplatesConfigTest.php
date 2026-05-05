<?php

declare(strict_types=1);

namespace Tests\Unit\Templates;

use Tests\TestCase;

class TemplatesConfigTest extends TestCase
{
    public function test_templates_service_url_has_default(): void
    {
        $this->assertSame('http://parthenon-templates:8000', config('services.templates.url'));
    }

    public function test_templates_internal_token_is_readable(): void
    {
        config(['services.templates.internal_token' => 'test-token-123']);
        $this->assertSame('test-token-123', config('services.templates.internal_token'));
    }

    public function test_templates_timeout_default(): void
    {
        $this->assertSame(5, config('services.templates.timeout'));
    }
}
