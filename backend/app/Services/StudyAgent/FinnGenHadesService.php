<?php

namespace App\Services\StudyAgent;

use App\Models\App\Source;
use App\Services\Database\DynamicConnectionFactory;
use App\Services\SqlRenderer\SqlRendererService;
use Illuminate\Support\Facades\DB;

class FinnGenHadesService
{
    use FinnGenSharedHelpers;

    public function __construct(
        private readonly DynamicConnectionFactory $connections,
        private readonly SqlRendererService $sqlRenderer,
        private readonly FinnGenExternalAdapterService $externalAdapters,
    ) {}

    public function hadesExtras(Source $source, string $sqlTemplate, string $packageName = '', string $renderTarget = '', array $options = []): array
    {
        $summary = $this->sourceSummary($source);
        $template = $sqlTemplate !== '' ? $sqlTemplate : 'SELECT COUNT(*) AS person_count FROM {@cdmSchema}.person';
        $target = $renderTarget !== '' ? $renderTarget : ($summary['source_dialect'] ?: 'postgresql');
        $configProfile = trim((string) ($options['config_profile'] ?? ''));
        $artifactMode = trim((string) ($options['artifact_mode'] ?? ''));
        $packageSkeleton = trim((string) ($options['package_skeleton'] ?? ''));
        $cohortTable = trim((string) ($options['cohort_table'] ?? ''));
        $configYaml = trim((string) ($options['config_yaml'] ?? ''));
        $configContext = $this->parseHadesConfigYaml($configYaml);
        $runtime = $this->runtimeMetadata('hades_extras', [
            'supports_external_adapter' => true,
            'supports_source_preview' => true,
            'supports_sql_render' => true,
        ]);
        $packageSetup = $this->buildHadesPackageSetup($summary, $target, $packageName, $configProfile, $artifactMode, $packageSkeleton, $cohortTable, $configYaml, $configContext);

        try {
            $external = $this->externalAdapters->execute('hades_extras', [
                'source' => $summary, 'sql_template' => $template, 'package_name' => $packageName,
                'render_target' => $target, 'config_profile' => $configProfile, 'artifact_mode' => $artifactMode,
                'package_skeleton' => $packageSkeleton, 'cohort_table' => $cohortTable,
                'config_yaml' => $configYaml, 'config_context' => $configContext,
            ]);

            if (is_array($external) && $external !== []) {
                return $this->normalizeHadesExternalResult($summary, $template, $target, $packageName, $packageSetup, $external, $runtime);
            }
        } catch (\Throwable $e) {
            $runtime['status'] = 'adapter_failed';
            $runtime['fallback_active'] = true;
            $runtime['last_error'] = $e->getMessage();
            $runtime['notes'][] = 'External adapter execution failed. Falling back to Parthenon-native SQL rendering.';
        }

        $rendered = $this->sqlRenderer->render($template, [
            'cdmSchema' => $summary['cdm_schema'] ?: 'public',
            'vocabSchema' => $summary['vocabulary_schema'] ?: ($summary['cdm_schema'] ?: 'public'),
            'resultsSchema' => $summary['results_schema'] ?: 'public',
        ], $target);

        $explain = [];
        try {
            if (preg_match('/^\s*(select|with)\b/i', $rendered) === 1) {
                $connection = $this->connections->connectionName($source);
                $rows = DB::connection($connection)->select('EXPLAIN '.$rendered);
                $explain = array_map(static fn ($row) => (array) $row, $rows);
            }
        } catch (\Throwable $e) {
            $explain = [['QUERY PLAN' => $e->getMessage()]];
        }

        $package = $packageName !== '' ? $packageName : 'AcumenusFinnGenPackage';
        $packageEntries = $this->buildHadesPackageEntries($package, $target, $packageSetup);
        $artifactPipeline = $this->buildHadesArtifactPipeline($artifactMode, ! empty($explain));
        $sqlLineage = $this->buildHadesSqlLineage($summary['source_key'], $package, $packageSetup);
        $configExports = $this->buildHadesConfigExports($packageSetup);
        $cohortTableLifecycle = $this->buildHadesCohortTableLifecycle($summary, $packageSetup, $source);
        $helperLogs = $this->buildHadesHelperLogs($packageSetup, $configContext, $artifactPipeline, ! empty($explain));

        return [
            'status' => 'ok', 'runtime' => $runtime, 'source' => $summary,
            'package_setup' => $packageSetup,
            'config_yaml' => $configExports['yaml'],
            'render_summary' => [
                'package_name' => $package, 'render_target' => $target,
                'source_key' => $summary['source_key'],
                'supported_dialects' => $this->sqlRenderer->supportedDialects(),
                'artifact_mode' => $packageSetup['artifact_mode'],
                'package_skeleton' => $packageSetup['package_skeleton'],
            ],
            'sql_preview' => ['template' => $template, 'rendered' => $rendered],
            'artifact_pipeline' => $artifactPipeline,
            'artifacts' => array_map(static fn (array $entry) => ['name' => (string) $entry['path'], 'type' => (string) $entry['kind']], $packageEntries),
            'package_manifest' => $packageEntries,
            'package_bundle' => [
                'name' => "{$package}.zip", 'format' => 'zip',
                'entrypoints' => array_values(array_map(static fn (array $entry) => (string) $entry['path'], $packageEntries)),
                'download_name' => "{$package}-bundle.json",
                'profile' => $packageSetup['config_profile'], 'artifact_mode' => $packageSetup['artifact_mode'],
            ],
            'config_summary' => [
                'source_key' => $summary['source_key'], 'dialect' => $target,
                'config_profile' => $packageSetup['config_profile'], 'artifact_mode' => $packageSetup['artifact_mode'],
                'package_skeleton' => $packageSetup['package_skeleton'], 'cohort_table' => $packageSetup['cohort_table'],
            ],
            'config_import_summary' => $configContext['summary'],
            'config_validation' => $configContext['validation'],
            'config_exports' => $configExports,
            'sql_lineage' => $sqlLineage,
            'cohort_table_lifecycle' => $cohortTableLifecycle,
            'helper_logs' => $helperLogs,
            'cohort_summary' => [
                ['label' => 'Target cohort table', 'value' => $packageSetup['cohort_table']],
                ['label' => 'Config profile', 'value' => $packageSetup['config_profile']],
                ['label' => 'Manifest artifacts', 'value' => (string) count($packageEntries)],
            ],
            'temporal_covariate_helpers' => $this->buildTemporalCovariateHelpers($packageSetup['cohort_table'], $summary['cdm_schema'] ?: 'public'),
            'explain_plan' => $explain,
        ];
    }

