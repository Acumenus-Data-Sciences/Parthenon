<?php

namespace App\Services\WebApi;

use App\Models\App\AtlasIdMapping;
use App\Models\App\AtlasMigration;
use App\Models\App\CohortDefinition;
use App\Models\App\ConceptSet;
use App\Models\App\ConceptSetItem;
use App\Models\App\WebApiRegistry;
use Illuminate\Support\Facades\DB;

class AtlasCohortImportService
{
    public function __construct(
        private readonly AtlasDiscoveryService $discovery,
    ) {}

    /**
     * @param  list<int>  $atlasIds
     * @return array{registry:?WebApiRegistry,cohorts:list<array{id:int,atlas_id:int,name:string,description:?string,status:string}>,concept_sets:list<array{atlas_id:int,parthenon_id:?int,name:string,status:string,item_count?:int}>,warnings:list<string>,diagnostics:array<string,mixed>}
     */
    public function importFromActiveRegistry(array $atlasIds, ?int $userId = null, string $importBehavior = 'auto'): array
    {
        $ids = array_values(array_unique(array_map(static fn ($id) => (int) $id, array_filter($atlasIds, 'is_numeric'))));
        $resolvedBehavior = in_array($importBehavior, ['auto', 'reuse_existing', 'reimport'], true) ? $importBehavior : 'auto';
        $registry = WebApiRegistry::query()
            ->where('is_active', true)
            ->orderByDesc('last_synced_at')
            ->orderByDesc('id')
            ->first();

        if ($registry === null || $ids === []) {
            return [
                'registry' => $registry,
                'cohorts' => [],
                'concept_sets' => [],
                'warnings' => $registry === null ? ['No active WebAPI registry is configured.'] : [],
                'diagnostics' => [
                    'import_behavior' => $resolvedBehavior,
                    'requested_cohort_ids' => $ids,
                    'registry_name' => $registry?->name,
                    'registry_url' => $registry?->base_url,
                ],
            ];
        }

        $baseUrl = rtrim($registry->base_url, '/');
        $client = $this->discovery->buildClient(
            $baseUrl,
            (string) ($registry->auth_type ?? 'none'),
            $registry->getRawOriginal('auth_credentials') ? (string) $registry->auth_credentials : null,
        );

        $migration = AtlasMigration::create([
            'webapi_url' => $baseUrl,
            'webapi_name' => $registry->name,
            'auth_type' => (string) ($registry->auth_type ?? 'none'),
            'auth_credentials' => $registry->getRawOriginal('auth_credentials') ? (string) $registry->auth_credentials : null,
            'status' => 'completed',
            'selected_entities' => ['cohort_definitions' => $ids],
            'total_entities' => count($ids),
            'imported_entities' => 0,
            'failed_entities' => 0,
            'skipped_entities' => 0,
            'started_at' => now(),
            'completed_at' => now(),
            'created_by' => $userId,
        ]);

        $cohorts = [];
        $conceptSets = [];
        $warnings = [];
        $mappingStatuses = [];
        $imported = 0;
        $failed = 0;
        $skipped = 0;

        foreach ($ids as $atlasId) {
            $mapped = $resolvedBehavior === 'reimport' ? null : $this->resolveExistingMapping($atlasId);
            if ($mapped !== null) {
                $this->recordMapping($migration->id, $atlasId, $mapped->id, $mapped->name, 'reused');
                $cohorts[] = [
                    'id' => $mapped->id,
                    'atlas_id' => $atlasId,
                    'name' => $mapped->name,
                    'description' => $mapped->description,
                    'status' => 'reused',
                ];
                $mappingStatuses[] = [
                    'atlas_id' => $atlasId,
                    'parthenon_id' => $mapped->id,
                    'status' => 'reused',
                    'name' => $mapped->name,
                ];
                $skipped++;

                continue;
            }

            try {
                $response = $client->get("{$baseUrl}/cohortdefinition/{$atlasId}");
                if (! $response->successful()) {
                    $this->recordMapping($migration->id, $atlasId, null, "Atlas Cohort {$atlasId}", 'failed', "HTTP {$response->status()}");
                    $warnings[] = "Atlas cohort {$atlasId} returned HTTP {$response->status()}.";
                    $failed++;

                    continue;
                }

                $data = $response->json();
                $name = (string) ($data['name'] ?? "Atlas Cohort {$atlasId}");
                $expression = is_array($data['expression'] ?? null) ? $data['expression'] : [];
                $conceptSetImport = $this->importExpressionConceptSets(
                    $migration->id,
                    $expression,
                    $client,
                    $baseUrl,
                    $userId,
                    $resolvedBehavior,
                );
                $expression = $conceptSetImport['expression'];
                $conceptSets = [...$conceptSets, ...$conceptSetImport['concept_sets']];
                $warnings = [...$warnings, ...$conceptSetImport['warnings']];

                /** @var CohortDefinition $cohort */
                $cohort = DB::transaction(function () use ($atlasId, $name, $data, $expression, $userId): CohortDefinition {
                    $existing = CohortDefinition::query()->where('name', $name)->first();
                    if ($existing instanceof CohortDefinition) {
                        return $existing;
                    }

                    return CohortDefinition::create([
                        'name' => $name,
                        'description' => $data['description'] ?? "Imported from Atlas/WebAPI cohort {$atlasId}",
                        'expression_json' => $expression,
                        'author_id' => $userId,
                        'is_public' => false,
                        'version' => 1,
                    ]);
                });

                $status = $cohort->wasRecentlyCreated ? 'imported' : 'matched_by_name';
                $this->recordMapping($migration->id, $atlasId, $cohort->id, $cohort->name, $status);
                $cohorts[] = [
                    'id' => $cohort->id,
                    'atlas_id' => $atlasId,
                    'name' => $cohort->name,
                    'description' => $cohort->description,
                    'status' => $status,
                ];
                $mappingStatuses[] = [
                    'atlas_id' => $atlasId,
                    'parthenon_id' => $cohort->id,
                    'status' => $status,
                    'name' => $cohort->name,
                ];
                $imported++;
            } catch (\Throwable $e) {
                $this->recordMapping($migration->id, $atlasId, null, "Atlas Cohort {$atlasId}", 'failed', $e->getMessage());
                $warnings[] = "Atlas cohort {$atlasId} import failed: {$e->getMessage()}";
                $mappingStatuses[] = [
                    'atlas_id' => $atlasId,
                    'parthenon_id' => null,
                    'status' => 'failed',
                    'name' => "Atlas Cohort {$atlasId}",
                ];
                $failed++;
            }
        }

        $migration->update([
            'imported_entities' => $imported,
            'failed_entities' => $failed,
            'skipped_entities' => $skipped,
            'import_results' => [
                'cohort_definitions' => [
                    'imported' => $imported,
                    'failed' => $failed,
                    'skipped' => $skipped,
                ],
            ],
        ]);

        return [
            'registry' => $registry,
            'cohorts' => $cohorts,
            'concept_sets' => array_values($this->uniqueConceptSetResults($conceptSets)),
            'warnings' => $warnings,
            'diagnostics' => [
                'import_behavior' => $resolvedBehavior,
                'requested_cohort_ids' => $ids,
                'registry_name' => $registry->name,
                'registry_url' => $registry->base_url,
                'imported_count' => $imported,
                'reused_count' => $skipped,
                'failed_count' => $failed,
                'mapping_statuses' => $mappingStatuses,
                'concept_set_count' => count($conceptSets),
            ],
        ];
    }

