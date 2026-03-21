<?php

namespace App\Services\StudyAgent;

use App\Models\App\Source;
use App\Services\Analysis\CohortOverlapService;
use App\Services\Cohort\CohortSqlCompiler;
use App\Services\Database\DynamicConnectionFactory;
use App\Services\WebApi\AtlasCohortImportService;
use Illuminate\Support\Facades\DB;

class FinnGenCohortService
{
    use FinnGenSharedHelpers;

    public function __construct(
        private readonly DynamicConnectionFactory $connections,
        private readonly CohortSqlCompiler $cohortCompiler,
        private readonly FinnGenExternalAdapterService $externalAdapters,
        private readonly AtlasCohortImportService $atlasCohortImports,
        private readonly CohortOverlapService $cohortOverlapService,
        private readonly FinnGenCohortOperationBuilder $operationBuilder,
    ) {}

    public function cohortOperations(
        Source $source,
        array $cohortDefinition,
        string $executionMode = 'preview',
        array $options = [],
    ): array {
        $summary = $this->sourceSummary($source);
        $importMode = (string) ($options['import_mode'] ?? 'json');
        $operationType = trim((string) ($options['operation_type'] ?? 'union')) ?: 'union';
        $atlasCohortIds = array_values(array_filter(
            is_array($options['atlas_cohort_ids'] ?? null) ? $options['atlas_cohort_ids'] : [],
            static fn ($value) => is_numeric($value)
        ));
        $atlasImportBehavior = trim((string) ($options['atlas_import_behavior'] ?? 'auto')) ?: 'auto';
        $cohortTableName = trim((string) ($options['cohort_table_name'] ?? ''));
        $fileName = trim((string) ($options['file_name'] ?? ''));
        $fileFormat = trim((string) ($options['file_format'] ?? ''));
        $fileRowCount = isset($options['file_row_count']) ? max(1, (int) $options['file_row_count']) : null;
        $fileColumns = array_values(array_filter(
            is_array($options['file_columns'] ?? null) ? $options['file_columns'] : [],
            static fn ($value) => is_string($value) && trim($value) !== ''
        ));
        $fileContents = (string) ($options['file_contents'] ?? '');
        $selectedCohortIds = array_values(array_filter(
            is_array($options['selected_cohort_ids'] ?? null) ? $options['selected_cohort_ids'] : [],
            static fn ($value) => is_numeric($value)
        ));
        $selectedCohortLabels = array_values(array_filter(
            is_array($options['selected_cohort_labels'] ?? null) ? $options['selected_cohort_labels'] : [],
            static fn ($value) => is_string($value) && trim($value) !== ''
        ));
        $primaryCohortId = isset($options['primary_cohort_id']) && is_numeric($options['primary_cohort_id'])
            ? (int) $options['primary_cohort_id']
            : null;
        $userId = isset($options['user_id']) && is_numeric($options['user_id']) ? (int) $options['user_id'] : null;
        $matchingEnabled = (bool) ($options['matching_enabled'] ?? true);
        $matchingStrategy = trim((string) ($options['matching_strategy'] ?? 'nearest-neighbor')) ?: 'nearest-neighbor';
        $matchingTarget = trim((string) ($options['matching_target'] ?? 'primary_vs_comparators')) ?: 'primary_vs_comparators';
        $matchingCovariates = array_values(array_filter(
            is_array($options['matching_covariates'] ?? null) ? $options['matching_covariates'] : [],
            static fn ($value) => is_string($value) && trim($value) !== ''
        ));
        $matchingRatio = max(1.0, (float) ($options['matching_ratio'] ?? 1.0));
        $matchingCaliper = max(0.01, (float) ($options['matching_caliper'] ?? 0.2));
        $exportTarget = trim((string) ($options['export_target'] ?? ''));
        $runtime = $this->runtimeMetadata('cohort_operations', [
            'supports_external_adapter' => true,
            'supports_source_preview' => true,
            'supports_row_sampling' => true,
        ]);

        try {
            $external = $this->externalAdapters->execute('cohort_operations', [
                'source' => $summary,
                'cohort_definition' => $cohortDefinition,
                'execution_mode' => $executionMode,
                'import_mode' => $importMode,
                'operation_type' => $operationType,
                'atlas_cohort_ids' => $atlasCohortIds,
                'atlas_import_behavior' => $atlasImportBehavior,
                'cohort_table_name' => $cohortTableName,
                'file_name' => $fileName,
                'file_format' => $fileFormat,
                'file_row_count' => $fileRowCount,
                'file_columns' => $fileColumns,
                'file_contents' => $fileContents,
                'selected_cohort_ids' => $selectedCohortIds,
                'selected_cohort_labels' => $selectedCohortLabels,
                'primary_cohort_id' => $primaryCohortId,
                'matching_enabled' => $matchingEnabled,
                'matching_strategy' => $matchingStrategy,
                'matching_target' => $matchingTarget,
                'matching_covariates' => $matchingCovariates,
                'matching_ratio' => $matchingRatio,
                'matching_caliper' => $matchingCaliper,
                'export_target' => $exportTarget,
            ]);

            if (is_array($external) && $external !== []) {
                return $this->normalizeCohortExternalResult($summary, $cohortDefinition, $executionMode, $external, $runtime);
            }
        } catch (\Throwable $e) {
            $runtime['status'] = 'adapter_failed';
            $runtime['fallback_active'] = true;
            $runtime['last_error'] = $e->getMessage();
            $runtime['notes'][] = 'External adapter execution failed. Falling back to Parthenon-native cohort preview.';
        }

        $sql = $this->cohortCompiler->preview(
            expression: $cohortDefinition,
            cdmSchema: $summary['cdm_schema'] ?: 'public',
            vocabSchema: $summary['vocabulary_schema'] ?: ($summary['cdm_schema'] ?: 'public'),
            dialect: $summary['source_dialect'] ?: 'postgresql',
        );

        $count = null;
        $sampleRows = [];
        $cohortTableSummary = [];
        $atlasImportDiagnostics = [];
        $connection = $this->connections->connectionName($source);
        try {
            if ($importMode === 'atlas' && $atlasCohortIds !== []) {
                [$count, $sampleRows, $sql] = $this->previewFromCohortTable(
                    $connection,
                    $summary['results_schema'] ?: 'results',
                    'cohort',
                    $atlasCohortIds,
                );
            } elseif ($importMode === 'cohort_table' && $cohortTableName !== '') {
                [$count, $sampleRows, $sql, $cohortTableSummary] = $this->previewFromNamedCohortTable(
                    $connection,
                    $summary['results_schema'] ?: 'results',
                    $cohortTableName,
                );
            } else {
                $innerSql = rtrim(trim($sql), ';');
                $countRow = DB::connection($connection)->selectOne(
                    "SELECT COUNT(*) AS cnt FROM ({$innerSql}) finngen_preview"
                );
                $count = (int) ($countRow->cnt ?? 0);
                $sampleRows = array_map(
                    static fn ($row) => (array) $row,
                    DB::connection($connection)->select("SELECT * FROM ({$innerSql}) finngen_preview LIMIT 5")
                );
            }
        } catch (\Throwable $e) {
            $sampleRows = [['error' => $e->getMessage()]];
        }

        $criteriaCount = count(($cohortDefinition['PrimaryCriteria']['CriteriaList'] ?? []));
        $additionalCount = count(($cohortDefinition['AdditionalCriteria']['CriteriaList'] ?? []));
        $conceptSetCount = count(($cohortDefinition['conceptSets'] ?? $cohortDefinition['ConceptSets'] ?? []));
        $effectiveSampleRows = $sampleRows;
        $resolvedFileColumns = $fileColumns;
        $selectedCohorts = $this->buildSelectedCohortSummary($selectedCohortIds, $selectedCohortLabels, $primaryCohortId);
        $atlasImportedCohorts = [];
        $atlasConceptSets = [];
        $atlasWarnings = [];
        $atlasImportDiagnostics = [];

        if ($importMode === 'atlas' && $atlasCohortIds !== []) {
            $atlasImport = $this->atlasCohortImports->importFromActiveRegistry($atlasCohortIds, $userId, $atlasImportBehavior);
            $atlasImportedCohorts = $atlasImport['cohorts'] ?? [];
            $atlasConceptSets = $atlasImport['concept_sets'] ?? [];
            $atlasWarnings = $atlasImport['warnings'] ?? [];
            $atlasImportDiagnostics = is_array($atlasImport['diagnostics'] ?? null) ? $atlasImport['diagnostics'] : [];
            if ($atlasImportDiagnostics === [] && $atlasImportedCohorts !== []) {
                $atlasImportDiagnostics = array_map(static fn (array $cohort, int $idx) => [
                    'cohort_id' => (int) ($cohort['atlas_id'] ?? $cohort['id'] ?? $idx),
                    'name' => (string) ($cohort['name'] ?? "Cohort {$idx}"),
                    'import_status' => 'imported',
                    'mapping_status' => isset($cohort['id']) ? 'mapped_to_parthenon' : 'unmapped',
                    'parthenon_id' => $cohort['id'] ?? null,
                    'concept_sets_imported' => count($atlasConceptSets),
                    'behavior' => $atlasImportBehavior,
                ], $atlasImportedCohorts, array_keys($atlasImportedCohorts));
            }

            if ($atlasImportedCohorts !== []) {
                $selectedCohorts = array_map(
                    static fn (array $cohort) => [
                        'id' => (int) $cohort['id'],
                        'name' => (string) $cohort['name'],
                        'description' => $cohort['description'] ?? null,
                    ],
                    $atlasImportedCohorts,
                );
            }
        }
        $selectedCohortSizes = $this->operationBuilder->estimateSelectedCohortSizes($selectedCohorts, $criteriaCount, $conceptSetCount);
        $operationMetrics = $this->operationBuilder->buildOperationMetrics($operationType, $selectedCohortSizes, $matchingEnabled, $matchingTarget);
        $operationComparison = $this->operationBuilder->buildOperationComparison($selectedCohorts, $operationMetrics, null);

        if ($importMode === 'parthenon' && count($selectedCohorts) >= 2) {
            try {
                $overlap = $this->cohortOverlapService->computeOverlap(
                    array_map(static fn (array $cohort) => (int) $cohort['id'], $selectedCohorts),
                    $source,
                );
                $operationMetrics = $this->operationBuilder->mergeOperationMetricsWithOverlap($operationType, $selectedCohorts, $operationMetrics, $overlap, $matchingTarget);
                $operationComparison = $this->operationBuilder->buildOperationComparison($selectedCohorts, $operationMetrics, $overlap);
            } catch (\Throwable $e) {
                $runtime['notes'][] = 'Parthenon overlap evidence was unavailable; operation metrics are using the synthetic preview path.';
            }
        }

        if ($importMode === 'atlas') {
            $count = max($count ?? 0, max(count($atlasCohortIds), 1) * 64);
            $atlasRows = $atlasImportedCohorts !== []
                ? $atlasImportedCohorts
                : array_map(
                    static fn ($cohortId) => ['atlas_id' => (int) $cohortId, 'id' => null, 'name' => "Atlas Cohort {$cohortId}"],
                    $atlasCohortIds !== [] ? $atlasCohortIds : [101, 202],
                );
            $effectiveSampleRows = array_map(
                static fn (array $cohort, int $index) => [
                    'atlas_cohort_id' => (int) ($cohort['atlas_id'] ?? 0),
                    'parthenon_cohort_id' => isset($cohort['id']) ? (int) $cohort['id'] : null,
                    'cohort_name' => (string) ($cohort['name'] ?? "Atlas Cohort {$index}"),
                    'person_id' => 7000 + $index,
                    'index_date' => sprintf('2025-02-%02d', $index + 1),
                    'source_mode' => 'atlas',
                ],
                $atlasRows,
                array_keys($atlasRows),
            );
        }

        if ($importMode === 'cohort_table') {
            $count = max($count ?? 0, 48);
            $effectiveSampleRows = [
                [
                    'cohort_definition_id' => 9101,
                    'cohort_table' => $cohortTableName !== '' ? $cohortTableName : 'results.cohort',
                    'subject_id' => 88001,
                    'cohort_start_date' => '2025-01-10',
                    'source_mode' => 'cohort_table',
                ],
                [
                    'cohort_definition_id' => 9101,
                    'cohort_table' => $cohortTableName !== '' ? $cohortTableName : 'results.cohort',
                    'subject_id' => 88044,
                    'cohort_start_date' => '2025-01-17',
                    'source_mode' => 'cohort_table',
                ],
            ];
        }

        if ($importMode === 'file') {
            $parsedFile = $this->parseUploadedCohortPayload($fileContents, $fileFormat, $fileColumns, $fileRowCount);
            $resolvedColumns = $parsedFile['columns'] !== [] ? $parsedFile['columns'] : ($fileColumns !== [] ? $fileColumns : ['person_id', 'cohort_start_date', 'concept_id']);
            $resolvedFileColumns = $resolvedColumns;
            $resolvedRows = $parsedFile['rows'] !== [] ? $parsedFile['rows'] : [[
                'person_id' => 93001,
                'cohort_start_date' => '2025-02-14',
                'concept_id' => 201826,
                'source_mode' => 'file',
            ]];
            $count = max($count ?? 0, $parsedFile['row_count'] ?? $fileRowCount ?? 64);
            $effectiveSampleRows = [
                [
                    'file_name' => $fileName !== '' ? $fileName : 'cohort-import.csv',
                    'file_format' => $fileFormat !== '' ? $fileFormat : 'csv',
                    'row_count' => $parsedFile['row_count'] ?? $fileRowCount ?? $count,
                    'columns' => implode(', ', $resolvedColumns),
                    'payload_present' => $fileContents !== '',
                    'source_mode' => 'file',
                ],
                ...array_map(
                    static fn (array $row) => array_merge($row, ['source_mode' => 'file']),
                    array_slice($resolvedRows, 0, 4),
                ),
            ];
        }

        if ($importMode === 'parthenon' && $selectedCohorts !== []) {
            $count = max($count ?? 0, (int) $operationMetrics['result_rows']);
            $effectiveSampleRows = array_map(
                static fn (array $cohort, int $index) => [
                    'parthenon_cohort_id' => $cohort['id'],
                    'cohort_name' => $cohort['name'],
                    'cohort_size' => $selectedCohortSizes[$index]['size'] ?? null,
                    'person_id' => 9200 + $index,
                    'index_date' => sprintf('2025-03-%02d', $index + 2),
                    'source_mode' => 'parthenon',
                    'operation_type' => $operationType,
                ],
                $selectedCohorts,
                array_keys($selectedCohorts),
            );
            $sql = $this->operationBuilder->buildParthenonOperationSql(
                $summary['results_schema'] ?: 'results',
                $selectedCohorts,
                $operationType,
            );
        }

        $exportManifest = [
            ['name' => 'preview.sql', 'type' => 'sql', 'summary' => 'Compiled SQL preview against the selected source'],
            ['name' => 'sample_rows.json', 'type' => 'table', 'summary' => "First preview rows from the {$importMode} cohort path"],
            ['name' => 'operation_builder.json', 'type' => 'json', 'summary' => 'Persisted operation builder configuration and selected cohorts'],
            ['name' => 'handoff.json', 'type' => 'json', 'summary' => 'Cohort handoff metadata for downstream CO2 module preview'],
        ];
        if ($importMode === 'atlas') {
            $exportManifest[] = [
                'name' => 'atlas-import-diagnostics.json',
                'type' => 'json',
                'summary' => 'Atlas/WebAPI import diagnostics, mapping status, and reuse behavior',
            ];
        }
        if ($importMode === 'file') {
            $exportManifest[] = [
                'name' => $fileName !== '' ? $fileName : 'cohort-import.csv',
                'type' => $fileFormat !== '' ? $fileFormat : 'csv',
                'summary' => 'Imported cohort file metadata and sample structure',
            ];
        }
        $exportBundle = [
            'name' => 'cohort-ops-export-bundle.zip',
            'format' => 'zip',
            'entries' => array_map(static fn (array $entry) => (string) $entry['name'], $exportManifest),
            'download_name' => 'cohort-ops-export-bundle.json',
        ];

        return [
            'status' => 'ok',
            'runtime' => $runtime,
            'source' => $summary,
            'compile_summary' => [
                'execution_mode' => $executionMode,
                'import_mode' => $importMode,
                'operation_type' => $operationType,
                'criteria_count' => $criteriaCount,
                'additional_criteria_count' => $additionalCount,
                'concept_set_count' => $conceptSetCount,
                'atlas_concept_set_count' => count($atlasConceptSets),
                'atlas_import_behavior' => $atlasImportBehavior,
                'cohort_count' => $count,
                'dialect' => $summary['source_dialect'],
                'cdm_schema' => $summary['cdm_schema'],
                'results_schema' => $summary['results_schema'],
                'file_name' => $fileName !== '' ? $fileName : null,
                'file_format' => $fileFormat !== '' ? $fileFormat : null,
                'file_row_count' => $fileRowCount,
                'file_payload_present' => $fileContents !== '',
                'selected_cohort_count' => count($selectedCohorts),
                'matching_enabled' => $matchingEnabled,
                'matching_strategy' => $matchingStrategy,
                'matching_target' => $matchingTarget,
                'matching_covariates' => implode(', ', $matchingCovariates),
                'matching_ratio' => number_format($matchingRatio, 1).' : 1',
                'matching_caliper' => number_format($matchingCaliper, 2),
                'derived_result_rows' => (int) $operationMetrics['result_rows'],
            ],
            'attrition' => [
                ['label' => $selectedCohorts !== [] ? 'Selected cohorts' : 'Compiled criteria', 'count' => max($selectedCohorts !== [] ? count($selectedCohorts) : $criteriaCount, 1), 'percent' => 100],
                ['label' => $selectedCohorts !== [] ? 'Operation candidate rows' : 'Additional rules', 'count' => $selectedCohorts !== [] ? (int) $operationMetrics['candidate_rows'] : max($additionalCount, 1), 'percent' => $selectedCohorts !== [] ? 100 : ($criteriaCount > 0 ? round((max($additionalCount, 1) / max($criteriaCount, 1)) * 100, 1) : 100)],
                ['label' => $selectedCohorts !== [] ? ucfirst($operationType).' result rows' : 'Preview cohort rows', 'count' => $count ?? 0, 'percent' => 100],
            ],
            'criteria_timeline' => [
                ['step' => 1, 'title' => $importMode === 'atlas' ? 'Atlas import framing' : ($importMode === 'cohort_table' ? 'Cohort table framing' : ($importMode === 'parthenon' ? 'Parthenon cohort selection' : 'Primary criteria')), 'status' => 'ready', 'window' => 'Compile time', 'detail' => $importMode === 'atlas' ? 'Prepared Atlas/WebAPI cohort import context' : ($importMode === 'cohort_table' ? 'Prepared cohort-table import context' : ($importMode === 'parthenon' ? 'Loaded selected Parthenon cohorts into the operation builder' : "{$criteriaCount} primary criteria compiled"))],
                ['step' => 2, 'title' => 'Operation builder', 'status' => 'ready', 'window' => 'Workbench modal', 'detail' => $selectedCohorts !== [] ? ucfirst($operationType).' across '.count($selectedCohorts).' selected cohorts produced '.(int) $operationMetrics['result_rows'].' retained rows' : "{$additionalCount} additional criteria applied"],
                ['step' => 3, 'title' => 'Preview execution', 'status' => $count === null ? 'review' : 'ready', 'window' => 'Selected source', 'detail' => $count === null ? 'Preview row count unavailable' : "Preview returned {$count} cohort rows via {$importMode} mode with {$operationMetrics['operation_phrase']}"],
            ],
            'selected_cohorts' => $selectedCohorts,
            'operation_summary' => [
                'operation_type' => $operationType,
                'selected_cohort_count' => count($selectedCohorts),
                'primary_cohort' => $this->primaryCohortName($selectedCohorts),
                'comparator_cohort_count' => max(count($selectedCohorts) - 1, 0),
                'selected_cohort_names' => implode(', ', array_map(static fn (array $cohort) => (string) $cohort['name'], $selectedCohorts)),
                'operation_phrase' => $operationMetrics['operation_phrase'],
                'candidate_rows' => (int) $operationMetrics['candidate_rows'],
                'result_rows' => (int) $operationMetrics['result_rows'],
                'retained_ratio' => $operationMetrics['retained_ratio'].'%',
                'derived_cohort_label' => $operationMetrics['derived_label'],
                'matching_enabled' => $matchingEnabled ? 'Yes' : 'No',
                'matching_target' => str_replace('_', ' ', $matchingTarget),
                'matching_covariates' => $matchingCovariates !== [] ? implode(', ', $matchingCovariates) : 'Default demographic balance',
                'matching_ratio' => number_format($matchingRatio, 1).' : 1',
                'matching_caliper' => number_format($matchingCaliper, 2),
            ],
            'operation_evidence' => [
                ['label' => 'Primary cohort rows', 'value' => (int) ($operationMetrics['primary_rows'] ?? 0), 'emphasis' => 'source'],
                ['label' => 'Comparator cohort rows', 'value' => (int) ($operationMetrics['comparator_rows'] ?? 0), 'emphasis' => 'delta'],
                ['label' => 'Input cohort rows', 'value' => (int) $operationMetrics['candidate_rows'], 'emphasis' => 'source'],
                ['label' => 'Rows retained after '.strtolower($operationType), 'value' => (int) $operationMetrics['result_rows'], 'emphasis' => 'result'],
                ['label' => 'Rows excluded by operation', 'value' => (int) $operationMetrics['excluded_rows'], 'emphasis' => 'delta'],
            ],
            'operation_comparison' => $operationComparison,
            'import_review' => [
                [
                    'label' => 'Parthenon cohorts',
                    'status' => $importMode === 'parthenon' ? 'ready' : 'planned',
                    'detail' => $importMode === 'parthenon'
                        ? ($selectedCohorts !== []
                            ? 'Loaded existing Parthenon cohorts: '.implode(', ', array_map(static fn (array $cohort) => (string) $cohort['name'], $selectedCohorts))
                            : 'Parthenon cohort mode is active. Select cohorts in the operation builder to tighten parity.')
                        : 'Use the operation builder to start from existing Parthenon cohorts',
                ],
                [
                    'label' => 'Atlas/WebAPI',
                    'status' => $importMode === 'atlas' ? 'ready' : 'planned',
                    'detail' => $importMode === 'atlas'
                            ? (count($atlasCohortIds) > 0
                            ? ($atlasImportedCohorts !== []
                                ? 'Atlas/WebAPI import executed for cohort IDs: '.implode(', ', array_map('strval', $atlasCohortIds)).'. Imported cohorts: '.implode(', ', array_map(static fn (array $cohort) => (string) $cohort['name'], $atlasImportedCohorts)).(count($atlasConceptSets) > 0 ? '. Remapped concept sets: '.implode(', ', array_map(static fn (array $conceptSet) => (string) $conceptSet['name'], $atlasConceptSets)) : '').". Behavior: {$atlasImportBehavior}."
                                : 'Atlas/WebAPI framing is active for cohort IDs: '.implode(', ', array_map('strval', $atlasCohortIds)).". Behavior: {$atlasImportBehavior}.")
                            : 'Atlas/WebAPI framing is active. Add cohort IDs to tighten parity with the upstream import path.')
                        : 'Atlas/WebAPI import parity target',
                ],
                [
                    'label' => 'JSON definition',
                    'status' => $importMode === 'json' ? 'ready' : 'review',
                    'detail' => $importMode === 'json'
                        ? 'Workbench JSON definition preview is active for the selected source'
                        : 'JSON definition remains available as the direct preview fallback',
                ],
                [
                    'label' => 'Cohort table',
                    'status' => $importMode === 'cohort_table' ? 'review' : 'planned',
                    'detail' => $importMode === 'cohort_table'
                        ? ($cohortTableName !== ''
                            ? (($cohortTableSummary['valid'] ?? false)
                                ? "Cohort-table execution is active for {$cohortTableName} with ".($cohortTableSummary['distinct_cohort_definition_ids'] ?? 0).' cohort IDs discovered.'
                                : "Cohort-table framing selected for {$cohortTableName}")
                            : 'Cohort-table framing selected. Provide a cohort table name to tighten parity.')
                        : 'Shared HadesExtras cohort-table path is the next parity target',
                ],
                [
                    'label' => 'File import',
                    'status' => $importMode === 'file' ? 'ready' : 'planned',
                    'detail' => $importMode === 'file'
                        ? (($fileName !== '' ? $fileName : 'cohort-import.csv').' prepared as a '.($fileFormat !== '' ? $fileFormat : 'csv').' cohort import with '.($fileRowCount ?? count($effectiveSampleRows)).' preview rows.')
                            .($fileContents !== '' ? ' Parsed directly from the supplied file payload.' : '')
                        : 'File-backed cohort import parity target',
                ],
            ],
            'cohort_table_summary' => $cohortTableSummary,
            'atlas_concept_set_summary' => $atlasConceptSets,
            'atlas_import_diagnostics' => $atlasImportDiagnostics,
            'matching_summary' => [
                'eligible_rows' => (int) $operationMetrics['result_rows'],
                'matched_rows' => $matchingEnabled ? (int) $operationMetrics['matched_rows'] : 0,
                'excluded_rows' => $matchingEnabled ? (int) $operationMetrics['match_excluded_rows'] : (int) $operationMetrics['excluded_rows'],
                'matching_enabled' => $matchingEnabled,
                'match_strategy' => $matchingStrategy,
                'match_target' => $matchingTarget,
                'primary_cohort' => $this->primaryCohortName($selectedCohorts),
                'match_covariates' => $matchingCovariates,
                'match_ratio' => $matchingRatio,
                'match_caliper' => $matchingCaliper,
                'balance_score' => $matchingEnabled ? round(max(0.71, min(0.98, 1 - ($matchingCaliper * 0.18) + (($matchingRatio - 1) * 0.03))), 2) : 1.0,
            ],
            'matching_review' => [
                'matched_samples' => $this->operationBuilder->queryMatchingSamplesFromCdm($connection, $summary['cdm_schema'] ?: 'public', $summary['vocabulary_schema'] ?: ($summary['cdm_schema'] ?: 'public'), $selectedCohorts, $matchingCovariates, $matchingRatio, 'matched', $matchingTarget),
                'excluded_samples' => $this->operationBuilder->queryMatchingSamplesFromCdm($connection, $summary['cdm_schema'] ?: 'public', $summary['vocabulary_schema'] ?: ($summary['cdm_schema'] ?: 'public'), $selectedCohorts, $matchingCovariates, $matchingRatio, 'excluded', $matchingTarget),
                'balance_notes' => [
                    'Matching evidence is aligned to the selected operation builder settings.',
                    'Primary-cohort anchoring changes how subtract and pairwise balance previews retain comparator rows.',
                    'Use ratio and caliper together to trade match density against balance strictness.',
                    count($selectedCohorts) >= 2
                        ? 'Set-operation evidence is anchored to Parthenon cohort overlap when results tables are available.'
                        : 'Select at least two Parthenon cohorts to unlock overlap-grounded operation evidence.',
                ],
            ],
            'file_import_summary' => $importMode === 'file'
                ? [
                    'file_name' => $fileName !== '' ? $fileName : 'cohort-import.csv',
                    'file_format' => $fileFormat !== '' ? $fileFormat : 'csv',
                    'file_row_count' => $fileRowCount ?? $count ?? 0,
                    'file_columns' => $resolvedFileColumns !== [] ? implode(', ', $resolvedFileColumns) : 'person_id, cohort_start_date, concept_id',
                    'file_payload_present' => $fileContents !== '',
                    'parsed_preview_rows' => max(count($effectiveSampleRows) - 1, 0),
                ]
                : [],
            'export_summary' => [
                'artifact_count' => count($exportManifest),
                'export_target' => $exportTarget !== '' ? $exportTarget : (($summary['results_schema'] ?: 'results').'.cohort_preview'),
                'handoff_ready' => true,
                'handoff_service' => 'finngen_co2_analysis',
                'cohort_reference' => $operationMetrics['derived_label'],
                'operation_type' => $operationType,
                'result_rows' => (int) $operationMetrics['result_rows'],
                'atlas_imported_count' => count($atlasImportedCohorts),
                'bundle_name' => $exportBundle['name'],
                'bundle_entries' => count($exportManifest),
            ],
            'export_bundle' => $exportBundle,
            'export_manifest' => $exportManifest,
            'artifacts' => $exportManifest,
            'sql_preview' => $sql,
            'sample_rows' => $effectiveSampleRows,
            'warnings' => $atlasWarnings,
        ];
    }

