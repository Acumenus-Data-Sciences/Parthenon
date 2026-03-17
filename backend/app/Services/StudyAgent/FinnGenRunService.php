<?php

namespace App\Services\StudyAgent;

use App\Models\App\FinnGenRun;
use App\Models\App\Source;
use App\Models\User;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

class FinnGenRunService
{
    /**
     * @param  array<string, mixed>  $requestPayload
     * @param  array<string, mixed>  $result
     */
    public function record(
        string $serviceName,
        Source $source,
        ?User $user,
        array $requestPayload,
        array $result,
    ): FinnGenRun {
        $artifacts = is_array($result['artifacts'] ?? null) ? $result['artifacts'] : [];

        return FinnGenRun::create([
            'service_name' => $serviceName,
            'status' => (string) ($result['status'] ?? 'ok'),
            'source_id' => $source->id,
            'submitted_by' => $user?->id,
            'source_snapshot' => [
                'source_id' => $source->id,
                'source_name' => $source->source_name,
                'source_key' => $source->source_key,
                'source_dialect' => $source->source_dialect,
            ],
            'request_payload' => $requestPayload,
            'result_payload' => $result,
            'runtime_payload' => is_array($result['runtime'] ?? null) ? $result['runtime'] : [],
            'artifact_index' => $artifacts,
            'submitted_at' => Carbon::now(),
            'completed_at' => Carbon::now(),
        ]);
    }

    /**
     * @return Collection<int, array<string, mixed>>
     */
    public function recent(?string $serviceName = null, ?int $sourceId = null, int $limit = 12): Collection
    {
        $query = FinnGenRun::query()
            ->with(['source:id,source_name,source_key,source_dialect', 'submittedBy:id,name'])
            ->latest('id');

        if ($serviceName) {
            $query->where('service_name', $serviceName);
        }

        if ($sourceId) {
            $query->where('source_id', $sourceId);
        }

        return $query
            ->limit($limit)
            ->get()
            ->map(function (FinnGenRun $run): array {
                return [
                    'id' => $run->id,
                    'service_name' => $run->service_name,
                    'status' => $run->status,
                    'source' => $run->source_snapshot ?? [],
                    'submitted_by' => $run->submittedBy?->name,
                    'submitted_at' => $run->submitted_at?->toIso8601String(),
                    'completed_at' => $run->completed_at?->toIso8601String(),
                    'runtime' => $run->runtime_payload ?? [],
                    'artifacts' => $run->artifact_index ?? [],
                    'summary' => $this->summaryFor($run),
                ];
            });
    }

    /**
     * @return array<string, mixed>
     */
    public function detail(int $runId): array
    {
        return $this->detailForModel($this->findModel($runId));
    }

    public function findModel(int $runId): FinnGenRun
    {
        $run = FinnGenRun::query()
            ->with(['source:id,source_name,source_key,source_dialect', 'submittedBy:id,name'])
            ->find($runId);

        if (! $run instanceof FinnGenRun) {
            throw (new ModelNotFoundException)->setModel(FinnGenRun::class, [$runId]);
        }

        return $run;
    }

