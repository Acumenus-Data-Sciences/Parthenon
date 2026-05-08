<?php

declare(strict_types=1);

namespace App\Services\Templates;

use App\Models\App\TemplateRun;

/**
 * Adapts upstream parthenon-templates payloads (Kubernetes-style
 * {apiVersion, kind, metadata, spec}) into the flat shape the SPA expects.
 *
 * Keeping this in PHP means the registry can evolve its internal shape
 * without breaking the SPA — the controller stays the single source of
 * truth for the public contract.
 */
final class TemplatePresenter
{
    /**
     * @param  array<string,mixed>  $summary
     * @return array<string,mixed>
     */
    public static function summary(array $summary): array
    {
        // Upstream summary is already mostly flat (id, name, version, …)
        // but does not include `description`, which the SPA's TemplateCard
        // optionally renders. Preserve nullable `description` when present
        // (e.g. when summary is derived from a full manifest).
        return [
            'id' => (string) ($summary['id'] ?? ''),
            'name' => (string) ($summary['name'] ?? ''),
            'version' => (string) ($summary['version'] ?? ''),
            'description' => $summary['description'] ?? '',
            'category' => (string) ($summary['category'] ?? ''),
            'cdm_versions' => array_values((array) ($summary['cdm_versions'] ?? [])),
            'tags' => array_values((array) ($summary['tags'] ?? [])),
            'singleton' => (bool) ($summary['singleton'] ?? false),
        ];
    }

    /**
     * @param  array<string,mixed>  $manifest  Upstream {apiVersion, kind, metadata, spec} payload.
     * @return array<string,mixed> Flat manifest matching SPA TemplateManifest type.
     */
    public static function manifest(array $manifest): array
    {
        $metadata = is_array($manifest['metadata'] ?? null) ? $manifest['metadata'] : [];
        $spec = is_array($manifest['spec'] ?? null) ? $manifest['spec'] : [];

        $parameters = is_array($spec['parameters'] ?? null) ? $spec['parameters'] : [];
        $nodes = is_array($spec['nodes'] ?? null) ? $spec['nodes'] : [];
        $postConditions = is_array($spec['post_conditions'] ?? null) ? $spec['post_conditions'] : [];

        return [
            'id' => (string) ($metadata['id'] ?? ''),
            'name' => (string) ($metadata['name'] ?? ''),
            'version' => (string) ($metadata['version'] ?? ''),
            'description' => (string) ($metadata['description'] ?? ''),
            'category' => (string) ($metadata['category'] ?? ''),
            'tags' => array_values((array) ($metadata['tags'] ?? [])),
            'cdm_versions' => array_values((array) ($metadata['cdm_versions'] ?? [])),
            'singleton' => (bool) ($metadata['singleton'] ?? false),
            'parameters_schema' => self::normalizeParametersSchema($parameters),
            'nodes' => self::normalizeNodes($nodes),
            'post_conditions' => array_values($postConditions),
        ];
    }

    /**
     * @return array<string,mixed>
     */
    public static function run(TemplateRun $run): array
    {
        return [
            'id' => $run->id,
            'template_id' => $run->template_id,
            'template_version' => $run->template_version,
            'parameters' => $run->parameters ?? [],
            'status' => $run->status,
            'progress' => (float) ($run->progress ?? 0.0),
            'current_node' => $run->current_node,
            'prefect_run_id' => $run->prefect_run_id,
            'error_message' => $run->error_message,
            'post_conditions' => $run->post_conditions ?? [],
            'artifacts_path' => $run->artifacts_path,
            'submitted_by' => $run->submitted_by,
            'submitted_at' => optional($run->submitted_at)->toIso8601String(),
            'started_at' => optional($run->started_at)->toIso8601String(),
            'finished_at' => optional($run->finished_at)->toIso8601String(),
        ];
    }

    /**
     * Normalize log lines from the upstream registry's `{lines: [...]}`
     * into the SPA's TemplateRunLog[] shape.
     *
     * Upstream lines may use `ts` for the timestamp; SPA uses `timestamp`.
     *
     * @param  array<int,array<string,mixed>>  $lines
     * @return array<int,array<string,mixed>>
     */
    public static function logLines(array $lines): array
    {
        $out = [];
        foreach ($lines as $line) {
            if (! is_array($line)) {
                continue;
            }
            $out[] = [
                'timestamp' => (string) ($line['timestamp'] ?? $line['ts'] ?? ''),
                'node_id' => $line['node_id'] ?? null,
                'level' => (string) ($line['level'] ?? 'info'),
                'message' => (string) ($line['message'] ?? ''),
            ];
        }

        return $out;
    }

    /**
     * Normalize artifact entries from upstream `{artifacts: [...]}` into the
     * SPA's TemplateRunArtifact[] shape (size_bytes, signed_url, content_type).
     *
     * @param  array<int,array<string,mixed>>  $artifacts
     * @return array<int,array<string,mixed>>
     */
    public static function artifacts(array $artifacts): array
    {
        $out = [];
        foreach ($artifacts as $a) {
            if (! is_array($a)) {
                continue;
            }
            $out[] = [
                'name' => (string) ($a['name'] ?? ''),
                'size_bytes' => (int) ($a['size_bytes'] ?? $a['size'] ?? 0),
                'signed_url' => (string) ($a['signed_url'] ?? $a['url'] ?? ''),
                'content_type' => (string) ($a['content_type'] ?? 'application/octet-stream'),
            ];
        }

        return $out;
    }

    /**
     * @param  array<string,mixed>  $parameters  Upstream JSON-Schema-style fragment.
     * @return array<string,mixed>
     */
    private static function normalizeParametersSchema(array $parameters): array
    {
        return [
            'type' => (string) ($parameters['type'] ?? 'object'),
            'properties' => is_array($parameters['properties'] ?? null) ? $parameters['properties'] : [],
            'required' => array_values((array) ($parameters['required'] ?? [])),
        ];
    }

    /**
     * Upstream nodes use `node_id` + `type` + optional `inputs`/`outputs`.
     * SPA TemplateNode wants `id` + `kind` + `inputs[]` + `outputs[]`.
     *
     * @param  array<int,array<string,mixed>>  $nodes
     * @return array<int,array<string,mixed>>
     */
    private static function normalizeNodes(array $nodes): array
    {
        $out = [];
        foreach ($nodes as $node) {
            if (! is_array($node)) {
                continue;
            }
            $out[] = [
                'id' => (string) ($node['node_id'] ?? $node['id'] ?? ''),
                'kind' => (string) ($node['type'] ?? $node['kind'] ?? ''),
                'inputs' => array_values((array) ($node['inputs'] ?? [])),
                'outputs' => array_values((array) ($node['outputs'] ?? [])),
            ];
        }

        return $out;
    }
}
