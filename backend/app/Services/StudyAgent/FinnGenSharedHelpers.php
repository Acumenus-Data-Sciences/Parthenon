<?php

namespace App\Services\StudyAgent;

use App\Enums\DaimonType;
use App\Models\App\Source;

trait FinnGenSharedHelpers
{
    /**
     * @return array{source_id:int,source_name:string,source_key:string,source_dialect:string,cdm_schema:?string,results_schema:?string,vocabulary_schema:?string}
     */
    protected function sourceSummary(Source $source): array
    {
        $source->loadMissing('daimons');

        return [
            'source_id' => $source->id,
            'source_name' => $source->source_name,
            'source_key' => $source->source_key,
            'source_dialect' => $source->source_dialect,
            'cdm_schema' => $source->getTableQualifier(DaimonType::CDM),
            'results_schema' => $source->getTableQualifier(DaimonType::Results),
            'vocabulary_schema' => $source->getTableQualifier(DaimonType::Vocabulary),
        ];
    }

    /**
     * @param  array<string, bool>  $capabilities
     * @return array<string, mixed>
     */
    protected function runtimeMetadata(string $service, array $capabilities = []): array
    {
        $config = $this->externalAdapters->configuration($service);
        $command = $config['command'];
        $baseUrl = $config['base_url'];
        $mode = $config['mode'];
        $modeLabel = match ($mode) {
            'external_command' => 'External Command Adapter',
            'external_service' => 'External Service Adapter',
            default => 'Parthenon Native Preview',
        };

        return [
            'service' => $service,
            'mode' => $mode,
            'mode_label' => $modeLabel,
            'adapter_configured' => filled($command) || filled($baseUrl),
            'adapter_command' => $command,
            'adapter_base_url' => $baseUrl,
            'fallback_active' => $mode === 'parthenon_native',
            'status' => $mode === 'parthenon_native' ? 'preview' : 'adapter_ready',
            'capabilities' => $capabilities,
            'adapter_label' => null,
            'upstream_repo_path' => null,
            'upstream_package' => null,
            'upstream_ready' => null,
            'compatibility_mode' => null,
            'missing_dependencies' => [],
            'notes' => $mode === 'parthenon_native'
                ? [
                    'Running against the selected OHDSI source with Parthenon-native preview logic.',
                    'Configure FINNGEN_*_COMMAND or FINNGEN_*_BASE_URL to promote this tool to an external adapter.',
                ]
                : [
                    'External adapter configuration is present for this FINNGEN service.',
                    'Workbench visuals remain available while adapter execution is being finalized.',
                ],
        ];
    }

    /**
     * @param  array<string, mixed>  $runtime
     * @param  array<string, mixed>  $external
     * @return array<string, mixed>
     */
    protected function mergeAdapterRuntime(array $runtime, array $external): array
    {
        $adapter = is_array($external['adapter'] ?? null) ? $external['adapter'] : [];

        if ($adapter === []) {
            return $runtime;
        }

        $runtime['adapter_label'] = $adapter['engine'] ?? $adapter['handler'] ?? $adapter['service'] ?? null;
        $runtime['upstream_repo_path'] = $adapter['repo_path'] ?? null;
        $runtime['upstream_package'] = $adapter['package_name'] ?? null;
        $runtime['upstream_ready'] = isset($adapter['upstream_ready']) ? (bool) $adapter['upstream_ready'] : null;
        $runtime['compatibility_mode'] = isset($adapter['compatibility_mode']) ? (bool) $adapter['compatibility_mode'] : null;
        $runtime['missing_dependencies'] = is_array($adapter['missing_dependencies'] ?? null)
            ? array_values(array_map(static fn ($dep) => (string) $dep, $adapter['missing_dependencies']))
            : [];

        if (is_array($adapter['notes'] ?? null)) {
            $runtime['notes'] = array_values(array_unique([
                ...$runtime['notes'],
                ...array_map(static fn ($note) => (string) $note, $adapter['notes']),
            ]));
        }

        return $runtime;
    }
}
