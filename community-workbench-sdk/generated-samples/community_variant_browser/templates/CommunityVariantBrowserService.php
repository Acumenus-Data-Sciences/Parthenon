<?php

namespace App\Services\Workbench;

class CommunityVariantBrowserService
{
    public function run(?string $sourceKey, array $payload): array
    {
        return [
            'status' => 'ok',
            'runtime' => [
                'status' => 'ready',
                'adapter_mode' => 'external-adapter',
                'fallback_active' => false,
                'upstream_ready' => true,
                'dependency_issues' => [],
                'notes' => [
                    'Generated starter payload. Replace with domain-specific orchestration.',
                ],
                'last_error' => null,
            ],
            'source' => $sourceKey !== null ? ['source_key' => $sourceKey] : null,
            'summary' => [
                'tool_id' => 'community_variant_browser',
                'display_name' => 'Community Variant Browser',
                'request_keys' => array_keys($payload),
            ],
            'panels' => [
                [
                    'id' => 'summary',
                    'title' => 'Community Variant Browser Summary',
                    'kind' => 'summary',
                    'data' => [
                        'message' => 'Replace this panel with real tool output.',
                    ],
                ],
            ],
            'artifacts' => [
                'artifacts' => [],
            ],
            'warnings' => [],
            'next_actions' => [
                'Implement adapter execution or native logic.',
                'Replace placeholder panel payloads.',
                'Add persisted run support if the tool needs replay or export.',
            ],
        ];
    }
}
