<?php

namespace App\Services\Shiny;

use App\Models\App\ManagedShinyLaunch;
use App\Models\App\Study;
use App\Models\App\StudyArtifact;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Storage;
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
        $launchPayload = $runtimeConfigured ? $this->buildLaunchPayload($study, $artifact, $user, $app, $expiresAt) : null;
        $workspace = $launchPayload !== null ? $this->prepareWorkspace($study, $artifact, $app, $launchPayload) : null;
        $token = $launchPayload !== null ? $this->encodeToken($launchPayload) : null;
        $launchUrl = $runtimeConfigured && $token !== null ? $this->buildLaunchUrl($baseUrl, $app, $study, $artifact, $token) : null;

        if ($launchPayload !== null && $workspace !== null && $token !== null && $launchUrl !== null) {
            $this->recordLaunchIssued($study, $artifact, $user, $app, $launchPayload, $workspace, $runtime, $mode, $token, $expiresAt);
        }

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
            'launch_url' => $launchUrl,
            'token_expires_at' => $expiresAt->toIso8601String(),
            'workspace' => $workspace,
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
     * @return array<string, mixed>
     */
    public function resolve(string $token): array
    {
        $payload = $this->decodeToken($token, false);

        if ($this->payloadExpired($payload)) {
            $this->markLaunchFailed($payload, $token, 'expired');

            throw ValidationException::withMessages([
                'launch_token' => ['Managed Shiny launch token has expired.'],
            ]);
        }

        $study = Study::query()->find((int) ($payload['study_id'] ?? 0));
        $artifact = StudyArtifact::query()->find((int) ($payload['artifact_id'] ?? 0));
        $app = $this->registry->find((string) ($payload['app_key'] ?? ''));

        if ($study === null || $artifact === null || $app === null || (int) $artifact->study_id !== (int) $study->id) {
            $this->markLaunchFailed($payload, $token, 'context_unavailable');

            throw ValidationException::withMessages([
                'launch_token' => ['Managed Shiny launch context is no longer available.'],
            ]);
        }

        if (! $this->registry->supportsArtifact($app, $artifact)) {
            $this->markLaunchFailed($payload, $token, 'artifact_mismatch');

            throw ValidationException::withMessages([
                'launch_token' => ['Managed Shiny launch token does not match this artifact.'],
            ]);
        }

        try {
            $workspace = $this->prepareWorkspace($study, $artifact, $app, $payload);
        } catch (ValidationException $exception) {
            $this->markLaunchFailed($payload, $token, 'workspace_prepare_failed');

            throw $exception;
        }

        $this->markLaunchResolved($payload, $token);

        return [
            'launch' => [
                'workspace_id' => $payload['workspace_id'],
                'expires_at' => Carbon::createFromTimestamp((int) $payload['exp'])->toIso8601String(),
            ],
            'app' => $app,
            'study' => [
                'id' => $study->id,
                'slug' => $study->slug,
                'title' => $study->title,
            ],
            'artifact' => [
                'id' => $artifact->id,
                'artifact_type' => $artifact->artifact_type,
                'title' => $artifact->title,
                'description' => $artifact->description,
                'version' => $artifact->version,
                'mime_type' => $artifact->mime_type,
                'metadata' => $artifact->metadata ?? [],
            ],
            'workspace' => $workspace,
        ];
    }

    /**
     * @param  array<string, mixed>  $app
     * @return array<string, mixed>
     */
    private function buildLaunchPayload(Study $study, StudyArtifact $artifact, User $user, array $app, Carbon $expiresAt): array
    {
        return [
            'iss' => 'parthenon',
            'sub' => $user->id,
            'study_id' => $study->id,
            'study_slug' => $study->slug,
            'artifact_id' => $artifact->id,
            'app_key' => $app['key'],
            'workspace_id' => (string) Str::uuid(),
            'exp' => $expiresAt->timestamp,
            'nonce' => (string) Str::uuid(),
        ];
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    private function encodeToken(array $payload): string
    {
        $encodedPayload = $this->base64UrlEncode(json_encode($payload, JSON_THROW_ON_ERROR));
        $signature = hash_hmac('sha256', $encodedPayload, $this->signingKey(), true);

        return $encodedPayload.'.'.$this->base64UrlEncode($signature);
    }

    /**
     * @return array<string, mixed>
     */
    private function decodeToken(string $token, bool $enforceExpiry = true): array
    {
        $parts = explode('.', $token, 2);

        if (count($parts) !== 2) {
            throw ValidationException::withMessages([
                'launch_token' => ['Managed Shiny launch token is malformed.'],
            ]);
        }

        [$encodedPayload, $encodedSignature] = $parts;
        $expected = $this->base64UrlEncode(hash_hmac('sha256', $encodedPayload, $this->signingKey(), true));

        if (! hash_equals($expected, $encodedSignature)) {
            throw ValidationException::withMessages([
                'launch_token' => ['Managed Shiny launch token signature is invalid.'],
            ]);
        }

        $decoded = $this->base64UrlDecode($encodedPayload);
        $payload = json_decode($decoded, true);

        if (! is_array($payload) || ($payload['iss'] ?? null) !== 'parthenon') {
            throw ValidationException::withMessages([
                'launch_token' => ['Managed Shiny launch token payload is invalid.'],
            ]);
        }

        if ($enforceExpiry && $this->payloadExpired($payload)) {
            throw ValidationException::withMessages([
                'launch_token' => ['Managed Shiny launch token has expired.'],
            ]);
        }

        return $payload;
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    private function payloadExpired(array $payload): bool
    {
        return (int) ($payload['exp'] ?? 0) < now()->timestamp;
    }

    /**
     * @param  array<string, mixed>  $app
     * @param  array<string, mixed>  $payload
     * @return array<string, mixed>
     */
    private function prepareWorkspace(Study $study, StudyArtifact $artifact, array $app, array $payload): array
    {
        $workspaceId = preg_replace('/[^a-zA-Z0-9_-]/', '', (string) ($payload['workspace_id'] ?? ''));

        if ($workspaceId === '') {
            throw ValidationException::withMessages([
                'launch_token' => ['Managed Shiny launch workspace is invalid.'],
            ]);
        }

        $root = rtrim((string) (config('services.shiny_proxy.workspace_root') ?: storage_path('app/managed-shiny')), '/');
        $containerRoot = rtrim((string) (config('services.shiny_proxy.container_workspace_root') ?: '/srv/parthenon-shiny'), '/');
        $workspacePath = "{$root}/launches/{$workspaceId}";
        $artifactDirectory = "{$workspacePath}/artifact";

        try {
            File::ensureDirectoryExists($artifactDirectory, 0755, true);
        } catch (\Throwable) {
            throw ValidationException::withMessages([
                'launch_token' => ['Managed Shiny launch workspace could not be prepared.'],
            ]);
        }
        @chmod($workspacePath, 0755);
        @chmod($artifactDirectory, 0755);

        $artifactFile = $this->materializeArtifactFile($artifact, $artifactDirectory);
        $context = [
            'launch' => [
                'workspace_id' => $workspaceId,
                'expires_at' => Carbon::createFromTimestamp((int) $payload['exp'])->toIso8601String(),
            ],
            'app' => $app,
            'study' => [
                'id' => $study->id,
                'slug' => $study->slug,
                'title' => $study->title,
            ],
            'artifact' => [
                'id' => $artifact->id,
                'artifact_type' => $artifact->artifact_type,
                'title' => $artifact->title,
                'description' => $artifact->description,
                'version' => $artifact->version,
                'mime_type' => $artifact->mime_type,
                'metadata' => $artifact->metadata ?? [],
                'materialized_file' => $artifactFile !== null ? "{$containerRoot}/launches/{$workspaceId}/artifact/{$artifactFile}" : null,
            ],
        ];

        $contextPath = "{$workspacePath}/context.json";
        $this->writeJsonFile($contextPath, $context);

        return [
            'id' => $workspaceId,
            'container_path' => "{$containerRoot}/launches/{$workspaceId}",
            'context_path' => "{$containerRoot}/launches/{$workspaceId}/context.json",
            'artifact_file' => $artifactFile !== null ? "{$containerRoot}/launches/{$workspaceId}/artifact/{$artifactFile}" : null,
        ];
    }

    private function materializeArtifactFile(StudyArtifact $artifact, string $artifactDirectory): ?string
    {
        if ($artifact->file_path === null || ! Storage::disk('local')->exists($artifact->file_path)) {
            return null;
        }

        $extension = pathinfo($artifact->file_path, PATHINFO_EXTENSION);
        $filename = Str::slug($artifact->title) ?: 'artifact';
        $filename .= $extension !== '' ? ".{$extension}" : '.bin';
        $target = "{$artifactDirectory}/{$filename}";

        if (File::exists($target)) {
            return $filename;
        }

        $stream = Storage::disk('local')->readStream($artifact->file_path);

        if ($stream === false) {
            return null;
        }

        $targetHandle = fopen($target, 'wb');

        if ($targetHandle === false) {
            if (is_resource($stream)) {
                fclose($stream);
            }

            return null;
        }

        stream_copy_to_stream($stream, $targetHandle);
        fclose($targetHandle);
        @chmod($target, 0644);

        if (is_resource($stream)) {
            fclose($stream);
        }

        return $filename;
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    private function writeJsonFile(string $path, array $payload): void
    {
        $json = json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);

        if ($json === false) {
            throw ValidationException::withMessages([
                'launch_token' => ['Managed Shiny launch context could not be serialized.'],
            ]);
        }

        if (File::exists($path) && ! is_writable($path)) {
            return;
        }

        if (@file_put_contents($path, $json) === false && ! File::exists($path)) {
            throw ValidationException::withMessages([
                'launch_token' => ['Managed Shiny launch workspace could not be prepared.'],
            ]);
        }

        @chmod($path, 0644);
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

    /**
     * @param  array<string, mixed>  $app
     * @param  array<string, mixed>  $payload
     * @param  array<string, mixed>  $workspace
     */
    private function recordLaunchIssued(
        Study $study,
        StudyArtifact $artifact,
        User $user,
        array $app,
        array $payload,
        array $workspace,
        string $runtime,
        string $mode,
        string $token,
        Carbon $expiresAt,
    ): void {
        ManagedShinyLaunch::create([
            'workspace_id' => (string) $payload['workspace_id'],
            'user_id' => $user->id,
            'study_id' => $study->id,
            'study_artifact_id' => $artifact->id,
            'study_slug' => $study->slug,
            'artifact_type' => $artifact->artifact_type,
            'app_key' => (string) $app['key'],
            'runtime' => $runtime,
            'mode' => $mode,
            'status' => 'issued',
            'token_hash' => hash('sha256', $token),
            'expires_at' => $expiresAt,
            'metadata' => [
                'app_label' => $app['label'] ?? null,
                'artifact_title' => $artifact->title,
                'container_path' => $workspace['container_path'] ?? null,
                'context_path' => $workspace['context_path'] ?? null,
            ],
        ]);
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    private function markLaunchResolved(array $payload, string $token): void
    {
        $launch = ManagedShinyLaunch::query()
            ->where('workspace_id', (string) ($payload['workspace_id'] ?? ''))
            ->where('token_hash', hash('sha256', $token))
            ->latest('id')
            ->first();

        if (! $launch instanceof ManagedShinyLaunch) {
            return;
        }

        $launch->forceFill([
            'status' => 'resolved',
            'resolved_at' => now(),
        ])->save();
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    private function markLaunchFailed(array $payload, string $token, string $reason): void
    {
        $launch = ManagedShinyLaunch::query()
            ->where('workspace_id', (string) ($payload['workspace_id'] ?? ''))
            ->where('token_hash', hash('sha256', $token))
            ->latest('id')
            ->first();

        if (! $launch instanceof ManagedShinyLaunch) {
            return;
        }

        $metadata = $launch->metadata ?? [];
        $attempts = $metadata['failure_attempts'] ?? [];
        $attempts = is_array($attempts) ? $attempts : [];
        $attempts[] = [
            'at' => now()->toIso8601String(),
            'reason' => $reason,
        ];
        $metadata['failure_attempts'] = array_slice($attempts, -10);

        $attributes = [
            'failed_at' => now(),
            'failure_reason' => $reason,
            'metadata' => $metadata,
        ];

        if ($launch->status !== 'resolved') {
            $attributes['status'] = 'failed';
        }

        $launch->forceFill($attributes)->save();
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

    private function base64UrlDecode(string $value): string
    {
        return base64_decode(strtr($value, '-_', '+/').str_repeat('=', (4 - strlen($value) % 4) % 4), true) ?: '';
    }
}