    /**
     * @return array<string, mixed>
     */
    public function detailForModel(FinnGenRun $run): array
    {
        return [
            'id' => $run->id,
            'service_name' => $run->service_name,
            'status' => $run->status,
            'source' => $run->source_snapshot ?? [],
            'submitted_by' => $run->submittedBy?->name,
            'submitted_at' => $run->submitted_at?->toIso8601String(),
            'completed_at' => $run->completed_at?->toIso8601String(),
            'runtime' => $run->runtime_payload ?? [],
            'artifacts' => $run->artifact_index ?? [],
            'summary' => $this->summaryFor($run),
            'request_payload' => $run->request_payload ?? [],
            'result_payload' => $run->result_payload ?? [],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function exportBundle(int $runId): array
    {
        $run = $this->findModel($runId);
        $detail = $this->detailForModel($run);

        return [
            'run' => $detail,
            'exported_at' => Carbon::now()->toIso8601String(),
            'bundle_version' => 1,
            'replay_request' => $run->request_payload ?? [],
            'artifact_payloads' => $this->artifactPayloadsFor($run),
            'bundle_metadata' => $this->bundleMetadataFor($run, $detail),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function summaryFor(FinnGenRun $run): array
    {
        $result = $run->result_payload ?? [];

        return match ($run->service_name) {
            'finngen_cohort_operations' => [
                'criteria_count' => data_get($result, 'compile_summary.criteria_count'),
                'cohort_count' => data_get($result, 'compile_summary.cohort_count'),
            ],
            'finngen_co2_analysis' => [
                'module_key' => data_get($result, 'analysis_summary.module_key'),
                'outcome_name' => data_get($result, 'analysis_summary.outcome_name'),
            ],
            'finngen_hades_extras' => [
                'package_name' => data_get($result, 'render_summary.package_name'),
                'render_target' => data_get($result, 'render_summary.render_target'),
            ],
            'finngen_romopapi' => [
                'schema_scope' => data_get($result, 'metadata_summary.schema_scope'),
                'table_count_estimate' => data_get($result, 'metadata_summary.table_count_estimate'),
            ],
            default => [],
        };
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function artifactPayloadsFor(FinnGenRun $run): array
    {
        $request = is_array($run->request_payload ?? null) ? $run->request_payload : [];
        $result = is_array($run->result_payload ?? null) ? $run->result_payload : [];

        if ($run->service_name === 'finngen_cohort_operations') {
            $manifest = is_array($result['export_manifest'] ?? null)
                ? $result['export_manifest']
                : (is_array($result['artifacts'] ?? null) ? $result['artifacts'] : []);

            return array_map(function (array $artifact) use ($request, $result): array {
                $name = (string) ($artifact['name'] ?? 'artifact.json');
                $type = (string) ($artifact['type'] ?? 'json');

                return match ($name) {
                    'preview.sql', 'adapter-preview.sql' => [
                        'name' => $name,
                        'download_name' => $name,
                        'mime_type' => 'text/sql',
                        'content' => (string) ($result['sql_preview'] ?? ''),
                    ],
                    'sample_rows.json', 'adapter-attrition.json' => [
                        'name' => $name,
                        'download_name' => $name,
                        'mime_type' => 'application/json',
                        'content' => json_encode(
                            $name === 'sample_rows.json' ? ($result['sample_rows'] ?? []) : ($result['attrition'] ?? []),
                            JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES
                        ) ?: '[]',
                    ],
                    'operation_builder.json', 'operation-builder.json' => [
                        'name' => $name,
                        'download_name' => $name,
                        'mime_type' => 'application/json',
                        'content' => json_encode([
                            'import_mode' => $request['import_mode'] ?? null,
                            'operation_type' => $request['operation_type'] ?? null,
                            'selected_cohort_ids' => $request['selected_cohort_ids'] ?? [],
                            'selected_cohort_labels' => $request['selected_cohort_labels'] ?? [],
                            'primary_cohort_id' => $request['primary_cohort_id'] ?? null,
                            'matching_enabled' => $request['matching_enabled'] ?? null,
                            'matching_strategy' => $request['matching_strategy'] ?? null,
                            'matching_target' => $request['matching_target'] ?? null,
                            'matching_covariates' => $request['matching_covariates'] ?? [],
                            'matching_ratio' => $request['matching_ratio'] ?? null,
                            'matching_caliper' => $request['matching_caliper'] ?? null,
                            'file_name' => $request['file_name'] ?? null,
                            'file_format' => $request['file_format'] ?? null,
                            'file_row_count' => $request['file_row_count'] ?? null,
                            'file_columns' => $request['file_columns'] ?? [],
                        ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) ?: '{}',
                    ],
                    'handoff.json', 'adapter-handoff.json' => [
                        'name' => $name,
                        'download_name' => $name,
                        'mime_type' => 'application/json',
                        'content' => json_encode([
                            'export_summary' => $result['export_summary'] ?? [],
                            'operation_summary' => $result['operation_summary'] ?? [],
                            'selected_cohorts' => $result['selected_cohorts'] ?? [],
                        ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) ?: '{}',
                    ],
                    'atlas-import-diagnostics.json' => [
                        'name' => $name,
                        'download_name' => $name,
                        'mime_type' => 'application/json',
                        'content' => json_encode($result['atlas_import_diagnostics'] ?? [], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) ?: '{}',
                    ],
                    default => [
                        'name' => $name,
                        'download_name' => $name,
                        'mime_type' => $this->mimeTypeForArtifact($type),
                        'content' => $this->artifactFallbackContent($name, $type, $request, $result),
                    ],
                };
            }, $manifest);
        }

        if ($run->service_name === 'finngen_co2_analysis') {
            $artifacts = is_array($result['analysis_artifacts'] ?? null)
                ? $result['analysis_artifacts']
                : (is_array($result['artifacts'] ?? null) ? $result['artifacts'] : []);

            return array_map(function (array $artifact) use ($request, $result): array {
                $name = (string) ($artifact['name'] ?? 'artifact.json');

                return match ($name) {
                    'analysis_summary.json' => [
                        'name' => $name,
                        'download_name' => $name,
                        'mime_type' => 'application/json',
                        'content' => json_encode($result['analysis_summary'] ?? [], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) ?: '{}',
                    ],
                    'module_validation.json' => [
                        'name' => $name,
                        'download_name' => $name,
                        'mime_type' => 'application/json',
                        'content' => json_encode($result['module_validation'] ?? [], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) ?: '[]',
                    ],
                    'result_validation.json' => [
                        'name' => $name,
                        'download_name' => $name,
                        'mime_type' => 'application/json',
                        'content' => json_encode($result['result_validation'] ?? [], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) ?: '[]',
                    ],
                    'result_table.json' => [
                        'name' => $name,
                        'download_name' => $name,
                        'mime_type' => 'application/json',
                        'content' => json_encode($result['result_table'] ?? [], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) ?: '[]',
                    ],
                    'execution_timeline.json' => [
                        'name' => $name,
                        'download_name' => $name,
                        'mime_type' => 'application/json',
                        'content' => json_encode($result['execution_timeline'] ?? [], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) ?: '[]',
                    ],
                    default => [
                        'name' => $name,
                        'download_name' => $name,
                        'mime_type' => 'application/json',
                        'content' => json_encode([
                            'request_payload' => $request,
                            'summary' => $result['analysis_summary'] ?? [],
                        ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) ?: '{}',
                    ],
                };
            }, $artifacts);
        }

        if ($run->service_name === 'finngen_hades_extras') {
            $manifest = is_array($result['package_manifest'] ?? null)
                ? $result['package_manifest']
                : [];

            return array_map(function (array $artifact) use ($request, $result): array {
                $path = (string) ($artifact['path'] ?? 'artifact.json');
                $kind = (string) ($artifact['kind'] ?? 'json');

                return match (pathinfo($path, PATHINFO_EXTENSION)) {
                    'sql' => [
                        'name' => $path,
                        'download_name' => basename($path),
                        'mime_type' => 'text/sql',
                        'content' => (string) data_get($result, 'sql_preview.rendered', ''),
                    ],
                    'yaml' => [
                        'name' => $path,
                        'download_name' => basename($path),
                        'mime_type' => 'application/yaml',
                        'content' => (string) ($result['config_yaml'] ?? ''),
                    ],
                    'json' => [
                        'name' => $path,
                        'download_name' => basename($path),
                        'mime_type' => 'application/json',
                        'content' => json_encode([
                            'package_setup' => $result['package_setup'] ?? [],
                            'config_summary' => $result['config_summary'] ?? [],
                            'helper_logs' => $result['helper_logs'] ?? [],
                        ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) ?: '{}',
                    ],
                    'csv' => [
                        'name' => $path,
                        'download_name' => basename($path),
                        'mime_type' => 'text/csv',
                        'content' => "cohort_table,config_profile,artifact_mode\n".implode(',', [
                            (string) data_get($result, 'package_setup.cohort_table', ''),
                            (string) data_get($result, 'package_setup.config_profile', ''),
                            (string) data_get($result, 'package_setup.artifact_mode', ''),
                        ])."\n",
                    ],
                    default => [
                        'name' => $path,
                        'download_name' => basename($path),
                        'mime_type' => $kind === 'r' ? 'text/plain' : 'application/json',
                        'content' => json_encode([
                            'request_payload' => $request,
                            'artifact' => $artifact,
                            'sql_lineage' => $result['sql_lineage'] ?? [],
                            'cohort_table_lifecycle' => $result['cohort_table_lifecycle'] ?? [],
                        ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) ?: '{}',
                    ],
                };
            }, $manifest);
        }

        if ($run->service_name === 'finngen_romopapi') {
            $artifacts = is_array($result['report_artifacts'] ?? null)
                ? $result['report_artifacts']
                : [];
            $reportContent = is_array($result['report_content'] ?? null)
                ? $result['report_content']
                : [];
            $manifest = is_array($reportContent['manifest'] ?? null)
                ? $reportContent['manifest']
                : [];
            $codeCounts = is_array($result['code_counts'] ?? null)
                ? $result['code_counts']
                : [];

            return array_map(function (array $artifact) use ($request, $result, $reportContent, $manifest, $codeCounts): array {
                $name = (string) ($artifact['name'] ?? 'artifact.json');

                return match (pathinfo($name, PATHINFO_EXTENSION)) {
                    'md' => [
                        'name' => $name,
                        'download_name' => $name,
                        'mime_type' => 'text/markdown',
                        'content' => (string) ($reportContent['markdown'] ?? ''),
                    ],
                    'html' => [
                        'name' => $name,
                        'download_name' => $name,
                        'mime_type' => 'text/html',
                        'content' => (string) ($reportContent['html'] ?? ''),
                    ],
                    'csv' => [
                        'name' => $name,
                        'download_name' => $name,
                        'mime_type' => 'text/csv',
                        'content' => $this->romopapiCodeCountsCsv($codeCounts),
                    ],
                    'json' => [
                        'name' => $name,
                        'download_name' => $name,
                        'mime_type' => 'application/json',
                        'content' => json_encode([
                            'request_envelope' => $result['request_envelope'] ?? [],
                            'execution_summary' => $result['execution_summary'] ?? [],
                            'manifest' => $manifest,
                            'report_bundle' => $result['report_bundle'] ?? [],
                            'query_controls' => $result['query_controls'] ?? [],
                            'request_payload' => $request,
                        ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) ?: '{}',
                    ],
                    default => [
                        'name' => $name,
                        'download_name' => $name,
                        'mime_type' => 'application/json',
                        'content' => json_encode([
                            'request_payload' => $request,
                            'result_profile' => $result['result_profile'] ?? [],
                        ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) ?: '{}',
                    ],
                };
            }, $artifacts);
        }

        return [];
    }

    /**
     * @param  array<string, mixed>  $detail
     * @return array<string, mixed>
     */
    private function bundleMetadataFor(FinnGenRun $run, array $detail): array
    {
        $result = is_array($run->result_payload ?? null) ? $run->result_payload : [];

        return [
            'service_name' => $run->service_name,
            'run_id' => $run->id,
            'source_key' => data_get($detail, 'source.source_key'),
            'bundle_name' => data_get($result, 'export_bundle.name') ?? data_get($result, 'report_bundle.name') ?? data_get($result, 'package_bundle.name'),
            'bundle_format' => data_get($result, 'export_bundle.format') ?? data_get($result, 'report_bundle.format') ?? data_get($result, 'package_bundle.format'),
            'artifact_count' => count($this->artifactPayloadsFor($run)),
            'replay_ready' => true,
            'replay_import_mode' => data_get($run->request_payload ?? [], 'import_mode'),
        ];
    }

    private function mimeTypeForArtifact(string $type): string
    {
        return match ($type) {
            'sql' => 'text/sql',
            'csv' => 'text/csv',
            default => 'application/json',
        };
    }

    /**
     * @param  array<string, mixed>  $request
     * @param  array<string, mixed>  $result
     */
    private function artifactFallbackContent(string $name, string $type, array $request, array $result): string
    {
        if (($request['import_mode'] ?? null) === 'file' && $name === ($request['file_name'] ?? null)) {
            $columns = is_array($request['file_columns'] ?? null) ? $request['file_columns'] : ['person_id', 'cohort_start_date', 'concept_id'];
            $sampleRow = is_array(($result['sample_rows'][1] ?? null)) ? $result['sample_rows'][1] : [];
            $originalContents = (string) ($request['file_contents'] ?? '');
            if ($type === 'csv') {
                if ($originalContents !== '') {
                    return $originalContents;
                }
                $header = implode(',', array_map('strval', $columns));
                $row = implode(',', array_map(
                    static fn ($column) => (string) data_get($sampleRow, (string) $column, ''),
                    $columns
                ));

                return $header."\n".$row."\n";
            }

            return json_encode([
                'file_name' => $request['file_name'] ?? 'cohort-import.csv',
                'file_format' => $request['file_format'] ?? 'csv',
                'file_row_count' => $request['file_row_count'] ?? null,
                'file_columns' => $columns,
                'sample_row' => $sampleRow,
            ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) ?: '{}';
        }

        return json_encode([
            'name' => $name,
            'type' => $type,
            'summary' => data_get($result, 'export_summary'),
        ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) ?: '{}';
    }

    /**
     * @param  list<array<string, mixed>>  $rows
     */
    private function romopapiCodeCountsCsv(array $rows): string
    {
        if ($rows === []) {
            return "concept,domain,stratum,count\n";
        }

        $lines = ['concept,domain,stratum,count'];
        foreach ($rows as $row) {
            $lines[] = implode(',', [
                $this->csvField((string) ($row['concept'] ?? '')),
                $this->csvField((string) ($row['domain'] ?? '')),
                $this->csvField((string) ($row['stratum'] ?? '')),
                (string) ($row['count'] ?? ''),
            ]);
        }

        return implode("\n", $lines)."\n";
    }

    private function csvField(string $value): string
    {
        if (str_contains($value, ',') || str_contains($value, '"') || str_contains($value, "\n")) {
            return '"'.str_replace('"', '""', $value).'"';
        }

        return $value;
    }
}