    /**
     * @param  array<string,mixed>  $expression
     * @return array{expression:array<string,mixed>,concept_sets:list<array{atlas_id:int,parthenon_id:?int,name:string,status:string,item_count?:int}>,warnings:list<string>}
     */
    private function importExpressionConceptSets(
        int $migrationId,
        array $expression,
        $client,
        string $baseUrl,
        ?int $userId,
        string $importBehavior,
    ): array {
        $rawConceptSets = is_array($expression['ConceptSets'] ?? null)
            ? $expression['ConceptSets']
            : (is_array($expression['conceptSets'] ?? null) ? $expression['conceptSets'] : []);
        if ($rawConceptSets === []) {
            return [
                'expression' => $expression,
                'concept_sets' => [],
                'warnings' => [],
            ];
        }

        $results = [];
        $warnings = [];
        $idMap = [];

        foreach ($rawConceptSets as $conceptSet) {
            if (! is_array($conceptSet)) {
                continue;
            }
            $atlasConceptSetId = (int) ($conceptSet['id'] ?? $conceptSet['Id'] ?? 0);
            if ($atlasConceptSetId <= 0) {
                continue;
            }

            $mapped = $this->importAtlasConceptSet($migrationId, $atlasConceptSetId, $client, $baseUrl, $userId, $importBehavior);
            $results[] = $mapped['summary'];
            if ($mapped['warning'] !== null) {
                $warnings[] = $mapped['warning'];
            }
            if (($mapped['summary']['parthenon_id'] ?? null) !== null) {
                $idMap[$atlasConceptSetId] = (int) $mapped['summary']['parthenon_id'];
            }
        }

        if ($idMap !== []) {
            array_walk_recursive($expression, function (&$value, $key) use ($idMap) {
                if ($key === 'CodesetId' && is_numeric($value) && isset($idMap[(int) $value])) {
                    $value = $idMap[(int) $value];
                }
            });
        }

        return [
            'expression' => $expression,
            'concept_sets' => $results,
            'warnings' => $warnings,
        ];
    }

