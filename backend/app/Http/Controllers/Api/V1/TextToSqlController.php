<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

#[Group('Text-to-SQL', weight: 227)]
class TextToSqlController extends Controller
{
    private string $aiUrl;

    public function __construct()
    {
        $this->aiUrl = rtrim(config('services.ai.url', 'http://python-ai:8000'), '/');
    }

    /**
     * POST /api/v1/text-to-sql/generate
     *
     * Translate a natural-language question into a SQL query against the OMOP CDM.
     * Proxies to the Python AI service at POST /text-to-sql/generate.
     *
     * Accepts any JSON body; the AI service defines the schema.
     */
    public function generate(Request $request): JsonResponse
    {
        try {
            $response = Http::timeout(60)
                ->withBody($request->getContent(), 'application/json')
                ->post("{$this->aiUrl}/text-to-sql/generate");

            if ($response->failed()) {
                Log::warning('TextToSql generate failed', [
                    'status' => $response->status(),
                    'body' => $response->body(),
                ]);

                return response()->json([
                    'error' => 'SQL generation failed',
                    'detail' => $response->json('detail') ?? $response->body(),
                ], $response->status() ?: 502);
            }

            return response()->json(['data' => $response->json()]);

        } catch (\Throwable $e) {
            Log::error('TextToSqlController::generate exception', ['message' => $e->getMessage()]);

            return response()->json([
                'error' => 'Text-to-SQL service unavailable',
                'message' => $e->getMessage(),
            ], 503);
        }
    }

    /**
     * POST /api/v1/text-to-sql/validate
     *
     * Validate a generated SQL query for safety and correctness before execution.
     * Proxies to the Python AI service at POST /text-to-sql/validate.
     *
     * Accepts any JSON body; the AI service defines the schema.
     */
    public function validate(Request $request): JsonResponse
    {
        try {
            $response = Http::timeout(15)
                ->withBody($request->getContent(), 'application/json')
                ->post("{$this->aiUrl}/text-to-sql/validate");

            if ($response->failed()) {
                Log::warning('TextToSql validate failed', [
                    'status' => $response->status(),
                    'body' => $response->body(),
                ]);

                return response()->json([
                    'error' => 'SQL validation failed',
                    'detail' => $response->json('detail') ?? $response->body(),
                ], $response->status() ?: 502);
            }

            return response()->json(['data' => $response->json()]);

        } catch (\Throwable $e) {
            Log::error('TextToSqlController::validate exception', ['message' => $e->getMessage()]);

            return response()->json([
                'error' => 'Text-to-SQL service unavailable',
                'message' => $e->getMessage(),
            ], 503);
        }
    }

    /**
     * GET /api/v1/text-to-sql/schema
     *
     * Retrieve the CDM schema context used by the text-to-SQL model
     * (tables, columns, descriptions).
     * Proxies to the Python AI service at GET /text-to-sql/schema.
     */
    public function schema(): JsonResponse
    {
        try {
            $response = Http::timeout(10)->get(
                "{$this->aiUrl}/text-to-sql/schema"
            );

            if ($response->failed()) {
                return response()->json([
                    'error' => 'Failed to retrieve SQL schema context',
                    'detail' => $response->json('detail') ?? $response->body(),
                ], $response->status() ?: 502);
            }

            return response()->json(['data' => $response->json()]);

        } catch (\Throwable $e) {
            Log::error('TextToSqlController::schema exception', ['message' => $e->getMessage()]);

            return response()->json([
                'error' => 'Text-to-SQL service unavailable',
                'message' => $e->getMessage(),
            ], 503);
        }
    }
}