    public function buildTemporalCovariateHelpers(string $cohortTable, string $cdmSchema): array
    {
        return [
            'temporal_covariate_settings' => [
                ['name' => 'DemographicsGender', 'category' => 'demographics', 'enabled' => true, 'temporal' => false],
                ['name' => 'DemographicsAge', 'category' => 'demographics', 'enabled' => true, 'temporal' => false],
                ['name' => 'DemographicsRace', 'category' => 'demographics', 'enabled' => true, 'temporal' => false],
                ['name' => 'ConditionGroupEraLongTerm', 'category' => 'conditions', 'enabled' => true, 'temporal' => true],
                ['name' => 'ConditionGroupEraShortTerm', 'category' => 'conditions', 'enabled' => true, 'temporal' => true],
                ['name' => 'DrugGroupEraLongTerm', 'category' => 'drugs', 'enabled' => true, 'temporal' => true],
                ['name' => 'DrugGroupEraShortTerm', 'category' => 'drugs', 'enabled' => true, 'temporal' => true],
                ['name' => 'ProcedureOccurrenceLongTerm', 'category' => 'procedures', 'enabled' => true, 'temporal' => true],
                ['name' => 'MeasurementLongTerm', 'category' => 'measurements', 'enabled' => false, 'temporal' => true],
                ['name' => 'CharlsonIndex', 'category' => 'indices', 'enabled' => true, 'temporal' => false],
                ['name' => 'Chads2Vasc', 'category' => 'indices', 'enabled' => false, 'temporal' => false],
            ],
            'temporal_windows' => [
                ['id' => 'short_term', 'start_day' => -30, 'end_day' => 0, 'label' => 'Short-term (30 days)'],
                ['id' => 'medium_term', 'start_day' => -180, 'end_day' => -31, 'label' => 'Medium-term (31-180 days)'],
                ['id' => 'long_term', 'start_day' => -365, 'end_day' => -181, 'label' => 'Long-term (181-365 days)'],
                ['id' => 'any_time', 'start_day' => -99999, 'end_day' => 0, 'label' => 'Any time prior'],
            ],
            'cohort_table' => $cohortTable, 'cdm_schema' => $cdmSchema,
            'r_function' => 'FeatureExtraction_createTemporalCovariateSettingsFromList',
            'r_package' => 'HadesExtras',
        ];
    }

