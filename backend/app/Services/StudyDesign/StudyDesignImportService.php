<?php

namespace App\Services\StudyDesign;

use App\Enums\StudyDesignAssetStatus;
use App\Enums\StudyDesignVerificationStatus;
use App\Models\App\CohortDefinition;
use App\Models\App\ConceptSet;
use App\Models\App\Study;
use App\Models\App\StudyAnalysis;
use App\Models\App\StudyCohort;
use App\Models\App\StudyDesignAsset;
use App\Models\App\StudyDesignSession;
use App\Models\App\StudyDesignVersion;
use Illuminate\Support\Facades\DB;

class StudyDesignImportService
{
    public function __construct(
        private readonly StudyDesignSpecValidator $validator,
    ) {}

    /**
     * @return array{version: StudyDesignVersion, assets: list<StudyDesignAsset>}
     */
    public function importExistingStudy(Study $study, StudyDesignSession $session, int $userId): array
    {
        return DB::transaction(function () use ($study, $session, $userId): array {
            $studyCohorts = $study->cohorts()
                ->with('cohortDefinition')
                ->orderBy('sort_order')
                ->orderBy('id')
                ->get();
            $studyAnalyses = $study->analyses()
                ->with('analysis')
                ->orderBy('id')
                ->get();

            $researchQuestion = $this->researchQuestion($study);
            $normalized = $this->validator->normalize(
                $this->specFromCurrentStudy($study, $studyCohorts, $studyAnalyses, $researchQuestion),
                $study,
                $researchQuestion,
            );
            $versionNumber = ((int) $session->versions()->max('version_number')) + 1;

            $version = $session->versions()->create([
                'version_number' => $versionNumber,
                'status' => ($normalized['lint']['status'] ?? 'needs_review') === 'ready' ? 'review_ready' : 'draft',
                'spec_json' => $normalized['spec'],
                'normalized_spec_json' => $normalized['spec'],
                'lint_results_json' => $normalized['lint'],
                'ai_model_metadata_json' => [
                    'provider' => 'manual_import',
                    'model' => null,
                    'prompt_template_version' => null,
                ],
                'created_by' => $userId,
            ]);

            $session->update([
                'active_version_id' => $version->id,
                'status' => 'reviewing',
            ]);

            $assets = [
                ...$this->importConceptSets($session, $version, $studyCohorts),
                ...$this->importStudyCohorts($session, $version, $studyCohorts),
                ...$this->importStudyAnalyses($session, $version, $studyAnalyses),
            ];

            return [
                'version' => $version->fresh(['creator:id,name,email', 'acceptedBy:id,name,email']) ?? $version,
                'assets' => collect($assets)
                    ->map(fn (StudyDesignAsset $asset): StudyDesignAsset => $asset->fresh('reviewer:id,name,email') ?? $asset)
                    ->values()
                    ->all(),
            ];
        });
    }

    private function researchQuestion(Study $study): string
    {
        foreach ([$study->primary_objective, $study->hypothesis, $study->description, $study->title] as $candidate) {
            $value = trim((string) $candidate);
            if ($value !== '') {
                return $value;
            }
        }

        return 'Review the current manually assembled study design.';
    }

    /**
     * @param  iterable<int, StudyCohort>  $studyCohorts
     * @param  iterable<int, StudyAnalysis>  $studyAnalyses
     * @return array<string, mixed>
     */
    private function specFromCurrentStudy(Study $study, iterable $studyCohorts, iterable $studyAnalyses, string $researchQuestion): array
    {
        $byRole = collect($studyCohorts)->groupBy(fn (StudyCohort $cohort): string => $this->normalizeRole($cohort->role));
        $target = $byRole->get('target', collect())->first();
        $comparator = $byRole->get('comparator', collect())->first();
        $outcomes = $byRole->get('outcome', collect());

        return [
            'schema_version' => '1.0',
            'study' => [
                'title' => $study->title,
                'short_title' => $study->short_title,
                'research_question' => $researchQuestion,
                'scientific_rationale' => $study->scientific_rationale ?? '',
                'hypothesis' => $study->hypothesis ?? '',
                'primary_objective' => $study->primary_objective ?: $researchQuestion,
                'secondary_objectives' => $study->secondary_objectives ?? [],
                'study_design' => $study->study_design ?? 'observational',
                'study_type' => $study->study_type ?? 'custom',
                'target_population_summary' => $this->cohortLabel($target),
            ],
            'pico' => [
                'population' => ['summary' => $this->cohortLabel($target)],
                'intervention_or_exposure' => ['summary' => $this->cohortLabel($target)],
                'comparator' => ['summary' => $this->cohortLabel($comparator)],
                'outcomes' => $outcomes
                    ->map(fn (StudyCohort $cohort, int $index): array => [
                        'summary' => $this->cohortLabel($cohort),
                        'primary' => $index === 0,
                    ])
                    ->values()
                    ->all(),
                'time' => ['summary' => 'Review imported study time-at-risk assumptions.'],
            ],
            'cohort_roles' => collect($studyCohorts)
                ->map(fn (StudyCohort $cohort): array => [
                    'role' => $this->normalizeRole($cohort->role),
                    'study_cohort_id' => $cohort->id,
                    'cohort_definition_id' => $cohort->cohort_definition_id,
                    'label' => $cohort->label,
                    'concept_set_ids' => $cohort->concept_set_ids ?? [],
                ])
                ->values()
                ->all(),
            'analysis_plan' => collect($studyAnalyses)
                ->map(fn (StudyAnalysis $analysis): array => [
                    'study_analysis_id' => $analysis->id,
                    'analysis_type' => $analysis->toArray()['analysis_type'] ?? 'unknown',
                    'analysis_id' => $analysis->analysis_id,
                ])
                ->values()
                ->all(),
            'provenance' => [
                'source' => 'bottom_up_import',
                'imported_at' => now()->toIso8601String(),
            ],
        ];
    }

