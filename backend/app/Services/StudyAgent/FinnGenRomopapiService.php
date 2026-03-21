<?php

namespace App\Services\StudyAgent;

use App\Models\App\Source;
use App\Services\Database\DynamicConnectionFactory;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class FinnGenRomopapiService
{
    use FinnGenSharedHelpers;

    public function __construct(
        private readonly DynamicConnectionFactory $connections,
        private readonly FinnGenExternalAdapterService $externalAdapters,
    ) {}

    public function romopapi(Source $source, string $schemaScope = '', string $queryTemplate = '', array $options = []): array
    {
        $summary = $this->sourceSummary($source);
        $connection = $this->connections->connectionName($source);
        $schema = $schemaScope !== '' ? $schemaScope : ($summary['cdm_schema'] ?: 'public');
        $conceptDomain = trim((string) ($options['concept_domain'] ?? ''));
        $stratifyBy = trim((string) ($options['stratify_by'] ?? ''));
        $resultLimit = max(1, min(500, (int) ($options['result_limit'] ?? 25)));
        $lineageDepth = max(1, min(12, (int) ($options['lineage_depth'] ?? 3)));
        $requestMethod = trim((string) ($options['request_method'] ?? ''));
        $responseFormat = trim((string) ($options['response_format'] ?? ''));
        $cacheMode = trim((string) ($options['cache_mode'] ?? ''));
        $reportFormat = trim((string) ($options['report_format'] ?? ''));
        $runtime = $this->runtimeMetadata('romopapi', [
            'supports_external_adapter' => true,
            'supports_source_preview' => true,
            'supports_metadata_introspection' => true,
        ]);

        try {
            $external = $this->externalAdapters->execute('romopapi', [
                'source' => $summary, 'schema_scope' => $schema, 'query_template' => $queryTemplate,
                'concept_domain' => $conceptDomain, 'stratify_by' => $stratifyBy,
                'result_limit' => $resultLimit, 'lineage_depth' => $lineageDepth,
                'request_method' => $requestMethod, 'response_format' => $responseFormat,
                'cache_mode' => $cacheMode, 'report_format' => $reportFormat,
            ]);

            if (is_array($external) && $external !== []) {
                return $this->normalizeRomopapiExternalResult($summary, $schema, $queryTemplate, $options, $external, $runtime);
            }
        } catch (\Throwable $e) {
            $runtime['status'] = 'adapter_failed';
            $runtime['fallback_active'] = true;
            $runtime['last_error'] = $e->getMessage();
            $runtime['notes'][] = 'External adapter execution failed. Falling back to Parthenon-native metadata inspection.';
        }

        $tables = array_map(static fn ($row) => (array) $row, DB::connection($connection)->select("
            SELECT t.table_name AS name, COUNT(c.column_name) AS column_count
            FROM information_schema.tables t
            LEFT JOIN information_schema.columns c ON c.table_schema = t.table_schema AND c.table_name = t.table_name
            WHERE t.table_schema = ? AND t.table_type = 'BASE TABLE'
            GROUP BY t.table_name ORDER BY t.table_name LIMIT 12
        ", [$schema]));

        $estimatedRows = [];
        if (($summary['source_dialect'] ?? '') === 'postgresql') {
            $estimatedRows = array_map(static fn ($row) => (array) $row, DB::connection($connection)->select("
                SELECT c.relname AS table_name, GREATEST(c.reltuples::bigint, 0) AS estimated_rows
                FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
                WHERE n.nspname = ? AND c.relkind = 'r' ORDER BY c.relname LIMIT 12
            ", [$schema]));
        }

        $schemaNodes = array_map(function (array $table) use ($estimatedRows) {
            $estimate = collect($estimatedRows)->firstWhere('table_name', $table['name']);

            return ['name' => (string) $table['name'], 'group' => 'table', 'connections' => (int) $table['column_count'], 'estimated_rows' => (int) ($estimate['estimated_rows'] ?? 0)];
        }, $tables);
        $queryControls = [
            'schema_scope' => $schema,
            'concept_domain' => $conceptDomain !== '' ? $conceptDomain : 'all',
            'stratify_by' => $stratifyBy !== '' ? $stratifyBy : 'overall',
            'result_limit' => $resultLimit,
            'lineage_depth' => $lineageDepth,
            'request_method' => $requestMethod !== '' ? strtoupper($requestMethod) : 'POST',
            'response_format' => $responseFormat !== '' ? $responseFormat : 'json',
            'cache_mode' => $cacheMode !== '' ? $cacheMode : 'memoized_preview',
            'report_format' => $reportFormat !== '' ? $reportFormat : 'markdown_html',
        ];
        $requestEnvelope = $this->buildRequestEnvelope($queryControls, $queryTemplate);
        $cacheKey = sprintf('finngen:romopapi:%s:%s', $summary['source_key'], sha1(json_encode([$requestEnvelope, $queryControls], JSON_THROW_ON_ERROR)));
        $cachePayload = Cache::get($cacheKey);
        if ($queryControls['cache_mode'] === 'memoized_preview' && is_array($cachePayload['result'] ?? null)) {
            $cachedResult = $cachePayload['result'];
            $cachedResult['runtime'] = $runtime;
            $cachedResult['cache_status'] = $this->buildCacheStatus($queryControls, $cacheKey, true, (string) ($cachePayload['generated_at'] ?? ''));
            if (is_array($cachedResult['execution_summary'] ?? null)) {
                $cachedResult['execution_summary']['cache_hit'] = true;
                $cachedResult['execution_summary']['cache_generated_at'] = (string) ($cachePayload['generated_at'] ?? '');
            }

            return $cachedResult;
        }
        $limitedNodes = array_slice($schemaNodes, 0, $resultLimit);
        $lineageNodes = array_slice($schemaNodes, 0, $lineageDepth);
        $executionSummary = [
            'cache_hit' => false, 'request_method' => $queryControls['request_method'],
            'response_format' => $queryControls['response_format'], 'cache_mode' => $queryControls['cache_mode'],
            'report_format' => $queryControls['report_format'],
            'estimated_latency_ms' => max(24, 12 + (count($limitedNodes) * 4) + ($lineageDepth * 6)),
            'api_surface' => '/romopapi/v1/code-counts',
        ];
        $endpointManifest = [
            ['name' => 'code_counts', 'method' => (string) $queryControls['request_method'], 'path' => '/romopapi/v1/code-counts', 'summary' => 'Concept and code count retrieval'],
            ['name' => 'hierarchy', 'method' => 'GET', 'path' => '/romopapi/v1/hierarchy', 'summary' => 'Concept lineage traversal'],
            ['name' => 'report', 'method' => 'POST', 'path' => '/romopapi/v1/report', 'summary' => 'Narrative report generation'],
        ];
        $reportManifest = [
            ['name' => "{$summary['source_key']}-{$schema}-report.md", 'kind' => 'markdown', 'summary' => 'Narrative ROMOPAPI report'],
            ['name' => "{$summary['source_key']}-{$schema}-report.html", 'kind' => 'html', 'summary' => 'Rendered ROMOPAPI report'],
            ['name' => "{$summary['source_key']}-{$schema}-counts.csv", 'kind' => 'csv', 'summary' => 'Code-count style export'],
            ['name' => "{$summary['source_key']}-{$schema}-manifest.json", 'kind' => 'json', 'summary' => 'API request and artifact manifest'],
        ];
        $cdmSchemaName = $summary['cdm_schema'] ?: 'public';
        $vocabSchemaName = $summary['vocabulary_schema'] ?: $cdmSchemaName;
        $codeCounts = $this->queryCdmCodeCounts($connection, $cdmSchemaName, $vocabSchemaName, $conceptDomain, $resultLimit);
        $stratifiedCounts = $this->queryCdmStratifiedCounts($connection, $cdmSchemaName, $vocabSchemaName, $stratifyBy, $resultLimit);

        $result = [
            'status' => 'ok', 'runtime' => $runtime, 'source' => $summary,
            'query_controls' => $queryControls, 'request_envelope' => $requestEnvelope,
            'execution_summary' => $executionSummary, 'endpoint_manifest' => $endpointManifest,
            'cache_status' => $this->buildCacheStatus($queryControls, $cacheKey, false, now()->toIso8601String()),
            'metadata_summary' => [
                'schema_scope' => $schema, 'source_key' => $summary['source_key'],
                'dialect' => $summary['source_dialect'], 'table_count_estimate' => count($limitedNodes),
                'concept_domain' => $queryControls['concept_domain'], 'stratify_by' => $queryControls['stratify_by'],
                'code_count_rows' => count($codeCounts), 'stratified_count_rows' => count($stratifiedCounts),
            ],
            'schema_nodes' => $limitedNodes,
            'concept_hierarchy' => $this->queryCdmConceptHierarchy($connection, $vocabSchemaName, $conceptDomain, $lineageDepth),
            'mermaid_graph' => $this->buildMermaidGraph($limitedNodes),
            'lineage_trace' => array_map(
                static fn (array $node, int $index) => ['step' => $index + 1, 'label' => (string) ($node['name'] ?? 'table'), 'detail' => $index === 0 ? 'Lead table in selected schema scope' : 'Follow-on join candidate in projected lineage'],
                $lineageNodes, array_keys($lineageNodes),
            ),
            'query_plan' => [
                'template' => $queryTemplate !== '' ? $queryTemplate : 'person -> condition_occurrence -> observation_period',
                'joins' => max(count($lineageNodes) - 1, 0),
                'filters' => $conceptDomain !== '' && $conceptDomain !== 'all' ? 2 : 1,
                'estimated_rows' => $limitedNodes[0]['estimated_rows'] ?? 0,
                'lineage_depth' => $lineageDepth, 'result_limit' => $resultLimit,
                'request_method' => $queryControls['request_method'], 'response_format' => $queryControls['response_format'],
            ],
            'code_counts' => $codeCounts, 'stratified_counts' => $stratifiedCounts,
            'report_content' => [
                'markdown' => $this->buildMarkdownReport($summary, $schema, $queryTemplate, $limitedNodes, $queryControls, $codeCounts),
                'html' => $this->buildHtmlReport($summary, $schema, $queryTemplate, $limitedNodes, $queryControls),
                'format' => (string) $queryControls['report_format'], 'manifest' => $reportManifest,
            ],
            'report_bundle' => [
                'name' => "{$summary['source_key']}-{$schema}-romopapi-report-bundle.zip", 'format' => 'zip',
                'entries' => array_values(array_map(static fn (array $entry) => (string) $entry['name'], $reportManifest)),
                'download_name' => "{$summary['source_key']}-{$schema}-romopapi-report-bundle.json",
            ],
            'report_artifacts' => [
                ['name' => "{$summary['source_key']}-{$schema}-report.md", 'type' => 'markdown', 'summary' => 'Narrative ROMOPAPI report'],
                ['name' => "{$summary['source_key']}-{$schema}-report.html", 'type' => 'html', 'summary' => 'Rendered ROMOPAPI report'],
                ['name' => "{$summary['source_key']}-{$schema}-counts.csv", 'type' => 'csv', 'summary' => 'Code-count style export'],
                ['name' => "{$summary['source_key']}-{$schema}-manifest.json", 'type' => 'json', 'summary' => 'API request and artifact manifest'],
            ],
            'result_profile' => [
                ['label' => 'Schema', 'value' => $schema],
                ['label' => 'Tables surfaced', 'value' => (string) count($limitedNodes)],
                ['label' => 'Dialect', 'value' => (string) ($summary['source_dialect'] ?? 'unknown')],
                ['label' => 'Concept domain', 'value' => $queryControls['concept_domain']],
                ['label' => 'Stratify by', 'value' => $queryControls['stratify_by']],
            ],
        ];

        if ($queryControls['cache_mode'] !== 'bypass') {
            Cache::put($cacheKey, ['result' => $result, 'generated_at' => now()->toIso8601String()], now()->addMinutes(15));
        }

        return $result;
    }

    // ── Private helpers ──────────────────────────────────────────

    private function buildRequestEnvelope(array $queryControls, string $queryTemplate): array
    {
        return [
            'method' => (string) ($queryControls['request_method'] ?? 'POST'),
            'path' => '/romopapi/v1/code-counts',
            'query' => [
                'schema_scope' => (string) ($queryControls['schema_scope'] ?? ''),
                'concept_domain' => (string) ($queryControls['concept_domain'] ?? 'all'),
                'stratify_by' => (string) ($queryControls['stratify_by'] ?? 'overall'),
                'result_limit' => (int) ($queryControls['result_limit'] ?? 25),
                'lineage_depth' => (int) ($queryControls['lineage_depth'] ?? 3),
                'response_format' => (string) ($queryControls['response_format'] ?? 'json'),
                'report_format' => (string) ($queryControls['report_format'] ?? 'markdown_html'),
            ],
            'body' => [
                'query_template' => $queryTemplate !== '' ? $queryTemplate : 'person -> condition_occurrence -> observation_period',
                'cache_mode' => (string) ($queryControls['cache_mode'] ?? 'memoized_preview'),
            ],
        ];
    }

    private function buildCacheStatus(array $queryControls, string $cacheKey, bool $cacheHit, string $generatedAt): array
    {
        return [
            ['label' => 'Cache mode', 'value' => (string) ($queryControls['cache_mode'] ?? 'memoized_preview'), 'detail' => 'Selected query execution cache strategy'],
            ['label' => 'Cache key', 'value' => $cacheKey, 'detail' => 'Memoization key for this request envelope'],
            ['label' => 'Cache status', 'value' => $cacheHit ? 'hit' : ((string) ($queryControls['cache_mode'] ?? '') === 'bypass' ? 'bypassed' : 'generated'), 'detail' => $cacheHit ? 'Served from cached ROMOPAPI preview output' : 'Preview output was generated for this request'],
            ['label' => 'Freshness window', 'value' => (string) ($queryControls['cache_mode'] ?? '') === 'bypass' ? 'none' : '15m', 'detail' => 'Preview freshness target'],
            ['label' => 'Generated at', 'value' => $generatedAt !== '' ? $generatedAt : 'current request', 'detail' => 'Timestamp for the current or cached result'],
        ];
    }

    private function buildMarkdownReport(array $summary, string $schema, string $queryTemplate, array $schemaNodes, array $queryControls, array $codeCounts): string
    {
        $rows = array_slice($schemaNodes, 0, 5);
        $tableBody = array_map(static fn (array $node) => sprintf('- `%s`: connections=%d, estimated_rows=%d', (string) $node['name'], (int) ($node['connections'] ?? 0), (int) ($node['estimated_rows'] ?? 0)), $rows);
        $countBody = array_map(static fn (array $c) => sprintf('- %s (%s): %s', (string) $c['concept'], (string) ($c['domain'] ?? 'unknown'), number_format((int) ($c['count'] ?? 0))), array_slice($codeCounts, 0, 10));

        $sections = ['# ROMOPAPI Report', '', '- Source: '.($summary['source_key'] ?? 'unknown'), "- Schema: {$schema}", '- Dialect: '.($summary['source_dialect'] ?? 'unknown'), '- Query template: '.($queryTemplate !== '' ? $queryTemplate : 'person -> condition_occurrence -> observation_period'), '- Concept domain: '.((string) ($queryControls['concept_domain'] ?? 'all')), '- Stratify by: '.((string) ($queryControls['stratify_by'] ?? 'overall')), '- Result limit: '.((string) ($queryControls['result_limit'] ?? 25)), '- Lineage depth: '.((string) ($queryControls['lineage_depth'] ?? 3)), '', '## Surfaced Tables', ...$tableBody];
        if ($countBody !== []) {
            $sections[] = '';
            $sections[] = '## Top Concept Counts';
            array_push($sections, ...$countBody);
        }

        return implode("\n", $sections);
    }

    private function buildHtmlReport(array $summary, string $schema, string $queryTemplate, array $schemaNodes, array $queryControls): string
    {
        $rows = implode('', array_map(static fn (array $node) => sprintf('<tr><td>%s</td><td>%d</td><td>%d</td></tr>', e((string) $node['name']), (int) ($node['connections'] ?? 0), (int) ($node['estimated_rows'] ?? 0)), array_slice($schemaNodes, 0, 5)));
        $sourceKey = e((string) ($summary['source_key'] ?? 'unknown'));
        $dialect = e((string) ($summary['source_dialect'] ?? 'unknown'));
        $schemaName = e($schema);
        $template = e($queryTemplate !== '' ? $queryTemplate : 'person -> condition_occurrence -> observation_period');
        $conceptDomain = e((string) ($queryControls['concept_domain'] ?? 'all'));
        $stratifyBy = e((string) ($queryControls['stratify_by'] ?? 'overall'));
        $resultLimit = e((string) ($queryControls['result_limit'] ?? 25));
        $lineageDepth = e((string) ($queryControls['lineage_depth'] ?? 3));

        return <<<HTML
<html>
  <body style="font-family: ui-sans-serif, system-ui; background:#111318; color:#F0EDE8; padding:24px;">
    <h1 style="margin:0 0 12px;">ROMOPAPI Report</h1>
    <p>Source: {$sourceKey} · Schema: {$schemaName} · Dialect: {$dialect}</p>
    <p>Query template: {$template}</p>
    <p>Concept domain: {$conceptDomain} · Stratify by: {$stratifyBy} · Result limit: {$resultLimit} · Lineage depth: {$lineageDepth}</p>
    <table style="width:100%; border-collapse:collapse; margin-top:16px;">
      <thead>
        <tr><th style="text-align:left; border-bottom:1px solid #333; padding:8px;">Table</th><th style="text-align:left; border-bottom:1px solid #333; padding:8px;">Connections</th><th style="text-align:left; border-bottom:1px solid #333; padding:8px;">Estimated rows</th></tr>
      </thead>
      <tbody>{$rows}</tbody>
    </table>
  </body>
</html>
HTML;
    }

    private function queryCdmCodeCounts(string $connection, string $cdmSchema, string $vocabSchema, string $conceptDomain, int $resultLimit): array
    {
        $domainTables = [
            'Condition' => ['table' => 'condition_occurrence', 'concept_col' => 'condition_concept_id'],
            'Drug' => ['table' => 'drug_exposure', 'concept_col' => 'drug_concept_id'],
            'Measurement' => ['table' => 'measurement', 'concept_col' => 'measurement_concept_id'],
            'Procedure' => ['table' => 'procedure_occurrence', 'concept_col' => 'procedure_concept_id'],
            'Observation' => ['table' => 'observation', 'concept_col' => 'observation_concept_id'],
        ];
        $domains = $conceptDomain !== '' && $conceptDomain !== 'all' && isset($domainTables[$conceptDomain]) ? [$conceptDomain => $domainTables[$conceptDomain]] : array_slice($domainTables, 0, 3);
        $results = [];

        foreach ($domains as $domain => $mapping) {
            try {
                $rows = DB::connection($connection)->select("
                    SELECT c.concept_name AS concept, COUNT(*) AS cnt, c.domain_id AS domain
                    FROM {$cdmSchema}.{$mapping['table']} t
                    JOIN {$vocabSchema}.concept c ON c.concept_id = t.{$mapping['concept_col']}
                    WHERE c.concept_name IS NOT NULL AND c.concept_name != ''
                    GROUP BY c.concept_name, c.domain_id ORDER BY cnt DESC LIMIT ?
                ", [$resultLimit]);
                foreach ($rows as $row) {
                    $r = (array) $row;
                    $results[] = ['concept' => (string) $r['concept'], 'count' => (int) $r['cnt'], 'domain' => (string) ($r['domain'] ?? $domain), 'stratum' => 'overall'];
                }
            } catch (\Throwable) {
            }
        }
        usort($results, static fn (array $a, array $b) => $b['count'] <=> $a['count']);

        return array_slice($results, 0, $resultLimit);
    }

    private function queryCdmStratifiedCounts(string $connection, string $cdmSchema, string $vocabSchema, string $stratifyBy, int $resultLimit): array
    {
        try {
            $rows = match ($stratifyBy) {
                'sex' => DB::connection($connection)->select("SELECT COALESCE(c.concept_name, 'Unknown') AS label, COUNT(*) AS cnt FROM {$cdmSchema}.person p LEFT JOIN {$vocabSchema}.concept c ON c.concept_id = p.gender_concept_id GROUP BY c.concept_name ORDER BY cnt DESC LIMIT ?", [$resultLimit]),
                'age_band' => DB::connection($connection)->select("SELECT CONCAT(FLOOR((EXTRACT(YEAR FROM CURRENT_DATE) - p.year_of_birth) / 10) * 10, '-', FLOOR((EXTRACT(YEAR FROM CURRENT_DATE) - p.year_of_birth) / 10) * 10 + 9) AS label, COUNT(*) AS cnt FROM {$cdmSchema}.person p WHERE p.year_of_birth IS NOT NULL GROUP BY FLOOR((EXTRACT(YEAR FROM CURRENT_DATE) - p.year_of_birth) / 10) ORDER BY FLOOR((EXTRACT(YEAR FROM CURRENT_DATE) - p.year_of_birth) / 10) LIMIT ?", [$resultLimit]),
                'care_site' => DB::connection($connection)->select("SELECT COALESCE(cs.care_site_name, 'Unknown') AS label, COUNT(*) AS cnt FROM {$cdmSchema}.person p LEFT JOIN {$cdmSchema}.care_site cs ON cs.care_site_id = p.care_site_id GROUP BY cs.care_site_name ORDER BY cnt DESC LIMIT ?", [$resultLimit]),
                default => [],
            };
            if ($rows === []) {
                return [];
            }
            $total = array_sum(array_map(static fn ($r) => (int) ((array) $r)['cnt'], $rows));

            return array_map(static function ($row) use ($total) {
                $r = (array) $row;
                $count = (int) $r['cnt'];

                return ['label' => (string) $r['label'], 'count' => $count, 'percent' => $total > 0 ? round($count / $total, 4) : null];
            }, $rows);
        } catch (\Throwable) {
            return [];
        }
    }

    private function queryCdmConceptHierarchy(string $connection, string $vocabSchema, string $conceptDomain, int $depth): array
    {
        try {
            $domainFilter = $conceptDomain !== '' && $conceptDomain !== 'all' ? 'AND c1.domain_id = '.DB::connection($connection)->getPdo()->quote($conceptDomain) : '';
            $rows = DB::connection($connection)->select("
                SELECT c1.concept_name AS ancestor, c2.concept_name AS descendant, ca.min_levels_of_separation AS min_levels, ca.max_levels_of_separation AS max_levels
                FROM {$vocabSchema}.concept_ancestor ca
                JOIN {$vocabSchema}.concept c1 ON c1.concept_id = ca.ancestor_concept_id
                JOIN {$vocabSchema}.concept c2 ON c2.concept_id = ca.descendant_concept_id
                WHERE ca.min_levels_of_separation > 0 AND ca.min_levels_of_separation <= ? {$domainFilter}
                AND c1.concept_name IS NOT NULL AND c2.concept_name IS NOT NULL
                ORDER BY ca.min_levels_of_separation, c1.concept_name LIMIT 25
            ", [$depth]);

            return array_map(static fn ($row) => ['ancestor' => (string) ((array) $row)['ancestor'], 'descendant' => (string) ((array) $row)['descendant'], 'min_levels' => (int) ((array) $row)['min_levels'], 'max_levels' => (int) ((array) $row)['max_levels']], $rows);
        } catch (\Throwable) {
            return [];
        }
    }

    private function buildMermaidGraph(array $schemaNodes): string
    {
        if ($schemaNodes === []) {
            return '';
        }
        $lines = ['graph LR'];
        $nodeIds = [];
        foreach ($schemaNodes as $index => $node) {
            $name = (string) ($node['name'] ?? "table_{$index}");
            $id = preg_replace('/[^a-zA-Z0-9_]/', '_', $name);
            $nodeIds[] = $id;
            $rows = (int) ($node['estimated_rows'] ?? 0);
            $label = $rows > 0 ? "{$name}\\n({$rows} rows)" : $name;
            $lines[] = "    {$id}[\"{$label}\"]";
        }
        for ($i = 0; $i < count($nodeIds) - 1; $i++) {
            $lines[] = "    {$nodeIds[$i]} --> {$nodeIds[$i + 1]}";
        }
        $personId = null;
        foreach ($nodeIds as $id) {
            if (str_contains(strtolower($id), 'person')) {
                $personId = $id;
                break;
            }
        }
        if ($personId !== null) {
            foreach ($nodeIds as $id) {
                if ($id !== $personId && (str_contains(strtolower($id), 'occurrence') || str_contains(strtolower($id), 'exposure') || str_contains(strtolower($id), 'measurement'))) {
                    $lines[] = "    {$personId} --> {$id}";
                }
            }
        }

        return implode("\n", $lines);
    }

    private function normalizeRomopapiExternalResult(array $summary, string $schema, string $queryTemplate, array $options, array $external, array $runtime): array
    {
        $runtime['status'] = 'adapter_executed';
        $runtime['fallback_active'] = false;
        $runtime['notes'][] = 'Workbench results were produced by the configured external ROMOPAPI adapter.';
        $runtime = $this->mergeAdapterRuntime($runtime, $external);

        $defaultControls = ['schema_scope' => $schema, 'concept_domain' => (string) ($options['concept_domain'] ?? 'all'), 'stratify_by' => (string) ($options['stratify_by'] ?? 'overall'), 'result_limit' => (int) ($options['result_limit'] ?? 25), 'lineage_depth' => (int) ($options['lineage_depth'] ?? 3), 'request_method' => strtoupper((string) ($options['request_method'] ?? 'POST')), 'response_format' => (string) ($options['response_format'] ?? 'json'), 'cache_mode' => (string) ($options['cache_mode'] ?? 'memoized_preview'), 'report_format' => (string) ($options['report_format'] ?? 'markdown_html')];

        return [
            'status' => (string) ($external['status'] ?? 'ok'), 'runtime' => $runtime, 'source' => $summary,
            'query_controls' => is_array($external['query_controls'] ?? null) ? $external['query_controls'] : $defaultControls,
            'request_envelope' => is_array($external['request_envelope'] ?? null) ? $external['request_envelope'] : $this->buildRequestEnvelope($defaultControls, $queryTemplate),
            'execution_summary' => is_array($external['execution_summary'] ?? null) ? $external['execution_summary'] : [],
            'endpoint_manifest' => is_array($external['endpoint_manifest'] ?? null) ? $external['endpoint_manifest'] : [],
            'cache_status' => is_array($external['cache_status'] ?? null) ? $external['cache_status'] : [],
            'metadata_summary' => is_array($external['metadata_summary'] ?? null) ? $external['metadata_summary'] : ['schema_scope' => $schema, 'source_key' => $summary['source_key'], 'dialect' => $summary['source_dialect']],
            'schema_nodes' => is_array($external['schema_nodes'] ?? null) ? $external['schema_nodes'] : [],
            'lineage_trace' => is_array($external['lineage_trace'] ?? null) ? $external['lineage_trace'] : [],
            'query_plan' => is_array($external['query_plan'] ?? null) ? $external['query_plan'] : ['template' => $queryTemplate],
            'code_counts' => is_array($external['code_counts'] ?? null) ? $external['code_counts'] : [],
            'stratified_counts' => is_array($external['stratified_counts'] ?? null) ? $external['stratified_counts'] : [],
            'report_content' => is_array($external['report_content'] ?? null) ? $external['report_content'] : [],
            'report_bundle' => is_array($external['report_bundle'] ?? null) ? $external['report_bundle'] : [],
            'report_artifacts' => is_array($external['report_artifacts'] ?? null) ? $external['report_artifacts'] : [],
            'result_profile' => is_array($external['result_profile'] ?? null) ? $external['result_profile'] : [],
        ];
    }
}