    // ── Private helpers ──────────────────────────────────────────

    private function buildHadesPackageSetup(array $summary, string $target, string $packageName, string $configProfile, string $artifactMode, string $packageSkeleton, string $cohortTable, string $configYaml, array $configContext): array
    {
        $parsed = is_array($configContext['parsed'] ?? null) ? $configContext['parsed'] : [];

        return [
            'package_name' => $packageName !== '' ? $packageName : ((string) ($parsed['package_name'] ?? 'AcumenusFinnGenPackage')),
            'render_target' => (string) ($parsed['render_target'] ?? $target),
            'config_profile' => $configProfile !== '' ? $configProfile : ((string) ($parsed['config_profile'] ?? 'acumenus_default')),
            'artifact_mode' => $artifactMode !== '' ? $artifactMode : ((string) ($parsed['artifact_mode'] ?? 'full_bundle')),
            'package_skeleton' => $packageSkeleton !== '' ? $packageSkeleton : ((string) ($parsed['package_skeleton'] ?? 'ohdsi_study')),
            'cohort_table' => $cohortTable !== '' ? $cohortTable : ((string) ($parsed['cohort_table'] ?? (($summary['results_schema'] ?: 'results').'.cohort'))),
            'config_yaml' => $configYaml,
        ];
    }

    private function parseHadesConfigYaml(string $configYaml): array
    {
        if ($configYaml === '') {
            return [
                'parsed' => [],
                'summary' => ['yaml_mode' => 'generated_defaults', 'sections_detected' => 0, 'keys_detected' => 0],
                'validation' => [['label' => 'YAML input', 'status' => 'review', 'detail' => 'No YAML was supplied. Defaults will be generated from Workbench controls.']],
            ];
        }

        $parsed = [];
        $sections = [];
        $currentSection = null;
        $validation = [];

        foreach (preg_split('/\R/', $configYaml) ?: [] as $line) {
            $trimmed = trim($line);
            if ($trimmed === '' || str_starts_with($trimmed, '#')) {
                continue;
            }
            if (preg_match('/^([A-Za-z0-9_]+):\s*$/', $trimmed, $matches) === 1) {
                $currentSection = strtolower($matches[1]);
                $sections[] = $currentSection;

                continue;
            }
            if ($currentSection !== null && preg_match('/^([A-Za-z0-9_]+):\s*(.+)$/', $trimmed, $matches) === 1) {
                $key = strtolower($matches[1]);
                $value = trim($matches[2], " \"'");
                match ("{$currentSection}.{$key}") {
                    'package.name' => $parsed['package_name'] = $value,
                    'package.profile' => $parsed['config_profile'] = $value,
                    'render.target' => $parsed['render_target'] = $value,
                    'render.artifact_mode' => $parsed['artifact_mode'] = $value,
                    'render.skeleton' => $parsed['package_skeleton'] = $value,
                    'cohort.table' => $parsed['cohort_table'] = $value,
                    default => null,
                };

                continue;
            }
            $validation[] = ['label' => 'YAML syntax', 'status' => 'warning', 'detail' => "Unparsed line: {$trimmed}"];
        }

        foreach (['package_name', 'config_profile', 'render_target', 'artifact_mode', 'cohort_table'] as $field) {
            $validation[] = [
                'label' => $field,
                'status' => array_key_exists($field, $parsed) ? 'ready' : 'review',
                'detail' => array_key_exists($field, $parsed) ? "Loaded from YAML: {$parsed[$field]}" : 'Not provided in YAML. Workbench defaults or explicit controls will be used.',
            ];
        }

        return [
            'parsed' => $parsed,
            'summary' => ['yaml_mode' => 'imported', 'sections_detected' => count(array_unique($sections)), 'keys_detected' => count($parsed), 'recognized_keys' => implode(', ', array_keys($parsed))],
            'validation' => $validation,
        ];
    }

