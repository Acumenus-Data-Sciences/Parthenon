<?php

namespace App\Services\StudyDesign;

use App\Enums\StudyDesignVerificationStatus;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class StudyConceptSetDraftVerifier
{
    /**
     * Normalize a raw list of concept entries (from various API shapes) into
     * a stable internal schema used by both the materializer and the verifier.
     *
     * @param  list<array<string, mixed>>  $items
     * @return list<array<string, mixed>>
     */
    public function normalizeConcepts(array $items): array
    {
        return collect($items)
            ->map(function (array $item): array {
                $rawConcept = (array) ($item['concept'] ?? []);
                $conceptId = $item['concept_id'] ?? $rawConcept['concept_id'] ?? $rawConcept['CONCEPT_ID'] ?? null;

                return [
                    'concept_id' => is_numeric($conceptId) ? (int) $conceptId : null,
                    'is_excluded' => (bool) ($item['is_excluded'] ?? $item['isExcluded'] ?? false),
                    'include_descendants' => (bool) ($item['include_descendants'] ?? $item['includeDescendants'] ?? true),
                    'include_mapped' => (bool) ($item['include_mapped'] ?? $item['includeMapped'] ?? false),
                    'rationale' => $item['rationale'] ?? null,
                ];
            })
            ->values()
            ->all();
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return array{verification_status:string,verified_at:mixed,verification_json:array<string,mixed>}
     */
    public function verify(array $payload): array
    {
        $concepts = $this->normalizeConcepts((array) ($payload['concepts'] ?? []));
        $conceptIds = $this->conceptIdsFromNormalized($concepts);
        $invalidLocalIds = $this->invalidLocalConceptIdsFromNormalized($concepts);
        $vocabularyConcepts = $this->vocabularyConcepts($conceptIds);
        $missingConceptIds = array_values(array_diff($conceptIds, $vocabularyConcepts->keys()->map(fn ($id) => (int) $id)->all()));
        $invalidVocabularyIds = $this->invalidVocabularyConceptIdsFromRows($vocabularyConcepts);
        $nonStandardConceptIds = $this->nonStandardConceptIds($vocabularyConcepts);
        $domainMismatchConceptIds = $this->domainMismatchConceptIds($vocabularyConcepts, $payload['domain'] ?? null);
        $blocked = $conceptIds === []
            || $invalidLocalIds !== []
            || $missingConceptIds !== []
            || $invalidVocabularyIds !== []
            || $nonStandardConceptIds !== []
            || $domainMismatchConceptIds !== [];
        $status = $blocked ? StudyDesignVerificationStatus::BLOCKED->value : StudyDesignVerificationStatus::VERIFIED->value;
        $blockingReasons = $this->blockingReasons($conceptIds, $invalidLocalIds, $missingConceptIds, $invalidVocabularyIds, $nonStandardConceptIds, $domainMismatchConceptIds, $payload['domain'] ?? null);

        return [
            'verification_status' => $status,
            'verified_at' => $blocked ? null : now(),
            'verification_json' => [
                'status' => $status,
                'checks' => [
                    'has_concepts' => $conceptIds !== [],
                    'all_concept_ids_are_positive_integers' => $invalidLocalIds === [],
                    'all_concepts_exist_in_vocab_concept' => $missingConceptIds === [],
                    'all_concepts_are_current' => $invalidVocabularyIds === [],
                    'all_concepts_are_standard' => $nonStandardConceptIds === [],
                    'all_concepts_match_domain' => $domainMismatchConceptIds === [],
                ],
                'eligibility' => [
                    'can_accept' => ! $blocked,
                    'can_materialize' => ! $blocked,
                    'reason' => $blocked
                        ? 'Concept set draft must pass deterministic OMOP vocabulary checks before acceptance or materialization.'
                        : 'Concept set draft can be accepted and materialized after user review.',
                ],
                'concept_ids' => $conceptIds,
                'concepts' => $this->enrichedConcepts($concepts, $vocabularyConcepts),
                'invalid_local_concept_ids' => $invalidLocalIds,
                'missing_concept_ids' => $missingConceptIds,
                'invalid_vocabulary_concept_ids' => $invalidVocabularyIds,
                'non_standard_concept_ids' => $nonStandardConceptIds,
                'domain_mismatch_concept_ids' => $domainMismatchConceptIds,
                'blocking_reasons' => $blockingReasons,
                'warnings' => [],
                'repair_suggestions' => $this->repairSuggestions($payload, $concepts, $missingConceptIds, $invalidVocabularyIds, $nonStandardConceptIds, $domainMismatchConceptIds, $invalidLocalIds),
                'messages' => $blockingReasons,
                'accepted_downstream_actions' => $blocked
                    ? ['repair_concept_set_draft', 'verify_concept_set_draft']
                    : ['accept_concept_set_draft', 'materialize_concept_set'],
            ],
        ];
    }

    /**
     * @param  array<string, mixed>  $concepts
     * @return list<int>
     */
    private function conceptIdsFromNormalized(array $concepts): array
    {
        return collect($concepts)
            ->pluck('concept_id')
            ->filter(fn ($id) => is_numeric($id) && (int) $id > 0)
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values()
            ->all();
    }

    /**
     * @param  array<string, mixed>  $concepts
     * @return list<mixed>
     */
    private function invalidLocalConceptIdsFromNormalized(array $concepts): array
    {
        return collect($concepts)
            ->pluck('concept_id')
            ->reject(fn ($id) => is_numeric($id) && (int) $id > 0)
            ->values()
            ->all();
    }

    /**
     * @param  list<int>  $conceptIds
     * @return Collection<int, object>
     */
    private function vocabularyConcepts(array $conceptIds): Collection
    {
        if ($conceptIds === []) {
            return collect();
        }

        try {
            return DB::table('vocab.concept')
                ->whereIn('concept_id', $conceptIds)
                ->get(['concept_id', 'concept_name', 'domain_id', 'vocabulary_id', 'standard_concept', 'invalid_reason'])
                ->keyBy('concept_id');
        } catch (\Throwable) {
            return collect();
        }
    }

    /**
     * @param  Collection<int, object>  $concepts
     * @return list<int>
     */
    private function invalidVocabularyConceptIdsFromRows(Collection $concepts): array
    {
        return $concepts
            ->filter(fn (object $concept) => $concept->invalid_reason !== null && $concept->invalid_reason !== '')
            ->pluck('concept_id')
            ->map(fn ($id) => (int) $id)
            ->values()
            ->all();
    }

    /**
     * @param  Collection<int, object>  $concepts
     * @return list<int>
     */
    private function nonStandardConceptIds(Collection $concepts): array
    {
        return $concepts
            ->filter(fn (object $concept) => (string) $concept->standard_concept !== 'S')
            ->pluck('concept_id')
            ->map(fn ($id) => (int) $id)
            ->values()
            ->all();
    }

    /**
     * @param  Collection<int, object>  $concepts
     * @return list<int>
     */
    private function domainMismatchConceptIds(Collection $concepts, mixed $domain): array
    {
        if (! is_string($domain) || trim($domain) === '') {
            return [];
        }

        $expected = mb_strtolower(trim($domain));

        return $concepts
            ->filter(fn (object $concept) => $concept->domain_id !== null && mb_strtolower((string) $concept->domain_id) !== $expected)
            ->pluck('concept_id')
            ->map(fn ($id) => (int) $id)
            ->values()
            ->all();
    }

    /**
     * @param  list<array<string, mixed>>  $concepts
     * @param  Collection<int, object>  $vocabularyConcepts
     * @return list<array<string, mixed>>
     */
    private function enrichedConcepts(array $concepts, Collection $vocabularyConcepts): array
    {
        return collect($concepts)
            ->map(function (array $item) use ($vocabularyConcepts): array {
                $concept = is_numeric($item['concept_id'] ?? null)
                    ? $vocabularyConcepts->get((int) $item['concept_id'])
                    : null;

                return array_merge($item, [
                    'concept' => $concept ? [
                        'concept_id' => (int) $concept->concept_id,
                        'concept_name' => $concept->concept_name,
                        'domain_id' => $concept->domain_id,
                        'vocabulary_id' => $concept->vocabulary_id,
                        'standard_concept' => $concept->standard_concept,
                        'invalid_reason' => $concept->invalid_reason,
                    ] : null,
                ]);
            })
            ->values()
            ->all();
    }

    /**
     * @param  list<int>  $conceptIds
     * @param  list<mixed>  $invalidLocalIds
     * @param  list<int>  $missingConceptIds
     * @param  list<int>  $invalidVocabularyIds
     * @param  list<int>  $nonStandardConceptIds
     * @param  list<int>  $domainMismatchConceptIds
     * @return list<string>
     */
    private function blockingReasons(array $conceptIds, array $invalidLocalIds, array $missingConceptIds, array $invalidVocabularyIds, array $nonStandardConceptIds, array $domainMismatchConceptIds, mixed $domain): array
    {
        $messages = [];
        if ($conceptIds === []) {
            $messages[] = 'Add at least one verified OMOP standard concept before acceptance.';
        }
        if ($invalidLocalIds !== []) {
            $messages[] = 'Remove concept entries without positive integer OMOP concept IDs.';
        }
        if ($missingConceptIds !== []) {
            $messages[] = 'Remove or replace concept IDs missing from vocab.concept: '.implode(', ', $missingConceptIds).'.';
        }
        if ($invalidVocabularyIds !== []) {
            $messages[] = 'Remove or replace deprecated/invalid OMOP concept IDs: '.implode(', ', $invalidVocabularyIds).'.';
        }
        if ($nonStandardConceptIds !== []) {
            $messages[] = 'Replace non-standard OMOP concept IDs with standard concepts: '.implode(', ', $nonStandardConceptIds).'.';
        }
        if ($domainMismatchConceptIds !== []) {
            $messages[] = 'Review domain mismatches for expected domain '.(is_string($domain) ? $domain : 'the draft domain').': '.implode(', ', $domainMismatchConceptIds).'.';
        }

        return $messages;
    }

    /**
     * @param  array<string, mixed>  $payload
     * @param  list<array<string, mixed>>  $concepts
     * @param  list<int>  $missingConceptIds
     * @param  list<int>  $invalidVocabularyIds
     * @param  list<int>  $nonStandardConceptIds
     * @param  list<int>  $domainMismatchConceptIds
     * @param  list<mixed>  $invalidLocalIds
     * @return list<array<string, mixed>>
     */
    private function repairSuggestions(array $payload, array $concepts, array $missingConceptIds, array $invalidVocabularyIds, array $nonStandardConceptIds, array $domainMismatchConceptIds, array $invalidLocalIds): array
    {
        if ($concepts === []) {
            return [[
                'code' => 'search_required',
                'title' => 'Search and add OMOP concepts',
                'message' => 'This draft has no OMOP concepts yet. Use the protocol-derived search terms to add standard concepts, then verify again.',
                'search_terms' => $payload['search_terms'] ?? [],
            ]];
        }

        $blockedIds = collect($missingConceptIds)
            ->merge($invalidVocabularyIds)
            ->merge($nonStandardConceptIds)
            ->merge($domainMismatchConceptIds)
            ->unique()
            ->values()
            ->all();

        if ($blockedIds === [] && $invalidLocalIds === []) {
            return [];
        }

        $patchedConcepts = collect($concepts)
            ->filter(fn (array $item) => is_numeric($item['concept_id'] ?? null) && (int) $item['concept_id'] > 0)
            ->reject(fn (array $item) => in_array((int) $item['concept_id'], $blockedIds, true))
            ->values()
            ->all();

        return [[
            'code' => 'remove_unverified_concepts',
            'title' => 'Remove concepts that failed initial vocabulary checks',
            'message' => 'Abby can remove missing, deprecated, non-standard, or domain-mismatched concepts from this draft. Add replacements from OMOP vocabulary search before accepting.',
            'remove_concept_ids' => $blockedIds,
            'patch' => ['concepts' => $patchedConcepts],
        ]];
    }
}
