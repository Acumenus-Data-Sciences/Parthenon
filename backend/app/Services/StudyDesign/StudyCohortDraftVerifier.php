<?php

namespace App\Services\StudyDesign;

use App\Enums\StudyDesignAssetStatus;
use App\Enums\StudyDesignVerificationStatus;
use App\Models\App\CohortDefinition;
use App\Models\App\ConceptSet;
use App\Models\App\StudyDesignAsset;

class StudyCohortDraftVerifier
{
    /**
     * @var list<string>
     */
    private const VALID_ROLES = ['target', 'comparator', 'outcome', 'exclusion', 'subgroup', 'event'];

    /**
     * @return array{verification_status:string,verified_at:mixed,verification_json:array<string,mixed>}
     */
    public function verify(StudyDesignAsset $asset): array
    {
        $payload = is_array($asset->getAttribute('draft_payload_json')) ? $asset->getAttribute('draft_payload_json') : [];
        $expressionPayload = $payload['expression_json'] ?? null;
        $expression = is_array($expressionPayload) ? $expressionPayload : [];
        $canonical = $this->canonicalStatus($asset);
        $conceptSetStatus = $this->conceptSetStatus($asset, $payload);
        $expressionStatus = $this->expressionStatus($expression);
        $roleStatus = $this->roleStatus($asset, $payload);

        $ready = $canonical['ready'] || ($conceptSetStatus['ready'] && $expressionStatus['ready'] && $roleStatus['ready']);
        $checks = [
            'canonical_cohort_active' => $canonical['ready'],
            'has_verified_materialized_concept_set_assets' => $conceptSetStatus['verified_asset_count'] > 0,
            'has_existing_concept_sets' => $conceptSetStatus['existing_concept_set_count'] > 0 && $conceptSetStatus['missing_concept_set_ids'] === [],
            'has_expression_concept_sets' => $expressionStatus['has_expression_concept_sets'],
            'has_primary_criteria' => $expressionStatus['has_primary_criteria'],
            'primary_criteria_references_codesets' => $expressionStatus['primary_criteria_references_codesets'],
            'has_observation_window' => $expressionStatus['has_observation_window'],
            'has_primary_and_expression_limits' => $expressionStatus['has_primary_and_expression_limits'],
            'has_collapse_settings' => $expressionStatus['has_collapse_settings'],
            'role_can_link_to_study' => $roleStatus['ready'],
        ];
        $blockingReasons = $this->blockingReasons($canonical, $conceptSetStatus, $expressionStatus, $roleStatus);
        $status = $ready ? StudyDesignVerificationStatus::VERIFIED->value : StudyDesignVerificationStatus::BLOCKED->value;

        return [
            'verification_status' => $status,
            'verified_at' => $ready ? now() : null,
            'verification_json' => [
                'status' => $status,
                'checks' => $checks,
                'checklist' => $this->checklist($checks),
                'eligibility' => [
                    'can_accept' => $ready,
                    'can_materialize' => $ready,
                    'reason' => $ready
                        ? 'Cohort draft can be accepted and materialized after user review.'
                        : 'Cohort draft must pass deterministic cohort expression checks before acceptance or materialization.',
                ],
                'canonical' => $canonical,
                'concept_sets' => $conceptSetStatus,
                'expression' => $expressionStatus,
                'role_link' => $roleStatus,
                'blocking_reasons' => $blockingReasons,
                'warnings' => [],
                'repair_suggestions' => $this->repairSuggestions($payload, $conceptSetStatus, $expressionStatus, $roleStatus),
                'messages' => $blockingReasons,
                'accepted_downstream_actions' => $ready
                    ? ['accept_cohort_draft', 'materialize_cohort_definition', 'link_cohort_to_study_role']
                    : ['repair_cohort_draft', 'verify_cohort_draft'],
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
     * @return array{ready:bool,verified_asset_count:int,blocked_asset_count:int,existing_concept_set_count:int,missing_concept_set_ids:list<int>,concept_set_asset_ids:list<int>,concept_set_ids:list<int>}
     */
    private function conceptSetStatus(StudyDesignAsset $asset, array $payload): array
    {
        $assetIds = collect($payload['concept_set_asset_ids'] ?? $payload['source_asset_ids'] ?? [])
            ->filter(fn ($id) => is_numeric($id))
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values();

        $conceptSetIds = collect($payload['concept_set_ids'] ?? [])
            ->filter(fn ($id) => is_numeric($id))
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values();

        $relatedAssets = $assetIds->isEmpty()
            ? collect()
            : StudyDesignAsset::query()
                ->where('session_id', $asset->session_id)
                ->whereIn('id', $assetIds)
                ->get();

        $verifiedAssets = $relatedAssets->filter(fn (StudyDesignAsset $related): bool => $related->materialized_type === ConceptSet::class
            && $related->materialized_id !== null
            && $this->assetStatusValue($related) === StudyDesignAssetStatus::MATERIALIZED->value
            && $this->verificationValue($related) === StudyDesignVerificationStatus::VERIFIED->value);

        $existingConceptSetIds = $conceptSetIds->isEmpty()
            ? []
            : ConceptSet::query()
                ->whereIn('id', $conceptSetIds)
                ->pluck('id')
                ->map(fn ($id) => (int) $id)
                ->all();

        $missingConceptSetIds = array_values(array_diff($conceptSetIds->all(), $existingConceptSetIds));

        return [
            'ready' => $verifiedAssets->isNotEmpty() && $conceptSetIds->isNotEmpty() && $missingConceptSetIds === [],
            'verified_asset_count' => $verifiedAssets->count(),
            'blocked_asset_count' => $relatedAssets->filter(fn (StudyDesignAsset $related): bool => $this->verificationValue($related) === StudyDesignVerificationStatus::BLOCKED->value)->count(),
            'existing_concept_set_count' => count($existingConceptSetIds),
            'missing_concept_set_ids' => $missingConceptSetIds,
            'concept_set_asset_ids' => $assetIds->all(),
            'concept_set_ids' => $conceptSetIds->all(),
        ];
    }

    /**
     * @param  array<string, mixed>  $expression
     * @return array<string, mixed>
     */
    private function expressionStatus(array $expression): array
    {
        $conceptSets = array_values(array_filter((array) ($expression['ConceptSets'] ?? []), 'is_array'));
        $primaryCriteria = is_array($expression['PrimaryCriteria'] ?? null) ? $expression['PrimaryCriteria'] : [];
        $criteriaList = array_values(array_filter((array) ($primaryCriteria['CriteriaList'] ?? []), 'is_array'));
        $observationWindow = is_array($primaryCriteria['ObservationWindow'] ?? null) ? $primaryCriteria['ObservationWindow'] : [];
        $codesetIds = collect($conceptSets)
            ->pluck('id')
            ->filter(fn ($id) => is_numeric($id))
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values()
            ->all();
        $referencedCodesetIds = $this->referencedCodesetIds($criteriaList);
        $missingReferencedCodesets = array_values(array_diff($referencedCodesetIds, $codesetIds));
        $hasObservationWindow = is_numeric($observationWindow['PriorDays'] ?? null)
            && (int) $observationWindow['PriorDays'] >= 0
            && is_numeric($observationWindow['PostDays'] ?? null)
            && (int) $observationWindow['PostDays'] >= 0;
        $hasLimits = is_array($primaryCriteria['PrimaryCriteriaLimit'] ?? null)
            && is_array($expression['QualifiedLimit'] ?? null)
            && is_array($expression['ExpressionLimit'] ?? null);
        $hasCollapseSettings = is_array($expression['CollapseSettings'] ?? null)
            && ! empty($expression['CollapseSettings']['CollapseType']);

        return [
            'ready' => $conceptSets !== []
                && $criteriaList !== []
                && $referencedCodesetIds !== []
                && $missingReferencedCodesets === []
                && $hasObservationWindow
                && $hasLimits
                && $hasCollapseSettings,
            'has_expression_concept_sets' => $conceptSets !== [],
            'has_primary_criteria' => $criteriaList !== [],
            'primary_criteria_references_codesets' => $referencedCodesetIds !== [] && $missingReferencedCodesets === [],
            'has_observation_window' => $hasObservationWindow,
            'has_primary_and_expression_limits' => $hasLimits,
            'has_collapse_settings' => $hasCollapseSettings,
            'codeset_ids' => $codesetIds,
            'referenced_codeset_ids' => $referencedCodesetIds,
            'missing_referenced_codeset_ids' => $missingReferencedCodesets,
        ];
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return array{ready:bool,role:string,valid_roles:list<string>}
     */
    private function roleStatus(StudyDesignAsset $asset, array $payload): array
    {
        $role = $this->normalizeRole((string) ($payload['role'] ?? $asset->role ?? 'target'));

        return [
            'ready' => in_array($role, self::VALID_ROLES, true),
            'role' => $role,
            'valid_roles' => self::VALID_ROLES,
        ];
    }

    /**
     * @param  list<array<string, mixed>>  $criteriaList
     * @return list<int>
     */
    private function referencedCodesetIds(array $criteriaList): array
    {
        $ids = [];
        array_walk_recursive($criteriaList, function (mixed $value, mixed $key) use (&$ids): void {
            if ($key === 'CodesetId' && is_numeric($value)) {
                $ids[] = (int) $value;
            }
        });

        return collect($ids)->unique()->values()->all();
    }

    /**
     * @param  array<string, mixed>  $canonical
     * @param  array<string, mixed>  $conceptSetStatus
     * @param  array<string, mixed>  $expressionStatus
     * @param  array<string, mixed>  $roleStatus
     * @return list<string>
     */
    private function blockingReasons(array $canonical, array $conceptSetStatus, array $expressionStatus, array $roleStatus): array
    {
        if ($canonical['ready']) {
            return [];
        }

        $reasons = [];
        if ($conceptSetStatus['verified_asset_count'] === 0) {
            $reasons[] = 'Materialized, verified concept set drafts are required before Abby can compile a cohort draft.';
        }
        if ($conceptSetStatus['missing_concept_set_ids'] !== []) {
            $reasons[] = 'Referenced native concept sets are missing: '.implode(', ', $conceptSetStatus['missing_concept_set_ids']).'.';
        }
        if (! $expressionStatus['has_expression_concept_sets']) {
            $reasons[] = 'The cohort expression must include at least one Circe ConceptSets entry.';
        }
        if (! $expressionStatus['has_primary_criteria']) {
            $reasons[] = 'The cohort expression must include a non-empty PrimaryCriteria CriteriaList.';
        }
        if (! $expressionStatus['primary_criteria_references_codesets']) {
            $reasons[] = 'Primary criteria must reference a ConceptSets codeset ID.';
        }
        if (! $expressionStatus['has_observation_window']) {
            $reasons[] = 'Primary criteria must include numeric PriorDays and PostDays observation-window settings.';
        }
        if (! $expressionStatus['has_primary_and_expression_limits']) {
            $reasons[] = 'Primary, qualified, and expression limits must be present before native materialization.';
        }
        if (! $expressionStatus['has_collapse_settings']) {
            $reasons[] = 'Collapse settings must be present before native materialization.';
        }
        if (! $roleStatus['ready']) {
            $reasons[] = 'The cohort draft role must be linkable to a study role.';
        }

        return $reasons;
    }

    /**
     * @param  array<string, bool>  $checks
     * @return list<array{name:string,status:string,message:string}>
     */
    private function checklist(array $checks): array
    {
        return collect($checks)
            ->map(fn (bool $passed, string $name): array => [
                'name' => $name,
                'status' => $passed ? 'pass' : 'fail',
                'message' => $this->checkMessage($name, $passed),
            ])
            ->values()
            ->all();
    }

    private function checkMessage(string $name, bool $passed): string
    {
        $messages = [
            'canonical_cohort_active' => 'Active canonical cohort is available.',
            'has_verified_materialized_concept_set_assets' => 'Verified materialized concept set source is available.',
            'has_existing_concept_sets' => 'Referenced native concept sets exist.',
            'has_expression_concept_sets' => 'Circe ConceptSets are present.',
            'has_primary_criteria' => 'PrimaryCriteria CriteriaList is populated.',
            'primary_criteria_references_codesets' => 'Primary criteria reference a ConceptSets codeset.',
            'has_observation_window' => 'Observation window is explicit.',
            'has_primary_and_expression_limits' => 'Primary, qualified, and expression limits are present.',
            'has_collapse_settings' => 'Collapse settings are present.',
            'role_can_link_to_study' => 'Cohort role can be linked to the study.',
        ];

        return ($passed ? 'Pass: ' : 'Fix: ').($messages[$name] ?? $name);
    }

    /**
     * @param  array<string, mixed>  $payload
     * @param  array<string, mixed>  $conceptSetStatus
     * @param  array<string, mixed>  $expressionStatus
     * @param  array<string, mixed>  $roleStatus
     * @return list<array<string, mixed>>
     */
    private function repairSuggestions(array $payload, array $conceptSetStatus, array $expressionStatus, array $roleStatus): array
    {
        $suggestions = [];

        if ($conceptSetStatus['verified_asset_count'] === 0) {
            $suggestions[] = [
                'code' => 'materialized_concept_set_required',
                'title' => 'Materialize a verified concept set first',
                'message' => 'Abby needs at least one verified concept set draft materialized as a native concept set before compiling this cohort.',
            ];
        }

        $expressionPatch = $this->repairedExpression($payload);
        if ($expressionPatch !== null && (! $expressionStatus['has_primary_criteria'] || ! $expressionStatus['primary_criteria_references_codesets'])) {
            $suggestions[] = [
                'code' => 'add_primary_criteria',
                'title' => 'Add first-event primary criteria',
                'message' => 'Abby can add a conservative first qualifying event criterion that references the cohort concept set.',
                'patch' => [
                    'expression_json' => $expressionPatch,
                    'entry_event' => [
                        'description' => 'First qualifying event from the materialized concept set.',
                        'codeset_id' => 0,
                    ],
                ],
            ];
        }

        if ($expressionPatch !== null && ! $expressionStatus['has_observation_window']) {
            $suggestions[] = [
                'code' => 'add_observation_window',
                'title' => 'Add observation window',
                'message' => 'Abby can require 365 days of prior observation and zero days after the index event for the primary criterion.',
                'patch' => [
                    'expression_json' => $expressionPatch,
                    'observation_window' => [
                        'prior_days' => 365,
                        'post_days' => 0,
                    ],
                ],
            ];
        }

        if ($expressionPatch !== null && (! $expressionStatus['has_primary_and_expression_limits'] || ! $expressionStatus['has_collapse_settings'])) {
            $suggestions[] = [
                'code' => 'add_limits_and_collapse_settings',
                'title' => 'Add cohort limits and collapse settings',
                'message' => 'Abby can add first-event limits and ERA collapse settings so the native cohort editor can open the draft.',
                'patch' => [
                    'expression_json' => $expressionPatch,
                    'collapse_settings' => [
                        'collapse_type' => 'ERA',
                        'era_pad' => 0,
                    ],
                ],
            ];
        }

        if (! $roleStatus['ready']) {
            $suggestions[] = [
                'code' => 'normalize_role_link',
                'title' => 'Normalize study role',
                'message' => 'Abby can assign this cohort to the target role so it can be linked after materialization.',
                'patch' => [
                    'role' => 'target',
                    'role_link' => [
                        'role' => 'target',
                        'can_link_after_materialization' => true,
                    ],
                ],
            ];
        }

        return $suggestions;
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return array<string, mixed>|null
     */
    private function repairedExpression(array $payload): ?array
    {
        $expression = is_array($payload['expression_json'] ?? null) ? $payload['expression_json'] : [];
        $conceptSets = array_values(array_filter((array) ($expression['ConceptSets'] ?? []), 'is_array'));

        if ($conceptSets === []) {
            return null;
        }

        $codesetId = is_numeric($conceptSets[0]['id'] ?? null) ? (int) $conceptSets[0]['id'] : 0;
        $domainKey = $this->domainKeyFromConceptSet($conceptSets[0]);

        return [
            ...$expression,
            'ConceptSets' => $conceptSets,
            'PrimaryCriteria' => [
                ...((array) ($expression['PrimaryCriteria'] ?? [])),
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
            'InclusionRules' => array_values((array) ($expression['InclusionRules'] ?? [])),
            'CensoringCriteria' => array_values((array) ($expression['CensoringCriteria'] ?? [])),
            'CollapseSettings' => ['CollapseType' => 'ERA', 'EraPad' => 0],
        ];
    }

    /**
     * @param  array<string, mixed>  $conceptSet
     */
    private function domainKeyFromConceptSet(array $conceptSet): string
    {
        $items = (array) ($conceptSet['expression']['items'] ?? []);
        $concept = is_array($items[0]['concept'] ?? null) ? $items[0]['concept'] : [];
        $domain = $concept['DOMAIN_ID'] ?? null;

        return match ($domain) {
            'Drug' => 'DrugExposure',
            'Procedure' => 'ProcedureOccurrence',
            'Measurement' => 'Measurement',
            'Observation' => 'Observation',
            'Visit' => 'VisitOccurrence',
            default => 'ConditionOccurrence',
        };
    }

    private function normalizeRole(string $role): string
    {
        return match (trim(strtolower($role))) {
            'population', 'exposure', 'intervention' => 'target',
            default => trim(strtolower($role)),
        };
    }

    private function verificationValue(StudyDesignAsset $asset): string
    {
        $status = $asset->verification_status;

        return $status instanceof StudyDesignVerificationStatus ? $status->value : (string) $status;
    }

    private function assetStatusValue(StudyDesignAsset $asset): string
    {
        $status = $asset->status;

        return $status instanceof StudyDesignAssetStatus ? $status->value : (string) $status;
    }
}