    private function buildHadesConfigExports(array $packageSetup): array
    {
        $json = [
            'package_name' => (string) ($packageSetup['package_name'] ?? 'AcumenusFinnGenPackage'),
            'render_target' => (string) ($packageSetup['render_target'] ?? 'postgresql'),
            'config_profile' => (string) ($packageSetup['config_profile'] ?? 'acumenus_default'),
            'artifact_mode' => (string) ($packageSetup['artifact_mode'] ?? 'full_bundle'),
            'package_skeleton' => (string) ($packageSetup['package_skeleton'] ?? 'ohdsi_study'),
            'cohort_table' => (string) ($packageSetup['cohort_table'] ?? 'results.cohort'),
        ];

        $yaml = trim((string) ($packageSetup['config_yaml'] ?? ''));
        if ($yaml === '') {
            $yaml = implode("\n", [
                'package:', '  name: '.$json['package_name'], '  profile: '.$json['config_profile'],
                'render:', '  target: '.$json['render_target'], '  artifact_mode: '.$json['artifact_mode'], '  skeleton: '.$json['package_skeleton'],
                'cohort:', '  table: '.$json['cohort_table'],
            ]);
        }

        return ['yaml' => $yaml, 'json' => $json];
    }

    private function buildHadesPackageEntries(string $packageName, string $target, array $packageSetup): array
    {
        $entries = [
            ['path' => "{$packageName}/DESCRIPTION", 'kind' => 'package', 'summary' => 'Package metadata'],
            ['path' => "{$packageName}/inst/sql/{$target}/analysis.sql", 'kind' => 'sql', 'summary' => 'Rendered SQL entrypoint'],
        ];
        if (($packageSetup['artifact_mode'] ?? '') !== 'sql_only') {
            $entries[] = ['path' => "{$packageName}/inst/settings.json", 'kind' => 'manifest', 'summary' => 'Render settings'];
        }
        if (($packageSetup['artifact_mode'] ?? '') === 'full_bundle') {
            $entries[] = ['path' => "{$packageName}/inst/cohorts/".str_replace('.', '_', (string) ($packageSetup['cohort_table'] ?? 'results.cohort')).'.csv', 'kind' => 'csv', 'summary' => 'Cohort artifact export'];
        }
        if (($packageSetup['package_skeleton'] ?? '') === 'finngen_extension') {
            $entries[] = ['path' => "{$packageName}/R/finngen_hooks.R", 'kind' => 'r', 'summary' => 'FINNGEN extension hooks'];
        }

        return $entries;
    }

    private function buildHadesArtifactPipeline(string $artifactMode, bool $hasExplain): array
    {
        return [
            ['name' => 'Render SQL', 'status' => 'ready'],
            ['name' => 'Plan inspection', 'status' => $hasExplain ? 'ready' : 'review'],
            ['name' => 'Manifest build', 'status' => $artifactMode === 'sql_only' ? 'skipped' : 'ready'],
            ['name' => 'Bundle emit', 'status' => $artifactMode === 'full_bundle' ? 'ready' : 'review'],
        ];
    }

