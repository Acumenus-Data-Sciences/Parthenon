<?php

namespace App\Services\StudyDesign;

use App\Enums\StudyDesignAssetStatus;
use App\Enums\StudyDesignVerificationStatus;
use App\Models\App\ConceptSet;
use App\Models\App\StudyDesignAsset;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class StudyConceptSetMaterializer
{
    public function __construct(
        private readonly StudyConceptSetDraftVerifier $verifier,
    ) {}

    public function materialize(StudyDesignAsset $asset, int $userId): ConceptSet
    {
        if ($asset->asset_type !== 'concept_set_draft') {
            throw ValidationException::withMessages([
                'asset' => 'Only concept set draft assets can be materialized as concept sets.',
            ]);
        }

        if ($asset->materialized_type !== null || $asset->materialized_id !== null) {
            throw ValidationException::withMessages([
                'asset' => 'This concept set draft has already been materialized.',
            ]);
        }

        if ($asset->verification_status === StudyDesignVerificationStatus::UNVERIFIED->value) {
            $asset = $this->verifier->verify($asset);
        }

        if ($asset->verification_status !== StudyDesignVerificationStatus::VERIFIED->value) {
            throw ValidationException::withMessages([
                'verification' => 'Only verified concept set drafts can be materialized.',
            ]);
        }

        if ($asset->status !== StudyDesignAssetStatus::ACCEPTED->value) {
            throw ValidationException::withMessages([
                'asset' => 'Accept the verified concept set draft before materializing it.',
            ]);
        }

        return DB::transaction(function () use ($asset, $userId): ConceptSet {
            $payload = $asset->draft_payload_json ?? [];
            $concepts = $this->verifier->normalizeConcepts((array) ($payload['concepts'] ?? []));

            $conceptSet = ConceptSet::create([
                'name' => (string) ($payload['title'] ?? 'Study Designer concept set'),
                'description' => $payload['clinical_rationale'] ?? null,
                'expression_json' => $this->expressionJson($payload, $concepts),
                'author_id' => $userId,
                'is_public' => false,
                'tags' => ['study-designer'],
            ]);

            foreach ($concepts as $concept) {
                $conceptId = $concept['concept_id'] ?? null;
                if (! is_int($conceptId)) {
                    continue;
                }

                $conceptSet->items()->create([
                    'concept_id' => $conceptId,
                    'is_excluded' => (bool) ($concept['is_excluded'] ?? false),
                    'include_descendants' => (bool) ($concept['include_descendants'] ?? true),
                    'include_mapped' => (bool) ($concept['include_mapped'] ?? false),
                ]);
            }

            $asset->update([
                'status' => StudyDesignAssetStatus::MATERIALIZED->value,
                'materialized_type' => ConceptSet::class,
                'materialized_id' => $conceptSet->id,
                'materialized_at' => now(),
            ]);

            return $conceptSet->fresh(['items', 'author']) ?? $conceptSet;
        });
    }

    /**
     * @param  array<string, mixed>  $payload
     * @param  list<array<string, mixed>>  $concepts
     * @return array<string, mixed>
     */
    private function expressionJson(array $payload, array $concepts): array
    {
        return [
            'items' => collect($concepts)
                ->map(fn (array $concept) => [
                    'concept' => [
                        'CONCEPT_ID' => $concept['concept_id'] ?? null,
                    ],
                    'isExcluded' => (bool) ($concept['is_excluded'] ?? false),
                    'includeDescendants' => (bool) ($concept['include_descendants'] ?? true),
                    'includeMapped' => (bool) ($concept['include_mapped'] ?? false),
                ])
                ->values()
                ->all(),
            'study_designer' => [
                'role' => $payload['role'] ?? null,
                'source_concept_set_references' => $payload['source_concept_set_references'] ?? [],
                'materialized_at' => now()->toIso8601String(),
            ],
        ];
    }
}
