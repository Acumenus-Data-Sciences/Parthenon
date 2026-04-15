<?php

namespace App\Services\StudyDesign;

use App\Enums\StudyDesignAssetStatus;
use App\Enums\StudyDesignVerificationStatus;
use App\Models\App\ConceptSet;
use App\Models\App\Study;
use App\Models\App\StudyAnalysis;
use App\Models\App\StudyArtifact;
use App\Models\App\StudyCohort;
use App\Models\App\StudyDesignAsset;
use App\Models\App\StudyDesignSession;
use App\Models\App\StudyDesignVersion;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

class StudyDesignLockService
{
    public function __construct(
        private readonly StudyCohortReadinessService $cohortReadiness,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function readiness(Study $study, StudyDesignSession $session, StudyDesignVersion $version): array
    {
        $blockers = [];
        $warnings = [];

        if (! in_array($version->status, ['accepted', 'locked'], true)) {
            $blockers[] = $this->issue(
                'version_not_accepted',
                'Accept the study intent version before locking a study package.',
                ['status' => $version->status],
            );
        }

        $conceptSetAssets = $this->materializedConceptSetAssets($session, $version);
        if ($conceptSetAssets->isEmpty()) {
            $blockers[] = $this->issue(
                'missing_materialized_concept_sets',
                'Materialize at least one verified concept set draft before locking the study package.',
            );
        }

        $cohortReadiness = $this->cohortReadiness->summarize($study, $session, $version);
        foreach ((array) ($cohortReadiness['blockers'] ?? []) as $blocker) {
            if (is_array($blocker)) {
                $blockers[] = [
                    ...$blocker,
                    'code' => 'cohort_'.$blocker['code'],
                ];
            }
        }
        foreach ((array) ($cohortReadiness['warnings'] ?? []) as $warning) {
            if (is_array($warning)) {
                $warnings[] = [
                    ...$warning,
                    'code' => 'cohort_'.$warning['code'],
                ];
            }
        }

        $feasibility = $this->latestFeasibilityAsset($session, $version);
        $feasibilityPayload = is_array($feasibility?->draft_payload_json) ? $feasibility->draft_payload_json : [];
        if ($feasibility === null) {
            $blockers[] = $this->issue(
                'missing_feasibility_evidence',
                'Run source-scoped feasibility and resolve blockers before locking the study package.',
            );
        } elseif (($feasibilityPayload['status'] ?? null) !== 'ready') {
            $blockers[] = $this->issue(
                'feasibility_not_ready',
                'Latest feasibility evidence must be ready before locking the study package.',
                ['status' => $feasibilityPayload['status'] ?? 'unknown', 'asset_id' => $feasibility->id],
            );
        }

        $analysisPlanAssets = $this->materializedAnalysisPlanAssets($session, $version);
        if ($analysisPlanAssets->isEmpty()) {
            $blockers[] = $this->issue(
                'missing_materialized_analysis_plan',
                'Materialize at least one verified HADES analysis plan before locking the study package.',
            );
        }

        $missingPackageVersions = $analysisPlanAssets
            ->filter(fn (StudyDesignAsset $asset): bool => data_get($asset->draft_payload_json, 'hades_capability.version') === null)
            ->pluck('id')
            ->values()
            ->all();
        if ($missingPackageVersions !== []) {
            $warnings[] = $this->issue(
                'missing_hades_package_versions',
                'One or more materialized analysis plans do not include a Darkstar package version.',
                ['asset_ids' => $missingPackageVersions],
            );
        }

        $status = $blockers === [] ? ($version->status === 'locked' ? 'locked' : 'ready') : 'blocked';
        $packageArtifact = $this->latestStudyPackageArtifact($study, $version);

        return [
            'status' => $status,
            'can_lock' => $blockers === [] && $version->status !== 'locked',
            'locked' => $version->status === 'locked',
            'blockers' => $blockers,
            'warnings' => $warnings,
            'summary' => [
                'materialized_concept_sets' => $conceptSetAssets->count(),
                'linked_cohorts' => count((array) ($cohortReadiness['linked_cohorts'] ?? [])),
                'feasibility_status' => $feasibilityPayload['status'] ?? null,
                'materialized_analysis_plans' => $analysisPlanAssets->count(),
                'package_assets' => $this->packageAssets($session, $version)->count(),
            ],
            'cohort_readiness' => $cohortReadiness,
            'feasibility_asset_id' => $feasibility?->id,
            'package_artifact' => $packageArtifact === null ? null : $this->artifactSummary($packageArtifact),
            'provenance_summary' => [
                'intent' => [
                    'version_id' => $version->id,
                    'version_number' => $version->version_number,
                    'status' => $version->status,
                    'accepted_by' => $version->accepted_by,
                    'accepted_at' => $version->accepted_at?->toIso8601String(),
                ],
                'ai_events' => $version->aiEvents()->count(),
                'reviewed_assets' => $session->assets()
                    ->where('version_id', $version->id)
                    ->whereNotNull('reviewed_at')
                    ->count(),
                'verified_assets' => $session->assets()
                    ->where('version_id', $version->id)
                    ->where('verification_status', StudyDesignVerificationStatus::VERIFIED->value)
                    ->count(),
                'package_manifest_sha256' => $packageArtifact?->metadata['manifest_sha256'] ?? null,
            ],
            'policy' => 'A Study Designer version can be locked only after accepted intent, materialized concept sets, linked native cohorts, ready source feasibility, and materialized HADES analysis plans are present.',
        ];
    }

    /**
     * @return array{readiness: array<string, mixed>, package_asset: StudyDesignAsset|null, study_artifact: StudyArtifact|null}
     */
    public function lock(Study $study, StudyDesignSession $session, StudyDesignVersion $version, int $userId): array
    {
        $readiness = $this->readiness($study, $session, $version);

        if ($version->status === 'locked') {
            return [
                'readiness' => $readiness,
                'package_asset' => $this->packageAssets($session, $version)->first(),
                'study_artifact' => $this->latestStudyPackageArtifact($study, $version),
            ];
        }

        if (($readiness['blockers'] ?? []) !== []) {
            throw ValidationException::withMessages([
                'lock' => collect($readiness['blockers'])->pluck('message')->values()->all(),
            ]);
        }

        return DB::transaction(function () use ($study, $session, $version, $userId, $readiness): array {
            $lockedAt = now();
            $manifest = $this->manifest($study, $session, $version, $readiness, $userId, $lockedAt->toIso8601String());
            $manifestJson = json_encode($manifest, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);

            if ($manifestJson === false) {
                throw ValidationException::withMessages(['lock' => 'Study package manifest could not be encoded.']);
            }

            $manifestHash = hash('sha256', $manifestJson);
            $filePath = "study-packages/study-{$study->id}/design-version-{$version->id}-{$manifestHash}.json";
            Storage::disk('local')->put($filePath, $manifestJson);

            $packageAsset = StudyDesignAsset::create([
                'session_id' => $session->id,
                'version_id' => $version->id,
                'asset_type' => 'study_package_snapshot',
                'role' => null,
                'status' => StudyDesignAssetStatus::MATERIALIZED->value,
                'draft_payload_json' => $manifest,
                'provenance_json' => [
                    'source' => 'study_designer_lock',
                    'study_id' => $study->id,
                    'version_id' => $version->id,
                    'locked_by' => $userId,
                    'locked_at' => $lockedAt->toIso8601String(),
                    'manifest_sha256' => $manifestHash,
                ],
                'verification_status' => StudyDesignVerificationStatus::VERIFIED->value,
                'verification_json' => [
                    'status' => StudyDesignVerificationStatus::VERIFIED->value,
                    'verified_at' => $lockedAt->toIso8601String(),
                    'eligibility' => [
                        'can_accept' => true,
                        'can_materialize' => true,
                        'reason' => 'Locked study package manifest preserves reviewed intent, provenance, cohorts, feasibility, and analysis plans.',
                    ],
                    'blocking_reasons' => [],
                    'warnings' => $readiness['warnings'] ?? [],
                    'checks' => [],
                    'acceptance_policy' => 'Locked package snapshots are immutable Study Designer provenance records.',
                ],
                'verified_at' => $lockedAt,
                'materialized_type' => StudyDesignVersion::class,
                'materialized_id' => $version->id,
                'materialized_at' => $lockedAt,
            ]);

            StudyArtifact::query()
                ->where('study_id', $study->id)
                ->where('artifact_type', 'study_package_zip')
                ->update(['is_current' => false]);

            $artifact = StudyArtifact::create([
                'study_id' => $study->id,
                'artifact_type' => 'study_package_zip',
                'title' => "Study Designer package v{$version->version_number}",
                'description' => 'Locked Study Designer package manifest for OHDSI-aligned execution handoff.',
                'version' => (string) $version->version_number,
                'file_path' => $filePath,
                'file_size_bytes' => strlen($manifestJson),
                'mime_type' => 'application/vnd.parthenon.study-package+json',
                'url' => "/api/v1/studies/{$study->slug}/artifacts/{artifact}/download",
                'metadata' => [
                    'design_session_id' => $session->id,
                    'design_version_id' => $version->id,
                    'package_asset_id' => $packageAsset->id,
                    'manifest_sha256' => $manifestHash,
                    'locked_at' => $lockedAt->toIso8601String(),
                    'readiness_summary' => $readiness['summary'] ?? [],
                ],
                'uploaded_by' => $userId,
                'is_current' => true,
            ]);

            $artifact->update([
                'url' => "/api/v1/studies/{$study->slug}/artifacts/{$artifact->id}/download",
            ]);

            $version->update(['status' => 'locked']);
            $session->update([
                'active_version_id' => $version->id,
                'status' => 'locked',
            ]);

            return [
                'readiness' => $this->readiness($study, $session->fresh() ?? $session, $version->fresh() ?? $version),
                'package_asset' => $packageAsset->fresh('reviewer:id,name,email'),
                'study_artifact' => $artifact->fresh('uploadedBy:id,name,email'),
            ];
        });
    }

    /**
     * @return array<string, mixed>
     */
    private function manifest(Study $study, StudyDesignSession $session, StudyDesignVersion $version, array $readiness, int $userId, string $lockedAt): array
    {
        return [
            'schema_version' => 'study-package.v1',
            'locked_at' => $lockedAt,
            'locked_by' => $userId,
            'study' => [
                'id' => $study->id,
                'slug' => $study->slug,
                'title' => $study->title,
                'study_type' => $study->study_type,
                'study_design' => $study->study_design,
            ],
            'design_session' => [
                'id' => $session->id,
                'title' => $session->title,
                'source_mode' => $session->source_mode,
            ],
            'design_version' => [
                'id' => $version->id,
                'version_number' => $version->version_number,
                'status' => $version->status,
                'accepted_by' => $version->accepted_by,
                'accepted_at' => $version->accepted_at?->toIso8601String(),
                'spec_json' => $version->spec_json,
                'normalized_spec_json' => $version->normalized_spec_json,
                'lint_results_json' => $version->lint_results_json,
            ],
            'concept_sets' => $this->materializedConceptSetAssets($session, $version)
                ->map(fn (StudyDesignAsset $asset): array => $this->assetSummary($asset))
                ->values()
                ->all(),
            'cohorts' => $study->cohorts()
                ->with('cohortDefinition')
                ->orderBy('sort_order')
                ->get()
                ->map(fn (StudyCohort $cohort): array => [
                    'study_cohort_id' => $cohort->id,
                    'role' => $cohort->role,
                    'label' => $cohort->label,
                    'cohort_definition_id' => $cohort->cohort_definition_id,
                    'cohort_definition_name' => $cohort->cohortDefinition?->name,
                    'concept_set_ids' => $cohort->concept_set_ids ?? [],
                ])
                ->values()
                ->all(),
            'feasibility' => [
                'asset' => $this->latestFeasibilityAsset($session, $version)?->only(['id', 'asset_type', 'verification_status', 'verified_at']),
                'result' => $this->latestFeasibilityAsset($session, $version)?->draft_payload_json,
            ],
            'analysis_plans' => $this->materializedAnalysisPlanAssets($session, $version)
                ->map(fn (StudyDesignAsset $asset): array => $this->assetSummary($asset))
                ->values()
                ->all(),
            'study_analyses' => StudyAnalysis::query()
                ->where('study_id', $study->id)
                ->orderBy('id')
                ->get(['id', 'analysis_type', 'analysis_id'])
                ->map(fn (StudyAnalysis $analysis): array => $analysis->toArray())
                ->values()
                ->all(),
            'ai_events' => $version->aiEvents()
                ->orderBy('id')
                ->get(['id', 'event_type', 'provider', 'model', 'prompt_template_version', 'latency_ms', 'created_at'])
                ->map(fn ($event): array => $event->toArray())
                ->values()
                ->all(),
            'readiness' => $readiness,
            'policy' => 'This package freezes the reviewed Study Designer path from intent through materialized OHDSI assets for execution handoff and audit.',
        ];
    }

    private function latestFeasibilityAsset(StudyDesignSession $session, StudyDesignVersion $version): ?StudyDesignAsset
    {
        return $session->assets()
            ->where('version_id', $version->id)
            ->where('asset_type', 'feasibility_result')
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->first();
    }

    /**
     * @return EloquentCollection<int, StudyDesignAsset>
     */
    private function materializedConceptSetAssets(StudyDesignSession $session, StudyDesignVersion $version): EloquentCollection
    {
        return $session->assets()
            ->where('version_id', $version->id)
            ->where('asset_type', 'concept_set_draft')
            ->where('status', StudyDesignAssetStatus::MATERIALIZED->value)
            ->where('materialized_type', ConceptSet::class)
            ->whereNotNull('materialized_id')
            ->orderBy('id')
            ->get();
    }

    /**
     * @return EloquentCollection<int, StudyDesignAsset>
     */
    private function materializedAnalysisPlanAssets(StudyDesignSession $session, StudyDesignVersion $version): EloquentCollection
    {
        return $session->assets()
            ->where('version_id', $version->id)
            ->where('asset_type', 'analysis_plan')
            ->where('status', StudyDesignAssetStatus::MATERIALIZED->value)
            ->whereNotNull('materialized_id')
            ->orderBy('id')
            ->get();
    }

    /**
     * @return EloquentCollection<int, StudyDesignAsset>
     */
    private function packageAssets(StudyDesignSession $session, StudyDesignVersion $version): EloquentCollection
    {
        return $session->assets()
            ->where('version_id', $version->id)
            ->where('asset_type', 'study_package_snapshot')
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->get();
    }

    private function latestStudyPackageArtifact(Study $study, StudyDesignVersion $version): ?StudyArtifact
    {
        return StudyArtifact::query()
            ->where('study_id', $study->id)
            ->where('artifact_type', 'study_package_zip')
            ->where('metadata->design_version_id', $version->id)
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->first();
    }

    /**
     * @return array<string, mixed>
     */
    private function artifactSummary(StudyArtifact $artifact): array
    {
        return [
            'id' => $artifact->id,
            'artifact_type' => $artifact->artifact_type,
            'title' => $artifact->title,
            'version' => $artifact->version,
            'file_size_bytes' => $artifact->file_size_bytes,
            'mime_type' => $artifact->mime_type,
            'url' => $artifact->url,
            'metadata' => $artifact->metadata,
            'created_at' => $artifact->created_at?->toIso8601String(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function assetSummary(StudyDesignAsset $asset): array
    {
        return [
            'id' => $asset->id,
            'asset_type' => $asset->asset_type,
            'role' => $asset->role,
            'status' => $asset->status,
            'verification_status' => $asset->verification_status,
            'draft_payload_json' => $asset->draft_payload_json,
            'provenance_json' => $asset->provenance_json,
            'materialized_type' => $asset->materialized_type,
            'materialized_id' => $asset->materialized_id,
            'materialized_at' => $asset->materialized_at?->toIso8601String(),
            'reviewed_by' => $asset->reviewed_by,
            'reviewed_at' => $asset->reviewed_at?->toIso8601String(),
        ];
    }

    /**
     * @param  array<string, mixed>  $meta
     * @return array<string, mixed>
     */
    private function issue(string $code, string $message, array $meta = []): array
    {
        return [
            'code' => $code,
            'message' => $message,
            'meta' => $meta,
        ];
    }
}
