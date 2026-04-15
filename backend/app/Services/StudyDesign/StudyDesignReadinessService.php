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
     * @return array{ready:bool,cohort_asset_count:int,materialized_verified_count:int,blocked_count:int}
     */
    public function cohortReadiness(StudyDesignSession $session, StudyDesignVersion $version): array
    {
        $cohortAssets = $session->assets()
            ->where('version_id', $version->id)
            ->whereIn('asset_type', ['cohort_draft', 'imported_study_cohort'])
            ->get();

        $readyAssets = $cohortAssets->filter(fn (StudyDesignAsset $asset) => $asset->materialized_id !== null
            && $this->verificationValue($asset) === StudyDesignVerificationStatus::Verified->value);

        return [
            'ready' => $readyAssets->isNotEmpty(),
            'cohort_asset_count' => $cohortAssets->count(),
            'materialized_verified_count' => $readyAssets->count(),
            'blocked_count' => $cohortAssets->filter(fn (StudyDesignAsset $asset) => $this->verificationValue($asset) === StudyDesignVerificationStatus::Blocked->value)->count(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function lockReadiness(Study $study, StudyDesignSession $session, StudyDesignVersion $version): array
    {
        $assets = $session->assets()->where('version_id', $version->id)->get();
        $cohortReadiness = $this->cohortReadiness($session, $version);
        $hasFeasibility = $assets->contains(fn (StudyDesignAsset $asset) => $asset->asset_type === 'feasibility_evidence'
            && $this->verificationValue($asset) === StudyDesignVerificationStatus::Verified->value);
        $hasAnalysis = $assets->contains(fn (StudyDesignAsset $asset) => in_array($asset->asset_type, ['analysis_plan_draft', 'imported_study_analysis'], true)
            && $asset->materialized_id !== null
            && $this->verificationValue($asset) === StudyDesignVerificationStatus::Verified->value);
        $blocking = [];

        if (! in_array($version->status, ['accepted', 'locked'], true)) {
            $blocking[] = 'Accept the design intent before locking.';
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

        return [
            'ready' => $blocking === [],
            'blocking_reasons' => $blocking,
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
                'verified_assets' => $assets->filter(fn (StudyDesignAsset $asset) => $this->verificationValue($asset) === StudyDesignVerificationStatus::Verified->value)->count(),
                'package_manifest_sha256' => $version->provenance_json['package_manifest_sha256'] ?? null,
            ],
        ];
    }

    private function verificationValue(StudyDesignAsset $asset): string
    {
        $status = $asset->verification_status;

        return $status instanceof StudyDesignVerificationStatus ? $status->value : (string) $status;
    }
}