    private function buildHadesSqlLineage(string $sourceKey, string $packageName, array $packageSetup): array
    {
        return [
            ['stage' => 'Template ingest', 'detail' => 'Accepted SQL template from Workbench payload'],
            ['stage' => 'Schema substitution', 'detail' => "Resolved source context for {$sourceKey} using {$packageSetup['config_profile']}"],
            ['stage' => 'Skeleton selection', 'detail' => "Prepared {$packageSetup['package_skeleton']} package skeleton"],
            ['stage' => 'Artifact emit', 'detail' => "Prepared {$packageSetup['artifact_mode']} artifacts for {$packageName}"],
        ];
    }

    private function buildHadesCohortTableLifecycle(array $summary, array $packageSetup, ?Source $source = null): array
    {
        $cohortTable = (string) ($packageSetup['cohort_table'] ?? (($summary['results_schema'] ?? 'results').'.cohort'));
        $artifactMode = (string) ($packageSetup['artifact_mode'] ?? 'full_bundle');
        $parts = explode('.', $cohortTable, 2);
        $tableSchema = count($parts) === 2 ? $parts[0] : ($summary['results_schema'] ?? 'results');
        $tableName = count($parts) === 2 ? $parts[1] : $cohortTable;

        $tableExists = false;
        $rowCount = 0;
        $distinctCohorts = 0;
        $columns = [];

        if ($source !== null) {
            try {
                $connection = $this->connections->connectionName($source);
                $check = DB::connection($connection)->selectOne('SELECT COUNT(*) AS cnt FROM information_schema.tables WHERE table_schema = ? AND table_name = ?', [$tableSchema, $tableName]);
                $tableExists = ((int) ($check->cnt ?? 0)) > 0;
                if ($tableExists) {
                    $countRow = DB::connection($connection)->selectOne("SELECT COUNT(*) AS cnt FROM {$tableSchema}.{$tableName}");
                    $rowCount = (int) ($countRow->cnt ?? 0);
                    $distinctRow = DB::connection($connection)->selectOne("SELECT COUNT(DISTINCT cohort_definition_id) AS cnt FROM {$tableSchema}.{$tableName}");
                    $distinctCohorts = (int) ($distinctRow->cnt ?? 0);
                    $cols = DB::connection($connection)->select('SELECT column_name FROM information_schema.columns WHERE table_schema = ? AND table_name = ? ORDER BY ordinal_position', [$tableSchema, $tableName]);
                    $columns = array_map(static fn ($r) => (string) ((array) $r)['column_name'], $cols);
                }
            } catch (\Throwable) {
            }
        }

        $requiredCols = ['cohort_definition_id', 'subject_id', 'cohort_start_date', 'cohort_end_date'];
        $missingCols = $tableExists ? array_diff($requiredCols, $columns) : [];
        $colStatus = $tableExists ? ($missingCols === [] ? 'ready' : 'warning') : 'review';
        $colDetail = $tableExists ? ($missingCols === [] ? 'All required columns found: '.implode(', ', $requiredCols) : 'Missing columns: '.implode(', ', $missingCols)) : 'Table not found — column validation skipped';

        return [
            ['name' => 'Resolve cohort table', 'status' => $tableExists ? 'ready' : 'warning', 'detail' => $tableExists ? "Found {$tableSchema}.{$tableName} ({$rowCount} rows, {$distinctCohorts} distinct cohort definitions)" : "Table {$tableSchema}.{$tableName} not found in schema"],
            ['name' => 'Validate cohort columns', 'status' => $colStatus, 'detail' => $colDetail],
            ['name' => 'Inspect cohort contents', 'status' => $tableExists && $rowCount > 0 ? 'ready' : 'review', 'detail' => $tableExists && $rowCount > 0 ? "{$rowCount} rows across {$distinctCohorts} cohort definitions" : 'No rows to inspect'],
            ['name' => 'Prepare artifact implications', 'status' => $artifactMode === 'sql_only' ? 'review' : 'ready', 'detail' => $artifactMode === 'sql_only' ? 'Artifact mode is SQL-only, so cohort-table exports are metadata-only.' : 'Cohort-table outputs are included in package artifact planning.'],
        ];
    }

