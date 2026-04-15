<?php

namespace App\Services\StudyDesign;

use App\Enums\StudyDesignAssetStatus;
use App\Enums\StudyDesignVerificationStatus;
use App\Models\App\CohortDefinition;
use App\Models\App\StudyDesignAsset;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class StudyCohortMaterializer
{
    public function __construct(
        private readonly StudyCohortDraftVerifier $verifier,
    ) {}

    public function materialize(StudyDesignAsset $asset, int $userId): CohortDefinition
    {
        if ($asset->asset_type !== 'cohort_draft') {
            throw ValidationException::withMessages([
                'asset' => 'Only cohort draft assets can be materialized as cohort definitions.',
            ]);
        }

        if ($asset->materialized_type !== null || $asset->materialized_id !== null) {
            throw ValidationException::withMessages([
                'asset' => 'This cohort draft has already been materialized.',
            ]);
        }

        if ($asset->verification_status === StudyDesignVerificationStatus::UNVERIFIED->value) {
            $asset = $this->verifier->verify($asset);
        }

        if ($asset->verification_status !== StudyDesignVerificationStatus::VERIFIED->value) {
            throw ValidationException::withMessages([
                'verification' => 'Only verified cohort drafts can be materialized.',
            ]);
        }

        if ($asset->status !== StudyDesignAssetStatus::ACCEPTED->value) {
            throw ValidationException::withMessages([
                'asset' => 'Accept the verified cohort draft before materializing it.',
            ]);
        }

        return DB::transaction(function () use ($asset, $userId): CohortDefinition {
            $payload = $asset->draft_payload_json ?? [];

            $cohort = CohortDefinition::create([
                'name' => (string) ($payload['title'] ?? 'Study Designer cohort draft'),
                'description' => $payload['logic_description'] ?? null,
                'expression_json' => $payload['expression_json'] ?? [],
                'author_id' => $userId,
                'is_public' => false,
                'tags' => ['study-designer'],
            ]);

            $asset->update([
                'status' => StudyDesignAssetStatus::MATERIALIZED->value,
                'materialized_type' => CohortDefinition::class,
                'materialized_id' => $cohort->id,
                'materialized_at' => now(),
            ]);

            return $cohort->fresh('author:id,name,email') ?? $cohort;
        });
    }
}
