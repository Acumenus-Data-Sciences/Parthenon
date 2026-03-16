<?php

namespace App\Services\StudyAgent;

use Illuminate\Support\Facades\File;

class CommunityWorkbenchSdkDemoService
{
    public function serviceEntry(): array
    {
        return [
            'name' => 'community_variant_browser',
            'endpoint' => '/flows/community/community-variant-browser',
            'description' => 'Optional sample tool generated from the Community Workbench SDK.',
            'mcp_tools' => ['community_variant_browser_catalog'],
            'input' => ['source_key', 'payload'],
            'output' => ['summary', 'panels', 'artifacts'],
            'validation' => [
                'generated sample scaffold; replace placeholder logic before production use',
                'review and wire backend/frontend integration deliberately',
            ],
            'ui_hints' => [
                'title' => 'Community Variant Browser',
                'summary' => 'Sample optional tool generated from the Community Workbench SDK and promoted into Workbench discovery.',
                'accent' => 'slate',
                'repository' => null,
                'workspace' => 'genomics-workbench',
            ],
            'implemented' => true,
            'source' => 'parthenon',
        ];
    }

    public function payload(): array
    {
        return [
            'service_descriptor' => [
                'service_name' => 'community_variant_browser',
                'display_name' => 'Community Variant Browser',
                'description' => 'Explore cohort-scoped genomic variants through a Parthenon workbench generated from the Community Workbench SDK.',
                'version' => '0.1.0',
                'mode' => 'external-adapter',
                'enabled' => true,
                'healthy' => true,
                'unavailability_reason' => null,
                'ui_hints' => [
                    'title' => 'Community Variant Browser',
                    'summary' => 'Explore cohort-scoped genomic variants through a Parthenon workbench generated from the Community Workbench SDK.',
                    'accent' => 'slate',
                    'workspace' => 'genomics-workbench',
                    'repository' => null,
                ],
                'capabilities' => [
                    'source_scoped' => true,
                    'replay_supported' => true,
                    'export_supported' => true,
                    'write_operations' => false,
                ],
            ],
            'result_envelope' => [
                'status' => 'ok',
                'runtime' => [
                    'status' => 'ready',
                    'adapter_mode' => 'external-adapter',
                    'fallback_active' => false,
                    'upstream_ready' => true,
                    'dependency_issues' => [],
                    'notes' => [
                        'External adapter is healthy.',
                        'Result payload is normalized for the workbench UI.',
                    ],
                    'timings' => [
                        'adapter_ms' => 142,
                        'normalization_ms' => 18,
                    ],
                    'last_error' => null,
                ],
                'source' => [
                    'source_key' => 'acumenus',
                ],
                'summary' => [
                    'tool_id' => 'community_variant_browser',
                    'display_name' => 'Community Variant Browser',
                    'variant_count' => 127,
                    'cohort_subject_count' => 42,
                ],
                'panels' => [
                    [
                        'id' => 'summary',
                        'title' => 'Variant Summary',
                        'kind' => 'summary',
                        'data' => [
                            'top_gene' => 'EGFR',
                            'top_consequence' => 'missense_variant',
                        ],
                    ],
                ],
                'artifacts' => [
                    'artifacts' => [
                        [
                            'id' => 'variant_table_csv',
                            'label' => 'Variant Table',
                            'kind' => 'table',
                            'content_type' => 'text/csv',
                            'path' => '/exports/community-variant-browser/run-101/variants.csv',
                            'summary' => 'Exported variant table for the selected cohort.',
                            'downloadable' => true,
                            'previewable' => false,
                        ],
                    ],
                ],
                'warnings' => [],
                'next_actions' => [
                    'Inspect the top genes panel.',
                    'Export the cohort-scoped variant table.',
                ],
            ],
            'generated_sample' => [
                'tool_id' => 'community_variant_browser',
                'display_name' => 'Community Variant Browser',
                'path' => 'community-workbench-sdk/generated-samples/community_variant_browser',
                'files' => $this->generatedSampleFiles(),
                'readme_excerpt' => $this->readmeExcerpt(),
            ],
        ];
    }

    /**
     * @return list<string>
     */
    private function generatedSampleFiles(): array
    {
        $sampleDir = base_path('community-workbench-sdk/generated-samples/community_variant_browser');

        if (! File::isDirectory($sampleDir)) {
            return [];
        }

        return collect(File::allFiles($sampleDir))
            ->map(fn (\SplFileInfo $file) => ltrim(str_replace($sampleDir, '', $file->getPathname()), DIRECTORY_SEPARATOR))
            ->sort()
            ->values()
            ->all();
    }

    private function readmeExcerpt(): string
    {
        $readmePath = base_path('community-workbench-sdk/generated-samples/community_variant_browser/README.md');

        if (! File::exists($readmePath)) {
            return '';
        }

        $contents = trim((string) File::get($readmePath));
        $lines = preg_split("/\r\n|\n|\r/", $contents) ?: [];

        return implode("\n", array_slice($lines, 0, 12));
    }
}