    private function buildHadesHelperLogs(array $packageSetup, array $configContext, array $artifactPipeline, bool $hasExplain): array
    {
        return [
            ['step' => 'connectionHandlerFromList', 'status' => 'ready', 'detail' => sprintf('Prepared %s connection context for %s', $packageSetup['render_target'] ?? 'source', $packageSetup['package_name'] ?? 'package')],
            ['step' => 'readAndParseYaml', 'status' => ! empty($configContext['parsed']) ? 'ready' : 'review', 'detail' => ! empty($configContext['parsed']) ? sprintf('Parsed %d recognized YAML keys into the package setup', count($configContext['parsed'])) : 'No YAML overrides were parsed; Workbench defaults remain active.'],
            ['step' => 'CohortTableHandler', 'status' => 'ready', 'detail' => sprintf('Bound cohort table helper context to %s', $packageSetup['cohort_table'] ?? 'results.cohort')],
            ['step' => 'Artifact pipeline', 'status' => collect($artifactPipeline)->contains(fn (array $item) => ($item['status'] ?? '') === 'ready') ? 'ready' : 'review', 'detail' => sprintf('Prepared %d pipeline stages for manifest and bundle generation', count($artifactPipeline))],
            ['step' => 'Explain capture', 'status' => $hasExplain ? 'ready' : 'review', 'detail' => $hasExplain ? 'Explain output is available for SQL inspection.' : 'Explain output was not generated for this render.'],
        ];
    }

    private function normalizeHadesExternalResult(array $summary, string $template, string $target, string $packageName, array $packageSetup, array $external, array $runtime): array
    {
        $runtime['status'] = 'adapter_executed';
        $runtime['fallback_active'] = false;
        $runtime['notes'][] = 'Workbench results were produced by the configured external HADES adapter.';
        $runtime = $this->mergeAdapterRuntime($runtime, $external);

        $sqlPreview = $external['sql_preview'] ?? [];

        return [
            'status' => (string) ($external['status'] ?? 'ok'), 'runtime' => $runtime, 'source' => $summary,
            'package_setup' => is_array($external['package_setup'] ?? null) ? $external['package_setup'] : $packageSetup,
            'config_yaml' => is_string($external['config_yaml'] ?? null) ? $external['config_yaml'] : null,
            'render_summary' => is_array($external['render_summary'] ?? null) ? $external['render_summary'] : ['package_name' => $packageName !== '' ? $packageName : 'AcumenusFinnGenPackage', 'render_target' => $target, 'source_key' => $summary['source_key']],
            'config_summary' => is_array($external['config_summary'] ?? null) ? $external['config_summary'] : [],
            'config_import_summary' => is_array($external['config_import_summary'] ?? null) ? $external['config_import_summary'] : [],
            'config_validation' => is_array($external['config_validation'] ?? null) ? $external['config_validation'] : [],
            'config_exports' => is_array($external['config_exports'] ?? null) ? $external['config_exports'] : [],
            'sql_preview' => ['template' => (string) ($sqlPreview['template'] ?? $template), 'rendered' => (string) ($sqlPreview['rendered'] ?? $external['rendered_sql'] ?? '')],
            'artifact_pipeline' => is_array($external['artifact_pipeline'] ?? null) ? $external['artifact_pipeline'] : [],
            'artifacts' => is_array($external['artifacts'] ?? null) ? $external['artifacts'] : [],
            'package_manifest' => is_array($external['package_manifest'] ?? null) ? $external['package_manifest'] : [],
            'package_bundle' => is_array($external['package_bundle'] ?? null) ? $external['package_bundle'] : [],
            'sql_lineage' => is_array($external['sql_lineage'] ?? null) ? $external['sql_lineage'] : [],
            'cohort_table_lifecycle' => is_array($external['cohort_table_lifecycle'] ?? null) ? $external['cohort_table_lifecycle'] : [],
            'helper_logs' => is_array($external['helper_logs'] ?? null) ? $external['helper_logs'] : [],
            'cohort_summary' => is_array($external['cohort_summary'] ?? null) ? $external['cohort_summary'] : [],
            'explain_plan' => is_array($external['explain_plan'] ?? null) ? $external['explain_plan'] : [],
        ];
    }
}
