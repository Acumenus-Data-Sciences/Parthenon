<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\JupyterAuditLog;
use Dedoc\Scramble\Attributes\Group;
use Firebase\JWT\JWT;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

#[Group('Jupyter', weight: 228)]
class JupyterController extends Controller
{
    private string $hubUrl;

    private string $baseUrl;

    private string $jwtSecret;

    private string $hubApiKey;

    public function __construct()
    {
        $this->hubUrl = rtrim(config('services.jupyter.hub_url', 'http://jupyterhub:8000'), '/');
        $this->baseUrl = '/'.trim(config('services.jupyter.base_url', '/jupyter'), '/');
        $this->jwtSecret = (string) config('services.jupyter.jwt_secret', '');
        $this->hubApiKey = (string) config('services.jupyter.hub_api_key', '');
    }

    /**
     * Check JupyterHub health.
     */
    public function health(): JsonResponse
    {
        try {
            $response = Http::timeout(10)->get("{$this->hubUrl}/jupyter/hub/health");

            return response()->json([
                'data' => [
                    'available' => $response->successful(),
                    'status' => $response->successful() ? 'healthy' : 'unavailable',
                ],
            ], $response->successful() ? 200 : 503);
        } catch (\Throwable) {
            return response()->json([
                'data' => [
                    'available' => false,
                    'status' => 'unavailable',
                ],
            ], 503);
        }
    }

    /**
     * Create a session — mint a JWT for Hub authentication.
     */
    public function session(Request $request): JsonResponse
    {
        $user = $request->user();
        $roles = $user->getRoleNames()->toArray();

        $now = time();
        $payload = [
            'sub' => $user->id,
            'email' => $user->email,
            'roles' => $roles,
            'iat' => $now,
            'exp' => $now + 60,
            'jti' => Str::uuid()->toString(),
        ];

        $token = JWT::encode($payload, $this->jwtSecret, 'HS256');

        return response()->json([
            'data' => [
                'token' => $token,
                'login_url' => "{$this->baseUrl}/hub/parthenon-login",
                'expires_in' => 60,
            ],
        ]);
    }

    /**
     * Receive audit events from JupyterHub.
     */
    public function audit(Request $request): JsonResponse
    {
        if ($request->header('X-Hub-Api-Key') !== $this->hubApiKey) {
            return response()->json(['error' => 'Unauthorized'], 401);
        }

        $validated = $request->validate([
            'event' => 'required|string|max:50',
            'user_id' => 'nullable|integer|exists:users,id',
            'metadata' => 'nullable|array',
        ]);

        JupyterAuditLog::create([
            'event' => $validated['event'],
            'user_id' => $validated['user_id'] ?? null,
            'metadata' => $validated['metadata'] ?? [],
            'ip_address' => $request->ip(),
        ]);

        return response()->json(['status' => 'ok']);
    }

    /**
     * Stop the current user's server.
     */
    public function destroySession(Request $request): JsonResponse
    {
        $user = $request->user();
        $hubUsername = "user-{$user->id}";

        try {
            Http::withHeaders(['Authorization' => "token {$this->hubApiKey}"])
                ->timeout(10)
                ->delete("{$this->hubUrl}/jupyter/hub/api/users/{$hubUsername}/server");
        } catch (\Throwable) {
            // Server may already be stopped
        }

        return response()->json(['status' => 'ok']);
    }

    /**
     * Get workspace info — Hub-aware.
     */
    public function workspace(Request $request): JsonResponse
    {
        $user = $request->user();
        $hubUsername = "user-{$user->id}";

        // Check Hub health
        $available = false;
        try {
            $healthResp = Http::timeout(5)->get("{$this->hubUrl}/jupyter/hub/health");
            $available = $healthResp->successful();
        } catch (\Throwable) {
            // Hub unavailable
        }

        // Check user server status
        $serverStatus = 'stopped';
        if ($available) {
            try {
                $userResp = Http::withHeaders(['Authorization' => "token {$this->hubApiKey}"])
                    ->timeout(5)
                    ->get("{$this->hubUrl}/jupyter/hub/api/users/{$hubUsername}");

                if ($userResp->successful()) {
                    $userData = $userResp->json();
                    $server = $userData['servers'][''] ?? null;
                    if ($server) {
                        $serverStatus = $server['ready'] ? 'running' : 'spawning';
                    }
                }
            } catch (\Throwable) {
                // Can't determine server status
            }
        }

        return response()->json([
            'data' => [
                'available' => $available,
                'status' => $available ? 'healthy' : 'unavailable',
                'server_status' => $serverStatus,
                'label' => 'Jupyter Research Workbench',
                'summary' => 'Per-user notebook environment with isolated workspace and role-based database access.',
                'workspace_path' => '/home/jovyan/notebooks',
                'shared_path' => '/home/jovyan/shared',
                'repository_path' => '/home/jovyan/parthenon',
                'mounts' => [
                    [
                        'label' => 'Private notebooks',
                        'path' => '/home/jovyan/notebooks',
                        'description' => 'Your personal notebook workspace. Persists across sessions.',
                    ],
                    [
                        'label' => 'Shared folder',
                        'path' => '/home/jovyan/shared',
                        'description' => 'Read-write folder shared with all Jupyter users. Use shared/{your_id}/ for your files.',
                    ],
                    [
                        'label' => 'Parthenon repository',
                        'path' => '/home/jovyan/parthenon',
                        'description' => 'Read-only mount of the full Parthenon codebase and docs.',
                    ],
                ],
                'starter_notebooks' => [
                    [
                        'name' => 'Parthenon Research Workbench',
                        'filename' => 'parthenon-research-workbench.ipynb',
                        'description' => 'Starter notebook with environment checks, API wiring, and research-oriented prompts.',
                    ],
                ],
                'hints' => [
                    'Your notebooks are private by default. Copy files to /shared/ to share with colleagues.',
                    'Database credentials are injected based on your role — use the starter notebook helpers.',
                    'Your server stops after 30 minutes of inactivity. All your work is saved and restored on next visit.',
                ],
            ],
        ]);
    }
}
