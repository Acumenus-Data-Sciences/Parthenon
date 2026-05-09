<?php

namespace App\Services\Shiny;

use App\Models\App\StudyArtifact;

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
