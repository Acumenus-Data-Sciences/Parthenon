<?php

namespace App\Services\StudyDesign;

use App\Enums\StudyDesignAssetStatus;
use App\Models\App\Study;
use App\Models\App\StudyCohort;
use App\Models\App\StudyDesignAsset;
use App\Models\App\StudyDesignSession;
use App\Models\App\StudyDesignVersion;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class StudyAnalysisPlanService
{
    private const ANALYSIS_PACKAGES = [
        'characterization' => ['package' => 'Characterization', 'endpoint' => '/characterization/run', 'label' => 'Baseline Characterization'],
        'incidence_rate' => ['package' => 'CohortIncidence', 'endpoint' => '/cohort-incidence/run', 'label' => 'Incidence Rate'],
        'pathway' => ['package' => 'TreatmentPatterns', 'endpoint' => '/treatment-patterns/run', 'label' => 'Treatment Pathways'],
        'estimation' => ['package' => 'CohortMethod', 'endpoint' => '/estimation/run', 'label' => 'Population-Level Estimation'],
        'prediction' => ['package' => 'PatientLevelPrediction', 'endpoint' => '/prediction/run', 'label' => 'Patient-Level Prediction'],
        'sccs' => ['package' => 'SelfControlledCaseSeries', 'endpoint' => '/sccs/run', 'label' => 'Self-Controlled Case Series'],
        'self_controlled_cohort' => ['package' => 'SelfControlledCohort', 'endpoint' => '/self-controlled-cohort/run', 'label' => 'Self-Controlled Cohort'],
        'evidence_synthesis' => ['package' => 'EvidenceSynthesis', 'endpoint' => '/evidence-synthesis/run', 'label' => 'Evidence Synthesis'],
    ];

    public function __construct(
        private readonly StudyAnalysisPlanVerifier $verifier,
    ) {}

    /**
     * @param  array<string, mixed>  $options
     * @return list<StudyDesignAsset>
     */
    public function draft(Study $study, StudyDesignSession $session, StudyDesignVersion $version, int $userId, array $options = []): array
    {
        $requestedTypes = collect($options['analysis_types'] ?? [])
            ->filter(fn (mixed $type): bool => is_string($type) && isset(self::ANALYSIS_PACKAGES[$type]))
            ->values()
            ->all();
        $capabilities = $this->hadesCapabilities();
        $studyCohorts = $study->cohorts()->with('cohortDefinition')->orderBy('sort_order')->get();
        $roleMap = $this->roleMap($studyCohorts);
        $feasibility = $this->latestFeasibility($session, $version);
        $spec = is_array($version->normalized_spec_json ?? null)
            ? $version->normalized_spec_json
            : ($version->spec_json ?? []);
        $studyType = (string) (data_get($spec, 'study.study_type') ?: $study->study_type ?: '');

        $candidateTypes = $requestedTypes !== []
            ? $requestedTypes
            : $this->recommendedTypes($studyType, $roleMap, $feasibility);

        return collect($candidateTypes)
            ->map(function (string $analysisType) use ($study, $session, $version, $userId, $roleMap, $feasibility, $capabilities, $spec): StudyDesignAsset {
                $payload = $this->payload($analysisType, $study, $roleMap, $feasibility, $capabilities, is_array($spec) ? $spec : []);
                $asset = StudyDesignAsset::create([
                    'session_id' => $session->id,
                    'version_id' => $version->id,
                    'asset_type' => 'analysis_plan',
                    'role' => null,
                    'status' => StudyDesignAssetStatus::NEEDS_REVIEW->value,
                    'draft_payload_json' => $payload,
                    'provenance_json' => [
                        'source' => 'study_designer_analysis_plan',
                        'study_id' => $study->id,
                        'version_id' => $version->id,
                        'created_by' => $userId,
                        'darkstar_capability_status' => $capabilities['status'] ?? 'unknown',
                    ],
                    'rank_score' => $this->rankScore($payload),
                    'rank_score_json' => [
                        'analysis_type' => $analysisType,
                        'package_installed' => $payload['hades_capability']['installed'] ?? false,
                        'feasibility_status' => $payload['feasibility']['status'] ?? null,
                    ],
                ]);

                return $this->verifier->verify($asset);
            })
            ->values()
            ->all();
    }

    /**
     * @param  array<string, mixed>  $roleMap
     * @param  array<string, mixed>  $feasibility
     * @return list<string>
     */
    private function recommendedTypes(string $studyType, array $roleMap, array $feasibility): array
    {
        $types = ['characterization'];
        $hasTargetComparatorOutcome = isset($roleMap['target'], $roleMap['comparator'], $roleMap['outcome']);
        $hasTargetOutcome = isset($roleMap['target'], $roleMap['outcome']);

        if ($hasTargetComparatorOutcome || str_contains($studyType, 'comparative')) {
            $types[] = 'estimation';
        }

        if ($hasTargetOutcome && (str_contains($studyType, 'prediction') || str_contains($studyType, 'risk'))) {
            $types[] = 'prediction';
        }

        if ($hasTargetOutcome && (str_contains($studyType, 'safety') || str_contains($studyType, 'self') || str_contains($studyType, 'acute'))) {
            $types[] = 'sccs';
        }

        if (str_contains($studyType, 'incidence') || str_contains($studyType, 'prevalence')) {
            $types[] = 'incidence_rate';
        }

        if (str_contains($studyType, 'pathway') || str_contains($studyType, 'sequence') || isset($roleMap['comparator'])) {
            $types[] = 'pathway';
        }

        if (($feasibility['ready_source_count'] ?? 0) > 1) {
            $types[] = 'evidence_synthesis';
        }

        return array_values(array_unique($types));
    }

    /**
     * @param  array<string, mixed>  $roleMap
     * @param  array<string, mixed>  $feasibility
     * @param  array<string, mixed>  $capabilities
     * @param  array<string, mixed>  $spec
     * @return array<string, mixed>
     */
    private function payload(string $analysisType, Study $study, array $roleMap, array $feasibility, array $capabilities, array $spec): array
    {
        $meta = self::ANALYSIS_PACKAGES[$analysisType];
        $package = $meta['package'];
        $packageCapability = $this->packageCapability($capabilities, $package);
        $requiredRoles = $this->requiredRoles($analysisType);
        $blockers = [];
        $warnings = [];

        foreach ($requiredRoles as $role) {
            if (! isset($roleMap[$role])) {
                $blockers[] = $this->issue('missing_'.$role.'_cohort', "Missing {$role} cohort for {$meta['label']}.", ['role' => $role]);
            }
        }

        if (($feasibility['status'] ?? null) === null) {
            $blockers[] = $this->issue('missing_feasibility', 'Run source feasibility before drafting executable analysis plans.');
        } elseif (($feasibility['status'] ?? null) === 'blocked') {
            $blockers[] = $this->issue('blocked_feasibility', 'Resolve source feasibility blockers before materializing analysis plans.');
        } elseif (($feasibility['status'] ?? null) === 'limited') {
            $warnings[] = $this->issue('limited_feasibility', 'Feasibility is limited to a subset of selected sources; review before execution.');
        }

        foreach ((array) ($feasibility['warnings'] ?? []) as $warning) {
            if (is_array($warning)) {
                $warnings[] = $this->issue(
                    (string) ($warning['code'] ?? 'feasibility_warning'),
                    (string) ($warning['message'] ?? 'Review source feasibility warning before execution.'),
                    (array) ($warning['meta'] ?? []),
                );
            }
        }

        if (($packageCapability['installed'] ?? false) !== true) {
            $blockers[] = $this->issue('missing_hades_package', "Darkstar does not report {$package} as installed.", ['package' => $package]);
        }

        return [
            'schema_version' => 'study-analysis-plan.v1',
            'title' => "{$study->title}: {$meta['label']}",
            'analysis_type' => $analysisType,
            'description' => $this->description($analysisType, $spec),
            'hades_package' => $package,
            'hades_endpoint' => $meta['endpoint'],
            'hades_capability' => $packageCapability,
            'required_roles' => $requiredRoles,
            'cohort_role_map' => $roleMap,
            'design_json' => $this->designJson($analysisType, $roleMap),
            'feasibility' => [
                'status' => $feasibility['status'] ?? null,
                'ready_source_count' => $feasibility['ready_source_count'] ?? 0,
                'source_count' => $feasibility['source_count'] ?? 0,
                'ran_at' => $feasibility['ran_at'] ?? null,
            ],
            'blockers' => $blockers,
            'warnings' => $warnings,
            'materialization_target' => 'native_'.$analysisType.'_analysis',
            'policy' => 'Study Designer analysis plans compile into native Parthenon analysis records backed by Darkstar HADES packages.',
        ];
    }

    /**
     * @param  array<int, StudyCohort>|iterable<int, StudyCohort>  $studyCohorts
     * @return array<string, array<string, mixed>>
     */
    private function roleMap(iterable $studyCohorts): array
    {
        $roles = [];
        foreach ($studyCohorts as $cohort) {
            $role = $this->normalizeRole($cohort->role);
            $roles[$role] ??= [
                'study_cohort_id' => $cohort->id,
                'cohort_definition_id' => $cohort->cohort_definition_id,
                'cohort_definition_name' => $cohort->cohortDefinition?->name,
                'label' => $cohort->label,
            ];
        }

        return $roles;
    }

    /**
     * @return array<string, mixed>
     */
    private function latestFeasibility(StudyDesignSession $session, StudyDesignVersion $version): array
    {
        $asset = $session->assets()
            ->where('version_id', $version->id)
            ->where('asset_type', 'feasibility_result')
            ->orderByDesc('created_at')
            ->first();

        return is_array($asset?->draft_payload_json) ? $asset->draft_payload_json : [];
    }

    /**
     * @return array<string, mixed>
     */
    private function hadesCapabilities(): array
    {
        $url = rtrim(config('services.darkstar.url', 'http://darkstar:8787'), '/');

        try {
            $payload = Http::timeout(8)->get("{$url}/hades/packages")->json();

            return is_array($payload) ? $payload : ['status' => 'malformed', 'packages' => []];
        } catch (\Throwable $e) {
            Log::warning('Study analysis plan could not retrieve Darkstar HADES capabilities', [
                'message' => $e->getMessage(),
            ]);

            return ['status' => 'unavailable', 'packages' => []];
        }
    }

    /**
     * @param  array<string, mixed>  $capabilities
     * @return array<string, mixed>
     */
    private function packageCapability(array $capabilities, string $package): array
    {
        $row = collect($capabilities['packages'] ?? [])
            ->first(fn (mixed $candidate): bool => is_array($candidate) && ($candidate['package'] ?? null) === $package);

        if (! is_array($row)) {
            return ['package' => $package, 'installed' => false, 'status' => 'missing_from_inventory'];
        }

        return [
            'package' => $package,
            'installed' => (bool) ($row['installed'] ?? false),
            'version' => $row['version'] ?? null,
            'surface' => $row['surface'] ?? null,
            'priority' => $row['priority'] ?? null,
            'status' => (bool) ($row['installed'] ?? false) ? 'installed' : 'not_installed',
        ];
    }

    /**
     * @return list<string>
     */
    private function requiredRoles(string $analysisType): array
    {
        return match ($analysisType) {
            'estimation' => ['target', 'comparator', 'outcome'],
            'prediction', 'sccs', 'self_controlled_cohort' => ['target', 'outcome'],
            'pathway' => ['target', 'comparator'],
            default => ['target'],
        };
    }

    /**
     * @param  array<string, array<string, mixed>>  $roleMap
     * @return array<string, mixed>
     */
    private function designJson(string $analysisType, array $roleMap): array
    {
        $targetId = (int) ($roleMap['target']['cohort_definition_id'] ?? 0);
        $comparatorId = (int) ($roleMap['comparator']['cohort_definition_id'] ?? 0);
        $outcomeId = (int) ($roleMap['outcome']['cohort_definition_id'] ?? 0);

        return match ($analysisType) {
            'estimation' => [
                'targetCohortId' => $targetId,
                'comparatorCohortId' => $comparatorId,
                'outcomeCohortIds' => array_values(array_filter([$outcomeId])),
                'model' => ['type' => 'cox', 'timeAtRiskStart' => 1, 'timeAtRiskEnd' => 365, 'endAnchor' => 'cohort_start'],
                'propensityScore' => ['enabled' => true, 'method' => 'matching'],
                'covariateSettings' => ['useDemographicsGender' => true, 'useDemographicsAge' => true, 'useConditionOccurrenceLongTerm' => true],
            ],
            'prediction' => [
                'targetCohortId' => $targetId,
                'outcomeCohortId' => $outcomeId,
                'model' => ['type' => 'lasso_logistic_regression'],
                'timeAtRisk' => ['start' => 1, 'end' => 365, 'endAnchor' => 'cohort_start'],
                'populationSettings' => ['washoutPeriod' => 365, 'removeSubjectsWithPriorOutcome' => true, 'firstExposureOnly' => true],
            ],
            'incidence_rate' => [
                'targetCohortIds' => array_values(array_filter([$targetId])),
                'outcomeCohortIds' => array_values(array_filter([$outcomeId])),
                'timeAtRisk' => ['start' => 1, 'end' => 365],
            ],
            'pathway' => [
                'targetCohortId' => $targetId,
                'eventCohortIds' => array_values(array_filter([$comparatorId, $outcomeId])),
                'periodPriorToIndex' => 0,
                'minEraDuration' => 0,
            ],
            'sccs' => [
                'targetCohortId' => $targetId,
                'outcomeCohortId' => $outcomeId,
                'riskWindows' => [['start' => 1, 'end' => 30, 'label' => 'primary']],
                'controlInterval' => ['start' => -365, 'end' => -1],
            ],
            'self_controlled_cohort' => [
                'exposureCohortId' => $targetId,
                'outcomeCohortId' => $outcomeId,
                'riskWindows' => [['start' => 1, 'end' => 30, 'label' => 'primary']],
            ],
            'evidence_synthesis' => [
                'analysisIds' => [],
                'method' => 'random_effects',
                'input' => 'study_level_estimates',
            ],
            default => [
                'targetCohortIds' => array_values(array_filter([$targetId])),
                'comparatorCohortIds' => array_values(array_filter([$comparatorId])),
                'featureTypes' => ['demographics', 'conditions', 'drugs', 'measurements'],
                'stratifyByGender' => true,
                'stratifyByAge' => true,
                'topN' => 100,
                'minCellCount' => 5,
            ],
        };
    }

    /**
     * @param  array<string, mixed>  $spec
     */
    private function description(string $analysisType, array $spec): string
    {
        $objective = trim((string) data_get($spec, 'study.primary_objective', ''));
        $prefix = $objective !== '' ? "{$objective} " : '';

        return $prefix.match ($analysisType) {
            'estimation' => 'Estimate the target-comparator effect on linked outcomes using CohortMethod.',
            'prediction' => 'Train and evaluate outcome risk models using PatientLevelPrediction.',
            'incidence_rate' => 'Estimate source-specific incidence rates for linked cohorts.',
            'pathway' => 'Describe treatment sequence patterns with TreatmentPatterns.',
            'sccs' => 'Evaluate acute self-controlled exposure-outcome association with SCCS.',
            'self_controlled_cohort' => 'Evaluate self-controlled cohort risk windows.',
            'evidence_synthesis' => 'Prepare evidence synthesis for multi-source effect estimates.',
            default => 'Describe baseline covariates and cohort characteristics before inferential analysis.',
        };
    }

    private function rankScore(array $payload): float
    {
        $score = 50.0;
        if (($payload['hades_capability']['installed'] ?? false) === true) {
            $score += 25.0;
        }
        if (($payload['feasibility']['status'] ?? null) === 'ready') {
            $score += 20.0;
        }
        if (($payload['blockers'] ?? []) === []) {
            $score += 5.0;
        }

        return $score;
    }

    /**
     * @param  array<string, mixed>  $meta
     * @return array<string, mixed>
     */
    private function issue(string $code, string $message, array $meta = []): array
    {
        return ['code' => $code, 'message' => $message, 'meta' => $meta];
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
