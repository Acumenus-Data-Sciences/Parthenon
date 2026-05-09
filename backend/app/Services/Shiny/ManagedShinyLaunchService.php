<?php

namespace App\Services\Shiny;

use App\Models\App\Study;
use App\Models\App\StudyArtifact;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class ManagedShinyLaunchService
{
    public function __construct(private readonly ManagedShinyAppRegistry $registry) {}

    /**
     * @return array<string, mixed>
     */
    public function create(Study $study, StudyArtifact $artifact, User $user, ?string $appKey = null, string $mode = 'embedded'): array
    {
        if ((int) $artifact->study_id !== (int) $study->id) {
            throw ValidationException::withMessages([
                'artifact' => ['Artifact does not belong to this study.'],
            ]);
        }

        if ($artifact->artifact_type === 'shiny_app_url') {
            throw ValidationException::withMessages([
                'artifact' => ['Legacy Shiny URL artifacts are not launchable.'],
            ]);
        }

        $apps = $this->registry->appsForArtifact($artifact);
        $app = $appKey !== null ? $this->registry->find($appKey) : ($apps[0] ?? null);

        if ($app === null || ! $this->registry->supportsArtifact($app, $artifact)) {
            throw ValidationException::withMessages([
                'app_key' => ['No managed OHDSI Shiny app is registered for this artifact.'],
            ]);
        }

        $launchModes = $app['launch_modes'] ?? [];
        if (! in_array($mode, $launchModes, true)) {
            throw ValidationException::withMessages([
                'mode' => ['The requested launch mode is not supported for this managed Shiny app.'],
            ]);
        }

        $ttlMinutes = max(1, (int) config('services.shiny_proxy.launch_ttl_minutes', 15));
        $expiresAt = now()->addMinutes($ttlMinutes);
        $baseUrl = trim((string) config('services.shiny_proxy.base_url', ''));
        $runtime = (string) config('services.shiny_proxy.runtime', $app['runtime_preference'] ?? 'shinyproxy');
        $runtimeConfigured = $baseUrl !== '';
        $token = $runtimeConfigured ? $this->createToken($study, $artifact, $user, $app, $expiresAt) : null;

        return [
            'app' => $app,
            'artifact' => [
                'id' => $artifact->id,
                'title' => $artifact->title,
                'artifact_type' => $artifact->artifact_type,
                'version' => $artifact->version,
            ],
            'mode' => $mode,
            'runtime' => $runtime,
            'status' => $runtimeConfigured ? 'ready' : 'runtime_unconfigured',
            'launch_url' => $runtimeConfigured && $token !== null ? $this->buildLaunchUrl($baseUrl, $app, $study, $artifact, $token) : null,
            'token_expires_at' => $expiresAt->toIso8601String(),
            'embedding' => [
                'allowed' => $runtimeConfigured && $mode === 'embedded',
                'container' => 'iframe',
                'sandbox' => ['allow-forms', 'allow-scripts', 'allow-same-origin', 'allow-popups', 'allow-downloads'],
            ],
            'setup' => [
                'required' => ! $runtimeConfigured,
                'message' => 'Set SHINY_PROXY_BASE_URL to enable managed OHDSI Shiny launches.',
            ],
        ];
    }

    /**
     * @param  array<string, mixed>  $app
     */
    private function createToken(Study $study, StudyArtifact $artifact, User $user, array $app, Carbon $expiresAt): string
    {
        $payload = [
            'iss' => 'parthenon',
            'sub' => $user->id,
            'study_id' => $study->id,
            'study_slug' => $study->slug,
            'artifact_id' => $artifact->id,
            'app_key' => $app['key'],
            'exp' => $expiresAt->timestamp,
            'nonce' => (string) Str::uuid(),
        ];

        $encodedPayload = $this->base64UrlEncode(json_encode($payload, JSON_THROW_ON_ERROR));
        $signature = hash_hmac('sha256', $encodedPayload, $this->signingKey(), true);

        return $encodedPayload.'.'.$this->base64UrlEncode($signature);
    }

    /**
     * @param  array<string, mixed>  $app
     */
    private function buildLaunchUrl(string $baseUrl, array $app, Study $study, StudyArtifact $artifact, string $token): string
    {
        $runtimeApp = preg_replace('/[^a-zA-Z0-9_-]/', '', (string) ($app['runtime_app'] ?? $app['key']));
        $query = http_build_query([
            'parthenon_launch' => $token,
            'study' => $study->slug,
            'artifact' => $artifact->id,
        ]);

        return rtrim($baseUrl, '/').'/app/'.$runtimeApp.'?'.$query;
    }

    private function signingKey(): string
    {
        $key = (string) config('app.key', '');

        if (str_starts_with($key, 'base64:')) {
            $decoded = base64_decode(substr($key, 7), true);

            if ($decoded !== false) {
                return $decoded;
            }
        }

        return $key !== '' ? $key : 'parthenon-managed-shiny-launch';
    }

    private function base64UrlEncode(string $value): string
    {
        return rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
    }
}
