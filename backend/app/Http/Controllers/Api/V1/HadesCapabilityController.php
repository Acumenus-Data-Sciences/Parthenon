<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * @group HADES Runtime Capabilities
 */
class HadesCapabilityController extends Controller
{
    private const TARGET_VERSION_CHECKED_AT = '2026-05-08';

    private const TARGET_VERSION_SOURCE = 'OHDSI HADES package statuses, upstream DESCRIPTION files, and Parthenon-managed ETL-Synthea tag';

    private const TARGET_VERSIONS = [
        'SqlRender' => '1.19.5',
        'DatabaseConnector' => '7.1.0',
        'Andromeda' => '1.2.0',
        'Cyclops' => '3.7.0',
        'FeatureExtraction' => '3.13.0',
        'ResultModelManager' => '0.6.2',
        'EmpiricalCalibration' => '3.1.4',
        'ParallelLogger' => '3.5.1',
        'CohortMethod' => '6.0.2',
        'PatientLevelPrediction' => '6.6.0',
        'DeepPatientLevelPrediction' => '2.3.0',
        'EnsemblePatientLevelPrediction' => '1.0.3',
        'SelfControlledCaseSeries' => '6.1.5',
        'SelfControlledCohort' => '1.6.0',
        'EvidenceSynthesis' => '1.1.0',
        'CohortGenerator' => '1.1.0',
        'CohortDiagnostics' => '3.4.2',
        'CohortIncidence' => '4.1.1',
        'Characterization' => '3.0.0',
        'Strategus' => '1.5.0',
        'DataQualityDashboard' => '2.8.7',
        'Achilles' => '1.7.2',
        'TreatmentPatterns' => '3.1.2',
        'PheValuator' => '2.2.16',
        'KEEPER' => '2.1.0',
        'CohortExplorer' => '0.1.0',
        'PhenotypeLibrary' => '3.37.0',
        'Capr' => '2.1.1',
        'CirceR' => '1.3.3',
        'MethodEvaluation' => '2.4.0',
        'BigKnn' => '1.0.2',
        'BrokenAdaptiveRidge' => '1.0.1',
        'IterativeHardThresholding' => '1.0.3',
        'OhdsiReportGenerator' => '2.1.0',
        'OhdsiSharing' => '0.2.2',
        'OhdsiShinyAppBuilder' => '1.0.0',
        'OhdsiShinyModules' => '3.5.0',
        'ROhdsiWebApi' => '1.3.3',
        'Eunomia' => '2.1.0',
        'ETLSyntheaBuilder' => '2.1',
    ];

    private string $darkstarUrl;

    public function __construct()
    {
        $this->darkstarUrl = rtrim(config('services.darkstar.url', 'http://darkstar:8787'), '/');
    }

    /**
     * GET /api/v1/hades/packages
     *
     * Return the OHDSI/HADES package capability matrix reported by Darkstar.
     */
    public function packages(): JsonResponse
    {
        try {
            $response = Http::timeout(10)->get("{$this->darkstarUrl}/hades/packages");

            if ($response->failed()) {
                Log::warning('HADES package inventory request failed', [
                    'status' => $response->status(),
                    'body' => $response->body(),
                ]);

                return response()->json([
                    'error' => 'Failed to retrieve HADES package inventory',
                    'detail' => $response->json('message') ?? $response->body(),
                ], $response->status() ?: 502);
            }

            $payload = $response->json();

            if (! is_array($payload)) {
                return response()->json([
                    'error' => 'Darkstar returned a malformed package inventory response',
                ], 502);
            }

            return response()->json(['data' => $this->normalizeHadesInventory($payload)]);
        } catch (\Throwable $e) {
            Log::warning('HADES package inventory request could not reach Darkstar', [
                'message' => $e->getMessage(),
            ]);

            return response()->json([
                'error' => 'Darkstar unavailable',
                'message' => $e->getMessage(),
            ], 503);
        }
    }

