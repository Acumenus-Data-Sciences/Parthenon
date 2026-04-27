<?php

namespace App\Services\StudyDesign;

use App\Models\App\Study;
use App\Models\App\StudyArtifact;
use App\Models\App\StudyDesignSession;
use App\Models\App\StudyDesignVersion;
use Illuminate\Support\Facades\Storage;

class StudyDesignLockService
{
    public function __construct(
        private readonly StudyDesignReadinessService $readinessService,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function readiness(Study $study, StudyDesignSession $session, StudyDesignVersion $version): array
    {
        return $this->readinessService->lockReadiness($study, $session, $version);
    }

    /**
     * @return array{data: StudyDesignVersion, package_artifact: StudyArtifact, readiness: array<string, mixed>}
     */
    public function lock(Study $study, StudyDesignSession $session, StudyDesignVersion $version, int $userId): array
    {
        $lockedAt = now();
        $manifest = [
            'study' => ['id' => $study->id, 'slug' => $study->slug, 'title' => $study->title],
            'session' => $session->only(['id', 'title', 'source_mode']),
            'version' => $version->only(['id', 'version_number', 'intent_json', 'normalized_spec_json']),
            'assets' => $session->assets()->where('version_id', $version->id)->get()->toArray(),
            'locked_at' => $lockedAt->toISOString(),
            'standards' => ['OMOP CDM', 'OHDSI ATLAS/Circe', 'HADES'],
        ];
        $json = json_encode($manifest, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
        $sha = hash('sha256', (string) $json);
        $path = "study-packages/{$study->slug}/design-session-{$session->id}-version-{$version->id}.json";

        Storage::disk('local')->put($path, (string) $json);

        $artifact = StudyArtifact::create([
            'study_id' => $study->id,
            'artifact_type' => 'study_design_package',
            'title' => "Study Design Package v{$version->version_number}",
            'description' => 'Locked OHDSI-aligned Study Designer package manifest.',
            'version' => (string) $version->version_number,
            'file_path' => $path,
            'file_size_bytes' => strlen((string) $json),
            'mime_type' => 'application/json',
            'url' => "/api/v1/studies/{$study->slug}/artifacts/{artifact}/download",
            'metadata' => ['sha256' => $sha, 'version_id' => $version->id, 'session_id' => $session->id],
            'uploaded_by' => $userId,
            'is_current' => true,
        ]);
        $artifact->update(['url' => "/api/v1/studies/{$study->slug}/artifacts/{$artifact->id}/download"]);

        $version->update([
            'status' => 'locked',
            'locked_at' => $lockedAt,
            'provenance_json' => array_merge($version->provenance_json ?? [], [
                'package_manifest_sha256' => $sha,
                'package_artifact_id' => $artifact->id,
            ]),
        ]);
        $session->update(['status' => 'locked', 'active_version_id' => $version->id]);

        $freshSession = $session->fresh() ?? $session;
        $freshVersion = $version->fresh() ?? $version;

        return [
            'data' => $freshVersion,
            'package_artifact' => $artifact->fresh() ?? $artifact,
            'readiness' => $this->readiness($study, $freshSession, $freshVersion),
        ];
    }
}
