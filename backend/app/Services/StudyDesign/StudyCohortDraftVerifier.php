<?php

namespace App\Services\StudyDesign;

use App\Enums\StudyDesignVerificationStatus;
use App\Models\App\CohortDefinition;
use App\Models\App\ConceptSet;
use App\Models\App\StudyDesignAsset;

class StudyCohortDraftVerifier
{
    /**
     * @return array{verification_status:string,verified_at:mixed,verification_json:array<string,mixed>}
     */
    public function verify(StudyDesignAsset $asset): array
    {
        $payload = $asset->draft_payload_json ?? [];
        $canonical = $this->canonicalStatus($asset);
        $conceptSetStatus = $this->conceptSetStatus($asset, $payload);

        $ready = $canonical['ready'] || $conceptSetStatus['ready'];

        return [
            'verification_status' => $ready
                ? StudyDesignVerificationStatus::VERIFIED->value
                : StudyDesignVerificationStatus::BLOCKED->value,
            'verified_at' => $ready ? now() : null,
            'verification_json' => [
                'checks' => [
                    'canonical_cohort_active' => $canonical['ready'],
                    'has_verified_materialized_concept_set_assets' => $conceptSetStatus['verified_asset_count'] > 0,
                    'has_existing_concept_sets' => $conceptSetStatus['existing_concept_set_count'] > 0,
                ],
                'canonical' => $canonical,
                'concept_sets' => $conceptSetStatus,
                'messages' => $ready
                    ? []
                    : ['Cohort drafts require an active canonical cohort or verified materialized concept set assets.'],
            ],
        ];
    }

    /**
     * @return array{ready:bool,exists:bool,deprecated:bool,cohort_definition_id:int|null}
     */
    private function canonicalStatus(StudyDesignAsset $asset): array
    {
        if ($asset->canonical_type !== CohortDefinition::class || ! $asset->canonical_id) {
            return [
                'ready' => false,
                'exists' => false,
                'deprecated' => false,
                'cohort_definition_id' => null,
            ];
        }

        $cohort = CohortDefinition::find($asset->canonical_id);
        $deprecated = $cohort?->deprecated_at !== null;

        return [
            'ready' => $cohort !== null && ! $deprecated,
            'exists' => $cohort !== null,
            'deprecated' => $deprecated,
            'cohort_definition_id' => $asset->canonical_id,
        ];
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return array{ready:bool,verified_asset_count:int,blocked_asset_count:int,existing_concept_set_count:int,missing_concept_set_ids:list<int>}
     */
    private function conceptSetStatus(StudyDesignAsset $asset, array $payload): array
    {
        $assetIds = collect($payload['concept_set_asset_ids'] ?? [])
            ->filter(fn ($id) => is_numeric($id))
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values();

        $conceptSetIds = collect($payload['concept_set_ids'] ?? [])
            ->filter(fn ($id) => is_numeric($id))
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values();

        $relatedAssets = StudyDesignAsset::query()
            ->where('session_id', $asset->session_id)
            ->whereIn('id', $assetIds)
            ->get();

        $verifiedAssets = $relatedAssets->filter(fn (StudyDesignAsset $related) => $related->materialized_type === ConceptSet::class
            && $related->materialized_id !== null
            && $this->verificationValue($related) === StudyDesignVerificationStatus::VERIFIED->value);

        $existingConceptSetIds = ConceptSet::query()
            ->whereIn('id', $conceptSetIds)
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->all();

        return [
            'ready' => $verifiedAssets->isNotEmpty(),
            'verified_asset_count' => $verifiedAssets->count(),
            'blocked_asset_count' => $relatedAssets->filter(fn (StudyDesignAsset $related) => $this->verificationValue($related) === StudyDesignVerificationStatus::BLOCKED->value)->count(),
            'existing_concept_set_count' => count($existingConceptSetIds),
            'missing_concept_set_ids' => array_values(array_diff($conceptSetIds->all(), $existingConceptSetIds)),
        ];
    }

    private function verificationValue(StudyDesignAsset $asset): string
    {
        $status = $asset->verification_status;

        return $status instanceof StudyDesignVerificationStatus ? $status->value : (string) $status;
    }
}
