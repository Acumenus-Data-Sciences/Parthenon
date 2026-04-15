<?php

namespace App\Services\StudyDesign;

use App\Enums\StudyDesignVerificationStatus;
use Illuminate\Support\Facades\DB;

class StudyConceptSetDraftVerifier
{
    /**
     * @param  array<string, mixed>  $payload
     * @return array{verification_status:string,verified_at:mixed,verification_json:array<string,mixed>}
     */
    public function verify(array $payload): array
    {
        $conceptIds = $this->conceptIds($payload);
        $invalidLocalIds = $this->invalidLocalConceptIds($payload);
        $missingConceptIds = $this->missingConceptIds($conceptIds);
        $invalidVocabularyIds = $this->invalidVocabularyConceptIds($conceptIds);
        $blocked = $conceptIds === [] || $invalidLocalIds !== [] || $missingConceptIds !== [] || $invalidVocabularyIds !== [];

        return [
            'verification_status' => $blocked
                ? StudyDesignVerificationStatus::Blocked->value
                : StudyDesignVerificationStatus::Verified->value,
            'verified_at' => $blocked ? null : now(),
            'verification_json' => [
                'checks' => [
                    'has_concepts' => $conceptIds !== [],
                    'all_concept_ids_are_positive_integers' => $invalidLocalIds === [],
                    'all_concepts_exist_in_vocab_concept' => $missingConceptIds === [],
                    'all_concepts_are_current' => $invalidVocabularyIds === [],
                ],
                'concept_ids' => $conceptIds,
                'invalid_local_concept_ids' => $invalidLocalIds,
                'missing_concept_ids' => $missingConceptIds,
                'invalid_vocabulary_concept_ids' => $invalidVocabularyIds,
                'messages' => $blocked
                    ? ['Every concept set draft must contain current, valid OMOP concept IDs before materialization.']
                    : [],
            ],
        ];
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return list<int>
     */
    private function conceptIds(array $payload): array
    {
        return collect($payload['concepts'] ?? [])
            ->pluck('concept_id')
            ->filter(fn ($id) => is_numeric($id) && (int) $id > 0)
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values()
            ->all();
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return list<mixed>
     */
    private function invalidLocalConceptIds(array $payload): array
    {
        return collect($payload['concepts'] ?? [])
            ->pluck('concept_id')
            ->reject(fn ($id) => is_numeric($id) && (int) $id > 0)
            ->values()
            ->all();
    }

    /**
     * @param  list<int>  $conceptIds
     * @return list<int>
     */
    private function missingConceptIds(array $conceptIds): array
    {
        if ($conceptIds === []) {
            return [];
        }

        return array_values(array_diff($conceptIds, $this->foundConceptIds($conceptIds)));
    }

    /**
     * @param  list<int>  $conceptIds
     * @return list<int>
     */
    private function invalidVocabularyConceptIds(array $conceptIds): array
    {
        if ($conceptIds === []) {
            return [];
        }

        try {
            return DB::table('vocab.concept')
                ->whereIn('concept_id', $conceptIds)
                ->whereNotNull('invalid_reason')
                ->pluck('concept_id')
                ->map(fn ($id) => (int) $id)
                ->values()
                ->all();
        } catch (\Throwable) {
            return $conceptIds;
        }
    }

    /**
     * @param  list<int>  $conceptIds
     * @return list<int>
     */
    private function foundConceptIds(array $conceptIds): array
    {
        try {
            return DB::table('vocab.concept')
                ->whereIn('concept_id', $conceptIds)
                ->pluck('concept_id')
                ->map(fn ($id) => (int) $id)
                ->all();
        } catch (\Throwable) {
            return [];
        }
    }
}
