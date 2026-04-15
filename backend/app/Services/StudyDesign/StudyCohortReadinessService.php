<?php

namespace App\Services\StudyDesign;

use App\Enums\StudyDesignAssetStatus;
use App\Enums\StudyDesignVerificationStatus;
use App\Models\App\Study;
use App\Models\App\StudyCohort;
use App\Models\App\StudyDesignAsset;
use App\Models\App\StudyDesignSession;
use App\Models\App\StudyDesignVersion;
use Illuminate\Support\Collection;

class StudyCohortReadinessService
{
    /**
     * @return array<string, mixed>
     */
    public function summarize(Study $study, StudyDesignSession $session, StudyDesignVersion $version): array
    {
        $spec = $version->normalized_spec_json ?? $version->spec_json ?? [];
        $requiredRoles = $this->requiredRoles($study, is_array($spec) ? $spec : []);

        $studyCohorts = $study->cohorts()
            ->with('cohortDefinition')
            ->orderBy('sort_order')
            ->get()
            ->map(function (StudyCohort $cohort): StudyCohort {
                $cohort->role = $this->normalizeRole($cohort->role);

                return $cohort;
            });

        $cohortDrafts = $session->assets()
            ->where('version_id', $version->id)
            ->where('asset_type', 'cohort_draft')
            ->orderByDesc('created_at')
            ->get();

        $blockers = [];
        $warnings = [];
        $presentRoles = $studyCohorts
            ->groupBy('role')
            ->map(fn (Collection $cohorts): int => $cohorts->count())
            ->all();

        foreach ($requiredRoles as $role) {
            if (($presentRoles[$role] ?? 0) === 0) {
                $blockers[] = $this->issue(
                    'missing_'.$role.'_cohort',
                    "Add a {$role} cohort before running feasibility or analysis.",
                    ['role' => $role],
                );
            }
        }

        foreach (['target', 'comparator'] as $singleRole) {
            if (($presentRoles[$singleRole] ?? 0) > 1) {
                $warnings[] = $this->issue(
                    'multiple_'.$singleRole.'_cohorts',
                    "Multiple {$singleRole} cohorts are linked. Confirm which one should drive the primary estimand.",
                    ['role' => $singleRole, 'count' => $presentRoles[$singleRole]],
                );
            }
        }

        $deprecatedIds = $studyCohorts
            ->filter(fn (StudyCohort $cohort): bool => $cohort->cohortDefinition?->isDeprecated() === true)
            ->pluck('cohort_definition_id')
            ->values()
            ->all();
        if ($deprecatedIds !== []) {
            $blockers[] = $this->issue(
                'deprecated_cohort_definitions',
                'Replace deprecated cohort definitions before running feasibility or analysis.',
                ['cohort_definition_ids' => $deprecatedIds],
            );
        }

        foreach ($studyCohorts as $cohort) {
            if (! is_array($cohort->concept_set_ids) || $cohort->concept_set_ids === []) {
                $warnings[] = $this->issue(
                    'missing_concept_set_traceability',
                    'A linked cohort is missing concept set traceability.',
                    ['study_cohort_id' => $cohort->id, 'role' => $cohort->role],
                );
            }
        }

        $this->addRoleConflictIssues($studyCohorts, $blockers, $warnings);
        $this->addDraftIssues($cohortDrafts, $warnings);

        return [
            'status' => $blockers === [] ? 'ready' : 'blocked',
            'ready_for_feasibility' => $blockers === [],
            'required_roles' => $requiredRoles,
            'present_roles' => $presentRoles,
            'linked_cohorts' => $studyCohorts
                ->map(fn (StudyCohort $cohort): array => [
                    'id' => $cohort->id,
                    'role' => $cohort->role,
                    'label' => $cohort->label,
                    'cohort_definition_id' => $cohort->cohort_definition_id,
                    'cohort_definition_name' => $cohort->cohortDefinition?->name,
                    'concept_set_ids' => $cohort->concept_set_ids ?? [],
                ])
                ->values()
                ->all(),
            'drafts' => [
                'total' => $cohortDrafts->count(),
                'verified' => $cohortDrafts->where('verification_status', StudyDesignVerificationStatus::VERIFIED->value)->count(),
                'materialized' => $cohortDrafts->where('status', StudyDesignAssetStatus::MATERIALIZED->value)->count(),
                'linked' => $cohortDrafts
                    ->filter(fn (StudyDesignAsset $asset): bool => is_numeric(data_get($asset->provenance_json, 'study_cohort_id')))
                    ->count(),
                'unlinked_materialized' => $cohortDrafts
                    ->filter(fn (StudyDesignAsset $asset): bool => $asset->status === StudyDesignAssetStatus::MATERIALIZED->value
                        && ! is_numeric(data_get($asset->provenance_json, 'study_cohort_id')))
                    ->count(),
            ],
            'blockers' => $blockers,
            'warnings' => $warnings,
            'policy' => 'A study is ready for feasibility when required OHDSI cohort roles are linked to native, non-deprecated cohort definitions.',
        ];
    }

