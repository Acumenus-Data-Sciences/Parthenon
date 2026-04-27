<?php

namespace App\Services\StudyDesign;

use App\Enums\StudyDesignAssetStatus;
use App\Models\App\ConceptSet;
use App\Models\App\ConceptSetItem;
use App\Models\App\StudyDesignAsset;
use App\Models\App\StudyDesignSession;
use App\Models\App\StudyDesignVersion;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class StudyCohortDraftService
{
    public function __construct(
        private readonly StudyCohortDraftVerifier $verifier,
    ) {}

    /**
     * @param  array<string, mixed>  $options
     * @return Collection<int, StudyDesignAsset>
     */
    public function draft(StudyDesignSession $session, StudyDesignVersion $version, array $options = []): Collection
    {
        $requestedRole = isset($options['role']) && is_string($options['role'])
            ? $this->normalizeRole($options['role'])
            : null;

        $conceptSetDrafts = $session->assets()
            ->where('version_id', $version->id)
            ->where('asset_type', 'concept_set_draft')
            ->where('status', StudyDesignAssetStatus::MATERIALIZED->value)
            ->where('materialized_type', ConceptSet::class)
            ->get();

        $candidates = $conceptSetDrafts
            ->map(fn (StudyDesignAsset $asset) => $this->candidateFromConceptSetDraft($asset, $requestedRole))
            ->filter()
            ->values();

        if ($candidates->isEmpty()) {
            throw ValidationException::withMessages([
                'cohorts' => 'Materialized, verified concept set drafts are required before Abby can compile cohort drafts.',
            ]);
        }

        return DB::transaction(function () use ($session, $version, $candidates): Collection {
            $session->assets()
                ->where('version_id', $version->id)
                ->where('asset_type', 'cohort_draft')
                ->where('status', StudyDesignAssetStatus::NEEDS_REVIEW->value)
                ->delete();

            return $candidates
                ->map(function (array $candidate) use ($session, $version): StudyDesignAsset {
                    $asset = StudyDesignAsset::create([
                        'session_id' => $session->id,
                        'version_id' => $version->id,
                        'asset_type' => 'cohort_draft',
                        'role' => $candidate['role'],
                        'status' => StudyDesignAssetStatus::NEEDS_REVIEW->value,
                        'draft_payload_json' => $candidate,
                        'provenance_json' => [
                            'source' => 'study_designer_concept_sets',
                            'source_asset_ids' => $candidate['source_asset_ids'] ?? [],
                        ],
                    ]);

                    $asset->update($this->verifier->verify($asset));

                    return $asset->fresh() ?? $asset;
                })
                ->values();
        });
    }

    /**
     * @return array<string, mixed>|null
     */
    private function candidateFromConceptSetDraft(StudyDesignAsset $asset, ?string $requestedRole): ?array
    {
        if ($asset->materialized_id === null) {
            return null;
        }

        $conceptSet = ConceptSet::with('items')->find($asset->materialized_id);
        if (! $conceptSet instanceof ConceptSet || $conceptSet->items->isEmpty()) {
            return null;
        }

        $role = $this->normalizeRole((string) ($asset->role ?? $requestedRole ?? 'target'));
        $codesetId = 0;
        $conceptSetExpression = $this->conceptSetExpression($conceptSet, $codesetId);
        $domainKey = $this->domainKey($role, $conceptSet);

        return [
            'title' => $this->titleForRole($role, $conceptSet->name),
            'role' => $role,
            'logic_description' => 'Entry event cohort generated from a verified Study Designer concept set draft.',
            'concept_set_ids' => [$conceptSet->id],
            'concept_set_asset_ids' => [$asset->id],
            'source_asset_ids' => [$asset->id],
            'entry_event' => [
                'description' => 'First qualifying event from the materialized concept set.',
                'domain_criteria' => $domainKey,
                'codeset_id' => $codesetId,
            ],
            'observation_window' => [
                'prior_days' => 365,
                'post_days' => 0,
            ],
            'inclusion_rules' => [],
            'censoring_criteria' => [],
            'exit_strategy' => 'End at the earliest of observation period end, death, study end, or downstream censoring rule.',
            'collapse_settings' => [
                'collapse_type' => 'ERA',
                'era_pad' => 0,
            ],
            'role_link' => [
                'role' => $role,
                'can_link_after_materialization' => true,
            ],
            'expression_json' => [
                'ConceptSets' => [$conceptSetExpression],
                'PrimaryCriteria' => [
                    'CriteriaList' => [[
                        $domainKey => [
                            'First' => true,
                            'CodesetId' => $codesetId,
                        ],
                    ]],
                    'ObservationWindow' => [
                        'PriorDays' => 365,
                        'PostDays' => 0,
                    ],
                    'PrimaryCriteriaLimit' => [
                        'Type' => 'First',
                    ],
                ],
                'QualifiedLimit' => ['Type' => 'First'],
                'ExpressionLimit' => ['Type' => 'First'],
                'InclusionRules' => [],
                'CensoringCriteria' => [],
                'CollapseSettings' => ['CollapseType' => 'ERA', 'EraPad' => 0],
            ],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function conceptSetExpression(ConceptSet $conceptSet, int $codesetId): array
    {
        $conceptIds = $conceptSet->items->pluck('concept_id')->unique()->values()->all();
        $vocabularyConcepts = DB::table('vocab.concept')
            ->whereIn('concept_id', $conceptIds)
            ->get(['concept_id', 'concept_name', 'domain_id', 'vocabulary_id', 'concept_class_id', 'standard_concept', 'concept_code', 'invalid_reason'])
            ->keyBy('concept_id');

        return [
            'id' => $codesetId,
            'name' => $conceptSet->name,
            'expression' => [
                'items' => $conceptSet->items
                    ->map(function (ConceptSetItem $item) use ($vocabularyConcepts): array {
                        $concept = $vocabularyConcepts->get($item->concept_id);

                        return [
                            'concept' => [
                                'CONCEPT_ID' => $item->concept_id,
                                'CONCEPT_NAME' => $concept?->concept_name ?? '',
                                'DOMAIN_ID' => $concept?->domain_id ?? '',
                                'VOCABULARY_ID' => $concept?->vocabulary_id ?? '',
                                'CONCEPT_CLASS_ID' => $concept?->concept_class_id ?? '',
                                'STANDARD_CONCEPT' => $concept?->standard_concept,
                                'CONCEPT_CODE' => $concept?->concept_code ?? '',
                                'INVALID_REASON' => $concept?->invalid_reason,
                            ],
                            'isExcluded' => $item->is_excluded,
                            'includeDescendants' => $item->include_descendants,
                            'includeMapped' => $item->include_mapped,
                        ];
                    })
                    ->values()
                    ->all(),
            ],
        ];
    }

    private function domainKey(string $role, ConceptSet $conceptSet): string
    {
        $firstConceptId = $conceptSet->items->first()?->concept_id;
        $domain = $firstConceptId ? DB::table('vocab.concept')->where('concept_id', $firstConceptId)->value('domain_id') : null;

        return match ($domain) {
            'Drug' => 'DrugExposure',
            'Procedure' => 'ProcedureOccurrence',
            'Measurement' => 'Measurement',
            'Observation' => 'Observation',
            'Visit' => 'VisitOccurrence',
            default => 'ConditionOccurrence',
        };
    }

    private function titleForRole(string $role, string $conceptSetName): string
    {
        return str($role)->headline().': '.$conceptSetName;
    }

    private function normalizeRole(string $role): string
    {
        return match (trim(strtolower($role))) {
            'population', 'exposure', 'intervention' => 'target',
            'comparator', 'outcome', 'exclusion', 'subgroup', 'event' => trim(strtolower($role)),
            default => 'target',
        };
    }
}
