<?php

declare(strict_types=1);

$service = $argv[1] ?? '';
$payload = json_decode(stream_get_contents(STDIN), true);

if (! is_array($payload)) {
    fwrite(STDERR, "Expected JSON payload on STDIN.\n");
    exit(1);
}

$source = is_array($payload['source'] ?? null) ? $payload['source'] : [];
$sourceKey = (string) ($source['source_key'] ?? 'unknown');
$dialect = (string) ($source['source_dialect'] ?? 'postgresql');
$serviceLabel = match ($service) {
    'cohort_operations' => 'Cohort Operations',
    'co2_analysis' => 'CO2 Analysis',
    'hades_extras' => 'HADES Extras',
    'romopapi' => 'ROMOPAPI',
    default => '',
};

if ($serviceLabel === '') {
    fwrite(STDERR, "Unknown FINNGEN service: {$service}\n");
    exit(1);
}

$result = match ($service) {
    'cohort_operations' => buildCohortOperations($payload, $sourceKey, $dialect),
    'co2_analysis' => buildCo2Analysis($payload, $sourceKey),
    'hades_extras' => buildHadesExtras($payload, $sourceKey, $dialect),
    'romopapi' => buildRomopapi($payload, $sourceKey, $dialect),
};

$result['adapter'] = [
    'service' => $serviceLabel,
    'mode' => 'local_external_command',
    'handler' => basename(__FILE__),
];

echo json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES).PHP_EOL;

function buildCohortOperations(array $payload, string $sourceKey, string $dialect): array
{
    $cohortDefinition = is_array($payload['cohort_definition'] ?? null) ? $payload['cohort_definition'] : [];
    $criteriaCount = count($cohortDefinition['PrimaryCriteria']['CriteriaList'] ?? []);
    $additionalCount = count($cohortDefinition['AdditionalCriteria']['CriteriaList'] ?? []);
    $conceptSetCount = count($cohortDefinition['conceptSets'] ?? $cohortDefinition['ConceptSets'] ?? []);
    $cohortCount = max(24, ($criteriaCount * 17) + ($conceptSetCount * 9));

    return [
        'status' => 'ok',
        'compile_summary' => [
            'execution_mode' => (string) ($payload['execution_mode'] ?? 'preview'),
            'criteria_count' => $criteriaCount,
            'additional_criteria_count' => $additionalCount,
            'concept_set_count' => $conceptSetCount,
            'cohort_count' => $cohortCount,
            'dialect' => $dialect,
            'source_key' => $sourceKey,
        ],
        'attrition' => [
            ['label' => 'Compiled criteria', 'count' => max(1, $criteriaCount), 'percent' => 100],
            ['label' => 'Eligibility windows', 'count' => max(1, $criteriaCount + $additionalCount), 'percent' => 86],
            ['label' => 'Adapter cohort rows', 'count' => $cohortCount, 'percent' => 42],
        ],
        'criteria_timeline' => [
            ['step' => 1, 'title' => 'Definition parse', 'status' => 'ready', 'window' => 'Adapter input', 'detail' => "Parsed {$criteriaCount} primary criteria"],
            ['step' => 2, 'title' => 'Concept binding', 'status' => 'ready', 'window' => 'Adapter compile', 'detail' => "Bound {$conceptSetCount} concept sets"],
            ['step' => 3, 'title' => 'Execution preview', 'status' => 'ready', 'window' => 'Acumenus source', 'detail' => "Estimated {$cohortCount} cohort rows on {$sourceKey}"],
        ],
        'artifacts' => [
            ['name' => 'adapter-preview.sql', 'type' => 'sql', 'summary' => 'External adapter SQL preview'],
            ['name' => 'adapter-attrition.json', 'type' => 'json', 'summary' => 'External adapter attrition summary'],
        ],
        'sql_preview' => "SELECT person_id\nFROM {$sourceKey}.cohort_preview\nLIMIT 100;",
        'sample_rows' => [
            ['person_id' => 1001, 'index_date' => '2025-01-15'],
            ['person_id' => 1044, 'index_date' => '2025-02-03'],
        ],
    ];
}