    /**
     * Normalize older Darkstar payloads to the current Parthenon contract.
     * Package freshness and managed OHDSI Shiny compatibility are enforced here
     * so System Health remains useful even before the R image is rebuilt.
     *
     * @param  array<string, mixed>  $payload
     * @return array<string, mixed>
     */
    private function normalizeHadesInventory(array $payload): array
    {
        $payload = $this->enrichPackageFreshness($payload);
        $payload = $this->applyManagedShinyCompatibilityPolicy($payload);

        return $this->recalculateInventoryCounts($payload);
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return array<string, mixed>
     */
    private function enrichPackageFreshness(array $payload): array
    {
        $payload['target_version_checked_at'] = self::TARGET_VERSION_CHECKED_AT;
        $payload['target_version_source'] = self::TARGET_VERSION_SOURCE;
        $payload['release_profile'] ??= [
            'name' => '2026Q1',
            'source' => 'OHDSI HADES-wide release renv.lock',
            'lock_url' => 'https://raw.githubusercontent.com/OHDSI/Hades/refs/heads/main/hadesWideReleases/2026Q1/renv.lock',
            'mode' => 'stable_release_profile',
        ];

        if (! is_array($payload['packages'] ?? null)) {
            return $payload;
        }

        $payload['packages'] = array_map(function ($package): mixed {
            if (! is_array($package)) {
                return $package;
            }

            $name = (string) ($package['package'] ?? '');
            $targetVersion = self::TARGET_VERSIONS[$name] ?? null;
            $installed = ($package['installed'] ?? false) === true;
            $installedVersion = isset($package['version']) ? (string) $package['version'] : null;

            return [
                ...$package,
                'target_version' => $targetVersion,
                'latest_version' => $targetVersion,
                'version_status' => $this->versionStatus($installedVersion, $targetVersion, $installed),
                'target_version_checked_at' => self::TARGET_VERSION_CHECKED_AT,
                'target_version_source' => self::TARGET_VERSION_SOURCE,
            ];
        }, $payload['packages']);

        return $payload;
    }

    private function versionStatus(?string $installedVersion, ?string $targetVersion, bool $installed): string
    {
        if (! $installed) {
            return 'missing';
        }

        if ($targetVersion === null || $targetVersion === '' || $installedVersion === null || $installedVersion === '') {
            return 'unknown';
        }

        $comparison = version_compare($installedVersion, $targetVersion);

        return match (true) {
            $comparison < 0 => 'behind',
            $comparison > 0 => 'ahead',
            default => 'current',
        };
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return array<string, mixed>
     */
    private function applyManagedShinyCompatibilityPolicy(array $payload): array
    {
        $payload['shiny_policy'] = [
            'expose_hosted_surfaces' => true,
            'allow_iframe_embedding' => true,
            'allow_user_supplied_app_paths' => false,
            'decision' => 'managed_ohdsi_shiny_compatibility',
            'default_runtime' => 'shinyproxy',
            'supported_runtimes' => ['shinyproxy', 'posit_connect'],
            'allowed_scope' => 'vetted_ohdsi_modules_only',
            'replacement_surface' => 'Parthenon native React remains primary; managed OHDSI Shiny reference viewers are available for canonical OHDSI result exploration.',
        ];
        $payload['shiny_apps'] = $this->managedShinyApps();

        if (! is_array($payload['packages'] ?? null)) {
            return $payload;
        }

        $payload['packages'] = array_map(static function ($package): mixed {
            if (! is_array($package)) {
                return $package;
            }

            if (! in_array((string) ($package['package'] ?? ''), ['OhdsiShinyAppBuilder', 'OhdsiShinyModules'], true)) {
                return $package;
            }

            return [
                ...$package,
                'surface' => 'managed_shiny_compatibility',
                'priority' => 'high',
                'required_for_parity' => true,
                'hosted_surface' => true,
                'exposure_policy' => 'managed_compatibility_layer',
                'decision' => 'managed_ohdsi_shiny_compatibility',
                'replacement_surface' => 'Parthenon native React remains primary; managed OHDSI Shiny reference viewers can launch from vetted result artifacts.',
            ];
        }, $payload['packages']);

        return $payload;
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function managedShinyApps(): array
    {
        return [
            [
                'key' => 'plp-results',
                'label' => 'PatientLevelPrediction Results',
                'package' => 'OhdsiShinyModules',
                'module_family' => 'Prediction module',
                'result_types' => ['PatientLevelPrediction'],
                'launch_modes' => ['embedded', 'full_page'],
                'runtime_preference' => 'shinyproxy',
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
                'launch_modes' => ['embedded', 'full_page'],
                'runtime_preference' => 'shinyproxy',
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
                'launch_modes' => ['embedded', 'full_page'],
                'runtime_preference' => 'shinyproxy',
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
                'launch_modes' => ['embedded', 'full_page'],
                'runtime_preference' => 'shinyproxy',
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
                'launch_modes' => ['embedded', 'full_page'],
                'runtime_preference' => 'shinyproxy',
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
                'launch_modes' => ['embedded', 'full_page'],
                'runtime_preference' => 'shinyproxy',
                'status' => 'registry_ready',
                'permission_scope' => 'study_artifact_read',
                'entrypoint' => 'OhdsiShinyAppBuilder::createDefaultReportConfig',
            ],
        ];
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return array<string, mixed>
     */
    private function recalculateInventoryCounts(array $payload): array
    {
        if (! is_array($payload['packages'] ?? null)) {
            return $payload;
        }

        $packages = array_filter($payload['packages'], 'is_array');
        $names = array_map(static fn (array $package): string => (string) ($package['package'] ?? ''), $packages);
        $installed = array_values(array_filter($packages, static fn (array $package): bool => ($package['installed'] ?? false) === true));
        $missing = array_values(array_filter($packages, static fn (array $package): bool => ($package['installed'] ?? false) !== true));
        $required = array_values(array_filter($packages, static fn (array $package): bool => ($package['required_for_parity'] ?? false) === true));
        $current = array_values(array_filter($packages, static fn (array $package): bool => ($package['version_status'] ?? null) === 'current'));
        $outdated = array_values(array_filter($packages, static fn (array $package): bool => ($package['version_status'] ?? null) === 'behind'));
        $ahead = array_values(array_filter($packages, static fn (array $package): bool => ($package['version_status'] ?? null) === 'ahead'));
        $requiredMissing = array_values(array_filter($required, static fn (array $package): bool => ($package['installed'] ?? false) !== true));
        $requiredOutdated = array_values(array_filter($required, static fn (array $package): bool => ($package['version_status'] ?? null) === 'behind'));

        $payload['total'] = count($names);
        $payload['installed_count'] = count($installed);
        $payload['missing_count'] = count($missing);
        $payload['current_count'] = count($current);
        $payload['outdated_count'] = count($outdated);
        $payload['required_count'] = count($required);
        $payload['required_missing_count'] = count($requiredMissing);
        $payload['required_outdated_count'] = count($requiredOutdated);
        $payload['ahead_count'] = count($ahead);
        $payload['installed'] = array_values(array_map(static fn (array $package): string => (string) ($package['package'] ?? ''), $installed));
        $payload['missing'] = array_values(array_map(static fn (array $package): string => (string) ($package['package'] ?? ''), $missing));
        $payload['required_missing'] = array_values(array_map(static fn (array $package): string => (string) ($package['package'] ?? ''), $requiredMissing));
        $payload['outdated'] = array_values(array_map(static fn (array $package): string => (string) ($package['package'] ?? ''), $outdated));
        $payload['required_outdated'] = array_values(array_map(static fn (array $package): string => (string) ($package['package'] ?? ''), $requiredOutdated));
        $payload['ahead'] = array_values(array_map(static fn (array $package): string => (string) ($package['package'] ?? ''), $ahead));
        $payload['status'] = count($missing) === 0 ? 'complete' : 'partial';
        $payload['freshness_status'] = count($requiredOutdated) === 0 ? 'current' : 'stale';
        $payload['parity_status'] = match (true) {
            count($requiredMissing) > 0 => 'degraded',
            count($requiredOutdated) > 0 => 'stale',
            default => 'ready',
        };

        return $payload;
    }
}