    private function cohortLabel(?StudyCohort $cohort): string
    {
        if (! $cohort instanceof StudyCohort) {
            return '';
        }

        return trim((string) ($cohort->label ?: $cohort->cohortDefinition?->name ?: "Cohort {$cohort->cohort_definition_id}"));
    }

    /**
     * @param  iterable<int, StudyCohort>  $studyCohorts
     * @return list<StudyDesignAsset>
     */
    private function importConceptSets(StudyDesignSession $session, StudyDesignVersion $version, iterable $studyCohorts): array
    {
        $roleByConceptSet = [];
        $conceptSetIds = [];
        foreach ($studyCohorts as $cohort) {
            foreach ((array) ($cohort->concept_set_ids ?? []) as $conceptSetId) {
                if (is_numeric($conceptSetId)) {
                    $id = (int) $conceptSetId;
                    $conceptSetIds[] = $id;
                    $roleByConceptSet[$id] ??= $this->normalizeRole($cohort->role);
                }
            }
        }

        if ($conceptSetIds === []) {
            return [];
        }

        return ConceptSet::query()
            ->whereIn('id', array_values(array_unique($conceptSetIds)))
            ->orderBy('id')
            ->get()
            ->map(fn (ConceptSet $conceptSet): StudyDesignAsset => StudyDesignAsset::create([
                'session_id' => $session->id,
                'version_id' => $version->id,
                'asset_type' => 'imported_concept_set',
                'role' => $roleByConceptSet[$conceptSet->id] ?? null,
                'status' => StudyDesignAssetStatus::MATERIALIZED->value,
                'draft_payload_json' => [
                    'title' => $conceptSet->name,
                    'description' => $conceptSet->description,
                    'expression_json' => $conceptSet->expression_json ?? [],
                    'source_concept_set_id' => $conceptSet->id,
                ],
                'canonical_type' => ConceptSet::class,
                'canonical_id' => $conceptSet->id,
                'provenance_json' => [
                    'source' => 'bottom_up_import',
                    'imported_from' => 'study_cohort_concept_set_ids',
                    'concept_set_id' => $conceptSet->id,
                ],
                'verification_status' => StudyDesignVerificationStatus::VERIFIED->value,
                'verification_json' => $this->verifiedJson('Imported concept set already exists as a native Parthenon concept set.'),
                'verified_at' => now(),
                'materialized_type' => ConceptSet::class,
                'materialized_id' => $conceptSet->id,
                'materialized_at' => now(),
            ]))
            ->values()
            ->all();
    }

