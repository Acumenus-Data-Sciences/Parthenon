<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\AiService;
use Illuminate\Http\Client\Response;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class WikiController extends Controller
{
    public function workspaces(AiService $aiService): JsonResponse
    {
        return $this->proxyJson($aiService->wikiWorkspaces());
    }

    public function initWorkspace(string $workspace, AiService $aiService): JsonResponse
    {
        return $this->proxyJson($aiService->wikiInitWorkspace($workspace));
    }

    public function pages(Request $request, AiService $aiService): JsonResponse
    {
        $validated = $request->validate([
            'workspace' => 'nullable|string|max:100',
            'q' => 'nullable|string|max:255',
        ]);

        return $this->proxyJson($aiService->wikiPages(
            $validated['workspace'] ?? 'platform',
            $validated['q'] ?? null,
        ));
    }

    public function showPage(Request $request, string $slug, AiService $aiService): JsonResponse
    {
        $validated = $request->validate([
            'workspace' => 'nullable|string|max:100',
        ]);

        return $this->proxyJson($aiService->wikiPage(
            $slug,
            $validated['workspace'] ?? 'platform',
        ));
    }

    public function activity(Request $request, AiService $aiService): JsonResponse
    {
        $validated = $request->validate([
            'workspace' => 'nullable|string|max:100',
            'limit' => 'nullable|integer|min:1|max:100',
        ]);

        return $this->proxyJson($aiService->wikiActivity(
            $validated['workspace'] ?? 'platform',
            $validated['limit'] ?? 50,
        ));
    }

    public function ingest(Request $request, AiService $aiService): JsonResponse
    {
        $validated = $request->validate([
            'workspace' => 'nullable|string|max:100',
            'title' => 'nullable|string|max:255',
            'raw_content' => 'nullable|string|max:50000',
            'file' => 'nullable|file|max:20480',
        ]);

        if (! $request->hasFile('file') && empty($validated['raw_content'])) {
            return response()->json([
                'detail' => 'Either file or raw_content is required.',
            ], 422);
        }

        return $this->proxyJson(
            $aiService->wikiIngest(
                $validated['workspace'] ?? 'platform',
                $request->file('file'),
                $validated['title'] ?? null,
                $validated['raw_content'] ?? null,
            )
        );
    }

    public function query(Request $request, AiService $aiService): JsonResponse
    {
        $validated = $request->validate([
            'workspace' => 'nullable|string|max:100',
            'question' => 'required|string|min:3|max:4000',
        ]);

        return $this->proxyJson($aiService->wikiQuery(
            $validated['workspace'] ?? 'platform',
            $validated['question'],
        ));
    }

    public function lint(Request $request, AiService $aiService): JsonResponse
    {
        $validated = $request->validate([
            'workspace' => 'nullable|string|max:100',
        ]);

        return $this->proxyJson($aiService->wikiLint(
            $validated['workspace'] ?? 'platform',
        ));
    }

    private function proxyJson(Response $response): JsonResponse
    {
        $body = $response->json();
        $status = $response->status();

        // Surface upstream errors instead of returning empty {}
        if ($body === null && $status >= 400) {
            $body = ['detail' => 'AI service returned '.$status.': '.$response->body()];
        }

        return response()->json($body ?? (object) [], $status);
    }
}
