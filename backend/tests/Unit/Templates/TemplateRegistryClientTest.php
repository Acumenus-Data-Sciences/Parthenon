<?php

declare(strict_types=1);

namespace Tests\Unit\Templates;

use App\Exceptions\Templates\TemplateRegistryException;
use App\Services\Templates\TemplateRegistryClient;
use GuzzleHttp\Client;
use GuzzleHttp\Exception\ConnectException;
use GuzzleHttp\Handler\MockHandler;
use GuzzleHttp\HandlerStack;
use GuzzleHttp\Middleware;
use GuzzleHttp\Psr7\Request;
use GuzzleHttp\Psr7\Response;
use PHPUnit\Framework\TestCase;

class TemplateRegistryClientTest extends TestCase
{
    /** @var array<int,array<string,mixed>> */
    private array $history = [];

    private function makeClient(MockHandler $mock): TemplateRegistryClient
    {
        $stack = HandlerStack::create($mock);
        $this->history = [];
        $stack->push(Middleware::history($this->history));

        return new TemplateRegistryClient(
            new Client(['handler' => $stack, 'base_uri' => 'http://parthenon-templates:8000', 'timeout' => 5]),
            'secret-token',
        );
    }

    public function test_list_templates_returns_decoded_payload(): void
    {
        $payload = [['id' => 'hello_cdm', 'version' => '0.1.0', 'name' => 'Hello CDM']];
        $client = $this->makeClient(new MockHandler([
            new Response(200, ['Content-Type' => 'application/json'], (string) json_encode($payload)),
        ]));

        $this->assertSame($payload, $client->listTemplates());
        /** @var Request $req */
        $req = $this->history[0]['request'];
        $this->assertSame('GET', $req->getMethod());
        $this->assertSame('/templates', $req->getUri()->getPath());
        $this->assertSame('secret-token', $req->getHeaderLine('X-Parthenon-Internal-Token'));
    }

    public function test_get_template_returns_decoded_payload(): void
    {
        $payload = ['id' => 'hello_cdm', 'manifest' => ['name' => 'Hello CDM']];
        $client = $this->makeClient(new MockHandler([
            new Response(200, ['Content-Type' => 'application/json'], (string) json_encode($payload)),
        ]));

        $this->assertSame($payload, $client->getTemplate('hello_cdm'));
        /** @var Request $req */
        $req = $this->history[0]['request'];
        $this->assertSame('/templates/hello_cdm', $req->getUri()->getPath());
    }

    public function test_list_templates_throws_on_500(): void
    {
        $client = $this->makeClient(new MockHandler([
            new Response(500, [], 'kaboom'),
        ]));

        $this->expectException(TemplateRegistryException::class);
        $client->listTemplates();
    }

    public function test_list_templates_throws_on_connect_error(): void
    {
        $req = new Request('GET', '/templates');
        $client = $this->makeClient(new MockHandler([
            new ConnectException('connection refused', $req),
        ]));

        $this->expectException(TemplateRegistryException::class);
        $client->listTemplates();
    }

    public function test_submit_run_posts_payload_and_returns_response(): void
    {
        $payload = ['prefect_run_id' => '11111111-1111-1111-1111-111111111111', 'manifest' => ['singleton' => true]];
        $client = $this->makeClient(new MockHandler([
            new Response(200, ['Content-Type' => 'application/json'], (string) json_encode($payload)),
        ]));

        $result = $client->submitRun(
            'hello_cdm',
            '0.1.0',
            ['target_schema' => 'eunomia'],
            '99999999-9999-9999-9999-999999999999',
        );

        $this->assertSame($payload, $result);
        /** @var Request $req */
        $req = $this->history[0]['request'];
        $this->assertSame('POST', $req->getMethod());
        $this->assertSame('/runs', $req->getUri()->getPath());
        /** @var array<string,mixed> $body */
        $body = json_decode((string) $req->getBody(), true);
        $this->assertSame('hello_cdm', $body['template_id']);
        $this->assertSame('0.1.0', $body['version']);
        $this->assertSame(['target_schema' => 'eunomia'], $body['parameters']);
        $this->assertSame('99999999-9999-9999-9999-999999999999', $body['correlation_id']);
    }

    public function test_submit_run_throws_on_422(): void
    {
        $client = $this->makeClient(new MockHandler([
            new Response(422, [], json_encode(['detail' => 'parameter X required']) ?: ''),
        ]));

        $this->expectException(TemplateRegistryException::class);
        $client->submitRun('hello_cdm', '0.1.0', [], 'corr');
    }
}