    /**
     * @param  iterable<int, StudyCohort>  $studyCohorts
     * @return list<StudyDesignAsset>
     */
    private function importStudyCohorts(StudyDesignSession $session, StudyDesignVersion $version, iterable $studyCohorts): array
    {
        return collect($studyCohorts)
            ->map(function (StudyCohort $cohort) use ($session, $version): StudyDesignAsset {
                $cohortDefinition = $cohort->cohortDefinition;
                $deprecated = $cohortDefinition?->isDeprecated() === true;

                return StudyDesignAsset::create([
                    'session_id' => $session->id,
                    'version_id' => $version->id,
                    'asset_type' => 'imported_study_cohort',
                    'role' => $this->normalizeRole($cohort->role),
                    'status' => StudyDesignAssetStatus::ACCEPTED->value,
                    'draft_payload_json' => [
                        'study_cohort_id' => $cohort->id,
                        'role' => $this->normalizeRole($cohort->role),
                        'label' => $cohort->label,
                        'description' => $cohort->description,
                        'cohort_definition_id' => $cohort->cohort_definition_id,
                        'cohort_definition_name' => $cohortDefinition?->name,
                        'concept_set_ids' => $cohort->concept_set_ids ?? [],
                        'expression_json' => $cohortDefinition?->expression_json ?? [],
                        'is_deprecated' => $deprecated,
                    ],
                    'canonical_type' => CohortDefinition::class,
                    'canonical_id' => $cohort->cohort_definition_id,
                    'provenance_json' => [
                        'source' => 'bottom_up_import',
                        'study_cohort_id' => $cohort->id,
                        'cohort_definition_id' => $cohort->cohort_definition_id,
                    ],
                    'verification_status' => $deprecated
                        ? StudyDesignVerificationStatus::BLOCKED->value
                        : StudyDesignVerificationStatus::VERIFIED->value,
                    'verification_json' => $deprecated
                        ? $this->blockedJson('Imported cohort definition is deprecated and should be replaced before lock or execution.')
                        : $this->verifiedJson('Imported study cohort is linked to a native non-deprecated cohort definition.'),
                    'verified_at' => now(),
                    'materialized_type' => CohortDefinition::class,
                    'materialized_id' => $cohort->cohort_definition_id,
                    'materialized_at' => now(),
                ]);
            })
            ->values()
            ->all();
    }

    /**
     * @param  iterable<int, StudyAnalysis>  $studyAnalyses
     * @return list<StudyDesignAsset>
     */
    private function importStudyAnalyses(StudyDesignSession $session, StudyDesignVersion $version, iterable $studyAnalyses): array
    {
        return collect($studyAnalyses)
            ->map(function (StudyAnalysis $studyAnalysis) use ($session, $version): StudyDesignAsset {
                $analysis = $studyAnalysis->analysis;
                $analysisType = $studyAnalysis->toArray()['analysis_type'] ?? 'unknown';

                return StudyDesignAsset::create([
                    'session_id' => $session->id,
                    'version_id' => $version->id,
                    'asset_type' => 'imported_study_analysis',
                    'role' => null,
                    'status' => StudyDesignAssetStatus::ACCEPTED->value,
                    'draft_payload_json' => [
                        'study_analysis_id' => $studyAnalysis->id,
                        'analysis_type' => $analysisType,
                        'analysis_id' => $studyAnalysis->analysis_id,
                        'title' => $analysis?->getAttribute('name'),
                        'description' => $analysis?->getAttribute('description'),
                        'design_json' => $analysis?->getAttribute('design_json') ?? [],
                    ],
                    'canonical_type' => $studyAnalysis->analysis_type,
                    'canonical_id' => $studyAnalysis->analysis_id,
                    'provenance_json' => [
                        'source' => 'bottom_up_import',
                        'study_analysis_id' => $studyAnalysis->id,
                        'analysis_type' => $studyAnalysis->analysis_type,
                        'analysis_id' => $studyAnalysis->analysis_id,
                    ],
                    'verification_status' => StudyDesignVerificationStatus::VERIFIED->value,
                    'verification_json' => $this->verifiedJson('Imported study analysis already exists as a native Parthenon analysis.'),
                    'verified_at' => now(),
                    'materialized_type' => $studyAnalysis->analysis_type,
                    'materialized_id' => $studyAnalysis->analysis_id,
                    'materialized_at' => now(),
                ]);
            })
            ->values()
            ->all();
    }

    /**
     * @return array<string, mixed>
     */
    private function verifiedJson(string $reason): array
    {
        return [
            'status' => StudyDesignVerificationStatus::VERIFIED->value,
            'eligibility' => [
                'can_accept' => true,
                'can_materialize' => false,
                'reason' => $reason,
            ],
            'blocking_reasons' => [],
            'warnings' => [],
            'checks' => [],
            'accepted_downstream_actions' => ['critique', 'lock_when_complete'],
            'acceptance_policy' => 'Imported assets preserve native Parthenon provenance and do not mutate canonical records.',
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function blockedJson(string $reason): array
    {
        return [
            'status' => StudyDesignVerificationStatus::BLOCKED->value,
            'eligibility' => [
                'can_accept' => false,
                'can_materialize' => false,
                'reason' => $reason,
            ],
            'blocking_reasons' => [$reason],
            'warnings' => [],
            'checks' => [['name' => 'imported_asset', 'status' => 'fail', 'message' => $reason]],
            'accepted_downstream_actions' => ['replace_or_defer'],
            'acceptance_policy' => 'Blocked imported assets cannot be accepted downstream until replaced or corrected.',
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
