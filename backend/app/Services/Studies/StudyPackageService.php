<?php

namespace App\Services\Studies;

use App\Models\App\Study;
use App\Models\App\StudyAnalysis;
use App\Models\App\StudyCohort;
use App\Models\App\StudyPackage;
use App\Models\App\StudyResult;
use App\Support\Hashing\DefinitionHasher;

/**
 * Builds an atomic, reproducible snapshot of a study (ADR-0020, Phase 1).
 *
 * The bundle records the definition hashes, compiled-SQL fingerprints, analysis
 * design hashes, results, and the vocabulary / CDM release the study was built
 * against. `bundle_sha256` fingerprints the whole snapshot (excluding the
 * volatile `generated_at`) so re-building an unchanged study yields an identical
 * hash. The `gate_ledger` key is reserved for the Phase 3 gate decision trail.
 */
class StudyPackageService
{
    public function __construct(
        private readonly DefinitionHasher $hasher,
    ) {}

    public function build(Study $study, ?int $userId = null): StudyPackage
    {
        $study->loadMissing(['cohorts.cohortDefinition', 'analyses', 'results']);

        $vocabularyVersions = [];
        $cdmReleases = [];

        $cohorts = $study->cohorts->map(function (StudyCohort $studyCohort) use (&$vocabularyVersions, &$cdmReleases): array {
            $definition = $studyCohort->cohortDefinition;
            $latestGeneration = $definition?->generations()->orderByDesc('id')->first();

            if ($latestGeneration !== null) {
                if ($latestGeneration->vocabulary_version !== null) {
                    $vocabularyVersions[] = $latestGeneration->vocabulary_version;
                }
                if ($latestGeneration->cdm_source_release !== null) {
                    $cdmReleases[] = $latestGeneration->cdm_source_release;
                }
            }

            return [
                'role' => $studyCohort->role,
                'cohort_definition_id' => $definition?->id,
                'name' => $definition?->name,
                'expression_sha256' => $definition?->expression_sha256,
                'concept_set_ids' => $studyCohort->concept_set_ids,
                'latest_generation' => $latestGeneration === null ? null : [
                    'generation_id' => $latestGeneration->id,
                    'source_id' => $latestGeneration->source_id,
                    'person_count' => $latestGeneration->person_count,
                    'expression_sha256' => $latestGeneration->expression_sha256,
                    'vocabulary_version' => $latestGeneration->vocabulary_version,
                    'cdm_source_release' => $latestGeneration->cdm_source_release,
                    'compiled_sql_sha256' => $latestGeneration->compiled_sql !== null
                        ? hash('sha256', $latestGeneration->compiled_sql)
                        : null,
                ],
            ];
        })->all();

        $analyses = $study->analyses->map(function (StudyAnalysis $studyAnalysis): array {
            $design = $studyAnalysis->analysis?->getAttribute('design_json');

            return [
                'study_analysis_id' => $studyAnalysis->id,
                'analysis_type' => $studyAnalysis->analysis_type,
                'analysis_id' => $studyAnalysis->analysis_id,
                'design_sha256' => is_array($design) ? $this->hasher->hashExpression($design) : null,
            ];
        })->all();

        $results = $study->results->map(fn (StudyResult $result): array => [
            'result_id' => $result->id,
            'study_analysis_id' => $result->study_analysis_id,
            'result_type' => $result->result_type,
            'study_design_version_id' => $result->study_design_version_id,
            'is_primary' => $result->is_primary,
            'is_publishable' => $result->is_publishable,
        ])->all();

        $vocabularyVersion = $vocabularyVersions[0] ?? null;
        $cdmRelease = $cdmReleases[0] ?? null;

        $bundle = [
            'schema_version' => 1,
            'study' => [
                'id' => $study->id,
                'title' => $study->title,
                'status' => $study->status,
            ],
            'concept_sets_and_cohorts' => $cohorts,
            'analyses' => $analyses,
            'results' => $results,
            'gate_ledger' => [],
            'vocabulary_version' => $vocabularyVersion,
            'cdm_source_release' => $cdmRelease,
            'generated_at' => now()->toIso8601String(),
        ];

        $hashable = $bundle;
        unset($hashable['generated_at']);

        $version = (int) (StudyPackage::query()->where('study_id', $study->id)->max('version') ?? 0) + 1;

        return StudyPackage::create([
            'study_id' => $study->id,
            'version' => $version,
            'bundle_json' => $bundle,
            'bundle_sha256' => $this->hasher->hashExpression($hashable),
            'vocabulary_version' => $vocabularyVersion,
            'cdm_source_release' => $cdmRelease,
            'created_by' => $userId,
            'tenant_id' => $study->getAttribute('tenant_id'),
        ]);
    }

    /**
     * Export a package's bundle for download.
     *
     * @return array<string, mixed>
     */
    public function export(StudyPackage $package): array
    {
        return $package->bundle_json;
    }
}
