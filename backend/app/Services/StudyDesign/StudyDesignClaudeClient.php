<?php

namespace App\Services\StudyDesign;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use RuntimeException;

class StudyDesignClaudeClient
{
    /**
     * @param  array<string, mixed>  $body
     * @return array<string, mixed>
     */
    public function createMessage(array $body, string $apiKey): array
    {
        try {
            $response = Http::timeout((int) config('services.anthropic.timeout', 120))
                ->withHeaders([
                    'x-api-key' => $apiKey,
                    'anthropic-version' => '2023-06-01',
                    'content-type' => 'application/json',
                ])
                ->post('https://api.anthropic.com/v1/messages', $body);
        } catch (ConnectionException $exception) {
            throw new RuntimeException('Abby protocol evaluator request failed: '.$exception->getMessage(), previous: $exception);
        }

        if ($response->failed()) {
            $message = $response->json('error.message');
            if (! is_string($message) || $message === '') {
                $message = $response->body();
            }

            throw new RuntimeException('Abby protocol evaluator returned HTTP '.$response->status().': '.$message);
        }

        $payload = $response->json();

        return is_array($payload) ? $payload : [];
    }
}