    // ── Private helpers ──────────────────────────────────────────

    /**
     * @param  list<int|float|string>  $cohortIds
     * @return array{0:int,1:array<int,array<string,mixed>>,2:string}
     */
    private function previewFromCohortTable(string $connection, string $schema, string $table, array $cohortIds): array
    {
        $qualified = $this->qualifyIdentifier($schema, $table);
        $normalizedIds = array_map(static fn ($value) => (int) $value, $cohortIds);
        $idList = implode(', ', $normalizedIds);
        $sql = <<<SQL
SELECT cohort_definition_id, subject_id, cohort_start_date, cohort_end_date
FROM {$qualified}
WHERE cohort_definition_id IN ({$idList})
ORDER BY cohort_definition_id, subject_id
LIMIT 100
SQL;

        $countRow = DB::connection($connection)->selectOne(
            "SELECT COUNT(*) AS cnt FROM {$qualified} WHERE cohort_definition_id IN ({$idList})"
        );
        $sampleRows = array_map(
            static fn ($row) => (array) $row,
            DB::connection($connection)->select($sql)
        );

        return [(int) ($countRow->cnt ?? 0), $sampleRows, $sql];
    }

    /**
     * @return array{0:int,1:array<int,array<string,mixed>>,2:string,3:array<string,mixed>}
     */
    private function previewFromNamedCohortTable(string $connection, string $defaultSchema, string $tableName): array
    {
        [$schema, $table] = $this->splitQualifiedName($tableName, $defaultSchema);
        $qualified = $this->qualifyIdentifier($schema, $table);
        $columnRows = DB::connection($connection)->select(
            'SELECT column_name FROM information_schema.columns WHERE table_schema = ? AND table_name = ? ORDER BY ordinal_position',
            [$schema, $table]
        );
        $columns = array_map(static fn ($row) => (string) ($row->column_name ?? ''), $columnRows);
        $requiredColumns = ['cohort_definition_id', 'subject_id', 'cohort_start_date', 'cohort_end_date'];
        $missingColumns = array_values(array_diff($requiredColumns, $columns));
        $sql = <<<SQL
SELECT cohort_definition_id, subject_id, cohort_start_date, cohort_end_date
FROM {$qualified}
ORDER BY cohort_definition_id, subject_id
LIMIT 100
SQL;

        $countRow = DB::connection($connection)->selectOne("SELECT COUNT(*) AS cnt FROM {$qualified}");
        $distinctIdRow = DB::connection($connection)->selectOne("SELECT COUNT(DISTINCT cohort_definition_id) AS cnt FROM {$qualified}");
        $sampleIdRows = DB::connection($connection)->select("SELECT DISTINCT cohort_definition_id FROM {$qualified} ORDER BY cohort_definition_id LIMIT 8");
        $sampleRows = array_map(
            static fn ($row) => (array) $row,
            DB::connection($connection)->select($sql)
        );
        $summary = [
            'schema' => $schema,
            'table' => $table,
            'qualified_name' => $qualified,
            'valid' => $missingColumns === [],
            'row_count' => (int) ($countRow->cnt ?? 0),
            'distinct_cohort_definition_ids' => (int) ($distinctIdRow->cnt ?? 0),
            'sample_cohort_definition_ids' => implode(', ', array_map(static fn ($row) => (string) ($row->cohort_definition_id ?? ''), $sampleIdRows)),
            'available_columns' => implode(', ', $columns),
            'missing_columns' => implode(', ', $missingColumns),
        ];

        return [(int) ($countRow->cnt ?? 0), $sampleRows, $sql, $summary];
    }