function buildCo2Analysis(array $payload, string $sourceKey): array
{
    $moduleKey = (string) ($payload['module_key'] ?? 'comparative_effectiveness');
    $cohortLabel = (string) ($payload['cohort_label'] ?? 'Selected source cohort');
    $outcomeName = (string) ($payload['outcome_name'] ?? 'Condition burden');

    return [
        'status' => 'ok',
        'analysis_summary' => [
            'module_key' => $moduleKey,
            'cohort_label' => $cohortLabel,
            'outcome_name' => $outcomeName,
            'source_key' => $sourceKey,
            'person_count' => 18452,
        ],
        'module_gallery' => [
            ['name' => $moduleKey, 'family' => 'external adapter', 'status' => 'selected'],
            ['name' => 'incidence_screen', 'family' => 'screening', 'status' => 'available'],
            ['name' => 'covariate_balance', 'family' => 'diagnostics', 'status' => 'available'],
        ],
        'forest_plot' => [
            ['label' => 'Primary outcome', 'effect' => 0.62, 'lower' => 0.54, 'upper' => 0.71],
            ['label' => 'Negative control', 'effect' => 0.97, 'lower' => 0.88, 'upper' => 1.08],
            ['label' => 'Sensitivity model', 'effect' => 0.68, 'lower' => 0.6, 'upper' => 0.78],
        ],
        'heatmap' => [
            ['label' => 'Age 18-44', 'value' => 0.21],
            ['label' => 'Age 45-64', 'value' => 0.48],
            ['label' => 'Age 65+', 'value' => 0.31],
        ],
        'top_signals' => [
            ['label' => 'Type 2 diabetes mellitus', 'count' => 812],
            ['label' => 'Heart failure', 'count' => 403],
            ['label' => 'Acute kidney injury', 'count' => 177],
        ],
        'utilization_trend' => [
            ['label' => '2025-10', 'count' => 88],
            ['label' => '2025-11', 'count' => 95],
            ['label' => '2025-12', 'count' => 101],
            ['label' => '2026-01', 'count' => 110],
            ['label' => '2026-02', 'count' => 118],
            ['label' => '2026-03', 'count' => 124],
        ],
        'execution_timeline' => [
            ['stage' => 'Adapter bootstrap', 'status' => 'ready', 'duration_ms' => 38],
            ['stage' => 'Cohort extraction', 'status' => 'ready', 'duration_ms' => 86],
            ['stage' => 'Outcome modeling', 'status' => 'ready', 'duration_ms' => 142],
            ['stage' => 'Visualization payload build', 'status' => 'ready', 'duration_ms' => 27],
        ],
    ];
}

function buildHadesExtras(array $payload, string $sourceKey, string $dialect): array
{
    $template = (string) ($payload['sql_template'] ?? 'SELECT 1');
    $packageName = (string) ($payload['package_name'] ?? 'AcumenusFinnGenPackage');

    return [
        'status' => 'ok',
        'render_summary' => [
            'package_name' => $packageName,
            'render_target' => (string) ($payload['render_target'] ?? $dialect),
            'source_key' => $sourceKey,
            'adapter' => 'local-script',
        ],
        'sql_preview' => [
            'template' => $template,
            'rendered' => str_replace('@cdm_schema', "{$sourceKey}.cdm", $template),
        ],
        'artifact_pipeline' => [
            ['name' => 'Adapter SQL render', 'status' => 'ready'],
            ['name' => 'Manifest build', 'status' => 'ready'],
            ['name' => 'Explain capture', 'status' => 'ready'],
        ],
        'artifacts' => [
            ['name' => "{$packageName}/inst/sql/{$dialect}/analysis.sql", 'type' => 'sql'],
            ['name' => "{$packageName}/inst/cohorts/cohort.csv", 'type' => 'csv'],
        ],
        'explain_plan' => [
            ['QUERY PLAN' => 'Result  (cost=0.00..0.01 rows=1 width=4)'],
            ['QUERY PLAN' => 'Adapter render path selected'],
        ],
    ];
}

function buildRomopapi(array $payload, string $sourceKey, string $dialect): array
{
    $schema = (string) ($payload['schema_scope'] ?? 'cdm');
    $template = (string) ($payload['query_template'] ?? 'person -> observation_period');

    return [
        'status' => 'ok',
        'metadata_summary' => [
            'schema_scope' => $schema,
            'source_key' => $sourceKey,
            'dialect' => $dialect,
            'table_count_estimate' => 6,
        ],
        'schema_nodes' => [
            ['name' => 'person', 'group' => 'table', 'connections' => 8, 'estimated_rows' => 18452],
            ['name' => 'observation_period', 'group' => 'table', 'connections' => 4, 'estimated_rows' => 18452],
            ['name' => 'condition_occurrence', 'group' => 'table', 'connections' => 9, 'estimated_rows' => 92411],
        ],
        'lineage_trace' => [
            ['step' => 1, 'label' => 'person', 'detail' => 'Primary patient anchor'],
            ['step' => 2, 'label' => 'observation_period', 'detail' => 'Time-at-risk join'],
            ['step' => 3, 'label' => 'condition_occurrence', 'detail' => 'Outcome domain join'],
        ],
        'query_plan' => [
            'template' => $template,
            'joins' => 2,
            'filters' => 1,
            'estimated_rows' => 18452,
        ],
        'result_profile' => [
            ['label' => 'Schema', 'value' => $schema],
            ['label' => 'Dialect', 'value' => $dialect],
            ['label' => 'Adapter source', 'value' => $sourceKey],
        ],
    ];
}
