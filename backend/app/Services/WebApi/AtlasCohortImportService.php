<?php

namespace App\Services\WebApi;

use App\Models\App\AtlasIdMapping;
use App\Models\App\AtlasMigration;
use App\Models\App\CohortDefinition;
use App\Models\App\WebApiRegistry;
use Illuminate\Support\Facades\DB;

class AtlasCohortImportService
{
    public function __construct(
        private readonly AtlasDiscoveryService $discovery,
    ) {}

    /**
     * @param  list<int>  $atlasIds
     * @return array{registry:?WebApiRegistry,cohorts:list<array{id:int,atlas_id:int,name:string,description:?string,status:string}>,warnings:list<string>}
     */
    public function importFromActiveRegistry(array $atlasIds, ?int $userId = null): array
    {
        $ids = array_values(array_unique(array_map(static fn ($id) => (int) $id, array_filter($atlasIds, 'is_numeric'))));
        $registry = WebApiRegistry::query()
            ->where('is_active', true)
            ->orderByDesc('last_synced_at')
            ->orderByDesc('id')
            ->first();

        if ($registry === null || $ids === []) {
            return [
                'registry' => $registry,
                'cohorts' => [],
                'warnings' => $registry === null ? ['No active WebAPI registry is configured.'] : [],
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
        $warnings = [];
        $imported = 0;
        $failed = 0;
        $skipped = 0;

        foreach ($ids as $atlasId) {
            $mapped = $this->resolveExistingMapping($atlasId);
            if ($mapped !== null) {
                $this->recordMapping($migration->id, $atlasId, $mapped->id, $mapped->name, 'reused');
                $cohorts[] = [
                    'id' => $mapped->id,
                    'atlas_id' => $atlasId,
                    'name' => $mapped->name,
                    'description' => $mapped->description,
                    'status' => 'reused',
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
                $imported++;
            } catch (\Throwable $e) {
                $this->recordMapping($migration->id, $atlasId, null, "Atlas Cohort {$atlasId}", 'failed', $e->getMessage());
                $warnings[] = "Atlas cohort {$atlasId} import failed: {$e->getMessage()}";
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
            'warnings' => $warnings,
        ];
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