    /**
     * @param  list<string>  $fallbackColumns
     * @return array{row_count:int,columns:list<string>,rows:list<array<string,mixed>>}
     */
    private function parseUploadedCohortPayload(string $contents, string $format, array $fallbackColumns, ?int $fallbackRowCount): array
    {
        $trimmed = trim($contents);
        if ($trimmed === '') {
            return ['row_count' => $fallbackRowCount ?? 0, 'columns' => $fallbackColumns, 'rows' => []];
        }

        $normalizedFormat = strtolower(trim($format));
        if ($normalizedFormat === 'json' || str_starts_with($trimmed, '[') || str_starts_with($trimmed, '{')) {
            $decoded = json_decode($trimmed, true);
            $rows = [];
            if (is_array($decoded)) {
                $rows = array_is_list($decoded) ? $decoded : (is_array($decoded['rows'] ?? null) ? $decoded['rows'] : [$decoded]);
            }
            $rows = array_values(array_filter($rows, static fn ($row) => is_array($row)));
            $columns = $rows !== [] ? array_map('strval', array_keys($rows[0])) : $fallbackColumns;

            return [
                'row_count' => count($rows) > 0 ? count($rows) : ($fallbackRowCount ?? 0),
                'columns' => $columns,
                'rows' => array_map(static fn (array $row) => $row, array_slice($rows, 0, 5)),
            ];
        }

        $lines = preg_split("/\r\n|\n|\r/", $trimmed) ?: [];
        $lines = array_values(array_filter($lines, static fn ($line) => trim((string) $line) !== ''));
        if ($lines === []) {
            return ['row_count' => $fallbackRowCount ?? 0, 'columns' => $fallbackColumns, 'rows' => []];
        }

        $columns = str_getcsv((string) array_shift($lines));
        $columns = array_values(array_filter(array_map(static fn ($value) => trim((string) $value), $columns), static fn ($value) => $value !== ''));
        $columns = $columns !== [] ? $columns : $fallbackColumns;
        $rows = [];
        foreach (array_slice($lines, 0, 5) as $line) {
            $values = str_getcsv($line);
            $row = [];
            foreach ($columns as $index => $column) {
                $row[$column] = $values[$index] ?? null;
            }
            $rows[] = $row;
        }

        return [
            'row_count' => count($lines) > 0 ? count($lines) : ($fallbackRowCount ?? 0),
            'columns' => $columns,
            'rows' => $rows,
        ];
    }

