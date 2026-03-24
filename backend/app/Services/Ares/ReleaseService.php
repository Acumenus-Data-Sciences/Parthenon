<?php

namespace App\Services\Ares;

use App\Events\ReleaseCreated;
use App\Models\App\Source;
use App\Models\App\SourceRelease;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Log;

class ReleaseService
{
    /**
     * Create a new release for the given source.
     */
    public function createRelease(Source $source, array $data): SourceRelease
    {
        $release = SourceRelease::create([
            'source_id' => $source->id,
            'release_key' => $this->generateKey($source),
            'release_name' => $data['release_name'] ?? 'Untitled Release',
            'release_type' => $data['release_type'] ?? 'snapshot',
            'cdm_version' => $data['cdm_version'] ?? null,
            'vocabulary_version' => $data['vocabulary_version'] ?? null,
            'etl_version' => $data['etl_version'] ?? null,
            'notes' => $data['notes'] ?? null,
        ]);

        Log::info('ReleaseService: Release created', [
            'release_id' => $release->id,
            'source_id' => $source->id,
        ]);

        ReleaseCreated::dispatch($release);

        return $release;
    }

    /**
     * Create an automatic snapshot release after an Achilles run completes.
     * Returns null if the source is not in auto release mode.
     */
    public function autoSnapshot(Source $source, string $runId): ?SourceRelease
    {
        if ($source->release_mode !== 'auto') {
            return null;
        }

        $releaseKey = $this->generateKey($source);

        $release = SourceRelease::create([
            'source_id' => $source->id,
            'release_key' => $releaseKey,
            'release_name' => 'Auto snapshot ' . now()->format('Y-m-d H:i'),
            'release_type' => 'snapshot',
        ]);

        Log::info('ReleaseService: Auto snapshot created', [
            'release_id' => $release->id,
            'source_id' => $source->id,
            'run_id' => $runId,
        ]);

        ReleaseCreated::dispatch($release);

        return $release;
    }

    /**
     * Get all releases for a source, ordered by most recent first.
     *
     * @return Collection<int, SourceRelease>
     */
    public function getTimeline(Source $source): Collection
    {
        return $source->releases()
            ->orderByDesc('created_at')
            ->get();
    }

    /**
     * Update editable fields on an existing release.
     */
    public function updateRelease(SourceRelease $release, array $data): SourceRelease
    {
        $allowedFields = [
            'release_name',
            'cdm_version',
            'vocabulary_version',
            'etl_version',
            'notes',
        ];

        $filtered = array_intersect_key($data, array_flip($allowedFields));

        $release->update($filtered);

        return $release->fresh() ?? $release;
    }

    /**
     * Delete a release, unlinking associated runs and DQD results first.
     */
    public function deleteRelease(SourceRelease $release): void
    {
        $release->achillesRuns()->update(['release_id' => null]);
        $release->dqdResults()->update(['release_id' => null]);
        $release->delete();
    }

    /**
     * Generate a unique release key from the source key and current timestamp.
     */
    private function generateKey(Source $source): string
    {
        return $source->source_key . '-' . now()->format('Ymd-His');
    }
}
