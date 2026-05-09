<?php

namespace App\Services\Shiny;

use App\Models\App\StudyArtifact;
use App\Models\App\StudyResult;
use Illuminate\Support\Facades\Storage;

class ManagedShinyAppRegistry
{
    /**
     * @return list<array<string, mixed>>
     */
    public function all(): array
    {
        return [
            [
                'key' => 'plp-results',
                'label' => 'PatientLevelPrediction Results',
                'package' => 'OhdsiShinyModules',
                'module_family' => 'Prediction module',
                'result_types' => ['PatientLevelPrediction'],
                'artifact_types' => ['results_report', 'study_package_zip'],
                'launch_modes' => ['embedded', 'full_page'],
                'runtime_preference' => 'shinyproxy',
                'runtime_app' => 'plp-results',
                'status' => 'registry_ready',
                'permission_scope' => 'study_result_read',
                'entrypoint' => 'OhdsiShinyAppBuilder::createDefaultPredictionConfig',
            ],
            [
                'key' => 'population-estimation-results',
                'label' => 'CohortMethod, SCCS, and Evidence Synthesis Results',
                'package' => 'OhdsiShinyModules',
                'module_family' => 'Estimator module',
                'result_types' => ['CohortMethod', 'SelfControlledCaseSeries', 'EvidenceSynthesis'],
                'artifact_types' => ['results_report', 'study_package_zip'],
                'launch_modes' => ['embedded', 'full_page'],
                'runtime_preference' => 'shinyproxy',
                'runtime_app' => 'population-estimation-results',
                'status' => 'registry_ready',
                'permission_scope' => 'study_result_read',
                'entrypoint' => 'OhdsiShinyAppBuilder::createDefaultEstimationConfig',
            ],
            [
                'key' => 'cohort-diagnostics',
                'label' => 'Cohort Diagnostics Explorer',
                'package' => 'OhdsiShinyModules',
                'module_family' => 'Cohort Diagnostic module',
                'result_types' => ['CohortDiagnostics'],
                'artifact_types' => ['results_report', 'study_package_zip'],
                'launch_modes' => ['embedded', 'full_page'],
                'runtime_preference' => 'shinyproxy',
                'runtime_app' => 'cohort-diagnostics',
                'status' => 'registry_ready',
                'permission_scope' => 'cohort_diagnostics_read',
                'entrypoint' => 'OhdsiShinyAppBuilder::createDefaultCohortDiagnosticsConfig',
            ],
            [
                'key' => 'characterization',
                'label' => 'Characterization and Incidence Results',
                'package' => 'OhdsiShinyModules',
                'module_family' => 'Characterization module',
                'result_types' => ['Characterization', 'CohortIncidence'],
                'artifact_types' => ['results_report', 'study_package_zip'],
                'launch_modes' => ['embedded', 'full_page'],
                'runtime_preference' => 'shinyproxy',
                'runtime_app' => 'characterization',
                'status' => 'registry_ready',
                'permission_scope' => 'analysis_result_read',
                'entrypoint' => 'OhdsiShinyAppBuilder::createDefaultCharacterizationConfig',
            ],
            [
                'key' => 'phevaluator',
                'label' => 'PheValuator Results',
                'package' => 'OhdsiShinyModules',
                'module_family' => 'PheValuator module',
                'result_types' => ['PheValuator'],
                'artifact_types' => ['results_report', 'study_package_zip'],
                'launch_modes' => ['embedded', 'full_page'],
                'runtime_preference' => 'shinyproxy',
                'runtime_app' => 'phevaluator',
                'status' => 'registry_ready',
                'permission_scope' => 'phenotype_validation_read',
                'entrypoint' => 'OhdsiShinyAppBuilder::createDefaultPhevaluatorConfig',
            ],
            [
                'key' => 'ohdsi-report',
                'label' => 'OHDSI Report Viewer',
                'package' => 'OhdsiShinyModules',
                'module_family' => 'Report module',
                'result_types' => ['OhdsiReportGenerator', 'OhdsiSharing'],
                'artifact_types' => ['results_report', 'study_package_zip', 'supplementary'],
                'launch_modes' => ['embedded', 'full_page'],
                'runtime_preference' => 'shinyproxy',
                'runtime_app' => 'ohdsi-report',
                'status' => 'registry_ready',
                'permission_scope' => 'study_artifact_read',
                'entrypoint' => 'OhdsiShinyAppBuilder::createDefaultReportConfig',
            ],
        ];
    }

