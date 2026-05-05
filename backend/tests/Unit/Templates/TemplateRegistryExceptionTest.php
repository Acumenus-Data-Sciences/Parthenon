<?php

declare(strict_types=1);

namespace Tests\Unit\Templates;

use App\Exceptions\Templates\TemplateRegistryException;
use GuzzleHttp\Exception\ConnectException;
use GuzzleHttp\Psr7\Request;
use PHPUnit\Framework\TestCase;

class TemplateRegistryExceptionTest extends TestCase
{
    public function test_from_status_captures_status_and_body(): void
    {
        $e = TemplateRegistryException::fromStatus(503, 'service down', 'GET /templates');
        $this->assertSame(503, $e->getStatusCode());
        $this->assertSame('service down', $e->getResponseBody());
        $this->assertStringContainsString('GET /templates', $e->getMessage());
    }

    public function test_from_connect_returns_zero_status(): void
    {
        $inner = new ConnectException('connect timed out', new Request('GET', '/templates'));
        $e = TemplateRegistryException::fromConnect($inner, 'GET /templates');
        $this->assertSame(0, $e->getStatusCode());
        $this->assertStringContainsString('connect', $e->getMessage());
    }
}
