<?php

namespace App\Services\StudyDesign;

use App\Enums\DaimonType;
use App\Enums\ExecutionStatus;
use App\Enums\StudyDesignAssetStatus;
use App\Enums\StudyDesignVerificationStatus;
use App\Models\App\CohortGeneration;
use App\Models\App\DqdResult;
use App\Models\App\Source;
use App\Models\App\SourceRelease;
use App\Models\App\Study;
use App\Models\App\StudyCohort;
use App\Models\App\StudyDesignAsset;
use App\Models\App\StudyDesignSession;
use App\Models\App\StudyDesignVersion;
use App\Models\Results\AchillesRun;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class StudyFeasibilityService
{
    private const CORE_COVERAGE_TABLES = [
        'person',
        'observation_period',
        'condition_occurrence',
        'drug_exposure',
        'procedure_occurrence',
        'measurement',
        'observation',
        'visit_occurrence',
        'death',
    ];

    private const ROLE_DOMAIN_TABLES = [
        'target' => ['condition_occurrence', 'drug_exposure', 'procedure_occurrence', 'observation', 'measurement'],
        'comparator' => ['drug_exposure', 'procedure_occurrence', 'observation', 'measurement'],
        'outcome' => ['condition_occurrence', 'measurement', 'procedure_occurrence', 'observation', 'death'],
        'exclusion' => ['condition_occurrence', 'drug_exposure', 'procedure_occurrence', 'observation', 'measurement'],
        'subgroup' => ['person', 'condition_occurrence', 'drug_exposure', 'procedure_occurrence', 'observation', 'measurement'],
        'event' => ['condition_occurrence', 'drug_exposure', 'procedure_occurrence', 'observation', 'measurement'],
    ];

    /**
     * @param  list<int>  $sourceIds
     * @return array<string, mixed>
     */
    public function run(Study $study, StudyDesignSession $session, StudyDesignVersion $version, array $sourceIds, int $minCellCount = 5): array
    {
        $studyCohorts = $study->cohorts()
            ->with('cohortDefinition')
            ->orderBy('sort_order')
            ->get()
            ->map(function (StudyCohort $cohort): StudyCohort {
                $cohort->role = $this->normalizeRole($cohort->role);

                return $cohort;
            });

        $sources = Source::query()
            ->with('daimons')
            ->whereIn('id', $sourceIds)
            ->orderBy('source_name')
            ->get();

        $blockers = [];
        $warnings = [];
        if ($studyCohorts->isEmpty()) {
            $blockers[] = $this->issue('missing_study_cohorts', 'Link study cohorts before running source feasibility.');
        }

        $sourceResults = $sources
            ->map(function (Source $source) use ($studyCohorts, $minCellCount): array {
                return $this->sourceFeasibility($source, $studyCohorts, $minCellCount);
            })
            ->values()
            ->all();

        foreach ($sourceResults as $sourceResult) {
            foreach ($sourceResult['blockers'] as $blocker) {
                $blockers[] = [
                    ...$blocker,
                    'source_id' => $sourceResult['source_id'],
                    'source_name' => $sourceResult['source_name'],
                ];
            }

            foreach ($sourceResult['warnings'] as $warning) {
                $warnings[] = [
                    ...$warning,
                    'source_id' => $sourceResult['source_id'],
                    'source_name' => $sourceResult['source_name'],
                ];
            }
        }

        $readySources = collect($sourceResults)
            ->filter(fn (array $sourceResult): bool => $sourceResult['ready_for_analysis'] === true)
            ->count();
        $status = $blockers === [] ? 'ready' : ($readySources > 0 ? 'limited' : 'blocked');

        $result = [
            'status' => $status,
            'ready_for_analysis' => $status === 'ready',
            'ready_source_count' => $readySources,
            'source_count' => $sources->count(),
            'min_cell_count' => $minCellCount,
            'ran_at' => now()->toIso8601String(),
            'required_roles' => $studyCohorts->pluck('role')->unique()->values()->all(),
            'sources' => $sourceResults,
            'blockers' => $blockers,
            'warnings' => $warnings,
            'policy' => 'Feasibility is source-specific and requires completed cohort generations for linked study cohorts before analysis planning.',
        ];

        $asset = $this->storeEvidenceAsset($session, $version, $result, $studyCohorts, $sources, $minCellCount);
        $version->update(['feasibility_summary_json' => $result]);

        return [
            'result' => $result,
            'asset' => $asset->fresh('reviewer:id,name,email') ?? $asset,
        ];
    }

    /**
     * @param  Collection<int, StudyCohort>  $studyCohorts
     * @return array<string, mixed>
     */
    private function sourceFeasibility(Source $source, Collection $studyCohorts, int $minCellCount): array
    {
        $sourceBlockers = [];
        $sourceWarnings = [];
        $cohortSummaries = $studyCohorts
            ->map(function (StudyCohort $studyCohort) use ($source, $minCellCount, &$sourceBlockers, &$sourceWarnings): array {
                $generation = $this->latestGeneration($studyCohort, $source);
                $count = $generation?->person_count;
                $generationStatus = $generation?->status?->value;

                if (! $generation instanceof CohortGeneration) {
                    $sourceBlockers[] = $this->issue('missing_cohort_generation', 'Generate this cohort on the selected source before analysis planning.', [
                        'role' => $studyCohort->role,
                        'study_cohort_id' => $studyCohort->id,
                        'cohort_definition_id' => $studyCohort->cohort_definition_id,
                    ]);
                } elseif ($generation->status !== ExecutionStatus::Completed) {
                    $sourceBlockers[] = $this->issue('incomplete_cohort_generation', 'Cohort generation is not completed on this source.', [
                        'role' => $studyCohort->role,
                        'study_cohort_id' => $studyCohort->id,
                        'generation_id' => $generation->id,
                        'status' => $generationStatus,
                    ]);
                } elseif ((int) $count === 0) {
                    $sourceBlockers[] = $this->issue('empty_required_cohort', 'A linked study cohort generated zero people on this source.', [
                        'role' => $studyCohort->role,
                        'study_cohort_id' => $studyCohort->id,
                        'generation_id' => $generation->id,
                    ]);
                } elseif ((int) $count < $minCellCount) {
                    $sourceWarnings[] = $this->issue('small_required_cohort', 'A linked study cohort is below the small-cell threshold on this source.', [
                        'role' => $studyCohort->role,
                        'study_cohort_id' => $studyCohort->id,
                        'generation_id' => $generation->id,
                    ]);
                }

                return [
                    'study_cohort_id' => $studyCohort->id,
                    'role' => $studyCohort->role,
                    'label' => $studyCohort->label,
                    'cohort_definition_id' => $studyCohort->cohort_definition_id,
                    'cohort_definition_name' => $studyCohort->cohortDefinition?->name,
                    'generation_id' => $generation?->id,
                    'generation_status' => $generationStatus,
                    'generated_at' => $generation?->completed_at?->toIso8601String(),
                    'person_count' => $this->disclosedCount($count, $minCellCount),
                    'person_count_suppressed' => $this->isSuppressed($count, $minCellCount),
                    'has_completed_generation' => $generation?->status === ExecutionStatus::Completed,
                    'attrition' => $this->attritionSummary($generation, $count, $minCellCount),
                ];
            })
            ->values()
            ->all();

        $overlap = $this->overlapMatrix($source, $studyCohorts, $minCellCount, $sourceWarnings);
        $sourceQuality = $this->sourceQuality($source);
        $coverage = $this->sourceCoverage($source);
        $domainAvailability = $this->domainAvailability($studyCohorts, $coverage);
        $personCount = $coverage['table_counts']['person']['count'] ?? null;
        $observationPeriodCount = $coverage['observation_period']['record_count'] ?? null;

        if (($coverage['cdm_schema'] ?? null) === null) {
            $sourceBlockers[] = $this->issue('missing_cdm_daimon', 'This source does not declare a CDM schema for feasibility checks.');
        }

        if ($personCount === null) {
            $sourceBlockers[] = $this->issue('person_records_unavailable', 'Person record availability could not be verified for this source.');
        } elseif ($personCount === 0) {
            $sourceBlockers[] = $this->issue('missing_person_records', 'This source has no person records available for feasibility checks.');
        }

        if ($observationPeriodCount === null) {
            $sourceBlockers[] = $this->issue('observation_periods_unavailable', 'Observation period availability could not be verified for this source.');
        } elseif ($observationPeriodCount === 0) {
            $sourceBlockers[] = $this->issue('missing_observation_periods', 'This source has no observation periods available for longitudinal study design.');
        }

        if (($coverage['date_coverage']['start_date'] ?? null) === null || ($coverage['date_coverage']['end_date'] ?? null) === null) {
            $sourceWarnings[] = $this->issue('date_coverage_unavailable', 'Observation-period date coverage could not be established for this source.');
        }

        $freshnessStatus = (string) ($coverage['freshness']['status'] ?? 'unknown');
        if ($freshnessStatus === 'unknown') {
            $sourceWarnings[] = $this->issue('source_freshness_unknown', 'No source release metadata is available to verify data freshness.');
        } elseif ($freshnessStatus === 'stale') {
            $sourceWarnings[] = $this->issue('source_freshness_stale', 'The latest source release metadata is more than one year old.', [
                'latest_release_at' => $coverage['freshness']['latest_release_at'] ?? null,
                'days_since_release' => $coverage['freshness']['days_since_release'] ?? null,
            ]);
        }

        $missingDomains = collect($domainAvailability['roles'] ?? [])
            ->filter(fn (array $roleAvailability): bool => ($roleAvailability['available'] ?? false) === false)
            ->values();
        foreach ($missingDomains as $missingDomain) {
            $sourceWarnings[] = $this->issue('missing_required_domain_records', 'A linked study cohort role has no records in its expected CDM domains on this source.', [
                'role' => $missingDomain['role'] ?? null,
                'required_tables' => $missingDomain['required_tables'] ?? [],
            ]);
        }

        $missingConceptTrace = $studyCohorts
            ->filter(fn (StudyCohort $cohort): bool => empty($cohort->concept_set_ids))
            ->values();
        foreach ($missingConceptTrace as $cohort) {
            $sourceWarnings[] = $this->issue('missing_concept_traceability', 'A linked study cohort does not preserve concept set traceability for source diagnostics.', [
                'role' => $cohort->role,
                'study_cohort_id' => $cohort->id,
                'cohort_definition_id' => $cohort->cohort_definition_id,
            ]);
        }

        if (($sourceQuality['dqd']['failed_checks'] ?? 0) > 0) {
            $sourceWarnings[] = $this->issue('dqd_failed_checks', 'Data Quality Dashboard checks failed for this source.', [
                'failed_checks' => $sourceQuality['dqd']['failed_checks'],
                'severe_failed_checks' => $sourceQuality['dqd']['severe_failed_checks'],
            ]);
        }

        return [
            'source_id' => $source->id,
            'source_name' => $source->source_name,
            'source_key' => $source->source_key,
            'source_dialect' => $source->source_dialect,
            'ready_for_analysis' => $sourceBlockers === [],
            'cohorts' => $cohortSummaries,
            'overlap_matrix' => $overlap,
            'coverage' => $coverage,
            'domain_availability' => $domainAvailability,
            'source_quality' => $sourceQuality,
            'blockers' => $sourceBlockers,
            'warnings' => $sourceWarnings,
        ];
    }

    private function latestGeneration(StudyCohort $studyCohort, Source $source): ?CohortGeneration
    {
        $completed = CohortGeneration::query()
            ->where('cohort_definition_id', $studyCohort->cohort_definition_id)
            ->where('source_id', $source->id)
            ->where('status', ExecutionStatus::Completed->value)
            ->orderByDesc('completed_at')
            ->orderByDesc('id')
            ->first();

        if ($completed instanceof CohortGeneration) {
            return $completed;
        }

        return CohortGeneration::query()
            ->where('cohort_definition_id', $studyCohort->cohort_definition_id)
            ->where('source_id', $source->id)
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->first();
    }

    /**
     * @param  Collection<int, StudyCohort>  $studyCohorts
     * @param  list<array<string, mixed>>  $sourceWarnings
     * @return array<string, mixed>
     */
    private function overlapMatrix(Source $source, Collection $studyCohorts, int $minCellCount, array &$sourceWarnings): array
    {
        $resultsSchema = $source->getTableQualifier(DaimonType::Results);
        if ($resultsSchema === null || $studyCohorts->count() < 2) {
            return ['status' => 'unavailable', 'pairs' => []];
        }

        try {
            $connectionName = $source->source_connection ?? 'omop';
            $pairs = [];
            $cohorts = $studyCohorts->values();

            for ($leftIndex = 0; $leftIndex < $cohorts->count(); $leftIndex++) {
                for ($rightIndex = $leftIndex + 1; $rightIndex < $cohorts->count(); $rightIndex++) {
                    /** @var StudyCohort $left */
                    $left = $cohorts[$leftIndex];
                    /** @var StudyCohort $right */
                    $right = $cohorts[$rightIndex];
                    $count = DB::connection($connectionName)
                        ->table("{$resultsSchema}.cohort as left_cohort")
                        ->join("{$resultsSchema}.cohort as right_cohort", 'left_cohort.subject_id', '=', 'right_cohort.subject_id')
                        ->where('left_cohort.cohort_definition_id', $left->cohort_definition_id)
                        ->where('right_cohort.cohort_definition_id', $right->cohort_definition_id)
                        ->distinct()
                        ->count('left_cohort.subject_id');

                    $pairs[] = [
                        'left_role' => $left->role,
                        'right_role' => $right->role,
                        'left_cohort_definition_id' => $left->cohort_definition_id,
                        'right_cohort_definition_id' => $right->cohort_definition_id,
                        'person_count' => $this->disclosedCount($count, $minCellCount),
                        'person_count_suppressed' => $this->isSuppressed($count, $minCellCount),
                    ];
                }
            }

            return ['status' => 'available', 'pairs' => $pairs];
        } catch (\Throwable $e) {
            $sourceWarnings[] = $this->issue('overlap_unavailable', 'Overlap matrix could not be computed from the source results cohort table.', [
                'error' => Str::limit($e->getMessage(), 240),
            ]);

            return ['status' => 'unavailable', 'pairs' => []];
        }
    }

    /**
     * @return array<string, mixed>
     */
    private function sourceQuality(Source $source): array
    {
        $dqdTotal = DqdResult::query()->where('source_id', $source->id)->count();
        $dqdFailed = DqdResult::query()->where('source_id', $source->id)->where('passed', false)->count();
        $severeFailed = DqdResult::query()
            ->where('source_id', $source->id)
            ->where('passed', false)
            ->whereIn('severity', ['error', 'fatal'])
            ->count();
        $topFailures = DqdResult::query()
            ->where('source_id', $source->id)
            ->where('passed', false)
            ->orderByDesc('violated_rows')
            ->limit(5)
            ->get(['check_id', 'category', 'cdm_table', 'severity', 'violated_rows', 'total_rows', 'description'])
            ->map(fn (DqdResult $result): array => [
                'check_id' => $result->check_id,
                'category' => $result->category,
                'cdm_table' => $result->cdm_table,
                'severity' => $result->severity,
                'violated_rows' => $result->violated_rows,
                'total_rows' => $result->total_rows,
                'description' => $result->description,
            ])
            ->all();

        $latestAchilles = AchillesRun::query()
            ->where('source_id', $source->id)
            ->orderByDesc('completed_at')
            ->orderByDesc('created_at')
            ->first();

        return [
            'dqd' => [
                'total_checks' => $dqdTotal,
                'failed_checks' => $dqdFailed,
                'severe_failed_checks' => $severeFailed,
                'pass_rate' => $dqdTotal > 0 ? round((($dqdTotal - $dqdFailed) / $dqdTotal) * 100, 2) : null,
                'top_failures' => $topFailures,
            ],
            'achilles' => [
                'run_id' => $latestAchilles?->run_id,
                'status' => $latestAchilles?->status,
                'completed_at' => $latestAchilles?->completed_at?->toIso8601String(),
                'completed_analyses' => $latestAchilles?->completed_analyses,
                'failed_analyses' => $latestAchilles?->failed_analyses,
            ],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function sourceCoverage(Source $source): array
    {
        $cdmSchema = $source->getTableQualifier(DaimonType::CDM);
        $connectionName = $source->source_connection ?? 'omop';
        $tableCounts = [];

        foreach (self::CORE_COVERAGE_TABLES as $tableName) {
            $count = null;
            $status = 'unavailable';

            if ($cdmSchema !== null) {
                try {
                    $count = DB::connection($connectionName)
                        ->table("{$cdmSchema}.{$tableName}")
                        ->count();
                    $status = 'available';
                } catch (\Throwable) {
                    $count = null;
                }
            }

            $tableCounts[$tableName] = [
                'table' => $tableName,
                'status' => $status,
                'count' => is_numeric($count) ? (int) $count : null,
            ];
        }

        $observationPeriod = [
            'status' => 'unavailable',
            'record_count' => null,
            'person_count' => null,
        ];
        $dateCoverage = [
            'status' => 'unavailable',
            'start_date' => null,
            'end_date' => null,
        ];

        if ($cdmSchema !== null) {
            try {
                $row = DB::connection($connectionName)
                    ->table("{$cdmSchema}.observation_period")
                    ->selectRaw('COUNT(*) AS record_count, COUNT(DISTINCT person_id) AS person_count, MIN(observation_period_start_date) AS start_date, MAX(observation_period_end_date) AS end_date')
                    ->first();

                $recordCount = (int) ($row->record_count ?? 0);
                $personCount = (int) ($row->person_count ?? 0);
                $startDate = $this->dateString($row->start_date ?? null);
                $endDate = $this->dateString($row->end_date ?? null);

                $observationPeriod = [
                    'status' => 'available',
                    'record_count' => $recordCount,
                    'person_count' => $personCount,
                ];
                $dateCoverage = [
                    'status' => $startDate !== null && $endDate !== null ? 'available' : 'unavailable',
                    'start_date' => $startDate,
                    'end_date' => $endDate,
                ];
            } catch (\Throwable) {
                // Table counts already capture the unavailable state.
            }
        }

        $latestRelease = SourceRelease::query()
            ->where('source_id', $source->id)
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->first();
        $daysSinceRelease = $latestRelease?->created_at === null
            ? null
            : (int) $latestRelease->created_at->diffInDays(now());

        return [
            'cdm_schema' => $cdmSchema,
            'table_counts' => $tableCounts,
            'observation_period' => $observationPeriod,
            'date_coverage' => $dateCoverage,
            'freshness' => [
                'status' => $latestRelease === null ? 'unknown' : ($daysSinceRelease !== null && $daysSinceRelease > 365 ? 'stale' : 'current'),
                'latest_release_id' => $latestRelease?->id,
                'latest_release_key' => $latestRelease?->release_key,
                'latest_release_name' => $latestRelease?->release_name,
                'latest_release_at' => $latestRelease?->created_at?->toIso8601String(),
                'days_since_release' => $daysSinceRelease,
                'cdm_version' => $latestRelease?->cdm_version,
                'vocabulary_version' => $latestRelease?->vocabulary_version,
                'person_count' => $latestRelease?->person_count,
                'record_count' => $latestRelease?->record_count,
            ],
        ];
    }

    /**
     * @param  Collection<int, StudyCohort>  $studyCohorts
     * @param  array<string, mixed>  $coverage
     * @return array<string, mixed>
     */
    private function domainAvailability(Collection $studyCohorts, array $coverage): array
    {
        $tableCounts = $coverage['table_counts'] ?? [];
        $roles = $studyCohorts
            ->map(function (StudyCohort $cohort) use ($tableCounts): array {
                $role = $this->normalizeRole($cohort->role);
                $requiredTables = self::ROLE_DOMAIN_TABLES[$role] ?? self::ROLE_DOMAIN_TABLES['target'];
                $availableTables = collect($requiredTables)
                    ->filter(function (string $tableName) use ($tableCounts): bool {
                        $count = $tableCounts[$tableName]['count'] ?? null;

                        return is_numeric($count) && (int) $count > 0;
                    })
                    ->values()
                    ->all();

                return [
                    'role' => $role,
                    'study_cohort_id' => $cohort->id,
                    'cohort_definition_id' => $cohort->cohort_definition_id,
                    'required_tables' => $requiredTables,
                    'available_tables' => $availableTables,
                    'available' => $availableTables !== [],
                ];
            })
            ->values()
            ->all();

        return [
            'roles' => $roles,
            'available_role_count' => collect($roles)->where('available', true)->count(),
            'role_count' => count($roles),
        ];
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function attritionSummary(?CohortGeneration $generation, mixed $finalCount, int $minCellCount): array
    {
        if (! $generation instanceof CohortGeneration) {
            return [];
        }

        $rawSteps = $generation->getAttribute('inclusion_rule_stats');
        if (! is_array($rawSteps) || $rawSteps === []) {
            return [[
                'name' => 'Generated cohort',
                'person_count' => $this->disclosedCount($finalCount, $minCellCount),
                'person_count_suppressed' => $this->isSuppressed($finalCount, $minCellCount),
                'person_percent' => null,
                'source' => 'cohort_generation',
            ]];
        }

        return collect($rawSteps)
            ->map(function (mixed $step, int $index) use ($minCellCount): array {
                $stepArray = is_array($step) ? $step : [];
                $count = $stepArray['person_count']
                    ?? $stepArray['persons']
                    ?? $stepArray['count']
                    ?? $stepArray['remaining']
                    ?? null;

                return [
                    'name' => (string) ($stepArray['name'] ?? $stepArray['rule_name'] ?? 'Inclusion rule '.($index + 1)),
                    'person_count' => $this->disclosedCount($count, $minCellCount),
                    'person_count_suppressed' => $this->isSuppressed($count, $minCellCount),
                    'person_percent' => is_numeric($stepArray['person_percent'] ?? null) ? (float) $stepArray['person_percent'] : null,
                    'source' => 'inclusion_rule_stats',
                ];
            })
            ->values()
            ->all();
    }

    /**
     * @param  array<string, mixed>  $result
     * @param  Collection<int, StudyCohort>  $studyCohorts
     * @param  Collection<int, Source>  $sources
     */
    private function storeEvidenceAsset(
        StudyDesignSession $session,
        StudyDesignVersion $version,
        array $result,
        Collection $studyCohorts,
        Collection $sources,
        int $minCellCount,
    ): StudyDesignAsset {
        return StudyDesignAsset::create([
            'session_id' => $session->id,
            'version_id' => $version->id,
            'asset_type' => 'feasibility_result',
            'role' => null,
            'status' => StudyDesignAssetStatus::NEEDS_REVIEW->value,
            'draft_payload_json' => $result,
            'provenance_json' => [
                'source' => 'study_designer_feasibility',
                'source_ids' => $sources->pluck('id')->values()->all(),
                'study_cohort_ids' => $studyCohorts->pluck('id')->values()->all(),
                'cohort_definition_ids' => $studyCohorts->pluck('cohort_definition_id')->values()->all(),
                'min_cell_count' => $minCellCount,
            ],
            'verification_status' => $result['status'] === 'ready'
                ? StudyDesignVerificationStatus::VERIFIED->value
                : StudyDesignVerificationStatus::BLOCKED->value,
            'verification_json' => [
                'status' => $result['status'] === 'ready'
                    ? StudyDesignVerificationStatus::VERIFIED->value
                    : StudyDesignVerificationStatus::BLOCKED->value,
                'eligibility' => [
                    'can_accept' => $result['status'] === 'ready',
                    'can_materialize' => false,
                    'reason' => $result['status'] === 'ready'
                        ? 'Feasibility evidence is sufficient for analysis planning.'
                        : 'Resolve source feasibility blockers before analysis planning.',
                ],
                'blocking_reasons' => collect($result['blockers'])->pluck('message')->values()->all(),
                'warnings' => collect($result['warnings'])->pluck('message')->values()->all(),
                'checks' => [],
                'source_summary' => [
                    'source' => 'study_designer_feasibility',
                    'retrieved_at' => $result['ran_at'],
                ],
                'canonical_summary' => null,
                'accepted_downstream_actions' => $result['status'] === 'ready' ? ['analysis_plan_generation'] : ['defer'],
                'acceptance_policy' => 'Only source-specific feasibility without blockers may move to analysis planning.',
            ],
            'verified_at' => now(),
        ]);
    }

    private function disclosedCount(mixed $count, int $minCellCount): ?int
    {
        if (! is_numeric($count)) {
            return null;
        }

        $integerCount = (int) $count;

        return $this->isSuppressed($integerCount, $minCellCount) ? null : $integerCount;
    }

    private function isSuppressed(mixed $count, int $minCellCount): bool
    {
        return is_numeric($count) && (int) $count > 0 && (int) $count < $minCellCount;
    }

    private function dateString(mixed $value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }

        return substr((string) $value, 0, 10);
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