    /**
     * @return array<string, mixed>|null
     */
    public function find(string $key): ?array
    {
        foreach ($this->all() as $app) {
            if (($app['key'] ?? null) === $key) {
                return $app;
            }
        }

        return null;
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function appsForArtifact(StudyArtifact $artifact): array
    {
        if ($artifact->artifact_type === 'shiny_app_url') {
            return [];
        }

        $metadata = is_array($artifact->metadata) ? $artifact->metadata : [];
        $explicitKeys = $this->stringsFromMetadata($metadata, ['managed_shiny_app', 'managed_shiny_apps', 'shiny_app_key']);
        $resultTypes = $this->artifactResultTypes($artifact, $metadata);

        $apps = array_filter($this->all(), function (array $app) use ($artifact, $explicitKeys, $resultTypes): bool {
            if ($explicitKeys !== []) {
                return in_array((string) ($app['key'] ?? ''), $explicitKeys, true);
            }

            if ($this->supportsResultTypes($app, $resultTypes)) {
                return true;
            }

            return $this->supportsArtifactType($app, (string) $artifact->artifact_type)
                && ($app['key'] ?? null) === 'ohdsi-report';
        });

        return array_values($apps);
    }

    public function supportsArtifact(array $app, StudyArtifact $artifact): bool
    {
        return in_array((string) ($app['key'] ?? ''), array_column($this->appsForArtifact($artifact), 'key'), true);
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function appsForResult(StudyResult $result): array
    {
        if (trim((string) config('services.shiny_proxy.base_url', '')) === '') {
            return [];
        }

        if ($this->resultBundleFilePath($result) === null) {
            return [];
        }

        $metadata = $this->resultMetadata($result);
        $explicitKeys = $this->stringsFromMetadata($metadata, ['managed_shiny_app', 'managed_shiny_apps', 'shiny_app_key']);
        $resultTypes = $this->resultTypesForResult($result);

        $apps = array_filter($this->all(), function (array $app) use ($explicitKeys, $resultTypes): bool {
            if ($explicitKeys !== []) {
                return in_array((string) ($app['key'] ?? ''), $explicitKeys, true);
            }

            return $this->supportsResultTypes($app, $resultTypes);
        });

        return array_values($apps);
    }

    public function supportsResult(array $app, StudyResult $result): bool
    {
        return in_array((string) ($app['key'] ?? ''), array_column($this->appsForResult($result), 'key'), true);
    }

    /**
     * @return list<string>
     */
    public function resultTypesForResult(StudyResult $result): array
    {
        $metadata = $this->resultMetadata($result);
        $values = $this->stringsFromMetadata($metadata, [
            'result_type',
            'result_types',
            'ohdsi_result_type',
            'hades_result_type',
            'hades_package',
            'analysis_package',
            'package',
        ]);

        $values[] = $this->canonicalResultType((string) $result->result_type);

        return array_values(array_unique(array_filter($values)));
    }

    public function resultBundleFilePath(StudyResult $result): ?string
    {
        $result->loadMissing('execution');

        $metadata = $this->resultMetadata($result);
        $paths = $this->stringsFromMetadata($metadata, [
            'result_file_path',
            'result_bundle_path',
            'bundle_file_path',
            'managed_shiny_file_path',
            'managed_shiny_bundle_path',
            'artifact_file_path',
            'file_path',
        ]);

        $executionPath = $result->execution?->result_file_path;
        if (is_string($executionPath) && trim($executionPath) !== '') {
            array_unshift($paths, trim($executionPath));
        }

        foreach ($paths as $path) {
            if (Storage::disk('local')->exists($path)) {
                return $path;
            }
        }

        return null;
    }

    /**
     * @return list<string>
     */
    public function resultTypesForArtifact(StudyArtifact $artifact): array
    {
        $metadata = is_array($artifact->metadata) ? $artifact->metadata : [];

        return $this->artifactResultTypes($artifact, $metadata);
    }

    /**
     * @return array<string, mixed>
     */
    public function resultMetadata(StudyResult $result): array
    {
        $summary = is_array($result->summary_data) ? $result->summary_data : [];
        $diagnostics = is_array($result->diagnostics) ? $result->diagnostics : [];

        $managed = [];
        foreach ([$summary['managed_shiny'] ?? null, $diagnostics['managed_shiny'] ?? null] as $value) {
            if (is_array($value)) {
                $managed = [...$managed, ...$value];
            }
        }

        return [
            ...$summary,
            ...$diagnostics,
            ...$managed,
            'result_type' => $this->canonicalResultType((string) $result->result_type),
            'native_result_type' => $result->result_type,
        ];
    }

    /**
     * @param  array<string, mixed>  $app
     * @param  list<string>  $resultTypes
     */
    private function supportsResultTypes(array $app, array $resultTypes): bool
    {
        if ($resultTypes === []) {
            return false;
        }

        $supported = array_map(static fn (mixed $type): string => strtolower((string) $type), $app['result_types'] ?? []);

        foreach ($resultTypes as $type) {
            if (in_array(strtolower($type), $supported, true)) {
                return true;
            }
        }

        return false;
    }

    /**
     * @param  array<string, mixed>  $app
     */
    private function supportsArtifactType(array $app, string $artifactType): bool
    {
        return in_array($artifactType, $app['artifact_types'] ?? [], true);
    }

    /**
     * @param  array<string, mixed>  $metadata
     * @return list<string>
     */
    private function artifactResultTypes(StudyArtifact $artifact, array $metadata): array
    {
        $values = $this->stringsFromMetadata($metadata, [
            'result_type',
            'result_types',
            'ohdsi_result_type',
            'hades_result_type',
            'hades_package',
            'analysis_package',
            'package',
        ]);

        $haystack = strtolower(trim(implode(' ', [
            $artifact->title,
            $artifact->description,
            $artifact->artifact_type,
        ])));

        foreach ($this->all() as $app) {
            foreach ($app['result_types'] ?? [] as $resultType) {
                if (str_contains($haystack, strtolower((string) $resultType))) {
                    $values[] = (string) $resultType;
                }
            }
        }

        return array_values(array_unique(array_filter($values)));
    }

    private function canonicalResultType(string $resultType): string
    {
        $normalized = strtolower(trim(str_replace(['-', ' '], '_', $resultType)));

        return match ($normalized) {
            'prediction', 'prediction_performance', 'patient_level_prediction', 'patientlevelprediction', 'plp' => 'PatientLevelPrediction',
            'effect_estimate', 'estimation', 'population_estimation', 'cohort_method', 'cohortmethod' => 'CohortMethod',
            'sccs', 'self_controlled_case_series', 'selfcontrolledcaseseries' => 'SelfControlledCaseSeries',
            'evidence_synthesis', 'evidencesynthesis', 'meta_analysis', 'network_meta_analysis' => 'EvidenceSynthesis',
            'cohort_diagnostics', 'cohortdiagnostics', 'diagnostic', 'diagnostics' => 'CohortDiagnostics',
            'characterization', 'baseline_characterization' => 'Characterization',
            'incidence_rate', 'cohort_incidence', 'cohortincidence' => 'CohortIncidence',
            'phevaluator', 'phenotype_validation', 'phenotype_evaluation' => 'PheValuator',
            'ohdsi_report', 'report', 'results_report', 'ohdsireportgenerator' => 'OhdsiReportGenerator',
            'ohdsi_sharing', 'sharing', 'sharing_bundle', 'ohdsisharing' => 'OhdsiSharing',
            default => $resultType,
        };
    }

    /**
     * @param  array<string, mixed>  $metadata
     * @param  list<string>  $keys
     * @return list<string>
     */
    private function stringsFromMetadata(array $metadata, array $keys): array
    {
        $values = [];

        foreach ($keys as $key) {
            $value = $metadata[$key] ?? null;

            if (is_string($value) && trim($value) !== '') {
                $values[] = trim($value);

                continue;
            }

            if (! is_array($value)) {
                continue;
            }

            foreach ($value as $item) {
                if (is_string($item) && trim($item) !== '') {
                    $values[] = trim($item);
                }
            }
        }

        return array_values(array_unique($values));
    }
}