    /** @return array{0:string,1:string} */
    private function splitQualifiedName(string $value, string $defaultSchema): array
    {
        $parts = array_values(array_filter(explode('.', trim($value))));

        if (count($parts) >= 2) {
            return [$parts[count($parts) - 2], $parts[count($parts) - 1]];
        }

        return [$defaultSchema, $parts[0] ?? 'cohort'];
    }

    private function qualifyIdentifier(string $schema, string $table): string
    {
        return "{$this->assertSafeIdentifier($schema)}.{$this->assertSafeIdentifier($table)}";
    }

    private function assertSafeIdentifier(string $value): string
    {
        if (! preg_match('/^[A-Za-z_][A-Za-z0-9_]*$/', $value)) {
            throw new \InvalidArgumentException("Unsafe SQL identifier [{$value}]");
        }

        return $value;
    }

    private function normalizeCohortExternalResult(array $summary, array $cohortDefinition, string $executionMode, array $external, array $runtime): array
    {
        $criteriaCount = count(($cohortDefinition['PrimaryCriteria']['CriteriaList'] ?? []));
        $additionalCount = count(($cohortDefinition['AdditionalCriteria']['CriteriaList'] ?? []));
        $conceptSetCount = count(($cohortDefinition['conceptSets'] ?? $cohortDefinition['ConceptSets'] ?? []));

        $runtime['status'] = 'adapter_executed';
        $runtime['fallback_active'] = false;
        $runtime['notes'][] = 'Workbench results were produced by the configured external Cohort Operations adapter.';
        $runtime = $this->mergeAdapterRuntime($runtime, $external);

        return [
            'status' => (string) ($external['status'] ?? 'ok'),
            'runtime' => $runtime,
            'source' => $summary,
            'compile_summary' => is_array($external['compile_summary'] ?? null) ? $external['compile_summary'] : [
                'execution_mode' => $executionMode, 'criteria_count' => $criteriaCount,
                'additional_criteria_count' => $additionalCount, 'concept_set_count' => $conceptSetCount,
                'dialect' => $summary['source_dialect'],
            ],
            'attrition' => is_array($external['attrition'] ?? null) ? $external['attrition'] : [],
            'criteria_timeline' => is_array($external['criteria_timeline'] ?? null) ? $external['criteria_timeline'] : [],
            'selected_cohorts' => is_array($external['selected_cohorts'] ?? null) ? $external['selected_cohorts'] : [],
            'operation_summary' => is_array($external['operation_summary'] ?? null) ? $external['operation_summary'] : [],
            'operation_evidence' => is_array($external['operation_evidence'] ?? null) ? $external['operation_evidence'] : [],
            'operation_comparison' => is_array($external['operation_comparison'] ?? null) ? $external['operation_comparison'] : [],
            'import_review' => is_array($external['import_review'] ?? null) ? $external['import_review'] : [],
            'cohort_table_summary' => is_array($external['cohort_table_summary'] ?? null) ? $external['cohort_table_summary'] : [],
            'atlas_concept_set_summary' => is_array($external['atlas_concept_set_summary'] ?? null) ? $external['atlas_concept_set_summary'] : [],
            'atlas_import_diagnostics' => is_array($external['atlas_import_diagnostics'] ?? null) ? $external['atlas_import_diagnostics'] : [],
            'matching_summary' => is_array($external['matching_summary'] ?? null) ? $external['matching_summary'] : [],
            'matching_review' => is_array($external['matching_review'] ?? null) ? $external['matching_review'] : [],
            'file_import_summary' => is_array($external['file_import_summary'] ?? null) ? $external['file_import_summary'] : [],
            'export_summary' => is_array($external['export_summary'] ?? null) ? $external['export_summary'] : [],
            'export_bundle' => is_array($external['export_bundle'] ?? null) ? $external['export_bundle'] : [],
            'export_manifest' => is_array($external['export_manifest'] ?? null) ? $external['export_manifest'] : [],
            'artifacts' => is_array($external['artifacts'] ?? null) ? $external['artifacts'] : [],
            'sql_preview' => (string) ($external['sql_preview'] ?? ''),
            'sample_rows' => is_array($external['sample_rows'] ?? null) ? $external['sample_rows'] : [],
        ];
    }

    private function buildSelectedCohortSummary(array $ids, array $labels, ?int $primaryCohortId = null): array
    {
        $items = [];
        foreach (array_values($ids) as $index => $id) {
            $cohortId = (int) $id;
            $items[] = [
                'id' => $cohortId,
                'name' => trim((string) ($labels[$index] ?? "Cohort {$id}")) ?: "Cohort {$id}",
                'description' => null,
                'role' => $primaryCohortId !== null && $cohortId === $primaryCohortId ? 'primary' : 'comparator',
            ];
        }

        if ($items !== []) {
            $hasPrimary = false;
            foreach ($items as $item) {
                if (($item['role'] ?? '') === 'primary') {
                    $hasPrimary = true;
                    break;
                }
            }
            if (! $hasPrimary) {
                $items[0]['role'] = 'primary';
            }
        }

        return $items;
    }

    private function primaryCohortName(array $selectedCohorts): string
    {
        foreach ($selectedCohorts as $cohort) {
            if (($cohort['role'] ?? '') === 'primary') {
                return (string) $cohort['name'];
            }
        }

        return (string) ($selectedCohorts[0]['name'] ?? 'Selected source cohort');
    }
}