    /**
     * @param  array<string, mixed>  $spec
     * @return list<string>
     */
    private function requiredRoles(Study $study, array $spec): array
    {
        $studyType = (string) (data_get($spec, 'study.study_type') ?: $study->study_type);
        $roles = ['target'];
        $comparatorSummary = trim((string) data_get($spec, 'pico.comparator.summary', ''));
        $outcomes = (array) data_get($spec, 'pico.outcomes', []);

        if ($comparatorSummary !== '' || in_array($studyType, ['comparative_effectiveness', 'comparative_safety'], true)) {
            $roles[] = 'comparator';
        }

        if ($outcomes !== [] || in_array($studyType, ['comparative_effectiveness', 'comparative_safety', 'population_level_estimation'], true)) {
            $roles[] = 'outcome';
        }

        return array_values(array_unique($roles));
    }

    /**
     * @param  Collection<int, StudyCohort>  $studyCohorts
     * @param  list<array<string, mixed>>  $blockers
     * @param  list<array<string, mixed>>  $warnings
     */
    private function addRoleConflictIssues(Collection $studyCohorts, array &$blockers, array &$warnings): void
    {
        $byRole = $studyCohorts->groupBy('role');
        $targetCohortIds = $byRole->get('target', collect())->pluck('cohort_definition_id')->all();
        $comparatorCohortIds = $byRole->get('comparator', collect())->pluck('cohort_definition_id')->all();
        $outcomeCohortIds = $byRole->get('outcome', collect())->pluck('cohort_definition_id')->all();

        $sameTargetComparator = array_values(array_intersect($targetCohortIds, $comparatorCohortIds));
        if ($sameTargetComparator !== []) {
            $blockers[] = $this->issue(
                'target_comparator_same_cohort',
                'Target and comparator roles cannot use the same cohort definition.',
                ['cohort_definition_ids' => $sameTargetComparator],
            );
        }

        $sameTargetOutcome = array_values(array_intersect($targetCohortIds, $outcomeCohortIds));
        if ($sameTargetOutcome !== []) {
            $warnings[] = $this->issue(
                'target_outcome_same_cohort',
                'Target and outcome roles use the same cohort definition. Confirm recurrence and index-date semantics.',
                ['cohort_definition_ids' => $sameTargetOutcome],
            );
        }

        $targetConceptSetIds = $this->conceptSetIdsForRole($byRole, 'target');
        $comparatorConceptSetIds = $this->conceptSetIdsForRole($byRole, 'comparator');
        $outcomeConceptSetIds = $this->conceptSetIdsForRole($byRole, 'outcome');

        $targetComparatorOverlap = array_values(array_intersect($targetConceptSetIds, $comparatorConceptSetIds));
        if ($targetComparatorOverlap !== []) {
            $warnings[] = $this->issue(
                'target_comparator_concept_overlap',
                'Target and comparator cohorts share concept sets. Confirm this is intentional before estimation.',
                ['concept_set_ids' => $targetComparatorOverlap],
            );
        }

        $targetOutcomeOverlap = array_values(array_intersect($targetConceptSetIds, $outcomeConceptSetIds));
        if ($targetOutcomeOverlap !== []) {
            $warnings[] = $this->issue(
                'target_outcome_concept_overlap',
                'Target and outcome cohorts share concept sets. Confirm this is intentional and avoids immortal-time or recurrence ambiguity.',
                ['concept_set_ids' => $targetOutcomeOverlap],
            );
        }
    }

    /**
     * @param  Collection<int, StudyDesignAsset>  $cohortDrafts
     * @param  list<array<string, mixed>>  $warnings
     */
    private function addDraftIssues(Collection $cohortDrafts, array &$warnings): void
    {
        $unlinkedMaterialized = $cohortDrafts
            ->filter(fn (StudyDesignAsset $asset): bool => $asset->status === StudyDesignAssetStatus::MATERIALIZED->value
                && ! is_numeric(data_get($asset->provenance_json, 'study_cohort_id')))
            ->pluck('id')
            ->values()
            ->all();

        if ($unlinkedMaterialized !== []) {
            $warnings[] = $this->issue(
                'unlinked_materialized_drafts',
                'Materialized cohort drafts are not yet linked to study roles.',
                ['asset_ids' => $unlinkedMaterialized],
            );
        }

        $blockedDrafts = $cohortDrafts
            ->where('verification_status', StudyDesignVerificationStatus::BLOCKED->value)
            ->pluck('id')
            ->values()
            ->all();
        if ($blockedDrafts !== []) {
            $warnings[] = $this->issue(
                'blocked_cohort_drafts',
                'Blocked cohort drafts remain in this version and should be corrected or rejected.',
                ['asset_ids' => $blockedDrafts],
            );
        }
    }

    /**
     * @param  Collection<string, Collection<int, StudyCohort>>  $byRole
     * @return list<int>
     */
    private function conceptSetIdsForRole(Collection $byRole, string $role): array
    {
        return $byRole
            ->get($role, collect())
            ->flatMap(fn (StudyCohort $cohort): array => is_array($cohort->concept_set_ids) ? $cohort->concept_set_ids : [])
            ->filter(fn (mixed $id): bool => is_numeric($id))
            ->map(fn (mixed $id): int => (int) $id)
            ->unique()
            ->values()
            ->all();
    }

    /**
     * @param  array<string, mixed>  $meta
     * @return array<string, mixed>
     */
    private function issue(string $code, string $message, array $meta = []): array
    {
        return [
            'code' => $code,
            'message' => $message,
            'meta' => $meta,
        ];
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
