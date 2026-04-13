<?php

declare(strict_types=1);

namespace App\Services\FinnGen;

use App\Models\App\FinnGen\Run;
use App\Services\FinnGen\Exceptions\FinnGenArtifactNotFoundException;
use App\Services\FinnGen\Exceptions\FinnGenArtifactPathTraversalException;
use Illuminate\Support\Facades\URL;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\HttpFoundation\Response;

/**
 * Resolves + serves FinnGen run artifacts from the shared volume.
 *
 * Volume layout: {artifacts_path}/runs/{run_id}/{results.duckdb|log.txt|report.html|progress.json|summary.json|...}
 *
 * Security (spec §3.3, §7.4):
 *   - Artifact paths MUST be relative and contained within the run's folder.
 *     Any '..' or leading '/' → rejected with FinnGenArtifactPathTraversalException.
 *   - Access control lives in the controller (ArtifactController) — this service
 *     trusts that the caller already authorized the user for the run.
 *
 * Streaming:
 *   - Files below artifacts_stream_threshold_bytes → BinaryFileResponse (PHP reads + returns)
 *   - Files at/above threshold → X-Accel-Redirect response for Nginx to stream directly
 *     from `/_artifacts/<relative>` (Nginx internal location maps this to the volume).
 */
class FinnGenArtifactService
{
    /** @var array<string, string> */
    private const CONTENT_TYPES = [
        'duckdb' => 'application/vnd.duckdb',
        'html' => 'text/html',
        'json' => 'application/json',
        'png' => 'image/png',
        'jpg' => 'image/jpeg',
        'jpeg' => 'image/jpeg',
        'svg' => 'image/svg+xml',
        'txt' => 'text/plain',
        'csv' => 'text/csv',
        'log' => 'text/plain',
    ];

    public function __construct(
        private readonly string $artifactsPath,
        private readonly int $streamThresholdBytes,
    ) {}

    /**
     * Build a signed URL for a specific artifact key on a run. Expires after
     * $minutes. The signature binds the run + key; tampering invalidates.
     */
    public function signedUrl(Run $run, string $key, int $minutes = 10): string
    {
        return URL::temporarySignedRoute(
            'finngen.runs.artifact',
            now()->addMinutes($minutes),
            ['run' => $run->id, 'key' => $key],
        );
    }

    /**
     * Resolve a run + key to an absolute filesystem path.
     *
     * @throws FinnGenArtifactNotFoundException key not present on run OR file missing on disk
     * @throws FinnGenArtifactPathTraversalException path escapes the artifacts root
     */
    public function resolvePath(Run $run, string $key): string
    {
        $artifacts = $run->artifacts ?? [];
        $relative = $artifacts[$key] ?? null;

        if (! is_string($relative) || $relative === '') {
            throw new FinnGenArtifactNotFoundException("Artifact key '{$key}' not found on run {$run->id}");
        }

        $this->assertSafeRelativePath($relative);

        $root = $this->normalizedArtifactsPath();
        $realRoot = realpath($root);
        if ($realRoot === false) {
            throw new FinnGenArtifactNotFoundException("Artifacts root does not exist: {$root}");
        }

        $full = $realRoot.'/'.ltrim($relative, '/');

        // Realpath check — if the file exists, resolved path must be inside the root.
        $realFull = realpath($full);
        if ($realFull !== false) {
            if (! str_starts_with($realFull, $realRoot.DIRECTORY_SEPARATOR) && $realFull !== $realRoot) {
                throw new FinnGenArtifactPathTraversalException("Artifact path '{$relative}' escapes root");
            }

            if (! is_file($realFull)) {
                throw new FinnGenArtifactNotFoundException("Artifact file missing on disk: {$relative}");
            }

            return $realFull;
        }

        // File does not exist. Verify the lexical path (after normalization) is
        // still inside the root — otherwise treat as traversal; otherwise NotFound.
        $normalized = $this->lexicallyNormalize($full);
        if (! str_starts_with($normalized, $realRoot.DIRECTORY_SEPARATOR) && $normalized !== $realRoot) {
            throw new FinnGenArtifactPathTraversalException("Artifact path '{$relative}' escapes root");
        }

        throw new FinnGenArtifactNotFoundException("Artifact file missing on disk: {$relative}");
    }

    /**
     * Emit the HTTP response for an artifact. Chooses streaming vs direct by size.
     */
    public function respond(string $fullPath, string $downloadFilename): Response
    {
        $contentType = $this->contentTypeFor($fullPath);
        $size = @filesize($fullPath) ?: 0;

        if ($size >= $this->streamThresholdBytes) {
            // Delegate streaming to Nginx via X-Accel-Redirect. Nginx must have
            // an internal location:
            //   location /_artifacts/ { internal; alias /opt/finngen-artifacts/; }
            $relative = ltrim(substr($fullPath, strlen($this->normalizedArtifactsPath())), '/');

            return response()->make('', 200, [
                'X-Accel-Redirect' => '/_artifacts/'.$relative,
                'Content-Type' => $contentType,
                'Content-Disposition' => 'attachment; filename="'.addslashes($downloadFilename).'"',
            ]);
        }

        $response = (new BinaryFileResponse($fullPath))
            ->setContentDisposition('attachment', $downloadFilename, '');
        $response->headers->set('Content-Type', $contentType);

        return $response;
    }

    public function contentTypeFor(string $path): string
    {
        $ext = strtolower(pathinfo($path, PATHINFO_EXTENSION));

        return self::CONTENT_TYPES[$ext] ?? 'application/octet-stream';
    }

    public function shouldStream(int $sizeBytes): bool
    {
        return $sizeBytes >= $this->streamThresholdBytes;
    }

    private function assertSafeRelativePath(string $path): void
    {
        if (str_contains($path, '..') || str_starts_with($path, '/') || str_contains($path, "\0")) {
            throw new FinnGenArtifactPathTraversalException("Unsafe artifact path: '{$path}'");
        }
    }

    private function normalizedArtifactsPath(): string
    {
        return rtrim($this->artifactsPath, '/');
    }

    /**
     * Collapse . and .. in a path without touching the filesystem.
     */
    private function lexicallyNormalize(string $path): string
    {
        $isAbsolute = str_starts_with($path, '/');
        $parts = array_filter(explode('/', $path), fn ($p) => $p !== '' && $p !== '.');
        $stack = [];
        foreach ($parts as $p) {
            if ($p === '..') {
                array_pop($stack);
            } else {
                $stack[] = $p;
            }
        }

        return ($isAbsolute ? '/' : '').implode('/', $stack);
    }
}
