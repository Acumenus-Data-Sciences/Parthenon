<?php

use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;

/**
 * Contract tests for the python-ai FastAPI service via the `services.ai.url`
 * configured URL. Each test gracefully skips when the service is unreachable.
 */
function aiServiceHealthUrl(): string
{
    return rtrim((string) config('services.ai.url'), '/').'/health';
}

it('reaches python-ai /health and returns the expected top-level shape', function () {
    try {
        /** @var Response $response */
        $response = Http::timeout(30)->get(aiServiceHealthUrl());
    } catch (Throwable $e) {
        $this->markTestSkipped('python-ai not reachable: '.$e->getMessage());
    }

    if (! $response->successful()) {
        $this->markTestSkipped('python-ai returned HTTP '.$response->status());
    }

    $body = $response->json();

    expect($body)->toBeArray()
        ->and($body)->toHaveKeys(['status', 'service', 'llm'])
        ->and($body['service'])->toBe('parthenon-ai')
        ->and($body['llm'])->toBeArray()
        ->and($body['llm'])->toHaveKeys(['provider', 'model', 'base_url']);
});

it('returns ollama as the configured llm provider', function () {
    try {
        /** @var Response $response */
        $response = Http::timeout(30)->get(aiServiceHealthUrl());
    } catch (Throwable $e) {
        $this->markTestSkipped('python-ai not reachable: '.$e->getMessage());
    }

    if (! $response->successful()) {
        $this->markTestSkipped('python-ai returned HTTP '.$response->status());
    }

    $body = $response->json();
    expect($body)->toBeArray();
    expect($body['llm'])->toBeArray();
    expect($body['llm']['provider'])->toBe('ollama');
});

it('returns a non-empty llm model name and base_url', function () {
    try {
        /** @var Response $response */
        $response = Http::timeout(30)->get(aiServiceHealthUrl());
    } catch (Throwable $e) {
        $this->markTestSkipped('python-ai not reachable: '.$e->getMessage());
    }

    if (! $response->successful()) {
        $this->markTestSkipped('python-ai returned HTTP '.$response->status());
    }

    $body = $response->json();
    expect($body)->toBeArray();
    expect($body['llm'])->toBeArray();
    expect($body['llm']['model'])->toBeString()->not->toBe('');
    expect($body['llm']['base_url'])->toBeString()->not->toBe('');
});
