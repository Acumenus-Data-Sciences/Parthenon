<?php

namespace App\Services\Shiny;

use App\Models\App\ManagedShinyLaunch;
use App\Models\App\Study;
use App\Models\App\StudyArtifact;
use App\Models\App\StudyResult;
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

        return $this->createForContext($study, $this->artifactContext($artifact), $user, $appKey, $mode);
    }

    /**
     * @return array<string, mixed>
     */
    public function createForResult(Study $study, StudyResult $result, User $user, ?string $appKey = null, string $mode = 'embedded'): array
    {
        if ((int) $result->study_id !== (int) $study->id) {
            throw ValidationException::withMessages([
                'result' => ['Result does not belong to this study.'],
            ]);
        }

        return $this->createForContext($study, $this->resultContext($result), $user, $appKey, $mode);
    }

    /**
     * @param  array<string, mixed>  $context
     * @return array<string, mixed>
     */
    private function createForContext(Study $study, array $context, User $user, ?string $appKey = null, string $mode = 'embedded'): array
    {
        $apps = $this->appsForContext($context);
        $app = $appKey !== null ? $this->registry->find($appKey) : ($apps[0] ?? null);

        if ($app === null || ! $this->supportsContext($app, $context)) {
            throw ValidationException::withMessages([
                'app_key' => ['No managed OHDSI Shiny app is registered for this result context.'],
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
        $launchPayload = $runtimeConfigured ? $this->buildLaunchPayload($study, $context, $user, $app, $expiresAt) : null;
        $workspace = $launchPayload !== null ? $this->prepareWorkspace($study, $context, $app, $launchPayload) : null;
        $token = $launchPayload !== null ? $this->encodeToken($launchPayload) : null;
        $launchUrl = $runtimeConfigured && $token !== null ? $this->buildLaunchUrl($baseUrl, $app, $study, $context, $token) : null;

        if ($launchPayload !== null && $workspace !== null && $token !== null && $launchUrl !== null) {
            $this->recordLaunchIssued($study, $context, $user, $app, $launchPayload, $workspace, $runtime, $mode, $token, $expiresAt);
        }

        return [
            'app' => $app,
            'artifact' => [
                'id' => $context['id'],
                'title' => $context['title'],
                'artifact_type' => $context['artifact_type'],
                'version' => $context['version'],
            ],
            'context_type' => $context['context_type'],
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
        $app = $this->registry->find((string) ($payload['app_key'] ?? ''));
        $context = $study instanceof Study ? $this->resolveContextFromPayload($study, $payload) : null;

        if ($study === null || $context === null || $app === null) {
            $this->markLaunchFailed($payload, $token, 'context_unavailable');

            throw ValidationException::withMessages([
                'launch_token' => ['Managed Shiny launch context is no longer available.'],
            ]);
        }

        if (! $this->supportsContext($app, $context)) {
            $this->markLaunchFailed($payload, $token, 'artifact_mismatch');

            throw ValidationException::withMessages([
                'launch_token' => ['Managed Shiny launch token does not match this artifact.'],
            ]);
        }

        try {
            $workspace = $this->prepareWorkspace($study, $context, $app, $payload);
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
                'id' => $context['id'],
                'artifact_type' => $context['artifact_type'],
                'title' => $context['title'],
                'description' => $context['description'],
                'version' => $context['version'],
                'mime_type' => $context['mime_type'],
                'metadata' => $context['metadata'],
            ],
            'context_type' => $context['context_type'],
            'workspace' => $workspace,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function artifactContext(StudyArtifact $artifact): array
    {
        return [
            'context_type' => 'artifact',
            'id' => $artifact->id,
            'artifact_id' => $artifact->id,
            'result_id' => null,
            'record' => $artifact,
            'artifact_type' => $artifact->artifact_type,
            'title' => $artifact->title,
            'description' => $artifact->description,
            'version' => $artifact->version,
            'mime_type' => $artifact->mime_type,
            'metadata' => is_array($artifact->metadata) ? $artifact->metadata : [],
            'file_path' => $artifact->file_path,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function resultContext(StudyResult $result): array
    {
        $result->loadMissing('execution');
        $metadata = $this->registry->resultMetadata($result);

        return [
            'context_type' => 'result',
            'id' => $result->id,
            'artifact_id' => null,
            'result_id' => $result->id,
            'record' => $result,
            'artifact_type' => 'study_result',
            'title' => (string) ($metadata['title'] ?? $metadata['name'] ?? "Study result #{$result->id}"),
            'description' => (string) ($metadata['description'] ?? "Managed OHDSI viewer launch for {$result->result_type} result #{$result->id}."),
            'version' => (string) ($metadata['version'] ?? "result-{$result->id}"),
            'mime_type' => (string) ($metadata['mime_type'] ?? $this->mimeTypeForPath($this->registry->resultBundleFilePath($result))),
            'metadata' => $metadata,
            'file_path' => $this->registry->resultBundleFilePath($result),
        ];
    }

    /**
     * @param  array<string, mixed>  $context
     * @return list<array<string, mixed>>
     */
    private function appsForContext(array $context): array
    {
        $record = $context['record'] ?? null;

        if ($record instanceof StudyArtifact) {
            return $this->registry->appsForArtifact($record);
        }

        if ($record instanceof StudyResult) {
            return $this->registry->appsForResult($record);
        }

        return [];
    }

    /**
     * @param  array<string, mixed>  $app
     * @param  array<string, mixed>  $context
     */
    private function supportsContext(array $app, array $context): bool
    {
        $record = $context['record'] ?? null;

        if ($record instanceof StudyArtifact) {
            return $this->registry->supportsArtifact($app, $record);
        }

        if ($record instanceof StudyResult) {
            return $this->registry->supportsResult($app, $record);
        }

        return false;
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return array<string, mixed>|null
     */
    private function resolveContextFromPayload(Study $study, array $payload): ?array
    {
        $contextType = (string) ($payload['context_type'] ?? 'artifact');

        if ($contextType === 'result') {
            $result = StudyResult::query()
                ->with('execution')
                ->find((int) ($payload['result_id'] ?? 0));

            if (! $result instanceof StudyResult || (int) $result->study_id !== (int) $study->id) {
                return null;
            }

            return $this->resultContext($result);
        }

        $artifact = StudyArtifact::query()->find((int) ($payload['artifact_id'] ?? 0));
        if (! $artifact instanceof StudyArtifact || (int) $artifact->study_id !== (int) $study->id) {
            return null;
        }

        return $this->artifactContext($artifact);
    }

    private function mimeTypeForPath(?string $path): string
    {
        return match (strtolower(pathinfo((string) $path, PATHINFO_EXTENSION))) {
            'zip' => 'application/zip',
            'sqlite', 'sqlite3', 'db' => 'application/vnd.sqlite3',
            'json' => 'application/json',
            'html', 'htm' => 'text/html',
            default => 'application/octet-stream',
        };
    }

    /**
     * @param  array<string, mixed>  $app
     * @param  array<string, mixed>  $context
     * @return array<string, mixed>
     */
    private function buildLaunchPayload(Study $study, array $context, User $user, array $app, Carbon $expiresAt): array
    {
        return [
            'iss' => 'parthenon',
            'sub' => $user->id,
            'study_id' => $study->id,
            'study_slug' => $study->slug,
            'context_type' => $context['context_type'],
            'artifact_id' => $context['artifact_id'],
            'result_id' => $context['result_id'],
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
     * @param  array<string, mixed>  $context
     * @return array<string, mixed>
     */
    private function prepareWorkspace(Study $study, array $context, array $app, array $payload): array
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

        $artifactFile = $this->materializeContextFile($context, $artifactDirectory);
        $manifest = $this->buildManifest($study, $context, $app, $payload, $workspaceId, $containerRoot, $artifactFile);
        $contextPayload = [
            'launch' => [
                'workspace_id' => $workspaceId,
                'expires_at' => Carbon::createFromTimestamp((int) $payload['exp'])->toIso8601String(),
                'manifest_path' => "{$containerRoot}/launches/{$workspaceId}/managed-shiny-manifest.json",
            ],
            'app' => $app,
            'context_type' => $context['context_type'],
            'study' => [
                'id' => $study->id,
                'slug' => $study->slug,
                'title' => $study->title,
            ],
            'artifact' => [
                'id' => $context['id'],
                'artifact_type' => $context['artifact_type'],
                'title' => $context['title'],
                'description' => $context['description'],
                'version' => $context['version'],
                'mime_type' => $context['mime_type'],
                'metadata' => $context['metadata'],
                'materialized_file' => $artifactFile !== null ? "{$containerRoot}/launches/{$workspaceId}/artifact/{$artifactFile}" : null,
            ],
        ];

        $contextPath = "{$workspacePath}/context.json";
        $manifestPath = "{$workspacePath}/managed-shiny-manifest.json";
        $this->writeJsonFile($contextPath, $contextPayload);
        $this->writeJsonFile($manifestPath, $manifest);

        return [
            'id' => $workspaceId,
            'container_path' => "{$containerRoot}/launches/{$workspaceId}",
            'context_path' => "{$containerRoot}/launches/{$workspaceId}/context.json",
            'manifest_path' => "{$containerRoot}/launches/{$workspaceId}/managed-shiny-manifest.json",
            'artifact_file' => $artifactFile !== null ? "{$containerRoot}/launches/{$workspaceId}/artifact/{$artifactFile}" : null,
        ];
    }

    /**
     * @param  array<string, mixed>  $app
     * @param  array<string, mixed>  $payload
     * @param  array<string, mixed>  $context
     * @return array<string, mixed>
     */
    private function buildManifest(
        Study $study,
        array $context,
        array $app,
        array $payload,
        string $workspaceId,
        string $containerRoot,
        ?string $artifactFile,
    ): array {
        $metadata = is_array($context['metadata'] ?? null) ? $context['metadata'] : [];
        $detectedResultTypes = $this->resultTypesForContext($context);
        $artifactContainerPath = $artifactFile !== null ? "{$containerRoot}/launches/{$workspaceId}/artifact/{$artifactFile}" : null;
        $sizeBytes = null;

        if (is_string($context['file_path'] ?? null) && Storage::disk('local')->exists($context['file_path'])) {
            try {
                $sizeBytes = Storage::disk('local')->size($context['file_path']);
            } catch (\Throwable) {
                $sizeBytes = null;
            }
        }

        return [
            'schema' => 'parthenon.managed_shiny_manifest',
            'schema_version' => '1.0',
            'generated_at' => now()->toIso8601String(),
            'launch' => [
                'workspace_id' => $workspaceId,
                'expires_at' => Carbon::createFromTimestamp((int) $payload['exp'])->toIso8601String(),
            ],
            'app' => [
                'key' => (string) ($app['key'] ?? ''),
                'label' => $app['label'] ?? null,
                'runtime_app' => $app['runtime_app'] ?? $app['key'] ?? null,
                'package' => $app['package'] ?? null,
                'module_family' => $app['module_family'] ?? null,
                'entrypoint' => $app['entrypoint'] ?? null,
                'supported_result_types' => array_values($app['result_types'] ?? []),
            ],
            'study' => [
                'id' => $study->id,
                'slug' => $study->slug,
                'title' => $study->title,
            ],
            'source' => [
                'type' => $context['context_type'],
                'id' => $context['id'],
                'study_artifact_id' => $context['artifact_id'],
                'study_result_id' => $context['result_id'],
            ],
            'artifact' => [
                'id' => $context['id'],
                'artifact_type' => $context['artifact_type'],
                'title' => $context['title'],
                'description' => $context['description'],
                'version' => $context['version'],
                'mime_type' => $context['mime_type'],
                'detected_result_types' => $detectedResultTypes,
                'metadata_hints' => $this->manifestMetadataHints($metadata),
                'materialized_file' => [
                    'present' => $artifactFile !== null,
                    'container_path' => $artifactContainerPath,
                    'relative_path' => $artifactFile !== null ? "artifact/{$artifactFile}" : null,
                    'filename' => $artifactFile,
                    'extension' => $artifactFile !== null ? pathinfo($artifactFile, PATHINFO_EXTENSION) : null,
                    'size_bytes' => $sizeBytes,
                ],
            ],
            'loader' => [
                'key' => $this->loaderKeyForApp($app),
                'selection_basis' => $detectedResultTypes !== [] ? 'detected_result_type' : 'artifact_type_fallback',
                'result_family' => $app['module_family'] ?? null,
                'detected_result_types' => $detectedResultTypes,
                'expected_packages' => $this->expectedPackages($app),
                'entrypoint' => $app['entrypoint'] ?? null,
                'status' => $artifactFile !== null ? 'bundle_available' : 'context_only',
            ],
        ];
    }

    /**
     * @param  array<string, mixed>  $metadata
     * @return array<string, mixed>
     */
    private function manifestMetadataHints(array $metadata): array
    {
        $allowed = [
            'result_type',
            'result_types',
            'ohdsi_result_type',
            'hades_result_type',
            'hades_package',
            'analysis_package',
            'package',
            'managed_shiny_app',
            'managed_shiny_apps',
            'shiny_app_key',
        ];

        return array_intersect_key($metadata, array_flip($allowed));
    }

    /**
     * @param  array<string, mixed>  $context
     * @return list<string>
     */
    private function resultTypesForContext(array $context): array
    {
        $record = $context['record'] ?? null;

        if ($record instanceof StudyArtifact) {
            return $this->registry->resultTypesForArtifact($record);
        }

        if ($record instanceof StudyResult) {
            return $this->registry->resultTypesForResult($record);
        }

        return [];
    }

    /**
     * @param  array<string, mixed>  $app
     */
    private function loaderKeyForApp(array $app): string
    {
        return match ((string) ($app['key'] ?? '')) {
            'plp-results' => 'plp_result_bundle',
            'population-estimation-results' => 'population_estimation_result_bundle',
            'cohort-diagnostics' => 'cohort_diagnostics_result_bundle',
            'characterization' => 'characterization_result_bundle',
            'phevaluator' => 'phevaluator_result_bundle',
            'ohdsi-report' => 'ohdsi_report_bundle',
            default => 'managed_shiny_result_bundle',
        };
    }

    /**
     * @param  array<string, mixed>  $app
     * @return list<string>
     */
    private function expectedPackages(array $app): array
    {
        return array_values(array_unique(array_filter([
            $app['package'] ?? null,
            'OhdsiShinyModules',
            'OhdsiShinyAppBuilder',
        ], static fn (mixed $package): bool => is_string($package) && trim($package) !== '')));
    }

    /**
     * @param  array<string, mixed>  $context
     */
    private function materializeContextFile(array $context, string $artifactDirectory): ?string
    {
        $filePath = $context['file_path'] ?? null;

        if (! is_string($filePath) || trim($filePath) === '' || ! Storage::disk('local')->exists($filePath)) {
            return null;
        }

        $extension = pathinfo($filePath, PATHINFO_EXTENSION);
        $filename = Str::slug((string) ($context['title'] ?? '')) ?: 'artifact';
        $filename .= $extension !== '' ? ".{$extension}" : '.bin';
        $target = "{$artifactDirectory}/{$filename}";

        if (File::exists($target)) {
            return $filename;
        }

        $stream = Storage::disk('local')->readStream($filePath);

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
     * @param  array<string, mixed>  $context
     */
    private function buildLaunchUrl(string $baseUrl, array $app, Study $study, array $context, string $token): string
    {
        $runtimeApp = preg_replace('/[^a-zA-Z0-9_-]/', '', (string) ($app['runtime_app'] ?? $app['key']));
        $queryPayload = [
            'parthenon_launch' => $token,
            'study' => $study->slug,
        ];

        if (($context['context_type'] ?? null) === 'result') {
            $queryPayload['result'] = $context['id'];
        } else {
            $queryPayload['artifact'] = $context['id'];
        }

        $query = http_build_query($queryPayload);

        return rtrim($baseUrl, '/').'/app/'.$runtimeApp.'?'.$query;
    }

    /**
     * @param  array<string, mixed>  $app
     * @param  array<string, mixed>  $payload
     * @param  array<string, mixed>  $workspace
     * @param  array<string, mixed>  $context
     */
    private function recordLaunchIssued(
        Study $study,
        array $context,
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
            'study_artifact_id' => $context['artifact_id'],
            'study_slug' => $study->slug,
            'artifact_type' => $context['artifact_type'],
            'app_key' => (string) $app['key'],
            'runtime' => $runtime,
            'mode' => $mode,
            'status' => 'issued',
            'token_hash' => hash('sha256', $token),
            'expires_at' => $expiresAt,
            'metadata' => [
                'context_type' => $context['context_type'],
                'study_result_id' => $context['result_id'],
                'app_label' => $app['label'] ?? null,
                'artifact_title' => $context['title'],
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
