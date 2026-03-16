<?php

namespace App\Services\Workbench;

class __CLASS_NAME__Service
{
    public function run(?string $sourceKey, array $payload): array
    {
        return [
            'status' => 'ok',
            'runtime' => [
                'status' => 'ready',
                'adapter_mode' => '__MODE__',
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
                'tool_id' => '__TOOL_ID__',
                'display_name' => '__DISPLAY_NAME__',
                'request_keys' => array_keys($payload),
            ],
            'panels' => [
                [
                    'id' => 'summary',
                    'title' => '__DISPLAY_NAME__ Summary',
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
