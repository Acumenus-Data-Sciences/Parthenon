<?php

namespace App\Services\StudyDesign;

use App\Enums\StudyDesignVerificationStatus;
use App\Models\App\Study;
use App\Models\App\StudyArtifact;
use App\Models\App\StudyDesignAsset;
use App\Models\App\StudyDesignSession;
use App\Models\App\StudyDesignVersion;

class StudyDesignReadinessService
{
    /**
     * @return array{ready:bool,ready_for_feasibility:bool,cohort_asset_count:int,materialized_verified_count:int,blocked_count:int}
     */
    public function cohortReadiness(StudyDesignSession $session, StudyDesignVersion $version): array
    {
        $cohortAssets = $session->assets()
            ->where('version_id', $version->id)
            ->whereIn('asset_type', ['cohort_draft', 'imported_study_cohort'])
            ->get();

        $readyAssets = $cohortAssets->filter(fn (StudyDesignAsset $asset) => $asset->materialized_id !== null
            && $this->verificationValue($asset) === StudyDesignVerificationStatus::VERIFIED->value);

        return [
            'ready' => $readyAssets->isNotEmpty(),
            'ready_for_feasibility' => $readyAssets->isNotEmpty(),
            'cohort_asset_count' => $cohortAssets->count(),
            'materialized_verified_count' => $readyAssets->count(),
            'blocked_count' => $cohortAssets->filter(fn (StudyDesignAsset $asset) => $this->verificationValue($asset) === StudyDesignVerificationStatus::BLOCKED->value)->count(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function lockReadiness(Study $study, StudyDesignSession $session, StudyDesignVersion $version): array
    {
        $assets = $session->assets()->where('version_id', $version->id)->get();
        $cohortReadiness = $this->cohortReadiness($session, $version);
        $acceptedRecommendations = $assets->filter(fn (StudyDesignAsset $asset) => in_array($asset->asset_type, ['phenotype_recommendation', 'local_cohort', 'local_concept_set'], true)
            && $this->assetStatus($asset) === 'accepted')->count();
        $materializedConceptSets = $assets->filter(fn (StudyDesignAsset $asset) => in_array($asset->asset_type, ['concept_set_draft', 'imported_concept_set'], true)
            && $asset->materialized_id !== null
            && $this->verificationValue($asset) === StudyDesignVerificationStatus::VERIFIED->value)->count();
        $hasFeasibility = $assets->contains(fn (StudyDesignAsset $asset) => $asset->asset_type === 'feasibility_result'
            && $this->verificationValue($asset) === StudyDesignVerificationStatus::VERIFIED->value);
        $hasAnalysis = $assets->contains(fn (StudyDesignAsset $asset) => in_array($asset->asset_type, ['analysis_plan', 'imported_study_analysis'], true)
            && $asset->materialized_id !== null
            && $this->verificationValue($asset) === StudyDesignVerificationStatus::VERIFIED->value);
        $blocking = [];
        $warnings = [];

        if (! in_array($version->status, ['accepted', 'locked'], true)) {
            $blocking[] = 'Accept the design intent before locking.';
        }
        if ($acceptedRecommendations === 0) {
            $warnings[] = 'No accepted phenotype or reuse recommendation is recorded for this version.';
        }
        if ($materializedConceptSets === 0) {
            $warnings[] = 'No materialized concept set draft is recorded for this version.';
        }
        if (! $cohortReadiness['ready']) {
            $blocking[] = 'At least one verified materialized cohort is required.';
        }
        if (! $hasFeasibility) {
            $blocking[] = 'Ready feasibility evidence is required.';
        }
        if (! $hasAnalysis) {
            $blocking[] = 'At least one verified materialized analysis plan is required.';
        }

        $artifact = null;
        $artifactId = $version->provenance_json['package_artifact_id'] ?? null;
        if ($artifactId) {
            $artifact = StudyArtifact::find($artifactId);
        }
        $summary = [
            'accepted_recommendations' => $acceptedRecommendations,
            'materialized_concept_sets' => $materializedConceptSets,
            'linked_cohorts' => $cohortReadiness['materialized_verified_count'],
            'feasibility_status' => $hasFeasibility ? 'ready' : null,
            'materialized_analysis_plans' => $hasAnalysis ? $assets->filter(fn (StudyDesignAsset $asset) => in_array($asset->asset_type, ['analysis_plan', 'imported_study_analysis'], true)
                && $asset->materialized_id !== null
                && $this->verificationValue($asset) === StudyDesignVerificationStatus::VERIFIED->value)->count() : 0,
            'package_assets' => $artifact ? 1 : 0,
        ];
        $structuredBlockers = collect($blocking)
            ->map(fn (string $message, int $index): array => $this->issue('lock_blocker_'.$index, $message))
            ->values()
            ->all();
        $structuredWarnings = collect($warnings)
            ->map(fn (string $message, int $index): array => $this->issue('lock_warning_'.$index, $message))
            ->values()
            ->all();
        $checklist = $this->lockChecklist($version, $summary, $cohortReadiness, $hasFeasibility, $hasAnalysis, $artifact, $structuredBlockers, $structuredWarnings);
        $manifestPreview = $this->manifestPreview($study, $session, $version, $summary, $artifact);
        $ready = $blocking === [];

        return [
            'ready' => $ready,
            'status' => $version->status === 'locked' ? 'locked' : ($ready ? 'ready' : 'blocked'),
            'can_lock' => $ready && $version->status !== 'locked',
            'locked' => $version->status === 'locked',
            'blocking_reasons' => $blocking,
            'blockers' => $structuredBlockers,
            'warnings' => $structuredWarnings,
            'summary' => $summary,
            'checklist' => $checklist,
            'abby_final_review' => [
                'status' => $ready ? 'ready' : 'blocked',
                'summary' => $ready
                    ? 'Abby finds the package ready for lock after final human review.'
                    : 'Abby found lock blockers that must be resolved before package freeze.',
                'recommendation' => $ready ? 'Review the manifest preview and lock the package.' : 'Resolve blockers in the checklist before locking.',
                'risk_notes' => $warnings,
            ],
            'manifest_preview' => $manifestPreview,
            'cohorts' => $cohortReadiness,
            'feasibility_ready' => $hasFeasibility,
            'analysis_plan_ready' => $hasAnalysis,
            'package_artifact' => $artifact,
            'provenance_summary' => [
                'study_id' => $study->id,
                'version_status' => $version->status,
                'accepted_at' => $version->accepted_at?->toISOString(),
                'ai_events' => $session->aiEvents()->count(),
                'reviewed_assets' => $assets->whereNotNull('reviewed_at')->count(),
                'verified_assets' => $assets->filter(fn (StudyDesignAsset $asset) => $this->verificationValue($asset) === StudyDesignVerificationStatus::VERIFIED->value)->count(),
                'package_manifest_sha256' => $version->provenance_json['package_manifest_sha256'] ?? null,
            ],
        ];
    }

    /**
     * @param  array<string, mixed>  $summary
     * @param  array<string, mixed>  $cohortReadiness
     * @param  list<array<string, mixed>>  $blockers
     * @param  list<array<string, mixed>>  $warnings
     * @return list<array<string, mixed>>
     */
    private function lockChecklist(StudyDesignVersion $version, array $summary, array $cohortReadiness, bool $hasFeasibility, bool $hasAnalysis, ?StudyArtifact $artifact, array $blockers, array $warnings): array
    {
        return [
            [
                'id' => 'intent',
                'label' => 'Intent',
                'status' => in_array($version->status, ['accepted', 'locked'], true) ? 'complete' : 'blocked',
                'message' => in_array($version->status, ['accepted', 'locked'], true) ? 'Intent version is accepted.' : 'Accept the intent before package lock.',
                'blockers' => array_values(array_filter($blockers, fn (array $blocker): bool => str_contains((string) $blocker['message'], 'intent'))),
                'warnings' => [],
            ],
            [
                'id' => 'recommendations',
                'label' => 'Recommendations',
                'status' => ($summary['accepted_recommendations'] ?? 0) > 0 ? 'complete' : 'warning',
                'message' => ($summary['accepted_recommendations'] ?? 0).' accepted reuse recommendation(s).',
                'blockers' => [],
                'warnings' => array_values(array_filter($warnings, fn (array $warning): bool => str_contains((string) $warning['message'], 'recommendation'))),
            ],
            [
                'id' => 'concept_sets',
                'label' => 'Concept Sets',
                'status' => ($summary['materialized_concept_sets'] ?? 0) > 0 ? 'complete' : 'warning',
                'message' => ($summary['materialized_concept_sets'] ?? 0).' materialized concept set(s).',
                'blockers' => [],
                'warnings' => array_values(array_filter($warnings, fn (array $warning): bool => str_contains((string) $warning['message'], 'concept set'))),
            ],
            [
                'id' => 'cohorts',
                'label' => 'Cohorts',
                'status' => ($cohortReadiness['ready'] ?? false) ? 'complete' : 'blocked',
                'message' => ($summary['linked_cohorts'] ?? 0).' verified materialized cohort(s).',
                'blockers' => array_values(array_filter($blockers, fn (array $blocker): bool => str_contains((string) $blocker['message'], 'cohort'))),
                'warnings' => [],
            ],
            [
                'id' => 'feasibility',
                'label' => 'Feasibility',
                'status' => $hasFeasibility ? 'complete' : 'blocked',
                'message' => $hasFeasibility ? 'Ready source feasibility evidence is present.' : 'Run source feasibility before lock.',
                'blockers' => array_values(array_filter($blockers, fn (array $blocker): bool => str_contains((string) $blocker['message'], 'feasibility'))),
                'warnings' => [],
            ],
            [
                'id' => 'analyses',
                'label' => 'Analyses',
                'status' => $hasAnalysis ? 'complete' : 'blocked',
                'message' => ($summary['materialized_analysis_plans'] ?? 0).' materialized analysis plan(s).',
                'blockers' => array_values(array_filter($blockers, fn (array $blocker): bool => str_contains((string) $blocker['message'], 'analysis plan'))),
                'warnings' => [],
            ],
            [
                'id' => 'package',
                'label' => 'Package Artifact',
                'status' => $artifact ? 'complete' : 'pending',
                'message' => $artifact ? 'Package artifact is available for download.' : 'Package artifact will be created when the version is locked.',
                'blockers' => [],
                'warnings' => [],
            ],
        ];
    }

    /**
     * @param  array<string, mixed>  $summary
     * @return array<string, mixed>
     */
    private function manifestPreview(Study $study, StudyDesignSession $session, StudyDesignVersion $version, array $summary, ?StudyArtifact $artifact): array
    {
        return [
            'schema_version' => 'study-package.v1',
            'study' => [
                'id' => $study->id,
                'slug' => $study->slug,
                'title' => $study->title,
            ],
            'design_session' => $session->only(['id', 'title', 'source_mode']),
            'design_version' => [
                'id' => $version->id,
                'version_number' => $version->version_number,
                'status' => $version->status,
            ],
            'contents' => [
                'recommendations' => $summary['accepted_recommendations'] ?? 0,
                'concept_sets' => $summary['materialized_concept_sets'] ?? 0,
                'cohorts' => $summary['linked_cohorts'] ?? 0,
                'feasibility' => $summary['feasibility_status'] ?? null,
                'analysis_plans' => $summary['materialized_analysis_plans'] ?? 0,
            ],
            'artifact' => $artifact ? [
                'id' => $artifact->id,
                'title' => $artifact->title,
                'url' => $artifact->url,
                'mime_type' => $artifact->mime_type,
                'file_size_bytes' => $artifact->file_size_bytes,
                'sha256' => $version->provenance_json['package_manifest_sha256'] ?? $artifact->metadata['sha256'] ?? null,
            ] : null,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function issue(string $code, string $message): array
    {
        return [
            'code' => $code,
            'message' => $message,
        ];
    }

    private function verificationValue(StudyDesignAsset $asset): string
    {
        $status = $asset->verification_status;

        return $status instanceof StudyDesignVerificationStatus ? $status->value : (string) $status;
    }

    private function assetStatus(StudyDesignAsset $asset): string
    {
        $status = $asset->status;

        return $status instanceof \BackedEnum ? (string) $status->value : (string) $status;
    }
}
