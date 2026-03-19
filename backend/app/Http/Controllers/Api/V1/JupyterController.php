<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Http;

#[Group('Jupyter', weight: 228)]
class JupyterController extends Controller
{
    private string $serviceUrl;

    private string $baseUrl;

    private string $token;

    public function __construct()
    {
        $this->serviceUrl = rtrim(config('services.jupyter.url', 'http://jupyter:8888'), '/');
        $this->baseUrl = '/'.trim(config('services.jupyter.base_url', '/jupyter'), '/');
        $this->token = (string) config('services.jupyter.token', 'parthenon-local-jupyter');
    }

    public function health(): JsonResponse
    {
        $response = Http::timeout(10)->get($this->statusEndpoint());

        if ($response->failed()) {
            return response()->json([
                'data' => [
                    'available' => false,
                    'status' => 'unavailable',
                ],
            ], 503);
        }

        return response()->json([
            'data' => [
                'available' => true,
                'status' => 'healthy',
                'details' => $response->json(),
            ],
        ]);
    }

    public function workspace(): JsonResponse
    {
        $status = Http::timeout(10)->get($this->statusEndpoint());
        $available = $status->successful();
        $labUrl = "{$this->baseUrl}/lab/tree?token={$this->token}";
        $treeUrl = "{$this->baseUrl}/lab/tree?token={$this->token}";
        $starterUrl = "{$this->baseUrl}/lab/tree/parthenon-research-workbench.ipynb?token={$this->token}";

        return response()->json([
            'data' => [
                'available' => $available,
                'status' => $available ? 'healthy' : 'unavailable',
                'label' => 'Jupyter Research Workbench',
                'summary' => 'Run exploratory notebooks directly inside Parthenon with the shared research workspace mounted and a seeded starter notebook.',
                'embed_url' => $labUrl,
                'lab_url' => $labUrl,
                'tree_url' => $treeUrl,
                'starter_notebook_url' => $starterUrl,
                'base_url' => "{$this->baseUrl}/?token={$this->token}",
                'workspace_path' => 'output/jupyter-notebook',
                'repository_path' => '/workspace/parthenon',
                'mounts' => [
                    [
                        'label' => 'Notebook workspace',
                        'path' => '/workspace/notebooks',
                        'description' => 'Persistent writable workspace mapped to output/jupyter-notebook in the repo.',
                    ],
                    [
                        'label' => 'Parthenon repository',
                        'path' => '/workspace/parthenon',
                        'description' => 'Read-only mount of the full Parthenon codebase and docs for reference.',
                    ],
                ],
                'starter_notebooks' => [
                    [
                        'name' => 'Parthenon Research Workbench',
                        'filename' => 'parthenon-research-workbench.ipynb',
                        'description' => 'Starter notebook with environment checks, API wiring, and research-oriented prompts tailored to Parthenon.',
                        'url' => $starterUrl,
                    ],
                ],
                'health' => $available ? $status->json() : null,
                'hints' => [
                    'Use the embedded lab for exploratory analysis, then attach outputs back to studies or publication workflows.',
                    'The notebook workspace persists under output/jupyter-notebook so generated notebooks stay in the repository.',
                    'Environment variables inside the notebook container include Parthenon API and database connection hints for advanced users.',
                ],
            ],
        ]);
    }

    private function statusEndpoint(): string
    {
        return "{$this->serviceUrl}{$this->baseUrl}/api/status?token={$this->token}";
    }
}
