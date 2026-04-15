<?php

namespace App\Services\StudyDesign;

use App\Enums\StudyDesignAssetStatus;
use App\Models\App\CohortDefinition;
use App\Models\App\ConceptSet;
use App\Models\App\ConceptSetItem;
use App\Models\App\PhenotypeLibraryEntry;
use App\Models\App\StudyDesignAsset;
use App\Models\App\StudyDesignSession;
use App\Models\App\StudyDesignVersion;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class StudyConceptSetDraftService
{
    public function __construct(
        private readonly StudyConceptSetDraftVerifier $verifier,
    ) {}

    /**
     * @param  array<string, mixed>  $options
     * @return Collection<int, StudyDesignAsset>
     */
    public function draft(StudyDesignSession $session, StudyDesignVersion $version, array $options = []): Collection
    {
        $role = isset($options['role']) ? (string) $options['role'] : null;
        $assetIds = collect($options['asset_ids'] ?? [])
            ->filter(fn (mixed $id) => is_numeric($id))
            ->map(fn (mixed $id) => (int) $id)
            ->values()
            ->all();

        $manualDrafts = collect($options['drafts'] ?? [])
            ->filter(fn (mixed $draft) => is_array($draft))
            ->map(fn (array $draft) => $this->manualCandidate($draft, $role))
            ->filter()
            ->values();

        $acceptedAssets = $session->assets()
            ->where('version_id', $version->id)
            ->where('status', StudyDesignAssetStatus::ACCEPTED->value)
            ->whereIn('asset_type', ['phenotype_recommendation', 'local_cohort', 'local_concept_set'])
            ->when($assetIds !== [], fn ($query) => $query->whereIn('id', $assetIds))
            ->get();

        $candidates = $acceptedAssets
            ->flatMap(fn (StudyDesignAsset $asset) => $this->candidatesFromAsset($asset, $role))
            ->merge($manualDrafts)
            ->unique(fn (array $candidate) => ($candidate['role'] ?? '').':'.($candidate['title'] ?? '').':'.json_encode(collect($candidate['concepts'] ?? [])->pluck('concept_id')->all()))
            ->values();

        return DB::transaction(function () use ($session, $version, $candidates): Collection {
            $session->assets()
                ->where('version_id', $version->id)
                ->where('asset_type', 'concept_set_draft')
                ->where('status', StudyDesignAssetStatus::NEEDS_REVIEW->value)
                ->delete();

            return $candidates
                ->map(function (array $candidate) use ($session, $version): StudyDesignAsset {
                    $asset = StudyDesignAsset::create([
                        'session_id' => $session->id,
                        'version_id' => $version->id,
                        'asset_type' => 'concept_set_draft',
                        'role' => $candidate['role'] ?? null,
                        'status' => StudyDesignAssetStatus::NEEDS_REVIEW->value,
                        'draft_payload_json' => [
                            'title' => $candidate['title'],
                            'role' => $candidate['role'] ?? null,
                            'domain' => $candidate['domain'] ?? null,
                            'clinical_rationale' => $candidate['clinical_rationale'] ?? null,
                            'search_terms' => $candidate['search_terms'] ?? [],
                            'concepts' => $candidate['concepts'],
                            'source_concept_set_references' => $candidate['source_concept_set_references'] ?? [],
                        ],
                        'provenance_json' => $candidate['provenance'] ?? ['source' => 'study_designer'],
                    ]);

                    return $this->verifier->verify($asset);
                })
                ->values();
        });
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function candidatesFromAsset(StudyDesignAsset $asset, ?string $role): array
    {
        return match ($asset->asset_type) {
            'local_concept_set' => $this->localConceptSetCandidate($asset, $role),
            'local_cohort' => $this->cohortExpressionCandidates($asset, $role),
            'phenotype_recommendation' => $this->phenotypeCandidates($asset, $role),
            default => [],
        };
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function localConceptSetCandidate(StudyDesignAsset $asset, ?string $role): array
    {
        if ($asset->canonical_type !== ConceptSet::class || $asset->canonical_id === null) {
            return [];
        }

        $conceptSet = ConceptSet::with('items')->find($asset->canonical_id);
        if (! $conceptSet instanceof ConceptSet) {
            return [];
        }

        $items = $conceptSet->items
            ->map(fn (ConceptSetItem $item) => $this->conceptItem($item->concept_id, $item->is_excluded, $item->include_descendants, $item->include_mapped))
            ->values()
            ->all();

        if ($items === []) {
            return [];
        }

        return [[
            'title' => $conceptSet->name,
            'role' => $role ?? $asset->role,
            'clinical_rationale' => $asset->draft_payload_json['rationale'] ?? $conceptSet->description,
            'search_terms' => array_values(array_filter([(string) ($asset->provenance_json['matched_term'] ?? '')])),
            'concepts' => $items,
            'source_concept_set_references' => [['type' => ConceptSet::class, 'id' => $conceptSet->id, 'name' => $conceptSet->name]],
            'provenance' => [
                'source' => 'local_concept_set',
                'source_asset_id' => $asset->id,
                'canonical_type' => ConceptSet::class,
                'canonical_id' => $conceptSet->id,
            ],
        ]];
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function cohortExpressionCandidates(StudyDesignAsset $asset, ?string $role): array
    {
        if ($asset->canonical_type !== CohortDefinition::class || $asset->canonical_id === null) {
            return [];
        }

        $cohort = CohortDefinition::find($asset->canonical_id);
        if (! $cohort instanceof CohortDefinition) {
            return [];
        }

        return $this->conceptSetCandidatesFromExpression(
            $cohort->expression_json ?? [],
            $role ?? $asset->role,
            'local_cohort_expression',
            $asset,
            $cohort->name,
        );
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function phenotypeCandidates(StudyDesignAsset $asset, ?string $role): array
    {
        $payload = $asset->draft_payload_json ?? [];
        $conceptIds = $this->extractConceptIds($payload);

        if ($conceptIds !== []) {
            return [[
                'title' => (string) ($payload['title'] ?? 'Study Designer concept set draft'),
                'role' => $role ?? $asset->role,
                'domain' => $payload['domain'] ?? null,
                'clinical_rationale' => $payload['rationale'] ?? $payload['logic_description'] ?? null,
                'search_terms' => array_values(array_filter([(string) ($asset->provenance_json['matched_term'] ?? '')])),
                'concepts' => collect($conceptIds)->map(fn (int $id) => $this->conceptItem($id))->all(),
                'source_concept_set_references' => [],
                'provenance' => [
                    'source' => 'phenotype_recommendation_payload',
                    'source_asset_id' => $asset->id,
                    'canonical_type' => $asset->canonical_type,
                    'canonical_id' => $asset->canonical_id,
                ],
            ]];
        }

        if ($asset->canonical_type !== PhenotypeLibraryEntry::class || $asset->canonical_id === null) {
            return [];
        }

        $entry = PhenotypeLibraryEntry::find($asset->canonical_id);
        if (! $entry instanceof PhenotypeLibraryEntry) {
            return [];
        }

        return $this->conceptSetCandidatesFromExpression(
            $entry->expression_json ?? [],
            $role ?? $asset->role,
            'phenotype_library_expression',
            $asset,
            $entry->cohort_name,
        );
    }

    /**
     * @param  array<string, mixed>  $expression
     * @return list<array<string, mixed>>
     */
    private function conceptSetCandidatesFromExpression(array $expression, ?string $role, string $source, StudyDesignAsset $asset, string $fallbackTitle): array
    {
        return collect($expression['ConceptSets'] ?? [])
            ->filter(fn (mixed $conceptSet) => is_array($conceptSet))
            ->map(function (array $conceptSet) use ($role, $source, $asset, $fallbackTitle): ?array {
                $items = collect(data_get($conceptSet, 'expression.items', []))
                    ->filter(fn (mixed $item) => is_array($item))
                    ->map(fn (array $item) => $this->conceptItemFromExpression($item))
                    ->filter()
                    ->values()
                    ->all();

                if ($items === []) {
                    return null;
                }

                return [
                    'title' => (string) ($conceptSet['name'] ?? $fallbackTitle),
                    'role' => $role,
                    'clinical_rationale' => $asset->draft_payload_json['rationale'] ?? null,
                    'search_terms' => array_values(array_filter([(string) ($asset->provenance_json['matched_term'] ?? '')])),
                    'concepts' => $items,
                    'source_concept_set_references' => [[
                        'type' => $asset->canonical_type,
                        'id' => $asset->canonical_id,
                        'name' => $conceptSet['name'] ?? $fallbackTitle,
                    ]],
                    'provenance' => [
                        'source' => $source,
                        'source_asset_id' => $asset->id,
                        'canonical_type' => $asset->canonical_type,
                        'canonical_id' => $asset->canonical_id,
                    ],
                ];
            })
            ->filter()
            ->values()
            ->all();
    }

    /**
     * @param  array<string, mixed>  $draft
     * @return array<string, mixed>|null
     */
    private function manualCandidate(array $draft, ?string $fallbackRole): ?array
    {
        $items = collect($draft['concepts'] ?? [])
            ->filter(fn (mixed $item) => is_array($item))
            ->map(fn (array $item) => $this->conceptItem(
                (int) ($item['concept_id'] ?? 0),
                (bool) ($item['is_excluded'] ?? false),
                (bool) ($item['include_descendants'] ?? true),
                (bool) ($item['include_mapped'] ?? false),
                $item['rationale'] ?? null,
            ))
            ->values()
            ->all();

        if ($items === []) {
            return null;
        }

        return [
            'title' => (string) $draft['title'],
            'role' => $draft['role'] ?? $fallbackRole,
            'domain' => $draft['domain'] ?? null,
            'clinical_rationale' => $draft['clinical_rationale'] ?? null,
            'search_terms' => $draft['search_terms'] ?? [],
            'concepts' => $items,
            'source_concept_set_references' => [],
            'provenance' => ['source' => 'manual_study_designer_draft'],
        ];
    }

    /**
     * @param  array<string, mixed>  $item
     * @return array<string, mixed>|null
     */
    private function conceptItemFromExpression(array $item): ?array
    {
        $concept = (array) ($item['concept'] ?? []);
        $conceptId = $concept['CONCEPT_ID'] ?? $concept['concept_id'] ?? $item['concept_id'] ?? null;

        if (! is_numeric($conceptId)) {
            return null;
        }

        return $this->conceptItem(
            (int) $conceptId,
            (bool) ($item['isExcluded'] ?? $item['is_excluded'] ?? false),
            (bool) ($item['includeDescendants'] ?? $item['include_descendants'] ?? true),
            (bool) ($item['includeMapped'] ?? $item['include_mapped'] ?? false),
            $item['rationale'] ?? null,
        );
    }

    /**
     * @return array<string, mixed>
     */
    private function conceptItem(int $conceptId, bool $isExcluded = false, bool $includeDescendants = true, bool $includeMapped = false, mixed $rationale = null): array
    {
        return [
            'concept_id' => $conceptId,
            'is_excluded' => $isExcluded,
            'include_descendants' => $includeDescendants,
            'include_mapped' => $includeMapped,
            'rationale' => is_string($rationale) ? $rationale : null,
        ];
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return list<int>
     */
    private function extractConceptIds(array $payload): array
    {
        $ids = [];
        $walk = function (mixed $value, ?string $key = null) use (&$walk, &$ids): void {
            $normalizedKey = $key ? strtolower((string) preg_replace('/[^a-zA-Z0-9]/', '', $key)) : '';

            if (in_array($normalizedKey, ['conceptid', 'conceptids'], true)) {
                foreach ((array) $value as $candidate) {
                    if (is_numeric($candidate)) {
                        $ids[] = (int) $candidate;
                    }
                }
            }

            if (is_array($value)) {
                foreach ($value as $childKey => $childValue) {
                    $walk($childValue, is_string($childKey) ? $childKey : null);
                }
            }
        };

        $walk($payload);

        return collect($ids)
            ->filter(fn (int $id) => $id > 0)
            ->unique()
            ->values()
            ->all();
    }
}