    /**
     * @return array{summary:array{atlas_id:int,parthenon_id:?int,name:string,status:string,item_count?:int},warning:?string}
     */
    private function importAtlasConceptSet(
        int $migrationId,
        int $atlasId,
        $client,
        string $baseUrl,
        ?int $userId,
        string $importBehavior,
    ): array {
        if ($importBehavior !== 'reimport') {
            $mapped = AtlasIdMapping::query()
                ->where('entity_type', 'concept_set')
                ->where('atlas_id', $atlasId)
                ->whereIn('status', ['imported', 'reused', 'matched_by_name'])
                ->whereNotNull('parthenon_id')
                ->latest('id')
                ->first();

            if ($mapped !== null) {
                $conceptSet = ConceptSet::query()->find($mapped->parthenon_id);
                if ($conceptSet !== null) {
                    return [
                        'summary' => [
                            'atlas_id' => $atlasId,
                            'parthenon_id' => $conceptSet->id,
                            'name' => $conceptSet->name,
                            'status' => 'reused',
                            'item_count' => (int) $conceptSet->items()->count(),
                        ],
                        'warning' => null,
                    ];
                }
            }
        }

        $metaResponse = $client->get("{$baseUrl}/conceptset/{$atlasId}");
        if (! $metaResponse->successful()) {
            AtlasIdMapping::create([
                'migration_id' => $migrationId,
                'entity_type' => 'concept_set',
                'atlas_id' => $atlasId,
                'parthenon_id' => null,
                'atlas_name' => "Atlas CS {$atlasId}",
                'status' => 'failed',
                'error_message' => "HTTP {$metaResponse->status()}",
            ]);

            return [
                'summary' => [
                    'atlas_id' => $atlasId,
                    'parthenon_id' => null,
                    'name' => "Atlas CS {$atlasId}",
                    'status' => 'failed',
                ],
                'warning' => "Atlas concept set {$atlasId} returned HTTP {$metaResponse->status()}.",
            ];
        }

        $meta = $metaResponse->json();
        $name = (string) ($meta['name'] ?? "Atlas CS {$atlasId}");
        $existing = ConceptSet::query()->whereRaw('lower(name) = ?', [strtolower($name)])->first();
        if ($existing instanceof ConceptSet) {
            AtlasIdMapping::create([
                'migration_id' => $migrationId,
                'entity_type' => 'concept_set',
                'atlas_id' => $atlasId,
                'parthenon_id' => $existing->id,
                'atlas_name' => $name,
                'status' => 'matched_by_name',
                'error_message' => null,
            ]);

            return [
                'summary' => [
                    'atlas_id' => $atlasId,
                    'parthenon_id' => $existing->id,
                    'name' => $existing->name,
                    'status' => 'matched_by_name',
                    'item_count' => (int) $existing->items()->count(),
                ],
                'warning' => null,
            ];
        }

        $exprResponse = $client->get("{$baseUrl}/conceptset/{$atlasId}/expression");
        $expression = $exprResponse->successful() ? $exprResponse->json() : null;

        /** @var ConceptSet $conceptSet */
        $conceptSet = DB::transaction(function () use ($name, $meta, $expression, $userId): ConceptSet {
            $conceptSet = ConceptSet::create([
                'name' => $name,
                'description' => $meta['description'] ?? null,
                'expression_json' => $expression,
                'author_id' => $userId,
                'is_public' => false,
            ]);

            $items = $expression['items'] ?? $expression ?? [];
            if (is_array($items)) {
                foreach ($items as $item) {
                    $concept = $item['concept'] ?? $item;
                    $conceptId = $concept['CONCEPT_ID'] ?? $concept['conceptId'] ?? null;
                    if (! $conceptId) {
                        continue;
                    }

                    ConceptSetItem::create([
                        'concept_set_id' => $conceptSet->id,
                        'concept_id' => (int) $conceptId,
                        'is_excluded' => (bool) ($item['isExcluded'] ?? false),
                        'include_descendants' => (bool) ($item['includeDescendants'] ?? false),
                        'include_mapped' => (bool) ($item['includeMapped'] ?? false),
                    ]);
                }
            }

            return $conceptSet;
        });

        AtlasIdMapping::create([
            'migration_id' => $migrationId,
            'entity_type' => 'concept_set',
            'atlas_id' => $atlasId,
            'parthenon_id' => $conceptSet->id,
            'atlas_name' => $name,
            'status' => 'imported',
            'error_message' => null,
        ]);

        return [
            'summary' => [
                'atlas_id' => $atlasId,
                'parthenon_id' => $conceptSet->id,
                'name' => $conceptSet->name,
                'status' => 'imported',
                'item_count' => (int) $conceptSet->items()->count(),
            ],
            'warning' => null,
        ];
    }

