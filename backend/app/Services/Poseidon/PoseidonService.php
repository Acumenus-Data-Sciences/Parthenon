<?php

namespace App\Services\Poseidon;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Communicates with the Dagster GraphQL API for run management.
 */
class PoseidonService
{
    private string $dagsterUrl;

    public function __construct()
    {
        $port = config('services.poseidon.port', 3100);
        $this->dagsterUrl = "http://poseidon-server:{$port}/graphql";
    }

    /**
     * Log safely — if the logger itself fails (e.g. permission denied on log file),
     * fall back to error_log() so exceptions never escape catch blocks.
     */
    private function safeLog(string $level, string $message, array $context = []): void
    {
        try {
            Log::{$level}($message, $context);
        } catch (\Throwable) { // @phpstan-ignore-line Monolog can throw on permission denied
            error_log("Poseidon [{$level}]: {$message} ".json_encode($context));
        }
    }

    /**
     * Trigger a pipeline run via Dagster GraphQL.
     *
     * @return array{dagster_run_id: string}|null
     */
    public function triggerRun(string $runType, ?int $sourceId = null, ?string $dbtSelector = null): ?array
    {
        $jobName = match ($runType) {
            'full_refresh' => 'full_refresh_job',
            'vocabulary' => 'vocabulary_refresh_job',
            default => 'incremental_refresh_job',
        };

        $runConfigData = [];
        if ($sourceId) {
            $runConfigData['ops'] = [
                'dbt_assets' => [
                    'config' => [
                        'source_id' => $sourceId,
                    ],
                ],
            ];
        }

        $mutation = <<<'GRAPHQL'
        mutation LaunchRun($executionParams: ExecutionParams!) {
            launchRun(executionParams: $executionParams) {
                __typename
                ... on LaunchRunSuccess {
                    run { runId }
                }
                ... on PythonError {
                    message
                }
            }
        }
        GRAPHQL;

        try {
            $response = Http::connectTimeout(3)->timeout(10)->post($this->dagsterUrl, [
                'query' => $mutation,
                'variables' => [
                    'executionParams' => [
                        'selector' => ['jobName' => $jobName],
                        'runConfigData' => $runConfigData,
                        ...(($dbtSelector) ? ['tags' => [['key' => 'dbt_selector', 'value' => $dbtSelector]]] : []),
                    ],
                ],
            ]);

            $data = $response->json('data.launchRun');

            if (($data['__typename'] ?? '') === 'LaunchRunSuccess') {
                return ['dagster_run_id' => $data['run']['runId']];
            }

            $this->safeLog('warning', 'Poseidon: Dagster launch failed', ['response' => $data]);

            return null;
        } catch (\Throwable $e) {
            $this->safeLog('error', 'Poseidon: Failed to communicate with Dagster', ['error' => $e->getMessage()]);

            return null;
        }
    }

    /**
     * Get freshness info for CDM tables from Dagster asset metadata.
     *
     * @return array<string, array{table: string, last_materialized: string|null}>
     */
    public function getFreshness(): array
    {
        $query = <<<'GRAPHQL'
        query {
            assetsOrError {
                __typename
                ... on AssetConnection {
                    nodes {
                        key { path }
                        assetMaterializations(limit: 1) {
                            timestamp
                        }
                    }
                }
            }
        }
        GRAPHQL;

        try {
            $response = Http::connectTimeout(3)->timeout(10)->post($this->dagsterUrl, [
                'query' => $query,
            ]);

            $nodes = $response->json('data.assetsOrError.nodes', []);
            $freshness = [];

            foreach ($nodes as $node) {
                $path = implode('.', $node['key']['path'] ?? []);
                $lastMat = $node['assetMaterializations'][0]['timestamp'] ?? null;
                $freshness[$path] = [
                    'table' => $path,
                    'last_materialized' => $lastMat ? date('c', (int) ($lastMat / 1000)) : null,
                ];
            }

            return $freshness;
        } catch (\Throwable $e) {
            $this->safeLog('warning', 'Poseidon: Failed to fetch freshness', ['error' => $e->getMessage()]);

            return [];
        }
    }

    /**
     * Get the asset dependency graph (lineage) from Dagster.
     *
     * @return array<int, array{key: string, dependencies: string[]}>
     */
    public function getLineage(): array
    {
        $query = <<<'GRAPHQL'
        query {
            assetsOrError {
                __typename
                ... on AssetConnection {
                    nodes {
                        key { path }
                        dependencyKeys { path }
                    }
                }
            }
        }
        GRAPHQL;

        try {
            $response = Http::connectTimeout(3)->timeout(10)->post($this->dagsterUrl, [
                'query' => $query,
            ]);

            $nodes = $response->json('data.assetsOrError.nodes', []);
            $lineage = [];

            foreach ($nodes as $node) {
                $lineage[] = [
                    'key' => implode('.', $node['key']['path'] ?? []),
                    'dependencies' => array_map(
                        fn (array $dep) => implode('.', $dep['path'] ?? []),
                        $node['dependencyKeys'] ?? []
                    ),
                ];
            }

            return $lineage;
        } catch (\Throwable $e) {
            $this->safeLog('warning', 'Poseidon: Failed to fetch lineage', ['error' => $e->getMessage()]);

            return [];
        }
    }
}