    /**
     * @param  list<array{atlas_id:int,parthenon_id:?int,name:string,status:string,item_count?:int}>  $conceptSets
     * @return array<int,array{atlas_id:int,parthenon_id:?int,name:string,status:string,item_count?:int}>
     */
    private function uniqueConceptSetResults(array $conceptSets): array
    {
        $unique = [];
        foreach ($conceptSets as $entry) {
            $unique[(int) $entry['atlas_id']] = $entry;
        }

        return $unique;
    }

    private function resolveExistingMapping(int $atlasId): ?CohortDefinition
    {
        $mapping = AtlasIdMapping::query()
            ->where('entity_type', 'cohort_definition')
            ->where('atlas_id', $atlasId)
            ->whereIn('status', ['imported', 'reused', 'matched_by_name'])
            ->whereNotNull('parthenon_id')
            ->latest('id')
            ->first();

        if ($mapping === null || $mapping->parthenon_id === null) {
            return null;
        }

        return CohortDefinition::query()->find($mapping->parthenon_id);
    }

    private function recordMapping(int $migrationId, int $atlasId, ?int $parthenonId, string $name, string $status, ?string $error = null): void
    {
        AtlasIdMapping::create([
            'migration_id' => $migrationId,
            'entity_type' => 'cohort_definition',
            'atlas_id' => $atlasId,
            'parthenon_id' => $parthenonId,
            'atlas_name' => $name,
            'status' => $status,
            'error_message' => $error,
        ]);
    }
}
